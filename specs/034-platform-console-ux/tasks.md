# specs/034 — Tasks

**Input**: [spec.md](./spec.md) · **Implementation**: landed in `9dba5d3 feat(034)`
(verified live 2026-10-06 by speckit-autopilot; report:
`.specify/frontend-autopilot/phases/phase-14/report.md`).

> Normalized 2026-10-06: extracted from the single-file `spec.md` (committed in
> `9dba5d3`); the task rows verbatim, the Status evidence added from the recorded
> green runs.

| # | Task | Covers | Status |
| --- | --- | --- | --- |
| T001 | D1 vocabulary unification: `stateLabel(state)` helper in subscriptionCopy.ts (wraps label), console renders it, STATE_LABELS deleted | FR/UX | [x] — done: stateLabel unit block green (subscriptionCopy.test.ts 7/7); the two migrated platform.surfaces pins green |
| T002 | D2 toasts: dates saved / disabled / re-enabled / onboarded outcomes via useToast (restaurant-named copy) | FR-07 | [x] — done: platform.console toasts leg green (dates + disable + re-enable); the onboarding toast wording kept distinct from the pinned inline status (spec 019 lookups strict-safe) |
| T003 | D3 sort+filter: name filter + sortable Name/Subscription (aria-sort, client-side) | FR-02 | [x] — done: platform.console sort/filter leg green (narrow + restore; aria-sort toggle; self-consistent row order) |
| T004 | D4 dates validation: end ≥ start inline error + guarded submit | FR-03 | [x] — done: live on /admin/platform; C001 pinned the invalid case in the phase E2E |
| T005 | D5 landing posture on /admin from the shared overview query | FR-01 | [x] — done: adminPosture unit 3/3; the /admin posture leg green in the floor E2E |
| T006 | D6 card fallback css + 390px/axe coverage; new E2E platform.console.test.ts (3) | R/A11y | [x] — done: platform.console floor leg green (cardTable class + labelled cells + thead out of flow at 390px; axe clean on both admin routes) |

## Phase 034: Convergence

| # | Task | Covers | Status |
| --- | --- | --- | --- |
| C001 | Pin the invalid-dates case in the phase E2E: end < start renders the inline error and the submit stays guarded — closes R3's "unit+E2E" claim honestly (the dates FLOW was covered; the validation feedback was not) | FR-03/R3 | [x] — done: platform.console 3/3 green after the pin (2026-10-06, after db:reset) |
