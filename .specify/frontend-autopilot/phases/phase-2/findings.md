# Phase 02 Findings & Actions

**Date:** 2026-09-27 · **Baseline:** `a707a27` · **Checkpoint:** `306c0ae`

## F1 — axe floor caught real primitive defects before shipping (HIGH → FIXED, gate proven)

First gallery axe run surfaced 4 defect classes across the new primitives:
(1) controls inside `Field` without an explicit id had no label association
(7 nodes, critical) — fixed by extending the Field wiring context to carry
`fieldId` (controls auto-adopt the label's `for`); (2) `Tabs` shipped a
detached `TabPanel` whose `aria-controls` pointed at a nonexistent panel
(critical) — API reworked so Tabs owns the tab↔panel wiring via a `panels`
prop; (3) `TotalsPanel` grand-total row rendered `dt`/`dd` outside a `dl`
(serious) — wrapped in its own `dl`; (4) sub-24px touch targets on
checkboxes (20px) and alert/toast dismiss buttons ( axe target-size,
serious) — sized to ≥24px with the WCAG 44px comfort minimum documented as
a primary-action-only rule. Re-run: **0 violations on all 3 viewport
projects**. The floor works; it is not decorative.

## F2 — Invalid top-level CSS declaration broke the production build (HIGH → FIXED)

`caret-color` was written at the top level of base.css (outside any
selector) — dev-mode CSS tolerated it; lightningcss minify rejected it
(`Invalid token in pseudo element`), failing `npm run build`. Fixed by
moving it onto `body` (caret-color inherits). Lesson recorded: the dev
server masks invalid global CSS; only the production build catches it —
the build gate stays mandatory per change batch.

## F3 — Detector caught a layout-thrash transition (LOW → FIXED)

`impeccable detect` flagged `transition: width` on `ProgressBar`'s fill.
Replaced with compositor-only `transform: scaleX()` driven by the fraction
(component sets it, CSS owns the easing). `detect src` now returns 0
anti-patterns — the Phase 15/18 baseline stays clean through Phase 02.

## F4 — e2e spec-020 walkthrough poisons Fiona's seeded password mid-run (HIGH → CARRIED FORWARD, owner task)

`auth.routes`' full-walkthrough test changes Fiona's password
(`dev-fiona-2026` → `dev-fiona-020-temp`) and restores it at the end. Any
mid-test failure (e.g. after a 429 from the auth rate limit) leaves the
poisoned password; `db:reset` deliberately never touches the auth schema,
so the poison survives resets and every later suite signing in as Fiona
fails (`Invalid login credentials` → stuck on /signin). Diagnosed live
during the phase (proven: temp password signed in; documented password
rejected), repaired via the app's own verify-then-update flow, and recorded
as an addition to the W1 owner task (fixture-mutation class, Phase 14
candidate). Restoration helper one-liner kept in this file's git history.

## F5 — Integration suite parallel-run failures reproduce W1 exactly (MEDIUM → DOCUMENTED)

`npm run test:integration` failed 1–2 files per run with the failure
identity rotating between runs (auth.signin → order.journey →
password-change); every suite passed isolated (38/38 across targeted
runs). Same signature as Phase 01 W1 (fixture residue × vitest file
parallelism × auth rate-limit budget). No phase-02 code can cause this
(the phase ships no data-layer code). Carried under W1.

## F6 — Viewport-project scope widened by one suite (LOW → DECLARED)

The mobile/tablet Playwright projects previously ran ONLY
`responsive.smoke.test.ts`; Phase 02's FR requires the gallery to hold at
the shipped viewports, so `playwright.config.ts` testMatch now includes
`design.system.test.ts` (and the chromium project testIgnores it). Budget
grows by one small suite, not the 13; change recorded here per the
declare-don't-absorb rule.

## F7 — Environmental (documented, unchanged)

- W1 residue/ordering defect: as Phase 01 (F7 there); the full-suite E2E
  run showed 4 failures (auth.routes walkthrough ×2 — the F4 poisoning,
  full-journey, management.surfaces, reports.surfaces); after fixture
  restoration, the four suites re-ran together: 35/36 passed with the
  Fiona-dashboard failure again, and **management.surfaces passed 14/14
  isolated** minutes later. Pre-existing, owner-level, not phase code.
- 429 windows: one occurrence during back-to-back integration runs;
  D9's quiet-window protocol applied; final targeted runs clean.
