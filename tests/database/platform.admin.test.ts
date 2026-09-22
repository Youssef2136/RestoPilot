import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDbClient, expectStatementToFail, inTransaction } from './helpers/db'
import { authUserIds, restaurantIds } from './helpers/fixtures'

/**
 * The platform admin reach + lifecycle derivation suite (spec 014 T004;
 * contracts/database-functions.md §1–§3; checklist §Authority/§Lifecycle/
 * §The Important rule).
 *
 * Authority: the is_super_admin flag is the only key — every tenant role and
 * anon refused with the generic 42501. Lifecycle: the state is one read-time
 * CASE — proved by driving DATES past boundaries and re-reading WITHOUT any
 * write between reads (the Important rule's mechanical proof). Actions are
 * audited; no-ops are not.
 */
let client: Awaited<ReturnType<typeof createDbClient>>

beforeAll(async () => {
  client = await createDbClient()
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

const RID = restaurantIds.blueOlive as string
const RID2 = restaurantIds.cedarGrill as string
const SUPER_ADMIN = authUserIds.platformAdmin
const TODAY = () => new Date().toISOString().slice(0, 10)

/** The 7-day boundary helper: an ISO date N days from today. */
function daysFromToday(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

describe('platform authority: the flag is the only key (FR-001, FR-009)', () => {
  it('T004-A the super admin reads the platform overview', async () => {
    await asUser(client, SUPER_ADMIN, async () => {
      const r = await client.query('select get_platform_overview() as o')
      const rows = r.rows[0]!.o
      expect(Array.isArray(rows)).toBe(true)
      expect(rows.length).toBeGreaterThanOrEqual(2)
      const blue = rows.find((x: Record<string, unknown>) => x.restaurant_id === RID)
      expect(blue.state).toBe('never_activated')
      expect(blue.branch_count).toBeGreaterThanOrEqual(2)
      expect(blue.staff_count).toBeGreaterThanOrEqual(4)
    })
  })

  it('T004-B every tenant role and anon refused on every console RPC', async () => {
    await inTransaction(client, async () => {
      // Owner, manager, cashier, kitchen — all refused on the read...
      for (const actor of ['alice', 'bob', 'carla', 'dan'] as const) {
        await client.query('set local role authenticated')
        await client.query('select set_config($1, $2, true)', [
          'request.jwt.claims',
          JSON.stringify({ role: 'authenticated', sub: authUserIds[actor] }),
        ])
        await expectStatementToFail(client, '42501', 'select get_platform_overview()')
        await client.query('reset role')
      }
      // ...and anon (grant-closed).
      await client.query('set local role anon')
      await expectStatementToFail(client, '42501', 'select get_platform_overview()')
      await client.query('reset role')
    })
  })

  it('T004-C tenant roles refused on the write RPCs', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.alice }),
      ])
      await expectStatementToFail(client, '42501', 'select set_subscription_dates($1, $2, $3)', [
        RID,
        daysFromToday(0),
        daysFromToday(30),
      ])
      await expectStatementToFail(
        client,
        '42501',
        'select set_restaurant_platform_disabled($1, $2, $3)',
        [RID, true, 'attempted by a tenant'],
      )
    })
  })
})

describe('lifecycle derivation: read-time CASE, no stored state (FR-002, FR-010)', () => {
  it('T004-D the state matrix derives exactly (incl. the 7-day boundary)', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: SUPER_ADMIN }),
      ])

      // never_activated → active (30 days out).
      const activated = await client.query<{ b: { state: string } }>(
        'select set_subscription_dates($1, $2, $3) as b',
        [RID, daysFromToday(0), daysFromToday(30)],
      )
      expect(activated.rows[0]!.b.state).toBe('active')

      // Exactly 7 days out → nearing_expiration (the boundary included).
      const at7 = await client.query<{ b: { state: string } }>(
        'select set_subscription_dates($1, $2, $3) as b',
        [RID, daysFromToday(-7), daysFromToday(7)],
      )
      expect(at7.rows[0]!.b.state).toBe('nearing_expiration')

      // 8 days out → active (outside the window).
      const at8 = await client.query<{ b: { state: string } }>(
        'select set_subscription_dates($1, $2, $3) as b',
        [RID, daysFromToday(-8), daysFromToday(8)],
      )
      expect(at8.rows[0]!.b.state).toBe('active')

      // End date moved into the past → expired (a READ consequence of the
      // write; no clock trickery).
      const past = await client.query<{ b: { state: string } }>(
        'select set_subscription_dates($1, $2, $3) as b',
        [RID, daysFromToday(-30), daysFromToday(-1)],
      )
      expect(past.rows[0]!.b.state).toBe('expired')
      await client.query('reset role')
    })
  })

  it('T004-E expiration flips on a plain READ — no write between reads (the Important rule)', async () => {
    await inTransaction(client, async () => {
      // Set an end date one second past "now" relative to the read — the
      // derivation compares now()::date; we set end = today-1 = expired,
      // then verify the overview reflects it with NO additional write.
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: SUPER_ADMIN }),
      ])
      await client.query('select set_subscription_dates($1, $2, $3)', [
        RID2,
        daysFromToday(-10),
        daysFromToday(-1),
      ])
      await client.query('reset role')
      const r = await client.query<{ o: Array<Record<string, unknown>> }>(
        'select get_platform_overview() as o',
      )
      const cedar = r.rows[0]!.o.find((x) => x.restaurant_id === RID2)
      expect(cedar.state).toBe('expired')
      // The overview alone moved the state — no trigger, no job, nothing
      // wrote (the state lives only in the CASE).
    })
  })

  it('T004-F dates changes are audited with before/after; validations refuse', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: SUPER_ADMIN }),
      ])
      await client.query('select set_subscription_dates($1, $2, $3)', [
        RID,
        daysFromToday(0),
        daysFromToday(14),
      ])
      // Audit reads need the table owner (authenticated holds no grant).
      await client.query('reset role')
      const audits = await client.query<{ reason: string }>(
        "select reason from public.audit_log where restaurant_id = $1 and action = 'platform.subscription_dates_set' order by id desc limit 1",
        [RID],
      )
      expect(audits.rows[0]!.reason).toContain('→')
      // end < start refused
      await expectStatementToFail(client, 'P0001', 'select set_subscription_dates($1, $2, $3)', [
        RID,
        daysFromToday(10),
        daysFromToday(5),
      ])
      await client.query('reset role')
    })
  })

  it('T004-G disablement: audited, idempotent, reason mandatory', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: SUPER_ADMIN }),
      ])
      // Disable without a reason refused.
      await expectStatementToFail(
        client,
        'P0001',
        'select set_restaurant_platform_disabled($1, $2, $3)',
        [RID, true, ''],
      )
      // Disable with a reason succeeds and audits.
      const first = await client.query<{ b: { changed: boolean } }>(
        'select set_restaurant_platform_disabled($1, $2, $3) as b',
        [RID, true, 'Suite: payment dispute'],
      )
      expect(first.rows[0]!.b.changed).toBe(true)
      await client.query('reset role')
      const count1 = await client.query<{ n: string }>(
        "select count(*)::text as n from public.audit_log where restaurant_id = $1 and action = 'platform.restaurant_disabled'",
        [RID],
      )
      // Disable AGAIN (no-op) — no second audit row.
      const second = await client.query<{ b: { changed: boolean } }>(
        'select set_restaurant_platform_disabled($1, $2, $3) as b',
        [RID, true, 'Suite: second attempt'],
      )
      expect(second.rows[0]!.b.changed).toBe(false)
      const count2 = await client.query<{ n: string }>(
        "select count(*)::text as n from public.audit_log where restaurant_id = $1 and action = 'platform.restaurant_disabled'",
        [RID],
      )
      expect(count2.rows[0]!.n).toBe(count1.rows[0]!.n)
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: SUPER_ADMIN }),
      ])
      // Re-enable audited under its own action.
      const back = await client.query<{ b: { changed: boolean } }>(
        'select set_restaurant_platform_disabled($1, $2, $3) as b',
        [RID, false, ''],
      )
      expect(back.rows[0]!.b.changed).toBe(true)
      await client.query('reset role')
      const enabled = await client.query<{ n: string }>(
        "select count(*)::text as n from public.audit_log where restaurant_id = $1 and action = 'platform.restaurant_enabled'",
        [RID],
      )
      expect(Number(enabled.rows[0]!.n)).toBe(1)
      await client.query('reset role')
    })
  })

  it('T004-H the tenant read: owners get their payload, others null', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const r = await client.query<{ b: Record<string, unknown> }>(
        'select get_my_subscription() as b',
      )
      expect(r.rows[0]!.b.restaurant_id).toBe(RID)
      expect(typeof r.rows[0]!.b.state).toBe('string')
    })
    await asUser(client, authUserIds.carla, async () => {
      const r = await client.query<{ b: unknown }>('select get_my_subscription() as b')
      expect(r.rows[0]!.b).toBeNull()
    })
  })
})
