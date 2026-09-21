import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Minimal in-memory `localStorage` (the node environment has none) — the
 * token rules act on this device, so the shim mirrors exactly the surface
 * the client uses (`getItem`/`setItem`/`removeItem`).
 */
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => void store.clear(),
})

/**
 * Channel entry unit suite (spec 010 T015; contracts/session-client.md §1–§3;
 * FR-002/FR-003/FR-004, the cutoff identity rules).
 *
 * One seam, mocked: `getSupabaseClient` for the RPC round trip. Asserts the
 * entry wrapper's validation mapping (server refusals verbatim as
 * `validation`), the dine-in redirect, the cutoff refusal messages' exact
 * identity (they must NEVER clear the token or the cart — only the
 * unavailable-session refusal does), and the takeaway address-null rule.
 */

const harness = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: harness.rpc }),
}))

vi.mock('../../src/features/menu/menuClient', () => ({
  parseBranchMenu: () => {
    throw new Error('not used in this suite')
  },
}))

import {
  DINE_IN_REDIRECT_MESSAGE,
  SESSION_TOKEN_KEY,
  openChannelSession,
} from '../../src/features/session/sessionClient'
import { CART_KEY, loadCart, saveCart } from '../../src/features/order/cartState'
import { submitRound } from '../../src/features/order/orderClient'

beforeEach(() => {
  store.clear()
  harness.rpc.mockReset()
})

function okPayload() {
  return {
    session: {
      id: '11111111-1111-1111-1111-111111111111',
      restaurant_id: '22222222-2222-2222-2222-222222222222',
      branch_id: '33333333-3333-3333-3333-333333333333',
      table_id: null,
      type: 'delivery',
      status: 'open',
      opened_at: '2026-09-21T00:00:00Z',
      delivery_address: '12 King Fahd Rd',
    },
    token: 'tok',
    participant: { id: 'p1', display_name: 'Smoke Tester', joined_at: '2026-09-21T00:00:00Z' },
  }
}

function refusal(message: string) {
  const err = new Error(message) as Error & { code: string }
  err.code = 'P0001'
  return err
}

describe('openChannelSession (contracts §3)', () => {
  it('sends the contract parameter names and returns the parsed entry payload', async () => {
    harness.rpc.mockResolvedValueOnce({ data: okPayload(), error: null })

    const result = await openChannelSession({
      restaurantId: 'r1',
      branchId: 'b1',
      channel: 'delivery',
      name: ' Tester ',
      phone: '+15551234567',
      address: '12 King Fahd Rd',
    })

    expect(harness.rpc).toHaveBeenCalledWith('open_session_channel', {
      p_restaurant_id: 'r1',
      p_branch_id: 'b1',
      p_channel: 'delivery',
      p_display_name: ' Tester ',
      p_phone: '+15551234567',
      p_delivery_address: '12 King Fahd Rd',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.token).toBe('tok')
      expect(result.data.session.delivery_address).toBe('12 King Fahd Rd')
      expect(result.data.session.table_id).toBeNull()
    }
  })

  it('omits the address for takeaway (the server re-validates and nulls it)', async () => {
    harness.rpc.mockResolvedValueOnce({ data: okPayload(), error: null })
    await openChannelSession({
      restaurantId: 'r1',
      branchId: 'b1',
      channel: 'takeaway',
      name: 'T',
      phone: '+15551234567',
    })
    const args = harness.rpc.mock.calls[0][1] as Record<string, unknown>
    expect(args.p_channel).toBe('takeaway')
    expect(args.p_delivery_address).toBeUndefined()
  })

  it('surfaces the dine-in redirect verbatim as a validation refusal', async () => {
    harness.rpc.mockResolvedValueOnce({ data: null, error: refusal(DINE_IN_REDIRECT_MESSAGE) })
    const result = await openChannelSession({
      restaurantId: 'r1',
      branchId: 'b1',
      channel: 'delivery',
      name: 'T',
      phone: '+15551234567',
    })
    expect(result).toEqual({ ok: false, kind: 'validation', message: DINE_IN_REDIRECT_MESSAGE })
  })

  it('maps the server input refusals verbatim (name, phone, address bounds)', async () => {
    for (const message of [
      'Enter your name (1–60 characters).',
      'A valid phone number is required.',
      'A delivery address is required.',
    ]) {
      harness.rpc.mockResolvedValueOnce({ data: null, error: refusal(message) })
      const result = await openChannelSession({
        restaurantId: 'r1',
        branchId: 'b1',
        channel: 'delivery',
        name: 'T',
        phone: '+15551234567',
        address: 'x',
      })
      expect(result).toEqual({ ok: false, kind: 'validation', message })
    }
  })

  it('reports a malformed payload as retry', async () => {
    harness.rpc.mockResolvedValueOnce({ data: { nonsense: true }, error: null })
    const result = await openChannelSession({
      restaurantId: 'r1',
      branchId: 'b1',
      channel: 'delivery',
      name: 'T',
      phone: '+15551234567',
      address: 'x',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.kind).toBe('retry')
  })
})

describe('cutoff refusal identity (spec 010 §2; T010 verification)', () => {
  const DELIVERY_CUTOFF = 'Your order is already on its way — no additional items can be added.'
  const TAKEAWAY_CUTOFF = 'Your order is ready for pickup — no additional items can be added.'

  beforeEach(() => {
    store.set(SESSION_TOKEN_KEY, 'tok')
    saveCart(() => 'tok', [{ item_id: 'i1', extra_ids: [], quantity: 2 }])
  })

  it('cutoff refusals surface as validation with the verbatim text', async () => {
    for (const message of [DELIVERY_CUTOFF, TAKEAWAY_CUTOFF]) {
      harness.rpc.mockResolvedValueOnce({ data: null, error: refusal(message) })
      const result = await submitRound([{ item_id: 'i1', extra_ids: [], quantity: 1 }])
      expect(result).toEqual({ ok: false, kind: 'validation', message })
    }
  })

  it('cutoff refusals preserve the token and the cart', async () => {
    harness.rpc.mockResolvedValueOnce({ data: null, error: refusal(DELIVERY_CUTOFF) })
    await submitRound([{ item_id: 'i1', extra_ids: [], quantity: 1 }])

    expect(store.get(SESSION_TOKEN_KEY)).toBe('tok')
    const cart = loadCart(() => 'tok')
    expect(cart).toHaveLength(1)
    expect(cart[0]?.quantity).toBe(2)
  })

  it('the unavailable-session refusal still clears token and cart (unchanged rule)', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: null,
      error: refusal('This session is no longer available.'),
    })
    await submitRound([{ item_id: 'i1', extra_ids: [], quantity: 1 }])
    expect(store.has(SESSION_TOKEN_KEY)).toBe(false)
    expect(loadCart(() => 'tok')).toHaveLength(0)
    expect(store.has(CART_KEY)).toBe(false)
  })
})
