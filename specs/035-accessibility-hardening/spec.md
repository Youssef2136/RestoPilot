# specs/035 — Accessibility Hardening (Master Plan §Frontend Phase 15)

## spec.md

## Clarifications (session 2026-10-06)

- Q: Which WCAG level does the automated floor pin for this phase? → A: WCAG 2.2 AA
  automatable axe subset — the spec 021 Clarification Q2 decision confirmed unchanged
  (tags wcag2a/2aa/21a/21aa/22aa); screen-reader walkthroughs cover what axe cannot.
- Q: Is forced-colors support required as implementation now, or audit-and-record? →
  A: Audit-and-record — the current token system's forced-colors behavior is verified,
  and every gap is recorded in the exceptions list with a reason and an owner; no new
  token-system work this phase (consistent with "no redesign").
- Q: Which journeys do the recorded screen-reader walkthroughs cover? → A: All five
  critical journeys (customer ordering, cashier transitions, kitchen ticket, session
  close, onboarding) — recorded as expected-outcome scripts in the phase quickstart.
- Q: Which findings may be recorded as exceptions instead of fixed? → A: Serious-plus
  fixes: every critical/serious finding is fixed in this phase; moderate/minor may be
  recorded in the exceptions list with a written reason and a named owner (the spec
  021 discipline, phase-wide).

### Purpose
Turn accessibility from "labels and alert roles" into a **verified property of the
whole product**: keyboard-complete, screen-reader-correct, contrast-compliant,
target-size-safe, and motion-honest — for every role, including the customer with one
hand and a phone on a restaurant floor. This phase **hardens**: its requirements are
audit-and-fix requirements, and its exit is findings-driven (every finding either fixed
or recorded with a reason and an owner — no silent gaps).

### Audit Scope
A full audit pass across all registered routes and both shells (customer + staff), in
each route's authorized state (owner/manager/cashier/kitchen/super-admin/customer
where reachable), covering: automated axe scans, keyboard-only operation, focus
management, live-region behavior, contrast of every token pair in use, touch targets
at mobile and tablet, reduced-motion and forced-colors behavior, and screen-reader
walkthroughs of the critical journeys.

### Critical journeys (screen-reader + keyboard proof targets)
- Customer ordering: entry → menu → cart → round → status.
- Cashier transitions: assign to round → mark paid → close.
- Kitchen ticket: arrival → ready.
- Session close.
- Super-admin tenant onboarding.

### User Stories (prioritized)

#### US1 — Every route passes the automated floor (Priority: P1)
The axe floor that today covers a handful of routes extends to **every route in its
authorized state**: no violation outside the committed baseline anywhere. The channel
route's pre-existing target-size findings (A3 — the 025 cart micro-buttons, recorded
at 390 px in spec 031's E2E) become fix-or-record items in this phase, not folklore.

**Why this priority**: the standing proof must cover the whole product before any
journey work; it is the regression net everything else leans on.

**Independent Test**: run the expanded axe suite across all routes/roles; zero
unwaived findings.

**Acceptance Scenarios**:
1. **Given** any registered route in its authorized signed-in state, **When** the axe
   scan runs, **Then** no violation outside the committed baseline (WCAG 2.2 AA
   automatable subset, per spec 021 Clarification Q2).
2. **Given** the 025 cart at 390 px, **When** the axe scan runs, **Then** the recorded
   target-size findings are either fixed (baseline entry removed) or owned in the
   baseline with a written justification and this phase as owner.

#### US2 — Keyboard-complete critical journeys (Priority: P1)
A keyboard-only cashier completes a full round transition; a keyboard-only customer
orders end-to-end; kitchen works a ticket from arrival to ready; dialogs, drawers,
and route changes behave (focus moves in, stays in, restores on close).

**Why this priority**: keyboard completeness is the hardest and most
product-defining claim; without it "accessible" is marketing.

**Independent Test**: E2E keyboard-journey specs complete each critical journey
without a mouse.

**Acceptance Scenarios**:
1. **Given** a keyboard-only cashier on an open round, **When** they walk assign →
   mark paid → close using only the keyboard, **Then** the transition completes and
   focus remains visible and logical throughout.
2. **Given** any dialog or drawer open, **When** the user Tabs, **Then** focus stays
   within the surface while open, Escape closes it, and focus restores to the
   trigger on close.
3. **Given** a route change or a refetch-driven re-render, **When** focus is
   re-evaluated, **Then** nothing steals focus from the user mid-task.

#### US3 — Screen-reader-correct critical journeys (Priority: P2)
A screen-reader user follows a kitchen ticket from arrival to ready; live updates
announce politely (once, with the right role and text); loading and error states
announce; a recorded walkthrough with expected outcomes exists for the five critical
journeys.

**Why this priority**: polite, non-spammy announcements are the a11y contract for a
realtime product; they need dedicated proof beyond axe's automatable subset.

**Independent Test**: the live-region audit + recorded walkthroughs demonstrate each
journey's announcement sequence matches the policy.

**Acceptance Scenarios**:
1. **Given** a kitchen board with live ticket updates, **When** a ticket arrives and
   becomes ready, **Then** each transition announces once with the agreed copy — no
   duplicates, no spam on refetches.
2. **Given** a long operation runs, **When** progress updates, **Then** progress
   announces politely (status semantics, not alerts), and nothing moves focus.

#### US4 — Verified contrast, targets, and motion honesty (Priority: P2)
Contrast of every token pair in use is verified with documented results; touch
targets pass at mobile and tablet; reduced-motion and forced-colors behavior is
verified (or its absence recorded); zoom to 200 % keeps content and function on the
critical journeys.

**Why this priority**: these are the token-level guarantees the design system owes
every surface at once — fixing them centrally beats per-surface whack-a-mole.

**Independent Test**: contrast/target/motion audit artifacts with per-pair results
and the E2E/forced-colors checks.

**Acceptance Scenarios**:
1. **Given** every token pair in use, **When** contrast is computed, **Then** each
   pair passes 4.5:1 (text) / 3:1 (large text and UI components) or is recorded in
   the exceptions list with reason and owner.
2. **Given** reduced-motion preference, **When** the customer entry or kitchen board
   renders, **Then** non-essential animation is disabled or recorded as an exception.

#### US5 — Landmarks, skip links, and a reviewed exceptions record (Priority: P3)
Every shell provides skip links and landmarks; accessible names verified against the
presentation ledger (no regressions); every residual gap lives in one reviewed
exceptions list — each with reason and owner — and the keyboard maps for operational
surfaces are documented in `docs/`.

**Why this priority**: the record and the documentation are what make the hardening
permanent rather than a one-time cleanup.

**Independent Test**: audit artifacts + docs exist; the exceptions list has no
unowned entries.

**Acceptance Scenarios**:
1. **Given** either shell, **When** a keyboard user lands, **Then** a skip link
   reaches the main content and landmarks are present and named.
2. **Given** any finding not fixed in this phase, **When** the audit closes, **Then**
   it appears in the exceptions list with a written reason and a named owner.

### Edge Cases
- A route reachable only with data present (e.g. an empty board) — the authorized
  state scanned is the state a real user reaches; empty/loading states are audited
  too, not skipped.
- Denial views (role-refused or tenant-refused): an improved denial presentation
  must disclose nothing new — a11y fixes never alter authorization decisions.
- Hover-only affordances: any action reachable only by hover or drag must gain a
  keyboard/reachable alternative or be recorded.
- Error recovery never requires re-entering a whole form.
- Forced-colors: if full support is not required now, the gap is recorded with a
  decision — not silently absent.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-01**: Automated a11y assertions (WCAG 2.2 AA automatable subset) MUST pass for
  every route in its authorized state (owner/manager/cashier/kitchen/super-admin/
  customer where reachable), with findings outside the committed baseline failing the
  suite.
- **FR-02**: The critical journeys MUST be keyboard-complete and proven in E2E
  (customer ordering, cashier transitions, kitchen ticket, session close, onboarding).
- **FR-03**: Keyboard maps for the operational surfaces (cashier, kitchen) MUST be
  documented in `docs/`.
- **FR-04**: Focus-order and focus-restore rules MUST hold for dialogs, drawers, and
  route changes (focus moves in on open, is contained while open, restores to the
  trigger on close; route changes and refetch-driven re-renders never steal focus).
- **FR-05**: A live-region audit MUST be completed, with a corrected announcement
  policy where announcements duplicate or spam; the policy is encoded in tests.
- **FR-06**: Contrast MUST be audited for all token pairs in use, with documented
  per-pair results (pass, or exception with reason and owner).
- **FR-07**: Touch targets MUST be audited at mobile and tablet viewports, with
  findings fixed or recorded (the spec 031 A3 cart micro-buttons finding is the first
  owned item).
- **FR-08**: Reduced-motion and forced-colors behavior MUST be verified, or the gap
  recorded with an explicit decision.
- **FR-09**: Skip links and landmarks MUST be present and named on every shell.
- **FR-10**: Accessible names MUST be verified against the presentation ledger with
  no regressions (any renames follow the Category-A discipline).
- **FR-11**: A reviewed exceptions list MUST record every residual finding with a
  reason and a named owner — no silent gaps; findings fixed in this phase are closed
  with evidence. The fix-or-record threshold (clarified): every critical/serious
  finding is FIXED in this phase; moderate/minor findings MAY be recorded with a
  written reason and a named owner.

### UX Requirements
- Every interactive element is reachable and operable without a mouse; no action is
  reachable only by hover or drag.
- Error recovery never requires re-entering a whole form.
- Long operations announce progress politely; nothing steals focus on live updates.

### Visual Requirements
- Fixes must look intentional within the committed design world — focus rings are
  first-class visual elements, state changes are conveyed by more than color, and
  there is no "accessibility mode" that looks worse than the default. If a fix
  requires a system change, it amends the design system rather than forking it.

### Responsive Requirements
- Target sizes verified at mobile and tablet; keyboard operation verified with the
  mobile drawer; zoom to 200 % without loss of content or function on the critical
  journeys.

### Out of scope
No visual redesign (fixes respect the committed design world); no backend or
authorization changes; no localization; no new features; no PWA/device-contract work
(that is Phase 16). Authorization decisions and denial data disclosure stay exactly
as they are.

### Dependencies
All surface phases (04–14) complete enough to audit; Phase 01's a11y tooling
(`e2e/helpers/a11y.ts`, jsx-a11y lint, viewport projects); the presentation-contract
ledger; `docs/conventions.md` accessibility rules.

### Success Criteria *(mandatory)*
- **SC-001**: The expanded axe suite passes on all routes/roles with zero unwaived
  findings (fixes landed or baseline entries recorded with justification).
- **SC-002**: Each critical journey completes keyboard-only in E2E with focus
  assertions (containment, restore, no steal).
- **SC-003**: The contrast audit documents a result for every token pair in use —
  pass or owned exception; the same for touch targets at mobile/tablet.
- **SC-004**: The live-region policy is corrected where audits found duplication or
  spam, and the corrected policy is encoded in the E2E specs.
- **SC-005**: The exceptions list is complete (every residual finding has a reason
  and owner) and the manual walkthroughs are recorded with expected outcomes.
- **SC-006**: No accessibility regression reaches later phases unnoticed — the a11y
  suite is part of the standing `verify`/E2E gates that Phases 16–20 re-run.

### Assumptions
- WCAG target stays the spec 021 decision: 2.2 AA automatable axe subset (confirmed
  at clarify; screen-reader walkthroughs cover what axe cannot).
- The committed baseline in `e2e/helpers/a11y.ts` (empty at Phase 01) plus the
  recorded spec 031 A3 target-size finding are the honest starting inventory; any
  further findings surfaced by the widened scans join the same record.
- Forced-colors: audit-and-record (clarified) — the current token system's behavior
  is verified and every gap is recorded with a reason and an owner; no new
  token-system work this phase.
- Manual screen-reader walkthroughs are recorded as documented expected-outcome
  scripts in the phase's quickstart (not automated asserts of a specific screen
  reader vendor).
- Phase 16 (Responsive) follows this phase and must re-run the a11y suite after
  layout changes.

### Key Entities (audit artifacts, not runtime data)
- **Audit report**: findings with severity, fix-or-record decision, and evidence.
- **Exceptions list**: every unfixed finding with reason + owner (single reviewed
  record, in the audit artifacts).
- **Keyboard maps**: per operational surface, in `docs/`.
- **Contrast record**: per token pair in use: ratio, pass/exception.
