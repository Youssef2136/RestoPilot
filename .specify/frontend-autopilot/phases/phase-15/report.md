# Phase 15 — Report (specs/035 · Accessibility Hardening)

## Final status
**DONE — converged** — T001–T017 complete, every validation gate green on the final
tree, convergence found zero gaps (tasks.md byte-unchanged), no Category-A
migrations, nothing committed (awaiting the user's word).

## Objective
Turn accessibility from "labels and alert roles" into a verified property of the
whole product: keyboard-complete, screen-reader-correct, contrast-compliant,
target-size-safe, motion-honest — every route in its authorized state, findings
either fixed or recorded with a reason and an owner (clarify: WCAG 2.2 AA
automatable confirmed; forced-colors audit-and-record; serious-plus fixes).

## Requirements → implementation summary
- **T001** the audit record opened: `specs/035/audit/report.md` — 27-row route×state
  inventory (router.tsx + seedCredentials) + the recorded 031 A3 finding seeded.
- **T002** `e2e/helpers/a11y.ts` extended: `MatrixRow`/`scanMatrixRow` (signed-out /
  per-identity / Fiona-lock reach) + `expectShellFloor` (one `#main`, skip link first
  in Tab order) — rule tags and baseline discipline untouched.
- **T003** `e2e/a11y.matrix.test.ts` — 31 serial rows: public, per-role staff, denial
  views as-seen, the Fiona bootstrap, the 404 catch-all, deep links. First run 29/31.
- **T004** matrix findings fixed: **F-002** (NotFoundView/RouteErrorView rendered a
  second nested `<main id="main">` — labelled sections now; axe's landmark rules sit
  outside the wcag tags, the shell floor caught it), **F-003** (BranchesPage's bare
  native submit ~21px + a 23px back-row gap — the system Button + token spacing). → 31/31.
- **T005/T006** `e2e/keyboard.journeys.test.ts` (4): customer ordering keyboard-only
  (Marina T1 under its locks, T1 activation in setup — an inactive table is hidden
  from the public entry), the 390px mobile drawer (open→contained→Escape→restore),
  the T2 session close (dialog containment/Escape/restore/confirm), onboarding
  (form → distinct toast → credential copy status).
- **T007** the proven walks extended: cashier — Show bill via Space with focus
  retention and the void dialog keyboard-only (open→contained→Escape→restore→confirm,
  retried through live refetches via toPass — the keyboard twin of click's wait);
  kitchen — shell-chrome focus parked across a full poll cycle (no steal).
- **T008** the journeys exposed **F-005**: the shared ConfirmDialog could strand
  closed when a close notification raced a re-render (Enter inside its form) — fixed
  with a render-synced open-state effect in `Dialog.tsx`; regression batch 44/44.
  Keyboard maps documented in `docs/accessibility.md`.
- **T009/T010** the announcement surfaces unit-pinned
  (`announcementSurfaces.test.tsx`: polite-only, EXACTLY ONE polite live region per
  operational surface, inert outcome markup, dedupe silence — the 032 policy map was
  already pinned); E2E: one-arrival-one-announcement leg added to the kitchen walk;
  the remaining legs cited to their existing pins.
- **T011** `e2e/touch.targets.test.ts` (3): axe's OWN target-size rule at 390/834 —
  the in-session cart ground zero green (the 031 A3 fix proven standing); it also
  exposed **F-006** (AuthCard controls at intrinsic ~21px, 3px apart — token
  min-heights + rhythm in the card subtree). The first prototype's raw-geometry
  standard (stricter than WCAG 2.5.8 (d)) is recorded as EXC-003.
- **T012** `specs/035/audit/contrast.md` — 11/11 text + 4/4 non-text pairs PASS, zero
  exceptions. **T013/T014** `e2e/motion.preferences.test.ts` (3): reduced-motion
  media-reach + function holds, forced-colors audit-and-record (gap = EXC-002), zoom
  200% reflow (entry overflow 0; staff board functional).
- **T015/T016** `exceptions.md` (EXC-001..003 with reasons + owners — zero
  serious-plus outstanding) + the W1–W5 automated-proof rows; `docs/accessibility.md`
  (keyboard maps + proof index), development.md + conventions.md pointers, the ledger
  §Phase 035 record (**zero Category-A — no pinned name/copy moved**).

## Files changed (the working tree, uncommitted)
New: `e2e/a11y.matrix.test.ts`, `e2e/keyboard.journeys.test.ts`,
`e2e/touch.targets.test.ts`, `e2e/motion.preferences.test.ts`,
`tests/unit/announcementSurfaces.test.tsx`, `src/routes/BranchesPage.module.css`,
`docs/accessibility.md`, `specs/035-accessibility-hardening/*` (the full pipeline
layout), `specs/035/audit/{report,exceptions,contrast}.md`. Modified:
`e2e/helpers/a11y.ts`, `e2e/cashier.operations.test.ts`, `e2e/kitchen.display.test.ts`,
`src/components/NotFoundView.tsx`, `src/components/RouteErrorView.tsx`,
`src/components/ui/Dialog.tsx`, `src/components/auth/AuthCard.module.css`,
`src/routes/BranchesPage.tsx`, `docs/conventions.md`, `docs/development.md`,
`docs/frontend-presentation-contracts.md`, `.specify/feature.json`.

## Backend contracts used
NONE — no RPC, type, RLS, or authorization change anywhere; denial views disclose
nothing new (constitution III/IV untouched).

## Validation results
- Unit: **434/434** (announcementSurfaces 4 new).
- E2E: **244/244** batched over the reset DB — a11y.baseline 5 + a11y.matrix 31 +
  keyboard.journeys 4 + touch.targets 3 + motion.preferences 3 + everything else
  green (two first-pass realtime/full-journey timing flakes green isolated; the
  batch-C early-stop remainder re-run green).
- `npm run verify` EXIT 0 on the final tree: format/lint/tsc clean, test:db green,
  test:integration green, build OK (788.96 kB JS / 218.02 kB gzip).

## Convergence
`converged` — zero findings (11 FR + 6 SC + 17 tasks + 7 plan decisions + 8
constitution principles checked); tasks.md byte-unchanged (hash 9030fb2a).

## Git checkpoint
Baseline `c554f03` (= origin/main at phase start). The phase lives in the working
tree, UNCOMMITTED by design — the autopilot does not commit without the user's
request; suggested: `fix(035): ...` per the Master Plan's git-checkpoint note.

## Remaining warnings / blocked items
EXC-001 (the human screen-reader runs of W1–W5 — scripts frozen, owner-owned),
EXC-002 (forced-colors palette = a future design-system amendment), EXC-003 (the
sweep-prototype lesson). Environmental: db:reset before every Playwright batch; the
full Playwright run exceeds a 10-minute window — batched closure is the protocol.
