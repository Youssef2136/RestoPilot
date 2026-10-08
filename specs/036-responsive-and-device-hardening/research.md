# Research: 036-responsive-and-device-hardening

Each decision grounds the phase in the repository's committed facts (checked at
baseline `c554f03` + the uncommitted Phase 15 tree). Format: Decision / Rationale /
Alternatives considered.

## R1 — The viewport set and its anchors
- **Decision**: Mobile checks at 320/390/430 px (390×844 = the standing Playwright
  mobile project); tablet 768/834/1024 px touch with 834×1112 = the standing tablet
  project and its rotation (≈1112×834) as the landscape anchor; desktop 1280–1600 px
  (the default project's 1280 width + explicit checks) and one wide check beyond
  1600 px for reports/comparison.
- **Rationale**: these are the Master Plan's bands (§Phase 16 Responsive Requirements)
  mapped onto the projects that already exist (playwright.config.ts — mobile 390×844,
  tablet 834×1112; spec 021 FR-08). No new project needed for the anchors; extra
  widths run via `setViewportSize` inside the responsive suites.
- **Alternatives**: fixed three-anchor-only matrix (rejected at clarify — the
  three-band matrix with explicit unsupported classes was chosen); new Playwright
  projects per width (rejected — projects multiply the full-suite cost; in-suite
  viewport changes keep the batch protocol).

## R2 — Breakpoint vocabulary is the documented token scale
- **Decision**: media queries use exactly the documented scale — 640 / 1024 / 1440 px
  (`src/styles/tokens.css`: `--breakpoint-mobile-max`, `--breakpoint-tablet-max`,
  `--breakpoint-desktop-max`). The existing 22 `@media` blocks (12 files) are audited
  against the scale; drift is normalized to the scale or recorded with a reason.
- **Rationale**: custom properties cannot be read inside `@media` (documented in
  tokens.css), so the scale IS the discipline: one place documents the values, every
  query cites them. This satisfies FR-02's "no ad-hoc media queries with magic
  numbers" without inventing a new mechanism (no PostCSS token plugin — FA-10).
- **Alternatives**: a CSS preprocessor/plugin to inline tokens into media queries
  (rejected — new build dependency, constitution VIII); redefining the scale
  (rejected — Phase 02's committed values; amendment only if a gap is proven).

## R3 — Overflow proof technique
- **Decision**: the overflow matrix asserts, per route × {320, 390, 430} px in the
  authorized state: `document.scrollingElement.scrollWidth <= clientWidth`, plus a
  sweep for elements wider than the viewport (clipped interactive elements fail).
  Long-content variants use the longest seeded names/addresses on content routes.
- **Rationale**: scrollWidth/clientWidth is the direct, engine-honest overflow
  measure (a horizontal scrollbar on the root is the actual user harm FR-03 bans);
  element sweep catches the no-root-scroll-but-clipped-control case.
- **Alternatives**: screenshot-diff based overflow detection (rejected — flaky,
  slow, not an assertion); per-component unit checks (rejected — the harm is
  layout-composition, only E2E sees it).

## R4 — Table narrow-width behavior (the DataTable deferral lands)
- **Decision**: DataTable's documented strategy ("horizontal scroll below the mobile
  breakpoint; card-ification is a per-surface decision for a later phase") lands
  HERE as: (a) DataTable gains a card fallback — the same column definitions render
  row cards below a per-instance crossover width, no data loss, same disclosure;
  (b) the six hand-rolled production tables (`StaffListPage`, `AuditLogPage`,
  `VoidReportPage`, `ReportsPage`, `PlatformConsolePage`, `TaxPreview`) each get a
  DEFINED behavior — migrate onto the DataTable pattern where the surface is a plain
  data table, or a documented scroll region (sticky identity column) where the
  device contract names it (many-column reports).
- **Rationale**: one shared pattern beats six bespoke rewrites (FA-5); DataTable
  already owns the semantics (sortable headers, empty/loading rows, caption); the
  same-disclosure security rule is provable once in the pattern + per-surface.
- **Alternatives**: CSS-only "data-label" card-ification of the hand-rolled tables
  (rejected — duplicates column knowledge in markup attributes, drifts from the
  shared pattern); scroll regions everywhere (rejected — hides the narrow-width
  problem rather than defining it; acceptable only where the contract says so).

## R5 — Sticky/anchored mobile actions
- **Decision**: one `StickyActionBar` primitive (`src/components/ui/`): token
  z-index layer (the dialog/toast layers stay above), safe-area padding, borders
  from tokens; applied on customer mobile flows where the device contract demands
  it (cart submit, round submission). It never covers focusable content: the bar is
  in normal flow at the end of scrollable content where possible; where fixed, the
  content reserves matching padding and the focus ring is never clipped.
- **Rationale**: the Master Plan's Components list names the pattern; one primitive
  keeps the sticky treatment a system pattern, not per-surface CSS (FA-5).
- **Alternatives**: per-surface sticky CSS (rejected — the exact drift FR-02 bans);
  always-fixed bars on every mobile surface (rejected — only where the flow needs
  it; "no redesign of surfaces already correct").

## R6 — Orientation-change proof and why no remount is expected
- **Decision**: the responsive suite rotates representative surfaces (customer menu,
  cashier dashboard, kitchen board) with `setViewportSize` and asserts: scroll
  position preserved, open dialog/drawer still open with state intact, in-flight
  input values preserved, live updates continue with no duplicate announcements
  (032 policy) and no remount flash.
- **Rationale**: React state lives outside the viewport; nothing in the app
  re-mounts on resize by design — the test pins that property so future resize-keyed
  remount patterns fail loudly here rather than silently in the field.
- **Alternatives**: Playwright's `page.orientation`-style device emulation only
  (rejected — `setViewportSize` is the established, precise technique in this repo's
  suites; device emulation adds UA/scale noise the suites don't need).

## R7 — Virtual-keyboard behavior at 390 px
- **Decision**: proven by viewport-shrink emulation — shrink the 390×844 viewport to
  the keyboard-occupied height, focus each customer form field, and assert the
  focused field and the flow's primary action remain reachable (scrollIntoView
  succeeds without losing input state; the sticky bar doesn't trap the field).
- **Rationale**: no real IME exists in CI (documented limit); visual-viewport API
  coverage varies; the shrink model reproduces the actual harm FR-09 bans (obscured
  field or button) deterministically.
- **Alternatives**: real-device manual run (recorded as an EXC-style walkthrough
  item for the owner, not a CI gate); visual-viewport listeners (rejected — not
  assertable in chromium CI deterministically).

## R8 — The artifacts of this phase (its "entities")
- **Decision**: `specs/036-responsive-and-device-hardening/device-contracts.md` —
  the reviewed per-route table (primary/secondary/unsupported + table narrow-width
  behavior + mobile-editing boundary); the responsive rule set distilled into
  `docs/conventions.md`; any presentation-contract migration recorded in the ledger
  (`docs/frontend-presentation-contracts.md` §Phase 036).
- **Rationale**: the Master Plan requires the device contract per surface (FR-01)
  and a documented responsive rule set in `docs/conventions.md`; keeping the
  contract with the phase artifacts and the rules in docs mirrors the Phase 15
  audit-record pattern (reviewable, referenced from tasks, survives the phase).
- **Alternatives**: device contracts inline in route files as comments (rejected —
  not reviewable as a table, not referenced by tests/tasks); a generated doc
  (rejected — YAGNI for 26 rows).

## R9 — Cross-browser stays Chromium (clarified)
- **Decision**: no WebKit/Firefox projects this phase; Chromium device emulation is
  the engine. Recorded as a future option, not silently absent.
- **Rationale**: clarified 2026-10-07 — layout risk is engine-independent in
  practice; the full-suite batch protocol (10-min windows, cloud rate limits) stays
  valid; WebKit would ~×3 the suite cost for marginal signal.
- **Alternatives**: WebKit for the responsive suite only (kept as the recorded
  future option); full WebKit+Firefox (rejected at clarify).
