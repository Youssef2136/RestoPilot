---

description: "Task list for feature 005-menu-management (Phase 4)"
---

# Tasks: Menu Management (Phase 4)

**Input**: Design documents from `/specs/005-menu-management/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/database-functions.md, contracts/menu-client.md, contracts/menu-images.md, quickstart.md, checklists/security-and-data-integrity.md (reviewer-owned)

**Tests**: Test tasks ARE included — the spec mandates them (FR-027 requires the automated matrix: the authorization denials, the validation rules, the effective-availability computation including override set/clear, the audit records, the customer-visible read reflecting saved state, and price-history preservation; SC-002–SC-008 are test-verifiable outcomes). They are deliverables of this feature, not TDD-gated feature tests; each suite lands with the layer it verifies.

**Organization**: Tasks are grouped by user story (spec.md US1–US5) so each story is independently implementable and testable. The shared data layer — four tables, the storage bucket, and the fifteen functions — is a blocking prerequisite (Phase 2) because every story's surface reads or writes it; each story's phase then delivers its own surfaces and its own semantic proofs.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

## Path Conventions

Single project at repository root: `src/`, `tests/`, `e2e/`, `supabase/`, `scripts/db/`, `docs/` — per plan.md Project Structure. No new top-level directories, no new dependency, no new environment variable. Database work extends the feature 002–004 layout: migrations under `supabase/migrations/` (created only via `supabase migration new <name>`, applied only via `npm run db:migrate`), seed in `supabase/seed.sql` (applied via `npm run db:seed`), types regenerated via `npm run types:gen`. Storage is configured **by migration** — the bucket row and the `storage.objects` policies are schema, never dashboard edits. The frontend lands in the new `src/features/menu/` module with pages in `src/routes/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean, green baseline before any Phase 4 work

- [X] T001 Verify the starting baseline before any Phase 4 work: `git status --short` shows only the feature 004 history (no uncommitted Phase 4 files); `npm run verify` exits 0 on the feature-004 state; `supabase migration list` shows all thirteen existing migrations under `supabase/migrations/` applied remotely with no drift. If any check fails, stop and restore the known-good state — guards FR-029 (single canonical migration workflow). No dependency is added this phase: `@supabase/supabase-js` already ships the Storage client, and money handling is in-repo (plan.md Technical Context)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The four migrations that constitute the menu data layer, the seeded fixture source, and the schema/authorization proofs every user story consumes

**CRITICAL**: No user story work can begin until this phase is complete

**Why the whole data layer lands here**: the plan's migrations create the shared tables, the storage surface, and the fifteen functions that every story's surface calls — there is no story whose work can precede its own table or function. The story phases that follow own the *surfaces* and the *semantic proofs* (ordering, availability, price recording, extras, images) that the shared matrix deliberately does not duplicate.

- [X] T002 [P] Extend `tests/database/helpers/fixtures.ts` with the Phase 4 fixture constants as new exports (existing exports keep their shapes): the Blue Olive menu — four category ids/names (Starters, Mains, Desserts, Drinks) in order, 10–12 item ids with names/descriptions/two-decimal prices, the two extras sets (three extras on one item — one free at `0.00`, one paid, one at the bound's edge; two on another), the restaurant-wide-stopped item id, Marina's override item id, and their expected effective states per branch — plus Cedar Grill's smaller menu ids. This is the single fixture source shared by the seed task (T007), the schema suite, and every story's suites — FR-028, SC-007, data-model.md seed fixture table
- [X] T003 Create `supabase/migrations/<timestamp>_menu_schema.sql` via `supabase migration new menu_schema` (data-model.md; research.md §2, §7–§9): the four tables with every constraint, index, RLS enable, and `revoke all … from anon, authenticated` exactly as declared — `menu_categories` (`name` non-blank and ≤ 80 chars, `description` ≤ 500, `sort_order integer not null default 0 check (sort_order >= 0)`, `unique (restaurant_id, id)`, the case-insensitive `unique index on (restaurant_id, lower(btrim(name)))`); `menu_items` (`name` non-blank and ≤ 120, `description` ≤ 1000, `price numeric(12,2) not null check (price >= 0)`, `is_available boolean not null default true`, the `image_path` shape check `image_path like 'restaurant/' || restaurant_id::text || '/item/' || id::text || '/%'`, `sort_order`, the composite FK to `menu_categories(restaurant_id, id)`, `unique (restaurant_id, id)`, the partial `unique index on (image_path) where image_path is not null`); `menu_item_extras` (`name` non-blank and ≤ 80, `price_adjustment numeric(12,2) not null default 0 check (price_adjustment >= 0)`, the composite FK to `menu_items(restaurant_id, id)`); `branch_unavailable_items` (`restaurant_id`/`branch_id`/`item_id`, the two composite FKs, `unique (branch_id, item_id)`, `created_at` only — presence is the override). Apply with `npm run db:migrate` — FR-001, FR-005…FR-010, FR-012, FR-013, FR-018, FR-021
- [X] T004 Create `supabase/migrations/<timestamp>_menu_policies.sql` via `supabase migration new menu_policies` (data-model.md policy matrix): `grant select` to `authenticated` on the four new tables and the four select policies in the wrapped `(select …)` initPlan form — `menu_categories`, `menu_items`, `menu_item_extras` use `restaurant_id in (select private.staff_restaurant_ids((select auth.uid())))`; `branch_unavailable_items` uses that arm **and** (`branch_id in (select private.staff_branch_ids((select auth.uid())))` or `restaurant_id in (select private.owned_restaurant_ids((select auth.uid())))`) — the `dining_tables` shape. No existing policy or grant is modified; no write grant is added anywhere. Apply with `npm run db:migrate` — FR-004, FR-024, FR-026; Constitution III/IV
- [X] T005 Create `supabase/migrations/<timestamp>_menu_media.sql` via `supabase migration new menu_media` (contracts/menu-images.md §1–§3; research.md §4, §10, §11): the private bucket row `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('menu-images', 'menu-images', false, 5242880, array['image/jpeg','image/png','image/webp']) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types`, then the four policies on `storage.objects` — `menu_images_staff_select` (the object's `name` equals some `menu_items.image_path` whose `restaurant_id ∈ private.staff_restaurant_ids(auth.uid())`), `menu_images_owner_insert` and `menu_images_owner_delete` (path folder `restaurant/<uuid-shaped restaurant_id>` ∈ `private.owned_restaurant_ids(auth.uid())`, with a text-shape guard before any cast), and **no update policy**. No grants are added to `storage.objects` (the Storage service pre-grants table privileges; research.md §11). Apply with `npm run db:migrate` — FR-021…FR-023
- [X] T006 Create `supabase/migrations/<timestamp>_menu_rpcs.sql` via `supabase migration new menu_rpcs` (contracts/database-functions.md §1–§7; research.md §1): `private.branch_manager_branch_ids(p_user uuid)` (the `branch_manager` membership branches, `stable`, `security definer`, `set search_path = ''`, revoked from public/anon, granted to `authenticated`), then the fifteen `public` functions with their execute grants to `authenticated` only — the fourteen write RPCs (`create_menu_category`, `update_menu_category`, `delete_menu_category`, `reorder_menu_categories`, `create_menu_item`, `update_menu_item`, `move_menu_item`, `reorder_menu_items`, `set_menu_item_availability`, `set_branch_item_availability`, `set_menu_item_image`, `add_menu_item_extra`, `update_menu_item_extra`, `remove_menu_item_extra`) and the read projection `get_branch_menu` (`security invoker`, stable, explicit owner-or-branch-member scope check). Each function: `security definer` (except the projection), `set search_path = ''`, authorization as its first act (`42501`), `P0001` validation messages per contract, constraint violations caught **by constraint name**, `private.record_audit` with the action vocabulary and change strings of data-model.md, and the no-op rule (an unchanged value writes nothing and returns the stored row). `add_menu_item_extra` takes `select … for update` on the item row before enforcing the 20-extras bound. Apply with `npm run db:migrate` — FR-002, FR-003, FR-005…FR-025
- [X] T007 Extend `supabase/seed.sql` (converging, idempotent, deterministic — the T002 constants) and `scripts/db/seed.mjs`'s summary query with the Phase 4 fixture: Blue Olive's 4 categories and 10–12 items with descriptions and two-decimal prices, the two extras sets, the item `is_available = false` **with a Marina override row for it** (the hard stop beating an existing override), the available item with a Marina-only override, and Cedar Grill's own smaller menu; no item image is seeded (research.md §16). Apply with `npm run db:seed` — FR-028, SC-007, data-model.md seed fixture table
- [X] T008 Regenerate the data-access types: `npm run types:gen` → `src/types/database.types.ts` gains the four tables and the fifteen function signatures; the file is committed and never hand-edited (feature 002 FR-016 posture) — FR-029
- [X] T009 Create `tests/database/menu.schema.test.ts` — the declaration-shape suite (feature 002/004 precedent): the four tables' column names, types and nullability in ordinal order exactly per data-model.md; the constraints by name (`menu_categories_restaurant_name_key` case-insensitive uniqueness, `menu_items_category_scope_fkey`, `menu_items_image_path_key` partial uniqueness, `branch_unavailable_items_branch_item_key`, the price/`sort_order`/length checks) exercised by attempting violations in rolled-back transactions; the four policies present with their intended commands; the bucket row's `public = false`, `file_size_limit = 5242880`, `allowed_mime_types` set; and the four `storage.objects` policies present. `npm run test:db` exits 0 — FR-021…FR-023, FR-026
- [X] T010 Create `tests/database/menu.rpc.test.ts` — the shared matrix: authorization for **every** one of the fifteen functions across the role/scope combinations (alice owner, bob branch manager, carla cashier, dan kitchen, eve owner of another restaurant, the platform admin, an unlinked identity — denials `42501`; `set_branch_item_availability` admits bob for Downtown and denies him for Marina and for content; `get_branch_menu` admits owners for any branch and branch-scoped members for their own branch only), the generic validation messages and bounds (blank/over-long names as declared in data-model.md, the 500/1000-char description bounds, a null/negative/three-decimal/over-bound price, extra validation, the image-path grammar mismatch), the category-deletion guard (`23503` → message), the item-move cross-restaurant denial, and the audit basics (one record per accepted change with actor, action, resource, and tenant scope; the branch scope on `menu.branch_availability_changed`; a no-op call writing nothing). Everything in rolled-back transactions; `npm run test:db` exits 0 — FR-002…FR-006, FR-010, FR-012, FR-013, FR-018, FR-024, FR-027

**Checkpoint**: Foundation ready — the menu data layer, the storage surface, and the seeded fixture exist; the schema and authorization matrices are green; user story implementation can begin

---

## Phase 3: User Story 1 — Menu Structure: Categories and Items (Priority: P1) — MVP

**Goal**: The owner builds the restaurant's single shared menu — categories (name, optional description, order) and items (name, description, price, order) — with the never-delete lifecycle (items persist; a category can be removed only while empty), deterministic ordering, and the corrected description/price validation surfaced in the UI.

**Independent Test**: As alice, open `/dashboard/menu`; the seeded menu renders in its stored order with descriptions and two-decimal prices; create a category, create an item in it, edit the item, move it, reorder both levels and reload; a blank or duplicate category name, a blank item name, a negative price and a three-decimal price are each rejected with their message and change nothing; deleting a non-empty category is rejected, and an empty one succeeds; a branch manager, cashier, kitchen member, another restaurant's owner, and the super admin cannot reach or change any of it (spec US1 Independent Test).

### Implementation for User Story 1

- [X] T011 [P] [US1] Create `src/features/menu/money.ts` — `PRICE_PATTERN` (`^\d{1,9}(\.\d{1,2})?$`), `isValidPriceInput`, `canonicalizePrice` (trim, reject, pad to two decimals), `formatPrice`/`formatAdjustment` (display only, `Intl.NumberFormat`, two decimals) — **no arithmetic on amounts** anywhere (research.md §9; contracts/menu-client.md §1)
- [X] T012 [US1] Create `src/features/menu/menuClient.ts` — the typed wrappers over the US1 functions (`create/update/delete/reorder` categories, `create/update/move/reorder` items) with the `42501` → `AuthorizationError` and `P0001` → `ValidationError` mapping that surfaces the server message verbatim; prices are sent as canonical strings (contracts/menu-client.md §1; contracts/database-functions.md §1–§2). Later stories extend this module
- [X] T013 [US1] Create `src/features/menu/useMenu.ts` — `useRestaurantMenu(restaurantId)` reading the four tables under policies, the mutation wrappers, and the invalidation rules (every mutation invalidates `['menu', restaurantId]` including branch projections; no optimistic values for prices or availability) — contracts/menu-client.md §4
- [X] T014 [US1] Create `src/features/menu/components/MenuStructurePanel.tsx` — categories and items: create, rename/describe, edit, move between categories of the same restaurant, reorder by submitting the complete ordered list, delete an empty category; server messages surface next to the control; empty states per contracts/menu-client.md §6
- [X] T015 [US1] Create `src/routes/MenuPage.tsx` and register `/dashboard/menu` in `src/app/router.tsx` under the existing `/dashboard` guard chain with the in-page `canManageRestaurant` gate (non-owners render `NotAuthorized`, not a hidden control); add the owner's "Menu" entry to `src/routes/DashboardPage.tsx` — contracts/menu-client.md §2–§3
- [X] T016 [US1] Create `tests/unit/menu.client.test.ts` — the money rules (valid/invalid inputs, canonicalisation to two decimals, formatting; `12.345` rejected client-side before submit) and the US1 client wrappers' error mapping and result shaping; `npm run test:unit` exits 0 — FR-005, FR-008, FR-010, contracts/menu-client.md §1
- [X] T017 [US1] Extend `tests/database/menu.rpc.test.ts` with the US1 semantics block: category-name uniqueness case-insensitively and after trimming; item names deliberately non-unique across categories; the item identity guarantee across an edit and a move (availability, overrides, extras, and image untouched — asserted over a fixture item carrying all three); category deletion only when empty (rejected with items, accepted after they move); reorder exact-coverage rejection on a partial or duplicated list, and the resulting `sort_order` sequence being exactly the submitted order with the deterministic tiebreak readable through `get_branch_menu`; each accepted change producing its audit action. `npm run test:db` exits 0 — FR-005, FR-006, FR-007, FR-009, FR-024
- [X] T018 [US1] Create `e2e/menu.surfaces.test.ts` — the browser presentation matrix (read-and-reject only, no tenant writes): the owner's `/dashboard/menu` renders the seeded categories and items with their descriptions and two-decimal prices in the stored order, the owner's "Menu" navigation entry is present, and a cashier, kitchen member, other-restaurant owner, and the platform admin reach `NotAuthorized` on the deep link (rejected, not hidden); `npm run test:e2e` exits 0 — FR-001, FR-003, FR-009, SC-002, contracts/menu-client.md §2

**Checkpoint**: User Story 1 is complete — the owner can build and maintain the shared menu structure, and the surface denies everything outside owner scope

---

## Phase 4: User Story 2 — Item Availability and Branch Overrides (Priority: P2)

**Goal**: The restaurant-wide availability state (a hard stop when off) and the one-directional per-branch override, with the branch's customer-visible menu — the exit-condition artifact — computed and read in one call, correct on every load.

**Independent Test**: As alice, mark an item unavailable restaurant-wide while a branch carries an override for it and verify it is unavailable at every branch; clear and set an override while the restaurant-wide state is available and verify only that branch changes; as bob (branch manager, Downtown) toggle Downtown only, and verify his `/dashboard/menu` and Marina's branch view are denied; as a cashier view the branch menu without controls; verify the branch customer view excludes every unoffered item and shows the reason to staff (spec US2 Independent Test).

### Implementation for User Story 2

- [X] T019 [US2] Extend `src/features/menu/menuClient.ts` with the availability wrappers (`setMenuAvailability`, `setBranchItemAvailability` returning whether a change was applied) and `parseBranchMenu(payload)` validating the `get_branch_menu` jsonb into typed structures — rejecting a malformed payload loudly rather than rendering half a menu (contracts/database-functions.md §7; contracts/menu-client.md §1)
- [X] T020 [US2] Extend `src/features/auth/useAuthContext.ts` with two presentation-only predicates: `canViewBranchMenu(branchId)` (owner of the branch's restaurant, or any branch-scoped membership on that branch) and `canManageBranchAvailability(branchId)` (owner, or a `branch_manager` membership on that branch) — contracts/menu-client.md §3
- [X] T021 [US2] Extend `src/features/menu/useMenu.ts` with `useBranchMenu(branchId)` over `get_branch_menu` and the availability mutations' invalidation of every branch projection of the restaurant — contracts/menu-client.md §4
- [X] T022 [US2] Create `src/features/menu/components/AvailabilityControls.tsx` — the restaurant-wide toggle whose confirmation copy states that this stops the item **at every branch** and that branch overrides cannot reverse it, and the per-branch toggle that shows when the override currently has no effect (`unavailable_reason: "restaurant"`) — contracts/menu-client.md §5 flows 6–7
- [X] T023 [US2] Create `src/features/menu/components/BranchMenuPreview.tsx` — renders the projection in the server's order with prices, a **customer-view toggle** hiding `is_offered = false` items, and the staff view showing unoffered items with their reason — contracts/menu-client.md §5 flow 8
- [X] T024 [US2] Create `src/routes/BranchMenuPage.tsx` and register `/dashboard/branches/:branchId/menu` in `src/app/router.tsx` (in-page gates: `canViewBranchMenu` for the route, `canManageBranchAvailability` for the controls); link it from `src/routes/BranchDetailPage.tsx` — contracts/menu-client.md §2
- [X] T025 [US2] Extend `tests/unit/menu.client.test.ts` with the branch-menu parser: valid payloads typed and ordered, malformed payloads rejected (`null` category list, missing item fields, wrong types), and the unoffered-item reason mapping; `npm run test:unit` exits 0 — contracts/menu-client.md §1, §6
- [X] T026 [US2] Extend `tests/database/menu.rpc.test.ts` with the availability semantics block (the phase's core): the hard stop — `is_available = false` makes the item unoffered at **every** branch including Marina, which carries an override row, and the override row survives; override set/clear/no-op behaviour (`true` deletes the row, `false` inserts it, a repeat call writes nothing and returns `false`); cross-branch non-interference; an override on an item that is stopped restaurant-wide changing nothing observable and being cleared normally; the `get_branch_menu` payload shape — ordering at every level, two-decimal price strings, `is_offered` and `unavailable_reason` (`"restaurant"` / `"branch"` / `null`) — and its denials. `npm run test:db` exits 0 — FR-012, FR-013, FR-014, FR-015, FR-024, FR-027, SC-004
- [X] T027 [US2] Extend `e2e/menu.surfaces.test.ts` with the branch view matrix: Downtown and Marina render their menus with the stopped item absent from the customer view on both, the override-hidden item absent at Marina and present at Downtown, bob (branch manager) sees Downtown's availability controls and reaches `NotAuthorized` for Marina's branch menu and for `/dashboard/menu`, and carla (cashier) sees Downtown's menu with no controls; `npm run test:e2e` exits 0 — FR-012…FR-015, SC-004, contracts/menu-client.md §2

**Checkpoint**: User Stories 1 and 2 are complete — the exit condition is demonstrable: the owner maintains the menu, and each branch's customer-visible menu reflects the current saved availability

---

## Phase 5: User Story 3 — Price Changes and History (Priority: P3)

**Goal**: Prices are edited through one surface with exact-amount handling, and every real price change is recorded (actor, time, item, previous and new price, scope) while an unchanged save produces nothing — with no surface ever presenting a later price as an earlier one.

**Independent Test**: As alice, change an item's price through the item editor and verify the new price is what the branch view shows; save the same price again and verify no new audit record exists; attempt a three-decimal and a negative price and verify rejection without altering the stored price; verify a branch manager, cashier, and kitchen member cannot change a price (spec US3 Independent Test).

### Implementation for User Story 3

- [X] T028 [US3] Create `src/features/menu/components/MenuItemEditor.tsx` — one item's details: name, description, and price entered as an exact string validated against `PRICE_PATTERN`, submitted as the canonical two-decimal form; an unchanged save is allowed and must not imply a change occurred; the server's validation message surfaces verbatim; the price field is owner-only (the component is mounted only under the owner gate) — contracts/menu-client.md §5 flows 1–2, FR-010
- [X] T029 [US3] Mount `MenuItemEditor` from the US1 surfaces (`src/routes/MenuPage.tsx` / `src/features/menu/components/MenuStructurePanel.tsx`) so an item is edited in place, and wire its save through the T013 mutation with the standard invalidation — contracts/menu-client.md §2, §4 (depends on T028)
- [X] T030 [US3] Extend `tests/unit/menu.client.test.ts` with the price block: the boundary cases of `PRICE_PATTERN` (zero, one and two decimals, the upper bound `999999999.99`, `9999999999` rejected, `12.345` rejected, `-1` rejected, `' 12.50 '` canonicalised) and the guarantee that no float arithmetic is performed (canonicalisation is string-based, formatting only for display); `npm run test:unit` exits 0 — FR-010, research.md §9
- [X] T031 [US3] Extend `tests/database/menu.rpc.test.ts` with the price-recording block: a real price change writes **exactly one** `menu.item_price_changed` record whose `reason` matches `price: <old> -> <new>` with two-decimal formatting and whose actor, resource, and tenant scope are correct; saving an unchanged price (and an all-fields-unchanged save) writes nothing at all — no audit row, no `updated_at` bump; a name-only change writes `menu.item_updated` instead; a three-decimal price is rejected rather than rounded (`12.345` leaves `12.34`/`12.35` untouched and raises) and a negative price is rejected; a non-owner price change is denied `42501`. `npm run test:db` exits 0 — FR-016, FR-017, FR-024, FR-027, SC-006

**Checkpoint**: User Story 3 is complete — the price surface and the recorded change history exist, and FR-017's guarantees have their evidence in place for feature 008 to build on

---

## Phase 6: User Story 4 — Structured Extras (Priority: P4)

**Goal**: Each item carries its own flat, independently selectable extras (name plus optional non-negative price adjustment), editable and retirable, bounded per item, and never shared between items.

**Independent Test**: As alice, add a free and a paid extra to an item and verify they appear only on that item in the editor and the branch view; attempt a blank name, a negative adjustment, and a 21st extra and verify each rejection with the stored extras unchanged; retire an extra and verify it is gone from the surfaces (spec US4 Independent Test).

### Implementation for User Story 4

- [X] T032 [US4] Create `src/features/menu/components/ExtrasEditor.tsx` — add, edit, and retire an item's extras (name and optional non-negative adjustment, canonical two-decimal string), with the server's bound message surfaced rather than pre-empted by a client counter — contracts/menu-client.md §5 flow 4, FR-018, FR-019
- [X] T033 [US4] Mount `ExtrasEditor` inside `src/features/menu/components/MenuItemEditor.tsx` (US3's surface) so extras are managed per item, wired through the extras wrappers and the standard invalidation — contracts/menu-client.md §2, §4 (depends on T032, T028)
- [X] T034 [US4] Extend `tests/unit/menu.client.test.ts` with the extras block: adjustment validation and canonicalisation (zero valid, negative rejected, three decimals rejected), the wrapper error mapping for the bound message, and the ordering of extras within an item as the payload parser exposes it; `npm run test:unit` exits 0 — FR-018, FR-019
- [X] T035 [US4] Extend `tests/database/menu.rpc.test.ts` with the extras block: an extra belongs to exactly one item (the composite FK makes a cross-item or cross-restaurant reference impossible — asserted by attempt); the 20-extras bound enforced at the boundary (the 20th accepted, the 21st rejected with its message) and serialized by the item-row lock (two concurrent adds cannot exceed it); update and retire produce their audit actions, and a retire leaves the item's other rows untouched; a non-owner is denied. `npm run test:db` exits 0 — FR-018, FR-019, FR-020, FR-024, FR-027
- [X] T036 [US4] Extend `e2e/menu.surfaces.test.ts` with the extras presentation check: the seeded extras appear on their own item in the owner's editor and in the branch view, and the other item shows only its own (read-only, no writes) — FR-018, SC-007

**Checkpoint**: User Story 4 is complete — item-scoped extras exist end to end and their bounds are enforced where they can actually be violated

---

## Phase 7: User Story 5 — Item Images (Priority: P5)

**Goal**: One optional image per item, uploaded to a tenant-scoped private bucket under declarative type/size limits, replaced and removed with the previous object becoming unretrievable the moment the reference moves, and never enumerable or reachable across restaurants.

**Independent Test**: As alice, upload an image to an item and see it render in the editor and the branch view; upload an oversized file and a PDF and verify both rejections leave the item unchanged; replace the image and verify the previous object is no longer retrievable in the same session; remove the image and verify the item stays valid; as eve (another restaurant's owner) and as bob (branch manager), verify upload/read/delete denials (spec US5 Independent Test).

### Implementation for User Story 5

- [X] T037 [US5] Create `src/features/menu/menuImages.ts` — the path builder (`restaurant/<restaurant_id>/item/<item_id>/<uuid>.<ext>`), the client pre-checks (allowed formats, ≤ 5 MiB), the upload → `set_menu_item_image` → best-effort delete-old orchestration, the remove flow, and the signed-URL helper for display (≈ 10-minute TTL, cached in memory for the session) — contracts/menu-images.md §2, §4
- [X] T038 [US5] Create `src/features/menu/components/ItemImageField.tsx` — add, replace, and remove an image with the failing bound named on rejection, the item never showing a broken reference, and the signed-URL rendering path — contracts/menu-images.md §4, FR-021, FR-022
- [X] T039 [US5] Mount `ItemImageField` inside `src/features/menu/components/MenuItemEditor.tsx` (US3's surface), wired through `set_menu_item_image` and the standard invalidation — contracts/menu-client.md §2, §4 (depends on T038, T028)
- [X] T040 [US5] Create `tests/unit/menu.client.test.ts` additions (same file, US5 block): the path builder produces exactly the grammar of `contracts/menu-images.md` §2 for representative ids and extensions (and never a path outside the item's own prefix), the pre-checks accept/reject the boundary cases (a 5 MiB file accepted, 5 MiB + 1 byte and a `application/pdf` rejected before upload), and the orchestration's failure ordering is asserted with a stubbed Storage client (upload failure ⇒ no RPC call; RPC failure ⇒ no local reference kept). `npm run test:unit` exits 0 — FR-021, contracts/menu-images.md §4
- [X] T041 [US5] Extend `tests/database/menu.rpc.test.ts` with the image-reference block: `set_menu_item_image` accepts only the item's own path grammar (a foreign item's path, a foreign restaurant's prefix, a disallowed extension, and an over-long name each rejected `P0001`), returns the **previous** path (null on first set) for the client's cleanup, audits `menu.item_image_changed` with the change string of data-model.md, and treats clearing (null) as a real change; the partial unique index makes two items sharing one object impossible; a non-owner is denied; the SQL-level storage policies refuse an out-of-scope read of `storage.objects` under a simulated identity. `npm run test:db` exits 0 — FR-021…FR-023, FR-024
- [X] T042 [US5] Create `tests/integration/menu.images.test.ts` — the real-API round trip against the live bucket with a real owner session: upload to the owner's prefix succeeds; the referenced object is readable back; an oversized object and a disallowed MIME type are rejected by the bucket's limits (413/400); a second restaurant's owner cannot insert, read, or delete under this prefix (and cannot list the bucket); a branch manager cannot insert; and — the load-bearing assertion — after `set_menu_item_image` moves the reference, the previous object is **no longer retrievable** while the new one is; scratch objects are removed in teardown. `npm run test:integration` exits 0 — FR-021…FR-023, FR-027, SC-002; research.md §14

**Checkpoint**: All five stories are complete — the menu domain is delivered, and the image lifecycle's guarantees are proven against the live Storage service, not just in principle

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, determinism proof, boundary audit, and documentation of everything the stories built

- [X] T043 [P] Extend `docs/development.md`: the Phase 4 suites (what the menu schema and RPC matrices, the storage integration round trip, the unit suites, and the e2e presentation matrix cover), the `menu-images` bucket (configured by migration — never the dashboard), the storage-policy posture (policy-only, no grants added), and the bucket's limits as the authoritative validation point — plan.md Project Structure, research.md §11
- [X] T044 Reset-and-rebuild determinism (quickstart.md §6; feature 002 FR-016 posture): `npm run db:reset` (destructive, development project only) → `npm run db:seed` → `npm run test:db` green, and `npm run types:gen` output byte-identical to the committed `src/types/database.types.ts`; the bucket row is re-created by the migration with its limits intact — SC-007
- [X] T045 Full quality gate from a clean state: `npm run verify` (format:check → lint → typecheck → test:unit → test:db → test:integration → build) **and** `npm run test:e2e` both exit 0 with the extended suites; `package.json` unchanged (no new dependency, no new script) — SC-001…SC-008 evidence (depends on T044)
- [X] T046 [P] Constraint & boundary audit across the Phase 4 diff (`supabase/migrations/`, `supabase/seed.sql`, `scripts/db/seed.mjs`, `src/features/menu/`, `src/features/auth/`, `src/routes/`, `src/app/router.tsx`, the test suites, `docs/development.md`): no service-role or secret keys anywhere (the seed and tests use only `SUPABASE_DB_URL`); no new environment variables; no new dependency; no client write grants on any table and no grants added to `storage.objects`; the bucket stays private and no public-read policy exists; guards and predicates presentation-only (Constitution IV); no item deletion path and no non-empty category deletion; no scope creep (no tax, session, ordering, cart, round, kitchen, cashier, delivery, bill, reporting, realtime, or super-admin work); every spec FR-001–FR-029 and SC-001–SC-008 maps to at least one task — audit record in the Notes section below
- [X] T047 Run the quickstart.md walkthroughs and record the results: Walkthrough A — the owner builds the menu in one session (SC-001), including one real image upload; Walkthrough B — availability, the hard stop, and the override lifecycle with the exit-condition check; Walkthrough C — isolation, read scope, the recorded price change, and image privacy; then restore the development project with `npm run db:reset && npm run db:seed` and append the validation record to `specs/005-menu-management/quickstart.md`
- [X] T048 Final commit and push of all Phase 4 artifacts (the four migrations under `supabase/migrations/`, `supabase/seed.sql` + `scripts/db/seed.mjs`, the `src/features/menu/` module, the route and auth-module edits, regenerated `src/types/database.types.ts`, the test suites, `docs/development.md`, and the spec artifacts) to GitHub `main` — mirrors feature 004 T051 (depends on T045–T047)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 is a gate: if the baseline is not green, stop.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories. T002 (fixtures) may proceed alongside the migration batch T003 → T004 → T005 → T006 (each migration is applied through the canonical workflow before the next is created); T007 (seed) needs T003–T006 applied; T008 (types) needs T003–T006; T009 needs T003–T005; T010 needs T003–T007.
- **US1 (Phase 3)**: Depends on Foundational — T011 ∥ T012 → T013 → T014 → T015; T016 after T011/T012; T017 after T010 (it extends that file); T018 after T015.
- **US2 (Phase 4)**: Depends on Foundational and, for the surfaces, on US1's module and route (T013/T015) — T019 → T021; T020 ∥ T022 ∥ T023 → T024; T025 after T019; T026 after T019 (it exercises the read projection); T027 after T024.
- **US3 (Phase 5)**: Depends on US1's surfaces (T013–T015) — T028 → T029; T030 ∥ T031.
- **US4 (Phase 6)**: Depends on US3's editor surface (T028) — T032 → T033; T034 ∥ T035 ∥ T036.
- **US5 (Phase 7)**: Depends on US3's editor surface (T028) — T037 → T038 → T039; T040 ∥ T041 ∥ T042.
- **Polish (Phase 8)**: Depends on all user stories — T043 ∥ T044 → T045 → T046 ∥ T047 → T048.

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories (MVP).
- **US2 (P2)**: After US1 — its branch projection route lives in US1's feature module and router edit; the availability rules it surfaces are already enforced in the data layer.
- **US3 (P3)**: After US1 — the item editor belongs to the owner's menu page; independent of US2's branch view.
- **US4 (P4)**: After US3 — extras are managed inside the item editor US3 creates.
- **US5 (P5)**: After US3 — the image field is mounted in the same item editor; independent of US2 and US4.

### Within Each User Story

- Migrations only via `supabase migration new <name>` and `npm run db:migrate`; seed only via `npm run db:seed`; types only via `npm run types:gen` (FR-029). Never edit an applied migration; add a new one
- Client module before pages; pages before the suites that exercise them; each story's suites green before its checkpoint
- Storage changes are migrations: the bucket row and the `storage.objects` policies are never created or edited through the dashboard

### Parallel Opportunities

- **Foundational**: T002 (fixtures) may proceed alongside T003–T006; T009 and T010 are two different files.
- **US1**: T011 ∥ T012 (different files, no dependency).
- **US2**: T020 ∥ T022 ∥ T023 (three different files).
- **US3**: T030 ∥ T031 (different files).
- **US4**: T034 ∥ T035 ∥ T036 (different files).
- **US5**: T040 ∥ T041 ∥ T042 (different files).
- **Polish**: T043 ∥ T044; T046 ∥ T047.
- Cross-story: after US1, a second implementer can take US2 while the first completes US3 → US4 → US5.

---

## Parallel Example: User Story 2

```bash
# The predicates, the availability controls, and the preview are independent files:
Task: "Extend src/features/auth/useAuthContext.ts with canViewBranchMenu and canManageBranchAvailability"        # T020
Task: "Create src/features/menu/components/AvailabilityControls.tsx (restaurant-wide stop + branch override)"    # T022
Task: "Create src/features/menu/components/BranchMenuPreview.tsx (projection, customer-view toggle, reasons)"    # T023

# US5's three proof tasks are independent files/areas:
Task: "Extend tests/unit/menu.client.test.ts with the image path/orchestration block"                            # T040
Task: "Extend tests/database/menu.rpc.test.ts with the image-reference and storage-policy block"                 # T041
Task: "Create tests/integration/menu.images.test.ts (real Storage round trip)"                                   # T042
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T010) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T011–T018)
4. **STOP and VALIDATE**: `npm run test:db`, `npm run test:unit`, and `npm run test:e2e` green; walk the owner's menu-building journey as alice
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → the menu data layer, the storage surface, and the seeded fixture exist
2. US1 → the owner maintains the shared menu (MVP — the exit condition's "owner can maintain the menu" half)
3. US2 → availability, overrides, and the branch customer view (the exit condition's second half; **the phase's exit condition is now demonstrable**)
4. US3 → the price-change surface and its recorded history
5. US4 → structured extras
6. US5 → item images with the storage guarantees
7. Polish → determinism proof, full gate, boundary audit, quickstart walkthroughs, commit

### Single-Implementer Order

T001 → T002 ∥ (T003 → T004 → T005 → T006) → T007 → T008 → T009 ∥ T010 → T011 ∥ T012 → T013 → T014 → T015 → T016 ∥ T017 ∥ T018 → T019 → T020 ∥ T021 · T022 ∥ T023 → T024 → T025 ∥ T026 ∥ T027 → T028 → T029 → T030 ∥ T031 → T032 → T033 → T034 ∥ T035 ∥ T036 → T037 → T038 → T039 → T040 ∥ T041 ∥ T042 → T043 ∥ T044 → T045 → T046 ∥ T047 → T048

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Migrations are created only via `supabase migration new <name>` and applied only via `npm run db:migrate`; the seed only via `npm run db:seed`; types only via `npm run types:gen` — the single canonical workflow (FR-029). Storage configuration follows the same rule: the bucket and its policies are migrations, never dashboard edits
- No client write grants exist anywhere (including `storage.objects`): the fourteen `security definer` RPCs are the only write paths and the authorization boundary — guards, predicates, and pages are presentation only (Constitution IV)
- Client-readable surfaces never compute business-critical values: the effective availability is computed once, in `get_branch_menu` (research.md §3), and prices cross the wire as exact strings with no client arithmetic (research.md §9)
- The e2e suite is read-and-reject only: it creates no tenant data. The image flow is therefore proven by the integration round trip and the quickstart upload, not in the browser suite (research.md §14)
- Audit records are produced by `private.record_audit` inside the RPCs and are write-only for clients this phase (FR-024); the suites assert them through the database connection, never through a client path
- No new dependency, no new environment variable, no service-role or secret keys anywhere; the seed writes to the database only, so no image is seeded (research.md §16)
- The preliminary `checklists/security-and-data-integrity.md` review items are reviewer-owned; the implementation must not mark them. Items CHK033, CHK034, CHK040, CHK041, and CHK044 flag requirements-level questions (out-of-band object deletion, orphan accumulation, the reorder/creation race, empty states, and SC-008's verification method) — resolve them in the spec as part of T029/T039/T042 work if the reviewer rules they need a spec line
- Commit after each task or logical group; stop at any checkpoint to validate the story independently

### T046 audit record (2026-09-19) — all checks PASS

- **No service-role or secret keys anywhere**: the only `service_role` occurrences are the SQL role name in `scripts/db/reset.mjs`'s default-grant recreation and a comment in `supabase/config.toml`; the seed and tests use only `SUPABASE_DB_URL`.
- **No new environment variables**: `.env.example` has zero diff; the surface remains `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL`.
- **No new dependency**: zero diff on `package.json` / `package-lock.json`; US5 uses only the already-present `@supabase/supabase-js` Storage API.
- **No client write grants**: the only table grants in `supabase/migrations/` are the pre-existing SELECT grants (tenancy, RBAC, hours, menu reads); nothing grants INSERT/UPDATE/DELETE to `anon`/`authenticated` and no grant touches `storage.objects` — the RPCs remain the only write paths (Constitution IV).
- **The bucket is private**: `storage.buckets` insert sets `public = false`; no `public-read` policy exists — all four menu-image policies gate on reference/staff/owner predicates (migration `20260917072213_menu_media.sql`).
- **Guards and predicates presentation-only**: `canManageMenu`/`canViewBranchMenu`/`canManageBranchAvailability` (auth module) and every page/component consume data through `useMenu`/`menuClient` only; no guard writes or pre-empts a server decision (the 20-extras bound is surfaced verbatim from the RPC, never counted client-side).
- **No item deletion path and no non-empty category deletion**: no `delete_menu_item` RPC exists; `delete_menu_category` refuses non-empty categories (its message is asserted in the database suite); the only removal path is `remove_menu_item_extra`.
- **No scope creep**: the Phase 4 diff touches only menu/availability/extras/images + docs/specs; no tax, session, ordering, cart, round, kitchen, cashier, delivery, bill, reporting, realtime, or super-admin code was added.
- **FR/SC traceability**: FR-001–FR-029 and SC-001–SC-008 each map to ≥ 1 task. The two identifiers not literally tagged on a task line are satisfied by construction, not omission: FR-011 (a saved change is immediately customer-visible) is proven by US2's projection tests exercising the same `get_branch_menu` result the saved write feeds (T019/T025/T026/T036, no cache between write and read); SC-003 and SC-005 (100% invalid-input rejection / 100% change propagation) are the aggregate of the tagged per-behavior tasks' exhaustive suites (database 209 tests, unit 154, e2e 40, integration 4) — the 100% claims are verified through those suites rather than by a dedicated task.
- **Quality gate at audit time**: `npm run verify` green (format, lint, typecheck, unit, database, integration, build) + 40/40 e2e.
