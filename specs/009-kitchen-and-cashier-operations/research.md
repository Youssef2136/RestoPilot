# Research: Kitchen and Cashier Operations (Phase 8)

Created 2026-09-20 · resolves the design questions the spec and plan depend on.

## 1. Guarded UPDATE vs. procedure for the state machine

The transition RPC runs the state change as
`update rounds set state = 'accepted' where id = $1 and state = 'new' and <tenant guards>`
and raises the generic refusal when `get diagnostics … row_count = 0`. This is
the concurrency arbiter: two racing transitions execute serially at row level
(PostgreSQL row locking), the guard matches for exactly one of them, and the
loser refuses with zero state change — no advisory locks, no retry loop, no
second state system (Risk 7, §5.4). Illegal transitions are then not a
code path but an absence of a matching row: the same generic refusal covers
skip/backward/repeat/terminal/wrong-state uniformly.

## 2. Where each state lives: round vs. ticket

Phase 7 created `rounds.state` (closed `'new'`) and `kitchen_tickets.state`
(closed `'new'`) as two columns that must now carry a lifecycle. The
aggregation decision: **the round is the aggregate; the ticket is the
kitchen's projection.** Accept and lock are cashier acts on the ROUND.
Preparing/ready are kitchen acts on the TICKET — but the round's state column
mirrors them so every reader (bill panel, customer's future history, reports)
sees one consistent operational state without joins. The transition bodies
update both rows in one transaction (they are 1:1 by the partial unique
index). `kitchen_tickets` never enters `lock`: its check stops at `ready` and
the round carries the terminal state.

## 3. The check-constraint widening

Both columns' closed checks widen by `alter table … drop constraint … ,
add constraint … check (state in (…))` in one migration. `rounds` gains
`('new','accepted','preparing','ready','lock')`; `kitchen_tickets` gains
`('new','accepted','preparing','ready')`. No backfill exists (all seeded and
live rows are `'new'`), and the schema suite's ordinal-shape assertions are
unaffected (column lists unchanged).

## 4. Money re-derivation on modification (FR-007)

`modify_round_line` runs in one body: apply the line change (delete the
`round_items` row, or `update … set quantity`), rebuild the selections array
from the SURVIVING `round_items`+`round_item_extras` rows (captured
`unit_price`s and adjustments — never menu-current prices, which may have
changed since submission), call `private.calculate_tax_totals` over it, and
update the round's `subtotal`/`tax_total`/`tax_lines`. This is exactly the
Phase 7 capture path read backwards: same engine, same inputs, same rounding
(Risk 6, SC-003). The rebuild-from-captured-rows detail matters: re-pricing
from `menu_items` would silently re-price old orders when a menu price changes.

**As implemented (2026-09-20)**: the core's signature widened to
`private.calculate_tax_totals(p_branch_id uuid, p_selections jsonb,
p_price_overrides jsonb default null)` — a jsonb ARRAY parallel to the
selections, each element `{unit_price, extras: {extra_id: price_adjustment}}`
pinning that line's captured money (a parallel array because two lines of the
SAME item may carry different captured prices; a per-item map cannot express
that). Without the argument the behavior is byte-identical to the 006/008
callers (the implementation re-applied cleanly against their suites:
399/399). The pre-widening 2-arg overload is dropped in the migration so
exactly one core remains.

## 5. Role resolution per action

The membership row (restaurant_id, branch_id nullable, role) is the unit.
Per action, the authorization predicate:

- **cashier/branch_manager**: a membership row matching the round's branch
  with the role;
- **owner**: `private.owned_restaurant_ids` covers the round's restaurant;
- **kitchen**: a membership row matching the branch with `role = 'kitchen'`
  (preparing/ready only).

The predicate is a plain `exists` join against `staff_memberships` — live
rows, so a removal takes effect immediately (the FR-006 posture from 003).

## 6. Branch-scoped reads

`get_branch_rounds`/`get_kitchen_queue` take `p_branch_id` and verify the
caller's reach exactly as `list_open_sessions` does (007): the branch must be
in `private.staff_branch_ids` (kitchen/cashier/manager) or its restaurant in
`private.owned_restaurant_ids`. The payload derives session/table labels by
join. `get_session_bill` reaches the session through the same predicate (the
session's branch must be reachable), then aggregates the session's rounds'
captured columns — display arithmetic only.

## 7. No prices in the kitchen payload (FR-010)

`get_kitchen_queue` and the ticket transitions return items, quantities,
extras (names via join at read time) — no `unit_price`, no totals, no tax
lines. The kitchen surface therefore cannot leak money even by accident, and
the FR-010 test asserts the payload's shape (no money keys) rather than the
UI's restraint.

## 8. Audit vocabulary (§37)

`round.accepted`, `ticket.preparing`, `ticket.ready`, `round.locked`,
`round.item_removed`, `round.item_quantity_reduced` — resource types
`round`/`ticket`/`round_item`, resource id the affected row's id, scope
(round's restaurant/branch), reason null except where the change itself is
the reason (modifications carry before→after in the reason field, e.g.
`quantity 3 → 1`, `removed 1 × Lamb Kebab`). Actor from
`private.staff_profile_ids((select auth.uid()))`; a null profile (anon) never
reaches these RPCs (their authorization raises first).

## 9. Realtime posture (FR-013, §5.4)

This phase ships the database truth and the refetch path: the client hooks
invalidate the dashboard query keys after every mutation, and the dashboards
recover from a missed event by refetch on reconnect/reload (the standard
react-query behavior this codebase already uses). The transport subscription
(Supabase Realtime or later) plugs into the same keys in Phase 12 without a
contract change — the read RPCs are the contract.

## 10. Fixture facts the suites rely on

- Round state machine start: every seeded/live round is `'new'` (Phase 7 closed the checks).
- The membership matrix (seed, verified live): alice owner BlueOlive; bob
  branch_manager Downtown; carla cashier Downtown; **dan kitchen Marina**
  (the only kitchen identity — the denial identity for Downtown acts and the
  actor for Marina's, though Marina has no seeded sessions, so the kitchen
  journey uses a scratch Marina session via the table-activation precedent);
  eve cashier Downtown **and** owner Cedar Grill (the dual-scope identity);
  fiona has NO memberships (the bootstrap fixture — denied everywhere);
  platform admin outside every restaurant scope.
- The dev tokens (Downtown T1/T2) open-or-join Downtown sessions; the
  submission RPC remains the only round creator.
- Tax fixtures (006): VAT 8.25% total + city tax on items + the Downtown
  surcharge (branch-only) + compound alcohol duty — the modification suite
  re-uses the same expected-value math as `tax.rpc.test.ts`.
