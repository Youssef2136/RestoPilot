---

description: "Task list for feature 001-project-foundation (Phase 0)"
---

# Tasks: Project Foundation (Phase 0)

**Input**: Design documents from `/specs/001-project-foundation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md (contracts/ intentionally skipped — see plan.md)

**Tests**: Test tasks ARE included — the spec explicitly requires them (FR-013: test tooling with at least one passing example per level; the acceptance gate includes "run tests"). They are deliverables of this phase, not TDD-gated feature tests.

**Organization**: Tasks are grouped by user story (spec.md US1–US5) so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

## Path Conventions

Single project at repository root: `src/`, `tests/`, `e2e/`, `supabase/`, `scripts/db/`, `docs/` — per plan.md Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize the git repository on `main` with `.gitignore` at repository root covering `node_modules/`, `.env*`, `dist/`, `coverage/`, `test-results/`, `playwright-report/`, and Supabase CLI workflow state (`.supabase/`) — FR-001
- [ ] T002 Scaffold the frontend at repository root from the official Vite `react-ts` template (package.json, vite.config.ts, tsconfig.json, index.html, src/main.tsx, src/App.tsx) per research.md §7
- [ ] T003 [P] Pin the runtime: `.nvmrc` containing `22` and `engines.node` `>=22` in package.json per research.md §10
- [ ] T004 Initialize the Supabase CLI project with `supabase init`, creating `supabase/config.toml` — do NOT start any local stack; the backend is the configured Supabase Cloud project only (spec Clarifications 2026-09-15), per research.md §2
- [ ] T005 [P] Install runtime dependencies in package.json: `react-router`, `@tanstack/react-query`, `@supabase/supabase-js` per research.md §7
- [ ] T006 [P] Install dev dependencies in package.json: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `prettier`, `vitest`, `@playwright/test`, `pg` per research.md §11–12
- [ ] T007 Create the directory skeleton per plan.md Project Structure with `.gitkeep` in reserved dirs: `src/app/`, `src/components/`, `src/features/`, `src/hooks/`, `src/lib/`, `src/routes/`, `src/types/`, `supabase/migrations/`, `scripts/db/`, `tests/unit/`, `tests/database/`, `tests/integration/`, `e2e/`, `docs/`
- [ ] T008 Create the **private** GitHub repository and push `main` (after committing T001–T007) — FR-001; GitHub hosting per spec Clarifications 2026-09-15

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuration and data artifacts that every user story depends on

**⛔ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Create `.env.example` at repository root documenting exactly four variables — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF` — with comments marking `VITE_` values as public client credentials and `SUPABASE_DB_URL` as secret (never committed, scripts/tests only) — FR-006, research.md §14
- [ ] T010 [P] Create `src/lib/env.ts`: typed environment reader that fails fast with a message naming each missing variable (no silent defaults) — FR-016
- [ ] T011 [P] Create `src/lib/supabase.ts`: Supabase JS v2 client built from `src/lib/env.ts`, throwing a clear configuration error naming the missing values — FR-016, research.md §7
- [ ] T012 Create the baseline migration `supabase/migrations/<timestamp>_app_meta.sql` via `supabase migration new app_meta` containing exactly, per data-model.md (constraints verbatim): create table `public.app_meta` with `key` **text, primary key, not null**, `value` **text, not null**, `updated_at` **timestamptz, not null, default now()**; then `alter table public.app_meta enable row level security` with **no policies** (deny-by-default). This table is non-business pipeline infrastructure and must never hold business data — FR-007/FR-013, research.md §6
- [ ] T013 Create `supabase/seed.sql` with the idempotent baseline seed row per data-model.md: `insert into public.app_meta (key, value) values ('foundation', 'seeded') on conflict (key) do nothing;` — FR-008

**Checkpoint**: Environment contract, Supabase client, and the baseline migration + seed exist — user story implementation can begin

---

## Phase 3: User Story 1 — Clean-Environment Onboarding (Priority: P1) 🎯 MVP

**Goal**: A developer on a clean machine reaches a running environment (deps installed, cloud connectivity verified, migrations applied, seed loaded, frontend running) using only the repository's documentation.

**Independent Test**: On a clean environment (fresh machine/VM/fresh user account), follow only `docs/development.md` through "start frontend" and record pass/fail per step and elapsed time (spec Independent Test; manual verification per spec Clarifications).

### Implementation for User Story 1

- [ ] T014 [US1] Create `scripts/db/seed.mjs`: Node script using `pg` that connects via `SUPABASE_DB_URL`, executes `supabase/seed.sql`, prints a success summary, and exits non-zero with a clear message on connection or SQL failure; wire as `npm run db:seed` in package.json — FR-008, research.md §3
- [ ] T015 [US1] Add `npm run db:migrate` to package.json wrapping `supabase db push` (applies unapplied migrations to the linked cloud development database) — FR-007 apply path, research.md §2
- [ ] T016 [US1] Write `docs/development.md`: prerequisites with versions (Node 22 LTS+, bundled npm, Git, Supabase CLI, access to the configured Supabase Cloud project and where to find its URL / anon key / project ref / database connection string); the **complete** acceptance-gate sequence (clone from GitHub → `npm install` → `supabase login` → `supabase link --project-ref` → copy `.env.example` to `.env` and fill values → `npm run db:migrate` → `npm run db:seed` → `npm run dev` → run tests: `npm run verify` then `npm run test:e2e` — these commands are delivered by US3 and the full gate is validated at T041); the daily command reference (`db:migrate`, `db:seed`, `db:reset`, `types:gen`, `verify`, `test:e2e`); troubleshooting for unreachable/paused cloud project and missing environment variables (spec edge cases) — FR-005, FR-015
- [ ] T017 [P] [US1] Write `README.md` at repository root: one-paragraph project description (multi-tenant Order Collection Layer in front of an external POS — not a POS itself) plus links to `docs/development.md` and `specs/` — FR-001/FR-005
- [ ] T018 [US1] Gate dry-run: on a clean environment, follow only `docs/development.md` through "start frontend", recording pass/fail per step and elapsed time; the "run tests" step completes with US3 and full-gate validation runs in the Polish phase — SC-001/SC-002

**Checkpoint**: The documented onboarding works end-to-end through a running frontend against the cloud project (MVP delivered)

---

## Phase 4: User Story 2 — Reproducible Data-Layer Workflow (Priority: P2)

**Goal**: The cloud development database can be reset to zero and deterministically rebuilt from repository artifacts; schema changes flow through exactly one canonical workflow that also regenerates types.

**Independent Test**: Run `npm run db:reset` twice — both rebuilds produce an equivalent known-good state purely from migrations + seed; a new migration applies cleanly; `npm run types:gen` is stable after rebuild (SC-003).

### Implementation for User Story 2

- [ ] T019 [US2] Create `scripts/db/reset.mjs`: asks for explicit confirmation, then (1) drops the `public` and `supabase_migrations` schemas, (2) recreates `public` with Supabase's default grants (usage for `postgres`, `anon`, `authenticated`, `service_role`; all for `postgres`), (3) runs `supabase db push`, (4) runs the seed; reads only `SUPABASE_DB_URL` so it can only target the developer-configured project; wire as `npm run db:reset` and document it as development-project-only (destructive) — FR-007, research.md §4
- [ ] T020 [US2] Add `npm run types:gen` running `supabase gen types typescript --linked --schema public` with output written to `src/types/database.types.ts`; commit the generated file — FR-009, research.md §5
- [ ] T021 [US2] Document the single canonical data-layer workflow in `docs/development.md`: to change schema, run `supabase migration new <name>` → edit the migration → `npm run db:migrate` → `npm run types:gen` → commit migration + regenerated types; state explicitly that no ad-hoc alternative (dashboard edits, manual SQL) may be used — FR-010
- [ ] T022 [US2] Determinism verification: run `npm run db:reset` twice and confirm each rebuild reaches the equivalent known-good state from repository artifacts only, and `npm run types:gen` produces an identical `src/types/database.types.ts` after each rebuild — SC-003

**Checkpoint**: Stories 1 AND 2 both work independently — clone-to-running onboarding plus deterministic data-layer reset/rebuild

---

## Phase 5: User Story 3 — Quality Pipeline (Priority: P3)

**Goal**: The full quality pipeline (format check, lint, type check, unit/database/e2e tests, production build) runs from a clean checkout via documented commands and fails loudly on violations.

**Independent Test**: `npm run verify` and `npm run test:e2e` pass from a clean checkout; deliberately introduced violations (type error, failing assertion) cause non-zero exits with readable errors (SC-004).

### Implementation for User Story 3

- [ ] T023 [P] [US3] Create `eslint.config.js` (ESLint 9 flat config: `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`) and Prettier config `.prettierrc` + `.prettierignore` per research.md §11 — FR-014
- [ ] T024 [P] [US3] Add quality scripts to package.json: `lint`, `format`, `format:check`, `typecheck` (`tsc --noEmit`) — FR-014
- [ ] T025 [P] [US3] Create `vitest.config.ts` and the unit example test `tests/unit/env.test.ts` exercising the fail-fast behavior of `src/lib/env.ts` (present values pass; missing values produce the named-variable error) — FR-013
- [ ] T026 [P] [US3] Create the database example test `tests/database/app_meta.test.ts` (Vitest + `pg` via `SUPABASE_DB_URL`, read-only): asserts (a) `public.app_meta` exists with `key` (text), `value` (text), `updated_at` (timestamptz) columns, (b) the seed row `('foundation', 'seeded')` is present, (c) RLS is enabled on the table (via `pg_class.relrowsecurity`) — FR-013, research.md §12
- [ ] T027 [P] [US3] Create `playwright.config.ts` (Chromium; `webServer` auto-starting `npm run dev`) and the smoke e2e test `e2e/smoke.test.ts` asserting the application root renders — FR-013
- [ ] T028 [US3] Add `npm run test:unit`, `npm run test:db`, `npm run test:e2e`, and the composed `npm run verify` (format:check → lint → typecheck → test:unit → test:db → build, fail-fast) to package.json — FR-015
- [ ] T029 [US3] Negative verification: temporarily introduce a type error and a failing test assertion; confirm `npm run verify` and the suites exit non-zero with readable errors; then revert — SC-004

**Checkpoint**: Stories 1–3 all work independently — the pipeline enforces quality from a clean checkout

---

## Phase 6: User Story 4 — Application Shell and Routing Structure (Priority: P4)

**Goal**: A minimal application shell with distinct top-level route areas for the customer ordering, staff dashboard, and super admin experiences, matching the master plan baseline routes — ready for later phases.

**Independent Test**: Start the frontend and navigate to `/`, `/r/:restaurantSlug`, `/order/:branchId`, `/dashboard`, `/admin` — each renders its own distinct placeholder in the shell; the production build serves the same routes (SC-005).

### Implementation for User Story 4

- [ ] T030 [P] [US4] Create `src/components/AppShell.tsx` (root layout: header with placeholder navigation for Customer / Dashboard / Admin, main content area) styled with CSS Modules plus one small global stylesheet — FR-011, research.md §9
- [ ] T031 [P] [US4] Create distinct placeholder route views: `src/routes/RootPage.tsx`, `src/routes/RestaurantPage.tsx`, `src/routes/OrderPage.tsx`, `src/routes/DashboardPage.tsx`, `src/routes/AdminPage.tsx` — FR-011/FR-012
- [ ] T032 [US4] Create `src/app/router.tsx` (React Router routes for `/`, `/r/:restaurantSlug`, `/order/:branchId`, `/dashboard`, `/admin`) and `src/app/App.tsx` composing `QueryClientProvider` + `BrowserRouter` + `AppShell` + router; rewire `src/main.tsx` and remove the Vite scaffold demo code — FR-011/FR-012, research.md §7–8
- [ ] T033 [US4] Add `e2e/routes.test.ts` walking all five baseline routes and asserting each renders its distinct placeholder — FR-012/FR-013
- [ ] T034 [US4] Production-build verification: `npm run build` then `npm run preview` serves the same five-route structure — SC-005

**Checkpoint**: All stories independently functional — the shell is ready for feature work in later phases

---

## Phase 7: User Story 5 — Project Conventions and Documentation (Priority: P5)

**Goal**: One set of documented conventions so developers and AI agents know where code goes, which commands to run, and which workflow a new feature follows.

**Independent Test**: Using only the repository documentation, a newcomer can answer: where a new component/migration/test goes, how to start/reset the environment, and what workflow a new feature follows (spec US5 Independent Test).

### Implementation for User Story 5

- [ ] T035 [US5] Write `docs/conventions.md`: the folder layout map matching plan.md Project Structure (where frontend components, migrations, seeds, tests by level, specs, and docs live), naming conventions, and the Spec Kit feature workflow (specify → clarify → plan → checklist → tasks → analyze → implement → converge) with the `specs/NNN-feature-name` directory convention — FR-002/FR-003
- [ ] T036 [US5] Cross-link the conventions: README.md and docs/development.md both point to `docs/conventions.md` so newcomers reach it from every entry point — FR-003
- [ ] T037 [US5] Answerability verification: using only the docs, confirm the three convention questions (placement, environment operations, feature workflow) are answerable without asking anyone — spec US5 acceptance scenario 3

**Checkpoint**: All five user stories complete

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final integration validation of everything the stories built

- [ ] T038 [P] Run the full quality gate from a clean checkout: `npm run verify` and `npm run test:e2e` both pass — SC-004
- [ ] T039 [P] Failure-mode checks per spec edge cases: missing `.env` values produce the named-variable error; an unreachable cloud project produces a clear connectivity message — verify behavior and close any documentation gaps in `docs/development.md` — FR-016
- [ ] T040 [P] Secrets audit: `.env*` untracked, `.env.example` contains no real values, no credential anywhere in the committed tree or history — SC-006/FR-006
- [ ] T041 Full acceptance-gate validation per `specs/001-project-foundation/quickstart.md` on a genuinely clean environment (manual check per spec Clarifications): record pass/fail per step and total time; targets are 100% of steps succeeding as written (SC-002) within 30 minutes (SC-001)
- [ ] T042 Final commit and push of all Phase 0 artifacts to GitHub `main` — FR-001

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T012/T013 need `supabase/` from T004; env/client files need the scaffold from T002) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (uses .env contract, migration, seed)
- **US2 (Phase 4)**: Depends on US1 (`db:reset` orchestrates the `db:seed` script from T014; types:gen needs a linked project with the applied migration)
- **US3 (Phase 5)**: Depends on Foundational + US1 (database test needs the applied migration and seeded row); lint/format/typecheck/build and the e2e smoke test are independent of US2/US4
- **US4 (Phase 6)**: Depends on Phase 1 only (providers, router, views) — can run in parallel with US1–US3; T033 (routes e2e) additionally needs T027 (Playwright setup)
- **US5 (Phase 7)**: Can be drafted in parallel; final content reflects US2–US4 artifacts — complete after them
- **Polish (Phase 8)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories. Its "run tests" gate step completes once US3 lands; the full gate runs in Polish (T041)
- **US2 (P2)**: After US1 (reuses db:seed; links against applied migrations)
- **US3 (P3)**: After Foundational + US1 (db test preconditions); otherwise independent
- **US4 (P4)**: Independent of US1–US3 (needs only Phase 1; T033 needs T027)
- **US5 (P5)**: Documents the others — finalize last

### Within Each User Story

- Data artifacts before the scripts that consume them
- Scripts before the documentation that references them
- Documentation before the verification task that follows only the documentation

### Parallel Opportunities

- Phase 1: T003, T005, T006 in parallel after T002; T008 last
- Phase 2: T009–T011 in parallel (T010/T011 different files); T012/T013 after T004
- Phase 5: T023–T027 all in parallel (different files)
- Phase 6: T030/T031 in parallel before T032
- Phase 8: T038–T040 in parallel before T041
- With multiple implementers: US4 can proceed in parallel with US1→US2→US3

---

## Parallel Example: User Story 3

```bash
# Launch all independent US3 tooling tasks together:
Task: "Create eslint.config.js + Prettier config"        # T023
Task: "Add quality scripts to package.json"              # T024
Task: "Create vitest.config.ts + unit example test"      # T025
Task: "Create database example test"                     # T026
Task: "Create playwright.config.ts + smoke test"         # T027

# Then sequentially:
Task: "Compose npm run verify"                           # T028 (needs all above)
Task: "Negative verification"                            # T029 (needs T028)
```

---

## Implementation Strategy

### MVP First (Setup + Foundational + US1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1
4. **STOP and VALIDATE**: onboarding through "start frontend" works following only the docs (T018)
5. This is the smallest deliverable that satisfies the acceptance gate's spine (clone → install → configure → migrate → seed → run)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → gate dry-run passes (MVP!)
3. Add US2 → deterministic reset/rebuild + canonical migration workflow
4. Add US3 → full quality pipeline with loud failures
5. Add US4 → shell + baseline routes, production build verified
6. Add US5 → conventions documented
7. Polish → full acceptance gate on a clean environment (T041)

### Single-Implementer Strategy (recommended for this feature)

Phases 1–8 in order; the only profitable parallelism is the [P]-marked tasks inside each phase. One foundation feature should land as one coherent series of commits on `main`.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] labels map tasks to spec user stories for traceability
- Every task traces to spec FRs/SCs cited in its description
- The app_meta constraints in T012/T013 are quoted verbatim from data-model.md — do not reinterpret them at implementation time
- Commit after each task or logical group; push to GitHub `main` (T008 establishes the remote)
- Backend is Supabase Cloud only — no `supabase start`, no local PostgreSQL, anywhere (spec Clarifications 2026-09-15)
- Stop at any checkpoint to validate the story independently
