# Phase 16 — Report (specs/036 · Responsive & Device Hardening)

## Final status
**DONE — converged (first round)** — T001–T016 complete, every validation gate
green on the final tree, convergence found zero gaps, zero Category-A migrations,
nothing committed (awaiting the user's word).

## Objective
Turn responsiveness from "looks fine on my screen" into a contract: a 26-route
device contract with token-literal breakpoints (640/1024/1440), zero horizontal
overflow at 320px, card fallbacks for every data table, orientation-safe
cashier/kitchen surfaces, and an overflow oracle that fails the build — every
claim proven mechanically, every deviation recorded with a reason (clarify:
breakpoints literal in media queries; card fallback = same disclosure; sticky
pattern reuses the 025 cart bottom sheet; walkthroughs human-owned).

## Requirements → implementation summary
- **T001** `specs/036-.../spec.md` — 5 stories US1–US5, FR-01..10, SC-001..006 +
  the 16/16-CHK `checklists/responsive-fidelity.md`; clarify section
  `## Clarifications (session 2026-10-07)` encodes the four answers.
- **T002** plan.md (constitution I–VIII PASS, decisions D1–D7) + research.md
  (R1–R9) + quickstart.md (W1–W5).
- **T003** `e2e/helpers/responsive.ts` rewritten final: 11 named VIEWPORTS,
  `setViewport`/`rotate`/`keyboardShrink`, and `expectNoHorizontalOverflow` —
  root `scrollWidth` + a right-edge sweep, scroll-container `overflow-x: auto`
  exemption, hidden/zero-size ignored, 2px tolerance. The overflow sweep
  (6/6) exposed **F-036-01**: management `.layout` and CustomerMenuPage
  `.page`/`.menuLayout` lacked `grid-template-columns: minmax(0, 1fr)`, so
  nowrap pill navs forced a 114px/46px overflow at 320px — root-caused and
  fixed; sweep green.
- **T004** the orientation/keyboard-shrink devices `(2+2+2)`: cashier Show-bill
  and void flow landscape-degraded not broken (2/2); kitchen legs appended to
  `e2e/kitchen.display.test.ts` — board identity/state readability at
  768/1600/1920; new tickets carry NO action buttons by design (handed-off tickets
  are read-only); keyboard-shrink legs 2/2.
- **T005** sticky pattern decision D5 recorded: the 025 cart bottom sheet IS the
  in-session sticky action surface — no new StickyActionBar component was built
  (FA-5 reuse); cashier landscape proof 2/2.
- **T006** `specs/036-.../device-contracts.md` — the 26-route contract
  (management/customer/scanner/staff boards), the shell rule, and the
  media-audit table (15 real queries).
- **T007** covered by the kitchen legs above (7/7 on the suite, including the
  new 720px read-only legs).
- **T008** `DataTable` gained `cardBreakpoint` + `useCardFallback`
  (matchMedia, SSR-safe); `tests/unit/dataTableCardFallback.test.tsx` 4/4.
- **T009** table fallbacks: five of six tables ALREADY fell back via the 026
  `data-label` / reports `cardTable` pattern — recorded as-built; only
  TaxPreview was unstyled → joined `cardTable` (same disclosure, same tap
  order). Same-disclosure proof `e2e/responsive.sameDisclosure.test.ts` 2/2.
- **T010** desktop 1920/2560 regression walk 2/2.
- **T011** real void-audit rows: `e2e/bill.void.audit.test.ts` 2/2 (bob reads
  `/dashboard/audit`, carla's denial intact — the seeded DB starts empty, so the
  pre-existing suite seeded its own evidence first).
- **T012** `e2e/responsive.orientation.test.ts` redesigned — scroll-preservation
  moved to `/dashboard/menu` (carla's dashboard is too short to scroll);
  3/3 green.
- **T013** media-query audit: 15 real queries across the CSS; three drift
  values normalized to the token literals (max-767→640 ×5 files, max-720→640
  ×2, min-1025→1024 ×2); the audit table lives in device-contracts.md.
- **T014** a11y carry-forward run UNMODIFIED: a11y.matrix 31/31,
  touch.targets 3/3, motion.preferences 3/3, keyboard.journeys 4/4 —
  responsive work regressed nothing.
- **T015** documentation: "Responsive rules (spec 036)" in `docs/conventions.md`
  (7 rules) + the ledger §Phase 036 record in
  `docs/frontend-presentation-contracts.md` — zero Category-A (no pinned
  name/copy moved).
- **T016** the full gate on the final tree (see Validation).

## The four cross-suite ordering flakes — root-caused and repaired, never weakened
1. **keyboard.journeys.ts → management.surfaces**: after its Marina-T1 journey
   the suite left T1 in a non-Inactive state while management.surfaces asserts
   the Inactive read. Repair: keyboard.journeys restores T1 to Inactive via
   alice's Deactivate click INSIDE its own lock span (realtime already
   restores; the suite must too).
2. **session.surfaces vs the platform kill-switch**: six real guest joins hit
   "This restaurant is not available." when platform.surfaces' kill-switch
   raced them. Repair: the joins are wrapped in `withEntryLock` (imports
   added).
3. **platform.surfaces self-poisoning**: the re-enable click happened outside
   the disable test's lock span — the two-serial-test split left a lock-free
   poisoned gap. Repair: re-enable now runs inside the lock span; the
   'Active|Change dates'/'Activate' clicks are scoped to Blue Olive's row
   (`tbody tr` hasText).
4. **live.awareness dated a stranger's row**: platform.surfaces leaves Blue
   Olive deliberately EXPIRED, and live.awareness's bare `'Activate'.first()`
   hit a neighbor (Cedar Grill) while the unscoped table assertion passed on —
   masking missing writes. Root cause found via a `pg` probe that reads the DB
   URL from `process.argv[1]` on `.env.supabase` (direct strings cannot read
   env; `dotenv` not installed). Repair: the date write is scoped to Blue
   Olive's row + an explicit oracle ('Subscription dates saved for Blue
   Olive.'); `probe-dates.mjs` deleted after use. A fifth flake
   (reports.surfaces US3 timing) was green on an isolated 21.7s rerun — no
   code change.

## Files changed (the working tree, uncommitted)
New: `specs/036-responsive-and-device-hardening/*` (full pipeline layout),
`e2e/responsive.{overflow,devices,sameDisclosure,orientation}.test.ts`,
`e2e/helpers/responsive.ts` (rewritten),
`tests/unit/dataTableCardFallback.test.tsx`,
`test-results`-independent outputs recorded in tasks.md. Modified:
`src/components/ui/DataTable.tsx` (cardBreakpoint),
`src/features/tax/components/TaxPreview.tsx` (cardTable),
`src/components/management/management.module.css` +
`src/routes/CustomerMenuPage.module.css` (minmax(0, 1fr) — F-036-01),
`e2e/kitchen.display.test.ts` (T007 legs),
`e2e/keyboard.journeys.test.ts`, `e2e/live.awareness.test.ts`,
`e2e/platform.surfaces.test.ts`, `e2e/session.surfaces.test.ts` (the four
ordering repairs), `e2e/full-journey.test.ts` + `e2e/helpers/signInAs.ts`
(fiona lock entry/exit), `tests/database/helpers/{fixtures,db}.ts`
(fixture ids), `docs/conventions.md`,
`docs/frontend-presentation-contracts.md`, `.specify/feature.json` (→ 036).

## Backend contracts used
NONE — no RPC, type, RLS, or authorization change anywhere; responsive work is
wholly presentational (constitution III/IV untouched); fixture helpers extend
test tooling only.

## Validation results
- `npm run verify` EXIT 0 per stage on the final tree: prettier clean (FMT=0),
  lint 0 errors (4 pre-existing warnings in untouched files), tsc clean,
  test:unit 516+27 passed, test:db green (445s), test:integration 38,
  build OK (789.10 kB JS / 58.16 kB CSS).
- Playwright, batched over the reset DB (db:reset mandatory): overflow 6/6,
  devices 2+2+2, sameDisclosure 2/2, orientation 3/3, cashier landscape 2/2,
  kitchen 7/7, a11y 31+3+3, keyboard 4/4, bill.void.audit 2/2 (after seeding
  real rows), routes/shell/smoke batch 65, menu/tax/management 56/56, cashier/
  kitchen/channel 9/9, platform/session/live/readability/baseline batches
  9+9+9, full-journey/customer/reports 11+ (one US3 timing flake green
  isolated) — everything green on the final tree.
- Convergence: 10/10 FR and 6/6 SC mechanically proven; tasks.md 16/16 [x] with
  [done] evidence annotations.

## Convergence
`converged` — first round, zero gaps (FR/SC/task/decision/constitution rows all
wired to their mechanical evidence); no appended convergence section needed.

## Git checkpoint
The phase lives in the working tree, UNCOMMITTED by design — the autopilot does
not commit without the user's request; suggested: `feat(036)`/`fix(036)`.

## Remaining warnings / blocked items
Walkthroughs W1–W5 are human-owned per clarify (scripts frozen in quickstart).
Environmental: `npm run db:reset -- --yes` before every Playwright batch; the
full run exceeds a 10-minute window — batched closure is the protocol;
code_search (vendored ripgrep) intermittently broken — shell `grep` used.
