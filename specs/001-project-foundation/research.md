# Research: Project Foundation (Phase 0)

**Feature**: 001-project-foundation | **Date**: 2026-09-15

Decisions resolving every technical unknown from the plan's Technical Context.
Each entry records the decision, rationale, and alternatives considered.

---

## 1. Backend environment: Supabase Cloud

**Decision**: All backend services run on a configured Supabase Cloud project
(PostgreSQL, Auth, Realtime, Storage, Edge Functions where needed). No local
Supabase/PostgreSQL instance and no `supabase start` anywhere in the workflow.

**Rationale**: Owner directive (spec Clarifications, 2026-09-15). It removes
Docker as an onboarding prerequisite and keeps the development database
identical in kind to production. The spec's acceptance gate operates against
the cloud project.

**Alternatives considered**:
- Local Supabase via `supabase start` (master plan §29 default) — rejected by
  the owner directive; also requires Docker on every machine, including
  Windows, which adds onboarding friction.
- Hybrid (local optional, cloud required) — rejected: two environments double
  the support surface and violate the "one canonical workflow" rule (FR-010).

## 2. Migration workflow against the cloud project

**Decision**: `supabase init` (once) creates `supabase/` with `config.toml`;
`supabase login` + `supabase link --project-ref <ref>` bind the repository to
the cloud project. Schema changes are created with
`supabase migration new <name>` and applied with `supabase db push`
(`--dry-run` first when reviewing). Migration state is tracked in the
`supabase_migrations.schema_migrations` table on the cloud database.

**Rationale**: Source-controlled migrations with CLI-tracked history are the
master plan's mandated workflow (§29 "Do not let individual agents invent a
second migration workflow"), retargeted to the cloud project per the owner
directive.

**Alternatives considered**:
- Dashboard SQL editor changes — rejected: not reviewable or reproducible.
- Raw SQL files applied by a custom script — rejected: reinvents migration
  history tracking that the CLI already provides.

## 3. Seed strategy for the cloud development database

**Decision**: `supabase/seed.sql` is the seed source. A Node script
(`scripts/db/seed.mjs`, using `pg`) applies it to the cloud development
database over the `SUPABASE_DB_URL` connection string, exposed as
`npm run db:seed`. Seed is idempotent (`insert ... on conflict do nothing`).

**Rationale**: `supabase db reset` (the local seed mechanism) does not exist
for cloud projects, so seeding must be scripted against the cloud connection
string. A committed SQL file plus a thin documented script is reproducible,
reviewable, and Windows-friendly.

**Alternatives considered**:
- Seed as a regular migration — rejected: pollutes migration history and would
  run in every environment including future production.
- Manual seed via dashboard — rejected: violates SC-002 (every step must be a
  documented, repeatable command).

## 4. Reset/rebuild workflow for the cloud development database

**Decision**: `npm run db:reset` runs `scripts/db/reset.mjs`, which: (1) drops
the `public` and `supabase_migrations` schemas and recreates `public` with
Supabase's default grants, (2) runs `supabase db push` to reapply all
migrations from zero, (3) runs the seed script. The script requires explicit
confirmation and reads only `SUPABASE_DB_URL`, so it can only target the
project the developer configured.

**Rationale**: FR-007 requires the cloud development database to be resettable
to zero and rebuilt entirely from repository artifacts. Dropping the migration
history alongside the schema makes `db push` reapply every migration, giving a
deterministic rebuild (SC-003). Supabase's dashboard reset is manual and not
scripted; project recreation is far too heavy.

**Alternatives considered**:
- Dashboard "Reset database" + manual re-run — rejected: manual steps violate
  the deterministic-rebuild criterion.
- Deleting and recreating the cloud project — rejected: minutes of downtime,
  new credentials, unacceptable for a shared development project.

## 5. Database type generation

**Decision**: `npm run types:gen` runs
`supabase gen types typescript --linked --schema public` and writes the output
to `src/types/database.types.ts`, which is committed. Regeneration after a
full reset/rebuild produces an identical file.

**Rationale**: FR-009 requires a documented, reproducible generation step.
Generating from the linked cloud project reflects the actual authoritative
schema; committing the file keeps type errors visible in review and lets CI
(if added later) diff drift.

**Alternatives considered**:
- Hand-written types — rejected: drifts from schema immediately.
- Generating from local `supabase gen types --local` — rejected: no local
  instance in this workflow.

## 6. Baseline schema: one non-business table

**Decision**: A single migration creates `public.app_meta` (see
[data-model.md](./data-model.md)) — key/value/updated_at — with **row level
security enabled and no policies** (deny-by-default), plus one seed row.
It exists solely to prove the migration → seed → type-generation →
database-test pipeline (FR-007, FR-008, FR-009, FR-013).

**Rationale**: The pipeline cannot be demonstrated without at least one
table. `app_meta` is deliberately non-business so it does not leak Phase 1
domain design. Enabling RLS with no policies costs one line, denies anonymous
API access to the table (it would otherwise be fully readable/writable with
the public anon key), and plants the security-by-default pattern Phase 1
formalizes (Constitution Principles III/IV posture).

**Alternatives considered**:
- Zero tables (prove migrations with an empty migration) — rejected: seed
  strategy and database tests would have nothing to verify; type generation
  would emit an empty file.
- A business-flavored table (e.g., `restaurants`) — rejected: business schema
  belongs to Phase 1 (spec Out of Scope; Constitution II).

## 7. Frontend stack

**Decision**: React + TypeScript + Vite, bootstrapped from the official
`react-ts` Vite template, extended with React Router (library mode), TanStack
Query (provider wired in the app shell), and Supabase JS v2 (client in
`src/lib/`, fail-fast on missing env vars).

**Rationale**: Fixed by the master plan (§4.2). The Vite template is the most
boring, best-maintained starting point and already includes a sensible
TS/ESLint baseline. Wiring the Query and Supabase providers in the shell is
trivial, approved-stack plumbing that makes the shell ready for feature work
(Story 4) without touching root composition later.

**Alternatives considered**:
- Next.js or another meta-framework — rejected: not the approved direction;
  the app is an SPA talking to Supabase.
- Deferring provider wiring to the first feature — rejected: restructuring the
  root for every new provider is churn with no savings.

## 8. Routing shell

**Decision**: React Router with a root layout and the master plan's baseline
routes (§38): `/` (shell landing), `/r/:restaurantSlug` (public restaurant),
`/order/:branchId` (ordering), `/dashboard` (staff), `/admin` (super admin).
Each renders a distinct placeholder view; no guards, no business UI.

**Rationale**: FR-011/FR-012. The URL structure is user-facing (customers land
on `/r/:restaurantSlug` from the restaurant QR), so fixing it now prevents
restructuring. No auth guards exist yet — that is Phase 2 (spec Out of Scope).

**Alternatives considered**:
- Flat placeholder routes with arbitrary names — rejected: violates FR-012.

## 9. Styling approach

**Decision**: Plain CSS with CSS Modules for component styles plus one global
stylesheet. No UI component library, no CSS framework in Phase 0.

**Rationale**: The master plan (§4.2) explicitly leaves the CSS/component
system to "the first technical plan"; the minimal-complexity reading of that
is: don't pick a component library before any real UI exists (Constitution
VIII). Placeholder views need almost no styling.

**Alternatives considered**:
- Tailwind / MUI / shadcn now — rejected: premature; UI requirements arrive in
  Phase 3+.

## 10. Package manager and Node version

**Decision**: npm (ships with Node — zero extra onboarding step), Node.js 22
LTS or newer pinned via `.nvmrc` and `package.json` `engines`.

**Rationale**: FR-005 minimizes prerequisites; npm is the only package manager
guaranteed present the moment Node is installed. LTS pinning keeps every
developer on the same runtime.

**Alternatives considered**:
- pnpm — faster and stricter, but an extra global install on every clean
  machine for marginal benefit at this project size; revisit if workspace
  packaging is ever introduced.

## 11. Lint, format, type check

**Decision**: ESLint 9 flat config with `@eslint/js`, `typescript-eslint`,
`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`; Prettier for
formatting; `tsc --noEmit` for type checking. Scripts: `lint`, `format`,
`format:check`, `typecheck`.

**Rationale**: The standard, boring, well-documented setup for this stack;
matches the Vite template's defaults so upgrades stay routine. FR-014/FR-015.

**Alternatives considered**:
- Biome (single tool) — attractive, but a second ecosystem to justify;
  typescript-eslint remains the reference path.

## 12. Test tooling

**Decision**:
- **Unit**: Vitest, in `tests/unit/`, with one real example (environment
  validation logic).
- **Database-level**: Vitest suite in `tests/database/` using `pg` against the
  cloud development database via `SUPABASE_DB_URL`. The example test asserts
  (a) `app_meta` exists with the expected shape, (b) the seed row is present,
  (c) RLS is enabled on the table. Tests must be read-only or self-cleaning.
- **E2E**: Playwright in `e2e/`, with the dev server auto-started via
  Playwright's `webServer` config. The example test walks the five baseline
  routes and asserts each placeholder renders.

**Rationale**: Master plan §40 names all three levels and requires testing as
part of each feature; FR-013 requires one passing example per level. The
database test doubles as the onboarding connectivity check (Story 1,
"connectivity verified"). RLS assertion seeds the invariant-testing habit
(§41 priority order: security first) at zero extra cost.

**Alternatives considered**:
- pgTAP for database tests — a real option later for exhaustive policy suites;
  overkill for one Phase 0 example; Vitest keeps a single test runner.
- Vitest browser mode instead of Playwright — rejected: Playwright is the
  master plan's named e2e tool.
- Testing against a dedicated second cloud project — deferred deliberately:
  Phase 0's tests are read-only against the dev project; Phase 1 (RLS/tenant
  isolation tests) must revisit isolation (dedicated test project or schema
  isolation). Recorded as a follow-up, not Phase 0 scope.

## 13. Quality pipeline composition

**Decision**: `npm run verify` chains `format:check` → `lint` → `typecheck` →
`test:unit` → `test:db` → `build` and fails fast with non-zero exit codes.
`npm run test:e2e` is a separate documented command (it launches browsers and
its own server). Both are part of the acceptance gate's "run tests" step.

**Rationale**: FR-015 requires the full pipeline runnable from a clean
checkout via documented commands. E2E stays separate because it is slower,
browser-dependent, and Playwright already manages its server lifecycle.
Hosted CI is out of scope (spec Out of Scope; clarified 2026-09-15).

**Alternatives considered**:
- One mega-script including e2e — rejected: would make the fast feedback loop
  (lint/type/unit) pay the e2e cost on every run.

## 14. Environment variable strategy

**Decision**: `.env.example` (committed) documents four variables:
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public frontend credentials,
safe to embed per the Supabase model), `SUPABASE_DB_URL` (secret — direct
Postgres connection string, used only by scripts and database tests), and
`SUPABASE_PROJECT_REF` (CLI convenience). `.env*` is gitignored. The Supabase
client module and db scripts fail fast with a message naming the missing
variable (FR-016). No service-role key is used anywhere in Phase 0.

**Rationale**: FR-006 and Constitution Principle V/§5.5: the naming convention
(`VITE_` prefix = bundled into the client) makes the secret boundary
mechanically visible; fail-fast validation prevents silent misconfiguration.

**Alternatives considered**:
- Storing the DB URL only in CLI config — rejected: database tests and seed
  scripts need it too; a single documented env contract is simpler.

## 15. Repository hosting and initialization

**Decision**: `git init` on `main`, `.gitignore` covering `node_modules`,
`.env*`, `dist`, coverage and Playwright artifacts; create a **private GitHub
repository** and push. Feature branches follow the `NNN-feature-name`
convention matching `specs/` directories.

**Rationale**: FR-001 (GitHub hosting clarified 2026-09-15). Private by
default because the project contains no reason to be public.

**Alternatives considered**:
- Public repository — rejected by default; can be flipped later at no cost.

## 16. Documentation set

**Decision**: `README.md` (what the project is + pointer to onboarding),
`docs/development.md` (prerequisites with versions, acceptance-gate sequence,
daily commands, reset workflow, troubleshooting incl. cloud-connectivity edge
cases), `docs/conventions.md` (folder layout, where code goes, the Spec Kit
feature workflow from the master plan §43).

**Rationale**: FR-002, FR-003, FR-005; the master plan's agent-risk
mitigations (§47 Risks 8–9) depend on single-source written conventions.

**Alternatives considered**:
- Everything in README — rejected: becomes unusably long; README stays an
  entry point.

---

## Follow-up notes (not Phase 0 scope)

- Phase 1 must decide the database-test isolation strategy (dedicated test
  project vs. schema isolation) when RLS/tenant-isolation tests arrive.
- The master plan §29/§11 "start Supabase" local-development wording is
  superseded by the owner's Supabase Cloud directive; the master plan should
  be annotated accordingly at the owner's convenience (out of scope here).
