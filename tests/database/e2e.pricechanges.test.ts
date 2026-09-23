import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient } from './helpers/db'
import {
  authUserIds,
  branchIds,
  diningTableIds,
  menuItemIds,
  restaurantIds,
} from './helpers/fixtures'

/**
 * The §27 price-change timings (spec 017 T006; plan N2/N3):
 *
 *   N2 — an OLD session's existing rounds keep their captured unit_price
 *        while its NEXT round after the change uses the new price.
 *   N3 — a NEW session's next round uses the new price.
 *
 * Every step drives the REAL customer chain (open_session_at_table →
 * submit_round as anon) and the REAL owner mutation (update_menu_item as
 * the seeded owner) — the same surfaces the journey exercises, at the data
 * layer. The capture rule is the 008/006 posture: a round's money is the
 * deterministic snapshot at submission, never a recomputation.
 *
 * Each `it` runs inside ONE always-rolled-back transaction on the shared
 * development database (the house discipline); identities switch inline
 * through `asAnon`/`asUser`.
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

/** One plain legal selection: the Downtown hummus, quantity 1, no extras. */
const hummusSelection = [{ item_id: menuItemIds.hummus, extras: [], quantity: '1' }]

/**
 * Inline identity switches (channel.rpc.test.ts's discipline): the whole
 * `it` runs inside ONE always-rolled-back transaction, so the identity
 * helpers here only flip the role and claims — they never open their own
 * transaction (a nested begin/rollback would discard the opened session).
 */
async function actAsAnon(): Promise<void> {
  await client.query('set local role anon')
  await client.query('select set_config($1, $2, true)', [
    'request.jwt.claims',
    JSON.stringify({ role: 'anon' }),
  ])
}

async function actAsOwner(): Promise<void> {
  await client.query('reset role')
}

/** Act as the seeded Blue Olive owner for the remainder of the transaction. */
async function actAsAlice(): Promise<void> {
  await client.query('set local role authenticated')
  await client.query('select set_config($1, $2, true)', [
    'request.jwt.claims',
    JSON.stringify({ role: 'authenticated', sub: authUserIds.alice }),
  ])
}

/** Enter a fresh dine-in session at the given table as anon (returns token). */
async function openAtTable(tableId: string): Promise<string> {
  await actAsAnon()
  const open = await client.query<{ p: { token: string } }>(
    'select public.open_session_at_table($1, $2, $3, $4, $5) as p',
    [restaurantIds.blueOlive, branchIds.downtown, tableId, 'Price Probe', '+15550911'],
  )
  return open.rows[0]!.p.token
}

/** Submit one round on the token as anon; returns the round's id. */
async function submit(token: string): Promise<string> {
  await actAsAnon()
  const sub = await client.query<{ p: { round: { id: string } } }>(
    'select public.submit_round($1, $2) as p',
    [token, JSON.stringify(hummusSelection)],
  )
  return sub.rows[0]!.p.round.id
}

/** Owner changes the hummus price (the REAL update_menu_item surface). */
async function setHummusPrice(price: string): Promise<void> {
  await actAsAlice()
  await client.query('select public.update_menu_item($1, $2, $3, $4)', [
    menuItemIds.hummus,
    'Hummus',
    null,
    price,
  ])
}

/** The round's captured unit prices, read back as the table owner. */
async function capturedPrices(roundId: string): Promise<string[]> {
  await actAsOwner()
  const res = await client.query<{ unit_price: string }>(
    `select ri.unit_price::text
     from public.round_items ri
     where ri.round_id = $1
     order by ri.created_at, ri.id`,
    [roundId],
  )
  return res.rows.map((r) => r.unit_price)
}

describe('the §27 price-change timings (T006; plan N2/N3)', () => {
  it(
    'an old session keeps its captured price and its next round uses the new one (N2)',
    { timeout: 30_000 },
    async () => {
      await client.query('begin')
      try {
        const oldSession = { token: await openAtTable(diningTableIds.downtownT3) }

        // Round 1 at the CURRENT price.
        const round1 = await submit(oldSession.token)
        expect(await capturedPrices(round1)).toEqual(['6.50'])

        // The owner changes the price while the old session stays open.
        await setHummusPrice('9.25')

        // The old session's existing round keeps its captured unit price.
        expect(await capturedPrices(round1)).toEqual(['6.50'])

        // Its NEXT round after the change uses the new price.
        const round2 = await submit(oldSession.token)
        expect(await capturedPrices(round2)).toEqual(['9.25'])
      } finally {
        await client.query('rollback')
      }
    },
  )

  it(
    'a new session entered after the change pays the new price on its first round (N3)',
    { timeout: 30_000 },
    async () => {
      await client.query('begin')
      try {
        // Change first, then enter — a NEW session after the change.
        await setHummusPrice('6.00')
        const newSession = { token: await openAtTable(diningTableIds.downtownT3) }
        const round = await submit(newSession.token)
        expect(await capturedPrices(round)).toEqual(['6.00'])
      } finally {
        await client.query('rollback')
      }
    },
  )
})
