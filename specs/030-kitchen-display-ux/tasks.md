# Tasks: Kitchen Display UX (Phase 10)

| ID | Task | Gate | Status |
| -- | ---- | ---- | ------ |
| T001 | Baseline INSPECT (queue RPC shape, fixture channel sessions, TicketCard/page, frozen pins); baseline.md; state.json → phase 10 running | Gates | [X] |
| T002 | SPECIFY + CLARIFY: spec.md D1–D4 (visual-only alerting; 3-band honest ages; new-column visible; fluid ≥1024 target) | Gates | [X] |
| T003 | PLAN + checklists (requirements, kitchen-fidelity) + tasks + analysis | Gates | [X] |
| T004 | `ticketAge.ts` + `tests/unit/ticketAge.test.ts` (formats, bands, null-safety); staffops.client UNCHANGED | Unit | [X] |
| T005 | `kitchen.surfaces.module.css` (KDS scale, fluid columns, NEW highlight w/ reduced-motion, late band, skeleton, tokens only) | Design | [X] |
| T006 | `KitchenBoard` (columns/counts/headings/empties) + rebuilt `TicketCard` (chips, age, counter orders, large targets, hooks preserved) | FR-01/02/03/04/08 | [X] |
| T007 | Page recomposition: toolbar (LiveBadge + selector), ReconnectingBanner (onStatus), skeleton loading, empty/error postures, announcement | FR-05/06/07 | [X] |
| T008 | New E2E `e2e/kitchen.display.test.ts` (serial): Marina T1 tablet chain + keyboard-only + reload recovery + offline banner + blind re-assert + 390px fallback + axe | Gates | [X] |
| T009 | Validation: db:reset → `npm run verify` → full Playwright (background + sleep 570) → `impeccable detect src` 0; convergence fixes; check off checklists | Gates | [X] |
| T010 | Ledger §Phase 030 + evidence screenshots; checkpoint `feat(030)` + push; phase reports + state DONE | CHECKPOINT/REPORT | [ ] |

## Dependencies

- T004/T005 → T006/T007 → T008 → T009 → T010.
