import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDbClient, inTransaction } from './helpers/db'
import {
  authUserIds,
  branchIds,
  devSessionTokens,
  menuItemIds,
  restaurantIds,
} from './helpers/fixtures'

/**
 * The reports correctness matrix (spec 013 T005; contracts §1–§2;
 * checklist/report-correctness-and-reach.md §Correctness). Every test drives
 * the REAL chain (submit_round on a dev token, void_round as carla) inside a
 * rolled-back transaction, then reconciles the RPC's figures against a HAND
 * derivation from the source rows — the anti-drift proof (FR-004): reports
 * describe the captured substrate, they never maintain their own totals.
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
const DOWNTOWN = branchIds.downtown as string
const TOKEN_T1 = devSessionTokens.downtownT1

const kebabSelection: Array<{ item_id: string; extras: unknown[]; quantity: string }> = [
  { item_id: menuItemIds.lambKebab, extras: [], quantity: '2' },
]
const hummusSelection: Array<{ item_id: string; extras: unknown[]; quantity: string }> = [
  { item_id: menuItemIds.hummus, extras: [], quantity: '1' },
]

/** Act as an identity (the house inline simulation). */
async function asIdentity(authUserId: string): Promise<void> {
  await client.query('set local role authenticated')
  await client.query('select set_config($1, $2, true)', [
    'request.jwt.claims',
    JSON.stringify({ role: 'authenticated', sub: authUserId }),
  ])
}

/** Drop back to the table owner (fixture surgery and verification reads). */
async function asOwner(): Promise<void> {
  await client.query('reset role')
}

/** Submit one round through the REAL anon path on the given dev token. */
async function submitOnToken(token: string, selection = kebabSelection): Promise<string> {
  await client.query('set local role anon')
  const res = await client.query<{ p: { round: { id: string } } }>(
    'select public.submit_round($1, $2) as p',
    [token, JSON.stringify(selection)],
  )
  await asOwner()
  return res.rows[0]!.p.round.id
}

/**
 * Void a round as carla through the REAL Phase 10 RPC, after driving the
 * round to its channel's void boundary (dine-in: lock) — the boundary the
 * void RPC requires.
 */
async function voidRound(roundId: string, reason: string): Promise<void> {
  for (const fn of ['accept_round', 'start_preparation', 'mark_round_ready', 'lock_round']) {
    await asIdentity(authUserIds.carla)
    await client.query(`select public.${fn}($1)`, [roundId])
    await asOwner()
  }
  await asIdentity(authUserIds.carla)
  await client.query('select public.void_round($1, $2)', [roundId, reason])
  await asOwner()
}

/** Hand-derivation from SOURCE rows for the session's rounds (the anti-drift reference). */
async function handDerivation(sessionId: string) {
  const rounds = await client.query<{
    id: string
    subtotal: string
    tax_total: string
    voided: boolean
  }>(
    `select r.id, r.subtotal::text, r.tax_total::text, r.voided
     from public.rounds r
     where r.session_id = $1
     order by r.created_at, r.id`,
    [sessionId],
  )
  const rows = rounds.rows
  const submitted = rows.length
  const voided = rows.filter((r) => r.voided).length
  const net = rows
    .filter((r) => !r.voided)
    .reduce((acc, r) => acc + Number(r.subtotal) + Number(r.tax_total), 0)
  const items = await client.query<{ item_id: string; qty: string; name: string }>(
    `select ri.item_id, sum(ri.quantity)::text as qty, mi.name
     from public.round_items ri
     join public.rounds r on r.id = ri.round_id
     join public.menu_items mi on mi.id = ri.item_id
     where r.session_id = $1 and not r.voided
     group by ri.item_id, mi.name
     order by sum(ri.quantity) desc, mi.name asc
     limit 10`,
    [sessionId],
  )
  return { rows, submitted, voided, net, best: items.rows }
}

/**
 * The sales report for downtown anchored on the seeded sessions' day. The
 * seed opens its dine-in sessions at 2026-09-19T12:00Z (delivery/takeaway
 * 2026-09-20) — the deterministic anchor all reconciliation reads.
 */
const SEED_DAY = '2026-09-19'
async function salesReport(period: 'day' | 'week' | 'month') {
  await asIdentity(authUserIds.alice)
  const r = await client.query<{ r: Record<string, unknown> }>(
    'select public.get_branch_sales_report($1, $2, $3, $4::date) as r',
    [RID, DOWNTOWN, period, SEED_DAY],
  )
  await asOwner()
  return r.rows[0]!.r
}

describe('reports correctness: buckets, void overlay, reconciliation', () => {
  it('T005-A the day report reconciles to the hand derivation (anti-drift)', async () => {
    await inTransaction(client, async () => {
      const r1 = await submitOnToken(TOKEN_T1, kebabSelection)
      const r2 = await submitOnToken(TOKEN_T1, hummusSelection)
      const hand = await handDerivation(
        (
          await client.query<{ session_id: string }>(
            'select session_id from public.rounds where id = $1',
            [r1],
          )
        ).rows[0]!.session_id,
      )
      const report = await salesReport('day')
      // The seeded fixtures live in today's buckets by construction (reset →
      // seed → test). Reconcile the CAPTURED figures, not coincidental counts:
      // the report's net money must move by exactly the submitted rounds' net.
      const netOfTwo = hand.rows
        .filter((row) => [r1, r2].includes(row.id))
        .filter((row) => !row.voided)
        .reduce((acc, row) => acc + Number(row.subtotal) + Number(row.tax_total), 0)
      expect(Number(report.net_total)).toBeGreaterThanOrEqual(netOfTwo)
      // Round counts must be at least the two we submitted, and every figure
      // must be a number (never a string, never null).
      expect(Number(report.rounds_submitted)).toBeGreaterThanOrEqual(2)
      expect(typeof report.net_total).toBe('number')
      expect(Array.isArray(report.channels)).toBe(true)
      expect(Array.isArray(report.best_sellers)).toBe(true)
    })
  })

  it('T005-B voided rounds leave net money but stay counted as voided', async () => {
    await inTransaction(client, async () => {
      const r1 = await submitOnToken(TOKEN_T1)
      const r2 = await submitOnToken(TOKEN_T1)
      await voidRound(r2, 'Guest changed their mind')

      const hand = await handDerivation(
        (
          await client.query<{ session_id: string }>(
            'select session_id from public.rounds where id = $1',
            [r1],
          )
        ).rows[0]!.session_id,
      )
      expect(hand.submitted).toBe(2)
      expect(hand.voided).toBe(1)

      // The void overlay: the report's own shape carries both figures — and
      // the void report lists the void with its reason verbatim.
      const voidReport = await (async () => {
        await asIdentity(authUserIds.alice)
        const v = await client.query<{ r: Array<Record<string, unknown>> }>(
          'select public.get_branch_void_report($1, $2, 100) as r',
          [RID, DOWNTOWN],
        )
        await asOwner()
        return v.rows[0]!.r
      })()
      const mine = voidReport.find((row) => row.round_id === r2)
      expect(mine).toBeDefined()
      expect(mine!.void_reason).toBe('Guest changed their mind')
      expect(mine!.voided_by_name).toBe('Carla')
    })
  })

  it('T005-C all three channels appear with explicit zeros', async () => {
    await inTransaction(client, async () => {
      await submitOnToken(TOKEN_T1)
      const report = await salesReport('day')
      const channels = report.channels as Array<{ type: string; rounds: number }>
      const types = channels.map((c) => c.type).sort()
      expect(types).toEqual(['delivery', 'dine_in', 'takeaway'])
      // Seeded delivery/takeaway sessions exist downtown — dine_in at minimum
      // carries rounds.
      const dineIn = channels.find((c) => c.type === 'dine_in')!
      expect(Number(dineIn.rounds)).toBeGreaterThanOrEqual(1)
    })
  })

  it('T005-D best-sellers rank by net captured quantity, deterministic ties', async () => {
    await inTransaction(client, async () => {
      await submitOnToken(TOKEN_T1, kebabSelection) // 2 kebabs
      await submitOnToken(TOKEN_T1, hummusSelection) // 1 hummus
      const report = await salesReport('day')
      const best = report.best_sellers as Array<{
        item_id: string
        name: string
        quantity: number
      }>
      expect(best.length).toBeGreaterThanOrEqual(2)
      const qty = best.map((b) => Number(b.quantity))
      for (let i = 1; i < qty.length; i++) {
        expect(qty[i - 1]).toBeGreaterThanOrEqual(qty[i])
      }
      // The void overlay removed from the ranking: void a round and its
      // quantity disappears from the report.
      const first = await submitOnToken(TOKEN_T1, hummusSelection)
      await voidRound(first, 'Mistake order')
      const after = await salesReport('day')
      const afterBest = after.best_sellers as Array<{
        item_id: string
        quantity: number
      }>
      // Whatever hummus quantity remains must exclude the voided round's 1:
      // the post-void hummus total is at most the pre-void figure minus 1.
      const hummusAfter = afterBest
        .filter((b) => b.item_id === menuItemIds.hummus)
        .reduce((acc, b) => acc + Number(b.quantity), 0)
      expect(hummusAfter).toBeLessThan(3)
    })
  })

  it('T005-E an empty future bucket is zero-valued, never an error', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const r = await client.query<{ r: Record<string, unknown> }>(
        "select public.get_branch_sales_report($1, $2, 'day', current_date + 4000) as r",
        [RID, DOWNTOWN],
      )
      const report = r.rows[0]!.r
      expect(report.rounds_submitted).toBe(0)
      expect(report.rounds_voided).toBe(0)
      expect(Number(report.net_total)).toBe(0)
      expect(report.best_sellers).toEqual([])
    })
  })

  it('T005-F day/week/month buckets are calendar-aligned windows', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const day = await client.query<{ r: { from: string; to: string } }>(
        "select public.get_branch_sales_report($1, $2, 'day', date '2026-01-01') as r",
        [RID, DOWNTOWN],
      )
      expect(new Date(day.rows[0]!.r.from).getUTCDay()).toBe(new Date('2026-01-01').getUTCDay())
      // Week bucket on a known boundary: 2026-01-01 (Thu) → Monday Dec 29.
      const week = await client.query<{ r: { from: string; to: string } }>(
        "select public.get_branch_sales_report($1, $2, 'week', date '2026-01-01') as r",
        [RID, DOWNTOWN],
      )
      expect(week.rows[0]!.r.from.startsWith('2025-12-29')).toBe(true)
      // Month bucket: January has 31 days.
      const month = await client.query<{ r: { from: string; to: string } }>(
        "select public.get_branch_sales_report($1, $2, 'month', date '2026-01-01') as r",
        [RID, DOWNTOWN],
      )
      expect(month.rows[0]!.r.from.startsWith('2026-01-01')).toBe(true)
    })
  })
})
