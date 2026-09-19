# Feature Specification: Menu Management (Phase 4)

**Feature Branch**: `005-menu-management`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "create specs for phase four" — Phase 4 as defined in `RestoPilot-Master-Plan.md` §15. Goal: create the complete menu management domain. Features — categories; items; descriptions; images; prices; extras; item availability; branch menu behavior; shared restaurant menu; branch override strategy. Availability: each item can be marked available/unavailable by authorized staff. Price handling: price changes must follow the approved pricing policy; the session/order system must not simply read the latest menu price after a session has been established. Exit condition: owner/branch manager can maintain the menu and the customer menu reflects the current published availability. Constrained by the RestoPilot Constitution (especially Principles I–VIII), the master plan's V1 scope (§3.1) and out-of-scope list (§3.2), the menu domain model (§6.3), the Menu Item and Extra entities (§7.6–§7.7), architectural rules (§5), the image and storage strategy (§33), the data-integrity requirements — invalid extras, unavailable item ordering, cross-branch references, stale price (§35), the concurrency requirements (§36), the audit strategy (§37, including price and availability changes), and the performance priorities for menu loading (§26); builds directly on feature 002 (restaurant/branch tenancy, enforced isolation, append-only audit foundation), feature 003 (authenticated staff identities and the role/scope authorization model), and feature 004 (restaurant, branch, tables, staff assignment — the configuration surface the menu hangs off).

## Clarifications

### Session 2026-09-17

- Q: Should a restaurant be able to run more than one menu — for example separate breakfast, lunch, and dinner menus — or is one shared menu per restaurant enough for V1? → A: One shared menu per restaurant — categories and items belong to the restaurant and are shared by all its branches; branch behavior is availability overrides only, and multiple menus remain an additive later change.
- Q: When an item is marked unavailable restaurant-wide, should a branch still be able to override it back to available, or should restaurant-wide unavailability stop the item at every branch until it is made available again? → A: Restaurant-wide unavailability is a hard stop — the item is unavailable at every branch until the restaurant-wide state changes; a branch override can only mark an item unavailable at its own branch while the item is available restaurant-wide.
- Q: Should a branch manager be able to change the restaurant's shared menu — items, descriptions, and prices — or should menu content and prices stay with owners while branch managers only mark items unavailable at their own branch? → A: Owners maintain all menu content and prices and may set or clear any branch's availability; branch managers may set or clear availability for their own branch only and maintain no content or prices.
- Q: Should each restaurant carry its own currency setting so tenants in different countries can use their own, or should the whole V1 platform run in a single currency? → A: One currency for the V1 platform, fixed at deployment; prices are single-currency amounts throughout, and per-restaurant currency remains an additive later change.
- Q: Should an item's extras be a flat list of independently selectable options, or should they be organized into choice groups — for example "choose a size" where exactly one of small, medium, or large must be picked? → A: Flat and independent — each item has a list of extras with a name and an optional price adjustment, any combination (including none) may be selected, and grouped choices, required selections, and minimum/maximum rules remain an additive later change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Menu Structure: Categories and Items (Priority: P1)

The owner builds the restaurant's menu: categories (a name, an optional description, a presentation order) and the items inside them (name, optional description, price, presentation order). The menu belongs to the restaurant and is shared by all of its branches — it is maintained once, not copied per branch. Items are never deleted: an item the restaurant stops selling is made unavailable, and a category can be removed only while it is empty, because items are the anchors that order history will reference.

**Why this priority**: The master plan's §15 lists categories, items, descriptions, and prices as the menu domain's first features, and §6.3 defines the menu as the restaurant-level content domain. Every other story in this phase operates on these records, and the exit condition's "owner/branch manager can maintain the menu" begins here.

**Independent Test**: With the seeded owner, create categories and items with names, descriptions, and prices; reorder categories and items; move an item to another category; attempt invalid inputs (blank names, duplicate category names, malformed or negative prices); attempt deletion of a non-empty category; verify a branch manager, cashier, kitchen member, and another restaurant's staff member are each denied; verify a second restaurant's menu is untouched throughout.

**Acceptance Scenarios**:

1. **Given** a restaurant owner, **When** they create a category and items in it with names, descriptions, and
   prices, **Then** the items belong to that category of that restaurant, the restaurant has exactly one
   shared menu covering all its branches, and no per-branch copies of menu content exist (FR-001).
2. **Given** a restaurant owner, **When** they edit an item's name, description, or price, or move it to
   another category of the same restaurant, **Then** the change persists, the item keeps its identity
   (its availability state and image travel with it), and the change is in effect for customer-facing
   surfaces as soon as it is saved (FR-011).
3. **Given** a restaurant owner, **When** they reorder categories or the items within a category,
   **Then** the new order persists and the menu is presented in that deterministic order everywhere it
   is shown (FR-009).
4. **Given** an attempt to create or rename a category with a blank name or a name already used in this
   restaurant, or to create or edit an item with a blank name, a malformed price, or a negative price,
   **When** it is attempted, **Then** it is rejected with a clear message and no partial record is
   created (FR-005, FR-008, FR-010).
5. **Given** a category that still contains items, **When** its deletion is attempted, **Then** it is
   rejected with a clear message; an empty category can be removed (FR-006).
6. **Given** an item the restaurant no longer sells, **When** the owner stops offering it, **Then** it
   is made unavailable — never deleted — and remains visible to staff with its state (FR-007, FR-012).
7. **Given** a signed-in branch manager, cashier, or kitchen member — or a staff member of another
   restaurant — **When** they attempt to change menu content or prices through any access path,
   **Then** the attempt is denied at the trusted data layer, not merely hidden in the interface
   (FR-002, FR-003, FR-004).

---

### User Story 2 - Item Availability and Branch Overrides (Priority: P2)

Each item carries a restaurant-wide availability state — a hard stop when the restaurant marks it unavailable — and any branch can carry its own override that marks the item unavailable at that branch while the item is available restaurant-wide. The availability that matters operationally is the effective availability of the branch. Owners maintain the restaurant-wide state and any branch's override; branch managers maintain their own branch's override and nothing else. Staff can look at a branch's menu exactly as customers will see it, reflecting the current saved availability — the expression, in this phase, of the exit condition's "the customer menu reflects the current published availability".

**Why this priority**: §15 gives availability its own subsection ("each item can be marked available/unavailable by authorized staff") and the exit condition's second half is about the customer menu reflecting it; §35's integrity rules ("unavailable item ordering", "cross-branch references") make the effective availability a correctness-critical value that must exist before ordering does. It depends on items existing (User Story 1), hence P2.

**Independent Test**: With a seeded owner, create items, mark one unavailable restaurant-wide and another unavailable at a single branch; verify the effective availability of each branch (including that a branch override cannot revive a restaurant-wide stop, and that clearing an override returns the branch to the restaurant-wide state); verify a branch manager can change only their own branch; verify the branch's customer-visible menu reflects each saved change on the next load; verify the audit records.

**Acceptance Scenarios**:

1. **Given** a restaurant owner and a branch that carries its own override for an item, **When** the owner
   marks the item unavailable restaurant-wide, **Then** the item is unavailable at every branch — the
   restaurant-wide stop is a hard stop that the branch's override cannot reverse — and it remains visible
   to staff with its state (FR-012, FR-013).
2. **Given** a branch of the restaurant and an item that is available restaurant-wide, **When** an
   availability override is set for that item on that branch, **Then** the item becomes unavailable at that
   branch — and only there — while its restaurant-wide state is unchanged (FR-013).
3. **Given** a branch carrying an override for an item, **When** the override is cleared, **Then** the
   branch returns to the restaurant-wide state for that item (FR-013).
4. **Given** a signed-in branch manager, **When** they set or clear availability for their own branch,
   **Then** it succeeds within their branch scope; **When** they attempt an override on another branch,
   or any menu content or price change, **Then** the attempt is denied at the trusted data layer
   (FR-003).
5. **Given** a saved availability change, **When** the branch's customer-visible menu — the staff preview
   now, the public customer route in a later feature — is loaded, **Then** it reflects the current saved
   effective availability, and an unavailable item is not offered or orderable (FR-014, FR-015).
6. **Given** a kitchen member, **When** they attempt any availability change, **Then** the attempt is
   denied — kitchen staff manage no availability in V1 (FR-003; master plan §19).
7. **Given** any availability change (restaurant-wide or per branch), **When** it completes, **Then** an
   audit record exists with the actor, the time, the item, the scope (restaurant or branch), and the
   previous and new state (FR-024).

---

### User Story 3 - Price Changes and History (Priority: P3)

Prices are edited over time, and the platform keeps those changes explicit and recorded — who changed which item's price, when, from what to what, and within which scope. The essential promise is that history is never rewritten: changing a price does not alter an order that was already submitted or a price already agreed inside an open session. The session price-lock policy that governs an in-flight session belongs to the ordering feature (feature `008-cart-and-rounds`); this phase delivers the recorded price history that policy consumes, and never presents the current menu price as the price of something that happened earlier.

**Why this priority**: §15's "Price handling" subsection requires that price changes follow the approved pricing policy and that the session/order system must not simply read the latest menu price once a session exists; §35 lists "stale price" as a data-integrity rule and §47 lists "price/tax drift" as a named project risk whose mitigation is preserving the required records. Because the session and ordering features are built on top of this phase, the price history must exist before them, hence P3.

**Independent Test**: With the seeded owner, change an item's price and verify the recorded change (actor, time, previous and new price, scope); verify an order record created at the earlier price still reports that price; verify a branch manager, cashier, or kitchen member cannot change a price; verify that amounts remain exact across repeated price changes.

**Acceptance Scenarios**:

1. **Given** a restaurant owner, **When** they change an item's price, **Then** the new price applies to
   subsequent customer activity and the change exists as a recorded, append-only price change carrying
   the actor, the time, the item, the previous price, the new price, and the tenant scope (FR-016).
2. **Given** an order submitted before a price change, **When** the price later changes, **Then** the
   order's recorded price is unchanged, and surfaces that present historical orders never show the newer
   menu price as theirs (FR-017).
3. **Given an open session that began before a price change** (feature `007-customer-access-and-session`)
   **When** items are added afterwards, **Then** the price applied follows the session price-lock policy
   of feature `008-cart-and-rounds`, which the recorded price history of FR-016 must support (FR-017).
4. **Given** a signed-in branch manager, cashier, or kitchen member, **When** they attempt a price change,
   **Then** the attempt is denied at the trusted data layer (FR-003).
5. **Given** item prices, **When** they are entered and presented, **Then** amounts are exact and do not
   drift under repeated edits, and a rejected price leaves the stored price unchanged (FR-010).
6. **Given** the menu's prices, **When** they are presented anywhere in this phase, **Then** they are the
   item's base amount before tax; tax lines, tax-inclusive display, and tax totals belong to feature
   `006-tax-engine` (FR-010).

---

### User Story 4 - Structured Extras (Priority: P4)

Each item can carry its own set of structured extras — selectable values such as "Extra cheese" or "Large size", each with a name and an optional price adjustment. Extras are choices, never free text typed by a customer. Each extra belongs to exactly one item, so the selection offered with an item is always exactly that item's extras. Extras can be edited and retired as the menu evolves, without touching what was already ordered.

**Why this priority**: §15 lists extras among the menu features and §7.7 defines the Extra entity as "a structured option attached to an item … selectable values, not arbitrary customer-written text"; §35's "invalid extras" integrity rule ("an extra must belong to the selected item") can only be enforced once item-scoped extras exist authoritatively. It builds on items (User Story 1) and, being orderable content, sits alongside availability and pricing; it is P4 because the phase's exit condition does not depend on it.

**Independent Test**: With the seeded owner, add extras — with and without a price adjustment — to two different items; verify each item shows only its own extras; verify invalid extras are rejected; edit an extra's name and adjustment and verify the change; retire an extra and verify it is no longer offered while a previously submitted order keeps its recorded selection; verify non-owners are denied.

**Acceptance Scenarios**:

1. **Given** a restaurant owner, **When** they add an extra with a name and an optional price adjustment to
   an item, **Then** the extra belongs to exactly that item and is offered wherever that item is offered
   (FR-018).
2. **Given** two items each carrying extras, **When** either item is presented, **Then** only its own
   extras appear — no other item's extras, and no extras shared between items (FR-018).
3. **Given** an item being ordered, **When** extras are selected, **Then** the selection is limited to
   that item's defined extras; a value that is not one of the item's extras is rejected (FR-018, §35).
4. **Given** an attempt to save an extra with a blank name, a negative adjustment, a malformed amount,
   or beyond the item's bounded extras list, **When** it is attempted, **Then** it is rejected with a
   clear message and no partial record is created (FR-019).
5. **Given** an extra that is no longer offered, **When** it is retired from its item, **Then** new
   selections can no longer include it while previously submitted orders keep their recorded selections
   and prices (FR-020).
6. **Given** a signed-in branch manager, cashier, kitchen member, or another restaurant's staff member,
   **When** they attempt to manage extras, **Then** the attempt is denied (FR-002, FR-003, FR-004).

---

### User Story 5 - Item Images (Priority: P5)

Each item can present one image. The owner uploads an image, replaces it when the dish's presentation changes, or removes it; only ordinary web image formats within a bounded size are accepted; a rejected upload leaves the item exactly as it was; and replacing or removing an image does not leave the old file retrievable or the item referencing a file that no longer exists. Images stay inside the restaurant's own data: another restaurant's images are neither reachable nor enumerable.

**Why this priority**: §15 lists images among the menu features, §7.6 gives the menu item an optional image, and §33 assigns menu image storage to the menu feature plan with tenant-scoped paths, controlled permissions and access, cleanup of replaced images, and file-type/size validation. Images are presentation-only — nothing in the exit condition depends on them — so they are P5.

**Independent Test**: With the seeded owner, upload an image to an item, replace it, and remove it; verify only the current image is retrievable at each step; verify an unsupported file type and an oversized file are rejected with the item unchanged; verify another restaurant's image is unreachable; verify non-owners are denied.

**Acceptance Scenarios**:

1. **Given** a restaurant owner, **When** they add an image to an item, **Then** the item presents that
   image wherever the item is presented, and the item never references more than one image (FR-021).
2. **Given** an item that already has an image, **When** a new image is uploaded, **Then** the item
   presents the new image and the previous file is no longer retrievable (FR-022).
3. **Given** a file of an unsupported type or beyond the documented size bound, **When** it is uploaded,
   **Then** it is rejected with a clear message and the item keeps its previous state — image or none
   (FR-021).
4. **Given** an item whose image is removed, **When** the removal completes, **Then** the item remains
   valid and presentable without an image, and the removed file is no longer retrievable (FR-022).
5. **Given** another restaurant's image, **When** it is requested by an unauthorized actor through any
   path, **Then** it is not retrievable, and images cannot be listed or enumerated across restaurants
   (FR-023).
6. **Given** a signed-in branch manager, cashier, kitchen member, or another restaurant's staff member,
   **When** they attempt to add, replace, or remove an item image, **Then** the attempt is denied at the
   trusted data layer (FR-003).

---

### Edge Cases

- What happens when the restaurant marks an item unavailable everywhere while a branch carries its own
  override for it? The restaurant-wide stop wins: the item is unavailable at every branch, and the branch's
  override stays recorded but has no effect until the item is available restaurant-wide again (FR-012,
  FR-013). The everyday direction — available restaurant-wide, unavailable at one branch — works through
  the override as expected.
- What happens when a branch has no override for an item? Its effective availability is the
  restaurant-wide state (FR-013).
- What happens when an override is recorded for an item that is already unavailable restaurant-wide? It
  changes nothing observable — the hard stop applies — and clearing it later returns the branch to the
  restaurant-wide state (FR-013).
- What happens when an item is moved to another category? The item keeps its identity: its availability,
  its branch overrides, its extras, and its image move with it (User Story 1, scenario 2).
- What happens when a category still contains items and must go away? Deletion is rejected; the items are
  first moved or made unavailable (FR-006, FR-007).
- What happens when an item must stop being sold everywhere? It is made unavailable restaurant-wide —
  never deleted — and stays visible to staff with its state (FR-007, FR-012).
- What happens when two categories in the same restaurant would carry the same name? Rejected; category
  names are a single flat list within the restaurant (FR-005). Two items in different categories may share
  a name — item names need not be unique (Assumptions).
- What happens when a price is entered as zero? Zero is a valid, explicit amount (a complimentary item);
  negative or malformed amounts are rejected (FR-010).
- What happens when an item's price changes while a session that already exists is still open? The change
  never rewrites what that session already agreed; the in-flight behavior follows feature
  `008-cart-and-rounds`'s price-lock policy, which the recorded price history supports (FR-017).
- What happens when the same price is saved again (no actual change)? No price change is recorded, because
  no change occurred; a recorded price change always reflects a real before/after difference (FR-016).
- What happens when an extra's price adjustment is zero? A free extra — valid (FR-019).
- What happens when an extra is retired while a customer is browsing the menu? The next menu load no
  longer offers it; already-submitted orders keep what they recorded (FR-020, FR-015).
- What happens when an image replacement fails halfway? The item keeps a single, valid image state —
  either the old image or the new one — never a broken reference (FR-021, Constitution VI).
- What happens when two owners edit the same item, availability, or image concurrently? Each accepted
  change is applied atomically; the final state reflects the accepted writes with no partial or
  contradictory records (FR-025, Constitution VI).
- What happens when a branch manager changes availability while another branch's manager does the same?
  Each change stays inside its own branch; no branch's availability is affected by another's (FR-013,
  feature 002's branch isolation).
- What happens when an item is unavailable at a branch — does its image still exist? Yes; the item and its
  image persist, they are simply not offered through that branch's menu (FR-012, FR-021).
- What happens when a customer screen already displays the menu while availability changes? The saved
  change is reflected on the next menu read in this phase; live propagation to open customer screens is
  delivered by feature `012-realtime-and-notifications`, and no surface may present stale availability as
  current (FR-015).
- What happens when a staff member of another restaurant crafts a direct data request for this
  restaurant's menu, prices, extras, or images? Denied — the isolation categories of features 002/003 are
  re-proven over the new surfaces (FR-004, FR-026).
- What happens when the platform super admin (no restaurant memberships) attempts menu management?
  Denied — the capability grants no tenant access (feature 003 FR-012; feature 004 FR-021 continuity).
- What happens when a menu grows large (hundreds of items across many categories)? Staff menu surfaces
  remain responsive and ordered deterministically; the customer-visible read stays within the phase's
  performance target (FR-009, SC-008).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A restaurant's menu MUST be a single restaurant-level collection of categories and items,
  shared by all of the restaurant's branches; menu content MUST NOT be copied or maintained per branch,
  and every item MUST belong to exactly one category of the same restaurant. An item MUST NOT exist
  outside a category.
- **FR-002**: Every action defined by this phase MUST be authorized at the trusted data layer against the
  acting member's current role and scope (feature 003's authorization model) through every access path;
  requests outside the actor's scope MUST be denied, and interface visibility MUST NOT be treated as the
  authorization boundary (Constitution III/IV; master plan §5.2).
- **FR-003**: This phase's actions MUST be distributed as follows. Owners maintain the restaurant's menu
  content — categories, items, descriptions, prices, extras, images — and may set or clear an availability
  override at any branch of their restaurant. Branch managers may set or clear availability overrides for
  their own branch only; they maintain no menu content and no prices in this phase. Cashiers and kitchen
  staff manage no menu data in this phase: the cashier's availability action arrives with feature
  `009-kitchen-and-cashier-operations`, and kitchen staff never manage availability (master plan §19). No
  actor may act outside their own restaurant or branch scope, and the platform super-admin capability
  grants no menu access (feature 003 FR-012).
- **FR-004**: A restaurant's menu — categories, items, descriptions, prices, extras, images, and
  availability — MUST be readable only by members of that restaurant and by the customer-facing surfaces
  the later features expose; staff members of another restaurant MUST NOT read or change it through any
  access path, and nothing introduced by this phase becomes publicly readable in this phase (feature 002
  FR-008; feature 003 FR-007 continuity).
- **FR-005**: Owners MUST be able to create, rename, describe, and reorder categories of their restaurant.
  A category name MUST be non-blank and MUST be unique within the restaurant, compared case-insensitively
  after trimming; a duplicate or blank name MUST be rejected with a clear message and no partial record.
- **FR-006**: A category MUST be removable only while it contains no items; deletion of a category that
  still contains items MUST be rejected with a clear message. Removing an empty category MUST NOT affect
  any other category, item, or historical record.
- **FR-007**: Owners MUST be able to create items within a category — with a name, an optional
  description, and a price — to edit an item's name, description, and price, and to move an item to
  another category of the same restaurant. Items MUST NOT be deletable: an item that is no longer sold is
  made unavailable (FR-012) and remains visible to staff with its state. An item's identity — and with it
  its availability, overrides, extras, and image — MUST survive editing and moving between categories.
- **FR-008**: Item and category text fields MUST be validated: a name is required and MUST be non-blank
  after trimming; a description is optional and bounded, and a whitespace-only description is treated as
  absent. Invalid input MUST be rejected with a clear message and MUST NOT create or alter a partial
  record.
- **FR-009**: The presentation order of categories and of items within a category MUST be explicit,
  maintainable by owners, and deterministic wherever the menu is presented; ties MUST NOT resolve
  unpredictably.
- **FR-010**: An item's price MUST be a required, exact, non-negative monetary amount within a documented
  upper bound; malformed and negative amounts MUST be rejected without altering the stored price. Monetary
  amounts MUST remain exact and MUST NOT drift under repeated edits. Prices in this phase are the item's
  base amount before tax; tax calculation, tax lines, and tax-inclusive presentation belong to feature
  `006-tax-engine`.
- **FR-011**: A menu change MUST take effect for customer-facing surfaces as soon as it is saved. V1 has
  no draft or publish workflow: "published" means "saved and currently in effect", and a saved change MUST
  NOT require a further action to become visible to customers.
- **FR-012**: Every item MUST carry a restaurant-wide availability state — available or unavailable —
  maintained by the restaurant's owners. An unavailable item MUST NOT be offered or orderable at any branch
  until the restaurant-wide state changes: the restaurant-wide stop is a hard stop that no branch override
  can reverse (FR-013). The item MUST remain visible to staff with its state so the menu can be maintained
  and explained (FR-007).
- **FR-013**: Each branch MAY carry at most one availability override per item, and an override can only
  mark an item unavailable at its own branch. The effective availability of an item at a branch MUST be:
  unavailable while the restaurant-wide state is unavailable — a restaurant-wide stop is a hard stop
  (FR-012) — otherwise unavailable when the branch carries an override, and available when it does not.
  Overrides MUST be settable, changeable, and clearable, and clearing one MUST return the branch to the
  restaurant-wide state. An override MUST NOT modify the restaurant-wide state or any other branch's
  availability (feature 002's branch isolation).
- **FR-014**: Staff MUST be able to view the menu as customers will see it for the branches their scope
  reaches — owners for any branch of their restaurant, branch-scoped members for their own branch — that
  is, the branch's customer-visible menu, reflecting the current saved effective availability and the
  current saved content and prices. This preview is how the exit condition's "the customer menu reflects
  the current published availability" is demonstrated in this phase; the public customer route itself
  arrives with feature `007-customer-access-and-session`.
- **FR-015**: Every read of a branch's customer-visible menu — the staff preview in this phase and the
  public customer surface later — MUST reflect the current saved menu and effective availability on each
  load; a saved change MUST NOT be masked by a stale cached read, and no surface may present unavailable
  items as offered. Live propagation to already-open customer screens belongs to feature
  `012-realtime-and-notifications`.
- **FR-016**: A price change MUST be recorded as an explicit, append-only change capturing the actor, the
  time, the item, the previous price, the new price, and the tenant scope (feature 002 FR-012/FR-013;
  master plan §37). A price MUST change only through such a recorded change, and saving an unchanged price
  MUST NOT produce a recorded change.
- **FR-017**: A price change MUST NOT alter any order that was already submitted or any price already
  agreed inside an existing session: order records retain the price they were created with, and no surface
  may present the current menu price as the price of a completed or in-flight order. The price-lock policy
  for open sessions belongs to feature `008-cart-and-rounds`; this phase MUST preserve the recorded price
  history that policy consumes (FR-016) and MUST NOT publish the latest price as a historical value.
- **FR-018**: Each item MAY carry zero or more structured extras. An extra MUST have a non-blank name and
  MAY have a non-negative exact price adjustment (default: none, meaning a free extra); extras MUST be
  selectable values only — never free-text input — and each extra MUST belong to exactly one item, so the
  selection offered with an item is exactly that item's extras and no other item's. In V1 extras are
  independently selectable and flat: grouped choices, required selections, and minimum/maximum selection
  rules are not part of this phase.
- **FR-019**: Extra input MUST be validated: non-blank name, non-negative exact adjustment, and a bounded
  number of extras per item; invalid input MUST be rejected with a clear message and MUST NOT create or
  alter a partial record.
- **FR-020**: Extras MUST be editable and retirable from their item. A retired extra MUST no longer be
  offered for new selections, while previously submitted orders MUST keep the selections and prices they
  recorded.
- **FR-021**: An item MAY carry at most one image. Uploads MUST be limited to documented, common image
  formats and a documented size bound; a rejected upload MUST leave the item unchanged, and an item MUST
  never reference a broken, missing, or ambiguous image.
- **FR-022**: Replacing or removing an item's image MUST make the previous file no longer retrievable and
  MUST NOT leave the item referencing a file that no longer exists; removing an image MUST leave the item
  valid and presentable without one.
- **FR-023**: Item images MUST be tenant-scoped: they MUST be reachable only through the owning
  restaurant's surfaces, MUST NOT be listable or enumerable across restaurants, and MUST keep the
  deny-by-default posture established in feature 002.
- **FR-024**: Availability changes (restaurant-wide and branch overrides), menu content changes
  (categories, items, descriptions, prices), extra changes, and image changes MUST be recorded in the
  append-only audit foundation with actor, action, resource, change, and tenant scope — branch scope where
  applicable (feature 002 FR-012/FR-013; master plan §37, which names price and availability changes among
  the audited actions). Audit records MUST remain unmodifiable and MUST NOT be readable through
  client-accessible paths in this phase; an audit viewing experience belongs to a later feature.
- **FR-025**: Concurrent menu edits — including simultaneous availability changes and image replacements —
  MUST be applied atomically, and every value MUST remain single-valued and consistent: a final state MUST
  reflect the accepted writes with no partial or contradictory records (Constitution VI).
- **FR-026**: The guarantees of features 002, 003, and 004 MUST remain intact over every surface this phase
  touches: deny-by-default for public and unauthenticated access, tenant and branch isolation, and the
  role/scope authorization model — re-proven over menu content, prices, availability, extras, and images.
- **FR-027**: The project MUST include automated tests proving at least: (a) the authorization matrix over
  this phase's surfaces — denials for unauthorized roles, for out-of-scope branches and restaurants, and
  through direct data access; (b) the validation rules — blank and duplicate category names, blank item
  names, malformed and negative prices, invalid extras, unsupported and oversized images, and category
  deletion while non-empty; (c) effective availability computation, including override set/change/clear and
  non-interference between branches; (d) the audit records of FR-024; (e) the customer-visible read
  reflecting saved availability and prices on the next load; and (f) price history preservation across a
  price change.
- **FR-028**: The development seed MUST provide the fixture needed to demonstrate and test this phase
  without manual setup — the restaurants, branches, and staff identities established in features 002/003
  (extended by feature 004) plus a deterministic demo menu: categories, items with descriptions and prices,
  extras on at least one item, at least one item unavailable restaurant-wide, and at least one item
  available restaurant-wide but unavailable at a single branch — and MUST remain idempotent and
  deterministic. Item images are proven by an automated storage round trip and one upload in the validation
  walkthrough instead of being seeded: the seed writes to the database only, and a seeded image reference
  without its uploaded file would violate FR-021's "never a broken reference".
- **FR-029**: All schema changes for this phase MUST flow through the single canonical migration workflow
  (feature 001 FR-010; feature 002 FR-017; feature 003 FR-023; feature 004 FR-024); generated data-access
  types MUST be regenerated rather than hand-edited, and the existing test tiers MUST be extended rather
  than replaced.

### Key Entities

This phase extends the tenancy model that features 002–004 delivered — it introduces no new tenancy entity
and no new tenancy level. Its new data is restaurant-level menu content, branch-scoped availability state,
and the recorded history price changes require.

- **Menu**: the restaurant's single menu in V1 — the restaurant-level container of its categories and items,
  shared by all of its branches; it is not a stored copy per branch, and branch behavior is expressed
  through availability overrides only.
- **Category**: a named, optionally described, ordered grouping of items belonging to exactly one
  restaurant; removable only while it contains no items.
- **Menu Item**: an orderable product (master plan §7.6) — name, optional description, base price before
  tax, exactly one category, optional image, its own structured extras, and an availability state; never
  deleted, with identity that survives editing and moving between categories.
- **Extra**: a structured selectable option attached to exactly one item (master plan §7.7) — a name and an
  optional non-negative price adjustment; never free-text customer input; retirable without affecting
  recorded history.
- **Item Image**: the item's single optional image — a tenant-scoped file with validated format and size,
  replaced or removed with cleanup of the previous file.
- **Availability State**: an item's restaurant-wide available/unavailable state — a hard stop when
  unavailable — plus zero or one per-branch override, which can mark the item unavailable at that branch
  while it is available restaurant-wide; the effective availability of a branch is the value customers'
  menus and ordering are judged against.
- **Price Change Record**: the append-only record of a price change (actor, time, item, previous and new
  price, tenant scope) built on the audit foundation of feature 002; the price history that feature
  `008-cart-and-rounds`'s session price-lock policy consumes.
- **Customer-Visible Menu (branch view)**: the branch's menu as customers see it — content, prices, and
  effective availability — demonstrable to staff as a preview in this phase and publicly exposed by feature
  `007-customer-access-and-session`.
- **Audit Record** (feature 002, extended): the append-only trace of sensitive actions; this phase adds menu
  content, price, availability, extra, and image changes.

### Out of Scope

The following are explicitly out of scope for Phase 4 and belong to later phases per the master plan's
feature decomposition (§10) and V1 boundary (§3.1–§3.2):

- The public customer menu route and any customer-facing browsing experience — feature
  `007-customer-access-and-session`; this phase delivers the preview that shows staff what customers will
  see (FR-014).
- Taxes: tax rules, tax-inclusive pricing, tax lines, calculation metadata, and rounding — feature
  `006-tax-engine`. Prices in this phase are base amounts before tax (FR-010).
- The session price-lock policy, order/round price snapshots, and the ordering flow itself — features
  `007-customer-access-and-session` and `008-cart-and-rounds`; this phase preserves the price history they
  consume (FR-017).
- Realtime propagation of menu and availability changes to already-open customer screens — feature
  `012-realtime-and-notifications` (master plan §15's "quickly through realtime updates"); this phase
  guarantees current state on each read (FR-015).
- Cashier and kitchen availability operations — feature `009-kitchen-and-cashier-operations`; kitchen staff
  never manage availability (master plan §19), and the cashier's availability action arrives there
  (FR-003).
- Multiple menus per restaurant (for example separate breakfast, lunch, and dinner menus): V1 has one shared
  restaurant menu — confirmed in the clarification session of 2026-09-17 — and multi-menu support would be
  an additive specification change.
- Per-branch price overrides, per-branch menus, and per-branch menu content: V1 branch behavior is
  availability overrides only (FR-013); branch-level pricing is not part of the master plan's V1 scope.
- Time-based or scheduled availability (breakfast-only items, day-of-week availability): V1 availability is
  a manual state (Assumptions).
- Extras beyond flat independent options: choice groups, required selections, minimum/maximum selection
  rules, extras of extras, and customer free-text special instructions (confirmed in the clarification
  session of 2026-09-17; FR-018, master plan §7.7).
- Deleting items, deleting non-empty categories, and any menu archival, versioning, or rollback
  experience (FR-006, FR-007).
- Restaurant brand imagery (logos and other restaurant-level media) — the feature 004 boundary; this phase
  covers item images only.
- Multi-currency pricing and per-restaurant currency settings: V1 operates in a single currency (confirmed
  in the clarification session of 2026-09-17).
- Bulk menu import/export, menu printing, and menu translation (master plan §3.2: no unrequested scope).
- Stock, inventory, and supplier links of any kind — outside the product scope entirely (Constitution I;
  master plan §3.2).
- The audit viewing, search, and retention experience — a later feature (master plan §37); audit records
  are write-only here (FR-024).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner can build a complete menu in one session with no operator intervention — one
  restaurant, six categories, and forty items with descriptions and prices, including extras on at least
  ten items and images on at least ten items — in under 25 minutes.
- **SC-002**: 100% of unauthorized attempts are denied at the trusted data layer — wrong role (branch
  manager acting on menu content or prices, cashier, kitchen, super admin), wrong branch, other restaurant,
  and direct data-access attempts.
- **SC-003**: 100% of invalid inputs are rejected with a clear message and leave no partial or
  contradictory state: blank and duplicate category names, blank item names, malformed and negative prices,
  invalid extras, unsupported and oversized images, and deletion of a non-empty category.
- **SC-004**: 100% of saved availability changes are reflected on the next load of that branch's
  customer-visible menu, and 100% of items unavailable at a branch (by restaurant-wide state or override)
  are absent from what that branch offers; no surface presents a stale availability as current.
- **SC-005**: 100% of menu changes — prices, availability (restaurant-wide and overrides), content, extras,
  and images — exist in the audit store with actor, action, resource, change, and scope.
- **SC-006**: For 100% of orders submitted before a price change, the order's recorded price equals the
  price in effect at submission; no surface presents a later menu price as the price of an earlier order,
  and the price history required by the session price-lock policy is present and complete (0% drift).
- **SC-007**: The seeded development database demonstrates the phase's journey — menu content, extras, a
  restaurant-wide unavailability, and a branch override — with zero manual data setup; the image journey is
  demonstrated by the automated storage round trip and one upload in the walkthrough (FR-028).
- **SC-008**: Staff menu interactions respond within 2 seconds for a realistic menu (up to 200 items across
  15 categories, with images), and the customer-visible menu read of a branch completes within 2 seconds
  under the same conditions (baseline target; tuning beyond it belongs to the performance phase, master
  plan §26).

## Assumptions

- **One shared menu per restaurant in V1**: categories and items belong to the restaurant and are shared by
  all its branches; branch behavior is expressed exclusively through availability overrides. This follows
  §15's "shared restaurant menu; branch override strategy" phrasing and §3.1's V1 scope, which lists menu
  management, categories, items, structured extras, and item availability but no multiple menus. Multiple
  menus and per-branch menu content would be additive later specifications. *(Confirmed in the
  2026-09-17 clarification session.)*
- **Restaurant-wide unavailability is a hard stop**: a branch override can only mark an item unavailable at
  its own branch, so "we ran out here" is recordable without letting a branch revive an item the
  restaurant has stopped selling. This was confirmed in the 2026-09-17 clarification session; it keeps the
  restaurant's stop switch reliable, which matters because customer menus and order validation (§35) read
  this value. *(The alternative reading — the branch override as authoritative in both directions — was
  considered and rejected.)*
- **Role split**: owners maintain menu content, prices, and any branch's overrides; branch managers manage
  their own branch's availability only, consistent with feature 004's boundary (branch managers hold
  read/operational scope and manage no configuration in that phase, "widenable additively in a later
  phase") and with master plan §19, which places the cashier's availability action in the cashier feature
  and forbids kitchen staff from managing availability. §15's exit condition ("owner/branch manager can
  maintain the menu") is read as the pair of roles that keep the menu operationally accurate, not as
  granting branch managers restaurant-wide content or price changes. *(Confirmed in the 2026-09-17
  clarification session; the alternative of branch managers maintaining the shared menu was considered and
  rejected.)*
- **No draft/publish workflow in V1**: "published" in the exit condition means "saved and currently in
  effect"; a saved change is immediately what customers see (FR-011).
- **Prices are tax-exclusive base amounts in a single currency for the V1 deployment**: amounts are exact,
  with no floating-point drift. Multi-currency and per-restaurant currency settings are not part of V1
  (confirmed in the 2026-09-17 clarification session); a restaurant's currency would otherwise be a
  restaurant-level setting, and per-restaurant currency remains an additive later change.
- **A price of zero is valid** when entered explicitly (a complimentary item); negative and malformed
  amounts are not.
- **Category names are unique within a restaurant** (case-insensitive, trimmed) because categories form a
  single flat, human-navigated list; **item names need not be unique**, following feature 002's
  branch-name precedent that display names are not identifiers.
- **Items are never deleted and non-empty categories cannot be deleted**: order history (feature
  `008-cart-and-rounds` onward) anchors to items, so availability — not deletion — is the lifecycle;
  category deletion exists only as a correction affordance for empty categories.
- **Extras are flat and independently selectable**, each belonging to exactly one item; grouped choices,
  required selections, min/max rules, and free-text instructions are not part of V1 (§7.7 defines extras as
  structured selectable values; §3.1 lists "structured extras" without grouping; confirmed in the
  2026-09-17 clarification session). **Extra retirement is
  safe because order records keep their own recorded selections and prices** — a requirement on feature
  `008-cart-and-rounds`'s record design (FR-020).
- **One image per item**, optional, limited to common web image formats within a documented size bound
  (§33 leaves the exact bounds to the plan); a rejected upload never changes the item, and the item never
  presents a broken reference. Restaurant brand imagery remains feature 004's exclusion.
- **Availability is manual, not scheduled**: time-of-day or day-of-week availability is not in V1 and will
  be an additive specification if needed. Working hours (feature 004) are configuration that the later
  customer-access feature interprets; they do not gate menu items in this phase.
- **Customer-facing presentation of an unavailable item** (hidden entirely versus shown as sold out) is
  feature `007-customer-access-and-session`'s presentation decision; this phase guarantees the item is
  neither offered nor orderable at that branch.
- **The public surfaces do not change in this phase**: nothing introduced here is publicly readable; the
  public restaurant entry page (feature 001) and its behavior are untouched (FR-004, FR-026).
- **The tenancy and role model is untouched**: no new tenancy entity, no new role, and no change to the
  staff membership model of features 002–004; menu data hangs off the restaurant with branch-scoped
  overrides only.
- **Audit records remain write-only in this phase** (feature 002 FR-012/FR-013; master plan §37): this phase
  produces menu-operation records; reading, retention, indexing, and presentation arrive with the audit
  feature.
- **The canonical workflow continues**: schema changes flow through migrations, generated data-access types
  are regenerated, the development seed stays idempotent and deterministic, and the existing test tiers
  (unit, data-layer, integration, end-to-end) are extended rather than replaced (FR-029).
