# specs/036 — Responsive & Device Hardening (Master Plan §Frontend Phase 16)

## spec.md

## Clarifications (session 2026-10-07)

- Q: Do we add WebKit/Firefox Playwright projects in this phase? → A: No —
  Chromium device emulation stays the E2E engine; the phase's risk is layout, not
  engine semantics, and the standing batch protocol (time window + cloud rate
  limits) stays valid. Cross-browser expansion is recorded as a future option,
  not silently absent.
- Q: What is the officially supported device matrix? → A: Phones 320–430 px
  supported; tablet touch 768–1024 px supported (portrait and landscape); desktop
  ≥1280 px supported with a wide check beyond 1600 px for reports/comparison;
  below 320 px, watch-class, TV-class, and foldables' inner displays are
  explicitly unsupported; the kitchen wall screen is served by the desktop
  band's legibility contract.
- Q: Is tablet landscape the cashier's primary form factor? → A: Yes — tablet
  landscape is the verified primary operational posture for cashier surfaces
  (FR-04's interactive proof); desktop remains fully supported; cashier-on-phone
  is best-effort, not a design target.
- Q: What are the mobile-editing boundaries for management surfaces? → A:
  View-first with safe quick actions: on phones, management surfaces read fully
  (card fallbacks) and role-safe quick actions stay operable (e.g. item
  availability); heavy configuration (menu structure, tax rules, platform
  controls) is documented desktop/tablet-primary in each route's device
  contract.

### Purpose
The product is used on a guest's phone, a cashier's tablet, a kitchen wall screen,
and an owner's laptop. This phase makes every surface **genuinely usable on its real
device class** instead of merely "not broken": each route gets a documented device
contract, breakpoints behave consistently from the committed token scale, no route
overflows horizontally at the small widths, and the operational surfaces (cashier,
kitchen) are verified at their real form factors. This phase **hardens**: it does not
redesign surfaces that are already correct at their device class, and every layout
change must keep the Phase 15 accessibility suite green.

### Device classes (the four real classes this phase serves)
- **Phone (≈390 px, down to 320 px)** — the guest's ordering surface; the revenue
  path (master plan §R7: mobile-first in reality).
- **Tablet touch (≈768/834/1024 px, portrait and landscape)** — the cashier's and
  manager's floor device; landscape is the operational posture.
- **Desktop (≈1280–1600 px)** — owner/manager/administrative work: dense tables,
  forms, configuration.
- **Wide desktop (beyond 1600 px, check-only)** — reports/comparison surfaces must
  stay readable and bounded, not stretched.

Officially supported (clarified): phone 320–430 px, tablet touch 768–1024 px
(portrait and landscape), desktop ≥1280 px with the wide check beyond 1600 px.
**Explicitly unsupported**: below 320 px, watch-class, TV-class displays, and
foldables' inner displays — the product renders but its correctness is not claimed
there; the kitchen wall screen is served by the desktop band's legibility contract.

### User Stories (prioritized)

#### US1 — The guest orders on a 390 px phone without zooming or horizontal scrolling (Priority: P1)
Every customer-facing surface (entry, menu, cart, round submission, status) fits its
viewport: no horizontal overflow at 320/390/430 px, primary actions reachable with a
thumb (sticky/anchored where the flow demands it), form fields and their submit
buttons never hidden behind the virtual keyboard, and long content (long item names,
long restaurant addresses, many extras) wraps instead of overflowing.

**Why this priority**: the customer path is the revenue path; it is the surface most
used on the least controllable device.

**Independent Test**: run the responsive suite across the customer routes at
320/390/430 px — overflow assertions pass, form completion works at 390 px with the
virtual keyboard emulated, and screenshots show meaningful first paint.

**Acceptance Scenarios**:
1. **Given** any customer route at 320/390/430 px, **When** the page renders with
   realistic long content, **Then** there is no horizontal scroll and no clipped
   interactive element.
2. **Given** the cart with items and a round note field at 390 px, **When** the
   on-screen keyboard is open (emulated viewport shrink), **Then** the field being
   typed into and the submit action remain reachable (scrollable into view without
   losing input state).

#### US2 — The cashier works a tablet in landscape with everything in reach (Priority: P1)
The cashier surfaces (dashboard session list, round queue, bill, void flow, session
close) are verified at tablet landscape (834×1112 rotated ≈1112×834 class) —
the clarified primary form factor for cashier work: the
round queue, the active round, and the bill are all visible and operable without
excessive scrolling; action targets keep their 44 px touch minimums; dialogs stay
usable in the rotated viewport.

**Why this priority**: the cashier is the operational heart of the product during
service; a layout that hides the bill or the close action costs real time at the
table.

**Independent Test**: the responsive suite runs the cashier journeys at tablet
landscape with interaction assertions (not just screenshots).

**Acceptance Scenarios**:
1. **Given** an open session with rounds at tablet landscape, **When** the cashier
   walks assign → show bill → close session, **Then** every control is visible and
   operable without horizontal scrolling and without collapsing the layout to a
   phone-like single column.
2. **Given** the void flow open at tablet landscape, **When** the confirm dialog
   renders, **Then** it fits the rotated viewport with its fields and actions intact.

#### US3 — Kitchen staff read the board from two metres on a wall screen (Priority: P2)
The kitchen board stays glanceable at large sizes: column identity, ticket state,
and elapsed ordering remain readable when the board is displayed on a wall-mounted
large screen, and the board's density does not collapse on tablet portrait where a
small kitchen might run it.

**Why this priority**: the board is a display surface, not an interaction surface —
its contract is legibility at distance and honesty of state at a glance.

**Independent Test**: the responsive suite asserts the kitchen board's structural
floor (columns, ticket identity, state markers) at tablet portrait, tablet
landscape, and a large desktop width.

**Acceptance Scenarios**:
1. **Given** the kitchen board at 1600 px and above, **When** it renders with live
   tickets, **Then** the columns remain named and bounded (no unbounded stretching
   that pushes tickets out of view) and ticket state markers remain visible.
2. **Given** the kitchen board at tablet portrait (≈768 px), **When** it renders,
   **Then** the board degrades honestly (columns stack or scroll as a board, never
   clipping a ticket's actionable buttons).

#### US4 — The owner works a laptop with dense tables (Priority: P2)
Management surfaces (menu structure, tax rules, staff, branches, reports, audit,  platform) keep their dense desktop layouts at 1280–1600 px, and every data table
has a defined behavior below its comfortable width: a table→card fallback that
loses no data and respects the same field-level visibility as the table view
(security: no management-only field leaking into a card row visible to a lower
role). On phones the clarified boundary holds: management surfaces read fully
with safe quick actions operable; heavy configuration stays desktop/tablet-primary
(each route's device contract names which).

**Why this priority**: dense tables are where responsive layouts usually break
silently (clipped columns, scrollable traps); the fallback rule must be explicit.

**Independent Test**: the responsive suite runs each management route at desktop
and at the table→card crossover width, asserting the fallback shows the same
information.

**Acceptance Scenarios**:
1. **Given** a management table (e.g. reports aggregates, audit log) narrowed below
   its comfortable width, **When** the fallback renders, **Then** no data column
   disappears — each row's card carries the same fields the table showed.
2. **Given** a lower-privileged role viewing a shared surface at phone width,
   **When** the card fallback renders, **Then** it discloses exactly what the table
   view disclosed for that role — no more.

#### US5 — Anyone can rotate a tablet without losing their place (Priority: P3)
Rotating a tablet (portrait ↔ landscape) preserves the user's place: scroll
position, open dialogs/drawers/panels, and in-flight form input survive the
orientation change; nothing resets, nothing double-submits, and the layout reflows
without losing content.

**Why this priority**: orientation change is the device-class behavior most easily
broken by mount-on-resize patterns; it is a property of the whole shell rather than
of any one surface.

**Independent Test**: the responsive suite performs orientation changes on
representative surfaces (customer menu, cashier dashboard, kitchen board) asserting
state preservation.

**Acceptance Scenarios**:
1. **Given** a half-completed form or an open dialog on a tablet, **When** the
   viewport rotates, **Then** the input values, the open surface, and the scroll
   position are preserved and the user continues where they were.
2. **Given** a live-updating surface (kitchen board, cashier queue), **When** the
   viewport rotates, **Then** live updates continue without duplicate announcements
   (the Phase 15 announcement policy still holds) and without a full remount
   flash.

### Edge Cases
- 320 px is a hard floor: legacy/small devices must not horizontally scroll, even
  where content is aggressively truncated or wrapped.
- Long unbreakable content (long restaurant names, menu item names, notes, error
  messages from the server — surfaced verbatim): wraps or truncates with a
  discoverable expansion, never overflows.
- Tables wider than any fallback can help (many-column reports): the fallback must
  still be defined (horizontal scroll region with sticky identity column is
  acceptable **only** if it is the documented device-contract behavior for that
  surface — not an accident).
- Fixed/sticky elements (mobile action bars, kitchen board header) must never cover
  focusable content or the focus ring when tabbing.
- The on-screen keyboard on customer forms: the field being edited and the primary
  action must remain reachable without scrolling away mid-input (input loss).
- Zoom/OS text scaling at mobile widths: layout must survive 200 % zoom (the Phase
  15 zoom-200 % check extends to the new breakpoints, not regresses).
- Empty and loading states at each width: skeletons/states must not themselves
  overflow or push the layout wider than the viewport.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-01**: Every registered route MUST have a documented device contract —
  primary device class, secondary classes, and what is explicitly unsupported —
  recorded in the phase artifacts and kept with the route inventory; no route may
  be left unclassified. For management routes the contract records the clarified
  mobile boundary: view-first with safe quick actions operable; heavy
  configuration is documented desktop/tablet-primary.
- **FR-02**: Breakpoint behavior MUST be driven by the committed token scale (the
  documented `--breakpoint-*` values): media queries use exactly the documented
  breakpoint values; a new media query value is a design-system amendment recorded
  with its reason, not a per-surface magic number.
- **FR-03**: No route MAY horizontally overflow at 320, 390, or 430 px in its
  authorized realistic states (content present, long content variant where the
  surface has such content).
- **FR-04**: The cashier operational surfaces MUST be verified at tablet landscape
  (the 834×1112 device rotated — the clarified primary cashier form factor): full
  round/bill/close operability with interaction assertions, not screenshots alone.
- **FR-05**: The management/report/platform surfaces MUST be verified at desktop
  (1280–1600 px) and at one wide check (beyond 1600 px) for reports/comparison —
  bounded, readable, no broken columns.
- **FR-06**: Every data table MUST have a defined narrow-width behavior
  (table→card fallback or a documented scroll region) that loses no data and
  preserves field-level visibility per role exactly as the table view disclosed it.
- **FR-07**: Customer mobile flows MUST present primary actions anchored or sticky
  where the flow demands it (cart submit, round submission), with the sticky
  treatment never covering focusable content or the focus ring.
- **FR-08**: Orientation change (portrait ↔ landscape) on touch devices MUST
  preserve scroll position, open surfaces (dialog/drawer/panel), and in-flight
  input; no remount resets, no duplicate live announcements, no double-submission
  windows.
- **FR-09**: Customer forms at 390 px MUST remain completable with the virtual
  keyboard open: the field in focus and the submit action remain reachable
  (viewport-shrink emulation in E2E).
- **FR-10**: A responsive regression suite MUST exist in Playwright covering all
  routes at the defined viewports (overflow assertions), the operational journeys
  at their device classes, and form completion at 390 px — and it becomes part of
  the standing gates later phases re-run.

### UX Requirements
- Density follows device: airy on phones, compact on tablets, comfortable on
  desktop; the same information hierarchy at every width.
- Primary actions are always reachable with a thumb on mobile.
- Nothing important disappears at a breakpoint without a discoverable alternative
  (the device contract names where content collapses and where the alternative
  lives).
- First paint at each width shows meaningful content, not a stack of skeleton
  padding.

### Visual Requirements
- Responsive grid/measure rules, mobile navigation presentation, table collapse
  styling, sticky bar treatment, and image aspect handling all come from tokens —
  no surface invents its own breakpoints, and no new raw hex/magic spacing enters
  with layout fixes.
- The sticky/anchored mobile action treatment and the table→card fallback are
  system patterns (documented in `docs/conventions.md`), not per-surface bespoke
  styles.

### Responsive Requirements
- This phase's subject, defined once: mobile ≈390 px (checks at 320 and 430),
  tablet portrait/landscape ≈768/834/1024 px touch, desktop ≈1280–1600 px, one
  wide check beyond 1600 px for reports/comparison. The existing Playwright
  viewport projects (390×844 mobile, 834×1112 tablet) are the standing device
  anchors; desktop runs at the existing default project with explicit narrow/wide
  checks. The E2E engine stays Chromium with device emulation (clarified); no
  WebKit/Firefox projects are added this phase.

### Accessibility (carry-forward constraints)
- Every layout change keeps the Phase 15 suites green: skip links, landmarks, live
  regions, keyboard operability, and the announcement policy survive re-layout.
- Touch targets re-verified at mobile and tablet after layout changes (the 44 px
  token floor and the axe target-size rule at 390/834).
- Focus order and visible focus re-verified after table→card and sticky-bar
  introductions (the sticky bar enters the tab order honestly or is inert).
- Zoom resilience: 200 % zoom keeps content and function at the new widths.

### Security
- Layout changes must not reveal data hidden by a narrower layout: a card fallback
  discloses exactly what the table view disclosed for the same role (field-level
  visibility rules are presentation of server-enforced authorization, never
  weakened or widened client-side).
- No management-only field may leak into mobile card rows visible to lower roles.

### Out of scope
No PWA/offline app shell; no native app wrappers; no tablet-specific product
features; no redesign of surfaces already correct at their device class; no change
to design tokens beyond adding missing breakpoint/measure tokens if genuinely
required (recorded as a design-system amendment with its reason); no new routes;
no backend, RPC, or authorization changes; no WebKit/Firefox E2E expansion
(clarified: Chromium device emulation only this phase); no localization work.

### Dependencies
All surface phases (04–14) complete; Phase 15 (sequential hardening chain — its
a11y suite must keep passing after layout changes); Phase 01's viewport projects
and responsive baseline; Phase 02's breakpoint/touch tokens and the design-system
gallery; Phase 03's shell/toast/offline infrastructure; the presentation-contract
ledger for any selector migration.

### Success Criteria *(mandatory)*
- **SC-001**: Every registered route has a documented device contract (primary /
  secondary / explicitly unsupported) — zero unclassified routes.
- **SC-002**: The responsive suite proves zero horizontal overflow on all routes
  at 320/390/430 px (realistic content, long-content variants where applicable).
- **SC-003**: Cashier tablet-landscape and kitchen-board journeys pass with
  interaction assertions at their device classes; desktop and wide checks pass
  for management/reports/platform.
- **SC-004**: Every data table has an implemented, documented narrow-width
  behavior with a same-disclosure fallback (verified for at least one
  lower-privileged role).
- **SC-005**: The Phase 15 a11y suites pass unchanged after all layout work (axe
  at mobile and tablet included), and the responsive rule set + device contracts
  are documented in `docs/conventions.md` / phase artifacts.
- **SC-006**: Any presentation-contract migration (order-sensitive locators,
  `data-*` hooks, accessible names moved by layout) is recorded in the ledger
  per the Category-A discipline — no silent weakening.

### Assumptions
- Chromium device emulation remains the E2E engine (clarified — WebKit/Firefox
  expansion is a recorded future option, not an assumption).
- The committed breakpoint token values (640 / 1024 / 1440 documented in
  `src/styles/tokens.css`) remain the breakpoint vocabulary; this phase documents
  media-query usage against them rather than redefining them.
- Tablet landscape is the cashier's primary operational posture (clarified) —
  desktop remains fully supported; cashier-on-phone is best-effort.
- Management surfaces remain desktop-primary; their mobile behavior is the
  documented fallback (not a redesigned mobile management experience).
- The existing accessible-name surface and `data-*` hooks survive layout changes
  (order-sensitive locators migrate deliberately with the suite in the same
  change, recorded in the spec/tasks).

### Key Entities (phase artifacts, not runtime data)
- **Device contract table**: per route — primary device class, secondary,
  explicitly unsupported, and the narrow-width behavior chosen for its tables.
- **Responsive rule set**: the documented conventions (breakpoint usage,
  sticky-bar pattern, table→card pattern, density rules) in `docs/conventions.md`.
- **Responsive regression suite**: the standing Playwright coverage per FR-10.
- **Migration record**: ledger entries for any presentation contract moved by
  layout work.
