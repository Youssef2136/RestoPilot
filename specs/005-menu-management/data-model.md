# Data Model: Menu Management (Phase 4)

**Feature**: 005-menu-management | **Date**: 2026-09-17

The authoritative Phase 4 data-layer design: the four tables and the storage
bucket this phase adds, their constraints and policies, the RPC surface's data
effects, the audit vocabulary, and the extended seed fixture. Design decisions
and rejected alternatives live in [research.md](./research.md); the interface
contracts live in [contracts/](./contracts/) (the database functions
[database-functions.md](./contracts/database-functions.md), the application
surface [menu-client.md](./contracts/menu-client.md), and the storage contract
[menu-images.md](./contracts/menu-images.md)). All objects are created by the
four Phase 4 migrations (see [plan.md](./plan.md)).

Conventions carried over from features 002–004 unchanged:

- Every table has `created_at timestamptz not null default now()`; mutable
  tables also have `updated_at`.
- Primary keys are `uuid default gen_random_uuid()`.
- **Tenant key pattern**: every tenant-owned row carries `restaurant_id`;
  branch-scoped rows additionally carry `branch_id` bound by the composite FK
  `(restaurant_id, branch_id) references branches(restaurant_id, id)`; child
  rows of a menu item carry `(restaurant_id, item_id)` bound by the composite
  FK to `menu_items(restaurant_id, id)` — cross-tenant references stay
  structurally impossible.
- **Access posture**: `revoke all … from anon, authenticated` first; only the
  listed grants; RLS enabled on every table; every policy predicate in the
  wrapped `(select …)` initPlan form over the `private` helper family.
- **Write posture**: no insert/update/delete grants anywhere — every write goes
  through a `security definer` RPC (research.md §1).
- **Error model**: `42501` authorization denial; `P0001` validation failure and
  every constraint violation the functions can hit, caught by constraint name.

---

## Entity: `menu_categories` (table `public.menu_categories` — new)

The restaurant's flat, ordered list of menu groupings (FR-001, FR-005, FR-006,
FR-009). One menu per restaurant: categories belong to the restaurant, not to a
branch (2026-09-17 clarification).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` |
| `restaurant_id` | `uuid` | not null, FK → `restaurants(id)` |
| `name` | `text` | not null, `check (length(btrim(name)) > 0)`, `check (length(name) <= 80)` |
| `description` | `text` | nullable, `check (description is null or length(description) <= 500)`; whitespace-only is stored as `null` (RPC) |
| `sort_order` | `integer` | not null default `0`, `check (sort_order >= 0)`; non-unique — reads order by `(sort_order, created_at, id)` (research.md §7) |
| `created_at` / `updated_at` | `timestamptz` | not null, default `now()` |

| Constraint / Index | Definition |
|--------------------|------------|
| `menu_categories_restaurant_id_id_key` | `unique (restaurant_id, id)` — the composite anchor `menu_items` points at |
| `menu_categories_restaurant_name_key` | `unique index on (restaurant_id, lower(btrim(name)))` — case-insensitive uniqueness within the restaurant (FR-005) |
| `menu_categories_restaurant_id_idx` | `(restaurant_id)` — policy performance |

**Read path**: select policy `restaurant_id ∈ staff_restaurant_ids(auth.uid())`
(any member of the restaurant reads the menu — FR-004).
**Write path**: `create_menu_category`, `update_menu_category`,
`delete_menu_category`, `reorder_menu_categories` (owner only).
**Lifecycle**: created → edited/renamed/described/reordered → **deleted only
while empty** (the `menu_items` FK is `on delete restrict`, so the database
refuses a non-empty deletion; the RPC translates `23503`).

## Entity: `menu_items` (table `public.menu_items` — new)

An orderable product (master plan §7.6; FR-007, FR-009, FR-010, FR-012,
FR-021). Never deleted — availability is its lifecycle.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` |
| `restaurant_id` | `uuid` | not null, FK → `restaurants(id)` |
| `category_id` | `uuid` | not null |
| `name` | `text` | not null, `check (length(btrim(name)) > 0)`, `check (length(name) <= 120)`; **not unique** (two categories may hold the same name — Assumptions) |
| `description` | `text` | nullable, `check (description is null or length(description) <= 1000)` |
| `price` | `numeric(12,2)` | not null, `check (price >= 0)`; base amount before tax, single V1 currency; more than two decimals is rejected by the RPC, never rounded (research.md §9) |
| `is_available` | `boolean` | not null default `true` — the restaurant-wide availability state; `false` is the hard stop (FR-012) |
| `image_path` | `text` | nullable, `check (image_path is null or image_path like 'restaurant/' \|\| restaurant_id::text \|\| '/item/' \|\| id::text \|\| '/%')` — the row can only reference an object under its own tenant and item prefix (FR-021; research.md §10) |
| `sort_order` | `integer` | not null default `0`, `check (sort_order >= 0)` — order within the category |
| `created_at` / `updated_at` | `timestamptz` | not null, default `now()` |

| Constraint / Index | Definition |
|--------------------|------------|
| `menu_items_category_scope_fkey` | `foreign key (restaurant_id, category_id) references menu_categories(restaurant_id, id)` — an item can never belong to another restaurant's category |
| `menu_items_restaurant_id_id_key` | `unique (restaurant_id, id)` — the composite anchor for extras and overrides |
| `menu_items_image_path_key` | `unique index on (image_path) where image_path is not null` — two items can never reference the same object |
| `menu_items_restaurant_id_idx`, `menu_items_category_id_idx` | `(restaurant_id)`, `(category_id)` |

**Read path**: select policy `restaurant_id ∈ staff_restaurant_ids(auth.uid())`.
**Write path**: `create_menu_item`, `update_menu_item`, `move_menu_item`,
`reorder_menu_items`, `set_menu_item_availability`, `set_menu_item_image`
(owner only) — plus the extras RPCs, which write child rows.
**Lifecycle**: created in exactly one category → edited (name, description,
price), moved between categories of the same restaurant (identity, overrides,
extras, and image travel with it), availability toggled, image set/replaced/
cleared. Never deleted (FR-007; Out of Scope).
**State transitions**: `is_available` true ⇄ false (explicit, repeatable,
no-op on repetition); `image_path` null ⇄ path, replaceable.

## Entity: `menu_item_extras` (table `public.menu_item_extras` — new)

A structured, selectable option of exactly one item (master plan §7.7; FR-018,
FR-019, FR-020). Flat and independently selectable — no groups, no min/max
(2026-09-17 clarification).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` |
| `restaurant_id` | `uuid` | not null, FK → `restaurants(id)` |
| `item_id` | `uuid` | not null |
| `name` | `text` | not null, `check (length(btrim(name)) > 0)`, `check (length(name) <= 80)` |
| `price_adjustment` | `numeric(12,2)` | not null default `0`, `check (price_adjustment >= 0)` — zero is a free extra; more than two decimals rejected (research.md §9) |
| `sort_order` | `integer` | not null default `0`, `check (sort_order >= 0)` |
| `created_at` / `updated_at` | `timestamptz` | not null, default `now()` |

| Constraint / Index | Definition |
|--------------------|------------|
| `menu_item_extras_item_scope_fkey` | `foreign key (restaurant_id, item_id) references menu_items(restaurant_id, id)` — an extra belongs to exactly one item of the same restaurant; `restrict` (items are never deleted) |
| `menu_item_extras_item_id_idx` | `(item_id)`; also `(restaurant_id)` |

**Read path**: select policy `restaurant_id ∈ staff_restaurant_ids(auth.uid())`.
**Write path**: `add_menu_item_extra` (owner; **bounded at 20 per item**,
serialized by `select … for update` on the item row), `update_menu_item_extra`,
`remove_menu_item_extra` (retire).
**Lifecycle**: added → edited → retired (row deleted). Retirement never touches
history: order records keep their own selections and prices (FR-020; a
requirement on feature `008`'s record design).

## Entity: `branch_unavailable_items` (table `public.branch_unavailable_items` — new)

A branch's availability override (FR-013). **The presence of a row means the
item is unavailable at that branch** — the existence of the row *is* the state,
which is why the clarified one-directional rule cannot be contradicted by any
value (research.md §2).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | `uuid` | **PK**, default `gen_random_uuid()` |
| `restaurant_id` | `uuid` | not null, FK → `restaurants(id)` |
| `branch_id` | `uuid` | not null |
| `item_id` | `uuid` | not null |
| `created_at` | `timestamptz` | not null, default `now()` (immutable rows — no `updated_at`) |

| Constraint / Index | Definition |
|--------------------|------------|
| `branch_unavailable_items_scope_fkey` | `foreign key (restaurant_id, branch_id) references branches(restaurant_id, id)` |
| `branch_unavailable_items_item_scope_fkey` | `foreign key (restaurant_id, item_id) references menu_items(restaurant_id, id)` |
| `branch_unavailable_items_branch_item_key` | `unique (branch_id, item_id)` — at most one override per branch and item |
| `branch_unavailable_items_restaurant_id_idx`, `branch_unavailable_items_branch_id_idx` | policy performance |

**Effective availability** (the value every consumer judges against):

```text
is_offered(branch, item) = item.is_available
                           and not exists (branch_unavailable_items row for branch, item)
```

Computed only in `get_branch_menu` (research.md §3); feature `008` re-derives it
server-side at order time.
**Read path**: select policy mirroring `dining_tables` —
`restaurant_id ∈ staff_restaurant_ids` **and** (`branch_id ∈ staff_branch_ids`
or `restaurant_id ∈ owned_restaurant_ids`) — a branch-scoped member reads their
own branch's overrides; owners read all of the restaurant's.
**Write path**: `set_branch_item_availability` (owner of the restaurant, or the
manager **of that branch** — `private.branch_manager_branch_ids`).

## Entity: Storage bucket `menu-images` and its policies (Supabase Storage — new)

The project's first Storage surface (master plan §33; FR-021–FR-023). The
bucket row and the policies are created by migration — never through the
dashboard (the canonical-workflow rule, extended to Storage).

| Property | Value |
|----------|-------|
| `id` / `name` | `menu-images` |
| `public` | `false` — nothing is publicly readable in this phase |
| `file_size_limit` | `5242880` (5 MiB) |
| `allowed_mime_types` | `array['image/jpeg', 'image/png', 'image/webp']` |
| Path grammar | `restaurant/<restaurant_id>/item/<item_id>/<name>.<ext>`, `name` from `[A-Za-z0-9._-]`, ≤ 120 chars |

| Policy | Operation | Predicate (abridged) |
|--------|-----------|----------------------|
| `menu_images_staff_select` | `select` | `bucket_id = 'menu-images'` and the object's `name` equals some `menu_items.image_path` whose `restaurant_id ∈ staff_restaurant_ids(auth.uid())` |
| `menu_images_owner_insert` | `insert` | `bucket_id = 'menu-images'` and the path's restaurant folder (UUID-shaped) `∈ owned_restaurant_ids(auth.uid())` |
| `menu_images_owner_delete` | `delete` | same predicate as insert |
| (none) | `update` | replacement is insert + delete (research.md §10) |

No grants are added: the Storage service's own migrations grant table
privileges on `storage.objects` to `authenticated`; the policies are the access
decision (research.md §11). **The current `image_path` reference is the read
permission**, so a replaced or cleared image is unretrievable the moment the
reference moves, independent of the asynchronous file cleanup.

## New private helper: `private.branch_manager_branch_ids`

```text
private.branch_manager_branch_ids(p_user uuid) returns setof uuid
```

Branches where the identity holds a `branch_manager` membership — the narrow
helper the clarified role split needs (owner-only content; owner **or that
branch's manager** for branch availability). Same discipline as the existing
family: `stable`, `security definer`, `set search_path = ''`,
`revoke all … from public, anon`, `grant execute … to authenticated`
(feature 002 FR-010). It is the only helper this phase adds.

## Write operations and their data effects

Fourteen `security definer` RPCs; authorization and payloads in
[contracts/database-functions.md](./contracts/database-functions.md).

| RPC | Effect | Audit action |
|-----|--------|--------------|
| `create_menu_category` | insert (appends `sort_order`) | `menu.category_created` |
| `update_menu_category` | update name/description; **no-op writes nothing** | `menu.category_updated` — change string |
| `delete_menu_category` | delete; `23503` → "still contains items" | `menu.category_deleted` |
| `reorder_menu_categories` | assign `1..n` from the submitted complete list | `menu.categories_reordered` |
| `create_menu_item` | insert (appends within the category) | `menu.item_created` |
| `update_menu_item` | update name/description/price; no-op writes nothing | `menu.item_price_changed` when the price changed, else `menu.item_updated` — change string (research.md §6) |
| `move_menu_item` | `category_id` change, appends to the target category | `menu.item_moved` — change string (category names) |
| `reorder_menu_items` | assign `1..n` within the category | `menu.items_reordered` |
| `set_menu_item_availability` | `is_available` toggle; no-op writes nothing | `menu.item_availability_changed` — `restaurant availability: available -> unavailable` |
| `set_branch_item_availability` | insert/delete the override row; no-op writes nothing | `menu.branch_availability_changed` — `branch availability: available -> unavailable`, **branch scope set** |
| `set_menu_item_image` | `image_path` set/replace/clear; returns the previous path | `menu.item_image_changed` — `image: none -> <path>` / `<old> -> <new>` / `<path> -> none` |
| `add_menu_item_extra` | insert (item row locked; ≤ 20) | `menu.item_extra_added` |
| `update_menu_item_extra` | update name/adjustment; no-op writes nothing | `menu.item_extra_updated` — change string |
| `remove_menu_item_extra` | delete (retire) | `menu.item_extra_removed` |

## Read operation: `get_branch_menu`

`public.get_branch_menu(p_branch_id uuid) returns jsonb` — `security invoker`,
`stable`; authorizes owner-or-branch-member scope explicitly (`42501`
otherwise); reads under the caller's policies; returns the ordered payload with
`is_offered` and `unavailable_reason` per item and prices as two-decimal text
(shape and ordering in [contracts/database-functions.md](./contracts/database-functions.md)
and [research.md](./research.md) §5).

## Audit vocabulary (FR-024; the `audit_log` foundation is unchanged)

Records are produced by `private.record_audit` inside the RPCs — actor, action,
resource, tenant scope, branch scope where applicable. The `reason` field
carries the change string where a change must be legible; it stays optional
(feature 002's contract; master plan §37's "change/reason").

| Action | resource_type | Triggering operation | Branch scope | `reason` |
|--------|---------------|----------------------|--------------|----------|
| `menu.category_created` | `menu_category` | `create_menu_category` | — | null |
| `menu.category_updated` | `menu_category` | `update_menu_category` (actual change only) | — | changed fields |
| `menu.category_deleted` | `menu_category` | `delete_menu_category` | — | null |
| `menu.categories_reordered` | `menu_category` | `reorder_menu_categories` | — | null (order is the stored state) |
| `menu.item_created` | `menu_item` | `create_menu_item` | — | null |
| `menu.item_updated` | `menu_item` | `update_menu_item`, name/description changed, price unchanged | — | changed fields |
| `menu.item_price_changed` | `menu_item` | `update_menu_item`, price actually changed | — | `price: 12.50 -> 15.00` |
| `menu.item_moved` | `menu_item` | `move_menu_item` | — | `category: "Mains" -> "Specials"` |
| `menu.items_reordered` | `menu_item` | `reorder_menu_items` | — | null |
| `menu.item_availability_changed` | `menu_item` | `set_menu_item_availability` (actual change only) | — | `restaurant availability: available -> unavailable` |
| `menu.branch_availability_changed` | `menu_item` | `set_branch_item_availability` (actual change only) | **yes** | `branch availability: available -> unavailable` |
| `menu.item_image_changed` | `menu_item` | `set_menu_item_image` (actual change only) | — | `image: none -> <path>` / `<old> -> <new>` / `<path> -> none` |
| `menu.item_extra_added` | `menu_item_extra` | `add_menu_item_extra` | — | null |
| `menu.item_extra_updated` | `menu_item_extra` | `update_menu_item_extra` (actual change only) | — | changed fields |
| `menu.item_extra_removed` | `menu_item_extra` | `remove_menu_item_extra` | — | null |

**Read posture**: unchanged — no grants, no policies; no client-readable path
in this phase (audit reading is feature `011`'s scope).

---

## Policy matrix after Phase 4 (all `for select to authenticated`)

Helpers as in features 002/003 plus `private.branch_manager_branch_ids`
(this phase).

| Table | Visible rows | Change |
|-------|--------------|--------|
| `restaurants` | unchanged | none |
| `branches` | unchanged | none |
| `dining_tables` | unchanged | none |
| `branch_working_hours` | unchanged | none |
| `staff_memberships`, `profiles` | unchanged | none |
| `menu_categories` | `restaurant_id ∈ staff_restaurant_ids(auth.uid())` | **NEW table + policy + grant** |
| `menu_items` | `restaurant_id ∈ staff_restaurant_ids(auth.uid())` | **NEW table + policy + grant** |
| `menu_item_extras` | `restaurant_id ∈ staff_restaurant_ids(auth.uid())` | **NEW table + policy + grant** |
| `branch_unavailable_items` | `restaurant_id ∈ staff_restaurant_ids` and (`branch_id ∈ staff_branch_ids` or `restaurant_id ∈ owned_restaurant_ids`) | **NEW table + policy + grant** |
| `storage.objects` (bucket `menu-images`) | the object a visible item currently references, within the caller's restaurants | **NEW policies (no grants added)** |
| `audit_log` | — (no policies, no grants) | none |
| `app_meta` | — (RLS on, no policies, grants revoked) | none |

Write operations remain denied **by grants** for every client role on every
table (including the new ones); the fourteen RPCs are the only write paths.
Execute grants: each new RPC to `authenticated` only; `get_branch_menu` also to
`authenticated` only; the new private helper to `authenticated` only (it is
harmless alone — it returns ids the caller's own memberships imply) while
remaining revoked from `public` and `anon`.

## Relationships

```text
restaurants 1───n menu_categories           (NEW; the shared menu)
menu_categories 1───n menu_items            (NEW; composite tenant FK)
menu_items 1───n menu_item_extras           (NEW; composite tenant FK)
menu_items 1───n branch_unavailable_items   (NEW; override rows)
branches 1───n branch_unavailable_items     (NEW; composite tenant FK)
menu_items 1───0..1 storage object          (NEW; via image_path, path-checked)
restaurants 1───n audit_log                 (unchanged; new menu actions)
branches 1───n audit_log                    (unchanged; branch availability changes)
```

## Seed fixture (spec FR-028, SC-007)

Applied by `supabase/seed.sql` (idempotent; deterministic UUIDs exported to
tests via `tests/database/helpers/fixtures.ts`). Additions on top of features
002–004 (research.md §13):

| Object | Values |
|--------|--------|
| Blue Olive menu | 4 categories (Starters, Mains, Desserts, Drinks) and 10–12 items with descriptions and two-decimal prices |
| Extras | 3 on one item (free, paid, boundary-priced) and 2 on another — item-scoping is visible in the fixture |
| Restaurant-wide stop | one item `is_available = false` — unavailable at **all three** Blue Olive branches, including Marina which carries its own override row for it (the hard stop wins over an existing override) |
| Branch override | one available item with an override row on Marina only — unavailable at Marina, available at Downtown and Airport |
| Cedar Grill menu | its own smaller menu — proves cross-tenant isolation of categories, items, extras, and overrides |
| Images | **not seeded** (research.md §16): a reference without an uploaded object would violate FR-021; the image journey is proven by the integration round trip and the quickstart upload |

Everything already seeded (restaurants, branches, working hours, tables, staff,
identities) is unchanged. The whole Phase 4 journey — build the menu, price and
reprice it, add extras, upload an image, stop an item restaurant-wide, hide an
item at one branch, and see the branch's customer view — is demonstrable from
this fixture with zero manual data setup.

## Migrations and generated types

| Migration | Creates / changes |
|-----------|-------------------|
| `<ts>_menu_schema.sql` | 4 tables, constraints, indexes, RLS enable, revokes |
| `<ts>_menu_policies.sql` | select grants + 4 select policies |
| `<ts>_menu_media.sql` | the `menu-images` bucket row + 4 `storage.objects` policies |
| `<ts>_menu_rpcs.sql` | `private.branch_manager_branch_ids`; 14 write RPCs + `get_branch_menu` + execute grants |

`npm run types:gen` (unchanged command, `--linked --schema public`)
regenerates `src/types/database.types.ts` with the four new tables and the
fifteen function signatures; `private` functions and the `storage` schema
intentionally do not appear. The file must be reproducible after a full
reset/rebuild (feature 002 FR-016 posture).
