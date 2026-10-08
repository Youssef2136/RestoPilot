# Implementation Plan: 036-responsive-and-device-hardening (Frontend Phase 16)

**Mode**: Operate · **Baseline**: `c554f03` (tree carries uncommitted Phase 15 artifacts) ·
**Backend impact**: NOT_REQUIRED — presentation/layout only; no RPC, type, RLS, or
authorization change anywhere (layout may not widen what any role sees)

> House layout (031–035): plan/research/quickstart + no data-model.md/contracts/ — this
> phase introduces no runtime data entities (its "entities" are the device-contract table
> and the responsive rule set, documented in research.md R8). quickstart.md IS required
> (the responsive proofs W1–W5 are the phase's standing validation scripts).

## Constitution Check
- **I Business Scope** — no product scope added; layout/viewport hardening only; the
  clarified mobile-editing boundary is a presentation posture, not a new feature. PASS.
- **II Specs are truth** — surfaces already exist and work; this phase changes how they
  fit their device classes; business behavior, lifecycles, and copy stay verbatim. PASS.
- **III/IV Isolation & server authorization** — untouched server-side; the card fallback
  discloses exactly what the table view disclosed per role (spec Security note); client
  guards stay presentation-only. PASS.
- **V/VI/VII DB/state/audit** — no DB, state-transition, or audit surface touched; the
  ledger records any presentation-contract migration (Category-A discipline). PASS.
- **VIII YAGNI** — primitives extend the existing system (DataTable gains its documented
  card fallback; one new StickyActionBar primitive); no new runtime dependency, no
  speculative MobilePageHeader/OverflowRow unless a surface needs them (creation rule). PASS.

## Aspect decisions

| Aspect | Decision |
| --- | --- |
| Routes | ALL 25 registered routes + the catch-all classified in the device-contract table (no route additions; the dev-only gallery stays excluded from routing/E2E claims) — each with primary/secondary/unsupported classes, its table narrow-width behavior, and (management routes) the clarified mobile-editing boundary |
| Components | Extend the system, don't fork it: `DataTable` gains the card fallback (its documented deferral lands here — scroll wrapper stays for the surfaces whose contract names it); new `StickyActionBar` primitive (token z-index + safe-area, focus-honest); `MobilePageHeader`/`OverflowRow` ONLY if a surface's contract requires them (creation rule, FA-5); per-surface layout fixes stay in each feature module's CSS |
| State/data flow | Unchanged — no query, RPC, auth, or lifecycle change; orientation/rotation relies on React state living outside the viewport (no remount by design) |
| Backend | NOT_REQUIRED — verbatim contracts; field-level visibility identical between table and card presentations |
| Testing | E2E: overflow sweep (all routes × 320/390/430), device-class journeys (tablet-landscape cashier/kitchen interactions; desktop + wide management; orientation preservation; virtual-keyboard completion at 390), Phase-15 a11y suites re-run green at the new widths. Unit: DataTable card-fallback contract. Existing viewport projects (390×844, 834×1112) are the anchors |
| Frozen | Every existing E2E pin (labels, names, `data-*` hooks, order-sensitive locators) holds verbatim — layout moves that break order-sensitive locators migrate the assertion in the same commit and record a ledger entry (Category-A) |

## Key decisions (D1–D7)
- **D1 — The device contract artifact.** One reviewed table (per route: primary device
  class, secondary, explicitly unsupported, table narrow-width behavior, mobile-editing
  boundary) lives at `specs/036-responsive-and-device-hardening/device-contracts.md`;
  the distilled rules (breakpoint usage, sticky-bar pattern, table→card pattern,
  density rules) land in `docs/conventions.md`. Zero unclassified routes (FR-01, SC-001).
- **D2 — Breakpoint discipline (no magic numbers).** Media queries use exactly the
  documented token-scale values (`--breakpoint-mobile-max: 640px`,
  `--breakpoint-tablet-max: 1024px`, `--breakpoint-desktop-max: 1440px` — custom
  properties cannot be read inside `@media`, so the values are the documented scale).
  The existing 22 `@media` blocks are audited against the scale; drift is normalized or
  recorded. A new breakpoint value is a design-system amendment with its reason (FR-02).
- **D3 — Overflow proof.** The E2E overflow matrix asserts
  `scrollWidth <= clientWidth` on the scrolling element (and no fixed-overflow element)
  for every route at 320/390/430 px in its authorized state, with long-content variants
  (longest seeded names/addresses) on content routes (FR-03, SC-002).
- **D4 — Table narrow-width behavior lands.** The six hand-rolled production tables
  (`StaffListPage`, `AuditLogPage`, `VoidReportPage`, `ReportsPage`,
  `PlatformConsolePage`, `TaxPreview`) each get a DEFINED behavior: the DataTable card
  fallback pattern (same columns render as row cards — no data loss, same
  per-role disclosure) or a documented scroll region where the device contract names it
  (many-column reports: sticky identity column). Same-disclosure verified for a
  lower-privileged role (FR-06, SC-004).
- **D5 — Sticky/anchored mobile actions.** `StickyActionBar` anchors primary actions on
  customer mobile flows where the contract demands it (cart submit, round submission);
  token z-index layer, safe-area padding, and it never covers focusable content or the
  focus ring (FR-07).
- **D6 — Orientation + virtual keyboard proof.** Rotation (`setViewportSize` portrait ↔
  landscape) preserves scroll, open surfaces, and in-flight input — no remount flash, no
  duplicate announcements (the 032 announcement policy still holds). Virtual-keyboard
  behavior is proven by viewport-shrink emulation at 390 px: the focused field and the
  submit action remain reachable by scroll without losing input state (technique limit
  recorded — no real IME in CI) (FR-08, FR-09).
- **D7 — A11y carry-forward is a hard gate.** After ALL layout work: the Phase 15 suites
  (a11y matrix, keyboard journeys, touch targets, motion preferences) pass UNMODIFIED
  except deliberate Category-A migrations; axe re-runs at mobile and tablet rows; touch
  targets re-verified post-layout; 200 % zoom still holds (FR-10's standing gate, SC-005).
