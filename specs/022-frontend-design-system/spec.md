# Feature Specification: Design System & Visual Language (Frontend Phase 02)

**Feature Branch**: `022-frontend-design-system`

**Created**: 2026-09-27

**Status**: Clarified

**Input**: Frontend Master Plan §8 Phase 02 — "Establish one committed visual world and one
component vocabulary before any surface is touched, so 20 phases converge on the same product
instead of 25 opinions. This is where Impeccable enters the project."

**Authorities**: RestoPilot-Frontend-Master-Plan.md §5 (Design System Strategy), §6.2 (frontend
pipeline), FA-1…FA-15; `.specify/memory/constitution.md`; existing presentation-contract ledger
(`docs/frontend-presentation-contracts.md`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — One visual world, tokenized (Priority: P1)

A developer (or agent) opening the codebase finds one committed visual world: semantic token
stylesheets (color roles, type scale, spacing, radii, elevation, borders, z-index, motion,
breakpoints, touch targets) implemented as CSS custom properties, and a written direction
contract (`DESIGN.md`) describing the built world — not a wish list. Surfaces consume tokens;
no raw color/spacing literals outside token files.

**Why this priority**: every later phase composes from these tokens; drift here multiplies
across 20 phases.

**Independent Test**: read the token files and `DESIGN.md`; grep `src` (excluding token files
and the gallery) for raw hex/px spacing literals; unit assertions on token presence and
semantic naming.

**Acceptance Scenarios**:

1. **Given** the token stylesheets, **When** inspected, **Then** every token is a semantic
   custom property (no `--red-500`-style literals at the consumption layer).
2. **Given** the production bundle, **When** built, **Then** tokens ship once (no duplication
   per component) and the dev gallery remains excluded (Phase 01 gate preserved).
3. **Given** a component stylesheet outside `src/styles/`, **When** it declares a color or
   spacing value, **Then** it references a token var — raw literals fail the detector/lint
   check (FR-07).

### User Story 2 — One component vocabulary (Priority: P1)

A developer building a surface composes shared primitives from `src/components/ui/` (Button,
Field, Input, Textarea, Select, Checkbox, RadioGroup, Dialog, Drawer, Card, Tabs, Badge/
StatusPill, Toast, Alert, Skeleton, Spinner, EmptyState, ErrorState, DataTable basics, Icon,
Stack/Grid, MoneyText, StateChip, TotalsPanel shell, SkipLink already exists) instead of
hand-styling raw HTML. Every primitive implements its full state matrix (default, hover,
focus-visible, active, disabled, loading, invalid, read-only, empty, skeleton, selected/
checked where applicable) with keyboard operability and visible focus by construction.

**Why this priority**: the primitive inventory is the vocabulary every surface phase consumes
(FA-5); shipping it late forces per-page reinvention.

**Independent Test**: unit contract tests (static-markup assertions, node environment) assert
each primitive renders its contract (roles, labels, states); the gallery renders each
primitive in each state; axe runs clean on the gallery.

**Acceptance Scenarios**:

1. **Given** a primitive, **When** rendered in each documented state, **Then** its
   accessibility contract holds (accessible name, role, focus visibility, keyboard operation).
2. **Given** a destructive action, **When** its flow needs confirmation, **Then** the confirm
   `Dialog` primitive exists (adoption in surfaces is Phase 03+; the primitive ships here).
3. **Given** money or a status, **When** rendered through `MoneyText`/`StateChip`, **Then**
   the existing formatters/state vocabulary are wrapped once — never re-implemented per page.

### User Story 3 — The gallery proves the system (Priority: P1)

A reviewer opens the DEV-only gallery route and sees every primitive in every state, grouped,
with states labeled; screenshots at required viewports are captured as evidence; axe and
console checks pass on the gallery; the gallery stays excluded from production bundles.

**Why this priority**: the gallery is the review surface for the system and the evidence
source for `DESIGN.md`; it reuses Phase 01's DEV-gate architecture unchanged.

**Independent Test**: run the design-system E2E spec (gallery smoke, axe, console floor) on
chromium + mobile/tablet viewports; grep dist for gallery strings (must be absent).

**Acceptance Scenarios**:

1. **Given** a dev server, **When** the gallery route is visited, **Then** every primitive
   section renders with labeled states and no console errors (Phase 01 console floor).
2. **Given** the gallery, **When** axe scans it, **Then** no violations are reported
   (primitives are accessible by construction).
3. **Given** a production build, **When** `dist/` is grepped for gallery-only strings,
   **Then** there are no matches (Phase 01 D3 architecture holds).

### User Story 4 — Product and design truth committed (Priority: P2)

A future agent reads `PRODUCT.md` (durable product truth: users, jobs, constraints,
non-features) and `DESIGN.md` (the committed visual world: mode, color strategy, type,
spacing, radius, elevation, motion grammar, status vocabulary) before touching any UI, plus a
surface-brief template with a direction-contract block ready for Phase 03.

**Why this priority**: these artifacts are the authority later phases read; the system can be
built without them but cannot be *governed* without them.

**Independent Test**: the files exist, follow their schema markers, and are committed; the
brief template exists and names the direction-contract blocks.

**Acceptance Scenarios**:

1. **Given** the repository, **When** `PRODUCT.md` is read, **Then** it records confirmed
   product truth (users, purpose, constraints, non-features, accessibility posture) with no
   invented claims, and open decisions are marked.
2. **Given** the built system, **When** `DESIGN.md` is written at finish, **Then** it
   describes what was built (tokens, palette roles, type, motion, status vocabulary), not an
   aspiration.
3. **Given** Phase 03 starts, **When** it needs a surface brief, **Then** a template with the
   direction-contract block exists and is referenced from `docs/conventions.md`.

## Clarifications (Q1–Q8, answered 2026-09-27)

- **Q1 Styling stack** → Confirmed per Master Plan §5.1 recommendation: CSS custom properties
  (tokens) + CSS Modules (components). No Tailwind, no UI kit, no new runtime dependency
  (FA-10). DevDependency additions allowed only with justification (e.g. icon tooling if any).
- **Q2 Dark mode (C8)** → One light theme. Semantic tokens keep the future option cheap; no
  dark palette, no `prefers-color-scheme` switching in this phase.
- **Q3 Density** → Two documented density modes via tokens: compact (staff surfaces) and
  comfortable (customer surfaces), selected per-surface in later phases; both defined now.
- **Q4 Icons** → Internal `Icon` component with an authored inline-SVG set (15–25 glyphs per
  §5.1). No icon package dependency. Glyphs drawn at one consistent stroke/weight.
- **Q5 Brand assets** → None exist. The name "RestoPilot" and a text wordmark suffice; the
  system defines brand color roles without a logo. Wordmark styling is a token consumer, not
  an asset pipeline.
- **Q6 WCAG target** → WCAG 2.1 AA: contrast ≥ 4.5:1 body text / ≥ 3:1 large text and UI
  glyphs; visible focus everywhere; touch targets ≥ 44×44 px (documented minimum); reduced
  motion honored (FR-06).
- **Q7 Fonts** → System font stack retained (product UI, Operate mode; operate.md: one family
  is often right; no webfont dependency). Type scale fixed in rem; no fluid clamps for UI.
- **Q8 Animation personality** → Product motion grammar per operate.md: 150–250 ms,
  exponential ease-out, state-conveying only (no orchestrated page-load sequences, no
  decorative loops); `prefers-reduced-motion` disables non-essential motion.

## Requirements

### Functional Requirements

- **FR-01** `PRODUCT.md` committed at repo root, following the impeccable product schema
  (platform `web`), containing only confirmed facts (users, purpose, positioning, operating
  context, capabilities/constraints, non-features, accessibility posture) and explicitly
  marked open decisions.
- **FR-02** `DESIGN.md` written **at finish** from the built world (not before), describing:
  mode (Operate), color strategy, semantic color roles, type scale, spacing scale, radii,
  elevation, borders, z-index layers, motion grammar (durations/easings/what may animate),
  status vocabulary (round/ticket/subscription/availability), breakpoints, density modes.
- **FR-03** Tokens implemented as CSS custom properties in `src/styles/` with semantic names,
  imported once from `main.tsx` (import order: reset → tokens → base). Token groups: color
  roles (surface, surface-raised, border, ink, ink-muted, brand, positive, warning, danger,
  info, focus-ring), type scale (size/weight/line-height), spacing scale, radii, shadows,
  border widths, z-index layers, motion (duration/easing), breakpoints, touch-target
  minimum, density variables (compact/comfortable).
- **FR-04** Every primitive in the Master Plan §5.3 inventory that meets the creation rule
  (foundational, required by an identified Phase 03+ surface, or clearly reused) exists in
  `src/components/ui/` with documented props/states. Creation rule is applied, not speculatively
  maximized: speculative primitives are NOT created (FA-5). Each implemented primitive carries
  a header comment naming its consumers (current or the phase that first consumes it).
- **FR-05** The DEV-only gallery (`/dev/gallery`, Phase 01 DEV-gate architecture unchanged)
  renders each primitive in default/hover/focus-visible/active/disabled/loading/error states
  plus its state matrix, grouped by primitive, with state labels; static fixtures only.
- **FR-06** Accessibility defaults built in: `:focus-visible` rings from tokens on every
  interactive primitive; `prefers-reduced-motion` honored globally; forced-colors-safe
  fallbacks (system colors degrade gracefully); contrast verified per token pair used for
  text/interactions (recorded per pair in the phase validation notes).
- **FR-07** Drift rules enforced: no raw color literals, no magic spacing, no bespoke
  animations outside token files and the gallery — checked by a unit test (literal scan of
  component CSS) plus `impeccable detect` on changed files.
- **FR-08** Surface-brief template with direction-contract block (six blocks: THESIS,
  OWN-WORLD, STORY, FIRST VIEWPORT, FORM, FINISH) recorded for Phase 03's first surface;
  referenced from `docs/conventions.md`.
- **FR-09** Component contract tests: static-markup assertions (node environment,
  `renderToStaticMarkup` per repo method) for each primitive's accessibility contract
  (roles, labels, disabled/loading semantics, live-region usage).
- **FR-10** Domain-shared primitives defined once: `MoneyText` wraps existing formatters
  (`features/menu/money.ts`, `features/tax/taxMoney.ts`); `StateChip` maps the status
  vocabulary to one palette; `TotalsPanel` shell renders tax lines as data (no tax math).
- **FR-11** `docs/conventions.md` documents how to consume the system (imports, tokens,
  primitive usage) and how to amend it (the explicit amendment path from FA-5/F-G10).

### Presentation-Contract Constraints (from the ledger — must not regress)

- Primitives must not break: label associations (73), `role="alert"`/`role="status"` live
  regions, two-step confirm button behavior, `data-*` hooks, frozen localStorage keys. The
  gallery introduces none of these; primitives are new leaves with no existing E2E surface,
  so the risk is in *adoption*, which is not this phase.
- Money rendering keeps existing formatters; `MoneyText` wraps.
- The gallery route stays DEV-only with zero build-mode logic in `routes.ts` (Phase 01 D3).

### Edge Cases

- A primitive used before a surface adopts it: allowed (gallery is the consumer of record).
- Token collision with Phase 01 neutrals: Phase 01's literals (`#1f2328`, `#f6f7f9`,
  `#ffffff`) are absorbed INTO tokens (ink, surface, etc.) — base.css stops carrying raw
  values; no third value set is introduced.
- Reduced-motion users: every transition defined in the motion grammar has a reduced-motion
  neutralization (instant or opacity-only).
- Forced-colors environments: primitives degrade to system colors without losing semantics
  (borders/labels/focus remain distinguishable).

## Review & Acceptance Checklist

Gate checks sourced from `specs/022-frontend-design-system/checklists/requirements.md`.

## Dependencies

- Phase 01 deliverables: styles pipeline (`src/styles/` + import order), DEV-gated gallery
  route + registry architecture, a11y (axe) / console / viewport E2E tooling, contract ledger.
- User clarifications Q1–Q8 (above).
- Impeccable: context loaded; `init` completed (PRODUCT.md); `shape` direction resolved via
  new-work.md (code-led — no image generation in this environment); `detect` available as the
  mechanical audit; `critique`/`audit`/`polish` unavailable in launcher 0.1.6 (documented
  deviation, Phase 01 F8).

## Out of Scope

- No surface redesign (Phases 03+); existing pages/components are NOT restyled in this phase
  (except base.css literal absorption, which changes values not behavior).
- No route/nav changes; no copy rewrite; no backend/database touch; no new runtime deps.
- No dark theme (C8 resolved: one light theme), no i18n, no theming API.
- Feature-owned components (`RoundCard`, `TicketCard`, `BillPanel`, …) stay untouched.
