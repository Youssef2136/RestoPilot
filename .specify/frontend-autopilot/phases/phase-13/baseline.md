# Phase 13 — Baseline (INSPECT)

- Git: `f59faea` (feat(032), local main; **push to origin/main still pending — GCM
  interactive auth**, user pushes manually). Branch: main. Untracked-by-design
  unchanged (.agents/.specify/.freebuff/.zcode/specs/DESIGN.md/Master-Plan).
- Master Plan §Frontend Phase 13: Reports, Audit & Void Log UX (specs/033) — Mode:
  Read with operational framing; depends on 03/09; validation gates `npm run verify`
  + `npm run test:e2e`.

## What already exists (013 built the surfaces; 011/009/010 the contracts)
- `/dashboard/reports` (`ReportsPage.tsx`, 314 lines): scope picker (label 'Branch',
  hidden at single scope), period radios (Daily/Weekly/Monthly), 'Anchor date' input,
  `report-aggregates` dl (Rounds submitted / Rounds voided / Net total / Net tax),
  `report-channels` table (all three channels incl. zeros), `report-best-sellers` ol
  (+ 'No items sold in this period.'), owner-only `report-comparison` table (one call
  per branch, D2), 42501 refusal paragraph, denial via NotAuthorized.
- `/dashboard/voids` (`VoidReportPage.tsx`, 197 lines): branch picker, `void-log-table`
  (round/voided-by/when/reason/captured/channel), `void-log-empty` =
  'No voids recorded for this branch.', refusal paragraph.
- `/dashboard/audit` (`AuditLogPage.tsx`, 175 lines): branch select ('All my
  branches'), free-text Action input, `audit-table` (When/Action/Actor/Branch/Reason),
  rows carry `data-audit-action`, empty = 'No audit entries match.'.
- Clients: `reportsClient.ts` (fail-closed, verbatim params, ReportsPayloadError),
  `auditClient.ts` (p_limit default 100; useAudit passes 200; clamp 1..200 server-side;
  p_action EXACT match; no date/actor parameters in the contract).
- Unit: `tests/unit/reports.test.ts` (client mapping, no arithmetic — Constitution II).
- E2E anchors (frozen): `e2e/reports.surfaces.test.ts` (6 serial tests — picker options,
  comparison Downtown/Marina, aggregates labels, 3-channel zeros, future-anchor zero
  state + 'No items sold in this period.', manager NO picker + NO comparison, void-log
  surface, cashier/kitchen denials) and `e2e/bill.void.audit.test.ts` (audit-table with
  `round.void` row + reason, bob branch-scoped). `reports.surfaces:131` is the recorded
  environment-bound spec (isolated rerun protocol).

## Contracts (verified in migrations)
- `get_branch_sales_report(restaurant, branch, period, anchor_date)` — Monday-start
  weeks; buckets computed in the DATABASE timezone (20260922090000_branch_reports.sql
  §D2 note); returns from/to bounds → the page already mirrors them verbatim (the
  timezone story: server computes, page states the exact returned range).
- `get_branch_void_report(restaurant, branch, limit)` — overlay join with captured
  totals.
- `get_audit_log(action, branch_id, limit)` — exact-match p_action; newest-first
  (created_at desc, id desc) SERVER-side; clamp 1..200; owner restaurant-wide incl.
  branch_id-null rows; out-of-reach p_branch_id = 42501. NO date-range or actor
  parameters exist.
- `restaurants.timezone` column exists (default 'UTC') — not consumed by report RPCs
  (DB-timezone buckets per 013 D2).
- Ready components: ui/DataTable (sortable, aria-sort, horizontal-scroll fallback),
  money/TotalsPanel, ui/Alert — plus formatPrice (the only money path).

## The real phase-13 gaps (after narrowing)
1. Comparison partial failure renders '—' (reads as "no data", not a failure) and has
   no explicit same-period statement (FR-05).
2. No clamp-reached notice when the audit page returns a full 200 (state matrix row).
3. No mobile card fallback for the three tables (DataTable doc: per-surface decision
   for a later phase — this phase owns report surfaces); no 390px E2E for them.
4. No token-driven bars/visual for channels/best-sellers (FR/Visual; no chart dep).
5. Long void/audit reasons render full-width with no truncation + full-value affordance.
6. Zero period vs empty not visually distinguishable (zero hint missing).
7. Action filter has no exact-match affordance hint; date-range/actor filters CANNOT
   be added without a backend change (not authorized) — decision recorded, not faked.

## Validation posture carried forward
db:reset before every gated E2E run; workers=1/timeout=90s for full screens;
`tsc -b` (never --noEmit) gates e2e; isolated rerun protocol for legacy environmental
specs; no process overlap before gated runs (shared cloud DB has live writers).
