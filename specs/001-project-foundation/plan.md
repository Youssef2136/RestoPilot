# Implementation Plan: Project Foundation (Phase 0)

**Branch**: `001-project-foundation` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-project-foundation/spec.md`, including the clarifications of 2026-09-15 — in particular the owner directive that the backend environment is **Supabase Cloud**: no local Supabase/PostgreSQL workflow, and the Supabase CLI is used only for source-controlled migrations, database type generation, and deployment/synchronization against the configured cloud project.

## Summary

Establish the reproducible technical baseline for RestoPilot before any business feature is built (spec Story 1–5): a React + TypeScript + Vite frontend application with a routing shell covering the three application experiences (customer ordering, staff dashboard, super admin), connected to a **configured Supabase Cloud project** (PostgreSQL, Auth, Realtime, Storage, Edge Functions where needed). Schema changes are managed as version-controlled migrations applied to the cloud development database via the Supabase CLI, with a scripted seed and reset/rebuild workflow, generated database types, and a complete local quality pipeline (format check, lint, type check, unit/database/e2e tests, production build). Onboarding, conventions, and the acceptance gate are documented so a clean-machine developer can reach a fully running environment using only the repository.

No business-domain features, business schema, RBAC, ordering, menu, sessions, kitchen, reports, or subscriptions are included (spec Out of Scope).

## Technical Context

**Language/Version**: TypeScript (current stable) on Node.js 22 LTS or newer, pinned via `engines` in `package.json` and `.nvmrc`.

**Primary Dependencies**: React (current stable), React Router (library mode), TanStack Query, Supabase JS v2, Vite (dev/build), ESLint 9 (flat config) with typescript-eslint, Prettier. Exact versions are pinned in `package.json` during implementation; no additional runtime dependencies are introduced in Phase 0.

**Storage**: Supabase Cloud PostgreSQL on the configured cloud development project. **No local database.** The Supabase CLI (`login`, `link`, `migration new`, `db push`, `gen types`) is the only backend tooling. Supabase Storage and Edge Functions are not used in Phase 0 beyond being available on the project.

**Testing**: Vitest (unit), Vitest + `pg` against the cloud development database (database-level), Playwright (end-to-end, with the dev server auto-started by Playwright's `webServer` config).

**Target Platform**: Evergreen browsers for the web app; development on Windows (primary), macOS and Linux supported.

**Project Type**: Web application (single-page app).

**Performance Goals**: Engineering guidance for developer experience, not spec gates: `verify` pipeline (format check + lint + type check + unit tests + database tests + production build) completes in under 5 minutes on a typical machine; the e2e suite in under 3 minutes; dev server starts in under 10 seconds.

**Constraints**: No local Supabase/PostgreSQL and no `supabase start` (owner directive); no hosted CI in Phase 0 (spec Out of Scope); no service-role or privileged credentials in frontend code or version control; the anon key is used only as the public client credential (Supabase security model); one configured cloud development project shared by developers.

**Scale/Scope**: One development team, one cloud development project, a small codebase (shell, tooling, example tests, docs).

All technical unknowns listed above were resolved through the research phase — see [research.md](./research.md) for decisions, rationale, and rejected alternatives.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Business Scope Integrity | **PASS** | Foundation only. The single baseline table is non-business infrastructure (pipeline proof), not domain schema. No payments, accounting, printing, or inventory. |
| II | Specifications Are the Source of Business Truth | **PASS** | Plan implements the updated spec (cloud directive encoded in Clarifications 2026-09-15). No business rules invented; every work item traces to an FR. |
| III | Multi-Tenant Isolation | **N/A / SAFE DEFAULT** | No tenant data exists in Phase 0. The baseline table is created with RLS enabled and no policies (deny-by-default), planting the Phase 1 pattern. |
| IV | Server-Enforced Authorization | **N/A** | No protected operations exist in Phase 0; no frontend-only authorization is introduced. |
| V | Database as the Source of Truth | **PASS** | Supabase Cloud PostgreSQL is the single authoritative backend. The frontend holds no business state; env-driven config only. |
| VI | Explicit State and Data Integrity | **N/A** | No business state machines in Phase 0. Migrations run transactionally; reset/rebuild is deterministic. |
| VII | Auditability of Sensitive Operations | **N/A** | No sensitive operations in Phase 0. |
| VIII | Minimal and Intentional Complexity | **PASS** | No CI, no containers, no local Supabase stack, one minimal baseline table, a deliberately small dependency list. Every addition maps to a spec FR (see Complexity Tracking — no violations to justify). |

## Project Structure

### Documentation (this feature)

```text
specs/001-project-foundation/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output ($speckit-plan command)
├── data-model.md        # Phase 1 output ($speckit-plan command)
├── quickstart.md        # Phase 1 output ($speckit-plan command)
├── checklists/          # Spec quality checklist ($speckit-checklist inputs)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

Contracts: intentionally skipped — Phase 0 exposes no external interfaces (no APIs, no business operations). The master plan's contract strategy (§34) applies to high-risk business operations in later phases. Developer-facing command and environment-variable surfaces are documented in [quickstart.md](./quickstart.md) and `docs/development.md`.

### Source Code (repository root)

```text
/
├── .specify/                     # Spec Kit configuration and memory (constitution, feature.json)
├── specs/                        # Feature specifications (001-project-foundation, ...)
├── src/
│   ├── app/                      # App composition: providers, root layout, router
│   ├── components/               # Shared UI components (app shell only in Phase 0)
│   ├── features/                 # Feature modules (empty in Phase 0 — reserved by convention)
│   ├── lib/                      # Supabase client, environment validation
│   ├── hooks/                    # Shared hooks (empty in Phase 0 — reserved by convention)
│   ├── routes/                   # Route placeholder views for the three experiences
│   └── types/                    # Generated database types (database.types.ts) + app types
├── supabase/
│   ├── migrations/               # Version-controlled migrations (applied via supabase db push)
│   ├── seed.sql                  # Seed data for the cloud development database
│   └── config.toml               # Supabase CLI project configuration (from supabase init)
├── scripts/
│   └── db/                       # db:seed and db:reset Node scripts (SQL against the cloud DB)
├── tests/
│   ├── unit/                     # Unit tests (Vitest)
│   ├── database/                 # Database-level tests (Vitest + pg)
│   └── integration/              # Reserved (empty in Phase 0 — used from Phase 1 on)
├── e2e/                          # Playwright end-to-end tests
├── docs/
│   ├── development.md            # Onboarding, daily workflow, troubleshooting (FR-005)
│   └── conventions.md            # Folder + feature workflow conventions (FR-002, FR-003)
├── .env.example                  # Environment variable template (FR-006)
├── .gitignore                    # Ignores .env*, node_modules, dist, test artifacts
├── .nvmrc                        # Node version pin
├── package.json                  # Scripts and pinned dependencies
└── README.md                     # Entry point: what this is + link into docs/development.md
```

**Structure Decision**: Single web application repository following the master plan's recommended organization (§46), refined with `scripts/` for the cloud database helper scripts and `docs/` for the onboarding and conventions documents. Test directories mirror the master plan's levels (`tests/unit`, `tests/database`, `tests/integration`, `e2e/`). Empty convention-reserved directories (`src/features`, `src/hooks`, `tests/integration`) are created with `.gitkeep` so later features land in the agreed layout without restructuring.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None. No Constitution violations were identified; no complexity requires justification.
