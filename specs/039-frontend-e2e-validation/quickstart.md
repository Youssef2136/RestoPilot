# specs/039 — Quickstart (walkthroughs)

## W1 — The connected release journey (US1/FR-01)

1. `npm run db:reset -- --yes`.
2. Run `e2e/release.journey.test.ts` (serial): scratch signup → onboarding →
   entry → rounds → cashier/kitchen → bill/void → close → reports/audit —
   with the state spot-checks asserted in passing.
3. Cleanup verified in-journey (the tenant deleted); residue zero.

## W2 — Per-role isolated journeys (US2/FR-02)

1. Fresh reset; run each `e2e/release.role-*.test.ts` standalone (one
   persona per file; one sign-in; a denial leg in each).
2. The six files pass either together (batched) or one at a time.

## W3 — The scenario→proof table (US3/FR-03/FR-04)

1. Write `scenario-proof.md`: every scenario row (status cited/new + file +
   test name).
2. The final script greps every citation: each named test exists in its
   named file (no silent gaps; FR-04 mechanical).

## W4 — The screenshot record (SC-004)

1. The journeys capture the per-surface PNGs into `screenshots/`.
2. Committed.

## W5 — The documented run window + summary (US4/FR-06/SC-005)

1. One window: db:reset → the release journeys (batch) → the standing
   suites batch → `npm run verify`.
2. Write `run-summary.md`: window, batch list, counts, console expected vs
   unexpected, residue posture, gate verdicts.
