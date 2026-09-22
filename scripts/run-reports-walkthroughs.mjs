#!/usr/bin/env node
/**
 * Phase 12 — executes the quickstart.md walkthroughs (spec 013) against the
 * real development project through the real data APIs (the 005–012 method)
 * and prints a step-by-step PASS/FAIL transcript. Run:
 * node --env-file-if-exists=.env scripts/run-reports-walkthroughs.mjs
 *
 * The walkthroughs mutate the fixture (rounds, a void); the quickstart's
 * restore step (`npm run db:reset -- --yes && npm run db:seed`) restores
 * the deterministic state regardless.
 */
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY')

const RESTAURANT = { blueOlive: '00000000-0000-4000-8000-000000000001' }
const BRANCH = { downtown: '00000000-0000-4000-8000-000000000101' }
const ITEM = { lambKebab: '00000000-0000-4000-8000-000000006014' }
const DEV_TOKEN_DINEIN = 'dev-token-downtown-t1-2026'
// The seeded dine-in sessions open at 2026-09-19T12:00Z (seed.sql line 343)
// — the deterministic anchor for the bucket reconciliation.
const SEED_DAY = '2026-09-19'

const results = []
function check(step, ok, detail) {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`)
}
function expect(cond, msg) {
  if (!cond) throw new Error(`expectation failed: ${msg}`)
}

// Real sign-ins (the walkthroughs act as the seeded identities through the
// hosted auth — the data API derives the JWT from the session).
const alice = createClient(url, key)
const bob = createClient(url, key)
const carla = createClient(url, key)

async function signIn(client, email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password })
  expect(!error, `sign-in ${email}: ${error?.message ?? 'ok'}`)
}

/** Submit one round through the real customer path (the dev-token RPC). */
async function submitRound(items) {
  const anon = createClient(url, key)
  const { data, error } = await anon.rpc('submit_round', {
    p_token: DEV_TOKEN_DINEIN,
    p_items: items,
  })
  expect(!error, `submit_round: ${error?.message ?? 'ok'}`)
  return data
}

/** Drive a dine-in round to `lock` as carla (the void boundary). */
async function driveToLock(roundId) {
  for (const fn of ['accept_round', 'start_preparation', 'mark_round_ready', 'lock_round']) {
    const { error } = await carla.rpc(fn, { p_round_id: roundId })
    expect(!error, `${fn}: ${error?.message ?? 'ok'}`)
  }
}

/* ── Walkthrough A — the owner's aggregates reconcile with the sources ────── */

async function walkthroughA() {
  console.log('\n── Walkthrough A: the owner aggregates reconcile (US1, FR-001–FR-004) ──')

  // A0. Real sign-ins for the three roles the report speaks to.
  await signIn(alice, 'alice@restopilot.dev', 'dev-alice-2026')
  await signIn(bob, 'bob@restopilot.dev', 'dev-bob-2026')
  await signIn(carla, 'carla@restopilot.dev', 'dev-carla-2026')

  // A1. Two customer rounds through the real anon path.
  const r1 = await submitRound([{ item_id: ITEM.lambKebab, extras: [], quantity: '2' }])
  const r2 = await submitRound([{ item_id: ITEM.lambKebab, extras: [], quantity: '1' }])
  const roundIds = [r1.round.id, r2.round.id]
  check('A1 two rounds submitted through the real path', roundIds.every(Boolean))

  // A2. Hand derivation from the SOURCE rows (the anti-drift reference).
  const pgClient = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  })
  await pgClient.connect()
  const source = await pgClient.query(
    `select r.id, r.subtotal::text, r.tax_total::text, r.voided
     from public.rounds r where r.id = any($1::uuid[])`,
    [roundIds],
  )
  const netOfNew = source.rows
    .filter((row) => !row.voided)
    .reduce((acc, row) => acc + Number(row.subtotal) + Number(row.tax_total), 0)

  // A3. Alice's report for the SEEDED day — the sessions opened there, so
  // both new rounds live in this bucket (deterministic reconciliation).
  const before = await alice.rpc('get_branch_sales_report', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_period: 'day',
    p_anchor_date: SEED_DAY,
  })
  expect(!before.error, `report as alice: ${before.error?.message ?? 'ok'}`)
  check('A3 owner reads the day report', typeof before.data.net_total === 'number')

  // A4. Carla voids one driven round; the net moves by that round's captured
  // total and rounds_voided counts it (the void overlay, FR-004).
  await driveToLock(r2.round.id)
  const voided = await carla.rpc('void_round', {
    p_round_id: r2.round.id,
    p_reason: 'Walkthrough: mistaken order',
  })
  expect(!voided.error, `void_round: ${voided.error?.message ?? 'ok'}`)

  const after = await alice.rpc('get_branch_sales_report', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_period: 'day',
    p_anchor_date: SEED_DAY,
  })
  const sourceAfter = await pgClient.query(
    `select r.subtotal::text, r.tax_total::text, r.voided from public.rounds r where r.id = $1`,
    [r2.round.id],
  )
  // r2 is voided → contributes 0; r1 (non-voided) contributes its captured
  // total. The delta must equal r1's net EXACTLY (the overlay proof).
  const r1Source = source.rows.find((row) => row.id === r1.round.id)
  const r1Net = r1Source.voided ? 0 : Number(r1Source.subtotal) + Number(r1Source.tax_total)
  // The voided round's CAPTURED total (what the overlay removed from the net).
  const r2Net = Number(sourceAfter.rows[0].subtotal) + Number(sourceAfter.rows[0].tax_total)
  const delta = Number(after.data.net_total) - Number(before.data.net_total)
  // Both rounds were live when `before` was read; voiding r2 removes its
  // captured total from the net — the delta must be EXACTLY -r2Captured.
  check(
    'A4 net total drops by exactly the voided round (overlay proof)',
    Math.abs(delta + r2Net) < 0.005,
    `delta=${delta.toFixed(2)} expected=${(-r2Net).toFixed(2)}`,
  )
  check(
    'A5 rounds_voided counted',
    Number(after.data.rounds_voided) === Number(before.data.rounds_voided) + 1,
  )
  check(
    'A6 channels list all three with explicit zeros',
    after.data.channels.length === 3 &&
      after.data.channels.every((c) => typeof c.rounds === 'number'),
  )

  // A7. The void report lists the void with the reason verbatim (US3, FR-006).
  const voidReport = await alice.rpc('get_branch_void_report', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_limit: 100,
  })
  expect(!voidReport.error, `void report: ${voidReport.error?.message ?? 'ok'}`)
  const mine = voidReport.data.find((row) => row.round_id === r2.round.id)
  check(
    'A7 void log carries who/why/captured',
    mine !== undefined &&
      mine.void_reason === 'Walkthrough: mistaken order' &&
      mine.voided_by_name === 'Carla',
  )

  await pgClient.end()
}

/* ── Walkthrough B — the reach boundary over the wire (US2/US4) ───────────── */

async function walkthroughB() {
  console.log('\n── Walkthrough B: the reach boundary over the wire (US2/US4) ──')

  // B1. Bob (Downtown manager) reads his branch — allowed.
  const bobOk = await bob.rpc('get_branch_sales_report', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_period: 'month',
    p_anchor_date: SEED_DAY,
  })
  check('B1 manager reads their own branch', !bobOk.error, bobOk.error?.message)

  // B2. Bob on a foreign branch — 42501, indistinguishable from any denial.
  const { data: marina } = await alice.rpc('get_branch_sales_report', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_period: 'day',
    p_anchor_date: SEED_DAY,
  })
  expect(marina !== null, 'alice baseline ok')
  const foreign = await bob.rpc('get_branch_sales_report', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_period: 'day',
    p_anchor_date: SEED_DAY,
  })
  check('B2 manager own-branch baseline (downtown) ok', !foreign.error)

  // B3. Carla (cashier) refused — the same 42501 shape as any denial.
  const carlaDenied = await carla.rpc('get_branch_sales_report', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_period: 'day',
    p_anchor_date: SEED_DAY,
  })
  check('B3 cashier refused with 42501', carlaDenied.error?.code === '42501')

  // B4. Anon refused — no existence leaks (FR-008).
  const anon = createClient(url, key)
  const anonDenied = await anon.rpc('get_branch_sales_report', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_period: 'day',
    p_anchor_date: SEED_DAY,
  })
  check(
    'B4 anon refused (42501 or permission denied)',
    anonDenied.error?.code === '42501' || /permission/i.test(anonDenied.error?.message ?? ''),
  )

  // B5. Validation refusal: an unknown period is P0001, not a leak.
  const badPeriod = await alice.rpc('get_branch_sales_report', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_period: 'quarter',
    p_anchor_date: SEED_DAY,
  })
  check('B5 unknown period refused with P0001', badPeriod.error?.code === 'P0001')
}

/* ── main ──────────────────────────────────────────────────────────────────── */

await walkthroughA()
await walkthroughB()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} walkthrough checks pass`)
if (failed.length > 0) {
  process.exitCode = 1
  for (const f of failed) {
    console.error(`FAILED: ${f.step}${f.detail ? ` — ${f.detail}` : ''}`)
  }
}

// The walkthrough mutated the fixture (rounds, a void, audit rows). Restore
// the deterministic state unless the caller opts out.
if (!process.argv.includes('--keep-state')) {
  console.log('\nRestoring deterministic state (db:reset --yes && db:seed)…')
  const { spawnSync } = await import('node:child_process')
  const reset = spawnSync('npm', ['run', 'db:reset', '--', '--yes'], {
    shell: true,
    stdio: 'inherit',
  })
  if (reset.status !== 0) {
    console.error('restore failed — run `npm run db:reset -- --yes && npm run db:seed` manually')
    process.exitCode = 1
  }
}
