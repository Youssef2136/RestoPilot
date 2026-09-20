# Contract: Order Client (spec 008)

The client surface for the cart, submission, and rounds history. One module
(`src/features/order/orderClient.ts`) owns the two RPC wrappers and the cart
state; the cart UI lives beside the customer menu (feature 007's route).

## §1 Module shape

- `submitRound(items)` → `SessionResult<SubmitRoundPayload>` — one RPC round
  trip (`submit_round`); the cart clears only on `ok: true`.
- `getSessionRounds()` → `SessionResult<RoundsPayload>` — one RPC round trip
  (`get_session_rounds`).
- Error mapping reuses feature 007's machinery verbatim (`mapSessionError`,
  the retry/denied/validation kinds, `SessionPayloadError` on malformed
  payloads) — one canonical path (FR-017); no parallel error vocabulary.

## §2 Cart state (client-only, advisory)

- Key: `restopilot.cart` (documented single `localStorage` key).
- Shape: `{ token, lines: [{ item_id, extra_ids: string[], quantity }] }`.
- The cart is only rendered while a session context resolves; a cart whose
  stored `token` ≠ the device's session token renders empty.
- Every session-clear path (refused recovery, explicit forget) clears the cart
  key with the token (clarified posture).
- Bounds are surfaced client-side as feedback only (1–99; the server is
  authoritative); the running total is advisory and recomputed from the menu
  payload's prices.

## §3 Query keys and invalidation

- `['order', 'rounds', token]` — the history read; invalidated by a successful
  submission (no optimistic writes — the server's row is the state).
- Submission success also clears the cart module's key and notifies the cart UI
  (the same in-module subscription, not a query).

## §4 Surfaces

- **Cart UI** (on `/r/:slug/menu`): add-to-cart affordances on menu items
  (extras selection + quantity), the line list with adjust/remove, the running
  total, and the submit control (disabled while empty or in flight; the
  double-submit guard is the disabled state, FR-009's client half).
- **Submission refusals**: the server's message verbatim (`role="alert"`); the
  cart remains exactly as it was (FR-010).
- **Rounds history** (on the same route, below the menu): the session's rounds
  with items, extras, captured prices, and tax lines (FR-011); recovered on
  mount from the server after any reload.
