# Feature Specification: Frontend Foundation & Architecture Baseline (Frontend Phase 01)

**Feature Branch**: `021-frontend-foundation`

**Created**: 2026-09-26

**Status**: Draft

**Input**: Frontend Master Plan §8 Phase 01 — "give every later frontend phase a safe substrate:
a styles pipeline, route metadata, an error boundary, one query-client policy,
accessibility/responsive/console test tooling, and a written presentation-contract ledger. No
visual design decisions here. The ledger and the query policy are evidence-based artifacts, not
opinionated defaults."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The app never white-screens (Priority: P1)

A project owner (or any user) opens any route when something goes wrong — a component throws
during render, the network fails, or an unknown path is visited — and sees a human-readable,
recoverable error or not-found view instead of a blank page or raw stack. The view offers a
route back (dashboard or public entry) and never exposes internal messages.

**Why this priority**: the error boundary + 404 posture is the safety net every later phase
builds on; without it no redesign can be rolled out safely.

**Independent Test**: render each route; force a render error in a dev harness; visit an unknown
path. Each shows the recoverable error view or the not-found view; a "back to safety" action
navigates to a working route. No console errors beyond the intentionally thrown one.

**Acceptance Scenarios**:

1. **Given** any route, **When** a render-time error is thrown inside its tree, **Then** a
   recoverable error view renders (never a blank page), offers a route back, and logs nothing
   beyond the error itself.
2. **Given** an unknown path, **When** visited, **Then** the unknown-route view renders with a
   route back (behavior per Clarification Q1).
3. **Given** a deep link to a valid route whose subtree throws, **When** the error boundary
   catches, **Then** the shell around it survives where the boundary is placed.

### User Story 2 - Every route is addressable and titled (Priority: P1)

A user navigates the app and the browser tab always shows a meaningful title for where they are;
browser history is usable. Every registered route has metadata (title, description) applied
centrally, not scattered through pages.

**Why this priority**: route metadata is the contract the shell (Phase 03) and every surface
phase consume; it is trivial to break later if not centralized now.

**Independent Test**: visit every registered path and assert the document title matches the
route registry; assert a description meta is present.

**Acceptance Scenarios**:

1. **Given** any registered route, **When** visited, **Then** `document.title` equals the
   registry's title for that route.
2. **Given** any registered route, **When** visited, **Then** the document carries a meta
   description for that route.
3. **Given** the dev-only gallery route, **When** visited in a production build, **Then** it does
   not exist (excluded from production bundles and routing).

### User Story 3 - One documented, centralized query policy (Priority: P2)

A developer (or agent) opening the codebase finds one written, evidence-based QueryClient
policy: what the defaults are, which query families deviate and why, and proof that the policy
preserves today's observable behavior (poll cadence, refetch triggers, refusal rendering,
realtime recovery).

**Why this priority**: the Master Plan mandates FR-05's evidence-based process; guessing a
policy risks breaking tested realtime/polling behavior silently.

**Independent Test**: read the policy document; run unit assertions on the centralized defaults;
run the E2E suites that prove poll cadence and realtime recovery unchanged.

**Acceptance Scenarios**:

1. **Given** the current behavior evidence (default-options client; 60 s staleTime on the public
   restaurant read; 10 s customer poll; refetch-on-focus staff behavior; SUBSCRIBED recovery
   refetch), **When** the centralized policy is applied, **Then** none of those observable
   behaviors change (E2E green, unit assertions on defaults).
2. **Given** the policy document, **When** a developer needs to add a query, **Then** the policy
   states where defaults apply and how to register a justified deviation.

### User Story 4 - An automated accessibility, viewport, and console floor (Priority: P2)

A developer runs the E2E suite and gets automatic verification that: public and signed-out staff
routes pass an axe baseline; the existing surfaces render at mobile (390×844) and tablet
(834×1112) viewports; and no unexpected console errors, unhandled rejections, or failed requests
occur on route changes (expected business refusals are explicitly listed, not counted as
failures).

**Why this priority**: the regression net that makes every later visual phase safe; mandated by
gates F-G12/F-G13/F-G14.

**Independent Test**: run the new a11y/viewport/console specs against the unmodified surfaces;
all pass; intentionally introduce a console error and the assertion fails.

**Acceptance Scenarios**:

1. **Given** a signed-out public route, **When** the axe baseline runs, **Then** no violation
   beyond the recorded baseline fails.
2. **Given** the viewport projects (mobile/tablet), **When** the smoke suite runs, **Then** the
   existing surfaces render without horizontal overflow assertions failing.
3. **Given** a route change, **When** an unexpected console error/unhandled rejection/failed
   request occurs, **Then** the assertion fails; **When** an expected business refusal listed in
   the per-phase expected list occurs, **Then** it does not fail.

### User Story 5 - The presentation-contract ledger exists (Priority: P2)

A future phase agent opens `docs/frontend-presentation-contracts.md` and finds every E2E-asserted
selector: accessible names, roles, headings, live regions (Category A), `data-*` state hooks
(Category B), `data-testid` hooks (Category C), and the frozen localStorage keys
(Category D) — generated from `e2e/**` and `src/**`, not from memory.

**Why this priority**: the ledger is the migration rule-book (gate F-G09) every later phase
reads before touching UI.

**Independent Test**: cross-check the ledger against `e2e/**` selectors; every asserted hook
appears in its correct category; frozen keys listed as frozen.

**Acceptance Scenarios**:

1. **Given** the repository, **When** the ledger is generated, **Then** it covers every
   `getByRole`/`getByLabel`/`getByText` name surface, every `data-*` state hook, every
   `data-testid`, and both localStorage keys, each in its stability category.
2. **Given** a proposed UI change, **When** the agent consults the ledger, **Then** the change
   cost discipline per category is stated (preserve, or migrate in the same commit with the
   paired test update).

### User Story 6 - Styles pipeline and base accessibility exist (Priority: P3)

A developer finds `src/styles/` imported once in a documented order (reset → base → later
tokens), containing only deliberate neutral normalization: font stack inherited, focus-visible
policy, skip link target and styling, base spacing/typography deliberately absent (Phase 02
supplies values). No component styling.

**Why this priority**: enabling structure; visual values are explicitly Phase 02.

**Independent Test**: inspect the import order and file contents; verify `html[lang]`, skip link
to `#main`, and visible focus styles; verify no component styling leaked in.

**Acceptance Scenarios**:

1. **Given** the app, **When** loaded, **Then** `html[lang]` is present and Tab shows a visible
   focus indicator and a working skip link to `#main`.
2. **Given** `src/styles/`, **When** inspected, **Then** it contains only neutral normalization
   with the documented import order and no token values (documented absence, per FR-01).

### Edge Cases

- What happens when a render error occurs inside the error boundary itself? The top-level
  boundary renders a minimal static fallback (no recursion).
- What happens when the dev gallery is visited in a production build? It is excluded from
  production bundles and routing (FR-09).
- What happens when an expected business refusal fires (e.g., an unauthorized deep link)? It is
  listed in the per-phase expected-failure list and does not fail the console-cleanliness
  assertion (F-G14 semantics).
- What happens when a query family needs a policy deviation later? It must be registered in the
  policy document with justification; no silent defaults change (FR-05).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-01**: The app MUST have a styles pipeline: `src/styles/` imported once from `src/main.tsx`
  in a documented order (reset → base → reserved for Phase 02 tokens), containing deliberately
  neutral base CSS only (no component styling, no token values — a documented absence).
- **FR-02**: The app MUST apply per-route document titles and a meta description from a central
  route-metadata registry covering every registered path, including the dev gallery.
- **FR-03**: The app MUST render a top-level error boundary that catches unhandled render errors
  and shows a recoverable error view (route back offered, no internal messages, no white screen).
- **FR-04**: The app MUST handle unknown paths with an unknown-route view or documented redirect
  (behavior per Clarification Q1), offering a route back.
- **FR-05**: The app MUST centralize the QueryClient with a written, evidence-based policy:
  document current behavior (default-options client; 60 s staleTime public restaurant read; 10 s
  customer poll; refetch-on-focus staff surfaces; SUBSCRIBED recovery refetch), define the
  policy, identify behavior-sensitive settings, validate against existing behavior, and record
  regression evidence (unit assertions on defaults + green behavior E2E). No query-policy change
  is accepted merely as a generic best practice; any deviation that would alter observable
  behavior is a clarify question, not a default.
- **FR-06**: Accessibility lint MUST be enabled for `src/**` (dev-only dependency
  `eslint-plugin-jsx-a11y`, per Clarification Q2 approval) and pass with the codebase.
- **FR-07**: An automated axe baseline MUST be runnable per route (dev-only dependency
  `@axe-core/playwright`, per Clarification Q2 approval) for public routes and the signed-out
  staff surfaces, with violations recorded as a baseline, not silently waived.
- **FR-08**: Playwright MUST gain viewport projects (mobile 390×844, tablet 834×1112) as tagged
  projects, and at least one unexpected-console-error/unhandled-rejection/request-failure
  assertion per top-level route (F-G14 semantics with an explicit expected-refusal list).
- **FR-09**: A dev-only gallery route MUST render the styles/structure available so far, excluded
  from production builds and routing tests (route per Clarification Q3).
- **FR-10**: A committed presentation-contract ledger (`docs/frontend-presentation-contracts.md`)
  MUST enumerate selectors generated from `e2e/**` and `src/**`, organized into four stability
  categories — A Semantic (accessible names, labels, roles, headings, live regions, tested focus
  behavior), B Behavioral (`data-*` state hooks, lifecycle selectors, state-specific DOM markers),
  C Test-only (`data-testid`), D Storage (frozen localStorage keys
  `restopilot.session-token`, `restopilot.cart`) — with each category's change discipline.
- **FR-11**: `docs/conventions.md` and `docs/development.md` MUST be updated in the same change
  for: the styles pipeline, route metadata, error/404 behavior, query policy location, a11y
  tooling usage, viewport projects, console assertions, and the ledger.
- **FR-12**: Any new script added to `package.json` MUST be registered in `verify` and
  documented in `docs/development.md` in the same commit; `verify` may not be weakened.

### Key Entities *(include if feature involves data)*

- **Route registry**: every registered path with title + meta description; consumed by the
  router composition; no page edits required.
- **Query policy document**: defaults table + per-family deviations + evidence links; lives with
  the centralized client.
- **Presentation-contract ledger**: categorized selector inventory (A/B/C/D) with change-cost
  discipline; committed documentation, generated from the test sources.
- **Expected-refusal list**: per-route list of expected business refusals excluded from console
  failure assertions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every registered route renders a correct document title and description (route
  sweep assertion passes for all 25 routes + dev gallery).
- **SC-002**: Forced render errors and unknown paths never produce a blank screen; the recovery
  views render within one frame and offer a working route back (E2E-asserted).
- **SC-003**: The E2E suite passes with the new axe baseline, viewport projects (mobile/tablet),
  and console-cleanliness assertions against the unmodified surfaces — zero product behavior
  change (all 13 existing suites remain green).
- **SC-004**: The centralized query policy preserves every observable behavior in the evidence
  list; unit assertions pin the defaults; no E2E behavior test changes.
- **SC-005**: The ledger accounts for every E2E-asserted selector in `e2e/**` (approximately 666
  accessible-name assertions, 10 `data-*` hooks, 16 `data-testid` hooks) and both frozen
  localStorage keys, each categorized.
- **SC-006**: `npm run verify` passes end-to-end with the new lint rule and any script changes.

## Assumptions

- WCAG target is 2.2 AA (per Clarification Q2) — the axe floor enforces the automatable subset.
- Viewport projects are added for chromium only in this phase; WebKit/Firefox cross-browser
  projects stay deferred to Phase 16 (cost/benefit recorded in the Master Plan).
- The dev gallery is a dev-only route (`import.meta.env.DEV`-gated), excluded from production
  bundles and routing tests.
- No runtime dependency is added; the two dev-only dependencies are explicitly approved via
  Clarification Q2 (Master Plan §12.3).
- The E2E database precondition (migrated + seeded cloud dev project) holds; the residue-policy
  defect in the mutating e2e suites is recorded as a carry-forward task, not fixed here unless
  trivially adjacent.
- The existing 3 pre-existing lint warnings are out of scope (no unrelated refactors).

## Clarifications

### Session 2026-09-26

- Q1: For an unknown path, should the app render a 404 view or redirect to a known entry? → A: Render a dedicated 404 view (never found) offering routes back to the public entry and the dashboard; no silent redirect.
- Q2: Approve the two dev-only dependencies (eslint-plugin-jsx-a11y, @axe-core/playwright) and the WCAG target? → A: Approved; WCAG 2.2 AA is the recorded target for the automatable axe floor.
- Q3: What route should the dev-only gallery live at? → A: `/dev/gallery`, dev-only (`import.meta.env.DEV`-gated), excluded from production builds and routing tests.
- Q4: Should `verify` gain an a11y step now? → A: No — the axe floor runs inside `test:e2e`; `verify` is unchanged except for any new script registrations required by FR-12.
