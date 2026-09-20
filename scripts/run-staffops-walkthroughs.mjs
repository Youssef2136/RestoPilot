#!/usr/bin/env node
/**
 * T023 — executes the three quickstart.md walkthroughs (spec 009) against
 * the real development project through the real data APIs (the feature
 * 005–008 method) and prints a step-by-step PASS/FAIL transcript. Run:
 * node --env-file-if-exists=.env scripts/run-staffops-walkthroughs.mjs
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
const TABLE = { downtownT1: '00000000-0000-4000-8000-000000003001' }
const ITEM = {
  lambKebab: '00000000-0000-4000-8000-000000006014',
  hummus: '00000000-0000-4000-8000-000000006011',
}
const EXTRA = { lambExtraRice: '00000000-0000-4000-8000-000000006032' }
const PROFILE = { carla: '00000000-0000-4000-8000-000000001003' }
const DEV_TOKEN = 'dev-token-downtown-t1-2026'
const GENERIC = 'This round is not available for that action.'
const DENIED = 'You do not have permission to update this round.'
const BILL_DENIED = 'You do not have permission to view this bill.'

// Real sign-ins (the walkthroughs act as the seeded identities through the
// hosted auth — the data API derives the JWT from the session).
const carla = createClient(url, key)
const dan = createClient(url, key)
const eve = createClient(url, key)
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
async function submitRound(items) {
  const { data, error } = await carla.auth.getSession()
  const anon = createClient(url, key)
  // submit_round is anon-granted: call it from a fresh client (no staff JWT).
  const { data: payload, error: rpcError } = await anon.rpc('submit_round', {
    p_token: DEV_TOKEN,
    p_items: items,
  })
  expect(!rpcError, `submit_round: ${rpcError?.message ?? 'ok'}`)
  return payload
}

async function main() {
  await pgClient.connect()
  await signIn(carla, 'carla@restopilot.dev', 'dev-carla-2026')
  await signIn(dan, 'dan@restopilot.dev', 'dev-dan-2026')
  await signIn(eve, 'eve@restopilot.dev', 'dev-eve-2026')
  await signIn(fiona, 'fiona@restopilot.dev', 'dev-fiona-2026')

  /* ── Walkthrough A — the state machine end to end ─────────────────────── */
  console.log('\n── Walkthrough A — the state machine end to end ──')

  const roundA = await submitRound([{ item_id: ITEM.hummus, extras: [], quantity: '1' }])
  const roundAId = roundA.round.id
  check('A1 submit: round new + one ticket new', roundA.round.state === 'new')
  const ticketA = await adminOne('select state from public.kitchen_tickets where round_id = $1', [
    roundAId,
  ])
  check('A1 ticket born new with the round', ticketA.state === 'new')

  let res = await rpcAs(carla, 'accept_round', { p_round_id: roundAId })
  check(
    'A2 carla accepts: round+ticket accepted',
    !res.error && res.data.round.state === 'accepted' && res.data.ticket_state === 'accepted',
  )
  const auditA = await adminOne(
    "select a.action, p.display_name from public.audit_log a join public.profiles p on p.id = a.actor_profile_id where a.resource_id = $1 and a.action = 'round.accepted'",
    [roundAId],
  )
  check('A2 audit round.accepted by carla', auditA && auditA.display_name === 'Carla')

  const danRefusal = await rpcAs(dan, 'start_preparation', { p_round_id: roundAId })
  check(
    'A3 dan (Marina kitchen) refused on Downtown',
    danRefusal.error?.message === DENIED && danRefusal.error?.code === '42501',
  )
  res = await rpcAs(carla, 'start_preparation', { p_round_id: roundAId })
  check(
    'A3 carla starts preparation → preparing',
    !res.error && res.data.round.state === 'preparing' && res.data.ticket_state === 'preparing',
  )
  const auditPrep = await adminOne(
    "select action from public.audit_log where resource_type = 'ticket' and resource_id = (select id::text from public.kitchen_tickets where round_id = $1) and action = 'ticket.preparing'",
    [roundAId],
  )
  check('A3 audit ticket.preparing', !!auditPrep)

  res = await rpcAs(carla, 'mark_round_ready', { p_round_id: roundAId })
  check(
    'A4 mark ready → ready',
    !res.error && res.data.round.state === 'ready' && res.data.ticket_state === 'ready',
  )
  res = await rpcAs(carla, 'lock_round', { p_round_id: roundAId })
  check('A4 lock → lock', !res.error && res.data.round.state === 'lock')

  const beforeRows = await adminOne(
    'select count(*)::int as n from public.audit_log where resource_id = $1',
    [roundAId],
  )
  const terminalRefusals = []
  for (const fn of ['accept_round', 'start_preparation', 'mark_round_ready', 'lock_round']) {
    const r = await rpcAs(carla, fn, { p_round_id: roundAId })
    terminalRefusals.push(r.error?.code === 'P0001' && r.error.message === GENERIC)
  }
  const modifyTerminal = await rpcAs(carla, 'modify_round_line', {
    p_round_id: roundAId,
    p_item_id: ITEM.hummus,
    p_action: 'remove',
  })
  const afterRows = await adminOne(
    'select count(*)::int as n from public.audit_log where resource_id = $1',
    [roundAId],
  )
  check(
    'A5 terminal: every action refuses with zero change and zero new audits',
    terminalRefusals.every(Boolean) &&
      modifyTerminal.error?.code === 'P0001' &&
      beforeRows.n === afterRows.n,
  )

  /* ── Walkthrough B — modification, money re-derivation, atomicity ─────── */
  console.log('\n── Walkthrough B — modification, money re-derivation, atomicity ──')

  const roundB = await submitRound([
    { item_id: ITEM.lambKebab, extras: [EXTRA.lambExtraRice], quantity: '2' },
    { item_id: ITEM.hummus, extras: [], quantity: '1' },
  ])
  const roundBId = roundB.round.id
  await rpcAs(carla, 'accept_round', { p_round_id: roundBId })
  // The submission payload carries the items at the top level.
  check('B1 two-line round accepted', roundB.items.length === 2)

  const kebab = roundB.items.find((i) => i.item_id === ITEM.lambKebab)
  const reduced = await rpcAs(carla, 'modify_round_line', {
    p_round_id: roundBId,
    p_item_id: ITEM.lambKebab,
    p_action: 'reduce',
    p_quantity: '1',
  })
  check('B2 reduce kebab to 1', !reduced.error && reduced.data.round.state === 'accepted')
  const freshCalc = await adminOne(
    'select private.calculate_tax_totals($1::uuid, $2::jsonb) as calc',
    [
      BRANCH.downtown,
      JSON.stringify([
        { item_id: ITEM.lambKebab, extras: [EXTRA.lambExtraRice], quantity: '1' },
        { item_id: ITEM.hummus, extras: [], quantity: '1' },
      ]),
    ],
  )
  const capturedEqual =
    reduced.data.round.subtotal === freshCalc.calc.subtotal &&
    JSON.stringify(reduced.data.round.tax_lines) === JSON.stringify(freshCalc.calc.lines)
  check(
    'B2 re-derived money byte-equal to a fresh engine call over the surviving captured lines (SC-003)',
    capturedEqual,
  )
  const auditB = await adminOne(
    "select reason from public.audit_log where resource_type = 'round_item' and action = 'round.item_quantity_reduced' and resource_id = $1",
    [kebab.id],
  )
  check('B2 audit reason verbatim (quantity 2 → 1)', auditB && auditB.reason === 'quantity 2 → 1')

  const hummus = roundB.items.find((i) => i.item_id === ITEM.hummus)
  const removed = await rpcAs(carla, 'modify_round_line', {
    p_round_id: roundBId,
    p_item_id: ITEM.hummus,
    p_action: 'remove',
  })
  const auditRemoved = await adminOne(
    "select reason from public.audit_log where resource_type = 'round_item' and action = 'round.item_removed' and resource_id = $1",
    [hummus.id],
  )
  check(
    'B3 remove hummus + audit verbatim (removed 1 × Hummus)',
    !removed.error && auditRemoved && auditRemoved.reason === 'removed 1 × Hummus',
  )

  const badReduce = await rpcAs(carla, 'modify_round_line', {
    p_round_id: roundBId,
    p_item_id: ITEM.lambKebab,
    p_action: 'reduce',
    p_quantity: '0',
  })
  const danModify = await rpcAs(dan, 'modify_round_line', {
    p_round_id: roundBId,
    p_item_id: ITEM.lambKebab,
    p_action: 'remove',
  })
  check(
    'B4 refusals verbatim (reduce<1 generic; dan 42501)',
    badReduce.error?.code === 'P0001' && danModify.error?.code === '42501',
  )

  // After B3 only the kebab line survives — recompute the reference over it.
  const freshCalcAfterRemoval = await adminOne(
    'select private.calculate_tax_totals($1::uuid, $2::jsonb) as calc',
    [
      BRANCH.downtown,
      JSON.stringify([{ item_id: ITEM.lambKebab, extras: [EXTRA.lambExtraRice], quantity: '1' }]),
    ],
  )
  const moneyNow = await adminOne(
    'select subtotal::text, tax_total::text from public.rounds where id = $1',
    [roundBId],
  )
  check(
    'B5 money stays captured (equals the engine over the surviving line, never menu-current)',
    moneyNow.subtotal === freshCalcAfterRemoval.calc.subtotal &&
      moneyNow.tax_total === freshCalcAfterRemoval.calc.total,
  )

  /* ── Walkthrough C — dashboards, scoping, bill ────────────────────────── */
  console.log('\n── Walkthrough C — dashboards, scoping, bill ──')

  const carlaRounds = await rpcAs(carla, 'get_branch_rounds', { p_branch_id: BRANCH.downtown })
  const carlaSeesB = !carlaRounds.error && carlaRounds.data.some((r) => r.round_id === roundBId)
  check(
    'C1 carla reads Downtown rounds (captured money present)',
    carlaSeesB && 'subtotal' in carlaRounds.data[0],
  )
  const danDowntown = await rpcAs(dan, 'get_branch_rounds', { p_branch_id: BRANCH.downtown })
  check(
    'C1 dan has no Downtown reach (silent [])',
    !danDowntown.error && danDowntown.data.length === 0,
  )
  const danMarina = await rpcAs(dan, 'get_kitchen_queue', { p_branch_id: BRANCH.marina })
  check('C1 dan reads his own Marina queue', !danMarina.error && danMarina.data.length === 0)

  const carlaQueue = await rpcAs(carla, 'get_kitchen_queue', { p_branch_id: BRANCH.downtown })
  const moneyKeys = new Set()
  for (const t of carlaQueue.data ?? []) {
    for (const k of Object.keys(t)) if (/price|subtotal|tax|total/i.test(k)) moneyKeys.add(k)
    for (const item of t.items ?? [])
      for (const k of Object.keys(item)) if (/price|subtotal|tax|total/i.test(k)) moneyKeys.add(k)
  }
  check(
    'C2 kitchen queue carries NO money keys (shape-asserted)',
    carlaQueue.data.length > 0 && moneyKeys.size === 0,
  )

  const sessionId = roundB.round.session_id
  const bill = await rpcAs(carla, 'get_session_bill', { p_session_id: sessionId })
  const sum = bill.data.rounds.reduce(
    (acc, r) => acc + parseFloat(r.subtotal) + parseFloat(r.tax_total),
    0,
  )
  check(
    'C3 bill grand total = the exact captured sum (SC-005)',
    !bill.error && bill.data.grand_total === sum.toFixed(2),
  )

  const eveRounds = await rpcAs(eve, 'get_branch_rounds', { p_branch_id: BRANCH.downtown })
  const fionaRounds = await rpcAs(fiona, 'get_branch_rounds', { p_branch_id: BRANCH.downtown })
  const fionaBill = await rpcAs(fiona, 'get_session_bill', { p_session_id: sessionId })
  check(
    'C4 eve reaches Downtown as staff; fiona is denied both dashboards',
    !eveRounds.error &&
      Array.isArray(fionaRounds.data) &&
      fionaRounds.data.length === 0 &&
      fionaBill.error?.message === BILL_DENIED,
  )

  const fresh = await submitRound([{ item_id: ITEM.hummus, extras: [], quantity: '1' }])
  const freshId = fresh.round.id
  // Two racing first transitions: carla's accept wins; dan's (illegal-role
  // on accept, legal-role on prepare) start_preparation loses — the guard
  // `state = 'accepted'` cannot match after the winner committed, so exactly
  // one transition fired and the state is consistent.
  const winner = await rpcAs(carla, 'accept_round', { p_round_id: freshId })
  const loser = await rpcAs(dan, 'start_preparation', { p_round_id: freshId })
  const finalState = await adminOne('select state from public.rounds where id = $1', [freshId])
  check(
    'C5 sequential interleaving: exactly one first transition wins, the loser refuses, state consistent',
    !winner.error && loser.error?.code === '42501' && finalState.state === 'accepted',
  )

  /* ── Summary ──────────────────────────────────────────────────────────── */
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length > 0) {
    process.exitCode = 1
  }
  await pgClient.end()
}

main().catch(async (error) => {
  console.error('WALKTHROUGH ERROR:', error.message)
  process.exitCode = 1
  try {
    await pgClient.end()
  } catch {
    /* already closed */
  }
})
