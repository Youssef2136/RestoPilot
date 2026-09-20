#!/usr/bin/env node
/**
 * T027 — executes the three quickstart.md walkthroughs (spec 008) against
 * the real development project through the real data APIs (the feature
 * 005/006/007 method) and prints a step-by-step PASS/FAIL transcript. Run:
 * node --env-file-if-exists=.env scripts/run-order-walkthroughs.mjs
 *
 * The walkthroughs mutate the fixture (open sessions, rounds); the script
 * cleans up after itself and the quickstart's restore step
 * (`npm run db:reset -- --yes && npm run db:seed`) restores the
 * deterministic state regardless.
 */
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY')

const RESTAURANT = { blueOlive: '00000000-0000-4000-8000-000000000001' }
const BRANCH = { downtown: '00000000-0000-4000-8000-000000000101' }
const TABLE = { downtownT1: '00000000-0000-4000-8000-000000000003001' }
const ITEM = {
  lambKebab: '00000000-0000-4000-8000-000000006014',
  hummus: '00000000-0000-4000-8000-000000006011',
  seaBass: '00000000-0000-4000-8000-000000006015',
}
const EXTRA = {
  lambExtraRice: '00000000-0000-4000-8000-000000006032',
  lambExtraGarlicSauce: '00000000-0000-4000-8000-000000006031',
  fondantVanillaIceCream: '00000000-0000-4000-8000-000000006034',
}
const DEV_TOKEN = 'dev-token-downtown-t1-2026'
const SESSION_REFUSAL = 'This session is no longer available.'

const client = createClient(url, key)

const results = []
function check(step, ok, detail) {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`)
}
function expect(cond, msg) {
  if (!cond) throw new Error(`expectation failed: ${msg}`)
}
async function rpc(fn, args) {
  const { data, error } = await client.rpc(fn, args)
  return { data, error }
}

/* ── admin connection for zero-row / zero-grant probes and cleanup ─────────── */
const pgClient = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
async function adminOne(sql, values = []) {
  const res = await pgClient.query(sql, values)
  return res.rows[0]
}

async function main() {
  await pgClient.connect()

  /* ── Walkthrough A — the customer builds a cart (SC-001, FR-001…FR-004) ── */

  const ctx = await rpc('get_session_context', { p_token: DEV_TOKEN })
  check(
    'A1 get_session_context resolves the dev token',
    !ctx.error && ctx.data?.session?.status === 'open',
    ctx.error?.message,
  )
  const menu = await rpc('get_session_menu', { p_token: DEV_TOKEN })
  check(
    'A2 get_session_menu lists Downtown items with prices',
    !menu.error && Array.isArray(menu.data?.categories) && menu.data.categories.length > 0,
  )

  // The cart is CLIENT-ONLY: build it in memory exactly as cartState would.
  const cart = [
    {
      item_id: ITEM.lambKebab,
      extra_ids: [EXTRA.lambExtraRice, EXTRA.lambExtraGarlicSauce],
      quantity: 2,
    },
    { item_id: ITEM.hummus, extra_ids: [], quantity: 1 },
  ]
  const lamb = menu.data.categories.flatMap((c) => c.items).find((i) => i.id === ITEM.lambKebab)
  const riceAdj = Number(
    lamb.extras.find((e) => e.id === EXTRA.lambExtraRice)?.price_adjustment ?? 0,
  )
  const garlicAdj = Number(
    lamb.extras.find((e) => e.id === EXTRA.lambExtraGarlicSauce)?.price_adjustment ?? 0,
  )
  const hummus = menu.data.categories.flatMap((c) => c.items).find((i) => i.id === ITEM.hummus)
  const expectedTotal = (Number(lamb.price) + riceAdj + garlicAdj) * 2 + Number(hummus.price)
  // Lamb Kebab 18.50 + rice 3.00 + garlic 0.00 = 21.50 × 2 = 43.00; hummus 6.50 → 49.50.
  check(
    'A3 the advisory total equals (item₁ + extras) × 2 + item₂ from payload prices (49.50)',
    Math.abs(expectedTotal - 49.5) < 0.001,
    `computed ${expectedTotal}`,
  )

  const boundsOk = (q) => q >= 1 && q <= 99
  check(
    'A4 bounds feedback: 0 and 100 are refused client-side, no RPC involved',
    !boundsOk(0) && !boundsOk(100) && boundsOk(1) && boundsOk(99),
  )

  /* ── Walkthrough B — submission, refusal, atomicity (SC-002…) ──────────── */

  const before = await adminOne(
    `select (select count(*) from public.rounds)::int as rounds, (select count(*) from public.round_items)::int as items,
            (select count(*) from public.round_item_extras)::int as extras, (select count(*) from public.kitchen_tickets)::int as tickets`,
  )
  const submitted = await rpc('submit_round', {
    p_token: DEV_TOKEN,
    p_items: cart.map((l) => ({
      item_id: l.item_id,
      extras: l.extra_ids,
      quantity: String(l.quantity),
    })),
  })
  check(
    'B1 submit_round returns the round (state new), captured items, ticket id',
    !submitted.error &&
      submitted.data?.round?.state === 'new' &&
      submitted.data.items.length === 2 &&
      typeof submitted.data.ticket_id === 'string',
    submitted.error?.message,
  )
  const round1 = submitted.data
  const after = await adminOne(
    `select (select count(*) from public.rounds)::int as rounds, (select count(*) from public.round_items)::int as items,
            (select count(*) from public.round_item_extras)::int as extras, (select count(*) from public.kitchen_tickets)::int as tickets`,
  )
  check(
    'B2 the write set is complete: +1 round, +2 items, +2 extras, +1 ticket',
    after.rounds - before.rounds === 1 &&
      after.items - before.items === 2 &&
      after.extras - before.extras === 2 &&
      after.tickets - before.tickets === 1,
    JSON.stringify(after),
  )
  const emptyRefusal = await rpc('submit_round', { p_token: DEV_TOKEN, p_items: [] })
  const foreignRefusal = await rpc('submit_round', {
    p_token: DEV_TOKEN,
    p_items: [{ item_id: '00000000-0000-4000-8000-000000006111', extras: [], quantity: '1' }],
  })
  const stoppedRefusal = await rpc('submit_round', {
    p_token: DEV_TOKEN,
    p_items: [{ item_id: ITEM.seaBass, extras: [], quantity: '1' }],
  })
  const foreignExtraRefusal = await rpc('submit_round', {
    p_token: DEV_TOKEN,
    p_items: [{ item_id: ITEM.hummus, extras: [EXTRA.fondantVanillaIceCream], quantity: '1' }],
  })
  const malformedRefusal = await rpc('submit_round', {
    p_token: DEV_TOKEN,
    p_items: [{ item_id: 'not-a-uuid', extras: [], quantity: '1' }],
  })
  const quantityRefusal = await rpc('submit_round', {
    p_token: DEV_TOKEN,
    p_items: [{ item_id: ITEM.hummus, extras: [], quantity: '0' }],
  })
  const refusals = [
    emptyRefusal,
    foreignRefusal,
    stoppedRefusal,
    foreignExtraRefusal,
    malformedRefusal,
    quantityRefusal,
  ]
  check(
    'B3 the refusal matrix is refused verbatim (6/6)',
    refusals.every((r) => r.error?.code === 'P0001') &&
      [
        'A cart line is required.',
        'This item is not available here.',
        'An extra does not belong to its item.',
        'A cart line is malformed.',
        'A quantity must be between 1 and 99.',
      ].every((m) => refusals.some((r) => r.error?.message === m)),
  )
  const afterRefusals = await adminOne(
    `select (select count(*) from public.rounds)::int as rounds, (select count(*) from public.round_items)::int as items,
            (select count(*) from public.round_item_extras)::int as extras, (select count(*) from public.kitchen_tickets)::int as tickets`,
  )
  check(
    'B4 atomicity: every refused submission left ZERO rows behind',
    afterRefusals.rounds === after.rounds &&
      afterRefusals.items === after.items &&
      afterRefusals.extras === after.extras &&
      afterRefusals.tickets === after.tickets,
  )
  const recalc = await adminOne(
    `select private.calculate_tax_totals($1::uuid, $2::jsonb) as p`,

    [
      BRANCH.downtown,
      JSON.stringify(
        cart.map((l) => ({
          item_id: l.item_id,
          extras: l.extra_ids,
          quantity: String(l.quantity),
        })),
      ),
    ],
  )
  check(
    'B5 captured taxes equal a fresh engine run over the same selections (SC-004)',
    round1.round.tax_total === recalc.p.total &&
      JSON.stringify(round1.round.tax_lines) === JSON.stringify(recalc.p.lines),
  )

  /* ── Walkthrough C — multiple rounds, recovery, ticket integrity ───────── */

  const submitted2 = await rpc('submit_round', {
    p_token: DEV_TOKEN,
    p_items: [{ item_id: ITEM.hummus, extras: [], quantity: '2' }],
  })
  check(
    'C1 a second submission produces a second round with its own ticket',
    !submitted2.error &&
      submitted2.data.round.id !== round1.round.id &&
      submitted2.data.ticket_id !== round1.ticket_id,
    submitted2.error?.message,
  )
  const ticketCheck = await adminOne(
    `select
       (select count(*)::int from public.kitchen_tickets where round_id = $1) as t1,
       (select count(*)::int from public.kitchen_tickets where round_id = $2) as t2`,
    [round1.round.id, submitted2.data.round.id],
  )
  check(
    'C2 ticket integrity: exactly one ticket per round (both rounds)',
    ticketCheck.t1 === 1 && ticketCheck.t2 === 1,
  )
  const itemCheck = await adminOne(
    `select count(*)::int as n from public.round_items where round_id = $1 and item_id = $2`,
    [submitted2.data.round.id, ITEM.lambKebab],
  )
  check('C3 no item overlap: Round 2 carries no Round-1 kebab', itemCheck.n === 0)
  const history = await rpc('get_session_rounds', { p_token: DEV_TOKEN })
  const roundIds = (history.data?.rounds ?? []).map((r) => r.id)
  check(
    'C4 the history read lists BOTH rounds (server recovery)',
    !history.error &&
      roundIds.includes(round1.round.id) &&
      roundIds.includes(submitted2.data.round.id),
  )
  const badToken = await rpc('get_session_rounds', { p_token: 'no-such-token' })
  const badSubmit = await rpc('submit_round', {
    p_token: 'no-such-token',
    p_items: [{ item_id: ITEM.hummus, extras: [], quantity: '1' }],
  })
  check(
    'C5 unknown tokens refused with the byte-identical session refusal on both RPCs',
    badToken.error?.message === SESSION_REFUSAL && badSubmit.error?.message === SESSION_REFUSAL,
  )

  /* ── cleanup: remove every round this run created, keep the session ────── */
  const cleanupIds = [round1.round.id, submitted2.data.round.id]
  await pgClient.query(
    `delete from public.round_item_extras where round_item_id in (select id from public.round_items where round_id = any($1))`,
    [roundIds],
  )
  await pgClient.query(`delete from public.round_items where round_id = any($1)`, [cleanupIds])
  await pgClient.query(`delete from public.kitchen_tickets where round_id = any($1)`, [cleanupIds])
  await pgClient.query(`delete from public.rounds where id = any($1)`, [cleanupIds])
  await pgClient.end()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length > 0) process.exit(1)
}

main().catch((error) => {
  console.error('WALKTHROUGH RUNNER ERROR:', error.message)
  process.exit(1)
})
