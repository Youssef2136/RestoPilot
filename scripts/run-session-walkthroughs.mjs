#!/usr/bin/env node
/**
 * T031 — executes the three quickstart.md walkthroughs for feature 007
 * against the real development project through the real data APIs (the
 * feature 005/006 method) and prints a step-by-step PASS/FAIL transcript.
 * Run: node --env-file-if-exists=.env scripts/run-session-walkthroughs.mjs
 *
 * The walkthroughs mutate the fixture (scratch sessions at Downtown T3 and
 * Airport T1); the script cleans up after itself (closes what it opens) and
 * the quickstart's restore step (`npm run db:reset -- --yes && npm run
 * db:seed`) restores the deterministic state regardless.
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
const BRANCH = {
  downtown: '00000000-0000-4000-8000-000000000101',
  marina: '00000000-0000-4000-8000-000000000102',
  airport: '00000000-0000-4000-8000-000000000201',
}
const TABLE = {
  downtownT1: '00000000-0000-4000-8000-000000003001',
  downtownT2: '00000000-0000-4000-8000-000000003002',
  downtownT3: '00000000-0000-4000-8000-000000003003',
  marinaT1: '00000000-0000-4000-8000-000000003004',
  airportT1: '00000000-0000-4000-8000-000000003005',
}
const SESSION = {
  downtownT1: '00000000-0000-4000-8000-000000008001',
  downtownT2: '00000000-0000-4000-8000-000000008002',
}
const DEV_TOKEN = {
  downtownT1: 'dev-token-downtown-t1-2026',
  downtownT2: 'dev-token-downtown-t2-2026',
}

const creds = {
  carla: ['carla@restopilot.dev', 'dev-carla-2026'],
  dan: ['dan@restopilot.dev', 'dev-dan-2026'],
  eve: ['eve@restopilot.dev', 'dev-eve-2026'],
  fiona: ['fiona@restopilot.dev', 'dev-fiona-2026'],
}

let seq = 0
function clientFor() {
  seq += 1
  return createClient(url, key, { auth: { storageKey: `wk7-${seq}` } })
}

async function signIn([email, password]) {
  const c = clientFor()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
  return c
}

const results = []
function check(step, ok, detail) {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`)
}
function expect(cond, msg) {
  if (!cond) throw new Error(`expectation failed: ${msg}`)
}
async function rpcAs(c, fn, args) {
  const { data, error } = await c.rpc(fn, args)
  return { data, error }
}
function expectOk(res, what) {
  expect(!res.error, `${what}: ${res.error?.message ?? ''}`)
  return res.data
}
/** Expects the RPC to fail with a P0001 whose message contains `part`. */
async function expectRefusal(res, what, part) {
  expect(!!res.error, `${what}: expected a refusal, got success`)
  expect(res.error.code === 'P0001', `${what}: expected P0001, got ${res.error.code}`)
  expect(res.error.message.includes(part), `${what}: "${res.error.message}" lacks "${part}"`)
}
/** Expects the RPC to fail with a 42501 permission denial. */
async function expectDenied(res, what) {
  expect(!!res.error, `${what}: expected a denial, got success`)
  expect(res.error.code === '42501', `${what}: expected 42501, got ${res.error.code}`)
}

// ── Walkthrough A — the customer enters (SC-001) ─────────────────────────────
async function walkthroughA() {
  console.log('\n── Walkthrough A — the customer enters ──')
  const anon = clientFor()
  await anon.auth.signOut({ scope: 'local' }).catch(() => {})

  // Step 1–2: the public payload renders the restaurant and its branches.
  const pub = expectOk(
    await rpcAs(anon, 'get_public_restaurant', { p_slug: 'blue-olive' }),
    'A1 public read',
  )
  check(
    'A1 restaurant + two branches',
    pub.restaurant.name === 'Blue Olive' && pub.branches.length === 2,
    pub.branches.map((b) => b.name).join(', '),
  )

  // Step 3: table options come from the branch's ACTIVE tables only —
  // Marina's stopped table never appears anywhere (FR-003).
  const downtown = pub.branches.find((b) => b.name === 'Downtown')
  const marina = pub.branches.find((b) => b.name === 'Marina')
  check(
    'A2 active-tables only (Marina T1 stopped, absent)',
    downtown.tables.some((t) => t.label === 'T3') && marina.tables.length === 0,
    `Downtown=[${downtown.tables.map((t) => t.label)}] Marina=[${marina.tables.map((t) => t.label)}]`,
  )

  // Step 4: entry at T3 establishes the session and issues a token.
  const entry = expectOk(
    await rpcAs(anon, 'open_session_at_table', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_branch_id: BRANCH.downtown,
      p_table_id: TABLE.downtownT3,
      p_display_name: 'Walkthrough A Guest',
      p_phone: '+15557770101',
    }),
    'A3 entry',
  )
  check(
    'A3 entry at T3 issues a token',
    entry.token.length >= 40,
    `session ${entry.session.id.slice(-4)}`,
  )
  const sessionA = entry.session.id
  const tokenA = entry.token

  // Step 5: the invalid classes are refused with the contract messages and
  // nothing is stored (the same T3 entry would fail before any insert).
  await expectRefusal(
    await rpcAs(anon, 'open_session_at_table', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_branch_id: BRANCH.downtown,
      p_table_id: TABLE.downtownT3,
      p_display_name: '   ',
      p_phone: '+15557770102',
    }),
    'A4 blank name refused',
    'A display name is required.',
  )
  check('A4 blank name refused, message verbatim', true, 'A display name is required.')
  await expectRefusal(
    await rpcAs(anon, 'open_session_at_table', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_branch_id: BRANCH.downtown,
      p_table_id: TABLE.downtownT3,
      p_display_name: 'x'.repeat(61),
      p_phone: '+15557770102',
    }),
    'A5 61-char name refused',
    'A display name may be at most 60 characters.',
  )
  check('A5 61-char name refused', true, 'A display name may be at most 60 characters.')
  await expectRefusal(
    await rpcAs(anon, 'open_session_at_table', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_branch_id: BRANCH.downtown,
      p_table_id: TABLE.downtownT3,
      p_display_name: 'Valid Name',
      p_phone: 'letters-only',
    }),
    'A6 lettered phone refused',
    'A valid phone number is required.',
  )
  check('A6 lettered phone refused', true, 'A valid phone number is required.')
  await expectRefusal(
    await rpcAs(anon, 'get_public_restaurant', { p_slug: 'no-such-slug' }),
    'A7 unknown slug refused',
    'Restaurant not found.',
  )
  check('A7 unknown slug refused', true, 'Restaurant not found.')

  // The menu read rides on the token (the FR-021 customer menu).
  const menu = expectOk(await rpcAs(anon, 'get_session_menu', { p_token: tokenA }), 'A8 menu read')
  check('A8 the token reads the session menu', menu.branch.id === BRANCH.downtown, menu.branch.name)

  // Cleanup: close A's session so B/C and the fixture stay deterministic.
  const carla = await signIn(creds.carla)
  expectOk(await rpcAs(carla, 'close_session', { p_session_id: sessionA }), 'A9 cleanup close')
  return { tokenA, sessionA }
}

// ── Walkthrough B — join, no timeout, staff close (SC-003/SC-005/SC-006) ─────
async function walkthroughB() {
  console.log('\n── Walkthrough B — join, no timeout, staff close ──')
  const anon = clientFor()
  await anon.auth.signOut({ scope: 'local' }).catch(() => {})

  // Step 1: two entries at the SAME table — the second joins (one session,
  // two participants; no second session).
  const first = expectOk(
    await rpcAs(anon, 'open_session_at_table', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_branch_id: BRANCH.downtown,
      p_table_id: TABLE.downtownT3,
      p_display_name: 'Join First',
      p_phone: '+15557770201',
    }),
    'B1 first entry',
  )
  const second = expectOk(
    await rpcAs(anon, 'open_session_at_table', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_branch_id: BRANCH.downtown,
      p_table_id: TABLE.downtownT3,
      p_display_name: 'Join Second',
      p_phone: '+15557770202',
    }),
    'B2 second entry',
  )
  check(
    'B1-2 one session, two participants (the join)',
    second.session.id === first.session.id && first.session.id !== SESSION.downtownT1,
    `session ${first.session.id.slice(-4)}`,
  )

  // Step 2: no timeout — the session is usable regardless of elapsed time
  // (nothing expires; the context resolves with no freshness predicate).
  const ctx = expectOk(
    await rpcAs(anon, 'get_session_context', { p_token: first.token }),
    'B3 context',
  )
  check(
    'B3 no-timeout: the context resolves with no expiry',
    ctx.session.status === 'open',
    'status open',
  )

  // Step 3: carla (Downtown cashier) sees exactly her branch's open sessions.
  const carla = await signIn(creds.carla)
  const list = expectOk(
    await rpcAs(carla, 'get_branch_open_sessions', { p_branch_id: BRANCH.downtown }),
    'B4 carla list',
  )
  const t3 = list.sessions.find((s) => s.id === first.session.id)
  check(
    'B4 carla sees the session with both participants',
    !!t3 &&
      t3.participants.length === 2 &&
      t3.participants.every((p) => typeof p.display_name === 'string' && !('phone' in p)),
    `participants: ${t3?.participants.map((p) => p.display_name).join(', ')}`,
  )

  // Step 5a: dan (kitchen) is denied the list and the close.
  const dan = await signIn(creds.dan)
  await expectDenied(
    await rpcAs(dan, 'get_branch_open_sessions', { p_branch_id: BRANCH.downtown }),
    'B5 dan list denied',
  )
  await expectDenied(
    await rpcAs(dan, 'close_session', { p_session_id: first.session.id }),
    'B5 dan close denied',
  )
  check('B5 dan (kitchen) denied list + close (42501)', true, '42501')

  // Step 5b: eve is Downtown's CASHIER by seed — she CAN list/close there.
  // The denial identity is fiona (no membership anywhere).
  const eve = await signIn(creds.eve)
  const eveList = expectOk(
    await rpcAs(eve, 'get_branch_open_sessions', { p_branch_id: BRANCH.downtown }),
    'B6 eve (Downtown cashier) lists Downtown',
  )
  check(
    'B6 eve lists Downtown (cashier by seed)',
    eveList.sessions.some((s) => s.id === first.session.id),
    'included',
  )
  await expectDenied(
    await rpcAs(eve, 'get_branch_open_sessions', { p_branch_id: BRANCH.marina }),
    'B6 eve Marina denied',
  )
  const fiona = await signIn(creds.fiona)
  await expectDenied(
    await rpcAs(fiona, 'get_branch_open_sessions', { p_branch_id: BRANCH.downtown }),
    'B6 fiona denied',
  )
  check('B6 eve: no Marina; fiona: nothing', true, '42501')

  // Step 4: carla closes the session; the customer's next read is refused
  // and the audit record exists with carla as the actor.
  expectOk(
    await rpcAs(carla, 'close_session', { p_session_id: first.session.id }),
    'B7 carla close',
  )
  await expectRefusal(
    await rpcAs(anon, 'get_session_context', { p_token: first.token }),
    'B8 closed-session refusal',
    'This session is no longer available.',
  )
  check(
    'B8 the customer read is refused after the close',
    true,
    'This session is no longer available.',
  )

  // The audit record: read as the admin connection (staff roles are denied
  // audit_log by design).
  const admin = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  })
  await admin.connect()
  const audit = await admin.query(
    `select actor_profile_id, action, resource_id, restaurant_id, branch_id
       from public.audit_log
      where resource_id = $1 and action = 'session.closed'`,
    [first.session.id],
  )
  await admin.end()
  const row = audit.rows[0]
  check(
    'B9 the close audit record (actor carla, tenant + branch scope)',
    !!row &&
      row.actor_profile_id === '00000000-0000-4000-8000-000000001003' &&
      row.restaurant_id === RESTAURANT.blueOlive &&
      row.branch_id === BRANCH.downtown,
    row ? `actor ${row.actor_profile_id.slice(-4)}` : 'no row',
  )
}

// ── Walkthrough C — recovery and abuse (SC-002/SC-004) ───────────────────────
async function walkthroughC() {
  console.log('\n── Walkthrough C — recovery and abuse ──')
  const anon = clientFor()
  await anon.auth.signOut({ scope: 'local' }).catch(() => {})

  // Step 1: entry, then a reload-equivalent — the same token recovers the
  // context without re-entering anything.
  const entry = expectOk(
    await rpcAs(anon, 'open_session_at_table', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_branch_id: BRANCH.downtown,
      p_table_id: TABLE.downtownT3,
      p_display_name: 'Recovery Guest',
      p_phone: '+15557770301',
    }),
    'C1 entry',
  )
  const ctx1 = expectOk(
    await rpcAs(anon, 'get_session_context', { p_token: entry.token }),
    'C2 recovery read',
  )
  check(
    'C1-2 reload-equivalent recovery',
    ctx1.session.id === entry.session.id,
    `session ${entry.session.id.slice(-4)}`,
  )

  // Step 2: the same token works from a "second device" (fresh client) and
  // resolves only ITS session — possession is the capability (FR-011/FR-012).
  const secondDevice = clientFor()
  await secondDevice.auth.signOut({ scope: 'local' }).catch(() => {})
  const ctx2 = expectOk(
    await rpcAs(secondDevice, 'get_session_context', { p_token: entry.token }),
    'C3 second device',
  )
  check(
    'C3 the token works from a second device, same session',
    ctx2.session.id === entry.session.id,
    'possession = capability',
  )

  // Step 3: a tampered token is refused with the one indistinguishable
  // message; nothing leaks.
  await expectRefusal(
    await rpcAs(anon, 'get_session_context', { p_token: `${entry.token}x` }),
    'C4 tampered token',
    'This session is no longer available.',
  )
  check(
    'C4 tampered token refused, message identical',
    true,
    'This session is no longer available.',
  )

  // Step 4: staff close, a NEW session opens at the same table, and the
  // first window's token is refused — the reassociation rule (FR-014).
  const eve = await signIn(creds.eve)
  expectOk(await rpcAs(eve, 'close_session', { p_session_id: entry.session.id }), 'C5 eve close')
  const fresh = expectOk(
    await rpcAs(anon, 'open_session_at_table', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_branch_id: BRANCH.downtown,
      p_table_id: TABLE.downtownT3,
      p_display_name: 'Fresh Guest',
      p_phone: '+15557770302',
    }),
    'C6 new session at the same table',
  )
  check(
    'C6 the table frees for a new session',
    fresh.session.id !== entry.session.id,
    `new ${fresh.session.id.slice(-4)}`,
  )
  await expectRefusal(
    await rpcAs(anon, 'get_session_context', { p_token: entry.token }),
    'C7 old token refused after re-seat',
    'This session is no longer available.',
  )
  check("C7 the closed session's token is refused after re-seat", true, 'reassociation rule')
  const freshCtx = expectOk(
    await rpcAs(anon, 'get_session_context', { p_token: fresh.token }),
    'C8 fresh token',
  )
  check("C8 the new session's token resolves", freshCtx.session.id === fresh.session.id, 'usable')

  // Cleanup: close the fresh session so the fixture stays deterministic.
  expectOk(
    await rpcAs(eve, 'close_session', { p_session_id: fresh.session.id }),
    'C9 cleanup close',
  )
}

// ── main ─────────────────────────────────────────────────────────────────────
try {
  await walkthroughA()
  await walkthroughB()
  await walkthroughC()
} catch (error) {
  // Never let a crash masquerade as success: the transcript is the evidence.
  console.error(`\nWALKTHROUGH CRASH: ${error?.message ?? error}`)
  const passed = results.filter((r) => r.ok).length
  console.log(`${passed}/${results.length} walkthrough checks passed before the crash`)
  process.exit(1)
}
const passed = results.filter((r) => r.ok).length
console.log(`\n${passed}/${results.length} walkthrough checks passed`)
process.exit(passed === results.length ? 0 : 1)
