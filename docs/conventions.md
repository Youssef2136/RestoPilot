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
