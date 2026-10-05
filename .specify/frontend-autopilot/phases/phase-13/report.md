# Phase 13 — Report (specs/033 · Reports, Audit & Void Log UX)

## Final status
**DONE** — T001–T006 complete, every validation gate has a green run on the final
tree, no unresolved CRITICAL/HIGH findings, state persisted, checkpoint created.

## Objective
Make operational truth readable on the existing three read-only surfaces
(`/dashboard/reports`, `/dashboard/voids`, `/dashboard/audit`) — figures stay
byte-for-byte from the RPCs through `formatPrice` (Constitution II: no new
arithmetic); the phase adds honesty (comparison posture, clamp notice, zero hint,
filter semantics) and readability (token bars, reason truncation, mobile card
fallback) with zero frozen anchors moved.

## Requirements → implementation summary
- **T001** `reportFormat.ts` — `isClampReached` (exactly-limit pages),
  `barShare` (zero-safe share of the visible max), `comparisonPeriodSentence`
  (server bounds restated). Unit 7/7.
- **T002** ReportsPage — comparison states its same-period guarantee with per-row
  posture ('Loading…' / 'Load failed — the figures for this branch could not be
  loaded.' under `aria-live="polite"`; the silent '—' is gone); 'Nothing was
  recorded in this period.' under untouched zero figures; aria-hidden token bars on
  channels + best-sellers (no charting dependency).
- **T003** AuditLogPage — 'Showing the most recent 200 entries — narrow the filters
  to see more.' only at full pages; the Action filter states its exact-match
  semantics (`aria-describedby`); reasons clamp at two lines (full text in DOM).
- **T004** VoidReportPage — the same reason treatment.
- **T005** One shared module.css — card fallback below 720px: CSS-only reflow
  (`data-label` cells, thead out of flow, money columns wrap-safe), no DOM fork.
- **T006** `e2e/reports.readability.test.ts` (4, serial, read-only): period sentence
  + bars + zero hint; filter semantics + clamp absence; the 390px walk over the
  three pages (overflow ≤ 0); axe WCAG 2.2 AA on the three desktop pages.

## Files changed (8, all committed in the checkpoint)
New: `src/features/reports/reportFormat.ts`, `tests/unit/reportFormat.test.ts`,
`src/features/reports/reports.surfaces.module.css`,
`e2e/reports.readability.test.ts`.
Modified: `src/routes/{ReportsPage, AuditLogPage, VoidReportPage}.tsx`,
`docs/frontend-presentation-contracts.md` (§Phase 033 appended).

## Backend contracts used (ALREADY_SUPPORTED — no backend change)
`get_branch_sales_report` (DB-timezone buckets per 013 D2; from/to rendered
verbatim), `get_branch_void_report`, `get_audit_log` (exact-match p_action, clamp
1..200, newest-first server-side). Recorded boundary: NO date-range/actor parameters
exist in `get_audit_log`; FR-07 is satisfied to contract — anything more is an
unauthorized backend change.

## Validation results
- Unit: reportFormat 7/7 (+ frozen reports.test 6/6 = 13/13 across both files).
- `npm run verify`: green across rounds on the final tree — format:check, lint
  (0 errors; 4 pre-existing warnings), `tsc -b`, test:unit, **test:db 516/516**,
  **test:integration 38/38**, **build ✓**.
- Targeted E2E: readability 4/4 + frozen reports.surfaces 6/6 = **10/10, EXIT:0**
  (after reset, workers=1/90 s).
- Full E2E: **183/191 passed** (23.8 m); 3 environment-flavored failures + 5 serial
  siblings skipped; **isolated rerun of the three files 21/21, EXIT:0** — every one
  of the 191 tests has a passing run. No frozen anchor moved.

## Convergence / fixes
F1 lint (`role="status"` on `td` → `aria-live="polite"`); F2 strict-mode cell
assertions (`.first()`); F3 the empty-trail 390px posture; F4 draft residue removed
pre-gate; F5 ledger prettier. B1/B2 environmental (external writers, fork-spawn
flake, isolated-rerun protocol) — documented, no code change.

## Git checkpoint
`feat(033)` commit on main (baseline `f59faea`); **push pending** — the previous
phase's `f59faea` is also unpushed (GCM interactive-auth block; the user pushes
manually). Both commits push together with `git push origin main`.

## Remaining warnings / blocked items
None blocking. Environmental notes carried forward: `reports.surfaces:131` (legacy,
isolated-rerun protocol), transient 0xC0000142 worker-fork spawns (rerun once),
shared cloud DB live writers (no overlap + reset before gated runs), GCM push from a
non-interactive shell (user pushes manually).
