# Tasks: Cashier Operations UX (Phase 09)

| ID | Task | Gate | Status |
| -- | ---- | ---- | ------ |
| T001 | Baseline INSPECT: read §Phase 09, staffOps module, routes, realtime + cue, frozen E2E pins (incl. full-journey/reports pins); `phases/phase-9/baseline.md`; state.json → phase 9 running | Gates | [X] |
| T002 | SPECIFY + CLARIFY: `spec.md` with decisions D1–D5 (bill inline; freshness badge + reconnecting banner; cue path; no undo/shortcuts; inline modify) | Gates | [X] |
| T003 | PLAN/DESIGN + checklists (requirements, cashier-fidelity) + tasks + analysis | Gates | [X] |
| T004 | Extract `roundGroups.ts` (`ROUND_GROUP_ORDER`, `groupRoundsByState`, `pickRefusal`) + `tests/unit/roundBoard.test.ts`; staffops.client tests UNCHANGED | Unit | [X] |
| T005 | `staffOps.surfaces.module.css` (board grid, card density, voided treatment, tabular money, bill check layout, responsive collapse; tokens only) | Design | [X] |
| T006 | `RoundsBoard` + rebuilt `RoundCard` (StateChip, TransitionActions, RefusalText, voided styling, `data-round-cue` marker) — all hooks/names preserved | FR-01/02/03/09 | [X] |
| T007 | `VoidRoundDialog` wrapper: pinned names, reason-required posture, boundary + irreversibility copy | FR-04 | [X] |
| T008 | `BillPanel` rebuilt on the money primitives (print-check layout; numeric pins: voided line 2 figures, grand total 1) | FR-05 | [X] |
| T009 | `LiveBadge` + `ReconnectingBanner` + cue path (DashboardLiveCue link; rounds-page cue + card marking, scroll without focus steal) | FR-07/08, D2/D3 | [X] |
| T010 | `BranchSessionsPanel` re-skin (SessionRow, tokens; pinned dialog names + single role=status preserved); StaffSessionsPage composition intact | FR-06 | [X] |
| T011 | `CashierRoundsPage` composition: board, freshness wiring (onStatus + dataUpdatedAt), cue, bill; responsive postures | FR-01…10 | [X] |
| T012 | New E2E `e2e/cashier.operations.test.ts` (serial): Marina T1 tablet chain + keyboard-only + reconnecting banner + 390px void + axe on both routes | Gates | [X] |
| T013 | Validation: db:reset → `npm run verify` → full Playwright (background + sleep 570) → `impeccable detect src` 0; convergence fixes; check off checklists | Gates | [X] |
| T014 | Ledger §Phase 029 + evidence screenshots; checkpoint `feat(029)` + push (incl. the trailing 028 tasks.md checkbox); phase reports + state DONE | CHECKPOINT/REPORT | [x] — done: ledger record + screenshots committed; checkpoint pushed; phase-9/10 reports DONE |

## Dependencies

- T004 → T006/T011 (grouping/refusal helpers feed the board).
- T005 → T006–T011 (css module consumed everywhere).
- T006/T008 → T012 (E2E asserts the re-skinned surfaces).
- T012 → T013 → T014.
