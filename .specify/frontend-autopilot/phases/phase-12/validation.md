# Phase 12 — Validation record (specs/032 · Realtime, Notifications & Subscription Awareness UX)

## Fixture / gating
- Baseline: `6591d49` (main). `npm run db:reset -- --yes` before every gated E2E run.
- Run parameters (environment-blocking): `--workers=1 --timeout=90000`; the default
  config is `fullyParallel: true` + 30 s expectations (playwright.config.ts).

## Requirements / tasks → evidence

| Req / Task | Files | Evidence |
|---|---|---|
| T001 central announcement policy (FR-07) | src/features/realtime/announcementPolicy.ts + tests/unit/announcementPolicy.test.ts | **9/9 green** (byte-identical pinned copy, politeness, 1 s dedupe guard) |
| T002 rewire cue/reconnecting/offline banners onto the policy | NewRoundCueBanner.tsx, ReconnectingBanner.tsx, shell/OfflineBanner.tsx | zero DOM change; realtime.test 14/14 untouched; all frozen pins hold |
| T003 subscription detail + copy map (FR-05, D5) | subscriptionCopy.ts, SubscriptionDetailPanel.tsx (+module.css), SubscriptionBanner.tsx mount | subscriptionCopy **5/5** (incl. the REVERSED platform_disabled truth); live.awareness nearing journey asserts banner state + detail + collapse |
| T004 cue supersede pin (FR-02) | tests/unit/newRoundCue.supersede.test.ts | **3/3** (INSERT supersedes; current-round advance clears; foreign UPDATE ignored) |
| T005 cross-file subscription lock + awareness E2E | e2e/helpers/subscriptionLock.ts, e2e/platform.surfaces.test.ts (wrap only), e2e/live.awareness.test.ts (2) | platform.surfaces date journeys 2/2 (assertions untouched); **live.awareness 2/2 green** (46 s targeted) |
| Full verify | npm run verify | green across rounds on the final tree: format:check, lint, typecheck (`tsc -b`), test:unit, **test:db 31 files 516/516**, **test:integration 7 files 38/38**, **build ✓** (see findings B1 for the environmental noise history) |
| Full E2E screen | npx playwright test --workers=1 --timeout=90000 | **184 passed / 24.0 m**; 1 legacy-environmental failure (reports.surfaces:131) + 2 serial siblings skipped; **isolated rerun 6/6 EXIT:0** — every one of the 187 tests has a passing run |

## Accessibility / responsive evidence (this phase)
- SubscriptionDetailPanel: `aria-expanded` disclosure, in-flow (no route), approved
  tokens only (`--color-border`, `--radius-sm`, `--color-surface-raised`).
- Cue announcements: `role="status"` unchanged; politeness from the policy map.
- 390 px with the live cue visible: no horizontal overflow (asserted in live.awareness);
  cue stays in flow, affordances reachable.

## Findings (severity / disposition)
- F1 websocket typing (HIGH, gate-only) — fixed via the proven page-level listener pattern. FIXED.
- F2 'Activate' vs 'Change dates' after reset (MEDIUM, test) — handled. FIXED.
- F3 whitespace-coupled banner text assertions (LOW, test) — asserted by parts. FIXED.
- B1 shared-cloud residue + live writers + transient worker-fork spawn failures (MEDIUM/ENV) — no code change; protocol: confirm no overlap → reset → rerun. DOCUMENTED.
- B2 reports.surfaces:131 legacy environmental + serial siblings skipped (MEDIUM/ENV) — isolated rerun 6/6 green. DOCUMENTED (same classification as phase 11).
