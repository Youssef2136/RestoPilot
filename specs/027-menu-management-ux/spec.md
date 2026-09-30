# Feature Specification: Menu Management UX (Frontend Phase 07)

**Feature Branch**: `027-menu-management-ux`

**Created**: 2026-09-30

**Status**: Draft — clarified by evidence (baseline `8b3a0eb`)

**Input**: Frontend Master Plan §"Frontend Phase 07" — "Make menu maintenance fast and safe for an
owner/manager: categories, items, descriptions, prices, images, structured extras, ordering, and
per-branch availability — including the realtime availability toggles a branch manager uses
mid-service."

**Authorities**: RestoPilot-Frontend-Master-Plan.md §"Frontend Phase 07" (FR-01…FR-09); frozen
contracts — the menu RPC set (`create_menu_category`, `update_menu_category`, `delete_menu_category`,
`reorder_menu_categories`, `create_menu_item`, `update_menu_item`, `move_menu_item`,
`reorder_menu_items`, `add_menu_item_extra`, `update_menu_item_extra`, `remove_menu_item_extra`
[20-extras ceiling], `set_menu_item_image` [previous-path return], `set_menu_item_availability`,
`set_branch_item_availability`, `get_branch_menu`), the private `menu-images` bucket (5 MiB,
JPEG/PNG/WebP, grammar `restaurant/<restaurantId>/item/<itemId>/<uuid>.<ext>`), the
`branch_unavailable_items` realtime table; `docs/frontend-presentation-contracts.md` (menu
anchors — h1 'Menu', 'Marina menu'/'Downtown menu', 'Add a category' h3, the Mains/Starters
regions, '(stopped restaurant-wide)'/'(unavailable at this branch)' reasons, the 'Customer view'
toggle, 'Edit Hummus', 'Extras for Hummus', extra text lines — are asserted); `menu.client.test.ts`
(52 unit tests, UNCHANGED); Constitution IV (RPC = boundary, rejected-not-hidden) and V (the DB
computes effective availability — `get_branch_menu`).

**Existing implementation (INSPECT)**: the write/READ journeys are complete and pinned —
`MenuStructurePanel` (categories CRUD + set-reorder, item create/move/reorder, inline availability,
extras read rows), `MenuItemEditor` (exact-decimal price, extras editor, `ItemImageField`),
`AvailabilityControls` (two-layer toggles with blast-radius copy), `BranchMenuPreview`
(staff/customer views), `useMenu.ts` (one query-key root; `get_branch_menu` is the only
customer-visible projection). **No client or data-layer rewrite is authorized or needed** — this
phase is the management *presentation* re-skin on the phase-06 layout language, plus the
realtime/flow affordances the Master Plan adds (search/filter, delete consequence messaging,
image thumbnails, sticky nav, realtime effect evidence).

## Clarifications (expected questions from the Master Plan — resolved by evidence, 2026-09-30)

- **Q1 Reorder interaction (FR-07: "drag vs explicit move controls")** → **Explicit Move up/down
  buttons (keyboard-native)**, exactly as implemented: every reorder call submits the COMPLETE
  ordered list (the RPC rejects a partial one), buttons disable at the list ends. Drag-and-drop is
  NOT added: no contract benefits it, keyboard equivalence would be an a11y tax, and the frozen
  E2E journeys already exercise the buttons. `Move <name> up/down` accessible names preserved.
- **Q2 Item deletion UX (the Master Plan asks whether deletion exists this phase)** → **Not added**.
  The menu RPC set has no `delete_menu_item` (verified against `supabase/migrations/` — only
  `delete_menu_category`, EMPTY-category-only). The two-layer availability model IS the off switch
  for items (restaurant-wide stop → verbatim blast radius copy); adding a deletion would be an
  unauthorized backend change. Category deletion (empty-only) gains the consequence messaging of
  FR-01: attempt on a non-empty category surfaces the server's refusal verbatim with guidance,
  no confirm dialog exists for it (nothing disappears on refusal) — a destructive-confirm dialog
  applies ONLY when a category can actually vanish (empty), where the action is a single button
  whose refusal path is recoverable (recreate). Documented as the honest consequence boundary.
- **Q3 Mobile editing boundary** → **Read + availability toggles + simple edits on mobile;
  heavy editing deferred**: at <768px the item editor renders its name/description/price fields
  and the availability toggles; the image upload affordance is hidden behind the documented
  capability boundary (CSS-only, same DOM — the 021/026 fallback pattern), guidance text states
  image work needs a wider screen. Item/category creation forms stay reachable (they are the
  "fast" path). Same-DOM media-query discipline (no JS branch).
- **Q4 Image guidance policy (dimensions/aspect)** → **Limits-before-attempt only**: the field
  shows "JPEG, PNG, or WebP; up to 5 MB" BEFORE any upload (existing copy, frozen behavior);
  no dimensions/aspect advice is added — the contract governs type+size only, and the signed-URL
  render (never a broken reference) already degrades any odd aspect gracefully. Thumbnails get a
  fixed aspect box with object-fit cover (presentation, not policy).
- **Q5 Realtime on the management surface** → **The branch menu page subscribes to
  `branch_unavailable_items` invalidation ALREADY (existing binding); phase 07's new requirement
  is that the owner's `/dashboard/menu` structure view ALSO reflects a manager's mid-service
  toggle without manual refresh** — the restaurant menu read joins the same realtime invalidation
  on the branch menu page (both projections under one key root), and the NEW E2E proves the
  customer-visible branch menu changes without refresh (exit criterion). No new channel machinery.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — An owner builds and fixes the menu without breaking history (P1)

The owner lands on `/dashboard/menu`, sees categories/items with thumbnails, prices, availability
and extras at a glance, adds a category and an item inline, fixes a typo in a side-flow editor,
reorders with keyboard buttons, uploads an item image (limits shown first), and every refusal
arrives verbatim next to its control.

**Acceptance scenarios**

1. **Given** the re-skinned structure view, **When** the owner scans a category, **Then** items
   render as rows (name, price, availability pill, thumbnail, extras) in stored order.
2. **Given** a search/filter box, **When** the owner types, **Then** the item list narrows within
   the category regions and states "no matches" when nothing remains (filtered-empty state).
3. **Given** an empty-category delete refused by the server, **When** the refusal lands, **Then**
   the consequence message (server text verbatim) renders next to the control with nothing lost.

### User Story 2 — A manager stops an item mid-service in two taps and guests see it (P1)

Bob opens his branch's menu page, flips one item's branch availability, and the customer-visible
projection (and the customer surface) reflects it without refresh; the effective state per branch
is stated (reason text), never color-only.

**Acceptance scenarios**

1. **Given** the branch menu page, **When** Bob toggles an item off, **Then** the staff preview
   marks it "(unavailable at this branch)" and the Customer view omits it — realtime
   invalidation, no manual refresh (FR-09; the exit criterion).
2. **Given** an item stopped restaurant-wide, **When** its branch toggle is read, **Then** the
   no-effect explanation renders (existing verbatim copy preserved).

### User Story 3 — Staff read the branch menu exactly as guests see it (P2)

Any staff member with branch access opens the branch page; the preview mirrors the customer
payload (descriptions, prices, extras) with the staff-only overlay (reasons) that the Customer
view toggle removes.

**Acceptance scenarios**

1. **Given** the branch page, **When** the preview renders, **Then** category/item/extra lines
   match the seeded customer projection (frozen regions + reason strings preserved).
2. **Given** the Customer view toggle, **When** checked, **Then** exactly the offered subset
   remains (frozen assertions preserved unedited).

### Edge Cases

- 20-extras ceiling refusal renders verbatim (existing behavior; the editor never pre-counts).
- Image upload rejection names the bound (type or size) — copy frozen; a stale `image_path`
  renders the empty state, never a broken `<img>`.
- Malformed branch payload → retry state (MenuPayloadError posture, unchanged).
- Long menus: sticky category nav (management side) keeps navigation available; lists stay dense.
- Empty category, empty search result, empty menu, provider error — the full state matrix from
  the Master Plan, each with a named surface.
- Unsaved-change protection: editors are open-form with explicit Save; navigating mid-edit loses
  nothing server-side (no optimistic writes) — the Create forms clear only on success (existing,
  kept).

## Requirements

- **FR-01** Category list with create/rename/reorder/delete: deleting a NON-empty category is
  refused by the server (`'This category still contains items; move them to another category
  first.'`) — the surface renders that consequence verbatim and nothing disappears; duplicate
  names refused verbatim (`'A category with this name already exists.'`). Reorder via
  keyboard-accessible Move up/down buttons (Q1) submitting the complete list.
- **FR-02** Item list per category with search/filter, price display (exact formatters),
  availability state (pill + reason), image thumbnail (signed-URL placeholder language for
  missing images), extras preview.
- **FR-03** Item editor with validation feedback (PRICE_HINT shape; server refusals verbatim),
  extras management (add/edit/retire, ceiling enforced server-side), image upload with
  limits-before-attempt, signed-URL preview, replace/remove.
- **FR-04** Restaurant-wide availability toggle with the verbatim blast-radius statement (every
  branch; no override can reverse).
- **FR-05** Per-branch availability toggle (manager-scoped) with effective-state clarity
  (restaurant-stop no-effect note preserved verbatim).
- **FR-06** Branch menu preview mirroring the customer payload (`get_branch_menu` — the only
  customer-visible projection, never client-derived).
- **FR-07** Reorder interactions keyboard-accessible (Q1: explicit move buttons; no drag).
- **FR-08** All refusals verbatim, forms preserve input on failure.
- **FR-09** Realtime availability reflected without manual refresh on the branch menu view
  (Q5: owner structure view joins the invalidation; the E2E proves the no-refresh effect).
- **FR-10** (responsive boundary, Q3) Mobile keeps read + toggles + simple edits; image upload
  is the documented deferral; same-DOM CSS fallback.

### UX Requirements

- Menu editing is a flow, not 20 forms: inline create forms, per-item editor in place, no page
  reloads; the phase-06 SectionCard/section-nav language hosts the sections.
- Destructive/refused actions explain consequences (server verbatim; Q2 posture).
- Price entry: single field, exact-decimal shape, formatting feedback (`PRICE_HINT` + current).
- Image upload shows limits BEFORE the attempt (frozen copy).
- Availability toggles state effective state per layer; sticky category nav for long menus.

### Visual Requirements

Dense management list language on 022 tokens only: rows with thumbnails + price column +
status pills (phase-06 StatusPill family for Available/Stopped), editor panel rhythm, extras
rows, image placeholder language, sticky category nav — shared vocabulary with the customer
surfaces (same tokens, different density).

### Responsive Requirements

Desktop: list + editor in place (the editor opens inside the category card). Tablet: same DOM,
tightened spacing. Mobile (<768px): read + availability toggles + simple edits; image upload
deferred behind the documented boundary (Q3); lists fall back to card rows via the
`td[data-label]`/same-DOM pattern where tables are used.

### Accessibility

Reorder without drag-only (buttons); toggles as labelled checkboxes with state text (the
phase's existing labelled pattern, kept); upload control keyboard-operable with its file-input
label; image `alt=""` (decorative — the name carries meaning); errors tied to fields
(Feedback pattern `role="alert"`); table semantics where tables appear (`th scope`); the axe
WCAG 2.2 AA floor on both routes (session-gated pattern).

### State Matrix

Categories: empty / list / busy / refusal. Items: empty category / list / filtered-empty /
missing image / unavailable (both layers) / price invalid. Extras: none / some / ceiling refusal.
Image: none / uploading / uploaded / replace busy / rejection (type/size) / provider error.
Branch view: in-scope / denial / realtime update arriving.

### Security

Owner-only writes gated in-page (`canManageRestaurant`) and re-authorized by RPC; manager writes
limited to their branch availability (`canManageBranchAvailability`); storage client uses only
the publishable key + owner session; object paths never constructed outside `menuImages.ts`;
the branch menu read is the only customer-visible projection (not cached in shared contexts).

### Components

`MenuStructureTree` (re-skinned `MenuStructurePanel`), `CategoryRow`/`MenuItemRow` (dense rows),
`ItemEditorPanel` (existing editor re-skinned), `ExtrasEditor` (re-skinned), `ItemImageField`
(re-skinned with placeholder language), `AvailabilitySwitch` (existing toggles, pill states),
`BranchAvailabilityPanel` (branch page section), `ImagePlaceholder`, `MenuFilter`
(search/filter), `ConfirmDeleteDialog` **not** added (Q2 — no item deletion; category refusal
messaging instead), `ReorderControls` (move buttons).

### Routes

`/dashboard/menu`, `/dashboard/branches/:branchId/menu` — unchanged paths.

### Testing Strategy

- **Unit:** `menu.client.test.ts` (52) passes UNCHANGED (client layer untouched);
  `menu.images` integration unchanged. New presentation pins only if a decision warrants (search
  filter normalization) — kept to the minimum.
- **E2E preserved:** all 13 `menu.surfaces.test.ts` assertions pass WITHOUT edits (frozen).
- **E2E new:** `e2e/menu.management.test.ts` (serial): owner create→edit→extras→image (designed
  minimal JPEG, byte-exact) end-to-end self-cleaning journey (scratch design above); search/filter
  (filtered-empty state); the empty-category deletion consequence verbatim; realtime toggle effect
  (Bob toggles Downtown → the customer-visible branch view changes without refresh — the exit
  criterion); 390px same-DOM fallback; axe on both routes (session-gated pattern).
- **Gates:** `npm run verify` (db reset before verify); `npm run test:e2e` (menu.surfaces +
  new suite + full-journey menu hop); impeccable detect 0.

### Backend impact

**NOT_REQUIRED** — the full menu RPC set, `get_branch_menu`, the `menu-images` bucket, and the
`branch_unavailable_items` realtime binding exist and are consumed as-is.

### Scratch-data design (the deletion constraint, resolved — final)

`delete_menu_item` does not exist (Q2): a scratch ITEM cannot be deleted, and a non-empty scratch
CATEGORY cannot be deleted either. Therefore the new E2E's write journey is **idempotent-by-reuse
with legal cleanup only**:

1. The suite creates (first run) or finds (later runs) a scratch category named `E2E Scratch Menu`
   (duplicate names refused verbatim → the refusal path is itself exercised for free).
2. Inside it, one scratch item `Scratch Item <run-id>` is created per run (items are NOT unique,
   so no collision). Edits, extras (add/retire — removal IS legal), image upload/replace/remove
   (remove IS legal), and availability toggles run against it.
3. Cleanup: the item's extras are retired, its image removed, and it is stopped restaurant-wide
   (availability = the legal off switch) — the item row remains, contract-true (recorded-history
   safety), and is inert: never offered anywhere.
4. Search/filter assertions run on the STABLE seeded menu (Hummus etc.), not on scratch rows, so
   they are unaffected by accumulation.
5. `menu.surfaces` pins Blue Olive's seeded categories in stored order (`Starters` first); the
   scratch category appends LAST, and every scratch name is prefixed `Scratch ` / `E2E Scratch
   Menu` — outside every pinned text (verified: no E2E pins a category ordering beyond first/last
   or the seeded names).

## Success Criteria

1. An owner builds and edits a category/item with extras and an image end-to-end (exit criterion).
2. A manager toggles branch availability and the customer-visible branch menu changes without
   refresh (exit criterion, E2E-proven).
3. Every existing menu E2E assertion preserved (13/13 unedited) or migrated with a recorded reason.
4. Unit/db suites green UNCHANGED; build passes; impeccable detect 0.
5. `feat(027)` checkpoint after convergence.
