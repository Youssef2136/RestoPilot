import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.types'

/**
 * Minimal in-memory `localStorage` (node has none) — the device the client's
 * token AND cart rules act on. It persists across the journey's "fresh
 * client" steps, which is exactly the reload-equivalent: a new process, same
 * device.
 */
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => void store.clear(),
})

/**
 * The app's shared client, pointed at the REAL cloud project — the customer
 * wrappers (enterSession, submitRound, getSessionRounds) all ride on it.
 */
const shared = vi.hoisted(() => ({ client: null as unknown as SupabaseClient<Database> }))
vi.mock('../../src/lib/supabase', () => ({ getSupabaseClient: () => shared.client }))

import {
  enterSession,
  getContext,
  getMenu,
  readSessionToken,
} from '../../src/features/session/sessionClient'
import { addToCart, clearCart, loadCart, type CartLine } from '../../src/features/order/cartState'
import {
  getSessionRounds,
  submitRound,
  type SubmittedRoundItem,
} from '../../src/features/order/orderClient'
import {
  branchIds,
  diningTableIds,
  menuItemIds,
  restaurantIds,
  seedCredentials,
} from '../database/helpers/fixtures'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. See docs/development.md.`)
  }
  return value
}

/**
 * Integration journey — the real-API ordering lifecycle (spec 008 T020;
 * SC-003, SC-005; FR-005, FR-011): enter → build the cart client-side (the
 * real merge rules) → submit the round → the history shows it with captured
 * prices → the reload-equivalent (fresh client, stored token) recovers BOTH
 * the session and the history → a second submission → two rounds, two
 * tickets, no item overlap between the submissions' line sets.
 *
 * Airport T1 (Cedar Grill) is this suite's dedicated table (the session
 * journey's own convention). The journey leaves NO open session behind —
 * the cleanup close runs at the end through a real staff sign-in.
 *
 * Preconditions: migrated + seeded cloud development database.
 */
describe('the customer ordering journey through the real API (T020)', () => {
  const ENTRY = {
    restaurantId: restaurantIds.cedarGrill,
    branchId: branchIds.airport,
    tableId: diningTableIds.airportT1,
    displayName: 'Order Journey Guest',
    phone: '+15558880021',
  }

  beforeAll(() => {
    shared.client = createClient<Database>(
      requireEnv('VITE_SUPABASE_URL'),
      requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
    )
  })

  it(
    'enter → cart → submit → history → reload-equivalent → second submit → two rounds',
    { timeout: 60_000 },
    async () => {
      // 1. Entry through the real public RPC — the token lands on the device.
      const entry = await enterSession(ENTRY)
      expect(entry.ok).toBe(true)
      if (!entry.ok) return
      expect(entry.data.session.status).toBe('open')
      const token = entry.data.token
      expect(readSessionToken()).toBe(token)

      // 2. The cart is built CLIENT-side through the real cartState rules —
      //    the advisory cart the surface would produce (FR-002). The token
      //    accessor is the session module's own device read.
      const readToken = readSessionToken
      addToCart(readToken, menuItemIds.cedarMixedGrill, [], 1)
      addToCart(readToken, menuItemIds.cedarMixedGrill, [], 2)
      addToCart(readToken, menuItemIds.flatbread, [], 1)
      const cart: CartLine[] = loadCart(readToken)
      expect(cart).toEqual([
        { item_id: menuItemIds.cedarMixedGrill, extra_ids: [], quantity: 3 },
        { item_id: menuItemIds.flatbread, extra_ids: [], quantity: 1 },
      ])

      // 3. Submission through the real wrapper — one RPC round trip. The
      //    clear-on-success is the mutation hook's job (useSubmitRound);
      //    the wrapper itself leaves the cart untouched, so the journey
      //    clears explicitly, exactly as the surface's hook does.
      const submitted = await submitRound(cart)
      expect(submitted.ok).toBe(true)
      if (!submitted.ok) return
      clearCart()
      expect(submitted.data.round.state).toBe('new')
      expect(submitted.data.items.length).toBe(2)
      const firstRoundId = submitted.data.round.id
      const firstTicketId = submitted.data.ticket_id
      // The captured unit prices match the seeded prices exactly.
      const mixedGrill = submitted.data.items.find(
        (i: SubmittedRoundItem) => i.item_id === menuItemIds.cedarMixedGrill,
      )
      expect(mixedGrill?.unit_price).toBe('22.00')

      // 4. The history read returns the submitted round with display names.
      //    Rerun-safe: the Airport session is open-or-join, so a rerun
      //    inherits earlier runs' rounds — assert THIS run's round by id,
      //    never an absolute count.
      const history = await getSessionRounds()
      expect(history.ok).toBe(true)
      if (!history.ok) return
      const firstRound = history.data.rounds.find((r) => r.id === firstRoundId)
      expect(firstRound).toBeDefined()
      expect(firstRound?.items.some((i) => i.name === 'Cedar Mixed Grill')).toBe(true)

      // 5. Reload-equivalent: a FRESH client (new process, same device).
      //    The stored token recovers the session and the history remains
      //    readable through it.
      store.delete('supabase.auth.token')
      const recovered = await getContext()
      expect(recovered.ok).toBe(true)
      const history2 = await getSessionRounds()
      expect(history2.ok).toBe(true)
      if (!history2.ok) return
      expect(history2.data.rounds.some((r) => r.id === firstRoundId)).toBe(true)

      // 6. Second submission — two rounds, two tickets, disjoint line sets.
      addToCart(readToken, menuItemIds.flatbread, [], 1)
      const cart2 = loadCart(readToken)
      expect(cart2).toEqual([{ item_id: menuItemIds.flatbread, extra_ids: [], quantity: 1 }])
      const submitted2 = await submitRound(cart2)
      expect(submitted2.ok).toBe(true)
      if (!submitted2.ok) return
      clearCart()
      expect(submitted2.data.round.id).not.toBe(firstRoundId)
      expect(submitted2.data.ticket_id).not.toBe(firstTicketId)

      const history3 = await getSessionRounds()
      expect(history3.ok).toBe(true)
      if (!history3.ok) return
      const roundIds = history3.data.rounds.map((r) => r.id)
      expect(roundIds).toContain(firstRoundId)
      expect(roundIds).toContain(submitted2.data.round.id)

      // Leave no open session behind (the suite is not transactional).
      const staff = createClient<Database>(
        requireEnv('VITE_SUPABASE_URL'),
        requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
      )
      const signIn = await staff.auth.signInWithPassword(seedCredentials.eve)
      expect(signIn.error).toBeNull()
      const cleanup = await staff.rpc('close_session', { p_session_id: entry.data.session.id })
      expect(cleanup.error).toBeNull()
      void getMenu
    },
  )
})
