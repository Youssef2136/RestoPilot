import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asUser, createDbClient, expectStatementToFail, inTransaction } from './helpers/db'
import { authUserIds, branchIds, restaurantIds } from './helpers/fixtures'

/**
 * The reports reach matrix (spec 013 T004; contracts/database-functions.md
 * §3; plan.md D5). The 009/011 identity posture: staff refusals are
 * indistinguishable (42501), anon refused before identity exists, and reach
 * resolves through private.has_branch_role verbatim — owner any branch of
 * the restaurant, manager their branch only, cashier/kitchen never.
 *
 * Every assertion runs inside a rolled-back transaction; failures probe via
 * savepoints so one aborted statement never poisons the block.
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
const B1 = branchIds.downtown as string
const B2 = branchIds.marina as string

describe('reports reach', () => {
  it('T004-A owner reaches any branch of their restaurant', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const r1 = await client.query(
        "select get_branch_sales_report($1, $2, 'day', current_date) as r",
        [RID, B1],
      )
      const r2 = await client.query(
        "select get_branch_sales_report($1, $2, 'day', current_date) as r",
        [RID, B2],
      )
      expect(r1.rows[0].r.branch_id).toBe(B1)
      expect(r2.rows[0].r.branch_id).toBe(B2)
    })
  })

  it('T004-B branch manager reaches their own branch', async () => {
    await asUser(client, authUserIds.bob, async () => {
      const r = await client.query(
        "select get_branch_sales_report($1, $2, 'week', current_date) as r",
        [RID, B1],
      )
      expect(r.rows[0].r.branch_id).toBe(B1)
    })
  })

  it('T004-C branch manager refused on a foreign branch — 42501', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.bob }),
      ])
      await expectStatementToFail(
        client,
        '42501',
        "select get_branch_sales_report($1, $2, 'day', current_date)",
        [RID, B2],
      )
    })
  })

  it('T004-D cashier and kitchen refused — 42501, same as any denial', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.carla }),
      ])
      await expectStatementToFail(
        client,
        '42501',
        "select get_branch_sales_report($1, $2, 'day', current_date)",
        [RID, B1],
      )
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.dan }),
      ])
      await expectStatementToFail(client, '42501', 'select get_branch_void_report($1, $2, 100)', [
        RID,
        B1,
      ])
    })
  })

  it('T004-E anon refused — no existence leaks', async () => {
    await asAnon(client, async () => {
      await expectStatementToFail(
        client,
        '42501',
        'select exists (select 1 from public.get_branch_sales_report($1, $2, $3, current_date)) as ok',
        [RID, B1, 'day'],
      )
    })
  })

  it('T004-F bad period refused — validation shape, not a leak', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.alice }),
      ])
      await expectStatementToFail(
        client,
        'P0001',
        "select get_branch_sales_report($1, $2, 'quarter', current_date)",
        [RID, B1],
      )
    })
  })

  it('T004-G void report: owner OK, manager foreign refused', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const r = await client.query('select get_branch_void_report($1, $2, 50) as r', [RID, B1])
      expect(Array.isArray(r.rows[0].r)).toBe(true)
    })
    await inTransaction(client, async () => {
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.bob }),
      ])
      await expectStatementToFail(client, '42501', 'select get_branch_void_report($1, $2, 50)', [
        RID,
        B2,
      ])
    })
  })
})
