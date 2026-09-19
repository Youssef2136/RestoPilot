# Contract: Database Functions (Phase 4)

**Feature**: 005-menu-management | **Date**: 2026-09-17 | **Scope**: the fifteen
`public` functions of [plan.md](./plan.md) plus the one new `private` helper.

The data-API surface consumed by the SPA and by any direct data-API call. Every
function follows the feature 002–004 discipline: `security definer` (except the
read projection, §7), `volatile`, `language plpgsql` unless stated,
`set search_path = ''`, schema-qualified bodies, authorization as the first act,
exactly one `private.record_audit` per accepted change in the same transaction,
and constraint violations caught **by constraint name** and re-raised as
`P0001` with a user-facing message. **Error model**: `42501` = authorization
denial (wrong role, other restaurant, other branch, no linked profile); `P0001`
= validation failure. Those SQLSTATEs never leak a raw constraint error through
these functions.

Shared validation rules (research.md §8):

- Names are `btrim`-ed; blank is rejected; field bounds as in
  [data-model.md](./data-model.md).
- Optional text fields are stored as `null` when blank (`nullif(btrim(…), '')`).
- Money (`p_price`, `p_price_adjustment`) must be non-null, `0 ≤ p ≤
  999999999.99`, and have **at most two decimals** — `p <> round(p, 2)` is
  rejected, never rounded (research.md §9).
- "Actual change only": an operation whose values already match the stored row
  writes nothing (no `updated_at` bump, no audit row) and returns the stored row
  — this is how FR-016's "saving an unchanged price MUST NOT produce a recorded
  change" is satisfied. Availability and override operations are idempotent the
  same way.
- Change strings (`reason`), only for the actions listed in
  [data-model.md](./data-model.md#audit-vocabulary): changed fields joined with
  `'; '` in field order, each `field: <old> -> <new>`; availability and image
  changes use the arrow form defined there.

---

## 1. Categories (owner only)

### `create_menu_category(p_restaurant_id uuid, p_name text, p_description text default null) returns public.menu_categories`

- **Authorization**: `p_restaurant_id ∈ private.owned_restaurant_ids(auth.uid())`,
  else `42501 'You do not have permission to manage this restaurant's menu.'`
  (an unknown restaurant id is the same denial — no existence leak).
- **Validation (`P0001`)**: `'A category name is required.'`;
  `'A category name may be at most 80 characters.'`;
  `'A category description may be at most 500 characters.'`;
  duplicate (case-insensitive, trimmed) name:
  `'A category with this name already exists.'` (caught `23505` on
  `menu_categories_restaurant_name_key`).
- **Effect**: insert with `sort_order = coalesce(max(sort_order) + 1, 1)` for the
  restaurant (append — creation is deterministic, research.md §7).
- **Audit**: `menu.category_created`, resource `menu_category`, tenant scope,
  no branch, `reason` null.
- **Returns**: the created row.

### `update_menu_category(p_category_id uuid, p_name text, p_description text default null) returns public.menu_categories`

- **Authorization**: the category's `restaurant_id ∈ owned_restaurant_ids`.
- **Validation**: as above (blank/80/500/duplicate), plus a no-op rule — if the
  trimmed values equal the stored ones, nothing is written and no audit row is
  produced.
- **Audit**: `menu.category_updated`, `reason` = changed fields, e.g.
  `'name: "Drinks" -> "Beverages"'`.
- **Returns**: the stored row (changed or unchanged).

### `delete_menu_category(p_category_id uuid) returns void`

- **Authorization**: the category's `restaurant_id ∈ owned_restaurant_ids`.
- **Validation**: a non-empty category is rejected — `23503` on
  `menu_items_category_scope_fkey` is translated to
  `'This category still contains items; move or remove them first.'` (FR-006).
- **Audit**: `menu.category_deleted`, `reason` null.
- **Notes**: deleting an empty category affects nothing else — no item, extra,
  override, or audit record is touched.

### `reorder_menu_categories(p_restaurant_id uuid, p_category_ids uuid[]) returns void`

- **Authorization**: owner of the restaurant.
- **Validation (`P0001`)**: null/empty list
  (`'The new order must list every category of this restaurant.'`); duplicate
  ids (`'The new order contains a duplicate category.'`); **exact coverage** —
  the submitted set must equal the restaurant's current category set, so a
  partial list is rejected (`'The new order must list every category of this
  restaurant.'`) rather than silently reordering a subset.
- **Effect**: `sort_order = 1..n` in the submitted order, one transaction.
- **Audit**: `menu.categories_reordered` (resource `menu_category`,
  resource_id = restaurant id), `reason` null.
- **No-op rule**: if the resulting order equals the current one, nothing is
  written and no audit row is produced.

---

## 2. Items (owner only)

### `create_menu_item(p_category_id uuid, p_name text, p_description text default null, p_price numeric default null) returns public.menu_items`

- **Authorization**: the category's `restaurant_id ∈ owned_restaurant_ids`.
- **Validation (`P0001`)**: blank name; name > 120; description > 1000; price
  null (`'A price is required.'`), negative (`'A price may not be negative.'`),
  too large, or more than two decimals
  (`'A price may have at most two decimal places.'`).
- **Effect**: insert with `restaurant_id` taken from the category and
  `sort_order = coalesce(max(sort_order) + 1, 1)` within the category;
  `is_available = true`; `image_path = null`.
- **Audit**: `menu.item_created`, `reason` null.
- **Returns**: the created row.

### `update_menu_item(p_item_id uuid, p_name text, p_description text default null, p_price numeric default null) returns public.menu_items`

- **Authorization**: the item's `restaurant_id ∈ owned_restaurant_ids`.
- **Validation**: as above.
- **Effect**: updates name, description, price (never category — that is
  `move_menu_item`); `updated_at` bumps only on an actual change; a fully
  unchanged call writes nothing.
- **Audit**: **one** record per accepted change —
  `menu.item_price_changed` when the price differs (FR-016's explicit price
  change), otherwise `menu.item_updated`. `reason` = changed fields with prices
  formatted to two decimals, e.g. `'name: "Hummus" -> "Hummus Plate"; price:
  8.00 -> 9.50'`.
- **Returns**: the stored row.

### `move_menu_item(p_item_id uuid, p_category_id uuid) returns public.menu_items`

- **Authorization**: owner of the restaurant that owns the item; the target
  category must belong to the **same** restaurant, else `42501`
  (`'You do not have permission to manage this restaurant's menu.'` — a
  cross-tenant target is a denial, matching feature 004's cross-tenant rule).
- **Validation (`P0001`)**: same category as the current one —
  `'This item is already in that category.'`.
- **Effect**: `category_id` changes; `sort_order` appends in the target
  category; identity, availability, overrides, extras, and image are untouched
  (FR-007).
- **Audit**: `menu.item_moved`, `reason` = `'category: "<old>" -> "<new>"'`
  (names, so the record is legible).

### `reorder_menu_items(p_category_id uuid, p_item_ids uuid[]) returns void`

- **Authorization**: owner of the category's restaurant. Same coverage and
  duplicate rules as `reorder_menu_categories`, scoped to the category's items.
- **Effect**: `sort_order = 1..n` within the category, one transaction.
- **Audit**: `menu.items_reordered` (resource `menu_item`,
  resource_id = category id), `reason` null. No-op rule as above.

---

## 3. Availability

### `set_menu_item_availability(p_item_id uuid, p_is_available boolean) returns public.menu_items`

- **Authorization**: owner of the item's restaurant (FR-012).
- **Effect**: sets `is_available` (the **restaurant-wide** state). No-op if
  unchanged. Lowering it is the hard stop (2026-09-17 clarification): it makes
  the item unavailable at every branch regardless of any override row, which
  remains stored but has no effect until the item is available again
  (research.md §2).
- **Audit**: `menu.item_availability_changed` (actual change only), `reason` =
  `'restaurant availability: available -> unavailable'` (or the reverse),
  no branch scope.
- **Returns**: the stored row.
- **Notes**: the branch-scoped equivalent is §3's second operation, and the two
  never write each other's state.

### `set_branch_item_availability(p_branch_id uuid, p_item_id uuid, p_is_available_at_branch boolean) returns boolean`

- **Authorization**: the caller must be an **owner of the branch's restaurant**
  **or** hold a `branch_manager` membership on that branch
  (`private.branch_manager_branch_ids`); cashiers, kitchen staff, and managers
  of other branches are denied `42501`. The item must belong to the branch's
  restaurant, else `42501` (FR-003, clarified 2026-09-17).
- **Effect**: `p_is_available_at_branch = false` inserts the override row
  (`branch_unavailable_items`); `true` deletes it. Repeat calls are no-ops and
  write nothing. `on conflict` is avoided by checking first under the row's
  uniqueness — a concurrent duplicate raises `23505`, translated to the same
  idempotent no-op (returns `false`).
- **Audit**: `menu.branch_availability_changed` (actual change only),
  **branch scope set** on the record, `reason` =
  `'branch availability: available -> unavailable'` (or the reverse).
- **Returns**: `true` when an override row was inserted or deleted, `false`
  when the state already matched.
- **Notes**: the branch's effective availability is **not** stored — it is the
  read-time computation of §7. An override recorded while the item is
  unavailable restaurant-wide is legal and changes nothing observable (the hard
  stop), matching the spec's edge case.

---

## 4. Item image (owner only)

### `set_menu_item_image(p_item_id uuid, p_image_path text) returns text`

- **Authorization**: the item's `restaurant_id ∈ owned_restaurant_ids`.
- **Validation (`P0001`)**: when `p_image_path` is not null it must match the
  item's own grammar — the path must equal
  `restaurant/<item.restaurant_id>/item/<item.id>/<name>` where `<name>` is
  `[A-Za-z0-9._-]{1,120}` and its extension is `jpg|jpeg|png|webp`:
  `'The image path does not belong to this item.'` (research.md §10). A null
  path clears the image.
- **Effect**: sets `image_path`; no-op if unchanged. The referenced object must
  already exist in the bucket — the RPC does not verify bytes (the storage
  policies and the upload flow guarantee it), and the client uploads **before**
  calling this.
- **Audit**: `menu.item_image_changed` (actual change only), `reason` =
  `'image: none -> <path>'`, `'image: <old> -> <new>'`, or
  `'image: <path> -> none'`.
- **Returns**: the **previous** path (null when there was none) — the client
  deletes that object through the Storage API
  ([menu-images.md](./menu-images.md) §4).
- **Notes**: the previous object becomes unreadable the moment this transaction
  commits, because the read policy matches against the current reference
  (research.md §11) — cleanup lag cannot expose it.

---

## 5. Extras (owner only)

### `add_menu_item_extra(p_item_id uuid, p_name text, p_price_adjustment numeric default 0) returns public.menu_item_extras`

- **Authorization**: the item's `restaurant_id ∈ owned_restaurant_ids`.
- **Validation (`P0001`)**: blank name; name > 80; adjustment null, negative,
  too large, or more than two decimals; **`'This item already has the maximum
  of 20 extras.'`** when the item already holds 20.
- **Effect**: `select … for update` on the item row first (serializes the
  bound — the same discipline feature 004 used for the last-owner safeguard),
  then insert with `sort_order = coalesce(max + 1, 1)` within the item.
- **Audit**: `menu.item_extra_added`, `reason` null.
- **Returns**: the created row.

### `update_menu_item_extra(p_extra_id uuid, p_name text, p_price_adjustment numeric default 0) returns public.menu_item_extras`

- **Authorization**: the extra's `restaurant_id ∈ owned_restaurant_ids`.
- **Validation**: as above (no bound check — the count cannot grow here).
- **Audit**: `menu.item_extra_updated` (actual change only), `reason` = changed
  fields.
- **Returns**: the stored row.

### `remove_menu_item_extra(p_extra_id uuid) returns void`

- **Authorization**: the extra's `restaurant_id ∈ owned_restaurant_ids`.
- **Effect**: deletes the extra (retire, FR-020). Previously submitted orders
  keep their recorded selections and prices — a requirement on feature `008`'s
  order-record design, not on this row.
- **Audit**: `menu.item_extra_removed`, `reason` null.

---

## 6. Not callable

No function in this contract deletes an item, deletes a non-empty category,
changes a price without recording the change, or writes another tenant's rows.
There is no `delete_menu_item`, no `publish`, and no bulk import.

---

## 7. Read projection

### `get_branch_menu(p_branch_id uuid) returns jsonb`

- **Security**: **`security invoker`** (not definer) — it reads
  `menu_categories`, `menu_items`, `menu_item_extras`, and
  `branch_unavailable_items` under the caller's own RLS policies, exactly like
  `public.current_auth_context`. `stable`, `set search_path = ''`.
- **Authorization (first act, explicit)**: the branch must exist and the caller
  must be an owner of its restaurant **or** hold any branch-scoped membership on
  that branch (`private.staff_branch_ids`); otherwise `42501`
  `'You do not have permission to view this branch's menu.'` (FR-014: owners
  preview any branch; branch-scoped members their own branch).
- **Returns** (ordered by `(sort_order, created_at, id)` at every level, extras
  by `(sort_order, name, id)`):

```json
{ "branch":     { "id": "<uuid>", "name": "<text>" },
  "restaurant": { "id": "<uuid>", "name": "<text>", "slug": "<text>" },
  "categories": [
    { "id": "<uuid>", "name": "<text>", "description": "<text|null>",
      "sort_order": 1,
      "items": [
        { "id": "<uuid>", "name": "<text>", "description": "<text|null>",
          "price": "12.50", "sort_order": 1,
          "image_path": "<text|null>",
          "is_offered": true,
          "unavailable_reason": null,
          "extras": [ { "id": "<uuid>", "name": "<text>",
                        "price_adjustment": "0.00", "sort_order": 1 } ] } ] } ] }
```

- `is_offered` = `menu_items.is_available and not exists(override for branch,
  item)` — the single computation of the phase's availability rule
  (research.md §3).
- `unavailable_reason`: `"restaurant"` when `is_available = false` (the hard
  stop applies), `"branch"` when the item is available restaurant-wide but this
  branch's override row exists, `null` when offered.
- `image_path` is the raw object path (the client resolves it to a URL through
  the Storage API within its session, [menu-images.md](./menu-images.md) §3).
- **Notes**: the payload deliberately includes unoffered items with their
  reason — staff need to see what customers see *and why* something is missing.
  The customer-visible subset is `is_offered = true` (the UI's customer-view
  toggle; feature `007` applies the same filter publicly). No customer-facing
  or anonymous caller can reach this function: the execute grant is
  `authenticated` only and the explicit check rejects unlinked identities.
