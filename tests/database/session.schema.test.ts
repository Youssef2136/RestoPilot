import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, expectStatementToFail, inTransaction } from './helpers/db'
import {
  branchIds,
  diningTableIds,
  restaurantIds,
  sessionIds,
  sessionParticipantIds,
  sessionTokenIds,
} from './helpers/fixtures'

/**
 * Schema-level tests for the Phase 6 session model (spec 007 FR-005, FR-007,
 * FR-011, FR-015, FR-016, FR-020; data-model.md; research.md §3, §5, §6).
 *
 * These assert what the DATABASE declares — column shapes in ordinal order,
 * the constraints by name that the RPCs translate into messages, the
 * zero-grant posture that makes the RPC layer the entire surface, and the
 * seeded fixture contract. Behavior (authorization, open-or-join, token
 * verification, scoping) lives in `session.rpc.test.ts` (T008).
 *
 * Preconditions: the cloud development database is migrated and seeded.
 * Every mutation runs inside a transaction that is rolled back.
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

describe('session tables: declared columns, types, nullability (data-model.md)', () => {
  const columnShapes: Record<string, Array<[string, string, string]>> = {
    sessions: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['branch_id', 'uuid', 'NO'],
      // Phase 9 (spec 010): delivery/takeaway sessions have no table — the
      // 007-era NOT NULL is superseded (dine-in still requires one through
      // its entry RPC and the check constraints).
      ['table_id', 'uuid', 'YES'],
      ['type', 'text', 'NO'],
      ['status', 'text', 'NO'],
      ['opened_at', 'timestamp with time zone', 'NO'],
      ['closed_at', 'timestamp with time zone', 'YES'],
      ['closed_by_profile_id', 'uuid', 'YES'],
      ['created_at', 'timestamp with time zone', 'NO'],
      // Phase 9 (spec 010): the delivery channel's address (null otherwise).
      ['delivery_address', 'text', 'YES'],
    ],
    session_participants: [
      ['id', 'uuid', 'NO'],
      ['session_id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['display_name', 'text', 'NO'],
      ['phone', 'text', 'NO'],
      ['joined_at', 'timestamp with time zone', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ],
    session_tokens: [
      ['id', 'uuid', 'NO'],
      ['session_id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['token_hash', 'text', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ],
  }

  for (const [table, expected] of Object.entries(columnShapes)) {
    it(`${table}: columns, types and nullability in ordinal order`, async () => {
      const res = await client.query<{
        column_name: string
        data_type: string
        is_nullable: string
      }>(
        `select column_name, data_type, is_nullable
           from information_schema.columns
          where table_schema = 'public' and table_name = $1
          order by ordinal_position`,
        [table],
      )
      expect(res.rows).toEqual(
        expected.map(([column_name, data_type, is_nullable]) => ({
          column_name,
          data_type,
          is_nullable,
        })),
      )
    })
  }
})

describe('sessions constraints by name', () => {
  it('declares the expected checks, FKs and the partial unique index', async () => {
    const checks = await client.query<{ conname: string }>(
      `select conname from pg_constraint
        where conrelid = 'public.sessions'::regclass
          and contype in ('c', 'f')
        order by conname`,
    )
    expect(checks.rows.map((r) => r.conname)).toEqual(
      expect.arrayContaining([
        'sessions_type_check',
        'sessions_status_check',
        'sessions_branch_scope_fkey',
        'sessions_table_fkey',
        'sessions_closed_by_fkey',
        'sessions_closed_shape',
      ]),
    )

    const partial = await client.query<{ indexname: string; indexdef: string }>(
      `select indexname, indexdef from pg_indexes
        where schemaname = 'public' and indexname = 'sessions_one_open_per_table'`,
    )
    expect(partial.rows).toHaveLength(1)
    expect(partial.rows[0]!.indexdef).toContain('UNIQUE')
    expect(partial.rows[0]!.indexdef).toContain("status = 'open'::text")
  })

  it('rejects a session type outside the channels (sessions_type_check — widened by Phase 9)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.sessions (restaurant_id, branch_id, table_id, type)
         values ($1, $2, $3, 'drive-thru')`,
        [restaurantIds.blueOlive, branchIds.downtown, diningTableIds.downtownT3],
      )
    })
  })

  it('rejects a status outside open/closed (sessions_status_check)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.sessions (restaurant_id, branch_id, table_id, status)
         values ($1, $2, $3, 'paused')`,
        [restaurantIds.blueOlive, branchIds.downtown, diningTableIds.downtownT3],
      )
    })
  })

  it('enforces the closed shape: closed_at/closed_by must agree with status', async () => {
    await inTransaction(client, async () => {
      // closed with no closer.
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.sessions (restaurant_id, branch_id, table_id, status, closed_at)
         values ($1, $2, $3, 'closed', now())`,
        [restaurantIds.blueOlive, branchIds.downtown, diningTableIds.downtownT3],
      )
      // open but stamped closed.
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.sessions (restaurant_id, branch_id, table_id, status, closed_at, closed_by_profile_id)
         values ($1, $2, $3, 'open', now(), (select id from public.profiles limit 1))`,
        [restaurantIds.blueOlive, branchIds.downtown, diningTableIds.downtownT3],
      )
    })
  })

  it('allows at most one open session per table; a closed one never blocks (partial unique)', async () => {
    await inTransaction(client, async () => {
      // The seeded T1 session is open — a second open insert violates.
      await expectStatementToFail(
        client,
        '23505',
        `insert into public.sessions (restaurant_id, branch_id, table_id)
         values ($1, $2, $3)`,
        [restaurantIds.blueOlive, branchIds.downtown, diningTableIds.downtownT1],
      )
      // After T1 closes (in-transaction), a new open session is allowed.
      await client.query(
        `update public.sessions set status = 'closed', closed_at = now(), closed_by_profile_id = (select id from public.profiles limit 1) where id = $1`,
        [sessionIds.downtownT1],
      )
      const reopen = await client.query<{ id: string }>(
        `insert into public.sessions (restaurant_id, branch_id, table_id)
         values ($1, $2, $3) returning id`,
        [restaurantIds.blueOlive, branchIds.downtown, diningTableIds.downtownT1],
      )
      expect(reopen.rows).toHaveLength(1)
    })
  })

  it('rejects a session whose branch belongs to another restaurant (branch scope FK)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23503',
        `insert into public.sessions (restaurant_id, branch_id, table_id)
         values ($1, $2, $3)`,
        [restaurantIds.cedarGrill, branchIds.downtown, diningTableIds.airportT1],
      )
    })
  })
})

describe('session_participants constraints', () => {
  it('rejects a blank or over-long display name (the documented bounds)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.session_participants (session_id, restaurant_id, display_name, phone)
         values ($1, $2, '   ', '+15550001')`,
        [sessionIds.downtownT1, restaurantIds.blueOlive],
      )
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.session_participants (session_id, restaurant_id, display_name, phone)
         values ($1, $2, repeat('x', 61), '+15550001')`,
        [sessionIds.downtownT1, restaurantIds.blueOlive],
      )
    })
  })

  it('rejects a phone of invalid shape', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.session_participants (session_id, restaurant_id, display_name, phone)
         values ($1, $2, 'Noor', '555-letters')`,
        [sessionIds.downtownT1, restaurantIds.blueOlive],
      )
    })
  })
})

describe('session_tokens constraints', () => {
  it('requires a 64-character hex hash and rejects duplicates (the verification lookup)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.session_tokens (session_id, restaurant_id, token_hash)
         values ($1, $2, 'not-a-hash')`,
        [sessionIds.downtownT1, restaurantIds.blueOlive],
      )
      // Duplicate of the seeded T1 hash → the unique index.
      await expectStatementToFail(
        client,
        '23505',
        `insert into public.session_tokens (session_id, restaurant_id, token_hash)
         select $1, $2, token_hash from public.session_tokens where session_id = $3 limit 1`,
        [sessionIds.downtownT2, restaurantIds.blueOlive, sessionIds.downtownT1],
      )
    })
  })
})

describe('zero-grant posture: the RPC layer is the entire surface (Constitution IV)', () => {
  for (const table of ['sessions', 'session_participants', 'session_tokens']) {
    it(`${table}: anon and authenticated hold no table privileges`, async () => {
      const res = await client.query<{ has: boolean }>(
        `select
           has_table_privilege('anon', 'public.${table}', 'select') as has
         union all
         select has_table_privilege('authenticated', 'public.${table}', 'select')`,
      )
      expect(res.rows.every((r) => r.has === false)).toBe(true)
    })

    it(`${table}: RLS is enabled even though no client role can reach it`, async () => {
      const res = await client.query<{ relrowsecurity: boolean }>(
        `select relrowsecurity from pg_class
          where oid = 'public.${table}'::regclass`,
      )
      expect(res.rows[0]!.relrowsecurity).toBe(true)
    })
  }

  it('no policy exists on any session table (grant-less posture needs none)', async () => {
    const res = await client.query<{ policyname: string }>(
      `select policyname from pg_policies
        where schemaname = 'public'
          and tablename in ('sessions', 'session_participants', 'session_tokens')`,
    )
    expect(res.rows).toEqual([])
  })
})

describe('seeded fixture contract (SC-007)', () => {
  it('the two demo sessions are open at Downtown T1/T2', async () => {
    const res = await client.query<{ id: string; table_id: string; status: string }>(
      `select id, table_id, status from public.sessions where id = any($1) order by id`,
      [[sessionIds.downtownT1, sessionIds.downtownT2]],
    )
    expect(res.rows).toHaveLength(2)
    expect(res.rows.every((r) => r.status === 'open')).toBe(true)
    expect(res.rows.map((r) => r.table_id).sort()).toEqual(
      [diningTableIds.downtownT1, diningTableIds.downtownT2].sort(),
    )
  })

  it('the seeded participants bind to their sessions with fixture names', async () => {
    const res = await client.query<{ session_id: string; display_name: string }>(
      `select session_id, display_name from public.session_participants
        where id = any($1) order by joined_at`,
      [
        [
          sessionParticipantIds.downtownT1P1,
          sessionParticipantIds.downtownT1P2,
          sessionParticipantIds.downtownT2P1,
        ],
      ],
    )
    expect(res.rows.map((r) => r.display_name)).toEqual(['Sara', 'Omar', 'Lina'])
  })

  it('each dev token hash is a 64-char hex bound to its session (hashes only — never plaintext)', async () => {
    const res = await client.query<{ session_id: string; token_hash: string }>(
      `select session_id, token_hash from public.session_tokens where id = any($1) order by session_id`,
      [[sessionTokenIds.downtownT1, sessionTokenIds.downtownT2]],
    )
    expect(res.rows).toHaveLength(2)
    for (const row of res.rows) {
      expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/)
    }
    expect(res.rows.map((r) => r.session_id)).toEqual([
      sessionIds.downtownT1,
      sessionIds.downtownT2,
    ])
  })

  it('the branch scope FKs hold for the seeded rows', async () => {
    const res = await client.query<{ n: string }>(
      `select count(*)::text as n from public.sessions s
        join public.branches b on b.restaurant_id = s.restaurant_id and b.id = s.branch_id
        join public.dining_tables t on t.id = s.table_id and t.branch_id = s.branch_id
        where s.restaurant_id = $1`,
      [restaurantIds.blueOlive],
    )
    expect(Number(res.rows[0]!.n)).toBeGreaterThanOrEqual(2)
  })

  it('branchIds/branch-scope FK sanity for Downtown', async () => {
    const res = await client.query<{ n: string }>(
      `select count(*)::text as n from public.branches where id = $1 and restaurant_id = $2`,
      [branchIds.downtown, restaurantIds.blueOlive],
    )
    expect(Number(res.rows[0]!.n)).toBe(1)
  })
})
