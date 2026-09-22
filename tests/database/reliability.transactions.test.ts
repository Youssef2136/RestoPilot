import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, inTransaction, type DbClient } from './helpers/db'
import {
  authUserIds,
  branchIds,
  devSessionTokens,
  diningTableIds,
  menuItemIds,
  restaurantIds,
  sessionIds,
} from './helpers/fixtures'

/**
 * Reliability: transactional integrity under failure (spec 016 T007; §26
 * reliability journeys; FR-006). Three failure classes every launch
 * surface must survive, each proven against the real RPCs:
 *
 * 1. NETWORK INTERRUPTION — a submission whose transport dies mid-flight.
 *    A pg ROLLBACK of an in-flight submit_round stands in for the dropped
 *    connection: the function is a single-statement definer call, so the
 *    aborted statement leaves ZERO partial rows (rounds, items, extras,
 *    tickets) — the customer sees a clean failure and may retry freely.
 *
 * 2. STALE TAB — a customer keeps a token past the session's close (the
 *    tab open across a staff close, a refresh after close). All three
 *    token surfaces refuse with the single indistinguishable refusal, and
 *    the refusal writes nothing.
 *
 * 3. CONCURRENT CASHIERS — two staff advance the same round. The
 *    transitions are guarded updates (research §1), so the second mover
 *    receives the generic state refusal with zero change: single-winner
 *    semantics without distributed locking, exactly the posture the 008
 *    lifecycle suite proved sequentially and the phase-12 note recorded
 *    for this database's concurrency class.
 */
const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

/** Row deltas across the ordering write-set (the 008 partial-write probe). */
const ROW_COUNTS_SQL = `select
  (select count(*) from public.rounds)::int as rounds,
  (select count(*) from public.round_items)::int as items,
  (select count(*) from public.round_item_extras)::int as extras,
  (select count(*) from public.kitchen_tickets)::int as tickets`

const GENERIC = 'This round is not available for that action.'
const SESSION_GONE = 'This session is no longer available.'

const hummusSelection = [{ item_id: menuItemIds.hummus, extras: [], quantity: '1' }]

/** Act as the identity for the remainder of the current transaction. */
async function asIdentity(authUserId: string): Promise<void> {
  await client.query('set local role authenticated')
  await client.query('select set_config($1, $2, true)', [
    'request.jwt.claims',
    JSON.stringify({ role: 'authenticated', sub: authUserId }),
  ])
}

describe('reliability: transactions under failure (T007)', () => {
  it('network interruption: an aborted submission leaves zero partial rows (FR-006)', async () => {
    await inTransaction(client, async () => {
      const before = await client.query(ROW_COUNTS_SQL)
      await client.query('savepoint dropped_connection')
      try {
        await client.query('select public.submit_round($1, $2)', [
          devSessionTokens.downtownT1,
          JSON.stringify(hummusSelection),
        ])
        // The transport dies here: abort the in-flight statement's work.
        await client.query('rollback to savepoint dropped_connection')
      } catch {
        await client.query('rollback to savepoint dropped_connection')
      }
      const after = await client.query(ROW_COUNTS_SQL)
      expect(after.rows[0].rounds).toBe(before.rows[0].rounds)
      expect(after.rows[0].items).toBe(before.rows[0].items)
      expect(after.rows[0].extras).toBe(before.rows[0].extras)
      expect(after.rows[0].tickets).toBe(before.rows[0].tickets)
      // And the session itself is untouched — a retry is a clean slate.
      const state = await client.query<{ status: string }>(
        'select status from public.sessions where id = $1',
        [sessionIds.downtownT1],
      )
      expect(state.rows[0].status).toBe('open')
    })
  })

  it('stale tab: a closed session refuses all three token surfaces, then a fresh entry works (FR-013/FR-014)', async () => {
    await inTransaction(client, async () => {
      // Open a dedicated session and close it by staff hand — the stale-tab
      // setup. (The seeded sessions stay pristine for the other suites.)
      await client.query('set local role anon')
      const opened = await client.query<{
        p: { session: { id: string }; token: string }
      }>('select public.open_session_at_table($1, $2, $3, $4, $5) as p', [
        restaurantIds.blueOlive,
        branchIds.downtown,
        diningTableIds.downtownT3,
        'Stale Tab',
        '+15557770901',
      ])
      const staleToken = opened.rows[0].p.token

      await asIdentity(authUserIds.carla)
      await client.query('select public.close_session($1)', [opened.rows[0].p.session.id])

      // The stale tab tries everything: reads, submission. One refusal.
      await client.query('set local role anon')
      for (const [sql, values] of [
        ['select public.get_session_context($1)', [staleToken]],
        ['select public.get_session_menu($1)', [staleToken]],
        ['select public.submit_round($1, $2)', [staleToken, JSON.stringify(hummusSelection)]],
      ] as const) {
        await client.query('savepoint stale_probe')
        try {
          await client.query(sql, values)
          expect.unreachable(`expected refusal for ${sql}`)
        } catch (error) {
          await client.query('rollback to savepoint stale_probe')
          const pgError = error as { message?: string }
          expect(pgError.message).toBe(SESSION_GONE)
        }
      }
      // The journey: the customer's entry form (re-)opens a NEW session at
      // the freed table; the stale tab's replacement recovers normally.
      const fresh = await client.query<{ p: { session: { status: string } } }>(
        'select public.open_session_at_table($1, $2, $3, $4, $5) as p',
        [
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Fresh Tab',
          '+15557770902',
        ],
      )
      expect(fresh.rows[0].p.session.status).toBe('open')
    })
  })

  it('concurrent cashiers: the second transition wins nothing — guarded-update single-winner (Race 7 class)', async () => {
    await inTransaction(client, async () => {
      // Fresh round, accepted once: both "cashiers" now race the same move.
      await client.query('set local role anon')
      const submitted = await client.query<{ p: { round: { id: string } } }>(
        'select public.submit_round($1, $2) as p',
        [devSessionTokens.downtownT1, JSON.stringify(hummusSelection)],
      )
      const roundId = submitted.rows[0].p.round.id
      await asIdentity(authUserIds.carla)
      await client.query('select public.accept_round($1)', [roundId])

      // Cashier A (carla) starts preparation.
      await client.query('select public.start_preparation($1)', [roundId])
      const midState = await client.query<{ state: string }>(
        'select state from public.rounds where id = $1',
        [roundId],
      )
      expect(midState.rows[0].state).toBe('preparing')

      // Cashier B (bob, the branch manager — same staff matrix) fires the
      // SAME transition one beat later: guarded update, zero rows matched,
      // the generic refusal, state and ticket untouched.
      await asIdentity(authUserIds.bob)
      const before = await client.query<{ state: string; ticket: string }>(
        'select r.state, t.state as ticket from public.rounds r join public.kitchen_tickets t on t.round_id = r.id where r.id = $1',
        [roundId],
      )
      await client.query('savepoint race_probe')
      try {
        await client.query('select public.start_preparation($1)', [roundId])
        expect.unreachable('expected the second mover to be refused')
      } catch (error) {
        await client.query('rollback to savepoint race_probe')
        const pgError = error as { code?: string; message?: string }
        expect(pgError.code).toBe('P0001')
        expect(pgError.message).toBe(GENERIC)
      }
      const after = await client.query<{ state: string; ticket: string }>(
        'select r.state, t.state as ticket from public.rounds r join public.kitchen_tickets t on t.round_id = r.id where r.id = $1',
        [roundId],
      )
      expect(after.rows[0].state).toBe(before.rows[0].state)
      expect(after.rows[0].ticket).toBe(before.rows[0].ticket)
    })
  })
})
