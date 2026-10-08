# Tasks: 036-responsive-and-device-hardening

**Input**: Design documents from `specs/036-responsive-and-device-hardening/`
**Prerequisites**: plan.md (D1–D7), spec.md (FR-01..10, SC-001..006), research.md
(R1–R9), quickstart.md (W1–W5)

Tests are first-class here: the spec's Functional Requirements name E2E proofs, and
the phase's exit is evidence-driven (the standing suites stay green).

## Phase 1: Setup

- [x] T001 Create `specs/036-responsive-and-device-hardening/device-contracts.md`: the reviewed per-route device contract for ALL 25 registered routes + catch-all (from `src/app/router.tsx`) — primary device class, secondary, explicitly unsupported, the table narrow-width behavior for the six production tables (research R4), and the clarified mobile-editing boundary on management routes (FR-01, D1, SC-001). — **[done: 26-row contract table (public/customer 8, staff 16, platform 2) + the six-table behavior table (card fallback ×5, reports scroll-region ×1) + the media-query audit skeleton for T013; the /order redirect recorded as n/a-surface]**

## Phase 2: Foundational — the responsive substrate

- [x] T002 Extend the E2E helpers with `e2e/helpers/responsive.ts`: the viewport presets (320/390/430 mobile, 768/834/1024 tablet touch, 1112×834 tablet landscape, 1280 desktop, 1600+ wide check), `expectNoHorizontalOverflow(page)` (scrollWidth ≤ clientWidth on the scrolling element + no viewport-wider element sweep), and rotate helpers (FR-03/FR-08 substrate, R1/R3/R6). — **[done: VIEWPORTS (11 named), setViewport/rotate/keyboardShrink/expectNoHorizontalOverflow (root scrollWidth + visible-element right-edge sweep, zero-size/hidden ignored, 2px tolerance); tsc clean]**

## Phase 3: US1 — the guest on a 390 px phone (P1)

- [x] T003 [US1] New `e2e/responsive.overflow.test.ts`: the overflow sweep — every registered route (public + customer + per-role staff + denials + 404) at 320/390/430 px in its authorized state with long-content variants on content routes; `expectNoHorizontalOverflow` on every row (FR-03, SC-002, W1). — **[done: 6 serial tests green (8.3m over the reset DB) — public 7 routes, owner 12, cashier 5, manager+kitchen 3, platform 2, the IN-SESSION menu with cart content, each at 320/390/430. TWO real findings fixed: F-036-01 the implicit max-content grid track let the nowrap sticky section/category nav pills stretch the page (114px/46px overflow at 320) — `grid-template-columns: minmax(0, 1fr)` on `.layout` (management.module.css) and `.page`/`.menuLayout` (CustomerMenuPage.module.css); the helper gained the scroll-container exemption (content inside a real `overflow-x: auto` region scrolls within its container — `hidden` ancestors still fail). The long restaurant name rides the entry route row]**
- [x] T004 [US1] The sticky/anchored mobile-action pattern (FR-07/FR-09, D5-as-built, W1/W4): the committed 025 cart bottom-sheet (`CustomerMenuPage.module.css` `.cartColumn` — sticky bottom, internal scroll, one-thumb reach) IS the system pattern — prove it instead of duplicating it with a new `StickyActionBar` primitive (zero second consumer = speculative per the creation rule/FA-5): new `e2e/responsive.devices.test.ts` legs — the entry form completes at 390 px under keyboard-shrink emulation (every focused field and the `Join the table` action reachable, input state preserved) and the cart submit stays anchored at 390 (full and keyboard-shrunk viewport: `Send order to the kitchen` remains in view and operable; Tab keeps activeElement visible — the sheet never traps or covers focus); the customer-surface overflow findings were fixed by T003 (F-036-01). — **[done: 2/2 green — the entry form's picker fields (Branch/Table, keyboard-free) complete directly and both text fields survive the keyboard-shrunk viewport (visible + inside + input state preserved, Join reachable); the cart sheet keeps the submit inside the full AND shrunk viewport and Tab never leaves the visible area; D5-as-built recorded in device-contracts.md + the conventions rule (T015)]**

## Phase 4: US2 — the cashier at tablet landscape (P1)

- [x] T005 [US2] Cashier tablet-landscape legs in `e2e/responsive.devices.cashier.test.ts` (standalone file — the T2 fixture is shared with keyboard.journeys; one file one lock): assign → show bill → close at 1112×834 with interaction assertions; the void dialog and session-close dialog fit the rotated viewport; action targets keep the 44 px floor (FR-04, SC-003, W2). — **[done: 2/2 green — the full chain (real guest round → accept/prep/ready/lock → Show bill with the grand total in view → Close session dialog fits both axes → announced closure) + the void leg (the dialog fits the rotated viewport before AND after the reason fill, the 029 data-round-id scoping against sibling closed dialogs); the landscape root never overflows horizontally. Helpers: expectReachable (horizontal bounds) + expectDialogFits (both axes for dialogs) — vertical reach is normal scrolling (Playwright auto-scrolls); the full-fit claim is reserved for dialogs]**
- [x] T006 [US2] Fix whatever the landscape legs expose in the cashier surfaces (`src/features/session/`, `src/features/staffOps/`, dashboard shells' CSS): compact tablet density per tokens, no phone-style single-column collapse at landscape, dialogs sized to the rotated viewport (D6, W2). — **[done: the legs exposed NOTHING to fix — both dialogs already fit 1112×834 (the 023 dialog primitive centers within the viewport), the board's compact density held, zero horizontal overflow; the F-036-01 grid-track fix (T003) covers the staff shell too. No code change; the honest outcome recorded]**

## Phase 5: US3 — the kitchen board at distance (P2)

- [x] T007 [US3] Kitchen-board legs in `e2e/kitchen.display.test.ts` (added to the owning suite — Marina T1 lock + local helpers reused): tablet portrait (768), 1600, and 1920 — named columns stay bounded (no unbounded stretch pushing tickets out of view), ticket state markers visible, honest degradation (stack/scroll as a board, never clip) (FR-05, SC-003, W2). — **[done: 1/1 green (46.7s) — at 768/1600/1920: all three `[data-kitchen-column]` columns visible + inside the viewport's right edge (bounded), the new ticket visible with readable content; the kitchen ticket carries NO action buttons by design (accepting is the cashier's act — the spec's 'actionable buttons clipped' concern resolves to identity/state readability, the 030 floor already pins the buttonless new-ticket posture)]**

## Phase 6: US4 — the owner's dense tables (P2)

- [x] T008 [P] [US4] Extend `src/components/ui/DataTable.tsx` + `.module.css` with the card fallback: the same column definitions render row cards below a per-instance crossover width — no data loss, same field-level disclosure; unit tests in `tests/unit/` (FR-06, R4). — **[done: `cardBreakpoint` prop + `useCardFallback` (a matchMedia listener — media-query-free since custom properties cannot feed `@media`; SSR-safe default = the table) + the card branch rendering label/value rows from the SAME column definitions (one disclosure by construction); `tests/unit/dataTableCardFallback.test.tsx` 4/4 (the no-breakpoint default, the SSR-safe node behavior, numeric treatment, loading/empty unchanged); tsc clean]**
- [x] T009 [US4] Give each of the six production tables its DEFINED narrow-width behavior from device-contracts.md — `src/routes/StaffListPage.tsx`, `src/routes/AuditLogPage.tsx`, `src/routes/VoidReportPage.tsx`, `src/routes/ReportsPage.tsx`, `src/routes/PlatformConsolePage.tsx`, `src/features/tax/components/TaxPreview.tsx` — migrate onto the DataTable pattern where it is a plain data table, or implement the documented scroll region (sticky identity column) where the contract names it (FR-06, SC-004, W3). — **[done: the repo audit found the card fallback ALREADY IMPLEMENTED on five of six — the 026 `data-label` card rows (StaffList) and the reports D3 `cardTable` fallback (AuditLog, VoidReport, Reports ×2 tables, PlatformConsole) — a defined behavior for years; the gap was `TaxPreview` (unstyled browser-default table) → it joined the `cardTable` pattern verbatim (markup data-labels + the pattern block in tax.surfaces.module.css); device-contracts.md corrected (the DataTable cardBreakpoint is the system primitive for NEW tables; the production tables ride their committed patterns)**]**
- [x] T010 [US4] Desktop + wide legs in `e2e/responsive.devices.desktop.test.ts` (standalone — no lock/identity conflicts): management/report/platform routes at 1280–1600 and the >1600 wide check — bounded, readable, no broken columns, no unbounded stretching (FR-05, SC-003, W2). — **[done: 2/2 green — 11 management/platform routes × 1280/1440 zero horizontal overflow + meaningful main content; the wide 1920 check: the comparison table renders bounded, the platform console stays overflow-free]**
- [x] T011 [US4] Same-disclosure E2E in `e2e/responsive.sameDisclosure.test.ts`: a lower-privileged role (bob — branch manager reads his branch's audit, the bill.void.audit precedent) sees the card fallback carrying EXACTLY the fields the table view showed — no column lost, no field gained; the audit-refused cashier (carla) gains nothing at either width (Security, SC-004, W3). — **[done: 2/2 green — the table's field set (When/Action/Actor/Branch/Reason) equals the card label set exactly; a real action cell carries content at 390; the denial view holds at 1280 and 390 with the audit table count 0]**

## Phase 7: US5 — rotation without losing place (P3)

- [x] T012 [US5] Orientation legs in `e2e/responsive.orientation.test.ts` (standalone): rotate the entry form (in-flight input survives mid-fill), a tall staff page (scroll position preserved; the heading reconciles across the rotation), and the kitchen board (ONE polite region — no remount spam; the 032 policy holds) (FR-08, W4). — **[done: 3/3 green — the rotated form continues to completion (Join lands the session), the /dashboard/menu scroll offset survives within the 200px tolerance (the tall page, not the empty dashboard), the board keeps exactly ≤1 role="status" region across the rotation]**

## Phase 8: Polish & cross-cutting

- [x] T013 [P] Audit the existing `@media` blocks against the documented token scale (640/1024/1440): normalize drift to the scale or record each exception with its reason in device-contracts.md; no new magic numbers anywhere (FR-02, D2). — **[done: the per-file grep-count audit found 15 REAL queries (the plan's "22 blocks" double-counted multi-line comments and the reduced-motion blocks — counted correctly in device-contracts.md); THREE drift values normalized to the scale: max-767px → max-640px (5 files: management/BranchDetail/StaffList/menu.surfaces/tax picker), max-720px → max-640px (reports + tax cardTable — both already share the pattern), min-1025px → min-1024px (kitchen + staffOps boards — the 1px-off crossover); the tablet band (641–1023) now carries no stray query; everything cites 640/1024/1440 literally; the full audit table in device-contracts.md; tsc clean + lint 0 errors (the 4 warnings pre-exist in files this phase never touched)]**
- [x] T014 The a11y carry-forward gate: run the FULL Phase 15 suites unmodified after all layout work (a11y.matrix, keyboard.journeys, touch.targets, motion.preferences + axe at mobile/tablet rows + zoom-200%); fix or Category-A-migrate (ledger + paired suite edit in the same commit) whatever fails — never weaken (D7, SC-005, W5). — **[done: ZERO failures, zero fixes needed — the layout work (minmax(0,1fr) grid tracks + the media-scale normalization + the TaxPreview cardTable) broke no a11y contract: a11y.matrix 31/31 (mobile+desktop), touch.targets 3/3, motion.preferences 3/3 incl. zoom-200%, keyboard.journeys 4/4; the suites ran UNMODIFIED — the strongest carry-forward proof possible]
- [x] T015 [P] Docs follow the code: the responsive rule set (breakpoint usage, sticky-bar pattern, table→card pattern, density rules) in `docs/conventions.md`; ledger §Phase 036 Category-A entries (if any) in `docs/frontend-presentation-contracts.md` (FA-14, SC-006). — **[done: the "Responsive rules (spec 036)" section in conventions.md (7 rules: token-scale breakpoints, minmax(0,1fr) overflow discipline, anchored cart = the 025 pattern, table→card with one-disclosure, tablet-landscape dialogs, rotation state preservation, proof-at-the-boundary); the ledger §Phase 036 record written with ZERO Category-A entries (no pinned name/hook/copy moved)]
- [x] T016 Full gate: `npm run db:reset` → `npm run verify` EXIT 0 → full Playwright run green (batched per the standing protocol) → reconcile `device-contracts.md` rows with the shipped layout and record the W1–W5 outcomes in the phase report (SC-001…SC-006). — **[done: verify EXIT 0 per stage (format/lint 0 errors/typecheck/unit 516+27/db/integration 38/build 789.10 kB); Playwright ALL suites green since the reset — overflow 6, devices 2+2+2, cashier 2, kitchen 7 (incl. the new 036 leg), a11y 31+3+3, keyboard 4, full-journey/customer/reports 12, bill.void.audit 2, routes/shell/smoke batch 65, menu/tax/management 56, cashier/kitchen/channel ops 9, platform/session/live/readability/baseline 38; FOUR pre-existing cross-suite ordering flakes surfaced and were REPAIRED (never weakened): keyboard.journeys now restores Marina T1 to Inactive inside its lock span (realtime's discipline — management.surfaces' Inactive read was order-dependent), session.surfaces' six real joins queue on the entry lock (the platform kill-switch race), platform.surfaces re-enables INSIDE its lock span (the poisoned lock-free gap between its serial tests) and scopes its activate/expired writes to Blue Olive's row, live.awareness scopes its date writes to Blue Olive's row with the save-notification oracle (the bare 'Activate'.first() dated a stranger's restaurant once platform.surfaces left Blue Olive expired); device-contracts.md reconciled (26 routes; TaxPreview cardTable corrected in T009)]

## Dependencies

- T001 (device contracts) → names the behaviors T004/T008–T011 implement; do it first.
- T002 (helpers) → blocks every E2E task (T003, T005, T007, T010–T012).
- T003 → T004 (fix what the sweep finds). T005 → T006 (fix what landscape exposes).
- T008 → T009 (the pattern exists before surfaces adopt it). T009 → T011 (the
  fallbacks exist before the same-disclosure proof).
- T014 (a11y gate) runs AFTER all layout tasks (T004, T006, T009) — it verifies their
  carry-forward. T016 last.

## Independent Test Criteria (per story)

- **US1**: the overflow sweep is green at 320/390/430 on every route; customer form
  completes at 390 with the keyboard-shrink emulation; sticky bar never traps focus.
- **US2**: the cashier journey completes at tablet landscape with interactions only —
  no horizontal scroll, dialogs fit, targets hold 44 px.
- **US3**: the kitchen board's structural floor holds at 768 and 1600+ (named
  columns, visible states, no clipped actions).
- **US4**: each production table has a defined, implemented narrow behavior; the
  same-disclosure check passes for a lower-privileged role; desktop/wide legs green.
- **US5**: rotation preserves scroll/open surfaces/input on the three representative
  surfaces with no duplicate announcements.
- **Polish**: the Phase 15 a11y suites pass unmodified (or with ledgered migrations);
  media queries all cite the documented scale; docs + ledger updated.

## Parallel Opportunities

- T008 is [P] (DataTable + unit tests, independent of route work).
- T013/T015 are [P] within Polish (different files than the suites).
- US2/US3/US4 E2E legs (T005, T007, T010) share one file (`responsive.devices.test.ts`)
  — serial by file, parallel in authoring after T002.
