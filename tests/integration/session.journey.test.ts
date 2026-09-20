import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.types'

/**
 * Minimal in-memory `localStorage` (node has none) — the device the client's
 * token rules act on. It persists across the journey's "fresh client" steps,
 * which is exactly the reload-equivalent: a new process, same device.
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
 * wrappers (enterSession, getSessionContext, getSessionMenu) all ride on it.
 */
const shared = vi.hoisted(() => ({ client: null as unknown as SupabaseClient<Database> }))
vi.mock('../../src/lib/supabase', () => ({ getSupabaseClient: () => shared.client }))

import {
  SESSION_UNAVAILABLE_MESSAGE,
  enterSession,
  getContext,
  getMenu,
  readSessionToken,
} from '../../src/features/session/sessionClient'
import {
  branchIds,
  diningTableIds,
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
 * Integration journey — the real-API session lifecycle (spec 007 T022;
 * SC-004, SC-002, FR-013, FR-014): enter → recover after a reload-equivalent
 * (fresh client, stored token) → read the menu → staff close through a real
 * owner sign-in → the customer's recovery refused with the token cleared →
 * re-enter (the table's new session).
 *
 * Airport T1 (Cedar Grill) is this suite's dedicated table: the e2e block
 * leaves it without an open session and every step here is open-or-join
 * agnostic, so reruns are deterministic. The journey leaves NO open session
 * behind (the suite is not transactional). One real sign-in per run (eve).
 *
 * Preconditions: migrated + seeded cloud development database.
 */
describe('the customer session journey through the real API (T022)', () => {
  const ENTRY = {
    restaurantId: restaurantIds.cedarGrill,
    branchId: branchIds.airport,
    tableId: diningTableIds.airportT1,
    displayName: 'Journey Guest',
    phone: '+15558880001',
  }

  beforeAll(() => {
    shared.client = createClient<Database>(
      requireEnv('VITE_SUPABASE_URL'),
      requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
    )
  })

  it(
    'enter → recover → menu → staff close → refused recovery → re-enter',
    { timeout: 30_000 },
    async () => {
      // 1. Entry through the real public RPC (the anon shared client).
      const entry = await enterSession(ENTRY)
      expect(entry.ok).toBe(true)
      if (!entry.ok) return
      expect(entry.data.session.status).toBe('open')
      expect(readSessionToken()).toBe(entry.data.token)
      const firstSessionId = entry.data.session.id

      // 2. Reload-equivalent: the token persists on the device — the context
      //    recovers without re-entry.
      const recovered = await getContext()
      expect(recovered.ok).toBe(true)
      if (!recovered.ok) return
      expect(recovered.data.session.id).toBe(firstSessionId)
      expect(recovered.data.indicator.restaurant_name).toBe('Cedar Grill')
      expect(recovered.data.indicator.table_label).toBe('T1')

      // 3. The menu read rides on the same token.
      const menu = await getMenu()
      expect(menu.ok).toBe(true)

      // 4. Staff close through a REAL owner sign-in (eve owns Cedar Grill;
      //    the close RPC authorizes the role server-side).
      const eve = createClient<Database>(
        requireEnv('VITE_SUPABASE_URL'),
        requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
      )
      const signIn = await eve.auth.signInWithPassword({
        email: seedCredentials.eve.email,
        password: seedCredentials.eve.password,
      })
      expect(signIn.error).toBeNull()
      const closed = await eve.rpc('close_session', { p_session_id: firstSessionId })
      expect(closed.error).toBeNull()

      // 5. The customer's recovery is now refused — the single
      //    indistinguishable refusal — and the client cleared the device.
      const refused = await getContext()
      expect(refused).toEqual({
        ok: false,
        kind: 'validation',
        message: SESSION_UNAVAILABLE_MESSAGE,
      })
      expect(readSessionToken()).toBeNull()

      // 6. Re-enter: the table is free again — a NEW session opens.
      const reentry = await enterSession(ENTRY)
      expect(reentry.ok).toBe(true)
      if (!reentry.ok) return
      expect(reentry.data.session.id).not.toBe(firstSessionId)
      expect(reentry.data.session.status).toBe('open')
      expect(readSessionToken()).toBe(reentry.data.token)

      // Leave no open session behind (the suite is not transactional).
      const cleanup = await eve.rpc('close_session', { p_session_id: reentry.data.session.id })
      expect(cleanup.error).toBeNull()
    },
  )
})
