#!/usr/bin/env node
/**
 * Phase 15 — the §26 performance baselines (spec 016 T003; plan D1/D2).
 * Measures all nine areas against the real dev project through the real
 * data APIs (the walkthrough pattern: real sign-ins, real RPCs, real
 * Storage), medians of 5 with a discarded warm-up, and writes the artifact
 * with environment metadata. Run:
 *
 *   node --env-file-if-exists=.env scripts/run-perf-baselines.mjs
 *
 * Timing assertions are NOT standing gates (plan D1) — the artifact is the
 * record; the customer-path budgets are checked in this phase's T004.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY')

const RESTAURANT = { blueOlive: '00000000-0000-4000-8000-000000000001' }
const BRANCH = { downtown: '00000000-0000-4000-8000-000000000101' }
const ITEM = {
  lambKebab: '00000000-0000-4000-8000-000000006014',
  hummus: '00000000-0000-4000-8000-000000006011',
}
const DEV_TOKEN_DINEIN = 'dev-token-downtown-t1-2026'
const TABLE = { t1: '00000000-0000-4000-8000-000000003001' }

const RUNS = 5

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Median of RUNS + one discarded warm-up around an async call. */
async function measure(name, fn) {
  const times = []
  for (let i = 0; i <= RUNS; i++) {
    const t0 = performance.now()
    await fn()
    const dt = performance.now() - t0
    if (i > 0) times.push(dt)
  }
  const med = Math.round(median(times))
  console.log(`${name}: ${med} ms (median of ${RUNS}, warm-up discarded)`)
  return { name, median_ms: med, runs_ms: times.map(Math.round) }
}

async function expectOk(label, builder) {
  // supabase-js builders are lazy thenables: the call only executes when
  // awaited. Await first, then check the real envelope — an un-awaited
  // builder has undefined success/error and would pass vacuously (and the
  // call would never run, making the timing meaningless).
  const response = await builder
  if (response.error) {
    throw new Error(`${label} failed: ${JSON.stringify(response.error).slice(0, 200)}`)
  }
  return response.data
}

const results = {}

/* Sign-ins (real identities). */
const alice = createClient(url, key)
const carla = createClient(url, key)
const anon = createClient(url, key)
for (const [who, client, email, pw] of [
  ['alice', alice, 'alice@restopilot.dev', 'dev-alice-2026'],
  ['carla', carla, 'carla@restopilot.dev', 'dev-carla-2026'],
]) {
  const { error } = await client.auth.signInWithPassword({ email, password: pw })
  if (error) throw new Error(`sign-in ${who}: ${error.message}`)
}

/* ── 1. Menu loading (customer path — budget ≤ 1500 ms) ─────────────────── */
results.menu_loading = {
  budget_ms: 1500,
  get_session_menu: await measure('get_session_menu', () =>
    expectOk('get_session_menu', anon.rpc('get_session_menu', { p_token: DEV_TOKEN_DINEIN })),
  ),
}

/* ── 2. Dashboard queries ────────────────────────────────────────────────── */
results.dashboard_queries = {
  get_branch_rounds: await measure('get_branch_rounds', () =>
    expectOk('rounds', carla.rpc('get_branch_rounds', { p_branch_id: BRANCH.downtown })),
  ),
  get_branch_open_sessions: await measure('get_branch_open_sessions', () =>
    expectOk('sessions', carla.rpc('get_branch_open_sessions', { p_branch_id: BRANCH.downtown })),
  ),
  get_audit_log: await measure('get_audit_log', () =>
    expectOk('audit', alice.rpc('get_audit_log', { p_limit: 20 })),
  ),
}

/* ── 3. Realtime fan-out: subscribe→SUBSCRIBED handshake ─────────────────── */
{
  const channel = anon.channel('perf-baseline')
  const t0 = performance.now()
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SUBSCRIBED timeout')), 15000)
    channel
      .on('postgres_changes', { event: '*', schema: 'db', table: 'public.sessions' }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer)
          resolve()
        }
      })
  })
  const handshake_ms = Math.round(performance.now() - t0)
  await anon.removeChannel(channel)
  results.realtime_fanout = {
    subscribe_to_subscribed_ms: handshake_ms,
    note: 'single handshake; fan-out latency is asserted by the 012 e2e journeys',
  }
  console.log(`realtime handshake: ${handshake_ms} ms`)
}

/* ── 4. Session retrieval ────────────────────────────────────────────────── */
results.session_retrieval = {
  get_session_context: await measure('get_session_context', () =>
    expectOk('context', anon.rpc('get_session_context', { p_token: DEV_TOKEN_DINEIN })),
  ),
}

/* ── 5. Round submission (customer path — budget ≤ 800 ms) ───────────────── */
{
  const runs = []
  // Warm-up + 5 real submissions through the seeded dine-in session.
  for (let i = 0; i <= RUNS; i++) {
    const t0 = performance.now()
    await expectOk(
      'submit_round',
      anon.rpc('submit_round', {
        p_token: DEV_TOKEN_DINEIN,
        p_items: [{ item_id: ITEM.lambKebab, quantity: '1', extras: [] }],
      }),
    )
    const dt = performance.now() - t0
    if (i > 0) runs.push(Math.round(dt))
  }
  results.round_submission = { budget_ms: 800, median_ms: Math.round(median(runs)), runs_ms: runs }
  console.log(`submit_round: ${results.round_submission.median_ms} ms (median of ${RUNS})`)
}

/* ── 6. Kitchen ticket updates ───────────────────────────────────────────── */
{
  // A state transition happens once per round, so each measured iteration
  // drives its own FRESH round: submit → the untimed setup transitions → the
  // single timed transition. Warm-up (i = 0) is discarded, as everywhere.
  const timedTransition = async (label, setup, transition) => {
    const runs = []
    for (let i = 0; i <= RUNS; i++) {
      const round = await expectOk(
        'submit',
        anon.rpc('submit_round', {
          p_token: DEV_TOKEN_DINEIN,
          p_items: [{ item_id: ITEM.lambKebab, quantity: '1', extras: [] }],
        }),
      )
      for (const step of setup) {
        await expectOk(step, carla.rpc(step, { p_round_id: round.round.id }))
      }
      const t0 = performance.now()
      await expectOk(label, carla.rpc(transition, { p_round_id: round.round.id }))
      const dt = performance.now() - t0
      if (i > 0) runs.push(Math.round(dt))
    }
    const med = Math.round(median(runs))
    console.log(`${label}: ${med} ms (median of ${RUNS}, warm-up discarded)`)
    return { name: label, median_ms: med, runs_ms: runs }
  }
  // accepted → preparing → ready is the kitchen's two timed moves.
  const prep = await timedTransition('start_preparation', ['accept_round'], 'start_preparation')
  const ready = await timedTransition(
    'mark_round_ready',
    ['accept_round', 'start_preparation'],
    'mark_round_ready',
  )
  results.kitchen_ticket_updates = { start_preparation: prep, mark_round_ready: ready }
}

/* ── 7. Report query performance ─────────────────────────────────────────── */
results.report_query = {}
for (const period of ['day', 'week', 'month']) {
  results.report_query[period] = await measure(`sales_report_${period}`, () =>
    expectOk(
      'report',
      alice.rpc('get_branch_sales_report', {
        p_restaurant_id: RESTAURANT.blueOlive,
        p_branch_id: BRANCH.downtown,
        p_period: period,
        p_anchor_date: new Date().toISOString().slice(0, 10),
      }),
    ),
  )
}

/* ── 8. Image handling (real Storage round trip through the owner path) ───── */
{
  // The bucket is PRIVATE with image-only MIME limits and a tenant-bound
  // insert policy (contracts/menu-images.md §1–§3): only alice's owner prefix
  // accepts uploads, reads are signed downloads (never getPublicUrl), and the
  // object must follow the path grammar.
  const ITEM_PREFIX = `restaurant/${RESTAURANT.blueOlive}/item/${ITEM.hummus}/`
  const scratchPaths = []
  // Uploads are insert-only (no upsert under the policy posture), so each
  // measured iteration writes its own object; scratch paths are removed after.
  const up = await measure('storage_upload', () => {
    const path = `${ITEM_PREFIX}${crypto.randomUUID()}.png`
    scratchPaths.push(path)
    return expectOk(
      'upload',
      alice.storage
        .from('menu-images')
        .upload(path, new Blob([new Uint8Array(16)], { type: 'image/png' }), {
          contentType: 'image/png',
        }),
    )
  })
  // Read: the item's reference is the read permission (§3) — record the
  // last upload via the real RPC, then measure the app's actual read path
  // (sign + fetch), and clear the reference in teardown afterwards.
  const last = scratchPaths.at(-1)
  const rec = await alice.rpc('set_menu_item_image', { p_item_id: ITEM.hummus, p_image_path: last })
  if (rec.error) throw new Error(`set_menu_item_image failed: ${rec.error.message}`)
  const read = await measure('storage_signed_read', async () => {
    const signed = await alice.storage.from('menu-images').createSignedUrl(last, 600)
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error(`sign failed: ${signed.error?.message ?? 'no url'}`)
    }
    const res = await fetch(signed.data.signedUrl)
    if (!res.ok) throw new Error(`signed read failed: ${res.status}`)
    await res.arrayBuffer()
  })
  // Teardown: clear the item's reference first (restores the fixture), then
  // remove scratch objects through the Storage API only (§5).
  const cleared = await alice.rpc('set_menu_item_image', {
    p_item_id: ITEM.hummus,
    p_image_path: null,
  })
  if (cleared.error) console.warn(`teardown: clear reference failed: ${cleared.error.message}`)
  if (scratchPaths.length > 0) await alice.storage.from('menu-images').remove(scratchPaths)
  results.image_handling = { upload: up, read }
}

/* ── 9. Reconnection: subscribe→SUBSCRIBED→unsubscribe→resubscribe ───────── */
{
  const handshake = async () => {
    const channel = anon.channel('perf-reconnect')
    const t0 = performance.now()
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SUBSCRIBED timeout')), 15000)
      channel
        .on('postgres_changes', { event: '*', schema: 'db', table: 'public.sessions' }, () => {})
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer)
            resolve()
          }
        })
    })
    const dt = Math.round(performance.now() - t0)
    await anon.removeChannel(channel)
    return dt
  }
  const first = await handshake()
  const resub = await handshake()
  results.reconnection = { first_handshake_ms: first, resubscribe_ms: resub }
  console.log(`reconnection: first ${first} ms, resubscribe ${resub} ms`)
}

/* ── artifact ─────────────────────────────────────────────────────────────── */
const artifact = {
  generated_at: new Date().toISOString(),
  environment: {
    project_url: url,
    fixture: 'seed.sql deterministic fixture (2 restaurants, 14 items, 4 open sessions)',
    runs_per_area: RUNS,
    warmup_discarded: true,
  },
  budgets: {
    menu_loading_ms: 1500,
    round_submission_ms: 800,
    source: 'spec 016 FR-002 (§26 customer-path priority)',
  },
  results,
}
const fs = await import('node:fs')
const out = 'specs/016-performance-and-reliability/baselines.json'
fs.writeFileSync(out, JSON.stringify(artifact, null, 2) + '\n')
console.log(`\nartifact written: ${out}`)
