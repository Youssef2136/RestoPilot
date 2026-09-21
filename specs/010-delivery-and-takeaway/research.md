# Research: Delivery and Takeaway (Phase 9)

Created 2026-09-20 · resolves the design questions the spec and plan depend on.

## 1. New entry RPC vs overloading `open_session_at_table`

`open_session_at_table(restaurant, branch, table, name, phone)` is the dine-in contract
(007): table-scoped join semantics, five args, byte-stable suites. Channel entry needs
table-less semantics with an optional address. Decision: a NEW
`open_session_channel(p_restaurant_id, p_branch_id, p_channel, p_display_name, p_phone,
p_delivery_address)` — one body for both non-dine-in channels (the address required iff
`p_channel = 'delivery'`), same definer posture, same token issuance, same refusal
vocabulary (unknown restaurant/branch/inactive branch = the 007 texts). The dine-in RPC
is untouched; the two never share join behavior (a delivery session is one customer,
not a joinable table).

## 2. Cutoff mechanics: state-driven, not clock-driven

§20 ties the cutoff to workflow moments, not wall-clock times ("at the approved
delivery cutoff" / "tied to the item being ready"). A clock requires scheduling state
this phase doesn't own. Decision: the cutoff IS a round-state predicate evaluated inside
`submit_round`'s transaction — delivery: any round of the session in
`out_for_delivery`/`completed`; takeaway: any round in `ready` (or `lock`, the general
freeze). Deterministic, race-free (the same guarded-update serialization backs it), and
exactly matches §8.3/§8.4's wording. Branch-level configuration is NOT added this phase
—the master plan's test matrix (§1297–1298) lists the cutoffs as behaviors, and the
state-driven reading satisfies them; a per-branch configurability extension can land
later without contract churn.

## 3. Where the address lives

One delivery address per session, set at entry, never edited (clarification Q3). Column
`sessions.delivery_address text null` with a bounded check (1–200 chars after trim,
non-empty when type = 'delivery' via a channel-conditional CHECK). Exposed ONLY on the
cashier/bill surfaces (`get_branch_rounds`, `get_session_bill`) — never in the kitchen
queue, never in the customer session payload after entry (the customer knows their own
address; FR-010's read-only display renders it from the entry state/local echo, not
from a new read).

## 4. The extended round machine

§8.3's delivery flow inserts `out_for_delivery → completed` AFTER `ready`. The
`rounds_state_check` widens to the seven states; the two new transitions live in the
009 lifecycle migration's pattern (guarded update, `P0001` generic refusal, 42501
tenant/role refusal, audit rows `round.out_for_delivery`/`round.completed`,
kitchen-denied — cashier/manager/owner only). Channel guard: both transitions verify
the round's session type is `delivery` (dine-in/takeaway rounds refuse — same generic
message, indistinguishable from a state problem, per the 009 posture). The ticket
check does NOT widen: the ticket ends at `ready` for every channel.

## 5. Cutoff messages (customer-facing vocabulary)

Extending the 007 contract's customer vocabulary:
- Delivery: 'Your order is already on its way — no additional items can be added.'
- Takeaway: 'Your order is ready for pickup — no additional items can be added.'
Both `P0001` (the validation class), both distinct, both verbatim-tested. The token is
NOT cleared (FR-008): the refusal is an ordering gate, not a session death —
`get_session_rounds` keeps working so the customer watches completion.

## 6. Read-shape additions

`get_branch_rounds`/`get_session_bill` add `session_type` (and `delivery_address` on
the bill + branch rounds for delivery sessions) — the cashier needs the address to
hand the order to the driver. `get_kitchen_queue` gains NOTHING (SC-004's
channel-blindness is the point). `get_session_context`'s payload already carries
`type` (line 240 of the 007 migration); it now returns 'delivery'/'takeaway' naturally
once the check widens — the client renders the label.

## 7. Seed and fixture impact

The seed gains one delivery session + one takeaway session fixture (fixed UUIDs in the
established blocks, dev tokens for both) so the suites and e2e start from realistic
state. The entry flow e2e uses the real channel forms.
