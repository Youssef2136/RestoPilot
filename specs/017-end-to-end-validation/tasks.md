# Tasks: End-to-End Validation (Phase 16)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Created**: 2026-09-22

**Prerequisites**: plan.md (required), spec.md (required), the scenario→proof
table (spec), checklists/journey-honesty-and-scenario-coverage.md
(reviewer-owned)

## Phase 1: Setup + survey

- [x] T001 Read §27, the existing e2e/db coverage (session.surfaces,
      kitchen.cashier, bill.void.audit, channel.rpc, menu.rpc, tenancy),
      and the owner-creation surfaces (004 quickstart walkthrough A);
      set `.specify/feature.json`
- [x] T002 Verify the scenario→proof citations in the spec's table against
      the actual test files (file + test name verbatim); correct the table
      where a citation drifted

## Phase 2: The journey

- [x] T003 Create `e2e/full-journey.test.ts`: the §27 happy path verbatim —
      Fiona creates restaurant (date-suffixed slug) → branch → tables →
      category + item through the UI; a fresh customer context enters via
      the public route; round 1 → cashier accept → kitchen prepare → ready
      → customer sees the updated state; round 2 → second ticket; the
      staff bill shows the captured grand total; the cashier closes;
      (plan D1–D5)
- [x] T004 Add the closed→new journey block (spec scenario 2): after the
      close, a fresh customer context re-enters the freed table and opens
      a NEW session with an empty history (plan N1)
- [x] T005 The journey passes single-worker; fix any exposed defect (or
      assert intended behavior per FR-003)

## Phase 3: Price-change timings

- [x] T006 Create `tests/database/e2e.pricechanges.test.ts`: owner changes
      a price — (a) a NEW session's next round uses the new price; (b) an
      OLD session's existing rounds keep captured unit_price while its
      next round after the change uses the new price (plan N2/N3)

## Phase 4: Gates + docs + close-out

- [x] T007 Full gates: `npm run verify` + full e2e single-worker
- [x] T008 `docs/development.md` Phase 16 entry (the journey, the ledger,
      the new db suite); the scenario ledger recorded in tasks Notes
- [x] T009 Determinism: reset → seed → full db regression → `types:gen`
      byte-identical; post-implement analyze record + final commit
      (the launch-readiness record, FR-004)

## Notes

- The nine cited scenarios (files verified in T002): two customers sharing
  a table → `e2e/session.surfaces.test.ts` "a second window joins the open
  table: one session, two participants (SC-003, FR-006)"; unavailable item
  → `e2e/session.surfaces.test.ts` + `tests/database/channel.rpc.test.ts`;
  tax changes → `tests/database/tax.*.test.ts` suites; branch overrides →
  `e2e/menu.surfaces.test.ts` + `tests/database/menu.rpc.test.ts`
  (branch_unavailable_items); delivery cutoff →
  `e2e/session.surfaces.test.ts` "the delivery cutoff refuses additional
  orders above the preserved cart (FR-011)"; takeaway cutoff →
  `tests/database/channel.rpc.test.ts` "the cutoff: submissions refuse
  once the channel state says so" (takeaway at ready); void →
  `e2e/bill.void.audit.test.ts` "carla voids a locked real round; the bill
  shows the voided section and the reduced total"; unauthorized branch
  access → `e2e/auth.routes.test.ts` + the role-denial matrix suites;
  multiple restaurant tenants → `tests/database/tenancy.rls.test.ts` +
  `tests/database/security.isolation.test.ts`.

## Post-implement Analysis

**Date**: 2026-09-23 · **Result**: converged — all 9 tasks `[X]`, full gates
green (unit 249/249, db 492/492, integration 36/36, e2e 95/95 single-worker).

- **FR-001** verified: `e2e/full-journey.test.ts` committed and green; the
  journey asserts the customer-visible state labels at each hop and the
  money path (line totals, second ticket, staff bill grand total).
- **FR-002** verified: all twelve §27 scenarios carry standing proofs — the
  nine citations above were re-checked verbatim in T002; scenarios 2
  (closed → new session) and the price-change timings (2) are newly covered.
- **FR-003** exercised for real: the journey exposed two product defects,
  both fixed — the staff dashboards' owner branch derivation (fixed through
  the `useStaffBranchOptions` policies read, scoped per page) and the never-
  wired 012 customer poll plus the never-rendered round state (both fixed).
  The suite-suite fixture conflict (Fiona's stuck ownership) was resolved by
  the journey's second-owner teardown.
- **FR-004** verified: the launch-readiness record is this block plus the
  docs/development.md Phase 16 entry; committed to GitHub main.

## Scenario ledger (final)

| # | §27 scenario | Proof |
|---|---|---|
| 1 | Two customers, one table | `e2e/session.surfaces.test.ts` (SC-003, FR-006) |
| 2 | Closed session → new session | `e2e/full-journey.test.ts` test 3 (NEW) |
| 3 | Unavailable item refusal | `e2e/session.surfaces.test.ts` + `tests/database/channel.rpc.test.ts` |
| 4 | Price change — new session | `tests/database/e2e.pricechanges.test.ts` (NEW) |
| 5 | Price change — captured vs next | `tests/database/e2e.pricechanges.test.ts` (NEW) |
| 6 | Delivery cutoff | `e2e/session.surfaces.test.ts` (FR-011) |
| 7 | Takeaway cutoff | `tests/database/channel.rpc.test.ts` |
| 8 | Void a locked round | `e2e/bill.void.audit.test.ts` |
| 9 | Unauthorized branch access | `e2e/auth.routes.test.ts` + role-denial suites |
| 10 | Multi-tenant isolation | `tests/database/tenancy.rls.test.ts` + `security.isolation.test.ts` |
| 11 | Tax re-derivation correctness | `tests/database/tax.*.test.ts` suites |
| 12 | Branch menu overrides | `e2e/menu.surfaces.test.ts` + `tests/database/menu.rpc.test.ts` |
