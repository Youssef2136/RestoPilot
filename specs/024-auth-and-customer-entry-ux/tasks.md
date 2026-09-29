# Phase 04 Tasks — Authentication, Account & Customer Entry UX

**Feature dir:** `specs/024-auth-and-customer-entry-ux` · **Date:** 2026-09-28

| # | Task | Covers | Status |
|---|---|---|---|
| T001 | Unit route decisions: `/` landing composition pin, `/order/:branchId` redirect mapping, recovery copy + SessionJoinNotice pins | FR-08, FR-09, FR-02, FR-06 | [x] |
| T002 | `AuthCard` + re-skin `/signin`, `/reset-password`, `/account/password` (primitives, autocomplete audit, no flow changes) | FR-01, FR-02, FR-03 | [x] |
| T003 | Entry presentation split: `CustomerShellHeader`, `ChannelSelector`, `SessionJoinNotice`; re-skin `RestaurantEntry` (sticky CTA, inputMode/autoComplete, focus-on-invalid); logic + labels frozen | FR-04, FR-05, FR-06 | [x] |
| T004 | C1/C2: real `/` landing; `/order/:branchId` redirect; routes.ts meta; migrate `routes.test.ts` pins (recorded) | FR-08, FR-09 | [x] |
| T005 | E2E: mobile-viewport entry completion; axe scan `/r/blue-olive`; console-clean entry navigation; session.surfaces extensions | Gates, UX, a11y | [x] |
| T006 | Evidence screenshots (390 entry flow steps, signin desktop+mobile, `/` landing) | FINISH | [x] |
| T007 | Validation: `npm run verify` + `test:e2e` green; impeccable detect; convergence fixes | Gates | [x] |
| T008 | Checkpoint `feat(024)` + push (auto-push rule); report + ledger update + state DONE | CHECKPOINT/REPORT | [x] |
