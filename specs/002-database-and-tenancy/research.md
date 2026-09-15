# Research: Database and Multi-Tenancy (Phase 1)

**Feature**: 002-database-and-tenancy | **Date**: 2026-09-15

Decisions resolving every technical unknown for the tenancy data layer. Each entry
records the decision, rationale, and alternatives considered. Supabase guidance was
re-verified against the official documentation (row-level-security and
database-testing guides) during this research; the identity-simulation mechanism was
additionally verified live against the configured cloud project.

---

## 1. Acting-identity simulation for security tests (spec FR-011, Clarifications)

**Decision**: Security tests simulate an acting staff member inside a rolled-back
transaction on a direct `pg` connection as the owner role:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<auth_user_id>","role":"authenticated"}', true);
-- ... assertions under RLS ...
rollback;
```

`set local role` makes the session run as `authenticated` (grants + RLS apply);
`set_config('request.jwt.claims', …)` feeds `auth.uid()` / `auth.role()` exactly as
PostgREST does for real requests. The transaction is always rolled back, so the
shared development database keeps no test residue.

**Verification (2026-09-15, live against the cloud project)**: PostgreSQL 17.6;
`auth.uid()` and `auth.role()` resolve from simulated claims; `current_user` becomes
`authenticated`; the Phase 0-hardened `app_meta` is denied with `42501` for both
`authenticated` and `anon`. The mechanism this entire test architecture depends on
works as designed.

**Alternatives considered**:
- pgTAP via `supabase test db` (official docs' CLI route) — rejected: it targets the
  local stack, which the owner's cloud-only directive excludes. The docs' first
  recommended approach — "tests that interface with a Supabase client instance …
  using your favorite testing framework" — is what we follow, one level lower (the
  same Postgres roles and claims the API layer uses).
- Real authenticated logins — rejected: that is Phase 2 scope (spec Clarification
  2026-09-15); pulling it forward would change the feature boundary.

## 2. Database-test isolation strategy (Phase 0 deferred follow-up)

**Decision**: No dedicated test project and no schema isolation. All Phase 1 tests
run against the shared cloud development database inside transactions that always
roll back. Read-only assertions query directly; attempted writes (even denied ones)
and constraint-violation probes run inside the same rolled-back transactions.

**Rationale**: Phase 0's research deferred exactly this question. Transaction
rollback makes every test self-cleaning regardless of outcome, keeps the seed
fixture intact between runs, and avoids a second cloud project (cost, credentials,
onboarding friction) or a parallel schema (RLS and grants are schema-global
concerns that a shadow schema would not faithfully reproduce).

**Alternatives considered**:
- Dedicated test Supabase project — rejected: doubles cost/credentials for no
  fidelity gain at this scale; revisit if suite runtime or fixture contention ever
  becomes a problem.
- Separate `test` schema with cloned objects — rejected: policies/grants would need
  duplication and could drift from the real ones, defeating the point (testing the
  actual enforcement).

## 3. Grants model: revoke everything, then grant select only (spec FR-008/FR-009)

**Decision**: For every new table: `revoke all on table … from anon, authenticated`,
then `grant select on table … to authenticated` for the four staff-readable tenant
tables (`restaurants`, `branches`, `dining_tables`, `staff_memberships`). `profiles`
and `audit_log` receive **no** client-role grants at all. No insert/update/delete
grants are issued to client roles anywhere in Phase 1.

**Rationale**: Official Supabase guidance is explicit that grants and policies are
two independent checks — "Adding policies doesn't take those grants back. A table
protected only by policies still hands anon an insert path if you never revoke the
grant." Grants decide *which operations* a role may run at all; policies decide
*which rows*. Phase 1 has no business write flows (management UI is Phase 3, RBAC
is Phase 2), so no client write path is needed — deny-by-default is both the safest
posture and the minimal one. Write grants and write policies arrive together with
the features that own those operations.

**Alternatives considered**:
- Scoped CRUD grants + scoped write policies now ("full foundation") — rejected as
  unrequested scope (Constitution VIII): every write path would exist without a
  feature that uses it, and Phase 2 must tighten them per role anyway.
- Supabase default privileges (all four operations pre-granted to client roles) —
  rejected: contradicts the deny-by-default requirement and the official hardening
  guidance.

## 4. Scope resolution: security-definer functions in a `private` schema (spec FR-010)

**Decision**: Three helper functions live in a new **`private`** schema (never
exposed via the data API), each `security definer`, `stable`, with
`set search_path = ''` and fully schema-qualified names inside:

- `private.staff_restaurant_ids(uuid)` → `setof uuid` — restaurants where the
  profile with the given auth user id holds any membership.
- `private.staff_branch_ids(uuid)` → `setof uuid` — branches of branch-scoped
  memberships.
- `private.owned_restaurant_ids(uuid)` → `setof uuid` — restaurants where the role
  is `owner`.

Policies call them in the wrapped scalar-subquery form, e.g.
`id in (select private.staff_restaurant_ids((select auth.uid())))`, which the
optimizer evaluates once per statement (initPlan) instead of per row.

**Rationale**: Official Supabase guidance recommends security-definer functions to
"scan [the] table without any RLS penalties" and specifically warns (a) to set
`search_path = ''` on every security-definer function so callers cannot hijack
unqualified names, and (b) to never place such a function in an exposed schema,
where it would be callable over the data API with the creator's privileges. The
definer property is also what breaks policy recursion: policies on tenant tables
must read `staff_memberships`, and a self-referencing policy on
`staff_memberships` would raise `42P17 (infinite recursion detected in policy)` —
the exact shape the docs' "Avoid recursive policies" section describes
(lists ↔ list_members is isomorphic to restaurants ↔ staff_memberships).

**Alternatives considered**:
- Inline subqueries in policies — rejected: recursion on `staff_memberships`
  (42P17) and per-row evaluation.
- `security invoker` functions — rejected: the function's own query would itself be
  subject to the RLS policies it supports → same recursion.
- Views over memberships — rejected: views bypass RLS by default (created as
  security definer by the owner), a documented footgun; no views are created in
  Phase 1.

## 5. Tenant ownership: denormalized tenant keys + composite foreign keys (spec FR-006/FR-007)

**Decision**: Every tenant-owned row stores `restaurant_id` directly
(NOT NULL, FK → `restaurants`). Every branch-scoped row additionally stores
`branch_id`, and the pair is constrained by
`foreign key (restaurant_id, branch_id) references branches (restaurant_id, id)`,
backed by `unique (restaurant_id, id)` on `branches`. The same composite FK (with
nullable `branch_id`, MATCH SIMPLE semantics) applies to `staff_memberships`.

**Rationale**: This makes the ownership path deterministic (the tenant is readable
from the row itself — FR-006) and makes a cross-tenant reference *structurally
impossible*: any row whose `(restaurant_id, branch_id)` pair does not exist in
`branches` is rejected by the database before any policy runs (FR-007). It is the
standard multi-tenant Postgres pattern and it keeps Phase 3+ tables honest by
construction — each future branch-scoped table repeats the same two-column pattern.

**Alternatives considered**:
- Ownership resolved only through joins (no denormalized keys) — rejected: the path
  is ambiguous for auditing, unenforceable declaratively, and slow for policies.
- Trigger-based tenant guards — rejected: imperative, easily bypassed by
  `disable trigger`, and reinvents what declarative constraints already guarantee.

## 6. Role representation: a Postgres enum (spec FR-004)

**Decision**: `create type public.staff_role as enum ('owner', 'branch_manager', 'cashier', 'kitchen')`.
Role-branch consistency is a check constraint:
`check ((role = 'owner') = (branch_id is null))` — owners are restaurant-wide,
the other three roles require a branch.

**Rationale**: The four restaurant-scoped roles are fixed by the master plan (§13).
An enum gives database-level typing, shows up in generated TypeScript types as a
union, and rejects unknown roles at write time. The platform super-admin is
deliberately **not** a membership role (see decision 8).

**Alternatives considered**:
- Lookup table `roles` — rejected: role semantics are code-level constants in this
  system; a table invites runtime-mutable permissions Phase 1 has no way to govern.
- `text` + check constraint — rejected: weaker typing, no enum in generated types.

## 7. Auth-identity linkage: nullable `profiles.auth_user_id` (spec FR-003, FR-010)

**Decision**: `profiles.auth_user_id uuid` — unique, nullable, **without** a
foreign key in Phase 1. Seeded profiles carry deterministic synthetic UUIDs so
security tests can simulate them. Phase 2 (authentication) populates real
`auth.users` identities and adds the FK constraint in its own migration.

**Rationale**: Policies resolve scope from `auth.uid()` through this column, so it
must exist from day one — the linkage *schema* is Phase 1; the linkage *population*
and enforcement are Phase 2 (spec FR-003). No FK now because seeded synthetic ids
do not exist in `auth.users`; adding the constraint later is a normal migration
once real identities exist. Uniqueness now prevents ambiguity in scope resolution.

**Alternatives considered**:
- FK to `auth.users(id)` immediately — rejected: would require creating real auth
  users in the seed (Phase 2 scope) or leaving the column empty (making Phase 1
  policies untestable).
- Keying policies on a profile-id JWT claim — rejected: Supabase-issued JWTs carry
  `sub` = auth user id; inventing a different claim model now would diverge from
  the platform and require custom claims work in Phase 2.

## 8. Super-admin modeling: a flag on profiles, no access path (spec FR-004, Clarification)

**Decision**: `profiles.is_super_admin boolean not null default false` records the
platform-level capability. No policy, grant, or function reads it in Phase 1; one
seeded profile carries `true` and the security suite asserts it grants **no** data
access (modeled-only, per the 2026-09-15 clarification).

**Rationale**: The capability must be representable (spec FR-004) while every
access path stays deny-by-default until Phase 2 defines role-based authorization.
A simple flag models it without inventing a parallel membership shape for a role
that is, by definition, not a tenant staff membership.

**Alternatives considered**:
- A `platform_admins` table — rejected: one boolean captures the entire Phase 1
  requirement; a table would be structure without a user (Constitution VIII).
- A `super_admin` value inside `staff_role` — rejected: super admin is not a
  restaurant-scoped staff role and must not be expressible as a membership.

## 9. Membership integrity rules (spec FR-004, Clarification on multi-membership)

**Decision**: Multi-membership is fully allowed (a person may hold memberships in
several restaurants and/or branches — clarified 2026-09-15). The only uniqueness
rule is exact-duplicate prevention:
`unique nulls not distinct (profile_id, restaurant_id, role, branch_id)`
(PostgreSQL 15+ feature; the project runs 17.6).

**Rationale**: Roles are held per membership; branch assignments are separate
memberships. The `nulls not distinct` form makes the constraint treat NULL
`branch_id` (owner rows) as equal, so a duplicated owner membership is still
rejected — which a plain `unique` would silently allow, since NULL ≠ NULL.

**Alternatives considered**:
- No uniqueness at all — rejected: exact duplicate memberships are always a data
  error and pollute scope resolution.
- Single-membership constraints — rejected by the owner's clarification.

## 10. Audit foundation: table + validated security-definer writer, no client paths (spec FR-012/FR-013)

**Decision**: `public.audit_log` (fields in [data-model.md](./data-model.md))
holds the records. The only write path is
`private.record_audit(p_actor_profile_id, p_action, p_resource_type, p_resource_id, p_reason, p_restaurant_id, p_branch_id)`
— `security definer`, `set search_path = ''`, which validates required context
(actor, action, resource type, resource id, restaurant scope — and branch
consistency through the composite FK) and raises an exception naming the missing
field when the contract is violated. `audit_log` has RLS enabled, **no policies**,
and **no grants** to `anon`/`authenticated`; `record_audit` has no execute grant
for client roles.

**Rationale**: Constitution VII requires auditability to be server-side and
reliable. Deny-all grants make the store unreadable, unmodifiable, and undeletable
from every client-accessible path; the definer writer is the single choke point
where required-context validation (spec Edge Case: incomplete audit writes must be
rejected) and consistent tenant scoping live. Business operations and their audit
*events* arrive with their features (Phases 3+), per the spec's Out of Scope; the
foundation only needs to exist and be proven, which the test suite does.

**Alternatives considered**:
- Generic audit triggers on all tables now — rejected: there are no sensitive
  business operations yet; trigger-based auditing would either log meaningless
  churn or encode event choices that belong to later specs (Constitution II/VIII).
- Granting `insert` to `authenticated` on `audit_log` — rejected: a client-writable
  audit store is a tamper surface; §37 audit entries must come from trusted
  server-side actions.

## 11. Audit primary key: `bigint` identity, not `uuid`

**Decision**: `audit_log.id` is a `bigint generated always as identity`.

**Rationale**: The one high-volume, append-only table in the system benefits from
a compact, naturally ordered key (cheap index, chronological scans, no random-IO
fragmentation). Every other table keeps `uuid` primary keys. The id is opaque
correlation data returned by `record_audit`.

**Alternatives considered**:
- `uuid` for uniformity — rejected: uniformity is aesthetic; the operational
  difference on the only unbounded table is real.

## 12. Seed fixture: two restaurants, three branches, six profiles (spec FR-015)

**Decision**: `supabase/seed.sql` grows a deterministic, idempotent
(`on conflict do nothing`) tenancy fixture with fixed UUIDs:

- **Blue Olive** (`blue-olive`): branches *Downtown*, *Marina*.
- **Cedar Grill** (`cedar-grill`): branch *Airport*.
- Profiles: Alice (owner, Blue Olive); Bob (branch manager, Downtown); Carla
  (cashier, Downtown); Dan (kitchen, Marina); Eve (owner of Cedar Grill **and**
  cashier at Downtown — the cross-restaurant multi-membership case); Platform
  Admin (`is_super_admin = true`, no memberships — the modeled-only case).
- Dining tables: Downtown T1–T3; Marina T1; Airport T1 (label reuse across
  branches proves per-branch uniqueness).

**Rationale**: This single fixture exercises every isolation case the spec
requires: cross-restaurant (Alice ✗ Cedar Grill), cross-branch within a
restaurant (Bob ✗ Marina), owner sees all branches (Alice ✓ Downtown + Marina),
multi-membership dual scope (Eve ✓ Cedar Grill + Downtown-only slice of Blue
Olive, ✗ Marina), modeled super-admin grants nothing, and anon/unauthenticated
gets nothing anywhere. Fixed UUIDs make the tests (and deterministic rebuilds)
stable; a shared `fixtures.ts` exports them to the test suites.

**Alternatives considered**:
- Test-created fixture data (setup/teardown in the suite) — rejected: the spec
  requires the *seed* to demonstrate isolation with zero manual setup (FR-015);
  a rolled-back suite can't insert persistent fixtures.
- Real-looking restaurant data beyond what the matrix needs — rejected: minimal
  fixture, minimal maintenance.

## 13. Migration structure: three focused migrations

**Decision**: `tenancy_core` (enum + five tables + constraints + indexes),
`tenancy_rls` (private schema, three scope functions, grants, RLS enablement,
policies), `audit_foundation` (audit_log, record_audit, grants). All created via
`supabase migration new`, applied with `npm run db:migrate`.

**Rationale**: The three layers have different review audiences and different
revert stories (schema vs authorization vs audit). Three files keep each review
small without one-file-per-table noise. Ordering is dependency-driven: tables →
their policies → the audit store.

**Alternatives considered**:
- One migration — rejected: mixes schema and authorization in one review;
  harder to bisect.
- One migration per table — rejected: six tiny files with cross-dependencies and
  no added review value.

## 14. Naming: `dining_tables`, `staff_memberships`, `audit_log`

**Decision**: Physical tables are `public.dining_tables` (never `tables`);
membership rows are `public.staff_memberships`; the audit store is
`public.audit_log`.

**Rationale**: `tables` collides with `information_schema.tables` in unqualified
queries and in conversation ("the tables table"). `staff_memberships` names the
authorization unit precisely (the spec's Key Entity), and `audit_log` says what it
is. Names are the durable API of the schema; they are chosen once.

**Alternatives considered**:
- `tables` / `memberships` / `audit` — rejected for the collision/ambiguity above.

## 15. Deletion semantics: no cascades in Phase 1

**Decision**: All foreign keys use the default `no action` (restrict-like)
behavior. No `on delete cascade` anywhere; no delete grants to client roles; no
delete flows exist.

**Rationale**: Tenant deletion is a future, deliberate administrative operation
(master plan Phase 13 territory) that deserves its own design (soft delete,
retention, subscription interplay). Silent cascades across tenant data are the
kind of irreversible behavior the Constitution's integrity principles exist to
prevent. Restrict is the safe default; nothing in Phase 1 needs otherwise.

**Alternatives considered**:
- `on delete cascade` from restaurants down — rejected: mass implicit deletion
  with no owning requirement behind it.

## 16. Unchanged surfaces: app_meta, realtime, types, docs

**Decision**: `public.app_meta` and its Phase 0 hardening are untouched. No table
is added to the `supabase_realtime` publication (realtime arrives in Phase 11 with
its own access design, master plan §32). `npm run types:gen` stays
`--linked --schema public` — it now also emits the six tables and the `staff_role`
enum; `private` schema functions intentionally do not appear (they are not a
client API). `docs/development.md` gains a short section on the database
security-test suite; `docs/conventions.md` is unchanged.

**Rationale**: Minimal blast radius. Realtime publication membership is an access
decision (who may receive which changes), not plumbing — enabling it without that
design contradicts the master plan's incremental-realtime rule. Keeping generated
types public-schema-only preserves the established command and the public/private
exposure boundary.

**Alternatives considered**:
- Adding tenant tables to the realtime publication "for later" — rejected (see
  master plan §32; unrequested surface).

## 17. Positive-path policy design: scope-limited select (spec FR-009)

**Decision**: Phase 1 policies are `for select to authenticated` only, using the
helper functions from decision 4:

- `restaurants`: staff of the restaurant.
- `staff_memberships`: staff of the restaurant (membership rows are
  restaurant-scoped data).
- `branches`, `dining_tables`: staff of the restaurant **and** (branch in the
  actor's branch scope **or** restaurant in the actor's owned scope) — owners see
  every branch of their restaurant; branch-scoped staff see only their assigned
  branch.
- `profiles`: no policies at all (platform-level entity; its access design arrives
  with real authentication in Phase 2).
- `audit_log`: no policies at all (server-side only).

**Rationale**: This encodes exactly the spec's Phase 1 boundary — *where* access
is allowed (tenant and branch scope) — while *what each role may do* (the
per-role matrix, including whether branch staff may list memberships or profiles)
is Phase 2's "database RLS policies" per the master plan's decomposition. The
positive tests prove within-scope visibility works; the negative tests prove every
out-of-scope path is denied.

**Alternatives considered**:
- Also modeling per-role select differences now (e.g., cashier ✗ memberships) —
  rejected: that is the Phase 2 permission matrix; inventing it here violates
  Constitution II (specs are the source of business truth) and VIII.

---

## Follow-up notes (not Phase 1 scope)

- Phase 2 adds: auth-user population of `profiles.auth_user_id` + its FK, real
  login-based re-runs of the isolation suite, and the per-role policy matrix
  layered on the scope helpers built here.
- Phase 3+ adds: write grants + scoped write policies for the management features
  that need them, and audit *events* (calls to `record_audit`) inside business
  operations, per master plan §34/§37.
- `docs/development.md`'s master-plan cross-reference (§11/§29 "start Supabase"
  wording vs the cloud-only directive) remains an owner-level annotation task
  carried over from Phase 0.
