# Research: Cart and Rounds (Phase 7)

Created 2026-09-20 · resolves the design questions the spec and plan depend on.

## 1. Can the submission call the 006 tax engine directly?

**Revised during implement (T007/T008): not directly — but through a split
engine.** `calculate_branch_taxes` is `security invoker` and its first act is a
staff/owner authorization against `auth.uid()` — which is NULL inside a
token-authorized definer body (the customer surface carries no JWT). The
discovered resolution (migration `20260920103000_tax_core_split.sql`): the
computation moves verbatim into `private.calculate_tax_totals` (owner role
only, no execute grant of any kind), the 006 staff surface becomes a thin
authorizing delegator with byte-identical behavior and unchanged grants, and
`submit_round` calls the core directly — its own token authorization IS the
caller's authorization (the session refusal precedes every computation). The
rules walk, rounding and payload shape still exist in exactly one body
(Risk 6, SC-004), now genuinely callable from both authorization models.
(All other design steps follow 005–007's definer/token pattern.)

## 2. What does "availability" mean at submission time?

Two layers (feature 005's model): the item's `is_available` flag (restaurant-wide)
and the branch's `branch_unavailable_items` presence-only override. A submission
line is valid only when both pass for the SESSION's branch. The cart's display
prices come from the menu payload (which already encodes both layers); the server
re-checks in-transaction (the cart is advisory — FR-004).

## 3. Extras validation without a retirement state

`menu_item_extras` rows are never deleted (restrict FKs) and carry no
`is_active` column — there is nothing to retire. The correct submission check is
a scope check: every submitted extra id must exist under the submitted item
(`(restaurant_id, item_id)` composite). A stale or foreign extra id is refused
with a specific message. The spec's "retired extra" edge case resolves here.

## 4. Why the kitchen ticket has no items table

The master plan's inventory (§6.6) lists ticket items, but a second copy of the
round's item rows could drift from the round (the exact Risk 6 anti-pattern).
The ticket is a separate operational HEADER — one per round, own state column —
whose items are the round's items by construction (same transaction, proven by
tests). Phase 8 denormalizes only if its kitchen surface requires it; until then
the invariant "ticket ⊨ round" is enforced by uniqueness, not copying.

## 5. Cart scoping and lifecycle

The cart payload stores the session token it was built under:
`restopilot.cart = { token, lines: [{ item_id, extra_ids, quantity }] }`.
- A cart whose stored token ≠ the device's current session token renders empty
  (re-entry at another table never inherits a foreign cart).
- Every session-clear path (refused recovery, explicit forget) clears the cart
  key with the token (clarified posture).
- Quantities are bounded 1–99 client-side and server-side; the server bound is
  authoritative.

## 6. Concurrency and double-submit

Each `submit_round` call is one atomic round (PL/pgSQL function = one
transaction). A double-tap creates two independent rounds at worst — never a
partial one; the client disables the control during flight (FR-009's client
half). Two devices submitting simultaneously each get their own complete round;
no shared-row contention exists (rows are new). The race suite runs two
concurrent submissions and asserts two complete, independent results.

## 7. Audit posture

Submissions come from unauthenticated customer identities — the established
posture (feature 007: audits attach to authenticated staff actions) means no
audit rows in this phase. The round row itself is the trace (created_at, items,
prices). Phase 8's staff actions (accept, void, remove) will audit.

## 8. Realtime deferral

§5.4: realtime is not the source of truth. The recommended implementation order
sequences `012-realtime-and-notifications` after the ordering engine. This phase
commits state and serves reads; nothing emits events. The spec's Out of Scope
cites both.

## 9. Money handling in the client

The 005/006 pattern stands: prices travel as strings, formatting via the shared
money module, no floating-point arithmetic on amounts. The cart's running total
sums line bases as decimal strings through the existing helpers.

## 10. Seeded fixture

No rounds are seeded: the demo sessions (Downtown T1/T2) start with empty
histories, so Round 1/Round 2 journeys are provable from a clean state. The
seed gains nothing for this feature except (if needed) nothing — determinism is
inherited. Types regeneration adds the new tables/functions.
