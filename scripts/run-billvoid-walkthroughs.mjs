#!/usr/bin/env node
/**
 * T016 — executes the quickstart.md walkthroughs (spec 011) against the real
 * development project through the real data APIs (the 005–010 method) and
 * prints a step-by-step PASS/FAIL transcript. Run:
 * node --env-file-if-exists=.env scripts/run-billvoid-walkthroughs.mjs
 *
 * The walkthroughs mutate the fixture (rounds, voids, audit rows); the
 * quickstart's restore step (`npm run db:reset -- --yes && npm run db:seed`)
 * restores the deterministic state regardless.
 */
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY')

const BRANCH = { downtown: '00000000-0000-4000-8000-000000000101' }
const ITEM = { lambKebab: '00000000-0000-4000-8000-000000006014' }
const DEV_TOKEN_DINEIN = 'dev-token-downtown-t1-2026'
const REASON_REQUIRED = 'A void reason is required.'
const REASON_TOO_LONG = 'A void reason may be at most 500 characters.'
const GENERIC = 'This round is not available for that action.'
const DENIED = 'You do not have permission to update this round.'
const AUDIT_DENIED = 'You do not have permission to view the audit trail.'

const carla = createClient(url, key)
const alice = createClient(url, key)
const bob = createClient(url, key)
const dan = createClient(url, key)

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

async function submitRound(token, items) {
  const anon = createClient(url, key)
  const { data: payload, error: rpcError } = await anon.rpc('submit_round', {
    p_token: token,
    p_items: items,
  })
  expect(!rpcError, `submit_round: ${rpcError?.message ?? 'ok'}`)
  return payload
}

const LAMB = [{ item_id: ITEM.lambKebab, extras: [], quantity: '1' }]

/** Drive a `new` round to `lock` as carla (the dine-in machine). */
async function lockAsCarla(roundId) {
  for (const fn of ['accept_round', 'start_preparation', 'mark_round_ready', 'lock_round']) {
    const r = await rpcAs(carla, fn, { p_round_id: roundId })
    expect(!r.error, `${fn}: ${r.error?.message ?? 'ok'}`)
  }
}

/* ── Walkthrough A — the void at the boundary, zero change below it ─────── */

async function walkthroughA() {
  console.log('\n── Walkthrough A: the void overlay (SC-001) ──')

  // A1. A real dine-in round driven to the void boundary (`lock`).
  const round = await submitRound(DEV_TOKEN_DINEIN, LAMB)
  await lockAsCarla(round.round.id)
  const before = await adminOne(
    'select state, voided, subtotal, tax_total from public.rounds where id = $1',
    [round.round.id],
  )
  check('A1 locked dine-in round at the boundary', before.state === 'lock' && !before.voided)

  // A2. The validation order: blank reason, then the 501-char reason.
  const blank = await rpcAs(carla, 'void_round', { p_round_id: round.round.id, p_reason: '   ' })
  check(
    'A2 blank reason refused verbatim',
    blank.error?.code === 'P0001' && blank.error.message === REASON_REQUIRED,
    blank.error?.message,
  )
  const long = await rpcAs(carla, 'void_round', {
    p_round_id: round.round.id,
    p_reason: 'x'.repeat(501),
  })
  check(
    'A3 501-char reason refused verbatim',
    long.error?.code === 'P0001' && long.error.message === REASON_TOO_LONG,
    long.error?.message,
  )

  // A4. The void succeeds at the boundary; the STATE IS UNCHANGED (the overlay).
  const ok = await rpcAs(carla, 'void_round', {
    p_round_id: round.round.id,
    p_reason: 'Walkthrough: guest left without ordering again',
  })
  const after = await adminOne(
    'select state, voided, void_reason from public.rounds where id = $1',
    [round.round.id],
  )
  const ticket = await adminOne('select voided from public.kitchen_tickets where round_id = $1', [
    round.round.id,
  ])
  check(
    'A4 void succeeds; state stays lock; ticket mirrored',
    !ok.error && after.state === 'lock' && after.voided === true && ticket.voided === true,
    ok.error?.message,
  )

  // A5. Repeat void → the generic refusal; zero change.
  const repeat = await rpcAs(carla, 'void_round', { p_round_id: round.round.id, p_reason: 'again' })
  check(
    'A5 repeat void refused (the generic, indistinguishable)',
    repeat.error?.code === 'P0001' && repeat.error.message === GENERIC,
    repeat.error?.message,
  )

  // A6. A just-below round (ready, dine-in) refuses with zero change.
  const round2 = await submitRound(DEV_TOKEN_DINEIN, LAMB)
  for (const fn of ['accept_round', 'start_preparation', 'mark_round_ready']) {
    const r = await rpcAs(carla, fn, { p_round_id: round2.round.id })
    expect(!r.error, `${fn}: ${r.error?.message ?? 'ok'}`)
  }
  const early = await rpcAs(carla, 'void_round', {
    p_round_id: round2.round.id,
    p_reason: 'too early',
  })
  const earlyRow = await adminOne('select voided from public.rounds where id = $1', [
    round2.round.id,
  ])
  check(
    'A6 just-below boundary refused; zero change',
    early.error?.code === 'P0001' && early.error.message === GENERIC && !earlyRow.voided,
    early.error?.message,
  )
}

/* ── Walkthrough B — the bill is the complete display, voids excluded ────── */

async function walkthroughB() {
  console.log('\n── Walkthrough B: the bill and the voided section (SC-002) ──')

  // B1. Two fresh rounds on the seeded dine-in session; void one.
  const keep = await submitRound(DEV_TOKEN_DINEIN, LAMB)
  const drop = await submitRound(DEV_TOKEN_DINEIN, LAMB)
  await lockAsCarla(keep.round.id)
  await lockAsCarla(drop.round.id)
  const voided = await rpcAs(carla, 'void_round', {
    p_round_id: drop.round.id,
    p_reason: 'Walkthrough bill probe',
  })
  expect(!voided.error, `void for the bill probe: ${voided.error?.message ?? 'ok'}`)

  // B2. The bill: both rounds render (the voided one in its section with the
  // reason); the grand total is the NON-voided sum only.
  const sessionId = (
    await adminOne('select session_id from public.rounds where id = $1', [keep.round.id])
  ).session_id
  const bill = await rpcAs(carla, 'get_session_bill', { p_session_id: sessionId })
  expect(!bill.error, `get_session_bill: ${bill.error?.message ?? 'ok'}`)
  const payload = bill.data
  const mine = payload.rounds.filter(
    (r) => r.round_id === keep.round.id || r.round_id === drop.round.id,
  )
  const droppedRow = mine.find((r) => r.round_id === drop.round.id)
  const keptRow = mine.find((r) => r.round_id === keep.round.id)
  check(
    'B2 bill carries void flags + per-line detail + participants',
    droppedRow?.voided === true &&
      droppedRow?.void_reason === 'Walkthrough bill probe' &&
      Array.isArray(droppedRow?.items) &&
      droppedRow.items.length > 0 &&
      Array.isArray(payload.participants),
  )
  // The exclusion proof, self-consistent over the whole session (earlier
  // walkthrough rounds share the seeded session): grand_total equals the sum
  // of the NON-voided rounds, and grand_total + the voided totals equals the
  // sum of ALL rounds — the voided money appears nowhere in the total.
  const totalOf = (rows) =>
    rows.reduce((acc, r) => acc + parseFloat(r.subtotal) + parseFloat(r.tax_total), 0)
  const nonVoided = payload.rounds.filter((r) => !r.voided)
  const voidedRows = payload.rounds.filter((r) => r.voided)
  const excludes = Math.abs(totalOf(nonVoided) - parseFloat(payload.grand_total)) < 0.005
  const accounted =
    Math.abs(totalOf(nonVoided) + totalOf(voidedRows) - totalOf(payload.rounds)) < 0.005
  check(
    'B3 grand total excludes the voided rounds exactly',
    excludes && accounted && voidedRows.length >= 1,
    `grand_total ${payload.grand_total}, non-voided sum ${totalOf(nonVoided).toFixed(2)}`,
  )
}

/* ── Walkthrough C — the audit trail: reach, filter, denials ────────────── */

async function walkthroughC() {
  console.log('\n── Walkthrough C: the audit trail (SC-003) ──')

  // C1. Alice (owner) sees the whole trail including the voids; the reason rides along.
  const ownerView = await rpcAs(alice, 'get_audit_log', { p_action: 'round.void', p_limit: 200 })
  expect(!ownerView.error, `owner get_audit_log: ${ownerView.error?.message ?? 'ok'}`)
  const entries = ownerView.data.entries
  check(
    'C1 owner sees the round.void entries with reasons',
    entries.length >= 1 &&
      entries.every((e) => e.action === 'round.void') &&
      entries.every((e) => typeof e.actor_display_name === 'string'),
    `${entries.length} entries`,
  )

  // C2. Bob (Downtown branch_manager) sees his branch; the Marina filter is 42501.
  const MARINA = '00000000-0000-4000-8000-000000000102'
  const bobView = await rpcAs(bob, 'get_audit_log', {
    p_action: 'round.void',
    p_branch_id: BRANCH.downtown,
    p_limit: 200,
  })
  check(
    'C2 manager sees his branch',
    !bobView.error && bobView.data.entries.length >= 1,
    bobView.error?.message,
  )
  const foreign = await rpcAs(bob, 'get_audit_log', { p_branch_id: MARINA, p_limit: 100 })
  check(
    'C3 foreign branch filter refused verbatim',
    foreign.error?.code === '42501' && foreign.error.message === AUDIT_DENIED,
    foreign.error?.message,
  )

  // C4. Dan (kitchen) is denied — the trail is management-level.
  const danView = await rpcAs(dan, 'get_audit_log', { p_limit: 10 })
  check(
    'C4 kitchen denied',
    danView.error?.code === '42501' && danView.error.message === AUDIT_DENIED,
    danView.error?.message,
  )

  // C5. Dan cannot void either (the role denial, verbatim) — zero change.
  const readyRound = await adminOne(
    `select r.id from public.rounds r join public.sessions s on s.id = r.session_id
     where r.state = 'lock' and r.voided = false and s.branch_id = $1 order by r.created_at desc limit 1`,
    [BRANCH.downtown],
  )
  if (readyRound) {
    const danVoid = await rpcAs(dan, 'void_round', {
      p_round_id: readyRound.id,
      p_reason: 'kitchen cannot void',
    })
    const row = await adminOne('select voided from public.rounds where id = $1', [readyRound.id])
    check(
      'C5 kitchen void denied; zero change',
      danVoid.error?.code === '42501' && danVoid.error.message === DENIED && !row.voided,
      danVoid.error?.message,
    )
  }
}

/* ── Main ────────────────────────────────────────────────────────────────── */

await pgClient.connect()
await signIn(carla, 'carla@restopilot.dev', 'dev-carla-2026')
await signIn(alice, 'alice@restopilot.dev', 'dev-alice-2026')
await signIn(bob, 'bob@restopilot.dev', 'dev-bob-2026')
await signIn(dan, 'dan@restopilot.dev', 'dev-dan-2026')

try {
  await walkthroughA()
  await walkthroughB()
  await walkthroughC()
} finally {
  await pgClient.end()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} walkthrough checks passed`)
if (failed.length > 0) {
  console.log('FAILED:', failed.map((f) => f.step).join(', '))
  process.exit(1)
}
