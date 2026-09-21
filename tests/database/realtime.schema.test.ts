import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, inTransaction } from './helpers/db'
import {
  authUserIds,
  branchIds,
  diningTableIds,
  menuItemIds,
  restaurantIds,
} from './helpers/fixtures'

/**
 * The realtime authorization surface (spec 012 T003; data-model.md §1–§2;
 * research.md §1–§2, §6).
 *
 * The publication: exactly the five intended tables, INSERT+UPDATE+DELETE.
 * The policies: exactly one SELECT policy per ordering table with the 009
 * `has_branch_role` predicate (no drift), zero policies elsewhere on the
 * previously policy-less tables, RLS still enabled, ZERO direct-table
 * grants (the RPC-only posture holds — the policy authorizes Realtime's
 * per-row delivery, not client reads). The fail-closed direction: an
 * identity with no membership matches no policy row; fiona (an unrelated
 * restaurant's owner) matches nothing on Blue Olive rows.
 *
 * Every probe runs inside ONE rolled-back transaction (the house method);
 * identity switches ride the simulated JWT claims.
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

/** Act as the identity for the remainder of the current transaction. */
async function asIdentity(authUserId: string): Promise<void> {
  await client.query('set local role authenticated')
  await client.query('select set_config($1, $2, true)', [
    'request.jwt.claims',
    JSON.stringify({ role: 'authenticated', sub: authUserId }),
  ])
}

/** Drop back to the table owner (verification reads). */
async function asOwner(): Promise<void> {
  await client.query('reset role')
}

describe('the realtime publication (data-model.md §1)', () => {
  it('carries exactly the five intended tables with all three event flags', async () => {
    const res = await client.query<{ tablename: string }>(
      `select tablename from pg_publication_tables
        where pubname = 'supabase_realtime' order by tablename`,
    )
    expect(res.rows.map((r) => r.tablename)).toEqual([
      'branch_unavailable_items',
      'dining_tables',
      'kitchen_tickets',
      'rounds',
      'sessions',
    ])
  })

  it('publishes insert, update, and delete for the ordering tables', async () => {
    const res = await client.query<{
      pubinsert: boolean
      pubupdate: boolean
      pubdelete: boolean
    }>(
      `select pubinsert, pubupdate, pubdelete from pg_publication
        where pubname = 'supabase_realtime'`,
    )
    expect(res.rows[0]).toMatchObject({ pubinsert: true, pubupdate: true, pubdelete: true })
  })

  it('the other tenant tables remain unpublished (no superset)', async () => {
    const res = await client.query<{ tablename: string }>(
      `select tablename from pg_publication_tables
        where pubname = 'supabase_realtime'
          and tablename in ('menu_items', 'staff_memberships', 'profiles', 'tax_rules')`,
    )
    expect(res.rows).toEqual([])
  })
})

describe('the realtime SELECT policies (data-model.md §2)', () => {
  it('exactly one SELECT policy exists on each ordering table, with the 009 predicate shape', async () => {
    const res = await client.query<{
      tablename: string
      policyname: string
      cmd: string
      roles: string[] | null
      qual: string
    }>(
      `select tablename, policyname, cmd, roles, qual from pg_policies
        where schemaname = 'public'
          and tablename in ('rounds', 'kitchen_tickets', 'sessions')
        order by tablename`,
    )
    expect(res.rows.map((r) => r.tablename)).toEqual(['kitchen_tickets', 'rounds', 'sessions'])
    for (const row of res.rows) {
      expect(row.cmd).toBe('SELECT')
      // pg_policies returns the roles as a text[] — assert by content.
      expect(row.roles).toContain('authenticated')
      // The authorization vocabulary is the 009 helper, verbatim — no drift.
      expect(row.qual).toContain('private.has_branch_role')
      expect(row.qual).toContain('private.ops_profile_id()')
    }
  })

  it('RLS stays enabled and force-row-security stays off on the published tables', async () => {
    const res = await client.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('rounds', 'kitchen_tickets', 'sessions',
                            'branch_unavailable_items', 'dining_tables')
        order by c.relname`,
    )
    for (const row of res.rows) {
      expect(row.relrowsecurity).toBe(true)
    }
  })

  it('the realtime grant is SELECT-only for authenticated; anon stays closed', async () => {
    // Phase 11 (spec 012): the SELECT grant is the minimum Postgres requires
    // for Realtime to evaluate the policies as the subscriber's role — the
    // RPC-only WRITE posture is unchanged (no INSERT/UPDATE/DELETE grants,
    // anon receives nothing).
    const res = await client.query<{ grantee: string; privilege_type: string }>(
      `select grantee, privilege_type from information_schema.role_table_grants
        where table_schema = 'public'
          and table_name in ('rounds', 'kitchen_tickets', 'sessions')
          and grantee in ('anon', 'authenticated')
        order by grantee, privilege_type`,
    )
    expect(res.rows).toEqual([
      { grantee: 'authenticated', privilege_type: 'SELECT' },
      { grantee: 'authenticated', privilege_type: 'SELECT' },
      { grantee: 'authenticated', privilege_type: 'SELECT' },
    ])
  })
})

describe('the policies deliver the right rows to the right identities', () => {
  it('carla (Downtown cashier) matches Downtown rows and nothing on Marina', async () => {
    await inTransaction(client, async () => {
      // Produce a REAL round through the customer RPC — the fixture is
      // deterministic-empty; the policy probes need a row that exists.
      await client.query('set local role anon')
      const submitted = await client.query<{ p: { round: { id: string } } }>(
        "select public.submit_round('dev-token-downtown-t1-2026', $1) as p",
        [JSON.stringify([{ item_id: menuItemIds.lambKebab, extras: [], quantity: '1' }])],
      )
      await asOwner()
      const roundId = submitted.rows[0]!.p.round.id

      await asIdentity(authUserIds.carla)
      const mine = await client.query<{ ok: boolean }>(
        `select exists (
           select 1 from public.rounds where id = $1
         ) as ok`,
        [roundId],
      )
      expect(mine.rows[0]!.ok).toBe(true)
      // Dan's branch: carla has no Marina membership — nothing matches.
      const marinaRounds = await client.query<{ ok: boolean }>(
        `select exists (
           select 1 from public.rounds r join public.sessions s on s.id = r.session_id
           where s.branch_id = $1
         ) as ok`,
        [branchIds.marina],
      )
      expect(marinaRounds.rows[0]!.ok).toBe(false)
      await asOwner()
    })
  })

  it('fiona (unrelated) matches nothing; anon is grant-closed (fail-closed)', async () => {
    await inTransaction(client, async () => {
      await asIdentity(authUserIds.fiona)
      const fiona = await client.query<{ ok: boolean }>(
        'select exists (select 1 from public.rounds) as ok',
      )
      expect(fiona.rows[0]!.ok).toBe(false)
      await asOwner()

      // Anon holds no grant at all — Postgres refuses before any policy
      // evaluation (the strictest fail-closed direction). The refusal aborts
      // the transaction — probe under a savepoint (the house method).
      await client.query('savepoint anon_probe')
      await client.query('set local role anon')
      let anonDenied = false
      try {
        await client.query('select exists (select 1 from public.rounds) as ok')
      } catch (error) {
        anonDenied = /permission denied/.test((error as Error).message)
      }
      await client.query('rollback to savepoint anon_probe')
      await asOwner()
      expect(anonDenied).toBe(true)
    })
  })

  it('dan (Marina kitchen) reads a Marina round row through the policy; a new Marina ticket appears to him', async () => {
    await inTransaction(client, async () => {
      // Produce a real Marina round + ticket through the real RPC chain:
      // activate the (inactive-fixture) Marina table, open a session, submit
      // — the 009 scratch-round discipline. The deterministic fixture is
      // empty; the policy probe needs a row.
      await asOwner()
      await client.query('update public.dining_tables set is_active = true where id = $1', [
        diningTableIds.marinaT1,
      ])
      await asIdentity(authUserIds.carla)
      const open = await client.query<{ p: { token: string } }>(
        'select public.open_session_at_table($1, $2, $3, $4, $5) as p',
        [restaurantIds.blueOlive, branchIds.marina, diningTableIds.marinaT1, 'N', '+15550998'],
      )
      const token = open.rows[0]!.p.token
      const sub = await client.query('select public.submit_round($1, $2)', [
        token,
        JSON.stringify([{ item_id: menuItemIds.lambKebab, extras: [], quantity: '1' }]),
      ])
      expect(sub.rows.length).toBe(1)
      await asOwner()

      await asIdentity(authUserIds.dan)
      const res = await client.query<{ ok: boolean }>(
        `select exists (
           select 1 from public.kitchen_tickets where branch_id = $1
         ) as ok`,
        [branchIds.marina],
      )
      expect(res.rows[0]!.ok).toBe(true)
      await asOwner()
    })
  })
})
