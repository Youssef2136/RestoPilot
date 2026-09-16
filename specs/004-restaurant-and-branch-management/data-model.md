# Data Model: Restaurant and Branch Management (Phase 3)

**Feature**: 004-restaurant-and-branch-management | **Date**: 2026-09-16

The authoritative Phase 3 data-layer design: the configuration schema this
phase adds, the extended tenancy tables, the management RPC surface's data
effects, the audit vocabulary, and the extended seed fixture. Design decisions
and rejected alternatives live in [research.md](./research.md); the interface
contracts live in [contracts/](./contracts/) (the database functions
[database-functions.md](./contracts/database-functions.md), the application
surface [management-client.md](./contracts/management-client.md), and the
customer entry artifact [qr-entry-point.md](./contracts/qr-entry-point.md)).
All objects are created by the five Phase 3 migrations (see
[plan.md](./plan.md)).

Conventions carried over from features 002/003 unchanged:

- Every table has `created_at timestamptz not null default now()`; mutable
  tables also have `updated_at` (the replace-all working-hours rows are
  immutable — `created_at` only).
- Primary keys are `uuid default gen_random_uuid()`.
- **Tenant key pattern**: every tenant-owned row carries `restaurant_id`;
  every branch-scoped row additionally carries `branch_id`, bound by the
  composite FK `(restaurant_id, branch_id) references branches(restaurant_id,
  id)` — cross-tenant references remain structurally impossible.
- **Access posture**: `revoke all … from anon, authenticated` first; only the
  listed grants; RLS enabled on every table; every policy predicate in the
  wrapped `(select …)` initPlan form over the `private` helper family.
- **Write posture**: no insert/update/delete grants anywhere — every write
  goes through a `security definer` management RPC (research.md §1).

---

## Entity: `restaurants` (table `public.restaurants` — extended)

The top-level tenant root. Phase 3 adds the profile and settings columns
(FR-001/FR-002/FR-003/FR-004).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` |
| `name` | `text` | not null, **`check (length(btrim(name)) > 0)`** (added) |
| `slug` | `text` | not null, unique, `check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` — the editable public identifier; global uniqueness means a released identifier is immediately reusable (no alias/history — FR-004) |
| `created_at` / `updated_at` | `timestamptz` | not null, default `now()` |
| `brand_description` | `text` | nullable (added) — the public-facing description |
| `contact_email` | `text` | nullable (added) |
| `contact_phone` | `text` | nullable (added) |
| `timezone` | `text` | not null, default `'UTC'`, **`check (length(btrim(timezone)) > 0)`** (added); the authoritative IANA validation is the RPC (research.md §10) |

**Read path**: unchanged select policy/grant (staff of the restaurant read the
row; other tenants and anon read nothing). **Write path**: `create_restaurant`,
`update_restaurant_profile`, `update_restaurant_settings` only.

**State transitions**: none beyond existence — creation is the only lifecycle
event in this phase; the slug change is a profile edit with the FR-004
consequences (no alias state exists).

## Entity: `branches` (table `public.branches` — extended row content)

Structure, constraints, grants, and policies: **unchanged**. Phase 3 adds the
name's blank check (`check (length(btrim(name)) > 0)`) and the write paths
(`create_branch`, `rename_branch`, `replace_branch_working_hours`). Display
names remain deliberately non-unique within the restaurant (feature 002
FR-002 continuity, spec US2 scenario 1).

## Enum: `weekday` (type `public.weekday`)

```text
'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
```

Declaration order is the display and `order by` order (ISO week). Introduced
by this phase for the working-hours schedule.

## Entity: `branch_working_hours` (table `public.branch_working_hours` — new)

A branch's weekly recurring schedule: one row per open interval, stored under
the weekday it starts on (FR-008/FR-009; research.md §2–§3).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` |
| `restaurant_id` | `uuid` | not null, FK → `restaurants(id)` |
| `branch_id` | `uuid` | not null |
| `weekday` | `public.weekday` | not null |
| `open_time` | `time` | not null, minute precision (below) |
| `close_time` | `time` | not null, minute precision; earlier than `open_time` ⇒ ends the following day |
| `start_minute` | `integer` | **generated always as `((extract(epoch from open_time))::integer / 60)` stored** — 0…1439 |
| `end_minute` | `integer` | **generated always as `case when close_time > open_time then ((extract(epoch from close_time))::integer / 60) else ((extract(epoch from close_time))::integer / 60) + 1440 end` stored** — 1…2879; `>= 1440` means "ends the following day" |
| `created_at` | `timestamptz` | not null, default `now()` |

| Constraint | Definition |
|------------|------------|
| `branch_working_hours_scope_fkey` | `foreign key (restaurant_id, branch_id) references branches (restaurant_id, id)` |
| `branch_working_hours_open_close_check` | `check (open_time <> close_time)` — zero-length intervals rejected (FR-008) |
| `branch_working_hours_minute_precision_check` | `check (extract(second from open_time) = 0 and extract(second from close_time) = 0)` — keeps the generated minute offsets exact |
| `branch_working_hours_no_overlap` | `exclude using gist (branch_id extensions.gist_uuid_ops with =, weekday extensions.gist_enum_ops with =, int4range(start_minute, end_minute) with &&)` — two intervals of the same branch and weekday can never overlap; a shared boundary does not overlap (half-open range). Opclass names are the btree_gist standard ones, referenced schema-qualified; a deviation fails loudly at `db:migrate`. |
| Indexes | `(restaurant_id)`, `(branch_id)` (policy performance, feature 002 pattern) |

`btree_gist` (Supabase-supported extension, installed to the `extensions`
schema by the migration; PostgreSQL 17 documents opclass coverage of `uuid`,
`int2`, and all enum types) supplies the equality opclasses; `int4range`'s
GiST opclass is core.

**Semantics the constraints encode** (spec Clarifications 2026-09-16, item 3;
FR-008): an interval whose end is earlier than its start ends the following
day and is one row under the day it starts on; only zero-length intervals and
same-day overlaps are rejected; 10:00–14:00 + 14:00–18:00 touches. Overlap
rejection is scoped to intervals recorded under the same weekday (research.md
§3). A day with no rows reads as closed; a branch with no rows reads as "no
hours configured".

**Write path**: `replace_branch_working_hours` only (delete + insert the whole
schedule in one transaction — all-or-nothing per FR-008's "the stored schedule
is left unchanged" on rejection). **Read path**: new select policy mirroring
`dining_tables` (matrix below); grant `select` to `authenticated`.

## Entity: `dining_tables` (table `public.dining_tables` — extended)

Structure and constraints unchanged except the explicit activation state
(FR-011/FR-012).

| Field | Type | Constraints |
|-------|------|-------------|
| … (unchanged: `id`, `restaurant_id`, `branch_id`, `label`, `created_at`, `updated_at`, `dining_tables_scope_fkey`, `dining_tables_branch_label_key`, `dining_tables_label_check`) | | |
| `is_active` | `boolean` | not null, default `true` (added) — the authoritative "offered to customers" state; explicit, repeatable transitions leave consistent state (Constitution VI) |

**Lifecycle**: create (active) → deactivate / reactivate — no deletion in this
phase; an inactive table can still be renamed (FR-011, US3 scenario 6).
**Write path**: `create_dining_table`, `rename_dining_table`,
`set_dining_table_active`. **Read path**: unchanged policy/grant.

## Entity: Staff identity provisioning (`auth.users` / `auth.identities` / `profiles`)

The staff-account creation capability feature 003 deferred (FR-013/FR-014).
Phase 3's `private.provision_staff_identity` writes the platform-managed
identity tables using the exact insert contract feature 003 verified live
(`specs/003-auth-and-rbac/contracts/supabase-auth-surface.md`, part B) — the
same row shape the seed proves sign-in-capable; the only additions are a
runtime-generated `id` (`gen_random_uuid()`), a server-generated temporary
credential, and the linked profile row created in the same transaction.
`profiles` and `staff_memberships` keep their structures, constraints, and
policies exactly (feature 002/003); the membership rows are now created,
updated, and removed through the staff RPCs. Feature 002's deferred
"at least one owner" rule is enforced by FR-016's safeguard in the removal and
update RPCs (research.md §6).

## Audit vocabulary (FR-020; the `audit_log` foundation is unchanged)

Records are produced by `private.record_audit` inside the management RPCs —
actor, action, resource, tenant scope, branch scope where applicable; `reason`
stays optional (passed `NULL`; no structured payloads — 002's contract).

| Action | resource_type | Triggering operation | Branch scope |
|--------|---------------|----------------------|--------------|
| `restaurant.created` | `restaurant` | `create_restaurant` | — |
| `restaurant.profile_updated` | `restaurant` | `update_restaurant_profile` (incl. identifier changes) | — |
| `restaurant.settings_updated` | `restaurant` | `update_restaurant_settings` | — |
| `branch.created` | `branch` | `create_branch` | yes |
| `branch.renamed` | `branch` | `rename_branch` | yes |
| `branch.working_hours_updated` | `branch` | `replace_branch_working_hours` | yes |
| `table.created` | `dining_table` | `create_dining_table` | yes |
| `table.renamed` | `dining_table` | `rename_dining_table` | yes |
| `table.activated` | `dining_table` | `set_dining_table_active(true)` — actual change only | yes |
| `table.deactivated` | `dining_table` | `set_dining_table_active(false)` — actual change only | yes |
| `staff.added` | `staff_membership` | `add_staff_member` | yes for branch-scoped roles |
| `staff.updated` | `staff_membership` | `update_staff_membership` | yes for branch-scoped roles |
| `staff.removed` | `staff_membership` | `remove_staff_membership` | yes for branch-scoped roles |

**Read posture**: unchanged — no grants, no policies; no client-readable path
in this phase (FR-020; audit reading is feature 011's scope).

---

## Policy matrix after Phase 3 (all `for select to authenticated`)

`auth.uid()` resolves the acting identity; helpers as in feature 003
(`staff_restaurant_ids`, `staff_branch_ids`, `owned_restaurant_ids`,
`staff_profile_ids`, `managed_restaurant_ids`, `managed_staff_profile_ids`).

| Table | Visible rows | Change |
|-------|--------------|--------|
| `restaurants` | `id ∈ staff_restaurant_ids(auth.uid())` — now including the profile/settings columns | none (columns only) |
| `branches` | `restaurant_id ∈ staff_restaurant_ids` and (`id ∈ staff_branch_ids` or `restaurant_id ∈ owned_restaurant_ids`) | none |
| `dining_tables` | `restaurant_id ∈ staff_restaurant_ids` and (`branch_id ∈ staff_branch_ids` or `restaurant_id ∈ owned_restaurant_ids`) — now including `is_active` | none (column only) |
| `branch_working_hours` | `restaurant_id ∈ staff_restaurant_ids` and (`branch_id ∈ staff_branch_ids` or `restaurant_id ∈ owned_restaurant_ids`) | **NEW table + policy + grant** |
| `staff_memberships` | `profile_id ∈ staff_profile_ids` or `restaurant_id ∈ managed_restaurant_ids` | none |
| `profiles` | `id ∈ staff_profile_ids` or `id ∈ managed_staff_profile_ids` | none |
| `audit_log` | — (no policies, no grants) | none |
| `app_meta` | — (RLS on, no policies, grants revoked) | none |

Write operations remain denied **by grants** for every client role on every
table; the management RPCs are the only write paths, and they authorize owner
scope internally via `private.owned_restaurant_ids` (branch targets resolve
their restaurant first). Execute grants: each new RPC to `authenticated` only;
`private.provision_staff_identity` to the owner role only.

## Relationships

```text
restaurants 1───n branches                (unchanged)
restaurants 1───n staff_memberships        (now managed in this phase)
profiles    1───n staff_memberships
branches    1───n staff_memberships
branches    1───n dining_tables            (+ is_active state)
branches    1───n branch_working_hours      (NEW; composite tenant FK)
restaurants 1───n branch_working_hours      (denormalized tenant key)
auth.users  1───0..1 profiles              (provisioned by this phase at runtime)
profiles    1───n audit_log                (as actor)
restaurants 1───n audit_log                (tenant scope; branch_id nullable)
```

## Seed fixture (spec FR-023, SC-007)

Applied by `supabase/seed.sql` (idempotent; deterministic UUIDs exported to
tests via `tests/database/helpers/fixtures.ts`). Additions on top of features
002/003 (research.md §15):

| Object | Values |
|--------|--------|
| Restaurant profile/settings | Blue Olive: brand description, contact email/phone, `Europe/Lisbon`; Cedar Grill: brand description, contact email/phone, `Europe/Madrid` — converged with `on conflict (id) do update` for the new columns only |
| Working hours | Downtown: Mon–Fri 11:00–15:00 + 18:00–02:00 (split day + post-midnight), Sat 12:00–02:00, Sun closed; Marina: Wed 12:00–18:00 + 18:00–23:00 (the boundary-touching pair), Thu–Sun 12:00–23:00; Airport: daily 06:00–22:00 — deterministic UUIDs |
| Table activation | Marina `T1` inactive; all other seeded tables active |
| New person | **Fiona** — `fiona@restopilot.dev` / `dev-fiona-2026`, profile with **no memberships** (the creation-bootstrap fixture; distinct from the modeled-only super admin) |

Everything already seeded (Blue Olive + Cedar Grill, three branches, six staff
identities with memberships, five tables) is unchanged. The whole Phase 3
journey — create a restaurant as Fiona, configure branches/hours/tables, add
staff, obtain the QR — is demonstrable from this fixture with zero manual data
setup.

## Migrations and generated types

| Migration | Creates / changes |
|-----------|-------------------|
| `<ts>_restaurant_settings.sql` | `restaurants`: 4 added columns; blank checks on `name`/`timezone`; blank check on `branches.name` |
| `<ts>_dining_table_activation.sql` | `dining_tables.is_active` |
| `<ts>_branch_working_hours.sql` | `weekday` enum; `btree_gist`; `branch_working_hours` (checks, generated offsets, exclusion constraint, indexes); RLS; select grant; select policy |
| `<ts>_management_rpcs.sql` | 9 configuration RPCs + execute grants (owner checks, validation, audit calls) |
| `<ts>_staff_management_rpcs.sql` | `private.provision_staff_identity`; 3 staff RPCs + execute grants |

`npm run types:gen` (unchanged command, `--linked --schema public`)
regenerates `src/types/database.types.ts` with the added columns, the
`weekday` enum, the new table, and the twelve RPC signatures; `private`
functions intentionally do not appear. The file must be reproducible after a
full reset/rebuild (feature 002 FR-016 posture).
