import { getSupabaseClient } from '../../lib/supabase'
import type { Database } from '../../types/database.types'

/**
 * Phase 8 — the staff operations client (spec 009 T009; contracts/
 * staff-ops-client.md §1, §3).
 *
 * Thin typed wrappers over the eight RPCs. Authorization is SERVER-side
 * (each RPC derives identity from the JWT and refuses 42501 with the
 * action's own message); the client adds no rules, only shapes. Money keys
 * absent from the kitchen queue are absent here too — the type says so
 * (FR-010).
 *
 * Error handling mirrors the 007/008 clients: a boolean-error-shaped reply
 * raises (payload discipline), everything else returns typed — surfaces
 * render data or an error, never a malformed half.
 */

type Rpc = Database['public']['Functions']

/** A round as the lifecycle/modify payload surfaces it (§1 shape). */
export interface StaffRoundItem {
  id: string
  item_id: string
  name: string
  quantity: number
  unit_price: string
  extras: Array<{ extra_id: string; name: string; price_adjustment: string }>
}

export interface StaffRound {
  id: string
  restaurant_id: string
  branch_id: string
  session_id: string
  state: string
  subtotal: string
  tax_total: string
  tax_lines: unknown
  created_at: string
  items: StaffRoundItem[]
}

/** Result of a lifecycle transition or a modification. */
export interface RoundActionResult {
  round: StaffRound
  ticket_state: string
}

/** A branch round as `get_branch_rounds` surfaces it (§6; 010 §5 additions). */
export interface BranchRound {
  round_id: string
  session_id: string
  /** The session's channel (spec 010 §5) — drives the cashier's delivery controls. */
  session_type: 'dine-in' | 'delivery' | 'takeaway'
  /** Set for delivery only; the kitchen queue never carries it (SC-004). */
  delivery_address: string | null
  table_label: string | null
  state: string
  /** The Phase 10 void overlay — set only on boundary-voided rounds. */
  voided: boolean
  void_reason: string | null
  voided_at: string | null
  subtotal: string
  tax_total: string
  tax_lines: unknown
  created_at: string
  items: Array<{
    item_id: string
    name: string
    quantity: number
    unit_price: string
    extras: string[]
  }>
}

/**
 * A kitchen ticket — deliberately carries NO money keys anywhere (FR-010);
 * the type-level guarantee the database test asserts at runtime.
 */
export interface KitchenTicket {
  ticket_id: string
  round_id: string
  state: string
  table_label: string
  created_at: string
  items: Array<{ name: string; quantity: number; extras: string[] }>
}

/** The session bill (§8; 010 §5 additions; 011 §3 extensions): the full display of captured money. */
export interface SessionBill {
  session_id: string
  /** The session's channel (spec 010 §5). */
  session_type: 'dine-in' | 'delivery' | 'takeaway'
  /** Set for delivery only — the bill renders it when present (FR-009). */
  delivery_address: string | null
  table_label: string | null
  /** The session's named participants (011 §3) — order of joining. */
  participants: Array<{ id: string; display_name: string; joined_at: string }>
  rounds: Array<{
    round_id: string
    state: string
    voided: boolean
    void_reason: string | null
    voided_at: string | null
    subtotal: string
    tax_total: string
    tax_lines: unknown
    created_at: string
    /** The captured per-line detail (011 §3): name, quantity, captured unit price, extras. */
    items: Array<{
      item_id: string
      name: string
      quantity: number
      unit_price: string
      extras: string[]
    }>
  }>
  /** Sum over NON-voided rounds only (FR-003) — the void reduces the bill. */
  grand_total: string
}

/**
 * Raise when an RPC answers with the boolean-error shape instead of a
 * payload (the 007/008 client convention).
 */
export class StaffOpsPayloadError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'StaffOpsPayloadError'
    this.code = code
  }
}

/**
 * FR-010, client half: the kitchen queue is money-free by contract. A
 * payload carrying any money key (on the ticket or inside an item) is a
 * contract violation — rejected, never rendered.
 */
function assertMoneyFree(tickets: KitchenTicket[]): void {
  const moneyPattern = /price|subtotal|tax|total/i
  for (const ticket of tickets) {
    for (const key of Object.keys(ticket)) {
      if (moneyPattern.test(key)) {
        throw new StaffOpsPayloadError('contract', 'The kitchen queue must not carry money data.')
      }
    }
    for (const item of ticket.items) {
      for (const key of Object.keys(item)) {
        if (moneyPattern.test(key)) {
          throw new StaffOpsPayloadError('contract', 'The kitchen queue must not carry money data.')
        }
      }
    }
  }
}

async function callRpc<T>(fn: keyof Rpc, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseClient().rpc(fn as never, args as never)
  if (error) {
    throw new StaffOpsPayloadError(error.code ?? 'unexpected', error.message)
  }
  if (data === null || data === undefined) {
    // A row-returning RPC answering nothing is a malformed response —
    // fail closed (§3: never a crash, never a partial render).
    throw new StaffOpsPayloadError('malformed', 'The staff operation returned no data.')
  }
  return data as T
}

// ── Lifecycle transitions (§1–§5) ───────────────────────────────────────────

export async function acceptRound(roundId: string): Promise<RoundActionResult> {
  return callRpc<RoundActionResult>('accept_round', { p_round_id: roundId })
}

export async function startPreparation(roundId: string): Promise<RoundActionResult> {
  return callRpc<RoundActionResult>('start_preparation', { p_round_id: roundId })
}

export async function markRoundReady(roundId: string): Promise<RoundActionResult> {
  return callRpc<RoundActionResult>('mark_round_ready', { p_round_id: roundId })
}

export async function lockRound(roundId: string): Promise<RoundActionResult> {
  return callRpc<RoundActionResult>('lock_round', { p_round_id: roundId })
}

// ── Delivery transitions (spec 010 §3–§4; delivery-only, kitchen-denied) ────

/** `ready → out_for_delivery` — cashier dispatches the driver (FR-005). */
export async function markOutForDelivery(roundId: string): Promise<RoundActionResult> {
  return callRpc<RoundActionResult>('mark_out_for_delivery', { p_round_id: roundId })
}

/** `out_for_delivery → completed` — terminal; nothing fires after (FR-005). */
export async function markCompleted(roundId: string): Promise<RoundActionResult> {
  return callRpc<RoundActionResult>('mark_completed', { p_round_id: roundId })
}

/**
 * Void a round at its channel boundary (spec 011 FR-004; contracts §1).
 * The server validates in the documented order; refusals throw the exact
 * `StaffOpsPayloadError` (code + verbatim message) the UI renders.
 */
export async function voidRound(roundId: string, reason: string): Promise<RoundActionResult> {
  return callRpc<RoundActionResult>('void_round', {
    p_round_id: roundId,
    p_reason: reason,
  })
}

export type ModifyAction = 'remove' | 'reduce'

export async function modifyRoundLine(
  roundId: string,
  itemId: string,
  action: ModifyAction,
  quantity?: number,
): Promise<RoundActionResult> {
  return callRpc<RoundActionResult>('modify_round_line', {
    p_round_id: roundId,
    p_item_id: itemId,
    p_action: action,
    p_quantity: quantity ?? null,
  })
}

// ── Reads (§6–§8) ───────────────────────────────────────────────────────────

export async function getBranchRounds(branchId: string): Promise<BranchRound[]> {
  const data = await callRpc<BranchRound[]>('get_branch_rounds', { p_branch_id: branchId })
  return Array.isArray(data) ? data : []
}

export async function getKitchenQueue(branchId: string): Promise<KitchenTicket[]> {
  const data = await callRpc<KitchenTicket[]>('get_kitchen_queue', { p_branch_id: branchId })
  if (Array.isArray(data)) {
    assertMoneyFree(data)
    return data
  }
  return []
}

export async function getSessionBill(sessionId: string): Promise<SessionBill> {
  return callRpc<SessionBill>('get_session_bill', { p_session_id: sessionId })
}
