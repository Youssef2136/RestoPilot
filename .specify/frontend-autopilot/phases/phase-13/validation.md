# Phase 13 — Validation record (specs/033 · Reports, Audit & Void Log UX)

## Fixture / gating
- Baseline: `f59faea` (main, local). `npm run db:reset -- --yes` before every gated
  E2E run; `--workers=1 --timeout=90000`; no process overlap before gated runs.
- `npx tsc -b` gates e2e typing (never `--noEmit`).

## Requirements / tasks → evidence

| Req / Task | Files | Evidence |
|---|---|---|
| T001 presentation helpers (R2/R4, D1) | src/features/reports/reportFormat.ts + tests/unit/reportFormat.test.ts | **7/7 green** (clamp at exactly-limit, zero-safe bar shares, period sentence) |
| T002 comparison honesty + zero hint + bars (FR-05/D1, D6, D4) | src/routes/ReportsPage.tsx | frozen reports.surfaces passes unedited; readability E2E asserts sentence/bars/hint; lint-fixed `aria-live` posture (F1) |
| T003 clamp notice + filter hint + reason clamp (D2, D7, D5) | src/routes/AuditLogPage.tsx | readability E2E: hint visible, `aria-describedby`, exact-match unchanged, clamp notice absent below 200 |
| T004 void-log reason truncation (D5) | src/routes/VoidReportPage.tsx | styles (`-webkit-line-clamp`, title attr, full text in DOM) |
| T005 card fallback CSS (D3/R3) | src/features/reports/reports.surfaces.module.css | 390px walk: overflow ≤ 0 on all three pages; labelled rows proven on the channels table |
| T006 readability E2E | e2e/reports.readability.test.ts (4, serial, read-only) | **4/4 green** (targeted twice; inside the full screen) |
| Frozen anchors | e2e/reports.surfaces.test.ts (6), e2e/bill.void.audit.test.ts, tests/unit/reports.test.ts (6) | targeted 10/10 with the new suite; **no assertion edited** |

## Full-suite results (master gating command `npm run verify` + playwright full)
- `verify`: green across rounds on the final tree — format:check, lint (0 errors;
  4 pre-existing warnings), typecheck (`tsc -b`), test:unit, **test:db 31 files
  516/516**, **test:integration 7 files 38/38**, **build ✓** (environment history in
  findings B1: external writers, one lint stop F1, transient 0xC0000142 fork spawns).
- Full E2E (workers=1, timeout=90 s, 23.8 m): **183/191 passed**; 3
  environment-flavored failures (cashier.operations Marina journey, the recorded
  legacy reports.surfaces:131, shell offline flip) + 5 serial siblings skipped;
  **isolated rerun of the three files: 21/21, EXIT:0** — every one of the 191 tests
  has a passing run. No frozen anchor moved.

## Accessibility / responsive evidence (this phase)
- Bars are `aria-hidden` beside the unchanged numbers (the table is the text
  equivalent); clamp notice and filter hint are plain text + `aria-describedby`;
  comparison posture via `aria-live="polite"` (lint-clean form).
- Card fallback keeps the semantic table for SRs; labels via CSS `content:
  attr(data-label)`; no overflow at 390px on the three pages (asserted live).
- axe (WCAG 2.2 AA floor, baseline helper): the three report pages pass on desktop
  (readability suite leg 4).

## Findings (severity / disposition)
- F1 role=status on td (MEDIUM, lint) — `aria-live="polite"`. FIXED.
- F2/F3 strict-mode + empty-trail test posture (LOW) — `.first()`/honest pair. FIXED.
- F4 draft residue (LOW) — removed pre-gate. FIXED.
- F5 ledger prettier (LOW, docs) — formatted. FIXED.
- B1/B2 environmental (MEDIUM/ENV) — external writers, fork-spawn flake, three-file
  isolated reruns 21/21. DOCUMENTED (established protocol).
