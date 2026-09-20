/*
 * Phase 7 — the order client (spec 008 T009; contracts/order-client.md).
 *
 * One module owns the cart state and the two order RPC wrappers. The cart is
 * CLIENT-ONLY and advisory (Constitution V): `localStorage` under the
 * documented single key, scoped to the device's session token, recomputed
 * totals from the menu payload's prices — the server's validation and the
 * captured money are the state that matters (FR-004).
 *
 * Error mapping reuses feature 007's machinery verbatim (`mapSessionError`,
 * the retry/denied/validation kinds) — one canonical path (FR-017); no
 * parallel error vocabulary. The session refusal keeps its 007 meaning: an
 * unavailable session clears the device's token AND the cart, returning the
 * customer to entry (the clarified clear-cart-on-session-end posture).
 */

import { getSupabaseClient } from '../../lib/supabase'
import {
  SESSION_RETRY_MESSAGE,
  SESSION_UNAVAILABLE_MESSAGE,
  clearSessionToken,
  mapSessionError,
  readSessionToken,
  type SessionResult,
} from '../session/sessionClient'

/* ── cart state (client-only, advisory) ────────────────────────────────────── */

/** The documented `localStorage` key (contract §2). */
export const CART_KEY = 'restopilot.cart'

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

/** The in-module subscription the cart UI renders from (contract §3). */
type CartListener = () => void
const listeners = new Set<CartListener>()

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
  for (const listener of listeners) {
    listener()
  }
}

/**
 * The session-scoped cart lines: a cart whose stored token ≠ the device's
 * session token renders empty (contract §2). Returns a fresh array — the
 * caller may mutate it locally, then persist through `setCartLines`.
 */
export function readCartLines(): CartLine[] {
  const token = readSessionToken()
  if (token === null) {
    return []
  }
  const stored = readStoredCart()
  if (stored === null || stored.token !== token) {
    return []
  }
  return stored.lines.map((line) => ({ ...line, extra_ids: [...line.extra_ids] }))
}

/** Persists the given lines for the CURRENT session token (or clears). */
export function setCartLines(lines: CartLine[]): void {
  const token = readSessionToken()
  if (token === null) {
    writeStoredCart(null)
    return
  }
  writeStoredCart({ token, lines })
}

/** Subscribes to cart changes; returns the unsubscribe function. */
export function subscribeToCart(listener: CartListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Clears the cart — every session-clear path calls this with the token clear. */
export function clearCart(): void {
  writeStoredCart(null)
}

/* ── payload types ─────────────────────────────────────────────────────────── */

export interface SubmittedRoundItem {
  id: string
  item_id: string
  quantity: number
  unit_price: string
  extras: Array<{ extra_id: string; price_adjustment: string }>
}

export interface SubmittedRound {
  id: string
  restaurant_id: string
  branch_id: string
  session_id: string
  state: string
  subtotal: string
  tax_total: string
  tax_lines: unknown[]
  created_at: string
}

export interface SubmitRoundPayload {
  round: SubmittedRound
  ticket_id: string
  items: SubmittedRoundItem[]
}

export interface HistoryRoundItem {
  id: string
  item_id: string
  name: string
  quantity: number
  unit_price: string
  extras: Array<{ extra_id: string; name: string; price_adjustment: string }>
}

export interface HistoryRound {
  id: string
  state: string
  subtotal: string
  tax_total: string
  tax_lines: unknown[]
  created_at: string
  items: HistoryRoundItem[]
}

export interface RoundsPayload {
  rounds: HistoryRound[]
}

/* ── payload parsing (fail closed on anything unexpected) ──────────────────── */

function assertObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('payload')
  }
  return value as Record<string, unknown>
}

function assertString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('payload')
  }
  return value
}

export function parseSubmitRound(payload: unknown): SubmitRoundPayload {
  const root = assertObject(payload)
  const round = assertObject(root.round)
  const itemsRaw = root.items
  if (!Array.isArray(itemsRaw)) {
    throw new Error('payload')
  }
  return {
    round: {
      id: assertString(round.id),
      restaurant_id: assertString(round.restaurant_id),
      branch_id: assertString(round.branch_id),
      session_id: assertString(round.session_id),
      state: assertString(round.state),
      subtotal: assertString(round.subtotal),
      tax_total: assertString(round.tax_total),
      tax_lines: Array.isArray(round.tax_lines) ? round.tax_lines : [],
      created_at: assertString(round.created_at),
    },
    ticket_id: assertString(root.ticket_id),
    items: itemsRaw.map((raw) => {
      const item = assertObject(raw)
      const extrasRaw = item.extras
      return {
        id: assertString(item.id),
        item_id: assertString(item.item_id),
        quantity: assertObject({ v: item.quantity }).v as number,
        unit_price: assertString(item.unit_price),
        extras: (Array.isArray(extrasRaw) ? extrasRaw : []).map((e) => {
          const extra = assertObject(e)
          return {
            extra_id: assertString(extra.extra_id),
            price_adjustment: assertString(extra.price_adjustment),
          }
        }),
      }
    }),
  }
}

export function parseRounds(payload: unknown): RoundsPayload {
  const root = assertObject(payload)
  const roundsRaw = root.rounds
  if (!Array.isArray(roundsRaw)) {
    throw new Error('payload')
  }
  return {
    rounds: roundsRaw.map((raw) => {
      const round = assertObject(raw)
      const itemsRaw = round.items
      return {
        id: assertString(round.id),
        state: assertString(round.state),
        subtotal: assertString(round.subtotal),
        tax_total: assertString(round.tax_total),
        tax_lines: Array.isArray(round.tax_lines) ? round.tax_lines : [],
        created_at: assertString(round.created_at),
        items: (Array.isArray(itemsRaw) ? itemsRaw : []).map((rawItem) => {
          const item = assertObject(rawItem)
          const extrasRaw = item.extras
          return {
            id: assertString(item.id),
            item_id: assertString(item.item_id),
            name: assertString(item.name),
            quantity: item.quantity as number,
            unit_price: assertString(item.unit_price),
            extras: (Array.isArray(extrasRaw) ? extrasRaw : []).map((e) => {
              const extra = assertObject(e)
              return {
                extra_id: assertString(extra.extra_id),
                name: assertString(extra.name),
                price_adjustment: assertString(extra.price_adjustment),
              }
            }),
          }
        }),
      }
    }),
  }
}

/* ── the wrappers ──────────────────────────────────────────────────────────── */

/**
 * Submits the cart lines as one atomic round. The cart clears only on
 * `ok: true` (contract §1) — a refusal leaves the cart exactly as it was
 * (FR-010). An unavailable-session refusal also clears the device's token
 * (the 007 recovery rule propagates to the cart).
 */
export async function submitRound(lines: CartLine[]): Promise<SessionResult<SubmitRoundPayload>> {
  const token = readSessionToken()
  if (token === null) {
    return { ok: false, kind: 'validation', message: SESSION_UNAVAILABLE_MESSAGE }
  }
  try {
    const { data, error } = await getSupabaseClient().rpc('submit_round', {
      p_token: token,
      p_items: lines.map((line) => ({
        item_id: line.item_id,
        extras: line.extra_ids,
        quantity: String(line.quantity),
      })),
    })
    if (error !== null) {
      const mapped = mapSessionError(error)
      if (mapped.kind === 'validation' && mapped.message === SESSION_UNAVAILABLE_MESSAGE) {
        clearSessionToken()
        clearCart()
      }
      return { ok: false, ...mapped }
    }
    if (data === null) {
      return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
    }
    try {
      return { ok: true, data: parseSubmitRound(data) }
    } catch {
      return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
    }
  } catch {
    return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
  }
}

/** Reads the session's rounds history (recovered from the server on mount). */
export async function getSessionRounds(): Promise<SessionResult<RoundsPayload>> {
  const token = readSessionToken()
  if (token === null) {
    return { ok: false, kind: 'validation', message: SESSION_UNAVAILABLE_MESSAGE }
  }
  try {
    const { data, error } = await getSupabaseClient().rpc('get_session_rounds', { p_token: token })
    if (error !== null) {
      const mapped = mapSessionError(error)
      if (mapped.kind === 'validation' && mapped.message === SESSION_UNAVAILABLE_MESSAGE) {
        clearSessionToken()
        clearCart()
      }
      return { ok: false, ...mapped }
    }
    if (data === null) {
      return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
    }
    try {
      return { ok: true, data: parseRounds(data) }
    } catch {
      return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
    }
  } catch {
    return { ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE }
  }
}
