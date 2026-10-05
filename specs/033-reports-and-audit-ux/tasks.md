# specs/033 — Tasks

**Input**: [spec.md](./spec.md) · **Implementation**: landed in `3356b7d feat(033)`
(verified live 2026-10-05/06 by speckit-autopilot; report:
`.specify/frontend-autopilot/phases/phase-13/report.md`).

| # | Task | Covers | Status |
|---|---|---|---|
| T001 | `src/features/reports/reportFormat.ts`: `isClampReached` (exactly-limit), `barShare` (zero-safe share of the visible max), `comparisonPeriodSentence` (server bounds restated) + `tests/unit/reportFormat.test.ts` | R2, R4, D1 | [x] — done: unit 7/7 green (fresh run) |
| T002 | ReportsPage: comparison same-period sentence + per-row posture (`Loading…` / failure text under `aria-live="polite"`), zero hint 'Nothing was recorded in this period.', aria-hidden token bars on channels + best-sellers | FR-05/D1, D6, D4/FA-10 | [x] — done: live in reports.readability 4/4; frozen reports.surfaces passes unedited |
| T003 | AuditLogPage: clamp notice only at exactly-limit 200-entry pages; exact-match filter hint via `aria-describedby`; reason 2-line CSS clamp (full text in DOM) | D2, D7, D5 | [x] — done: asserted in reports.readability (hint + clamp absence + exact-match unchanged) |
| T004 | VoidReportPage: the same reason treatment | D5 | [x] — done: styles shared module; void-log table renders via it |
| T005 | `reports.surfaces.module.css`: card fallback <720px for the three tables (`data-label` cells, thead out of flow, CSS-only — no DOM fork) | D3/R3 | [x] — done: 390px walk overflow ≤ 0 on all three pages (reports.readability) |
| T006 | `e2e/reports.readability.test.ts` (4, serial, read-only): sentence + bars + zero hint; filter semantics + clamp absence; 390px card walk; axe WCAG 2.2 AA on the three desktop pages | R1–R6 | [x] — done: 4/4 green today (targeted 10/10 with the frozen suite; inside the full screen 183/191) |
