# Research — 035-accessibility-hardening

> Every entry resolves an unknown from the spec/plan with the repo's recorded facts.
> "Decision / Rationale / Alternatives" format.

## R1 — The automated floor: extend, don't replace
- **Decision**: Extend the existing `e2e/helpers/a11y.ts` axe runner (WCAG 2.2 AA tags
  `wcag2a/2aa/21a/21aa/22aa` — spec 021 Q2, confirmed at clarify) with a route×state
  matrix instead of writing a second engine.
- **Rationale**: The helper already owns the baseline-waiver discipline (findings never
  silently waived; entries need justification + owning phase). Reuse honors the
  constitution's YAGNI and keeps one source of truth for the floor.
- **Alternatives**: A separate a11y harness (rejected: two floors, two baselines);
  a lint-time-only approach (rejected: axe catches rendered semantics lint cannot).

## R2 — Authorized-state reachability (the audit matrix)
- **Decision**: The matrix enumerates the registered paths (`src/routes.ts`: 3 public,
  3 customer, 15 staff dashboard incl. branch detail/menu/tax, 2 admin) and scans each
  in the state its role actually reaches; empty/loading states ride the same scans.
  Denial views are scanned as-seen; they disclose nothing new (constitution III/IV).
- **Rationale**: The spec requires "every route in its authorized state … where
  reachable"; the router is the authoritative registry.
- **Alternatives**: Scanning only P1 routes (rejected: FR-01 says every route);
  unauthenticated scans of protected routes (rejected: that tests the redirect, not the
  surface).

## R3 — Keyboard journeys: what exists vs what is new
- **Decision**: Reuse the proven keyboard-only walks (cashier tablet chain in
  `cashier.operations.test.ts`; kitchen keyboard walk in `kitchen.display.test.ts`),
  ADDING dialog/drawer focus containment + trigger-restore assertions; NEW
  keyboard-only specs for customer ordering, session close, and super-admin
  onboarding.
- **Rationale**: FR-02 names five journeys; two already walk by keyboard — proving
  focus rules on them is the honest delta, not a rewrite (spec 031's E2E-migration
  discipline).
- **Alternatives**: Rewriting all five as one mega-spec (rejected: loses the frozen
  anchors' locality and mixes fixtures).

## R4 — Live regions: a standing policy exists
- **Decision**: Audit announcements against `features/realtime/announcementPolicy.ts`
  (spec 032's policy artifact) and the documented per-region roles (Toast host
  `role=region`+polite; inline `role=alert` for errors; `SubmitControl`/`SubmitBar`
  status regions; `ReconnectingBanner` polite-not-status rationale; kitchen/cashier
  sr-only polite counters). Corrections (duplication/spam) change code + unit tests;
  the policy document is amended, not forked.
- **Rationale**: 032 already encodes the "announce once, politely" rules and their
  test pins; this phase audits the whole product against that policy rather than
  inventing a second one.
- **Alternatives**: An assertive-everywhere policy (rejected: hostile to screen-reader
  users on a realtime board); a new announcement library (rejected: YAGNI).

## R5 — Targets, motion, contrast
- **Decision**: Touch-target audit at 390 px and 834 px viewports (Playwright bounding
  boxes), starting from the recorded 031 A3 cart micro-buttons finding (fix or owned
  record). Reduced-motion verified against the existing CSS blocks
  (`styles/base.css`, `Button.module.css`, `Feedback.module.css`,
  `staffOps.surfaces.module.css`). Forced-colors audited via Chromium emulation and
  recorded per clarify (audit-and-record; no token-system work now). Contrast: every
  token pair in use computed and recorded in `specs/035-accessibility-hardening/audit/contrast.md` (axe
  color-contrast is the automatable net; the table is the standing record).
- **Rationale**: The A3 finding is the phase's first owned item by name (spec US1);
  forced-colors work beyond recording is explicitly out of scope.
- **Alternatives**: Browser-only manual checks (rejected: not re-runnable); a new
  token-audit dependency (rejected: YAGNI — the table suffices).

## R6 — The audit artifacts (this phase's "data model")
- **Decision**: `specs/035-accessibility-hardening/audit/report.md` — every finding with severity
  (critical/serious/moderate/minor), decision (fixed / recorded), and evidence;
  `specs/035-accessibility-hardening/audit/exceptions.md` — every unfixed finding with reason + owner; the axe
  baseline stays empty except owned entries. Keyboard maps for cashier/kitchen land in
  `docs/` (conventions or a dedicated a11y page per conventions.md placement rules).
- **Rationale**: FR-11 demands one reviewed record with no silent gaps; the ledger
  culture (docs/frontend-presentation-contracts.md) is the house pattern.
- **Alternatives**: Scattering findings across phase reports (rejected: not one
  reviewed list); tracking in an external tool (rejected: nothing external exists).

## R7 — Zoom and the mobile drawer
- **Decision**: Zoom-200% checks on the critical journeys (browser zoom emulation in
  E2E, content/function preserved); the mobile drawer's keyboard operation (open,
  navigate, close, focus return) joins the customer keyboard spec (FR-04/Responsive).
- **Rationale**: The Master Plan's Responsive Requirements name both explicitly.
- **Alternatives**: Defer to Phase 16 (rejected: zoom is an a11y requirement here;
  Phase 16 owns device contracts, not zoom resilience).
