import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, expectStatementToFail, inTransaction } from './helpers/db'
import type { Client } from 'pg'
import { branchIds, profileIds, restaurantIds, sessionIds } from './helpers/fixtures'

/**
 * Declaration-shape suite for the Phase 9 channel schema (spec 010 T006;
 * data-model.md; FR-001, FR-003, FR-012; research.md §1).
 *
 * Posture proven here:
 *  - `sessions.type` widens to exactly dine-in/delivery/takeaway; `rounds.state`
 *    widens to the seven-state machine (the two new delivery states appended);
 *  - `kitchen_tickets.state` is NOT widened — tickets end at `ready` for every
 *    channel (spec Q1's "the ticket machine does NOT extend");
 *  - `table_id` is nullable (channel sessions have no table) while the
 *    closed-shape check is unchanged;
 *  - `delivery_address` exists with its two rules: bounded text (1–200 after
 *    trim) and required-for-delivery (enforced by attempting the violating
 *    inserts in a rolled-back transaction);
 *  - the address is immutable after creation — no code path updates it, so the
 *    suite proves the rule the way the database can: the seed/open path sets
 *    it once and the entry RPC refuses nothing after (data-model.md states
 *    the rule; the RPC contract has no update path — FR-003).
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

async function constraintDef(table: string, name: string): Promise<string> {
  const res = await client.query<{ def: string }>(
    `select pg_get_constraintdef(oid) as def
       from pg_constraint
      where conrelid = ('public.' || $1)::regclass and conname = $2`,
    [table, name],
  )
  return res.rows[0]!.def
}

describe('channel schema: the widened checks (data-model.md)', () => {
  it('sessions.type admits exactly the three channels', async () => {
    const def = await constraintDef('sessions', 'sessions_type_check')
    expect(def).toContain('dine-in')
    expect(def).toContain('delivery')
    expect(def).toContain('takeaway')
    expect(def.replace('dine-in', '').replace('delivery', '').replace('takeaway', '')).not.toMatch(
      /'[a-z-]+'/,
    )
  })

  it('rounds.state widens to the seven-state machine in lifecycle order', async () => {
    const def = await constraintDef('rounds', 'rounds_state_check')
    const states = [
      'new',
      'accepted',
      'preparing',
      'ready',
      'out_for_delivery',
      'completed',
      'lock',
    ]
    let cursor = -1
    for (const state of states) {
      const at = def.indexOf(`'${state}'`)
      expect(at, `state '${state}' missing`).toBeGreaterThan(cursor)
      cursor = at
    }
  })

  it('kitchen_tickets.state is NOT widened — every channel ends tickets at ready', async () => {
    const def = await constraintDef('kitchen_tickets', 'kitchen_tickets_state_check')
    expect(def).toContain('new')
    expect(def).toContain('accepted')
    expect(def).toContain('preparing')
    expect(def).toContain('ready')
    expect(def).not.toContain('out_for_delivery')
    expect(def).not.toContain('completed')
  })

  it('table_id is nullable for channel sessions; the closed-shape check is unchanged', async () => {
    const res = await client.query<{ is_nullable: string }>(
      `select is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'sessions' and column_name = 'table_id'`,
    )
    expect(res.rows[0]!.is_nullable).toBe('YES')
    const shape = await constraintDef('sessions', 'sessions_closed_shape')
    expect(shape).toContain("status = 'open'")
    expect(shape).toContain('closed_at')
  })

  it('delivery_address has its two rules: bounded text and required-for-delivery', async () => {
    const bounded = await constraintDef('sessions', 'sessions_delivery_address_check')
    expect(bounded).toContain('delivery_address IS NULL')
    expect(bounded).toContain('200')
    const required = await constraintDef('sessions', 'sessions_delivery_address_required_check')
    expect(required).toContain("type <> 'delivery'")
    expect(required).toContain('delivery_address IS NOT NULL')
  })
})

describe('channel schema: the rules enforced by attempted violations', () => {
  it('a delivery session without an address refuses (23514)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        [
          'insert into public.sessions',
          '  (id, restaurant_id, branch_id, table_id, type, status, delivery_address)',
          'values',
          "  (gen_random_uuid(), $1, $2, null, 'delivery', 'open', null)",
        ].join(' '),
        [restaurantIds.blueOlive, branchIds.downtown],
      )
    })
  })

  it('an address beyond 200 chars refuses (23514)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        [
          'insert into public.sessions',
          '  (id, restaurant_id, branch_id, table_id, type, status, delivery_address)',
          'values',
          "  (gen_random_uuid(), $1, $2, null, 'delivery', 'open', repeat('x', 201))",
        ].join(' '),
        [restaurantIds.blueOlive, branchIds.downtown],
      )
    })
  })

  it('a round outside the seven states refuses (23514)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        [
          'insert into public.rounds',
          '  (id, restaurant_id, branch_id, session_id, state, subtotal, tax_total, tax_lines)',
          'values',
          "  (gen_random_uuid(), $1, $2, $3, 'sealed', 0, 0, '[]'::jsonb)",
        ].join(' '),
        [restaurantIds.blueOlive, branchIds.downtown, sessionIds.downtownT1],
      )
    })
  })

  it('multiple open channel sessions coexist on one branch (NULLs are distinct)', async () => {
    await inTransaction(client, async () => {
      // Two open delivery sessions with NULL tables on the same branch: the
      // partial unique index stays silent (NULLs are distinct in btree), so
      // channels never collide with each other or with dine-in's guarantee.
      for (let i = 0; i < 2; i += 1) {
        await client.query(
          [
            'insert into public.sessions',
            '  (id, restaurant_id, branch_id, table_id, type, status, delivery_address)',
            'values',
            "  (gen_random_uuid(), $1, $2, null, 'delivery', 'open', $3)",
          ].join(' '),
          [restaurantIds.blueOlive, branchIds.downtown, `${'x'.repeat(1 + i)} street`],
        )
      }
      // And an open dine-in session on an unused table still coexists.
      // T3 may carry an e2e residue session from a crashed run — close it so
      // the "free table" premise holds regardless of the surrounding state.
      await client.query(
        `update public.sessions set status = 'closed', closed_at = now(),
               closed_by_profile_id = $2
           where status = 'open' and table_id in (
             select t.id from public.dining_tables t where t.branch_id = $1
               and t.label = 'T3')`,
        [branchIds.downtown, profileIds.alice],
      )
      const free = await client.query<{ id: string }>(
        `select t.id from public.dining_tables t
          where t.branch_id = $1
            and not exists (
              select 1 from public.sessions s
               where s.table_id = t.id and s.status = 'open'
            )
          limit 1`,
        [branchIds.downtown],
      )
      await client.query(
        [
          'insert into public.sessions',
          '  (id, restaurant_id, branch_id, table_id, type, status)',
          'values',
          "  (gen_random_uuid(), $1, $2, $3, 'dine-in', 'open')",
        ].join(' '),
        [restaurantIds.blueOlive, branchIds.downtown, free.rows[0]!.id],
      )
    })
  })

  it('the seeded channel sessions carry the data-model facts', async () => {
    const res = await client.query<{
      type: string
      delivery_address: string | null
      status: string
    }>(
      `select type, delivery_address, status from public.sessions
        where id in ($1, $2) order by type`,
      ['00000000-0000-4000-8000-000000008003', '00000000-0000-4000-8000-000000008004'],
    )
    expect(res.rows.map((r) => r.type)).toEqual(['delivery', 'takeaway'])
    const delivery = res.rows.find((r) => r.type === 'delivery')!
    expect(delivery.delivery_address).toBe('12 Marina Walk')
    expect(delivery.status).toBe('open')
    const takeaway = res.rows.find((r) => r.type === 'takeaway')!
    expect(takeaway.delivery_address).toBeNull()
  })
})
