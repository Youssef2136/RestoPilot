# RestoPilot — Project Conventions

Where code goes and how features are built. These conventions are the single
source for placement decisions — when this document and habit disagree, this
document wins (spec FR-002/FR-003).

## Folder layout

```text
/
├── src/
│   ├── app/          # application composition: providers, root layout, router
│   ├── components/   # shared UI components (used across features)
│   ├── features/     # feature modules (one folder per feature, from Phase 3 on)
│   ├── hooks/        # shared hooks
│   ├── lib/          # infrastructure clients and helpers (Supabase, env)
│   ├── routes/       # route-level page components
│   ├── styles/       # global styles pipeline: reset.css → base.css → (Phase 02 tokens) — imported once in main.tsx
│   └── types/        # generated database types + shared app types
├── supabase/
│   ├── migrations/   # version-controlled schema migrations (the only schema source)
│   ├── seed.sql      # development seed data (applied by npm run db:seed)
│   └── config.toml   # Supabase CLI project configuration
├── scripts/db/       # database helper scripts (seed, reset)
├── tests/
│   ├── unit/         # unit tests (Vitest)
│   ├── database/     # database-level tests (Vitest + pg, cloud dev database)
│   └── integration/  # integration tests (used from Phase 1 on)
├── e2e/              # end-to-end tests (Playwright)
├── docs/             # development guide, conventions (this file)
├── specs/            # Spec Kit feature directories (spec, plan, tasks, checklists)
└── .specify/         # Spec Kit configuration and the project constitution
```

### Placement rules

- A new **shared component** → `src/components/`
- A new **feature-specific module** → `src/features/<feature>/` (create it when
  the feature starts; keep shared pieces out until a second feature needs them)
- A new **route page** → `src/routes/` and register it in `src/app/router.tsx`
- A new **database change** → a migration in `supabase/migrations/` via the
  canonical workflow (see [development.md](./development.md) → Data-layer
  workflow) — never a dashboard edit
- A new **test** → `tests/unit/`, `tests/database/`, `tests/integration/`, or
  `e2e/` matching its level
- **Generated files** (`src/types/database.types.ts`) are committed but never
  hand-edited — regenerate with `npm run types:gen`

### Route metadata (spec 021 FR-02)

Every registered route's document title and meta description come from the
registry in `src/app/routes.ts`, applied centrally by `src/app/RouteTitles.tsx`
on navigation. **Pages never set `document.title` themselves.** Adding a route
means adding its registry entry in the same change —
`tests/unit/routeRegistry.test.ts` fails otherwise.

### Error, not-found, and the styles pipeline (spec 021)

- The top-level `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) wraps the
  router; its recovery view offers plain-anchor routes back and never renders
  the error message. Unknown paths render `NotFoundView` (a dedicated 404 —
  never a silent redirect).
- `src/styles/` is the only home for global CSS: `reset.css` → `tokens.css` →
  `base.css` → `index.css`, imported exactly once in `src/main.tsx` (order
  asserted by `tests/unit/stylesPipeline.test.ts`). Component styles stay in
  CSS Modules beside their component.

### The design system (spec 022)

The visual world is ONE system, consumed — never reinvented per surface
(Master Plan FA-5).

- **Tokens** (`src/styles/tokens.css`) are the ONLY raw color/spacing/motion
  home. They are semantic roles (`--color-danger`, not `--red-500`). Surfaces
  never write hex values, magic spacing, or bespoke animations —
  `tests/unit/design.literals.test.ts` fails the build on raw values outside
  the token file (the two justified incumbent exemptions expire with Phase 03).
- **Primitives** live in `src/components/ui/` and are imported from the
  barrel (`import { Button } from '../components/ui'`) — never from deep
  paths. Each implements its full state matrix (default/hover/focus-visible/
  active/disabled/loading/invalid/read-only) with a11y wired by construction:
  `Field` associates labels and announces errors (`role="alert"`); `Dialog`
  and `Drawer` manage focus; `Toast`/`Spinner` announce politely. Contracts
  are pinned by `tests/unit/ui/*` and axed floor by `e2e/design.system.test.ts`.
- **Money and status render once**: `MoneyText` wraps the exact formatters
  (`features/menu/money.ts`, `features/tax/taxMoney.ts`); `StateChip` maps
  every domain status to the palette; `TotalsPanel` renders totals lines as
  data (all math stays server-side, FA-1).
- **The dev gallery** (`/dev/gallery`, DEV-only) renders every primitive in
  every state — review new work against it; screenshot evidence comes from
  it. It is excluded from production bundles (spec 021 D3).
- **Density**: staff data surfaces opt in with `data-density="compact"` on a
  surface root; customer surfaces stay comfortable (the default).
- **Accessibility** (spec 035): the floor is a verified property — the axe
  matrix (`e2e/a11y.matrix.test.ts`) scans every registered route in its
  authorized state, the critical journeys are keyboard-complete with focus
  assertions (`e2e/keyboard.journeys.test.ts`), and the keyboard maps + the
  full proof index live in [accessibility.md](./accessibility.md). New
  surfaces keep every keyboard-map row true (adding rows for their own
  actions, with a proving spec); new axe findings are fixed (serious-plus)
  or recorded with a reason and an owner in `specs/035-accessibility-hardening/audit/exceptions.md` —
  never silently waived. Phases 16–20 re-run the matrix after layout work.

#### Amending the design system

A missing primitive or token is an explicit system amendment, never a local
one-off (FA-5, gate F-G10). The amendment path: (1) identify the reuse case
(two+ surfaces, or a named Phase 03+ consumer), (2) amend the system in the
surface phase's spec explicitly, (3) add the primitive/token once in
`src/components/ui/` / `tokens.css` with its states and gallery entry, (4)
update `DESIGN.md` and this section, (5) reuse it rather than creating a
local duplicate.

#### Surface briefs (spec 022 FR-08)

Every surface phase (03+) starts from the brief template
[templates/surface-brief.md](../templates/surface-brief.md) — copy it into
`specs/<feature>/` and fill all six direction-contract blocks before
implementation. Later edits of the surface re-read the brief first.

### Presentation contracts (spec 021 FR-10)

Before touching markup, read
[frontend-presentation-contracts.md](./frontend-presentation-contracts.md) —
the ledger of every E2E-asserted accessible name, `data-*` hook, `data-testid`,
and the frozen localStorage keys, with each category's change discipline
(preserve, or migrate deliberately in the same commit with the paired test
update). After a UI change: re-run the ledger's regeneration recipes and diff.

### Responsive rules (spec 036)

Layouts adapt to device classes, not to hunches. The rules every surface
follows (the full per-route contract lives in
[specs/036-responsive-and-device-hardening/device-contracts.md](../specs/036-responsive-and-device-hardening/device-contracts.md)):

- **Breakpoints come from the token scale only**: the CSS `@media` queries cite
  `640px` / `1024px` / `1440px` LITERALLY (custom properties cannot feed a media
  query — the values are documented in `tokens.css` comments). No new magic
  numbers: a width off the scale is an explicit amendment, not a local value.
- **No horizontal overflow at 320–430 px**: every flex/grid ancestor chain that
  hosts content that may exceed the row gives its track `minmax(0, 1fr)` so
  `overflow-x: auto` children actually scroll in place instead of stretching
  the page. Horizontal-flowing content that MUST go side-to-side (the section
  and category pill navs) lives inside a real `overflow-x: auto` container.
- **Primary actions stay anchored on mobile**: the customer cart uses the 025
  sticky bottom sheet (internal scroll, one-thumb reach). Reuse that pattern;
  do not mint a second sticky-bar primitive for one consumer.
- **Tables get a defined narrow behavior**: plain data tables fall back to
  labeled rows — new tables use `DataTable`'s `cardBreakpoint` (the card renders
  EXACTLY the fields the table shows — one disclosure); production tables ride
  the committed `cardTable`/`data-label` patterns (reports, staff list).
  Reports tables use the documented horizontal scroll region instead
  (device-contracts.md names the choice per table).
- **Tablet landscape (1112×834) is a first-class layout**: dialogs must fit the
  rotated viewport (the 023 dialog primitive centers within the viewport —
  verify, never assume); boards keep compact density in landscape rather than
  collapsing to the phone layout.
- **Rotation preserves state**: an in-flight form keeps its inputs, scroll
  position survives, and at most ONE live region exists on a page across a
  rotation cycle (the 032 policy).
- **Proof, not vibes**: a responsive change ships with an E2E leg at the
  boundary it claims to honor (`e2e/responsive.overflow.test.ts` is the
  standing sweep — extend it for new routes).

### Naming conventions

- React components in `PascalCase.tsx`; hooks in `camelCase` prefixed `use`
- CSS Modules beside their component (`ComponentName.module.css`)
- Migrations: `<timestamp>_<snake_case_name>.sql` (name comes from
  `supabase migration new <name>`)

## Feature workflow (Spec Kit)

Every substantial feature follows the Spec Kit gate sequence:

```text
$speckit-specify    → specs/NNN-feature-name/spec.md
$speckit-clarify    → resolve ambiguities, encode answers in the spec
$speckit-plan       → plan.md, research.md, data-model.md, quickstart.md
$speckit-checklist  → reviewer-owned requirements-quality checklist
$speckit-tasks      → tasks.md (dependency-ordered, checkbox-tracked)
$speckit-analyze    → cross-artifact consistency check
$speckit-implement  → execute tasks.md phase by phase
$speckit-converge   → verify the code matches spec, plan, tasks, constitution
```

Rules:

- One feature per `specs/NNN-feature-name/` directory (`NNN` sequential,
  matching the master plan §10 decomposition).
- The specification is the source of business truth — implementation questions
  are resolved through the spec, not by ad-hoc code decisions (Constitution
  Principle II).
- The [constitution](../.specify/memory/constitution.md) outranks every other
  artifact; conflicts must be resolved by revising the lower artifact or
  amending the constitution.
- Commit after each task or logical group; keep feature work on its branch
  until the phase gate passes.
