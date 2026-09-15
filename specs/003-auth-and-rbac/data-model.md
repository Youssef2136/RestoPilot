# Data Model: Auth and RBAC (Phase 2)

**Feature**: 003-auth-and-rbac | **Date**: 2026-09-15

The authoritative Phase 2 data-layer design: the identity linkage, the
role-aware policy matrix, the authorization helper family, and the seeded
staff identities. Design decisions and rejected alternatives live in
[research.md](./research.md); the interface contracts live in
[contracts/](./contracts/) (the platform Auth surface
[supabase-auth-surface.md](./contracts/supabase-auth-surface.md), the
application client [auth-client.md](./contracts/auth-client.md), and the
database functions [database-functions.md](./contracts/database-functions.md)).
All objects are created by the three Phase 2 migrations (see
[plan.md](./plan.md)).

Phase 2 adds **no new application tables** — it completes the linkage on
`profiles`, narrows/widens policies, and provisions platform-managed
identities. Conventions carried over from feature 002 unchanged: grants
decide *which operations* (revoke-all, then grant the minimum); policies
decide *which rows*; every policy predicate uses the wrapped
`(select …)` initPlan form over `security definer` helpers in the `private`
schema.

---

## Entity: Staff Sign-In Identity (platform tables `auth.users` / `auth.identities`)

Not an application table — the platform-managed identity linked one-to-one
with a staff profile (spec FR-001, FR-003). The application never writes
these tables; the **development seed** is the only writer (Phase 3 replaces
it with admin flows). The exact insert contract — including the
load-bearing `instance_id`, empty-string token columns, and confirmed-email
requirements, all live-verified — is fixed in
[contracts/supabase-auth-surface.md](./contracts/supabase-auth-surface.md).

| Aspect | Value (seeded identities) |
|--------|---------------------------|
| `auth.users.id` | the deterministic UUID already used as `profiles.auth_user_id` (…2001–…2006) — unchanged from feature 002 |
| `email` | `<name>@restopilot.dev` (passes platform validation — research.md §3) |
| `encrypted_password` | `crypt('<dev password>', gen_salt('bf', 10))` — pgcrypto bcrypt, cost 10 |
| `instance_id` | `'00000000-0000-0000-0000-000000000000'` |
| `aud` / `role` | `'authenticated'` |
| `email_confirmed_at` | set (hosted projects require confirmation for sign-in) |
| token columns | empty strings (`''`), never NULL |
| `raw_app_meta_data` | `{"provider":"email","providers":["email"]}` |
| `auth.identities` | one row per user: `provider = 'email'`, `provider_id = user_id`, `identity_data = {sub, email, email_verified: true}`, deterministic `id = user_id` |

**Validation rules**: email unique per project (platform-enforced); the
password grant rejects wrong-password and unknown-account attempts with an
identical generic response (live-verified — FR-002); identities without a
linked profile can authenticate but read nothing (deny-by-default,
live-verified through the real data API).

## Entity: `profiles` (table `public.profiles` — Phase 1, completed)

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK** |
| `display_name` | `text` | not null |
| `auth_user_id` | `uuid` | **unique**, nullable — **now `references auth.users(id)`** (Phase 2 migration 1; `no action` on delete) |
| `is_super_admin` | `boolean` | not null, default `false` — platform capability flag; read by no policy (FR-012) |
| `created_at` / `updated_at` | `timestamptz` | not null, default `now()` |

**Changes in Phase 2**:

- **FK added** (`profiles_auth_user_id_fkey`): the one-to-one linkage is now
  declared and enforced by the data layer (FR-003) — a linkage must point at
  a real identity, and the existing `unique` means an identity maps to at
  most one profile. Deleting an auth user that a profile still links to
  fails explicitly (no cascade — research.md §5). The migration first nulls
  orphaned linkage values (the synthetic ids feature 002 seeded) so
  `db:migrate` stays valid on the existing database; the seed re-establishes
  the real linkage via the profiles upsert.
- **Grants**: `select` to `authenticated` (first client access ever —
  previously none).
- **Policies**: one select policy (below): own profile, or the profile of a
  member of a restaurant the caller manages.

## Entity: `staff_memberships` (table `public.staff_memberships` — Phase 1, policy narrowed)

Structure, constraints, indexes: **unchanged** from feature 002 (the
`staff_role` enum, role↔branch check, composite tenant FK,
`unique nulls not distinct` duplicate guard, multi-membership allowed).

**Policy replaced** (`staff_memberships_staff_select`): visible rows are now
**own-profile rows or rows of a managed restaurant** — Phase 1's "any staff
of the restaurant" arm is withdrawn exactly as feature 002 FR-009 deferred
(spec FR-007, Clarifications 2026-09-15). Grants unchanged (`select` to
`authenticated`).

## Entities: `restaurants`, `branches`, `dining_tables`, `audit_log`, `app_meta`

**Unchanged** — structures, grants, and policies all stay exactly as
delivered by features 000–002. The Phase 1 policies for `restaurants`
(every staff member reads their restaurant's own record), `branches` and
`dining_tables` (assigned branch for branch-scoped roles, every branch for
owners) already encode master plan §30 / spec FR-007's scope rules; the
role dimension of this phase affects only the staff list (memberships +
linked profiles).

---

## Enum: `staff_role` (unchanged)

```text
'owner' | 'branch_manager' | 'cashier' | 'kitchen'
```

The platform super-admin capability is not a membership role (modeled on
`profiles.is_super_admin`; research 002 §8). Customers are not staff
accounts (FR-022).

## The `private` schema: helper family after Phase 2

All `security definer`, `stable`, `set search_path = ''`, schema-qualified
bodies; execute granted to `authenticated`, revoked from `public`/`anon`.
Full signatures and semantics: [contracts/database-functions.md](./contracts/database-functions.md).

| Function | Returns | Added | Purpose |
|----------|---------|-------|---------|
| `staff_restaurant_ids(p_user)` | `setof uuid` | 002 | restaurants of any membership (unchanged) |
| `staff_branch_ids(p_user)` | `setof uuid` | 002 | branches of branch-scoped memberships (unchanged) |
| `owned_restaurant_ids(p_user)` | `setof uuid` | 002 | restaurants where role = owner (unchanged) |
| `staff_profile_ids(p_user)` | `setof uuid` | **Phase 2** | profile(s) linked to the identity |
| `managed_restaurant_ids(p_user)` | `setof uuid` | **Phase 2** | restaurants where role in (owner, branch_manager) — the staff-list visibility set |
| `managed_staff_profile_ids(p_user)` | `setof uuid` | **Phase 2** | profiles holding memberships in the managed restaurants |
| `record_audit(…)` | `bigint` | 002 | audit writer (unchanged, unused in Phase 2) |

## The `public` schema: effective-context RPC

`public.current_auth_context() returns jsonb` — `language sql`, `stable`,
**security invoker**, `set search_path = ''`; execute granted to
`authenticated` only. Resolves the caller's effective roles and scope from
their current memberships (spec FR-004) and returns the caller's own
resolved context:

```jsonc
{
  "profile": { "id": "…", "display_name": "Alice", "is_super_admin": false }, // null when unlinked
  "memberships": [
    {
      "restaurant_id": "…", "restaurant_slug": "blue-olive", "restaurant_name": "Blue Olive",
      "role": "owner",                    // staff_role
      "branch_id": null, "branch_name": null
    }
  ]
}
```

One row-shape per membership; restaurant/branch names come from the same
tables under the caller's own policies (a member sees names only for
restaurants/branches they may already read). The shape distinguishes the
three guard cases: staff (profile + memberships), super admin (profile, no
memberships), unlinked identity (`profile: null`). Contract:
[contracts/database-functions.md](./contracts/database-functions.md).

## Policy matrix (all `for select to authenticated`)

Helper shorthand: `staff_profile_ids` = own profile(s); `staff_restaurant_ids` /
`staff_branch_ids` / `owned_restaurant_ids` / `managed_restaurant_ids` /
`managed_staff_profile_ids` as above; `auth.uid()` resolves the acting
identity. All predicates in the wrapped `(select …)` initPlan form.

| Table | Visible rows | Change |
|-------|--------------|--------|
| `profiles` | `id ∈ staff_profile_ids(auth.uid())` **or** `id ∈ managed_staff_profile_ids(auth.uid())` | **NEW policy + grant** |
| `staff_memberships` | `profile_id ∈ staff_profile_ids(auth.uid())` **or** `restaurant_id ∈ managed_restaurant_ids(auth.uid())` | **REPLACED** (was: any staff of the restaurant) |
| `restaurants` | `id ∈ staff_restaurant_ids(auth.uid())` | unchanged |
| `branches` | `restaurant_id ∈ staff_restaurant_ids` **and** (`id ∈ staff_branch_ids` **or** `restaurant_id ∈ owned_restaurant_ids`) | unchanged |
| `dining_tables` | `restaurant_id ∈ staff_restaurant_ids` **and** (`branch_id ∈ staff_branch_ids` **or** `restaurant_id ∈ owned_restaurant_ids`) | unchanged |
| `audit_log` | — (no policies; no client grants) | unchanged |
| `app_meta` | unchanged from Phase 0 (RLS on, no policies, grants revoked) | unchanged |

*Erratum (2026-09-15): the `profiles` own arm was originally quoted as
`auth_user_id ∈ staff_profile_ids(auth.uid())` — a typo.
`staff_profile_ids` returns **profile ids**, so the predicate compares `id`,
exactly as the applied `rbac_policies` migration does (proven by
`tests/database/auth.rbac.test.ts`).*

Write operations remain denied **by grants** for every client role on every
table (no insert/update/delete grants exist — feature 002 posture; Phase 3
adds write paths with their owning features). Reading `is_super_admin`
grants nothing: no policy or grant consults it (FR-012).

Consequences the test matrix asserts (spec FR-007 / US2):

- Owner (Alice): reads her restaurant, every branch, every table, the full
  staff list (memberships + linked profiles) of her restaurant.
- Branch manager (Bob, Downtown): reads his branch's scope and the staff
  list; Marina (same restaurant, other branch) is denied.
- Cashier (Carla) / kitchen (Dan): own branch scope only; **staff list
  denied** (memberships of other members and their profiles invisible).
- Multi-membership (Eve — owner of Cedar Grill, cashier of Downtown): the
  union of both scopes; Cedar Grill's staff list readable, Blue Olive's
  denied; nothing beyond either membership.
- Super admin (no memberships): authentication succeeds; the RPC reports
  the capability; **no restaurant tenant data is readable**.
- Membership removed mid-session: that restaurant's data disappears on the
  next access (FR-006) — policies read live membership rows.
- Forged credential claims (e.g. `app_role: "owner"` injected into
  `request.jwt.claims`): no effect — no policy reads claims beyond
  `auth.uid()` (FR-009, SC-003).

## Relationships

```text
auth.users 1───0..1 profiles          (profiles.auth_user_id, unique, FK, no cascade)
-- all Phase 1 relationships unchanged --
restaurants 1───n branches
restaurants 1───n staff_memberships
profiles    1───n staff_memberships
branches    1───n staff_memberships
branches    1───n dining_tables
profiles    1───n audit_log
restaurants 1───n audit_log
```

The identity edge is the only new relationship; it references the
platform table's **primary key** (the only stable reference into
platform-managed schemas, per official guidance).

## Seed fixture (spec FR-021, SC-007)

Applied by `supabase/seed.sql` (idempotent; deterministic UUIDs; exported to
tests via `tests/database/helpers/fixtures.ts`, which gains the emails and
documented dev passwords). Auth identities are inserted **before** profiles
(the FK requires the identity to exist); profiles gain
`on conflict (id) do update set auth_user_id = excluded.auth_user_id` to
re-establish linkage on re-runs.

| Profile (role, scope) | Sign-in email | Documented dev password |
|------------------------|---------------|--------------------------|
| Alice — owner, Blue Olive | `alice@restopilot.dev` | `dev-alice-2026` |
| Bob — branch manager, Downtown | `bob@restopilot.dev` | `dev-bob-2026` |
| Carla — cashier, Downtown | `carla@restopilot.dev` | `dev-carla-2026` |
| Dan — kitchen, Marina | `dan@restopilot.dev` | `dev-dan-2026` |
| Eve — owner of Cedar Grill **and** cashier of Downtown | `eve@restopilot.dev` | `dev-eve-2026` |
| Platform Admin — `is_super_admin = true`, no memberships | `platform-admin@restopilot.dev` | `dev-platform-admin-2026` |

Restaurants, branches, memberships, and dining tables: unchanged from
feature 002 (Blue Olive Downtown+Marina; Cedar Grill Airport). Every Phase 2
behavior is demonstrable with these six identities and zero manual setup.
Credentials are development-only values; `npm run db:reset -- --purge-auth`
restores them after manual changes (auth data survives ordinary resets).

## Migrations and generated types

| Migration | Creates / changes |
|-----------|-------------------|
| `<ts>_staff_identity_linkage.sql` | Orphan-id clearing `update`; FK `profiles.auth_user_id → auth.users(id)` |
| `<ts>_rbac_policies.sql` | `private.staff_profile_ids`, `private.managed_restaurant_ids`, `private.managed_staff_profile_ids` (+ grants); replaced `staff_memberships` select policy; new `profiles` select policy; `grant select on public.profiles to authenticated` |
| `<ts>_auth_context_rpc.sql` | `public.current_auth_context()`; execute revoked from `public`/`anon`, granted to `authenticated` |

`npm run types:gen` (unchanged command) regenerates
`src/types/database.types.ts`: the RPC joins the `Functions` section;
table/enum types are unchanged; `private` functions intentionally do not
appear. The file must be reproducible after a full reset/rebuild
(feature 002 FR-016 posture).
