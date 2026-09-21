# Contracts: Session/Order Client (Phase 9)

Extends the 007/008 client contracts. Same `SessionResult` discipline, same error
kinds (`denied` / `validation` / `retry`), payload errors stay fail-closed.

## §1 Channel entry

`enterSessionChannel(input): SessionResult<EntryPayload>` — wraps `open_session_channel`.
Input: `{ restaurantId, branchId, channel: 'delivery' | 'takeaway', displayName, phone,
deliveryAddress? }`. On success the token is written under the SAME
`restopilot.session-token` key (the cart/token rules are channel-blind). The two new
validation refusals map to `validation` with the server text verbatim.

## §2 Cutoff mapping

`submitRound` gains two mapped messages (P0001 → the server text verbatim, `validation`
kind). The cart is PRESERVED on a cutoff refusal (the customer may edit, but cannot
submit; surfaces render the message above the cart). No token clearing.

## §3 Types

`SessionChannel = 'dine-in' | 'delivery' | 'takeaway'`; the context/menu payload types
gain `session_type` (and the staff `BranchRound`/`SessionBill` types gain
`session_type` + `delivery_address`); the entry payload type gains the same fields the
RPC returns.

## §4 Surfaces

- `RestaurantEntry`: the channel picker (dine-in default) — dine-in renders the table
  picker as today; delivery renders the address textarea (required, ≤200, live count);
  takeaway renders neither. Submit routes to the right RPC.
- `CustomerMenuPage`: a channel label chip; for delivery, the address rendered
  read-only under the indicator.
- `CashierRoundsPage`: a channel chip per card; on delivery rounds in `ready` →
  "Send out for delivery", in `out_for_delivery` → "Mark completed"; the bill shows
  the delivery address when present.
- `KitchenDashboardPage`: unchanged rendering (channel-blind) — no address, no money.
