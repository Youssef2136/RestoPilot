import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CART_KEY,
  MAX_QUANTITY,
  MIN_QUANTITY,
  addToCart,
  clearCart,
  loadCart,
  saveCart,
  subscribeToCart,
  type CartLine,
} from '../../src/features/order/cartState'

/**
 * The cart module suite (spec 008 T010; contracts/order-client.md §2;
 * FR-002, FR-003). Node has no `localStorage`, so a minimal in-memory Map
 * shim stands in — the same approach as feature 007's token-rule suite.
 * The module reads its token through the injected `readToken` accessor, so
 * no session-module import (and therefore no Supabase client) is needed.
 */

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const TOKEN_A = 'dev-token-downtown-t1-2026'
const TOKEN_B = 'dev-token-downtown-t2-2026'
const readTokenA = () => TOKEN_A
const readTokenB = () => TOKEN_B

const LAMB = '00000000-0000-4000-8000-000000006014'
const RICE = '00000000-0000-4000-8000-000000006032'
const GARLIC = '00000000-0000-4000-8000-000000006031'
const HUMMUS = '00000000-0000-4000-8000-000000006011'

describe('cart: save/load round-trip', () => {
  it('persists lines under the documented key, scoped to the session token', () => {
    saveCart(readTokenA, [{ item_id: LAMB, extra_ids: [RICE], quantity: 2 }])
    expect(store.has(CART_KEY)).toBe(true)

    const stored = JSON.parse(store.get(CART_KEY) as string) as { token: string; lines: CartLine[] }
    expect(stored.token).toBe(TOKEN_A)
    expect(stored.lines).toEqual([{ item_id: LAMB, extra_ids: [RICE], quantity: 2 }])

    expect(loadCart(readTokenA)).toEqual([{ item_id: LAMB, extra_ids: [RICE], quantity: 2 }])
  })

  it('returns a fresh array on load — mutating it does not corrupt the stored cart', () => {
    saveCart(readTokenA, [{ item_id: LAMB, extra_ids: [], quantity: 1 }])
    const lines = loadCart(readTokenA)
    lines.push({ item_id: HUMMUS, extra_ids: [], quantity: 5 })
    expect(loadCart(readTokenA)).toHaveLength(1)
  })
})

describe('cart: token scoping', () => {
  it('a cart whose stored token ≠ the device token reads as empty', () => {
    saveCart(readTokenA, [{ item_id: LAMB, extra_ids: [], quantity: 3 }])
    expect(loadCart(readTokenB)).toEqual([])
  })

  it('no token at all reads as empty, and saving without a token clears', () => {
    saveCart(readTokenA, [{ item_id: LAMB, extra_ids: [], quantity: 1 }])
    expect(loadCart(() => null)).toEqual([])
    saveCart(() => null, [{ item_id: LAMB, extra_ids: [], quantity: 1 }])
    expect(store.has(CART_KEY)).toBe(false)
  })
})

describe('cart: merge-on-add and bounds feedback', () => {
  it('adding the same item+extras pair increments quantity (merge rule)', () => {
    addToCart(readTokenA, LAMB, [RICE, GARLIC], 1)
    addToCart(readTokenA, LAMB, [RICE, GARLIC], 2)
    expect(loadCart(readTokenA)).toEqual([
      { item_id: LAMB, extra_ids: [RICE, GARLIC], quantity: 3 },
    ])
  })

  it('a different extra set (or order) is a distinct line', () => {
    addToCart(readTokenA, LAMB, [RICE, GARLIC], 1)
    addToCart(readTokenA, LAMB, [GARLIC, RICE], 1)
    addToCart(readTokenA, LAMB, [RICE], 1)
    expect(loadCart(readTokenA)).toHaveLength(3)
  })

  it('quantity above the bound is clamped as feedback', () => {
    addToCart(readTokenA, LAMB, [], MAX_QUANTITY)
    addToCart(readTokenA, LAMB, [], 10)
    expect(loadCart(readTokenA)[0]?.quantity).toBe(MAX_QUANTITY)
    expect(MAX_QUANTITY).toBe(99)
    expect(MIN_QUANTITY).toBe(1)
  })
})

describe('cart: subscriptions and the clear paths', () => {
  it('notifies subscribers on every mutation', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToCart(listener)
    addToCart(readTokenA, LAMB, [], 1)
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    listener.mockClear()
    addToCart(readTokenA, LAMB, [], 1)
    expect(listener).not.toHaveBeenCalled()
  })

  it('clearCart empties the key (the forget/recovery wiring)', () => {
    saveCart(readTokenA, [{ item_id: LAMB, extra_ids: [], quantity: 1 }])
    clearCart()
    expect(store.has(CART_KEY)).toBe(false)
    expect(loadCart(readTokenA)).toEqual([])
  })

  it('a malformed stored payload reads as empty rather than crashing', () => {
    store.set(CART_KEY, 'not-json{')
    expect(loadCart(readTokenA)).toEqual([])
    store.set(CART_KEY, JSON.stringify({ lines: 'not-an-array' }))
    expect(loadCart(readTokenA)).toEqual([])
  })
})
