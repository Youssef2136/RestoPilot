/*
 * Phase 7 — the cart module (spec 008 T009; contracts/order-client.md §2).
 *
 * The cart is CLIENT-ONLY and advisory (Constitution V): `localStorage` under
 * the documented single key, scoped to the device's session token, with the
 * merge rule and bounds as feedback. The server's validation and the captured
 * money are the state that matters (FR-004) — nothing here computes money
 * math (Constitution II).
 *
 * Shape: `{ token, lines: [{ item_id, extra_ids, quantity }] }`. A cart whose
 * stored token ≠ the device's session token reads as empty — a new session on
 * this device never inherits the previous table's cart. Every session-clear
 * path (refused recovery, explicit forget) clears this key alongside the
 * token (the clarified posture).
 */

/** The documented `localStorage` key (contract §2). */
export const CART_KEY = 'restopilot.cart'

/** The client feedback bounds — the server's 1..99 bound is authoritative. */
export const MIN_QUANTITY = 1
export const MAX_QUANTITY = 99

/** A single advisory cart line. */
export interface CartLine {
  item_id: string
  extra_ids: string[]
  quantity: number
}

interface StoredCart {
  token: string
  lines: CartLine[]
}

/** The in-module subscription the cart UI renders from (contract §2). */
type CartListener = () => void
const listeners = new Set<CartListener>()

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

function readStoredCart(): StoredCart | null {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (raw === null) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { token?: unknown }).token !== 'string' ||
      !Array.isArray((parsed as { lines?: unknown }).lines)
    ) {
      return null
    }
    return parsed as StoredCart
  } catch {
    return null
  }
}

function writeStoredCart(cart: StoredCart | null): void {
  try {
    if (cart === null) {
      localStorage.removeItem(CART_KEY)
    } else {
      localStorage.setItem(CART_KEY, JSON.stringify(cart))
    }
  } catch {
    // Storage may be unavailable (private mode) — the cart is advisory; the
    // submission still carries the lines of THIS render.
  }
  notify()
}

/**
 * The session-scoped cart lines: a cart whose stored token ≠ the device's
 * session token reads as empty. Returns a fresh array — mutate locally, then
 * persist through `saveCart`.
 */
export function loadCart(readToken: () => string | null): CartLine[] {
  const token = readToken()
  if (token === null) {
    return []
  }
  const stored = readStoredCart()
  if (stored === null || stored.token !== token) {
    return []
  }
  return stored.lines.map((line) => ({
    ...line,
    extra_ids: [...line.extra_ids],
    quantity: Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, line.quantity)),
  }))
}

/** Persists the given lines for the session token produced by `readToken`. */
export function saveCart(readToken: () => string | null, lines: CartLine[]): void {
  const token = readToken()
  if (token === null) {
    writeStoredCart(null)
    return
  }
  const bounded = lines.map((line) => ({
    ...line,
    extra_ids: [...line.extra_ids],
    quantity: Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, line.quantity)),
  }))
  writeStoredCart({ token, lines: bounded })
}

/** Clears the stored cart — the session-clear paths call this with the token clear. */
export function clearCart(): void {
  writeStoredCart(null)
}

/**
 * Adds one line with the merge rule: adding an existing item+extras pair
 * (same ids, same order) increments that line's quantity; otherwise a new
 * line is appended. Quantity above the bound is clamped as feedback.
 */
export function addToCart(
  readToken: () => string | null,
  item_id: string,
  extra_ids: string[],
  quantity: number,
): void {
  const lines = loadCart(readToken)
  const normalizedExtraIds = [...extra_ids]
  const existing = lines.find(
    (line) =>
      line.item_id === item_id &&
      line.extra_ids.length === normalizedExtraIds.length &&
      line.extra_ids.every((id, i) => id === normalizedExtraIds[i]),
  )
  if (existing !== undefined) {
    existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity)
    saveCart(readToken, lines)
    return
  }
  lines.push({
    item_id,
    extra_ids: normalizedExtraIds,
    quantity: Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, quantity)),
  })
  saveCart(readToken, lines)
}

/** Subscribes to cart changes; returns the unsubscribe function. */
export function subscribeToCart(listener: CartListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
