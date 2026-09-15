# Data Model: Database and Multi-Tenancy (Phase 1)

**Feature**: 002-database-and-tenancy | **Date**: 2026-09-15

The authoritative tenancy schema. Design decisions and rejected alternatives live
in [research.md](./research.md); the function interface contracts live in
[contracts/database-functions.md](./contracts/database-functions.md). All objects
are created by the three Phase 1 migrations (see [plan.md](./plan.md)).

Conventions used throughout:

- Every table has `created_at timestamptz not null default now()`; mutable tables
  also have `updated_at timestamptz not null default now()`.
- All primary keys are `uuid default gen_random_uuid()` except `audit_log`
  (bigint identity — research.md §11).
- **Tenant key pattern**: every tenant-owned row carries `restaurant_id`; every
  branch-scoped row additionally carries `branch_id`; the pair is bound by the
  composite FK `foreign key (restaurant_id, branch_id) references branches
  (restaurant_id, id)` (backed by `unique (restaurant_id, id)` on `branches`),
  making cross-tenant references structurally impossible (spec FR-006/FR-007).
- **Access posture** (all tables): `revoke all on table … from anon,
  authenticated` first; then only the grants listed per table; RLS **enabled** on
  every table (research.md §3).

---

## Entity: `restaurants` (table `public.restaurants`)

The top-level tenant root (spec FR-001).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` |
| `name` | `text` | not null |
| `slug` | `text` | not null, **unique**, `check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` |
| `created_at` | `timestamptz` | not null, default `now()` |
| `updated_at` | `timestamptz` | not null, default `now()` |

`slug` is the unique human-readable public identifier used in customer-facing
URLs (`/r/:restaurantSlug`, feature 001 FR-012).

**Grants**: `select` to `authenticated`. **Policies**: one —
`for select to authenticated using (id in (select private.staff_restaurant_ids((select auth.uid()))))`.

**Validation rules**: slug globally unique, lowercase kebab-case. No insert /
update / delete grants exist in Phase 1 (restaurant lifecycle is Phase 3;
research.md §3).

## Entity: `branches` (table `public.branches`)

Operational unit under exactly one restaurant (spec FR-002). Root of the
branch-scope hierarchy.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK** |
| `restaurant_id` | `uuid` | not null, FK → `restaurants(id)`, no cascade |
| `name` | `text` | not null |
| `created_at` / `updated_at` | `timestamptz` | not null, default `now()` |

| Constraint | Definition |
|------------|------------|
| `branches_restaurant_id_id_key` | `unique (restaurant_id, id)` — anchor for every composite tenant FK |
| Index | `(restaurant_id)` |

"Uniquely identified within that restaurant" (US1 scenario 2) is delivered by
identity + the composite unique: a branch row is addressable only as *its*
restaurant's branch, and no other table can reference it as another restaurant's.
Display names are deliberately **not** uniqueness-constrained (spec FR-002,
clarified 2026-09-15, analyze F2).

**Grants**: `select` to `authenticated`. **Policies**: one —
`for select to authenticated using (restaurant_id in staff-scope AND (id in branch-scope OR restaurant_id in owned-scope))`
(full expression in the policy matrix below).

## Entity: `profiles` (table `public.profiles`)

A person associated with the platform (spec FR-003). Platform-level, **not**
tenant-owned; authentication linkage is populated in Phase 2.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK** |
| `display_name` | `text` | not null |
| `auth_user_id` | `uuid` | **unique**, nullable — reference to the future `auth.users` identity (no FK in Phase 1; research.md §7) |
| `is_super_admin` | `boolean` | not null, default `false` — modeled-only capability (spec FR-004, Clarification) |
| `created_at` / `updated_at` | `timestamptz` | not null, default `now()` |

**Grants**: none to any client role. **Policies**: none (deny-by-default; profile
access design belongs to Phase 2 with real authentication — research.md §17).

## Entity: `staff_memberships` (table `public.staff_memberships`)

The unit of staff authorization scope: binds a profile to one restaurant with
exactly one declared role, plus one branch for branch-scoped roles (spec FR-004;
multi-membership allowed per Clarification 2026-09-15).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK** |
| `profile_id` | `uuid` | not null, FK → `profiles(id)` |
| `restaurant_id` | `uuid` | not null, FK → `restaurants(id)` |
| `role` | `staff_role` | not null (enum below) |
| `branch_id` | `uuid` | nullable; constrained by the composite FK when present |
| `created_at` | `timestamptz` | not null, default `now()` |

| Constraint | Definition |
|------------|------------|
| `staff_memberships_scope_fkey` | `foreign key (restaurant_id, branch_id) references branches (restaurant_id, id)` — a branch-scoped membership can only point at a branch **of the same restaurant** (MATCH SIMPLE: NULL `branch_id` passes) |
| `staff_memberships_role_branch_check` | `check ((role = 'owner') = (branch_id is null))` — owners are restaurant-wide; `branch_manager` / `cashier` / `kitchen` require a branch |
| `staff_memberships_no_duplicates` | `unique nulls not distinct (profile_id, restaurant_id, role, branch_id)` — exact duplicates rejected, multi-membership preserved (research.md §9) |
| Indexes | `(restaurant_id)`, `(profile_id)`, `(branch_id)` |

**Grants**: `select` to `authenticated`. **Policies**: one — restaurant scope
(matrix below).

## Enum: `staff_role` (type `public.staff_role`)

```text
'owner' | 'branch_manager' | 'cashier' | 'kitchen'
```

The four restaurant-scoped staff roles (master plan §13). The customer is not a
staff role (Phase 7); the platform super-admin is modeled on `profiles`, not as a
membership value (research.md §8).

## Entity: `dining_tables` (table `public.dining_tables`)

A physical dining table in a branch (spec FR-005). First consumer of the
branch-scoped tenant pattern that Phase 3+ tables repeat.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK** |
| `restaurant_id` | `uuid` | not null, FK → `restaurants(id)` |
| `branch_id` | `uuid` | not null |
| `label` | `text` | not null, `check (length(btrim(label)) > 0)` |
| `created_at` / `updated_at` | `timestamptz` | not null, default `now()` |

| Constraint | Definition |
|------------|------------|
| `dining_tables_scope_fkey` | `foreign key (restaurant_id, branch_id) references branches (restaurant_id, id)` |
| `dining_tables_branch_label_key` | `unique (branch_id, label)` — uniquely identifiable within its branch |
| Indexes | `(restaurant_id)`, `(branch_id)` |

Table activation/deactivation is Phase 3 lifecycle, not Phase 1 data.

**Grants**: `select` to `authenticated`. **Policies**: one — branch scope
(matrix below).

## Entity: `audit_log` (table `public.audit_log`)

Append-only audit foundation (spec FR-012/FR-013; master plan §37 field set).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `bigint` | **PK**, `generated always as identity` |
| `actor_profile_id` | `uuid` | not null, FK → `profiles(id)` — **actor** |
| `action` | `text` | not null — **action** (e.g. a future `'menu.item_price_changed'`) |
| `resource_type` | `text` | not null — **resource** kind |
| `resource_id` | `text` | not null — **resource** identity (text so any id shape fits) |
| `reason` | `text` | nullable — **change/reason** (structured `jsonb` deltas arrive with the features that produce them) |
| `restaurant_id` | `uuid` | not null, FK → `restaurants(id)` — **tenant scope** |
| `branch_id` | `uuid` | nullable — branch scope when applicable |
| `created_at` | `timestamptz` | not null, default `now()` — **timestamp** |

| Constraint | Definition |
|------------|------------|
| `audit_log_scope_fkey` | `foreign key (restaurant_id, branch_id) references branches (restaurant_id, id)` |
| Indexes | `(restaurant_id, created_at desc)`, `(restaurant_id, branch_id, created_at desc)`, `(actor_profile_id)` |

**Grants**: none to any client role. **Policies**: none. The only write path is
`private.record_audit` (contracts); reads are server-side only until a later
phase specifies audit UI (master plan §37).

**State transitions**: none — append-only by construction (no update/delete
grants, no policies, single validated writer).

---

## Policy matrix (all `for select to authenticated`)

Policy expressions use the `private` scope functions (contracts) in the wrapped
`(select …)` initPlan form (research.md §4). `auth.uid()` resolves the acting
user; `staff_restaurant_ids` = restaurants of any membership;
`staff_branch_ids` = branches of branch-scoped memberships;
`owned_restaurant_ids` = restaurants where `role = 'owner'`. The matrix
operationalizes FR-009's clarified Phase 1 reading (Clarifications 2026-09-15,
analyze F1): restaurant-scoped rows are visible to all staff of the restaurant;
branch-scoped rows to the assigned branch's staff and to owners.

| Table | Visible rows |
|-------|--------------|
| `restaurants` | `id ∈ staff_restaurant_ids(auth.uid())` |
| `staff_memberships` | `restaurant_id ∈ staff_restaurant_ids(auth.uid())` |
| `branches` | `restaurant_id ∈ staff_restaurant_ids` **and** (`id ∈ staff_branch_ids` **or** `restaurant_id ∈ owned_restaurant_ids`) |
| `dining_tables` | `restaurant_id ∈ staff_restaurant_ids` **and** (`branch_id ∈ staff_branch_ids` **or** `restaurant_id ∈ owned_restaurant_ids`) |
| `profiles` | — (no policies; deny-by-default) |
| `audit_log` | — (no policies; deny-by-default) |
| `app_meta` | unchanged from Phase 0 (RLS on, no policies, grants revoked) |

Write operations (insert/update/delete) are denied **by grants** for every client
role on every table in Phase 1 — grants are the first check Postgres runs, before
any policy (research.md §3). The security suite asserts this denial matrix
explicitly (quickstart.md).

## The `private` schema

Created by the RLS migration: `create schema if not exists private`, with usage
revoked from `anon` and `public`. It is never listed in the project's exposed API
schemas. It holds the three scope-resolution functions and `record_audit`
(full signatures and semantics: [contracts/database-functions.md](./contracts/database-functions.md)).
All four functions are `security definer` with `set search_path = ''` and
schema-qualified names (research.md §4). Only the three read-only scope functions
carry `grant execute … to authenticated` (required so policies can call them);
`record_audit` is executable by the owner role only.

## Relationships

```text
restaurants 1───n branches
restaurants 1───n staff_memberships            (restaurant scope)
profiles    1───n staff_memberships            (multi-membership allowed)
branches    1───n staff_memberships            (nullable; branch-scoped roles)
branches    1───n dining_tables
profiles    1───n audit_log                    (as actor)
restaurants 1───n audit_log                    (tenant scope; branch_id nullable)
```

Every edge is a database-enforced foreign key; every branch-scoped edge is the
composite `(restaurant_id, branch_id)` form. No cascades (research.md §15).

## Seed fixture (spec FR-015)

Applied by `supabase/seed.sql` (idempotent, deterministic fixed UUIDs, exported
to tests via `tests/database/helpers/fixtures.ts`):

| Object | Values |
|--------|--------|
| Restaurants | Blue Olive (`blue-olive`), Cedar Grill (`cedar-grill`) |
| Branches | Downtown + Marina (Blue Olive); Airport (Cedar Grill) |
| Profiles / memberships | Alice — owner, Blue Olive · Bob — branch manager, Downtown · Carla — cashier, Downtown · Dan — kitchen, Marina · Eve — **owner of Cedar Grill and cashier of Downtown** (cross-restaurant multi-membership) · Platform Admin — `is_super_admin = true`, no memberships |
| Dining tables | Downtown T1–T3; Marina T1; Airport T1 (same label, different branches — proves per-branch uniqueness) |

The fixture is exactly the isolation-test matrix in data form (research.md §12):
every actor in the security suite exists in the seed, and the suite needs no
manual data setup (SC-005).

## Migrations and generated types

| Migration | Creates |
|-----------|---------|
| `<ts>_tenancy_core.sql` | `staff_role` enum; `restaurants`, `branches`, `profiles`, `staff_memberships`, `dining_tables`; constraints and indexes |
| `<ts>_tenancy_rls.sql` | `private` schema; the three scope functions; revokes; select grants; RLS enablement; the four select policies |
| `<ts>_audit_foundation.sql` | `audit_log`; `private.record_audit`; audit grants posture |

`npm run types:gen` (unchanged command, `--linked --schema public`) regenerates
`src/types/database.types.ts` with all six tables and the `staff_role` enum;
the file must be byte-identical after a full reset/rebuild (spec FR-016).
`private` schema functions intentionally do not appear in generated types.
