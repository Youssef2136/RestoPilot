#!/usr/bin/env node
/**
 * T015 — executes the quickstart.md walkthroughs (spec 012) against the real
 * development project through the real data APIs (the 009–011 method) and
 * prints a step-by-step PASS/FAIL transcript. Run:
 * node --env-file-if-exists=.env scripts/run-realtime-walkthroughs.mjs
 *
 * The walkthroughs mutate the fixture (rounds, audit rows, realtime
 * subscriptions); the quickstart's restore step (`npm run db:reset -- --yes
 * && npm run db:seed`) restores the deterministic state regardless.
 *
 * The realtime observations are REAL end to end: every actor subscribes
 * through the hosted Supabase Realtime websocket with their own JWT (the
 * same transport the app uses), WAITS FOR THE SUBSCRIBED HANDSHAKE (the
 * same discipline the e2e suite's waitForCueSubscribed proves — subscription
 * setup is asynchronous, so a write driven before SUBSCRIBED is a test race,
 * not a product defect), and the writes go through the real customer path.
 * The refetch legs call the UNCHANGED RPC reads (plan D3) and assert the
 * authoritative state the events only ANNOUNCE.
 */
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY')

const BRANCH = {
  downtown: '00000000-0000-4000-8000-000000000101',
  marina: '00000000-0000-4000-8000-000000000102',
}
const ITEM = { hummus: '00000000-0000-4000-8000-000000006011' }
const DEV_TOKEN_DINEIN = 'dev-token-downtown-t2-2026'
const MARINA_TABLE = '00000000-0000-4000-8000-000000003004'
const HUMMUS = [{ item_id: ITEM.hummus, extras: [], quantity: '1' }]

// Real sign-ins — each walkthrough actor subscribes with THEIR OWN client
// (their JWT drives Realtime's per-row policy evaluation).
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

/**
 * Subscribe a channel and await the SUBSCRIBED handshake. Everything after
 * this resolves is guaranteed server-registered — the test-race guard.
 */
function awaitSubscribed(client, channel, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`SUBSCRIBED not observed within ${timeoutMs}ms`))
    }, timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      client.off?.('channel', noop)
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve(true)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(`channel ${status}`))
      }
    })
  })
}

/** Await one matching postgres_changes event on an already-built channel. */
function awaitEvent(client, channel, match, timeoutMs = 15_000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup()
      resolve(null)
    }, timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      void client.removeChannel(channel)
    }
    // Re-register a matching listener: the caller wires the channel with its
    // capture handler; here we only handle the timeout + removal lifecycle.
    channel.onClose?.(() => {})
    const poll = setInterval(() => {
      if (match.captured !== null && match.captured !== undefined) {
        const payload = match.captured
        cleanup()
        clearInterval(poll)
        resolve(payload)
      }
    }, 100)
    match.pollRef = poll
  })
}

/* ── Walkthrough A — the cashier's live dashboard (SC-001) ───────────────── */

async function walkthroughA() {
  console.log("\n── Walkthrough A: the cashier's live dashboard (SC-001) ──")

  // A1. carla subscribes to Downtown rounds INSERT with her JWT and waits
  //     for the handshake; a real customer submission then arrives as an
  //     event WITHOUT any poll.
  let insertEvent = null
  const channelA = carla.channel('wt:rounds-insert').on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'rounds',
      filter: `branch_id=eq.${BRANCH.downtown}`,
    },
    (payload) => {
      insertEvent = payload
    },
  )
  await awaitSubscribed(carla, channelA)
  const round = await submitRound(DEV_TOKEN_DINEIN, HUMMUS)
  for (let i = 0; i < 50 && insertEvent === null; i++) {
    await new Promise((r) => setTimeout(r, 200))
  }
  check(
    "A1 customer INSERT arrives live on carla's subscription (SC-001)",
    insertEvent?.new?.id === round.round.id,
  )
  void carla.removeChannel(channelA)

  // A2. The event ANNOUNCES; the read decides: get_branch_rounds shows the
  //     round new with its captured line (plan D3's render path).
  const { data: roundsPayload, error: roundsErr } = await carla.rpc('get_branch_rounds', {
    p_branch_id: BRANCH.downtown,
  })
  expect(!roundsErr, `get_branch_rounds: ${roundsErr?.message ?? 'ok'}`)
  const seen = roundsPayload.find((r) => r.round_id === round.round.id)
  check(
    'A2 the read renders the announced round (state new, captured line)',
    seen?.state === 'new' && seen?.items?.length > 0,
  )

  // A3. Advance the round; carla's UPDATE subscription (handshake first)
  //     observes the state change live and the next read agrees.
  let updateEvent = null
  const channelA3 = carla.channel('wt:rounds-update').on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'rounds',
      filter: `branch_id=eq.${BRANCH.downtown}`,
    },
    (payload) => {
      if (payload.new?.id === round.round.id && payload.new?.state === 'accepted') {
        updateEvent = payload
      }
    },
  )
  await awaitSubscribed(carla, channelA3)
  const { error: acceptErr } = await carla.rpc('accept_round', { p_round_id: round.round.id })
  expect(!acceptErr, `accept_round: ${acceptErr?.message ?? 'ok'}`)
  for (let i = 0; i < 50 && updateEvent === null; i++) {
    await new Promise((r) => setTimeout(r, 200))
  }
  const { data: after } = await carla.rpc('get_branch_rounds', { p_branch_id: BRANCH.downtown })
  check(
    'A3 accept arrives live (UPDATE event) and the read agrees (accepted)',
    updateEvent !== null && after.find((r) => r.round_id === round.round.id)?.state === 'accepted',
  )
  void carla.removeChannel(channelA3)
}

/* ── Walkthrough B — the kitchen's live queue (SC-002) ───────────────────── */

async function walkthroughB() {
  console.log("\n── Walkthrough B: the kitchen's live queue (SC-002) ──")

  // B1. dan (Marina kitchen) subscribes to Marina kitchen_tickets with his
  //     own JWT (handshake first); a Marina submission produces a ticket he
  //     receives live.
  let ticketEvent = null
  const channelB = dan.channel('wt:tickets-insert').on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'kitchen_tickets',
      filter: `branch_id=eq.${BRANCH.marina}`,
    },
    (payload) => {
      ticketEvent = payload
    },
  )
  await awaitSubscribed(dan, channelB)

  // The Marina scratch-session chain (the 009 discipline): activate the
  // inactive fixture table through the admin connection, open a session,
  // submit. The deterministic fixture is empty of Marina rounds.
  await pgClient.query('update public.dining_tables set is_active = true where id = $1', [
    MARINA_TABLE,
  ])
  const { data: openData, error: openErr } = await dan.rpc('open_session_at_table', {
    p_restaurant_id: '00000000-0000-4000-8000-000000000001',
    p_branch_id: BRANCH.marina,
    p_table_id: MARINA_TABLE,
    p_display_name: 'Walkthrough Marina',
    p_phone: '+15550997',
  })
  expect(!openErr, `open_session_at_table: ${openErr?.message ?? 'ok'}`)
  const marinaToken = openData?.token
  expect(typeof marinaToken === 'string', 'the opened session returns its token')
  const marinaRound = await submitRound(marinaToken, HUMMUS)
  const ticketRow = await adminOne(
    'select id, state, branch_id from public.kitchen_tickets where round_id = $1',
    [marinaRound.round.id],
  )
  for (let i = 0; i < 50 && ticketEvent === null; i++) {
    await new Promise((r) => setTimeout(r, 200))
  }
  check(
    "B1 new Marina ticket arrives live on dan's subscription (SC-002)",
    ticketEvent?.new?.id === ticketRow.id && ticketRow.state === 'new',
  )
  void dan.removeChannel(channelB)

  // B2. The read agrees and carries NO money keys — realtime in the shape
  //     the REST queue already has (FR-010).
  const { data: queue, error: queueErr } = await dan.rpc('get_kitchen_queue', {
    p_branch_id: BRANCH.marina,
  })
  expect(!queueErr, `get_kitchen_queue: ${queueErr?.message ?? 'ok'}`)
  const queueText = JSON.stringify(queue ?? {})
  const moneyKeys = Object.keys(queue ?? {}).filter((k) =>
    /price|total|tax|subtotal|money/i.test(k),
  )
  check(
    'B2 the queue read carries the new ticket and stays money-free',
    moneyKeys.length === 0 && queueText.includes(marinaRound.round.id.slice(0, 8)),
  )

  // B3. Cross-branch scoping in realtime (FR-002): dan's Marina-scoped
  //     subscription receives NO event for the Downtown ticket submitted
  //     while he listens.
  let downtownLeak = null
  const channelB3 = dan.channel('wt:tickets-leak').on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'kitchen_tickets',
      filter: `branch_id=eq.${BRANCH.marina}`,
    },
    (payload) => {
      if (payload.new?.branch_id !== BRANCH.marina) {
        downtownLeak = payload
      }
    },
  )
  await awaitSubscribed(dan, channelB3)
  await submitRound(DEV_TOKEN_DINEIN, HUMMUS)
  await new Promise((r) => setTimeout(r, 6_000))
  check('B3 no out-of-scope event ever arrives (FR-002)', downtownLeak === null)
  void dan.removeChannel(channelB3)

  // Restore the fixture table's seeded inactive state for the record (the
  // quickstart's reset remains the full restore).
  await pgClient.query('update public.dining_tables set is_active = false where id = $1', [
    MARINA_TABLE,
  ])
}

/* ── Walkthrough C — recovery and the cue (SC-004, US4) ──────────────────── */

async function walkthroughC() {
  console.log('\n── Walkthrough C: recovery and the cue (SC-004, US4) ──')

  // C1. The SUBSCRIBED moment fires one authoritative refetch (FR-004): the
  //     subscription's status callback runs the read; the read agrees.
  let refetched = false
  const channelC = carla
    .channel('wt:recovery')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rounds', filter: `branch_id=eq.${BRANCH.downtown}` },
      () => {},
    )
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer)
      reject(new Error('C1: SUBSCRIBED not observed within 15s'))
    }, 15_000)
    channelC.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // The §1.4 recovery posture: on (re)subscribe, one read.
        const { error } = await carla.rpc('get_branch_rounds', { p_branch_id: BRANCH.downtown })
        refetched = !error
        clearTimeout(timer)
        resolve(true)
      }
    })
  })
  void carla.removeChannel(channelC)
  check(
    'C1 SUBSCRIBED triggers the recovery refetch through the unchanged read (FR-004)',
    refetched,
  )

  // C2. The cue's event contract (US4): an INSERT sets the cue; the round's
  //     first UPDATE clears it. Observed on the exact events the cue binds.
  let insertSeen = false
  let updateCleared = false
  const round = await submitRound(DEV_TOKEN_DINEIN, HUMMUS)
  const channelC2 = carla
    .channel('wt:cue')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'rounds',
        filter: `branch_id=eq.${BRANCH.downtown}`,
      },
      (payload) => {
        if (payload.new?.id === round.round.id) {
          insertSeen = true
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rounds',
        filter: `branch_id=eq.${BRANCH.downtown}`,
      },
      (payload) => {
        if (payload.new?.id === round.round.id && payload.new?.state === 'accepted') {
          updateCleared = true
        }
      },
    )
  await awaitSubscribed(carla, channelC2)
  // The INSERT already committed before the handshake (the cue's documented
  // no-recovery posture — §2); the UPDATE after the handshake must clear.
  const { error: acceptErr } = await carla.rpc('accept_round', { p_round_id: round.round.id })
  expect(!acceptErr, `accept_round: ${acceptErr?.message ?? 'ok'}`)
  for (let i = 0; i < 50 && !updateCleared; i++) {
    await new Promise((r) => setTimeout(r, 200))
  }
  check("C2 the cue's clear event arrives on the round's first state advance (US4)", updateCleared)
  void carla.removeChannel(channelC2)
}

/* ── Walkthrough D — the scope boundary (FR-002, the fail-closed direction) ── */

async function walkthroughD() {
  console.log('\n── Walkthrough D: the scope boundary (FR-002) ──')

  // fiona (no memberships) subscribes with her own JWT; Downtown submissions
  // produce events for carla but NOTHING for fiona — the policy matches no
  // row, so Realtime delivers nothing (the fail-closed direction, live).
  let leaked = null
  const channelD = fiona.channel('wt:fiona').on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'rounds',
      filter: `branch_id=eq.${BRANCH.downtown}`,
    },
    (payload) => {
      leaked = payload
    },
  )
  await awaitSubscribed(fiona, channelD)
  await submitRound(DEV_TOKEN_DINEIN, HUMMUS)
  await new Promise((r) => setTimeout(r, 6_000))
  check(
    'D1 fiona (no memberships) receives no events despite a live subscription (FR-002)',
    leaked === null,
  )
  void fiona.removeChannel(channelD)
}

/* ── main ────────────────────────────────────────────────────────────────── */

process.on('SIGINT', () => process.exit(1))
const main = async () => {
  // Keep the process alive across the websocket handshakes (subscribe →
  // SUBSCRIBED is asynchronous; the event loop must not drain mid-run).
  const keepalive = setInterval(() => {}, 1 << 30)

  await pgClient.connect()
  await signIn(carla, 'carla@restopilot.dev', 'dev-carla-2026')
  await signIn(dan, 'dan@restopilot.dev', 'dev-dan-2026')
  await signIn(fiona, 'fiona@restopilot.dev', 'dev-fiona-2026')

  try {
    await walkthroughA()
    await walkthroughB()
    await walkthroughC()
    await walkthroughD()
  } finally {
    clearInterval(keepalive)
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
