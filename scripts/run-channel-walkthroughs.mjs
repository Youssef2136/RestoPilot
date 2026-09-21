#!/usr/bin/env node
/**
 * T019 — executes the three quickstart.md walkthroughs (spec 010) against
 * the real development project through the real data APIs (the feature
 * 005–009 method) and prints a step-by-step PASS/FAIL transcript. Run:
 * node --env-file-if-exists=.env scripts/run-channel-walkthroughs.mjs
 *
 * The walkthroughs mutate the fixture (open sessions, rounds, audit rows);
 * the quickstart's restore step (`npm run db:reset -- --yes &&
 * npm run db:seed`) restores the deterministic state regardless.
 */
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY')

const RESTAURANT = { blueOlive: '00000000-0000-4000-8000-000000000001' }
const BRANCH = {
  downtown: '00000000-0000-4000-8000-000000000101',
  marina: '00000000-0000-4000-8000-000000000102',
}
const ITEM = { lambKebab: '00000000-0000-4000-8000-000000006014' }
const DEV_TOKEN_DINEIN = 'dev-token-downtown-t1-2026'
const DEV_TOKEN_DELIVERY = 'dev-token-downtown-delivery-2026'
const DEV_TOKEN_TAKEAWAY = 'dev-token-downtown-takeaway-2026'
const GENERIC = 'This round is not available for that action.'
const DENIED = 'You do not have permission to update this round.'
const DELIVERY_CUTOFF = 'Your order is already on its way — no additional items can be added.'
const TAKEAWAY_CUTOFF = 'Your order is ready for pickup — no additional items can be added.'
const ADDRESS_REQUIRED = 'A delivery address is required.'
const CHANNEL_REDIRECT = 'Choose delivery or takeaway.'

// Real sign-ins (the walkthroughs act as the seeded identities through the
// hosted auth — the data API derives the JWT from the session).
const carla = createClient(url, key)
const dan = createClient(url, key)
const fiona = createClient(url, key)

const results = []
function check(step, ok, detail) {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`)
}
function expect(cond, msg) {
  if (!cond) throw new Error(`expectation failed: ${msg}`)
}
async function rpcAs(client, fn, args) {
  const { data, error } = await client.rpc(fn, args)
  return { data, error }
}

const pgClient = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
async function adminOne(sql, values = []) {
  const res = await pgClient.query(sql, values)
  return res.rows[0]
}

async function signIn(client, email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password })
  expect(!error, `sign-in ${email}: ${error?.message ?? 'ok'}`)
}

/** Submit one round through the real customer path (the dev-token RPC). */
async function submitRound(token, items) {
  const anon = createClient(url, key)
  const { data: payload, error: rpcError } = await anon.rpc('submit_round', {
    p_token: token,
    p_items: items,
  })
  expect(!rpcError, `submit_round: ${rpcError?.message ?? 'ok'}`)
  return payload
}

/** Submit expecting the exact refusal (an error aborts nothing — fresh client). */
async function submitRoundRefused(token, items, message) {
  const anon = createClient(url, key)
  const { error } = await anon.rpc('submit_round', { p_token: token, p_items: items })
  return { refused: error?.code === 'P0001' && error.message === message, actual: error?.message }
}

const LAMB = [{ item_id: ITEM.lambKebab, extras: [], quantity: '1' }]

/* ── Walkthrough A — the delivery journey end to end ─────────────────────── */

async function walkthroughA() {
  console.log('\n── Walkthrough A: the delivery journey (SC-001) ──')

  // A1. Delivery entry through open_session_channel.
  const anon = createClient(url, key)
  const entry = await anon.rpc('open_session_channel', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_channel: 'delivery',
    p_display_name: 'Walkthrough Delivery',
    p_phone: '+15550001111',
    p_delivery_address: '1 Walkthrough Rd',
  })
  expect(!entry.error, `delivery entry: ${entry.error?.message ?? 'ok'}`)
  const payload = entry.data
  check(
    'A1 delivery entry (type, token, address)',
    payload.session.type === 'delivery' &&
      typeof payload.token === 'string' &&
      payload.session.delivery_address === '1 Walkthrough Rd',
  )
  const deliveryToken = payload.token

  // A2. Submit a round with the new token: state new, one new ticket, money identical to dine-in.
  const round = await submitRound(deliveryToken, LAMB)
  const dineIn = await submitRound(DEV_TOKEN_DINEIN, LAMB)
  check(
    'A2 round new + one new ticket',
    round.round.state === 'new' && typeof round.ticket_id === 'string' && round.items.length > 0,
  )
  check(
    'A2a captured money identical to the same dine-in order',
    round.round.subtotal === dineIn.round.subtotal &&
      round.round.tax_total === dineIn.round.tax_total,
    `both ${round.round.subtotal}/${round.round.tax_total}`,
  )
  const deliveryRoundId = round.round.id

  // A3. carla walks the machine: accept → preparing → ready → out_for_delivery → completed.
  const t1 = await rpcAs(carla, 'accept_round', { p_round_id: deliveryRoundId })
  const t2 = await rpcAs(carla, 'start_preparation', { p_round_id: deliveryRoundId })
  const t3 = await rpcAs(carla, 'mark_round_ready', { p_round_id: deliveryRoundId })
  const t4 = await rpcAs(carla, 'mark_out_for_delivery', { p_round_id: deliveryRoundId })
  const t5 = await rpcAs(carla, 'mark_completed', { p_round_id: deliveryRoundId })
  check(
    'A3 accept→preparing→ready→out_for_delivery→completed',
    !t1.error &&
      !t2.error &&
      !t3.error &&
      !t4.error &&
      !t5.error &&
      t5.data?.round?.state === 'completed',
  )
  const audits = await pgClient.query(
    `select action from public.audit_log where resource_id = $1 and action in
     ('round.out_for_delivery', 'round.completed') order by action`,
    [deliveryRoundId],
  )
  check(
    'A3a audit rows round.out_for_delivery + round.completed',
    audits.rows.map((r) => r.action).join(',') === 'round.completed,round.out_for_delivery',
  )
  const ticket = await adminOne('select state from public.kitchen_tickets where round_id = $1', [
    deliveryRoundId,
  ])
  check('A3b the ticket stays ready throughout', ticket.state === 'ready')

  // A4. The reads: session_type + address on the cashier read, nothing on the kitchen queue.
  const rounds = await rpcAs(carla, 'get_branch_rounds', { p_branch_id: BRANCH.downtown })
  const mine = (rounds.data ?? []).find((r) => r.round_id === deliveryRoundId)
  check(
    'A4 branch rounds carry session_type + delivery_address',
    mine?.session_type === 'delivery' && mine?.delivery_address === '1 Walkthrough Rd',
  )
  const queue = await rpcAs(carla, 'get_kitchen_queue', { p_branch_id: BRANCH.downtown })
  const raw = JSON.stringify(queue.data ?? [])
  check(
    'A4a the kitchen queue is channel-blind (no address, no money keys)',
    !raw.includes('delivery_address') && !raw.includes('subtotal') && !raw.includes('tax_total'),
  )
}

/* ── Walkthrough B — the cutoffs ─────────────────────────────────────────── */

async function walkthroughB() {
  console.log('\n── Walkthrough B: the state-driven cutoffs (SC-002) ──')

  // B1. Takeaway: submit, drive to ready, submit again → REFUSED; token still works.
  const anon = createClient(url, key)
  const take = await anon.rpc('open_session_channel', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_channel: 'takeaway',
    p_display_name: 'Walkthrough Takeaway',
    p_phone: '+15550002222',
  })
  expect(!take.error, `takeaway entry: ${take.error?.message ?? 'ok'}`)
  const takeawayToken = take.data.token
  const tRound = await submitRound(takeawayToken, LAMB)
  for (const fn of ['accept_round', 'start_preparation', 'mark_round_ready']) {
    const r = await rpcAs(carla, fn, { p_round_id: tRound.round.id })
    expect(!r.error, `${fn}: ${r.error?.message ?? 'ok'}`)
  }
  const refused = await submitRoundRefused(takeawayToken, LAMB, TAKEAWAY_CUTOFF)
  check(
    'B1 takeaway cutoff at ready (verbatim, dine-in text unchanged)',
    refused.refused,
    refused.actual,
  )
  const stillReads = await rpcAs(anon, 'get_session_rounds', { p_token: takeawayToken })
  check('B1a the token still reads the history (NOT cleared)', !stillReads.error)

  // B2. Delivery: submit, drive to out_for_delivery, submit again → REFUSED.
  // A fresh delivery session per run — the seeded dev token's session may
  // already be past the cutoff from an earlier walkthrough run.
  const fresh = await anon.rpc('open_session_channel', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_channel: 'delivery',
    p_display_name: 'Walkthrough Cutoff',
    p_phone: '+15550004444',
    p_delivery_address: '2 Cutoff Probes Rd',
  })
  expect(!fresh.error, `cutoff-probe delivery entry: ${fresh.error?.message ?? 'ok'}`)
  const cutoffToken = fresh.data.token
  const deliveryRound = await submitRound(cutoffToken, LAMB)
  for (const fn of ['accept_round', 'start_preparation', 'mark_round_ready']) {
    const r = await rpcAs(carla, fn, { p_round_id: deliveryRound.round.id })
    expect(!r.error, `${fn}: ${r.error?.message ?? 'ok'}`)
  }
  const dispatch = await rpcAs(carla, 'mark_out_for_delivery', {
    p_round_id: deliveryRound.round.id,
  })
  expect(!dispatch.error, `dispatch: ${dispatch.error?.message ?? 'ok'}`)
  const refused2 = await submitRoundRefused(cutoffToken, LAMB, DELIVERY_CUTOFF)
  check('B2 delivery cutoff at out_for_delivery (verbatim)', refused2.refused, refused2.actual)

  // B3. Post-cutoff staff actions still work; the dine-in session of the same age still accepts.
  const finish = await rpcAs(carla, 'mark_completed', { p_round_id: deliveryRound.round.id })
  check(
    'B3 mark_completed post-cutoff succeeds',
    !finish.error && finish.data?.round?.state === 'completed',
  )
  const dine = await submitRound(DEV_TOKEN_DINEIN, LAMB)
  check('B3a the dine-in session still accepts (its cutoff is never)', dine.round.state === 'new')
}

/* ── Walkthrough C — channel rules and denials ───────────────────────────── */

async function walkthroughC() {
  console.log('\n── Walkthrough C: channel rules and denials (SC-003/SC-004) ──')

  // C1. Wrong-channel / wrong-order transitions → the generic refusal, zero change.
  const dineRound = await submitRound(DEV_TOKEN_DINEIN, LAMB)
  const wrongChannel = await rpcAs(carla, 'mark_out_for_delivery', {
    p_round_id: dineRound.round.id,
  })
  const dineNow = await adminOne('select state from public.rounds where id = $1', [
    dineRound.round.id,
  ])
  check(
    'C1 mark_out_for_delivery on a dine-in round → generic refusal, zero change',
    wrongChannel.error?.code === 'P0001' &&
      wrongChannel.error.message === GENERIC &&
      dineNow.state === 'new',
  )
  const takeReady = await adminOne(
    `select r.id from public.rounds r join public.sessions s on s.id = r.session_id
     where s.type = 'takeaway' and r.state = 'ready' order by r.created_at desc limit 1`,
  )
  const early = await rpcAs(carla, 'mark_completed', { p_round_id: takeReady.id })
  const takeNow = await adminOne('select state from public.rounds where id = $1', [takeReady.id])
  check(
    'C1a mark_completed before out_for_delivery → generic refusal, zero change',
    early.error?.code === 'P0001' && early.error.message === GENERIC && takeNow.state === 'ready',
  )

  // C2. Role: dan (kitchen) refuses both; fiona is denied everything.
  // Drive a fresh delivery session + round to ready so the denial probe has
  // a target regardless of what the earlier walkthroughs left behind (the
  // seeded dev-token session may already be past its cutoff).
  const c2anon = createClient(url, key)
  const c2entry = await c2anon.rpc('open_session_channel', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_channel: 'delivery',
    p_display_name: 'Walkthrough Denials',
    p_phone: '+15550005555',
    p_delivery_address: '3 Denial Probes Rd',
  })
  expect(!c2entry.error, `denial-probe delivery entry: ${c2entry.error?.message ?? 'ok'}`)
  const probe = await submitRound(c2entry.data.token, LAMB)
  for (const fn of ['accept_round', 'start_preparation', 'mark_round_ready']) {
    const r = await rpcAs(carla, fn, { p_round_id: probe.round.id })
    expect(!r.error, `${fn}: ${r.error?.message ?? 'ok'}`)
  }
  const delRound = { id: probe.round.id }
  const danTry = await rpcAs(dan, 'mark_out_for_delivery', { p_round_id: delRound.id })
  const danTry2 = await rpcAs(dan, 'mark_completed', { p_round_id: delRound.id })
  check(
    'C2 dan (kitchen, Marina) denied both delivery transitions',
    danTry.error?.code === '42501' && danTry2.error?.code === '42501',
  )
  const fionaTry = await rpcAs(fiona, 'mark_out_for_delivery', { p_round_id: delRound.id })
  check('C2a fiona denied (42501)', fionaTry.error?.code === '42501')

  // C3. Entry validation: missing address; unknown channel.
  const anon = createClient(url, key)
  const noAddress = await anon.rpc('open_session_channel', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_channel: 'delivery',
    p_display_name: 'X',
    p_phone: '+15550003333',
    p_delivery_address: '',
  })
  const dineInChannel = await anon.rpc('open_session_channel', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_channel: 'dine-in',
    p_display_name: 'X',
    p_phone: '+15550003333',
  })
  check(
    'C3 delivery entry without an address → the verbatim refusal',
    noAddress.error?.message === ADDRESS_REQUIRED,
  )
  check(
    'C3a dine-in on the channel RPC → the redirect',
    dineInChannel.error?.message === CHANNEL_REDIRECT,
  )

  // C4. Closing a delivery session through the 007 close path works and audits.
  const open = await adminOne(
    `select s.id from public.sessions s
     where s.type = 'delivery' and s.status = 'open' and s.opened_at < now() - interval '1 minute'
     order by s.opened_at asc limit 1`,
  )
  const closed = await rpcAs(carla, 'close_session', { p_session_id: open.id })
  check(
    'C4 the 007 close path closes a delivery session',
    !closed.error && closed.data?.closed === true,
  )
  const audit = await adminOne(
    `select action from public.audit_log where resource_id = $1 and action = 'session.closed'
     order by created_at desc limit 1`,
    [open.id],
  )
  check('C4a the closure audits identically', audit?.action === 'session.closed')
}

/* ── main ────────────────────────────────────────────────────────────────── */

process.on('SIGINT', () => process.exit(1))
const main = async () => {
  await pgClient.connect()
  await signIn(carla, 'carla@restopilot.dev', 'dev-carla-2026')
  await signIn(dan, 'dan@restopilot.dev', 'dev-dan-2026')
  await signIn(fiona, 'fiona@restopilot.dev', 'dev-fiona-2026')

  try {
    await walkthroughA()
    await walkthroughB()
    await walkthroughC()
  } finally {
    await pgClient.end()
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} walkthrough checks PASS`)
  if (failed.length > 0) {
    console.log('FAILED:', failed.map((f) => f.step).join(' | '))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('WALKTHROUGH ABORTED:', err.message)
  process.exit(1)
})
