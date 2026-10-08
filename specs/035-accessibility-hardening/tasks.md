# Tasks — 035-accessibility-hardening

> Execution discipline: `npm run db:reset` before ANY E2E run; prettier on every
> touched file; every existing pin holds unless a Category-A migration is recorded in
> the ledger. The axe baseline gains only owned, justified entries.

## Phase 1: Setup

- [x] T001 Open `specs/035-accessibility-hardening/audit/report.md` (findings log: severity / decision / evidence) seeded with the route×state inventory from `src/routes.ts` and the recorded 031 A3 target-size finding as the first owned entry (US1/FR-11 substrate). — **[done: report.md seeded with 27-row inventory (router.tsx + seedCredentials) + F-001 A3 owned entry; inventory source named `src/app/router.tsx` (routes.ts has no `path:` lines)]**

## Phase 2: Foundational — the audit substrate

- [x] T002 [US1] Extend `e2e/helpers/a11y.ts` with a route×state matrix runner (authorized-state sign-ins per role, empty/loading states included, mobile/tablet rows) plus explicit skip-link (`#main`) and landmark assertions per shell — rule tags unchanged, baseline-waiver discipline intact; accessible-name coverage rides the standing pins + axe name rules (FR-01/FR-09/FR-10, R1/R2). — **[done: `MatrixRow` + `scanMatrixRow` (signed-out / per-identity / fionaLock) + `expectShellFloor` (one `#main` + skip link first in Tab order); tags + baseline discipline untouched]**

## Phase 3: US1 — the automated floor on every route

- [x] T003 [US1] New `e2e/a11y.matrix.test.ts`: every scanned route×state passes zero unwaived axe findings AND the shells' skip-link/landmark assertions (FR-09); the 031 A3 finding at 390px is recorded in the baseline with owner phase 035 (fixed later by T011) (FR-01). — **[done: 31 serial rows (public 7 + staff 18 + denials 3 + fiona bootstrap + 404 + deep links) — first run 29/31; NO baseline entry needed: F-001 was already fixed by 031's CSS (record in audit report); the in-session menu floor stays pinned in customer.menu (spec 025)]**
- [x] T004 [US1] Fix every critical/serious finding the matrix surfaces (presentation-attribute/CSS fixes in the named components; iterate until the matrix is green; the baseline keeps only owned entries) (D1/FR-01). — **[done: F-002 nested mains → labelled sections (NotFoundView/RouteErrorView); F-003 bare native submit → system Button + token back-row spacing (BranchesPage + BranchesPage.module.css); re-run 31/31 green + route.titles/management.surfaces/smoke/shell targeted green; unit 430/430]**

## Phase 4: US2 — keyboard-complete critical journeys

- [x] T005 [P] [US2] New `e2e/keyboard.journeys.test.ts` (serial): customer ordering end-to-end keyboard-only, including the mobile drawer open/navigate/close with focus return (FR-02/FR-04, R3/R7). — **[done: 4 tests serial — customer ordering keyboard-only on Marina T1 (join/add/submit by focus+Enter/Space), the 390px drawer (open→contained→Escape→restore), session close (dialog containment/Escape/restore/confirm), onboarding (form/outcome toast/credential copy) — 4/4 green]**
- [x] T006 [US2] Add the session-close and super-admin onboarding keyboard legs to `e2e/keyboard.journeys.test.ts`: labelled controls, dialog focus containment + Escape + trigger restore (FR-02/FR-04). — **[done: legs in the same file; T2 under its lock, entry lock discipline around both guest joins; 4/4 green]**
- [x] T007 [US2] Extend the proven keyboard walks in `e2e/cashier.operations.test.ts` and `e2e/kitchen.display.test.ts` with focus containment/restore assertions on their dialogs and a no-focus-steal check on live refetches — existing pins hold unedited (FR-04). — **[done: cashier — Show bill via Space with focus retained, void dialog keyboard-only (open→contained→Escape→restore→confirm) retried through live refetches; kitchen — shell-chrome focus parked across a full poll cycle; both files' suites 8/8 green]**
- [x] T008 [US2] Fix whatever the journeys expose (hover-only affordances, unreachable actions, unmanaged focus) in the named components, and document the keyboard maps for cashier and kitchen in `docs/` (FR-03). — **[done: journeys exposed F-005 (the shared ConfirmDialog could never re-open after a close notification raced a re-render — Enter in its form could strand it closed; fixed with a render-synced open-state effect in `Dialog.tsx`) — regression batch 44/44 (shell/session.surfaces/channel.operations/design.system/keyboard.journeys); keyboard maps in `docs/accessibility.md` + the development.md pointer]**

## Phase 5: US3 — live-region correctness

- [x] T009 [US3] Unit tests in `tests/unit/` asserting the announcement policy across the audited surfaces (once-only, polite semantics, agreed copy) against `src/features/realtime/announcementPolicy.ts`; fix duplicating/spammy announcements where found (FR-05, D3). — **[done: `tests/unit/announcementSurfaces.test.tsx` — passive news polite everywhere, EXACTLY ONE polite live region per operational surface, inert outcome markup (no autofocus), dedupe-window silence; 4/4 green. The 032 policy map + copy parity + dedupe were already pinned by announcementPolicy.test.ts — the audit found no duplicating/spammy announcements to fix]**
- [x] T010 [US3] Announcements E2E legs (existing realtime-sensitive specs + `e2e/keyboard.journeys.test.ts`): ticket arrival→ready announces once; submit-success once; session closure notice once; onboarding toast (distinct wording); refusals verbatim once (FR-05). — **[done: kitchen counter leg added — one arrival moves the announcement exactly once and it stays stable across the coalesced window (in `kitchen.display.test.ts`); submit-success/closure-notice/onboarding-toast/verbatim-refusals already pinned by keyboard.journeys + session.surfaces + platform.console + realtime/live.awareness — the audit cited them rather than duplicating]**

## Phase 6: US4 — targets, contrast, motion, zoom

- [x] T011 [US4] New `e2e/touch.targets.test.ts`: bounding-box sweep over interactive elements at 390×844 and 834×1112; fix failures (the 025 cart micro-buttons per the A3 finding is the first owned item; remove its baseline entry when fixed) or record owned exceptions (FR-07, D5). — **[done: the sweep asserts axe's OWN target-size rule (the committed authority) at 390/834 on /signin, /r/blue-olive, the IN-SESSION menu with cart content (the A3 ground zero — green, confirming 031's fix), /dashboard/rounds at both viewports, /admin/platform — 3/3 green; the first prototype's raw-geometry standard (stricter than WCAG 2.5.8 (d)) is recorded as EXC-003, and F-006 (auth controls) + F-003 (branches) were fixed from its findings]**
- [x] T012 [P] [US4] Write `specs/035-accessibility-hardening/audit/contrast.md`: every token pair in use with ratio + pass/exception, citing the axe color-contrast results (FR-06, D4). — **[done: 11/11 text pairs + 4/4 non-text pairs PASS at 4.5:1/3:1, zero exceptions; the muted-ink watch pair clears with margin]**
- [x] T013 [P] [US4] New `e2e/motion.preferences.test.ts`: reduced-motion emulation collapses non-essential animation; forced-colors emulation runs and every gap is recorded in `specs/035-accessibility-hardening/audit/exceptions.md` (FR-08, D5). — **[done: 3/3 green — reduced-motion block present and collapse verified, forced-colors (Chromium emulation) axe-clean on /, /signin, /dashboard with the palette gap recorded as EXC-002]**
- [x] T014 [US4] Add the zoom-200% legs to `e2e/motion.preferences.test.ts` on the critical journeys: content and function preserved (Responsive, R7). — **[done: the entry keeps zero horizontal overflow at 200%; the staff board keeps its heading + the operational nav visible/functional]**

## Phase 7: US5 — the record and the docs

- [x] T015 [US5] Complete `specs/035-accessibility-hardening/audit/exceptions.md` (every unfixed finding: severity, reason, named owner — no silent gaps) and finalize `specs/035-accessibility-hardening/audit/report.md` with the recorded walkthrough results W1–W5 from `specs/035-accessibility-hardening/quickstart.md` (FR-11, SC-005). — **[done: EXC-001..003 (SR human run owner-owned; forced-colors palette design-owner-owned; sweep-prototype lesson) + the W-table's automated-proof rows per script; zero serious-plus outstanding]**
- [x] T016 [P] [US5] Docs: keyboard-map placement + a11y-suite usage in `docs/conventions.md`/`docs/development.md` (per placement rules), and ledger Category-A entries in `docs/frontend-presentation-contracts.md` for any name/text migration this phase forced (FR-03/FR-10). — **[done: `docs/accessibility.md` (keyboard maps + proof index) + the development.md floor paragraph extended; the §Phase 035 ledger record written — ZERO Category-A migrations (no pinned name/copy moved: fixes were structural/compositional); prettier clean]**

## Phase 8: Polish

- [x] T017 Full gate: `npm run db:reset` → `npm run verify` EXIT 0 → full Playwright run green → reconcile `specs/035-accessibility-hardening/audit/report.md` rows with the tasks' recorded evidence (SC-001…SC-006). — **[done: db:reset → verify green on the final tree (format/lint/tsc/unit 434/db/integration/build 788.96 kB); full Playwright batched over the reset DB — 59 + 46 + 124 + 15 = 244/244 green (two first-pass realtime/full-journey timing flakes green on isolated rerun, the documented shared-cloud pattern; batch C's 3 'did not run' re-run green); report.md gates checked]**

## Dependencies

- T002 blocks T003/T004 (the runner is the matrix's engine).
- T003/T004 block T011 (the A3 baseline entry must exist before the sweep removes it by fixing).
- T005 blocks T006 (same file, sequential); T005–T007 block T008.
- T009/T010 are independent of US2 (different files); T013 blocks T014 (same file).
- T015/T016 close the record; T017 runs last.

## Independent Test Criteria (per story)

- **US1**: the matrix spec alone proves the floor (zero unwaived findings on every route×state).
- **US2**: `e2e/keyboard.journeys.test.ts` + the two extended walks prove the five journeys keyboard-only with focus rules.
- **US3**: the policy unit tests + the announcement E2E legs prove once-only polite announcements.
- **US4**: the contrast table + the targets/motion/zoom specs prove the token-level guarantees.
- **US5**: the audit record + docs close the phase with no unowned gaps.
