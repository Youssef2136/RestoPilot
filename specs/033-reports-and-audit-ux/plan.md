# Implementation Plan: 033-reports-and-audit-ux (Frontend Phase 13)

**Mode**: Operate (honesty/readability over frozen read-only surfaces) · **Baseline**: `f59faea` · **Backend impact**: NOT_REQUIRED — the three contracts exist verbatim; D7 records the `get_audit_log` filter boundary instead of extending it

> Normalized 2026-10-06: extracted verbatim from the retroactive single-file `spec.md` (committed in `b1a871e`) into this standalone plan, the 031/032 pipeline layout. The implementation itself landed in `3356b7d` and is recorded in `.specify/frontend-autopilot/phases/phase-13/report.md`.

| Aspect | Decision |
|---|---|
| Routes | unchanged: /dashboard/reports, /dashboard/voids, /dashboard/audit |
| Components | PeriodControl stays inline; new: ReportBar (bar primitive), ClampNotice, honest ComparisonRow; reuse DataTable pattern classes for cards |
| State/data flow | existing react-query reads unchanged; comparison rows already one-call-per-branch (D2) — only the RENDER of pending/error/zero changes |
| Backend contracts | get_branch_sales_report / get_branch_void_report / get_audit_log — NOT_REQUIRED (read-only verbatim); D7 documents the filter-contract boundary |
| Responsive | CSS-grid card fallback < 720px; desktop-first tables preserved |
| Accessibility | bars aria-hidden with the table as text equivalent; clamp notice role="status"; comparison per-row posture read naturally by SRs; card layout keeps label/value pairing |
| Loading/empty/error | skeleton-free text states kept (house style); D6 zero hint; D1 failure row; void-log-empty + 'No audit entries match.' untouched |
| Testing strategy | unit: reportFormat (bar shares, clamp/threshold helper, period sentence); extend reports.test.ts? NO — frozen; NEW file tests/unit/reportFormat.test.ts. E2E: NEW e2e/reports.readability.test.ts (serial after reset) — clamp notice via seeded volume? NOT seedable cheaply → assert notice ABSENT below clamp + filters honest + 390px cards + axe on all three pages |
| Design strategy | tokens only; SimpleBar width = quantity / max(quantities) of the visible list |
