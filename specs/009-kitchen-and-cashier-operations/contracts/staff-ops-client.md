# Contract: Staff Ops Client (spec 009)

One module (`src/features/staffOps/staffOpsClient.ts`) owns the eight RPC
wrappers and their payload parsers; `useStaffOps.ts` holds the hooks; the two
dashboard routes and the bill panel consume them. Error mapping reuses feature
007's machinery verbatim (`mapSessionError`, `SessionResult`) — one canonical
path (FR-017 posture); a `42501` maps to the generic denial message, `P0001`
surfaces the server's text verbatim, everything else is retry.

## §1 Wrappers

- `acceptRound(id)`, `startPreparation(id)`, `markRoundReady(id)`,
  `lockRound(id)` — one RPC each; the returned post-action payload feeds the
  caller (FR-008) and the hooks write it into the query cache (no refetch
  needed for the acted-on round).
- `modifyRoundLine(id, itemId, action, quantity?)` — same shape.
- `getBranchRounds(branchId)`, `getKitchenQueue(branchId)`,
  `getSessionBill(sessionId)` — the reads.

## §2 Query keys and cache behavior

- `['staffOps', 'rounds', branchId]` — the cashier dashboard.
- `['staffOps', 'kitchen', branchId]` — the kitchen queue.
- `['staffOps', 'bill', sessionId]` — the bill panel.
- Every successful mutation invalidates the branch's two dashboard keys (the
  acted-on round's payload also lands in the cache via `setQueryData` from the
  return). Refetch on window focus stays enabled — the §5.4 recovery path
  until Phase 12's transport.

## §3 Payload types (validated, fail-closed)

`RoundPayload` (id, state, subtotal/tax_total/tax_lines as strings, items with
names and captured money), `TicketQueuePayload` (grouped by state, NO money
keys — the parser REJECTS a payload carrying them, FR-010's client half),
`BillPayload` (rounds grouped by state + grand total). A malformed payload ⇒
retry-kind result, never a crash.

## §4 Surfaces

- **CashierRoundsPage** (`/dashboard/rounds?branch=`): branch picker when the
  identity holds several branches (the 007 pattern), round cards grouped by
  state with accept/modify/lock controls enabled exactly per state, the
  session bill panel below.
- **KitchenDashboardPage** (`/dashboard/kitchen?branch=`): the three-column
  queue (new / preparing / ready) with start/ready buttons and no money text
  anywhere.
- Router gates: cashier/manager/owner reach rounds; kitchen (and the others)
  reach the kitchen queue; both links appear in the dashboard nav
  role-derived, as the sessions page does.

## §5 Denials

Every wrapper's `42501` result renders as the generic denial on the surface;
a `P0001` (state refusal — a racer won) renders verbatim and the card state
re-derives from the invalidated read. No optimistic state change on any
mutation path (the DB is the truth; §5.4).
