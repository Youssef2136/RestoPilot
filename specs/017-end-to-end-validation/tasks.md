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

- [ ] T003 Create `e2e/full-journey.test.ts`: the §27 happy path verbatim —
      Fiona creates restaurant (date-suffixed slug) → branch → tables →
      category + item through the UI; a fresh customer context enters via
      the public route; round 1 → cashier accept → kitchen prepare → ready
      → customer sees the updated state; round 2 → second ticket; the
      staff bill shows the captured grand total; the cashier closes;
      (plan D1–D5)
- [ ] T004 Add the closed→new journey block (spec scenario 2): after the
      close, a fresh customer context re-enters the freed table and opens
      a NEW session with an empty history (plan N1)
- [ ] T005 The journey passes single-worker; fix any exposed defect (or
      assert intended behavior per FR-003)

## Phase 3: Price-change timings

- [ ] T006 Create `tests/database/e2e.pricechanges.test.ts`: owner changes
      a price — (a) a NEW session's next round uses the new price; (b) an
      OLD session's existing rounds keep captured unit_price while its
      next round after the change uses the new price (plan N2/N3)

## Phase 4: Gates + docs + close-out

- [ ] T007 Full gates: `npm run verify` + full e2e single-worker
- [ ] T008 `docs/development.md` Phase 16 entry (the journey, the ledger,
      the new db suite); the scenario ledger recorded in tasks Notes
- [ ] T009 Determinism: reset → seed → full db regression → `types:gen`
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
