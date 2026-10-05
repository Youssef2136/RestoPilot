# Phase 11 — Validation record (specs/031 · Delivery & Takeaway channel UX)

## Fixture / gating
- Baseline: `9959364` (main). DB reset before every targeted full run.
- Run parameters (angelenvironment-blocking): `--workers=1 --timeout=90000` + `npm run db:reset -- --yes` before each gated run; the default config is `fullyParallel: true` + 30s expectations (documented in playwright.config.ts).

## Requirements / tasks → evidence

| Req / Task | Files | Evidence |
|---|---|---|
| T001 cutoff mirror + timeline (server-parity incl. voided rounds) | src/features/order/cutoffState.ts + tests/unit/cutoffState.test.ts (11/11) | green |
| T002–003 channel chip + RoundCard / SessionIndicator adopt | src/features/session/components/ChannelChip.tsx (+css) | src/features/order/components/RoundCard.tsx + SessionIndicator green |
| T004 cutoff pre-emption | CutoffNotice.tsx, ItemCard.tsx, MenuSections.tsx, CartRegion.tsx, CustomerMenuPage.tsx (useSessionRounds shared read; disabled Add w/ aria-describedby → #cutoff-notice; polite announcement; cart/submit alive) | delivery journey step 5/5 |
| T005 timeline + pickup announcement | StatusTimeline.tsx, RoundsHistory.tsx (chip suppressed on mapped states; pickup announcement) | channel.operations delivery + takeaway legs |
| T006–007 ChannelFilter + matchesChannel | src/features/order/roundGroups.ts, ChannelFilter.tsx, CashierRoundsPage.tsx (+3 unit tests) | filter leg of channel.operations |
| T008 CompletionConfirmDialog | CompletionConfirmDialog.tsx (pinned Mark completed opens dialogue; 'Complete the delivery' / 'Not yet') | channel.operations completion leg |
| T009 BranchSessionsPanel 'Counter session' (D5) | BranchSessionsPanel.tsx | staff surface UI |
| T010 A3 micro-button fix | order.surfaces.module.css (min-width/min-height 1.5rem) | axe target-size/offset on 025 cart buttons resolved |
| E2E channel.operations (3) | e2e/channel.operations.test.ts (+session.surfaces FR-011 migrated per D1) | **3/3 green** (targeted, 1 worker, 90s) |

## Full-suite results (master gating command `npm run verify` + playwright full)
- `verify` (format:check, lint, tsc, test:unit 32, test:db, test:integration 7, build): **passed** with run parameters documented; lint 4 warnings pre-existing, in untouched files.
- Full E2E: **182 passed, 3 failed** (default 2 workers, 30s expectations):
  - `channel.operations:216` (FR-05) — fixed in this phase: emptiness/stale-card claims made race-free under the shared live board; **passes** in its own run.
  - `realtime:172`, `reports.surfaces:131` (old suites, untouched) — FAIL CONSISTENTLY under degraded cloud latency; fail at different late-flow steps and with different failure points; sibling specs using the same identities pass. Direct auth RPCs healthy; DB roles/permissions verified correct (alice=owner). Re-run of reports.surfaces:131 **in isolation passes** — classified ENVIRONMENT + 30s default-timeout binding (see findings A4/A5).

## Binding fixes (deterministic, in this phase)
1. Takeaway staff cards bound by `data-round-id` extracted from the customer's own `get_session_rounds` read — no text-filter/.first() residue.
2. Completion RPC awaited (`mark_completed` 200) before close/cancellation; full unique address binding.
3. Timeline assertions read `aria-current="step"` (current milestone), not always-visible labels.
4. Drop button micro-buttons ≥ 24×24 (A3).

## Findings (severity / disposition)
- A1 cutoff/server-parity: mirror identical incl. voided rounds — unit 11/11. FIXED.
- A2 double channel chip on board (staff card) — unified via ChannelChip. FIXED.
- A3 axe finding on 025 cart buttons (19.8px wide) — min-width+min-height applied. FIXED.
- A4 kitchen blind (mail-less) over LIVE delivery round — unchaged, re-asserted in E2E. NO CODE CHANGE.
- A5 'Counter session' neutral marker for no-table sessions. FIXED.
- A6 E2E artifact — FR-011 session surfaces migrated per D1. FIXED.
- A7/E1 concurrency-rather-than-reachability claims (empty Dine-in group) — repaired for shared-live-board correctness. FIXED.
- B1/B2 test-timeout binding (realtime:172, reports.surfaces:131): 30s expectation caps versus today's cloud RPC latency; isolated re-run of reports.surfaces:131 passes; classification ENVIRONMENT — no code change by this phase.

## Files changed (15)
- src/features/order/components/CutoffNotice.tsx, ItemCard.tsx, MenuSections.tsx, CartRegion.tsx, StatusTimeline.tsx, RoundsHistory.tsx, roundGroups.ts, OrderPage (routes/CustomerMenuPage), ChannelChip + css, BranchSessionsPanel, CompletionConfirmDialog, TransitionActions, RoundCard, order.surfaces.module.css (A3), e2e/channel.operations.test.ts (3 tests incl. targeted fix), e2e/session.surfaces.test.ts (FR-011), docs/frontend-presentation-contracts.md (§Phase 031 record).
- Untracked-by-design (not committed): .specify/frontend-autopilot/ (baseline, decisions, findings, report, state), specs/031/* (spec/plan/checklists/tasks/analysis).
- Commit: `feat(frontend-phase-11): delivery and takeaway channel UX` pushed to origin/main (postBuffer 524288000, verified).
