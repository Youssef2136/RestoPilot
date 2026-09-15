---

description: "Task list for feature 002-database-and-tenancy (Phase 1)"
---

# Tasks: Database and Multi-Tenancy (Phase 1)

**Input**: Design documents from `/specs/002-database-and-tenancy/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/database-functions.md, quickstart.md

**Tests**: Test tasks ARE included — the spec explicitly requires them (FR-011 mandates the automated security-test matrix; FR-013 requires audit behavior proven by tests; SC-001–SC-004 are test-verifiable outcomes). They are deliverables of this feature, not TDD-gated feature tests; each suite lands with the migration it verifies.

**Organization**: Tasks are grouped by user story (spec.md US1–US4) so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

Single project at repository root: `src/`, `tests/`, `e2e/`, `supabase/`, `scripts/db/`, `docs/` — per plan.md Project Structure. All new work lands in the existing Phase 0 layout; no new top-level directories.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean, green baseline before schema work begins

- [x] T001 Verify the starting baseline: `git status` clean on `main` and synced with `origin/main`; `npm run verify` exits 0; `supabase migration list` shows both Phase 0 migrations applied remotely (local = remote, no drift). If any check fails, stop and restore the known-good state before any Phase 1 work — guards FR-017 (single canonical workflow)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared test infrastructure every user story's suite depends on

**⛔ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Create `tests/database/helpers/db.ts`: shared `pg` client factory (connects via `SUPABASE_DB_URL`, `ssl: { rejectUnauthorized: false }` — the Phase 0 cloud-pooler pattern) and the transaction-scoped identity-simulation helper `runAs(role, claims, fn)` implementing the pattern verified in research.md §1: `begin` → `set local role <role>` → `select set_config('request.jwt.claims', '<json>', true)` → run `fn` → **always** `rollback` (no test residue on the shared development database)
- [x] T003 [P] Create `tests/database/helpers/fixtures.ts`: export the deterministic seed constants per the seed table in data-model.md — restaurant ids/slugs (`blue-olive`, `cedar-grill`), branch ids (`Downtown`, `Marina`, `Airport`), profile ids + synthetic `auth_user_id` values (Alice, Bob, Carla, Dan, Eve, Platform Admin), membership roles, and dining-table labels — as the single source shared by the seed task (T005) and every test suite

**Checkpoint**: Test infrastructure ready — user story implementation can begin

---

## Phase 3: User Story 1 — Authoritative Tenancy Data Model (Priority: P1) 🎯 MVP

**Goal**: The tenancy schema (restaurants, branches, profiles, staff memberships with roles, dining tables) exists with every relationship enforced by the database and a deterministic ownership path on every tenant-owned record.

**Independent Test**: After migrate + seed (or a full `npm run db:reset`), the schema suite (`tests/database/tenancy.schema.test.ts`) is green: entities and constraints match data-model.md, invalid references are rejected, and every ownership path resolves (spec US1 Independent Test).

### Implementation for User Story 1

- [x] T004 [US1] Create `supabase/migrations/<timestamp>_tenancy_core.sql` via `supabase migration new tenancy_core`, per data-model.md with constraints verbatim: `create type public.staff_role as enum ('owner', 'branch_manager', 'cashier', 'kitchen')`; `restaurants` (`id uuid primary key default gen_random_uuid()`, `name text not null`, `slug text not null unique` with `check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`, `created_at`/`updated_at timestamptz not null default now()`); `branches` (`restaurant_id uuid not null` FK → `restaurants(id)` **no cascade**, `unique (restaurant_id, id)` composite anchor, index `(restaurant_id)`); `profiles` (`display_name text not null`, `auth_user_id uuid unique` nullable, `is_super_admin boolean not null default false`); `staff_memberships` (`role staff_role not null`, `branch_id uuid` nullable, `foreign key (restaurant_id, branch_id) references branches (restaurant_id, id)`, `check ((role = 'owner') = (branch_id is null))`, `unique nulls not distinct (profile_id, restaurant_id, role, branch_id)`, indexes `(restaurant_id)`, `(profile_id)`, `(branch_id)`); `dining_tables` (`label text not null` with `check (length(btrim(label)) > 0)`, `unique (branch_id, label)`, `foreign key (restaurant_id, branch_id) references branches (restaurant_id, id)`, indexes `(restaurant_id)`, `(branch_id)`). Apply with `npm run db:migrate` — FR-001–FR-007, research.md §5–§7, §9
- [x] T005 [US1] Extend `supabase/seed.sql` with the tenancy fixture per the data-model.md seed table, idempotent (`on conflict do nothing`), UUIDs identical to `tests/database/helpers/fixtures.ts`: Blue Olive (`blue-olive`) with branches Downtown + Marina; Cedar Grill (`cedar-grill`) with branch Airport; memberships Alice=owner(Blue Olive), Bob=branch_manager(Downtown), Carla=cashier(Downtown), Dan=kitchen(Marina), Eve=**owner(Cedar Grill) and cashier(Downtown)** (cross-restaurant multi-membership), Platform Admin with `is_super_admin = true` and **no** memberships; dining tables Downtown T1–T3, Marina T1, Airport T1. Apply with `npm run db:seed` — FR-015 (delivered in the earliest consuming story per task rules; US4 verifies its rebuild determinism)
- [x] T006 [P] [US1] Regenerate and commit types: `npm run types:gen` → `src/types/database.types.ts` includes the five tables and the `staff_role` enum — FR-016
- [x] T007 [US1] Create `tests/database/tenancy.schema.test.ts` using the helpers (T002/T003), all mutations inside rolled-back transactions: assert each table's columns/types and the enum values per data-model.md; assert constraint rejections — cross-tenant composite-FK insert (branch of another restaurant), `check ((role = 'owner') = (branch_id is null))` violated in both directions, exact-duplicate membership, duplicate `slug`, duplicate `(branch_id, label)` — while the same label on a different branch **succeeds**; assert the deterministic ownership path (each dining-table and membership row resolves its restaurant and branch through declared FKs) — FR-006/FR-007, US1 acceptance scenarios. `npm run test:db` exits 0

**Checkpoint**: MVP delivered — the authoritative tenancy model exists, seeded, and proven by the schema suite

---

## Phase 4: User Story 2 — Enforced Tenant Isolation (Priority: P2)

**Goal**: Deny-by-default access posture on all tenant-owned data, with scope-limited visibility for staff enforced by the database regardless of access path.

**Independent Test**: `tests/database/tenancy.rls.test.ts` is green against the seeded database: every FR-011 category (cross-restaurant, cross-branch, bypass, direct access) demonstrates denial (spec US2 Independent Test).

### Implementation for User Story 2

- [x] T008 [US2] Create `supabase/migrations/<timestamp>_tenancy_rls.sql` via `supabase migration new tenancy_rls`, per data-model.md + contracts/database-functions.md: `create schema if not exists private` with usage revoked from `anon`/`public`; the three scope functions with signatures verbatim from the contracts — `private.staff_restaurant_ids(p_user uuid) returns setof uuid`, `private.staff_branch_ids(p_user uuid) returns setof uuid`, `private.owned_restaurant_ids(p_user uuid) returns setof uuid` — each `language sql, stable, security definer, set search_path = ''` with schema-qualified bodies (research.md §4); `grant execute` on the three to `authenticated`, revoked from `anon`; then for each of `restaurants`, `branches`, `staff_memberships`, `dining_tables`: `revoke all on table … from anon, authenticated` → `grant select on table … to authenticated` → `enable row level security` → exactly one `for select to authenticated` policy per the data-model.md policy matrix in the wrapped `(select …)` initPlan form; `profiles`: RLS enabled, **no policies, no grants**. Apply with `npm run db:migrate` — FR-008–FR-010
- [x] T009 [US2] Create `tests/database/tenancy.rls.test.ts` using the helpers, covering the FR-011 matrix: `anon` denied (`42501`) on all five tenancy tables; authenticated with an unknown `sub` sees zero rows everywhere; Alice sees Blue Olive + both branches + its memberships/tables, nothing of Cedar Grill; Bob sees Downtown only (Marina and all Cedar Grill invisible); Carla/Dan analogous for their branches; Eve sees all of Cedar Grill plus only Downtown within Blue Olive (multi-membership mixed-role scope, Marina invisible); Platform Admin (`is_super_admin = true`) sees **zero rows anywhere** (modeled-only posture); insert/update/delete denied (`42501`) for `authenticated` on every table (grant-level denial); crafted direct queries (the suite itself is direct database access — the same roles/claims the data API uses) cannot reach out-of-scope rows. `npm run test:db` exits 0 — FR-011, SC-001/SC-003, research.md §17

**Checkpoint**: Stories 1 AND 2 both work independently — the model exists and isolation is enforced and proven

---

## Phase 5: User Story 3 — Audit Foundation (Priority: P3)

**Goal**: An append-only audit store with a single validated write path and no client-accessible read/modify/delete path, proven by tests.

**Independent Test**: `tests/database/audit.test.ts` is green: a recorded action persists all required fields; every client-accessible modification attempt on audit records is denied (spec US3 Independent Test).

*Note: this story depends only on US1 — it can be implemented in parallel with US2 (no object dependency; `audit_foundation` needs only `tenancy_core`).*

### Implementation for User Story 3

- [x] T010 [US3] Create `supabase/migrations/<timestamp>_audit_foundation.sql` via `supabase migration new audit_foundation`, per data-model.md + contracts: `public.audit_log` with `id bigint generated always as identity primary key`, `actor_profile_id uuid not null` FK → `profiles(id)`, `action text not null`, `resource_type text not null`, `resource_id text not null`, `reason text` nullable, `restaurant_id uuid not null` FK → `restaurants(id)`, `branch_id uuid` nullable, `foreign key (restaurant_id, branch_id) references branches (restaurant_id, id)`, `created_at timestamptz not null default now()`, indexes `(restaurant_id, created_at desc)`, `(restaurant_id, branch_id, created_at desc)`, `(actor_profile_id)`; RLS enabled with **no policies** and `revoke all … from anon, authenticated` (no grants); `private.record_audit(p_actor_profile_id, p_action, p_resource_type, p_resource_id, p_reason, p_restaurant_id, p_branch_id) returns bigint` per the contract — `language plpgsql, volatile, security definer, set search_path = ''`, validates required context and raises an exception naming the missing field, execute granted to the owner role only. Apply with `npm run db:migrate` — FR-012/FR-013, research.md §10–§11
- [x] T011 [US3] Create `tests/database/audit.test.ts`: `record_audit` happy path persists actor, action, resource type/id, reason, restaurant (and branch) scope, and timestamp, returning the identity; each missing required context (actor, action, resource_type, resource_id, restaurant_id) is rejected with an error naming the field; a mismatched `(restaurant_id, branch_id)` pair is rejected by the composite FK; `anon` and `authenticated` cannot select/insert/update/delete `audit_log` (`42501`) and cannot execute `record_audit` — append-only posture. `npm run test:db` exits 0 — FR-012/FR-013, SC-004
- [x] T012 [US3] Regenerate and commit types: `npm run types:gen` → `src/types/database.types.ts` now also includes `audit_log` — FR-016

**Checkpoint**: Stories 1–3 all work independently — model, isolation, and audit foundation are in place

---

## Phase 6: User Story 4 — Deterministic Rebuild and Tenancy Seed (Priority: P4)

**Goal**: The complete Phase 1 data layer (all three migrations + seed) rebuilds from zero deterministically, with reproducible generated types.

**Independent Test**: Run the documented reset-to-zero workflow twice; each rebuild applies all migrations, loads the seed, passes the full suite, and produces equivalent state (spec US4 Independent Test).

### Implementation for User Story 4

- [x] T013 [US4] Rebuild cycle 1: `npm run db:reset` (drops `public` + `supabase_migrations`, reapplies **all five** migrations via `db push`, reseeds) → `npm run types:gen` → `npm run test:db` (all four suites green on the rebuilt database) — rebuild purely from repository artifacts — FR-014, quickstart.md "Reset-and-rebuild determinism"
- [x] T014 [US4] Rebuild cycle 2 + determinism proof: run `npm run db:reset` a second time; the full suite is green again and `npm run types:gen` output is byte-identical to the committed `src/types/database.types.ts` — equivalent known-good state across consecutive rebuilds — FR-014/FR-016, SC-002

**Checkpoint**: All four stories complete — the exit condition (§12: database resettable from zero, recreated entirely from migrations) is demonstrated

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final integration validation of everything the stories built

- [x] T015 [P] Update `docs/development.md` with a short "Database security tests" section: what `npm run test:db` now covers (schema integrity, the tenant-isolation matrix, the audit foundation), the note that suites run in rolled-back transactions against the shared cloud development database (identity simulation per research.md §1), and the precondition (migrated + seeded database) with a pointer to `specs/002-database-and-tenancy/quickstart.md`
- [x] T016 Full quality gate from a clean checkout: `npm run verify` (format:check → lint → typecheck → test:unit → test:db → build) **and** `npm run test:e2e` both exit 0 — SC-001/SC-003/SC-004 evidence
- [x] T017 [P] Constraint & boundary audit: no `supabase start` / Docker / second migration workflow introduced anywhere (FR-017); no secrets in committed files; no `src/` frontend files were modified by this feature (data-layer-only boundary, plan.md); every spec FR-001–FR-017 maps to at least one completed task (traceability check)
- [ ] T018 Final commit and push of all Phase 1 artifacts (migrations, seed, test helpers + suites, regenerated types, docs, spec/plan artifacts) to GitHub `main` — mirrors feature 001 T042

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (every suite imports the helpers)
- **US1 (Phase 3)**: Depends on Foundational (T005 seed and T007 tests consume `fixtures.ts`; T007 uses `db.ts`)
- **US2 (Phase 4)**: Depends on US1 (policies attach to the core tables; the isolation suite needs the seeded actors)
- **US3 (Phase 5)**: Depends on US1 only (audit needs `profiles`/`restaurants`/`branches`) — **parallel with US2**; either migration order works (no object dependency)
- **US4 (Phase 6)**: Depends on US2 + US3 (a full rebuild includes all three new migrations)
- **Polish (Phase 7)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories (MVP)
- **US2 (P2)**: After US1 (tables + seed actors)
- **US3 (P3)**: After US1 — independent of US2
- **US4 (P4)**: After US2 + US3 (verifies the complete artifact set)

### Within Each User Story

- Migration first, then seed/types/tests that consume it
- Every database-touching task applies through `npm run db:migrate` / `db:seed` (the canonical workflow — FR-017)
- The story's test suite is green before the story's checkpoint

### Parallel Opportunities

- Phase 2: T002 ∥ T003 (different files)
- Phase 3: T006 ∥ T005 after T004 (types regen and seed are independent files, both need only the applied core migration)
- Phases 4/5: **US2 and US3 run in parallel after US1** (different migrations, different test files; US3 needs no RLS objects)
- Phase 7: T015 ∥ T017 after T016

---

## Parallel Example: US2 ∥ US3

```bash
# After US1's checkpoint (T001–T007 complete), two implementers can work simultaneously:

Implementer A (US2 — isolation):
Task: "Create tenancy_rls migration (private schema + scope functions + policies)"   # T008
Task: "Create tenancy.rls.test.ts isolation matrix"                                  # T009 (needs T008)

Implementer B (US3 — audit, needs only tenancy_core):
Task: "Create audit_foundation migration (audit_log + record_audit)"                 # T010
Task: "Create audit.test.ts"                                                         # T011 (needs T010)
Task: "Regenerate types incl. audit_log"                                             # T012 (needs T010)

# Merge both, then US4's double reset-rebuild validates the complete set (T013–T014).
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T003)
3. Complete Phase 3: User Story 1 (T004–T007)
4. **STOP and VALIDATE**: schema suite green on a freshly rebuilt database — the authoritative tenancy model is the MVP

### Incremental Delivery

1. Setup + Foundational → test infrastructure ready
2. US1 → schema suite green (MVP — the tenancy model)
3. US2 → isolation matrix green (the security property)
4. US3 (parallel-safe) → audit suite green
5. US4 → double reset-rebuild proves determinism (§12 exit condition)
6. Polish → full gate, audits, commit/push

### Single-Implementer Order

T001 → T002 ∥ T003 → T004 → T005 ∥ T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T016 → T015 ∥ T017 → T018

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Migrations are created only via `supabase migration new <name>` and applied only via `npm run db:migrate` — never ad-hoc SQL or dashboard edits (FR-017)
- All test mutations run inside rolled-back transactions; the shared cloud development database must be left untouched by suites (research.md §1–2)
- Never print or commit `SUPABASE_DB_URL` or any secret; helpers read it from the environment only
- Commit after each task or logical group; stop at any checkpoint to validate the story independently
