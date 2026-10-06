# Requirements Checklist — 034-platform-console-ux

> Normalized 2026-10-06: extracted verbatim from the single-file `spec.md` (committed in `9dba5d3`) into this standalone checklist, the 031/032 pipeline layout. All six requirements are satisfied — evidence per row (the green runs recorded in `tasks.md` and `.specify/frontend-autopilot/phases/phase-14/report.md`).

- [x] R1 (FR-07) every action outcome surfaced — T002, E2E (the toasts leg: dates saved, tenant disabled, tenant re-enabled; the onboarding toast distinct-wording).
- [x] R2 (FR-02) sortable/filterable tenant table — T003, E2E (the sort/filter leg).
- [x] R3 (FR-03) dates validation feedback — T004, unit+E2E (C001 pinned the invalid case: inline error + guarded submit).
- [x] R4 (UX) vocabulary consistency with P12 — T001, unit (the stateLabel block).
- [x] R5 (FR-01) console landing posture — T005, E2E (the /admin posture leg) + unit (adminPosture 3/3).
- [x] R6 (A11y/Responsive) cards + axe on both admin routes — T006, E2E (the floor leg).
