# Specification: End-to-End Validation (Phase 16)

**Feature dir**: `specs/017-end-to-end-validation` | **Created**: 2026-09-22
**Input**: Master plan §27 — validate the complete restaurant workflow from a
customer perspective. This is the dress rehearsal: one long live journey
through every surface the product has (owner setup → customer entry → two
rounds → kitchen/cashier handling → bill → close), plus the twelve §27
additional scenarios each proven at the highest tier that can express them.

## Clarifications resolved (recorded 2026-09-22)

- **Q: New suites or a survey?** The twelve scenarios are largely proven by
  the standing 005–015 suites; re-proving them again as new tests would
  duplicate. Resolution (the house reuse rule, same as 016 FR-003): each
  scenario is either **cited** to its existing proof or **newly covered**
  where no test drives the actual §27 behavior — and the gap that is real
  (the customer-visible state journey and the un-proven §27 lines) gets the
  new coverage.
- **Q: What is the "complete workflow" journey?** The §27 happy path verbatim
  (owner creates restaurant → branch → tables → menu → customer scans QR →
  entry → round 1 → cashier accepts → kitchen prepares/ready → customer sees
  state → round 2 → second ticket → bill → cashier closes). Driven as one
  e2e journey against freshly created data (not the seed), because §27's
  premise is creation from scratch — the seed-based suites already prove
  each surface in isolation.

## User stories

### US1 — The complete workflow runs end to end (P1)

One browser journey drives §27's happy path verbatim: the owner creates a
restaurant, branch, tables, and menu through the real UI; a customer opens
the public route, selects the table, enters name + phone, and the session
opens; round 1 flows to the cashier (accept), kitchen (prepare, ready), and
back to the customer's updated state; round 2 produces a second ticket; the
customer's history/bill shows both rounds with correct money; the cashier
closes the session and it becomes closed.

**Why**: §27's main happy path is a single connected story no existing test
drives end to end; every surface is proven in isolation, the composition is
not.

### US2 — The twelve additional scenarios each have a standing proof (P1)

Two customers sharing a table; closed session → new session; unavailable
item during ordering; price change before a new session; price change while
an old session remains open; tax changes; branch overrides; delivery
cutoff; takeaway cutoff; void; unauthorized branch access; multiple
restaurant tenants. Each is either cited to the existing suite that proves
it or covered by a new deterministic test where the §27 line is un-proven.

**Why**: §27's additional-scenario list is the launch checklist; a scenario
without a standing proof is a gap.

## Functional requirements

- **FR-001**: One committed e2e journey drives §27's happy path verbatim
  against freshly created data (new restaurant through close), asserting the
  customer-visible state transitions and the money path at each hop.
- **FR-002**: Every one of the twelve §27 scenarios has a standing proof —
  cited (with file + test name) or newly covered — recorded in this spec's
  scenario table and in the tasks Notes.
- **FR-003**: Where a journey or scenario fails, the defect is fixed (or, if
  it is intended behavior, the test asserts the intended behavior) before
  the phase converges; no known-broken step ships.
- **FR-004**: The full gate (verify + e2e) passes after the new coverage;
  the phase's launch-readiness record is committed.

## Non-goals (this phase)

- No new product features, no UX changes; if a journey exposes friction, it
  is recorded, not redesigned here.
- No performance measurement (016 owns baselines), no load testing.
- No production deployment (Phase 17 owns readiness).

## Scenario → proof table (FR-002; maintained as the coverage record)

| # | §27 scenario | Standing proof |
| - | ------------ | -------------- |
| 1 | Two customers sharing a table | e2e `session.surfaces.test.ts` — "a second window joins the open table: one session, two participants" |
| 2 | Closed session → new session | **NEW** (017 T005): e2e journey — staff close, then a fresh entry opens a new session at the freed table |
| 3 | Unavailable item during ordering | e2e `session.surfaces.test.ts` (unavailable items hidden/refused) + db `channel.rpc.test.ts` |
| 4 | Price change before a new session | **NEW** (017 T006): db probe — owner changes price, a NEW session's round uses the new price |
| 5 | Price change while an old session remains open | **NEW** (017 T006): db probe — the open session's EXISTING rounds keep captured prices; its next round after the change uses the new price |
| 6 | Tax changes | db `tax` suites (rule CRUD + recomputation) — cited; the money path re-asserted in the US1 journey |
| 7 | Branch overrides | e2e `menu.surfaces.test.ts` + db `menu.rpc.test.ts` (branch_unavailable_items) — cited |
| 8 | Delivery cutoff | e2e `session.surfaces.test.ts` "delivery cutoff refuses additional orders" — cited |
| 9 | Takeaway cutoff | db `channel.rpc.test.ts` (the cutoff at ready) — cited |
| 10 | Void | e2e `bill.void.audit.test.ts` (void a locked round; bill shows the voided section) — cited |
| 11 | Unauthorized branch access | e2e `auth.routes.test.ts` + role denials in `tax`/`management` suites — cited |
| 12 | Multiple restaurant tenants | db `tenancy.rls.test.ts` + `security.isolation.test.ts` — cited |
