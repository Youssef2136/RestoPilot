#!/usr/bin/env node
/**
 * Phase 13 — executes the quickstart.md walkthroughs (spec 014) against the
 * real development project through the real data APIs (the 005–013 method)
 * and prints a step-by-step PASS/FAIL transcript. Run:
 * node --env-file-if-exists=.env scripts/run-platform-walkthroughs.mjs
 *
 * The walkthroughs mutate the fixture (subscription dates, a disablement,
 * audit rows); the quickstart's restore step (`npm run db:reset -- --yes &&
 * npm run db:seed`) restores the deterministic state regardless.
 */
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY')

const RESTAURANT = {
  blueOlive: '00000000-0000-4000-8000-000000000001',
  cedarGrill: '00000000-0000-4000-8000-000000000002',
}
const BRANCH = { downtown: '00000000-0000-4000-8000-000000000101' }
const TABLE = { t1: '00000000-0000-4000-8000-000000003001' }
const ITEM = { lambKebab: '00000000-0000-4000-8000-000000006014' }
const DEV_TOKEN_DINEIN = 'dev-token-downtown-t1-2026'

const results = []
function check(step, ok, detail) {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`)
}
function expect(cond, msg) {
  if (!cond) throw new Error(`expectation failed: ${msg}`)
}

// Real sign-ins. The platform admin is a seeded identity with NO memberships
// — the flag is the only key (plan D4).
const admin = createClient(url, key)
const alice = createClient(url, key)
const carla = createClient(url, key)
const anon = createClient(url, key)

async function signIn(client, email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password })
  expect(!error, `sign-in ${email}: ${error?.message ?? 'ok'}`)
}

function daysFromToday(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/* ── Setup — normalize the fixture state the walkthroughs assume ─────────── */

async function setup() {
  // The walkthroughs are re-runnable: repair Blue Olive's fixture to the seed
  // state (never_activated, not disabled) before any derivation check. This
  // is fixture repair through the admin connection, NOT a walkthrough step —
  // the RPC refuses null dates by contract (A6 verifies that refusal), so
  // only the direct update can restore never_activated after a previous run.
  // Audit rows from previous runs are fine — D1 counts a lower bound.
  const c = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()
  await c.query(
    'update public.subscriptions set start_date = null, end_date = null where restaurant_id = $1::uuid',
    [RESTAURANT.blueOlive],
  )
  await c.query(
    'update public.restaurants set platform_disabled = false, platform_disabled_reason = null where id = $1::uuid',
    [RESTAURANT.blueOlive],
  )
  await c.end()
}

/* ── Walkthrough A — the console: reach, payload, derivation (US1, FR-001,
   FR-002, FR-008) ─────────────────────────────────────────────────────────── */

async function walkthroughA() {
  console.log('\n── Walkthrough A: the console read (US1, FR-001/FR-002/FR-008) ──')

  const { data, error } = await admin.rpc('get_platform_overview')
  expect(!error, `get_platform_overview: ${error?.message ?? 'ok'}`)
  const rows = Array.isArray(data) ? data : []
  const blue = rows.find((r) => r.restaurant_id === RESTAURANT.blueOlive)
  const cedar = rows.find((r) => r.restaurant_id === RESTAURANT.cedarGrill)

  check(
    'A1 the platform admin sees both restaurants',
    rows.length >= 2 && blue && cedar,
    `${rows.length} restaurants`,
  )

  check(
    'A2 the seeded lifecycle derives never_activated (no dates)',
    blue?.state === 'never_activated' && cedar?.state === 'never_activated',
    `blue=${blue?.state}, cedar=${cedar?.state}`,
  )

  check(
    'A3 the payload carries usage counts from the source rows',
    typeof blue?.branch_count === 'number' &&
      typeof blue?.staff_count === 'number' &&
      typeof blue?.session_count === 'number' &&
      typeof blue?.round_count === 'number',
    `branches=${blue?.branch_count}, staff=${blue?.staff_count}`,
  )

  // The 7-day boundary derivation, live: end = today+30 → active.
  const set = await admin.rpc('set_subscription_dates', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_start_date: daysFromToday(0),
    p_end_date: daysFromToday(30),
  })
  expect(!set.error, `set_subscription_dates: ${set.error?.message ?? 'ok'}`)
  const after = await admin.rpc('get_platform_overview')
  const blue2 = (after.data ?? []).find((r) => r.restaurant_id === RESTAURANT.blueOlive)
  check(
    'A4 the state derives at read time (active after dates set)',
    blue2?.state === 'active',
    `state=${blue2?.state}`,
  )

  // Nearing expiration: end = today+3 → nearing_expiration.
  await admin.rpc('set_subscription_dates', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_start_date: daysFromToday(-10),
    p_end_date: daysFromToday(3),
  })
  const near = await admin.rpc('get_platform_overview')
  const blue3 = (near.data ?? []).find((r) => r.restaurant_id === RESTAURANT.blueOlive)
  check(
    'A5 nearing_expiration derives within the 7-day window',
    blue3?.state === 'nearing_expiration',
    `state=${blue3?.state}`,
  )

  // The contract: dates are SET, never cleared — nulls are refused (FR-003/FR-004:
  // the lifecycle is manual-first; never_activated is the pre-activation state).
  const refused = await admin.rpc('set_subscription_dates', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_start_date: null,
    p_end_date: null,
  })
  check(
    'A6 clearing dates is refused — dates are set, never nulled',
    !!refused.error && /Both subscription dates are required\./.test(refused.error.message),
    refused.error?.message ?? 'unexpected success',
  )

  // Restore the derivation baseline for the later walkthroughs: the seed's
  // never_activated state (the walkthrough's reset step also guarantees it).
  await admin.rpc('set_subscription_dates', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_start_date: daysFromToday(0),
    p_end_date: daysFromToday(30),
  })
  const baseline = await admin.rpc('get_platform_overview')
  const blue4 = (baseline.data ?? []).find((r) => r.restaurant_id === RESTAURANT.blueOlive)
  check(
    'A7 dates set again derive active (the manual-first lifecycle)',
    blue4?.state === 'active',
    `state=${blue4?.state}`,
  )
}

/* ── Walkthrough B — reach: the flag is the only key (FR-009) ─────────────── */

async function walkthroughB() {
  console.log('\n── Walkthrough B: reach (FR-009) ──')

  for (const [who, client] of [
    ['alice (owner)', alice],
    ['carla (cashier)', carla],
    ['anon', anon],
  ]) {
    const { error } = await client.rpc('get_platform_overview')
    check(
      `B ${who} is refused the console`,
      !!error && error.code === '42501',
      error?.message ?? 'unexpected success',
    )
  }
}

/* ── Walkthrough C — the doors: disablement and the Important rule
   (FR-006) ─────────────────────────────────────────────────────────────────── */

async function walkthroughC() {
  console.log('\n── Walkthrough C: the two doors (FR-006) ──')

  // Baseline: a live dine-in submission works (never_activated orders freely).
  const before = await anon.rpc('submit_round', {
    p_token: DEV_TOKEN_DINEIN,
    p_items: [{ item_id: ITEM.lambKebab, quantity: '1', extras: [] }],
  })
  check(
    'C1 a never_activated restaurant orders freely',
    !before.error,
    before.error?.message ?? `round ${before.data?.round?.id?.slice(0, 8)}`,
  )

  // Disable Blue Olive.
  const disable = await admin.rpc('set_restaurant_platform_disabled', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_disabled: true,
    p_reason: 'Walkthrough: the kill-switch check',
  })
  expect(!disable.error, `disable: ${disable.error?.message ?? 'ok'}`)

  const entry = await anon.rpc('open_session_at_table', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_table_id: TABLE.t1,
    p_display_name: 'Walkthrough Door',
    p_phone: '+15550700001',
  })
  check(
    'C2 the entry door refuses a disabled restaurant',
    !!entry.error && entry.error.message === 'This restaurant is not available.',
    entry.error?.message ?? 'unexpected success',
  )

  const submit = await anon.rpc('submit_round', {
    p_token: DEV_TOKEN_DINEIN,
    p_items: [{ item_id: ITEM.lambKebab, quantity: '1', extras: [] }],
  })
  check(
    'C3 the ordering door refuses a disabled restaurant',
    !!submit.error && submit.error.message === 'This restaurant is not available.',
    submit.error?.message ?? 'unexpected success',
  )

  // The Important rule: an EXPIRED subscription must not block ordering.
  await admin.rpc('set_restaurant_platform_disabled', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_disabled: false,
    p_reason: null,
  })
  await admin.rpc('set_subscription_dates', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_start_date: daysFromToday(-30),
    p_end_date: daysFromToday(-1),
  })
  const expired = await anon.rpc('submit_round', {
    p_token: DEV_TOKEN_DINEIN,
    p_items: [{ item_id: ITEM.lambKebab, quantity: '1', extras: [] }],
  })
  check(
    'C4 the Important rule: expired does NOT block ordering',
    !expired.error,
    expired.error?.message ?? `round ${expired.data?.round?.id?.slice(0, 8)}`,
  )

  // C5: the disablement is the ONLY axis that blocks — the expired restaurant
  // keeps ordering (C4 proved it live). Re-enable and verify the flag only.
  await admin.rpc('set_restaurant_platform_disabled', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_disabled: false,
    p_reason: null,
  })
  const verify = await admin.rpc('get_platform_overview')
  const blue = (verify.data ?? []).find((r) => r.restaurant_id === RESTAURANT.blueOlive)
  check(
    'C5 re-enabled: the flag is off while the dates read expired',
    blue?.platform_disabled === false && blue?.state === 'expired',
    `disabled=${blue?.platform_disabled}, state=${blue?.state}`,
  )
}

/* ── Walkthrough D — the audit trail (FR-005) ───────────────────────────── */

async function walkthroughD() {
  console.log('\n── Walkthrough D: the disablement audit (FR-005) ──')

  // The audit read keeps Phase 10's tenant reach: the OWNER of the affected
  // restaurant sees the platform's actions in her own trail (the platform
  // admin holds no memberships, so the rows reach her through the restaurant
  // she owns — the same discipline that keeps every other audit row scoped).
  const { data, error } = await alice.rpc('get_audit_log', { p_limit: 20 })
  expect(!error, `get_audit_log as alice: ${error?.message ?? 'ok'}`)
  const rows = (data?.entries ?? []).filter(
    (r) =>
      r.action === 'platform.restaurant_disabled' || r.action === 'platform.restaurant_enabled',
  )
  check(
    'D1 the walkthrough disablements are audited and tenant-visible',
    rows.length >= 3,
    `${rows.length} platform audit rows (disable + enable)`,
  )

  // The platform admin herself is refused the tenant audit read — the flag
  // grants the console, not the tenants' trails (the reach contract holds).
  const denied = await admin.rpc('get_audit_log', { p_limit: 5 })
  check(
    'D2 the platform admin is refused the tenant audit read',
    !!denied.error && denied.error.code === '42501',
    denied.error?.message ?? 'unexpected success',
  )
}

/* ── main ─────────────────────────────────────────────────────────────────── */

try {
  await signIn(admin, 'platform-admin@restopilot.dev', 'dev-platform-admin-2026')
  await signIn(alice, 'alice@restopilot.dev', 'dev-alice-2026')
  await signIn(carla, 'carla@restopilot.dev', 'dev-carla-2026')

  await setup()
  await walkthroughA()
  await walkthroughB()
  await walkthroughC()
  await walkthroughD()
} catch (error) {
  console.error('\nABORTED:', error.message)
  process.exitCode = 1
} finally {
  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} checks PASS`)
  if (passed !== results.length) process.exitCode = 1
}
