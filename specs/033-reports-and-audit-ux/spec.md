# specs/033 — Reports, Audit & Void Log UX

## spec.md

### Purpose
Make operational truth readable on the existing three read-only surfaces
(`/dashboard/reports`, `/dashboard/voids`, `/dashboard/audit`) — figures come from the
RPCs verbatim; the phase upgrades HONESTY and READABILITY, not the contract.

### Decisions (D1–D7)
- **D1 — Comparison honesty (FR-05).** Every comparison row states its own posture:
  the period sentence renders once above the table ('Same period for every branch:
  …'), a pending row shows 'Loading…', a failed row renders 'Load failed — the
  figures for this branch could not be loaded.' with `role="status"` per-row, and a
  zero row is distinguished from a failed one. Partial failure is never '—'.
- **D2 — Clamp notice (state matrix).** When the audit page returns a FULL 200-entry
  page, a notice renders: 'Showing the most recent 200 entries — narrow the filters
  to see more.'; below the clamp nothing renders. 200 is the page size the client
  already requests (useAudit limit: 200; server clamp 1..200).
- **D3 — Mobile card fallback (Responsive).** The three tables fall back to card rows
  below the mobile breakpoint via CSS grid on `data-table-*` wrappers — no DOM fork,
  assertions bind by testid/text regardless of layout. Money columns stay
  horizontal-safe.
- **D4 — Bars, dependency-free (FA-10).** Channel breakdown and best-sellers gain a
  token-driven bar (`--color-…`/`--radius-sm` only; width = share of the row's max;
  no charting dependency). Bars carry NO meaning that the adjacent numbers don't
  already state (a11y: text equivalent is the table itself; bars aria-hidden).
- **D5 — Reason truncation (Visual).** Long reasons truncate at ~48ch with the full
  value available (title attr + wrap on card layout; never clipped unread by SRs —
  full text stays in the DOM, CSS `line-clamp` only).
- **D6 — Zero vs empty (UX).** An all-zero aggregates grid renders a hint line under
  the grid: 'Nothing was recorded in this period.' — zeros stay rendered (the server
  figures, byte-for-byte) and the hint distinguishes an empty period from a broken
  one. Existing zero-state assertions ('0' visible, best-sellers empty note) hold.
- **D7 — Filter honesty (FR-07 within the contract).** The Action filter states its
  exact-match semantics in its description ('matching exactly, e.g. round.void').
  Date-range/actor filters are NOT added: `get_audit_log` has no such parameters and
  the backend is not authorized to change (recorded; FR-07 satisfied to contract).

### Out of scope (unchanged from the Master Plan)
No new RPCs, no client money aggregation, no exports, no charting dependency, no
cashier/kitchen rendering, no accounting framing.

### Frozen anchors (must pass unedited)
`e2e/reports.surfaces.test.ts` (6 tests), `e2e/bill.void.audit.test.ts`
(audit/void assertions), `tests/unit/reports.test.ts`, all `data-testid` hooks,
formatPrice everywhere, denial/refusal copies verbatim.

## plan.md

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

## tasks.md

- **T001** `src/features/reports/reportFormat.ts` — `barShare(value, max)` (0..1, 0 for
  max<=0), `comparisonPeriodSentence(period, from, to)`, `isClampReached(count, limit)`
  + `CLAMP_PAGE_SIZE = 200`. Unit `tests/unit/reportFormat.test.ts`.
- **T002** ReportsPage: comparison honesty (D1 — period sentence, per-row status with
  role="status", failure text), zero hint (D6), channel/best-seller bars (D4).
- **T003** AuditLogPage: clamp notice (D2), action-filter hint (D7), reason truncation
  (D5) via CSS.
- **T004** VoidReportPage: reason truncation (D5).
- **T005** Card-fallback CSS for the three tables (D3) — module.css per page.
- **T006** `e2e/reports.readability.test.ts` (3): honest comparison partial posture is
  covered at unit level + live zero/empty; E2E asserts (1) period sentence + bars +
  zero hint visible with existing journeys, (2) audit filter hint + clamp absence +
  exact-match behavior unchanged, (3) 390px: all three pages render card rows with no
  horizontal overflow + axe passes on the three desktop pages.

## checklists/requirements.md (R1–R6)

- R1 (FR-05) comparison states same-period + per-row posture — T002, unit + E2E.
- R2 (state matrix) clamp notice at exactly-limit pages — T003, unit.
- R3 (Responsive) card fallback 390px, no overflow — T005/T006, E2E.
- R4 (FA-10) bars token-driven, no dep, aria-hidden — T002, unit+E2E.
- R5 (Visual) reason truncation w/ full text in DOM — T003/T004, unit (CSS) + E2E.
- R6 (D6/UX) zero hint distinguishable from empty — T002, E2E.

## checklists/realtime-fidelity.md → renamed focus: presentation-fidelity.md (F1–F4)

- F1 figures byte-for-byte from RPCs — no arithmetic added (formatPrice only).
- F2 frozen E2E assertions preserved unedited; new suite additive.
- F3 denials/refusals verbatim; cashier/kitchen never render these surfaces.
- F4 audit reach/reachability server-owned; filters exact-match; clamp honest.

## analysis.md

Spec-vs-plan consistency: D7 records the FR-07 filter-set boundary (exact-match only
in the contract; no date/actor params — backend NOT_REQUIRED, no contract change
authorized). No contradictions found between the Master Plan scope and the existing
013 surfaces; the phase is an honesty/readability upgrade over frozen contracts.
