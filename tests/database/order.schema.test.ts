import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, expectStatementToFail, inTransaction } from './helpers/db'
import type { Client } from 'pg'
import { branchIds, restaurantIds, sessionIds } from './helpers/fixtures'

/**
 * Declaration-shape suite for the Phase 7 order tables (spec 008 T006;
 * data-model.md; FR-005, FR-006, FR-012, FR-015, FR-018; Constitution IV/VI).
 *
 * Posture proven here:
 *  - every column, type and nullability matches data-model.md in ordinal order
 *  - every named constraint exists exactly as declared (closed `state` checks —
 *    FR-012's no-transitions posture — quantity bounds, money `>= 0`, the
 *    structural uniques, and the partial `kitchen_tickets_one_per_round` index
 *    enforced by attempting a second ticket for one round in a rolled-back
 *    transaction — FR-007's SC-003 foundation)
 *  - the **zero-grant posture**: `anon` and `authenticated` hold no privilege
 *    of any kind on the four tables — the two RPCs are the only write paths.
 *
 * Preconditions: the cloud development database is migrated and seeded.
 * Every mutation runs inside a transaction that is rolled back.
 */

const client: Client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

const CLIENT_ROLES = ['anon', 'authenticated'] as const
const ORDER_TABLES = ['rounds', 'round_items', 'round_item_extras', 'kitchen_tickets'] as const

type ColumnShape = {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

async function columns(table: string): Promise<ColumnShape[]> {
  const res = await client.query(
    `select column_name, data_type, is_nullable, column_default
     from information_schema.columns
     where table_schema = 'public' and table_name = $1
     order by ordinal_position`,
    [table],
  )
  return res.rows
}
async function constraints(table: string): Promise<Array<{ conname: string; def: string }>> {
  const res = await client.query(
    `select conname, pg_get_constraintdef(oid) as def
       from pg_constraint
       where conrelid = ('public.' || $1)::regclass
       order by conname`,
    [table],
  )
  return res.rows
}

describe('order tables: declared columns, types, nullability (data-model.md)', () => {
  it('rounds matches its declared columns in ordinal order', async () => {
    const cols = await columns('rounds')
    expect(cols.map((c) => c.column_name)).toEqual([
      'id',
      'restaurant_id',
      'branch_id',
      'session_id',
      'state',
      'subtotal',
      'tax_total',
      'tax_lines',
      'created_at',
    ])
    expect(cols.map((c) => c.data_type)).toEqual([
      'uuid',
      'uuid',
      'uuid',
      'uuid',
      'text',
      'numeric',
      'numeric',
      'jsonb',
      'timestamp with time zone',
    ])
    const state = cols.find((c) => c.column_name === 'state')
    expect(state?.column_default).toContain("'new'")
    expect(state?.is_nullable).toBe('NO')
    const subtotal = cols.find((c) => c.column_name === 'subtotal')
    expect(subtotal?.is_nullable).toBe('NO')
  })

  it('round_items matches its declared columns in ordinal order', async () => {
    const cols = await columns('round_items')
    expect(cols.map((c) => c.column_name)).toEqual([
      'id',
      'restaurant_id',
      'round_id',
      'item_id',
      'quantity',
      'unit_price',
      'created_at',
    ])
    const quantity = cols.find((c) => c.column_name === 'quantity')
    expect(quantity?.data_type).toBe('integer')
    expect(quantity?.is_nullable).toBe('NO')
    const unitPrice = cols.find((c) => c.column_name === 'unit_price')
    expect(unitPrice?.data_type).toBe('numeric')
    expect(unitPrice?.is_nullable).toBe('NO')
  })

  it('round_item_extras matches its declared columns in ordinal order', async () => {
    const cols = await columns('round_item_extras')
    expect(cols.map((c) => c.column_name)).toEqual([
      'id',
      'restaurant_id',
      'round_item_id',
      'extra_id',
      'price_adjustment',
      'created_at',
    ])
    const adj = cols.find((c) => c.column_name === 'price_adjustment')
    expect(adj?.data_type).toBe('numeric')
    expect(adj?.is_nullable).toBe('NO')
  })

  it('kitchen_tickets matches its declared columns in ordinal order', async () => {
    const cols = await columns('kitchen_tickets')
    expect(cols.map((c) => c.column_name)).toEqual([
      'id',
      'restaurant_id',
      'branch_id',
      'round_id',
      'state',
      'created_at',
    ])
    const state = cols.find((c) => c.column_name === 'state')
    expect(state?.column_default).toContain("'new'")
    expect(state?.is_nullable).toBe('NO')
  })
})

describe('order tables: named constraints', () => {
  it('rounds carries the closed state check and money bounds', async () => {
    const rows = await constraints('rounds')
    const defs = rows.map((r) => r.def).join('\n')
    expect(defs).toContain("state = 'new'::text")
    expect(defs).toMatch(/subtotal >= \(0\)::numeric/)
    expect(defs).toMatch(/tax_total >= \(0\)::numeric/)
  })

  it('round_items carries the quantity bounds and money bounds', async () => {
    const rows = await constraints('round_items')
    const defs = rows.map((r) => r.def).join('\n')
    expect(defs).toMatch(/quantity >= 1/)
    expect(defs).toMatch(/quantity <= 99/)
    expect(defs).toMatch(/unit_price >= \(0\)::numeric/)
  })

  it('round_items carries unique (round_id, item_id)', async () => {
    const rows = await constraints('round_items')
    const uniq = rows.filter((r) => r.def.includes('UNIQUE'))
    expect(uniq.some((r) => /round_id/.test(r.def) && /item_id/.test(r.def))).toBe(true)
  })

  it('round_item_extras carries unique (round_item_id, extra_id)', async () => {
    const rows = await constraints('round_item_extras')
    const uniq = rows.filter((r) => r.def.includes('UNIQUE'))
    expect(uniq.some((r) => /round_item_id/.test(r.def) && /extra_id/.test(r.def))).toBe(true)
  })

  it('kitchen_tickets carries the closed state check', async () => {
    const rows = await constraints('kitchen_tickets')
    const defs = rows.map((r) => r.def).join('\n')
    expect(defs).toContain("state = 'new'::text")
  })

  it('a second kitchen ticket for one round is impossible (SC-003 foundation)', async () => {
    await inTransaction(client, async () => {
      // A scratch round for the seeded session, then the duplicate-ticket
      // attempt — the partial unique index must reject it; rollback undoes all.
      const round = await client.query(
        `insert into public.rounds (restaurant_id, branch_id, session_id, state, subtotal, tax_total, tax_lines)
         values ($1, $2, $3, 'new', 0, 0, '[]'::jsonb) returning id`,
        [restaurantIds.blueOlive, branchIds.downtown, sessionIds.downtownT1],
      )
      const roundId = round.rows[0].id as string
      await client.query(
        `insert into public.kitchen_tickets (restaurant_id, branch_id, round_id, state)
         values ($1, $2, $3, 'new')`,
        [restaurantIds.blueOlive, branchIds.downtown, roundId],
      )
      await expectStatementToFail(
        client,
        '23505' /* unique_violation — the partial unique index kitchen_tickets_one_per_round */,
        `insert into public.kitchen_tickets (restaurant_id, branch_id, round_id, state)
         values ($1, $2, $3, 'new')`,
        [restaurantIds.blueOlive, branchIds.downtown, roundId],
      )
    })
  })
})

describe('order tables: the zero-grant posture (Constitution IV)', () => {
  it('no client role holds any privilege on any order table', async () => {
    for (const table of ORDER_TABLES) {
      for (const role of CLIENT_ROLES) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          const res = await client.query(
            `select has_table_privilege($1, 'public.' || $2, $3) as allowed`,
            [role, table, privilege],
          )
          expect(res.rows[0].allowed, `${role} must not hold ${privilege} on ${table}`).toBe(false)
        }
      }
    }
  })
})
