# Tasks: Branch Reports (Phase 12)

**Feature**: `013-branch-reports` | [Spec](spec.md) | [Plan](plan.md)

**Conventions**: `[P]` = parallelizable with its neighbors. Each T-task ends
with its checkbox marked and a one-line evidence note. Tests follow the
house suites: `tests/database/*.test.ts` (pg, transactions), `tests/unit/`,
`e2e/` (Playwright, writes through real UI surfaces, serial).

## Phase 1: Setup

- [X] T001 Read master plan §23, prior contracts (006 capture, 008 rounds,
      010 void overlay, 011/012 conventions), and the seeded fixture
      landscape; confirm `rounds`/`sessions`/`round_items`/`audit_log`
      shapes; set `.specify/feature.json`
- [X] T002 Migration `20260922090000_branch_reports.sql`: the two security
      definer RPCs (`get_branch_sales_report`, `get_branch_void_report`),
      reach via `private.has_branch_role` verbatim, generic refusals, grants
      (authenticated execute only) — plan D1–D5
- [X] T003 `npm run types:gen`; contract regen for the two RPCs
      (`contracts/database-functions.md`)

## Phase 2: Database tests (Foundational)

- [X] T004 Reach matrix suite `tests/database/reports.access.test.ts`:
      owner any-branch, manager own OK / foreign refused / two-branch union,
      cashier+kitchen+anon `42501`, refusal indistinguishability
- [X] T005 Correctness suite `tests/database/reports.calc.test.ts`:
      day/week/month buckets incl. year boundary and empty bucket; anti-drift
      reconciliation (hand-sum from source rows equals the RPC); void
      overlay effects; channel breakdown incl. zero channels; best-seller
      ranking and cap

## Phase 3: Client + surfaces

- [X] T006 `src/features/reports/`: client (RPC calls, refusal mapping),
      `useReports` hook (period/branch parameters, no client math)
- [X] T007 Owner route `/dashboard/reports` (branch + period pickers,
      aggregates grid, channel breakdown, best-sellers, empty states);
      comparison view across the restaurant's branches
- [X] T008 Manager route reuse: same surfaces scoped to the manager's
      branch(es), no cross-branch picker
- [X] T009 Void log page (owner+manager): `get_audit_log` with
      `p_action='round.void'`, who/what/when/reason rendering; nav entry
      gated to owner/manager only (cashier/kitchen absence)

## Phase 4: Tests + polish

- [ ] T010 Unit suite `tests/unit/reports.test.ts`: client refusal mapping,
      parameter shaping, money formatter passthrough (no arithmetic)
- [ ] T011 E2E `e2e/reports.surfaces.test.ts`: owner aggregates + comparison
      live; manager own-branch-only; cashier/kitchen no nav + denial
      deep-link; void log listing; empty-period zero state
- [ ] T012 Full gates: `npm run verify` + full e2e; fix or document any
      regression
- [ ] T013 `docs/development.md` Phase 12 entry; quickstart walkthrough
      script (real sign-ins, seeded-period reconciliation, deterministic
      restore) + validation record
- [ ] T014 Determinism: reset → seed → full db regression → `types:gen`
      byte-identical; final commit + push
- [ ] T015 Post-implement analyze record: deployed signatures, grants, and
      anti-drift spot-check against the contract

## Notes

- Cashier and kitchen get NO reporting surface (spec FR-007) — absence is a
  tested requirement, not an omission.
- The void log is a `get_audit_log` filter view — no second void ledger.
- Reviewer-owned checklist items in
  `checklists/report-correctness-and-reach.md` stay unchecked (house
  convention since 005).
