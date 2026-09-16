# Feature Specification: Restaurant and Branch Management (Phase 3)

**Feature Branch**: `004-restaurant-and-branch-management`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Phase 3 — Restaurant and Branch Management" — Phase 3 as defined in `RestoPilot-Master-Plan.md` §14. Goal: let the owner configure the restaurant and its branches. Features — restaurant: restaurant profile, brand information, basic settings; branch: create/edit branch, working hours, branch settings, staff assignment, tables, branch-level configuration; tables: create table, rename/number table, activate/deactivate table, associate table with branch; QR: one restaurant-level QR is the V1 customer entry point (the customer selects the table in the ordering flow). Exit condition: an owner can create a restaurant, branch, tables, and staff and see the correct scoped dashboard. Constrained by the RestoPilot Constitution (especially Principles II–VIII), the master plan's V1 scope (§3.1), architectural rules (§5), domain model direction (§6.1–§6.2, §7.1–§7.2), RLS strategy (§30), data integrity requirements (§35), audit strategy (§37), and UI architecture direction (§38); builds directly on feature 002 (tenancy schema, enforced tenant isolation, audit foundation) and feature 003 (authenticated staff identities, role-aware access boundaries, unified scoped staff area).

## Clarifications

### Session 2026-09-16

- Q: May a restaurant's public identifier be changed after the restaurant is created? (FR-004) → A: Yes — owners may change it after creation; the public entry URL and the QR always encode the current identifier, and after a change the old identifier no longer addresses this restaurant and is not retained or encoded anywhere by the application (owner warned before confirming; no redirect or identifier-alias mechanism, no identifier history).
- Q: Which roles may perform this phase's branch-level and staff management actions — branch creation and editing, working hours, tables, and staff assignment? (FR-006) → A: Owners only — every branch-level and staff action in this phase is owner-only; branch managers keep feature 003's read/operational scope and manage no configuration (widenable additively in a later phase).
- Q: May a branch's working-hours interval run past midnight, for example open 18:00 until 02:00 the next morning? (FR-008) → A: Yes — an interval whose end time is earlier than its start time ends on the following day; only zero-length intervals and same-day overlaps are rejected, and a shared boundary (10:00-14:00 + 14:00-18:00) is touching, not overlapping.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Restaurant Creation and Profile (Priority: P1)

A signed-in staff member creates the restaurant they will operate: the creator becomes its owner, and the restaurant appears in their dashboard under that scope. The owner then maintains the restaurant's profile — display name, customer-facing public identifier, brand information (a public description), and contact information — and its basic settings, including the timezone that anchors the restaurant's working hours. Only the restaurant's owners may change these, and no staff member of another restaurant can read or change them.

**Why this priority**: The master plan's Phase 3 exit condition begins with "An owner can create a restaurant" (§14), and feature 002's data model explicitly reserved restaurant creation and lifecycle for this phase ("restaurant lifecycle is Phase 3"). Every other story in this phase depends on a restaurant existing and being configurable, so this is P1.

**Independent Test**: Using a seeded identity that holds no memberships, create a restaurant and verify the creator holds the owner role for it, the restaurant is reachable in their dashboard, profile/brand/settings edits persist — including a public-identifier change, which is confirmed only after warning that the old identifier no longer addresses this restaurant and is not retained (FR-004) — invalid or duplicate public identifiers are rejected, and a non-owner or another restaurant's staff member cannot read or change it.

**Acceptance Scenarios**:

1. **Given** an authenticated staff member with a linked profile, **When** they create a restaurant with
   a valid display name and public identifier, **Then** the restaurant exists, its creator holds the owner
   role for it, and it appears in their dashboard under their own scope (exit condition).
2. **Given** a restaurant owner, **When** they update the restaurant profile — display name, brand
   description, contact information, or the public identifier — **Then** the changes persist and are
   presented consistently wherever those values appear, and a public-identifier change is confirmed only
   after warning that the old identifier no longer addresses this restaurant and is not retained
   (FR-004).
3. **Given** a restaurant owner, **When** they set the restaurant's timezone, **Then** the setting persists
   and is used as the reference for its branches' working hours (FR-003, FR-008).
4. **Given** a creation or update attempt with a missing required value, a malformed public identifier, or
   a public identifier already in use, **When** it is attempted, **Then** it is rejected with a clear
   message and no partial record is created.
5. **Given** a signed-in branch manager, cashier, or kitchen member, **When** they attempt to change the
   restaurant profile or its settings, **Then** the attempt is denied at the trusted data layer — not
   merely hidden in the interface (FR-005, FR-006).
6. **Given** a staff member of a different restaurant, **When** they request this restaurant's profile or
   settings through any access path, **Then** the request is denied — the tenant boundaries of feature 002
   are unchanged.

---

### User Story 2 - Branch Management and Working Hours (Priority: P2)

Under the restaurant, the owner creates its operational branches and maintains them: each branch belongs to exactly one restaurant, can be renamed, and carries its own weekly working hours — for every day of the week, zero or more open intervals (a day with no intervals reads as closed). Working hours are captured and displayed as authoritative configuration; their use in a customer-facing flow belongs to the feature that consumes them.

**Why this priority**: §14 lists create/edit branch and working hours as the branch capabilities, and the branch is the operational boundary (master plan §7.2) that tables, staff assignments, and later orders are isolated by. Every remaining story in this phase depends on a branch existing, so this is P2 only because the restaurant (User Story 1) must exist first.

**Independent Test**: With a seeded owner, create a branch, rename it, and define a weekly schedule including a split day (for example lunch and dinner), an interval ending after midnight (for example 18:00-02:00), and a closed day; verify persistence, validation rejections, and that a branch-scoped member of another branch cannot reach or change it.

**Acceptance Scenarios**:

1. **Given** a restaurant owner, **When** they create a branch with a name, **Then** the branch belongs to
   exactly one restaurant — theirs — and appears in the dashboard under that restaurant; duplicate display
   names within the restaurant remain allowed (feature 002 FR-002).
2. **Given** a restaurant owner, **When** they rename a branch, **Then** the change persists and the
   branch's identity and everything attached to it are unaffected.
3. **Given** a restaurant owner, **When** they define a branch's working hours as a weekly recurring
   schedule of open intervals per day — including an interval ending after midnight (for example
   18:00-02:00) — **Then** the schedule persists for that branch and is shown in the branch view, and
   days with no intervals read as closed.
4. **Given** a working-hours change with a zero-length interval or two intervals on the same day that
   overlap, **When** it is saved, **Then** it is rejected with a clear message and the stored schedule is
   left unchanged.
5. **Given** a signed-in branch manager, **When** they use the staff area, **Then** they see their own
   branch's configuration and can reach no other branch of the restaurant (feature 003's branch scope).
6. **Given** any attempt to create a branch that would belong to another restaurant, **When** it is
   attempted, **Then** it is rejected — cross-tenant references stay impossible (feature 002 FR-007).

---

### User Story 3 - Table Management (Priority: P3)

The owner maintains each branch's physical tables: creates a table in a chosen branch, renames or renumbers it, deactivates it when it goes out of service, and reactivates it when it returns. Every table always shows which branch it belongs to; labels are unique within a branch. Tables are never deleted — activation state is their lifecycle — so that later phases keep a stable table identity for ordering history.

**Why this priority**: §14 lists the table capabilities (create, rename/number, activate/deactivate, associate with branch) and the exit condition includes tables. Tables are the anchor the customer entry flow selects in later phases (master plan §7.2, §17); this phase delivers the authoritative table inventory and its state. It builds on the branches of User Story 2, hence P3.

**Independent Test**: With a seeded owner and branch, create tables, exercise renaming and the activation transitions, and verify per-branch label uniqueness, cross-branch independence (the same label in another branch remains valid), and denial for unauthorized actors and other branches.

**Acceptance Scenarios**:

1. **Given** a restaurant owner acting on a branch, **When** they create a table with a label,
   **Then** the table belongs to exactly one branch and its label is unique within that branch.
2. **Given** a table, **When** it is renamed or renumbered, **Then** the change persists; a label already
   used in the same branch is rejected, while the same label in a different branch remains allowed
   (feature 002 continuity).
3. **Given** an active table, **When** it is deactivated, **Then** it is recorded as inactive: it stays
   visible to staff with its state and is no longer part of the tables offered to customers (FR-012);
   **When** it is reactivated, **Then** it is active again.
4. **Given** a table whose state was just changed, **When** the same transition is requested again,
   **Then** the recorded state stays consistent — no duplicated or contradictory state (Constitution VI).
5. **Given** a table in another branch, or a restaurant other than the actor's, **When** it is changed
   through any access path, **Then** the attempt is denied (FR-005).
6. **Given** an inactive table, **When** it is renamed, **Then** the rename is accepted and the table
   remains inactive.

---

### User Story 4 - Staff Assignment (Priority: P4)

The owner builds the restaurant's team: adds a person by email address and display name with exactly one role — owner, branch manager, cashier, or kitchen — and, for the three branch-scoped roles, exactly one branch of this restaurant. The added person gains sign-in access with exactly that scope and lands in a dashboard that reflects it. The owner can later change a person's role or branch, or remove their access; the restaurant always keeps at least one owner; and every access-control change leaves an audit record.

**Why this priority**: §14 lists staff assignment under branch management, the exit condition includes staff creation, and features 002 and 003 explicitly deferred this work to Phase 3 — feature 002 deferred the "always at least one owner" rule, and feature 003 deferred staff account creation, invitation, and membership management. The exit condition's "see the correct scoped dashboard" is demonstrated by a newly added person signing in and seeing exactly their scope. It follows the stories it depends on (restaurant, branches), hence P4.

**Independent Test**: As an owner, add a person for each role; sign in as each added person and verify the scoped dashboard; change a role or branch and verify effective access changes on the next access; remove a membership and verify access ends while the person persists; attempt to remove or demote the last owner and verify rejection; verify the audit records.

**Acceptance Scenarios**:

1. **Given** a restaurant owner, **When** they add a person with an email address, display name, a role,
   and — for a branch-scoped role — a branch of this restaurant, **Then** the person gains working
   sign-in access with exactly that membership and appears in the restaurant's staff list.
2. **Given** a person just added by the owner, **When** they sign in, **Then** they reach the staff area
   with exactly their assigned scope — branch-scoped roles reach only their assigned branch — and the
   dashboard they see is correct for that scope (exit condition).
3. **Given** an existing member, **When** the owner changes their role or branch, **Then** their effective
   access follows the new membership on their next access, with no other account change (feature 003
   FR-006).
4. **Given** an existing member, **When** the owner removes their membership, **Then** access to that
   restaurant ends immediately, while the person's profile and sign-in identity persist so they can be
   re-added without recreating the person.
5. **Given** the restaurant's last remaining owner, **When** removal or demotion of that owner is
   attempted, **Then** it is rejected with a clear message — a restaurant always keeps at least one owner
   (feature 002's deferred rule, delivered here).
6. **Given** an email address that already belongs to a person on the platform, **When** the owner adds
   that person, **Then** the existing person is linked and gains the membership — no duplicate person is
   created — and the multi-membership rules of feature 002 are preserved.
7. **Given** a signed-in branch manager, cashier, or kitchen member — or any other actor who is not an
   owner — **When** they attempt to add, change, or remove staff assignments, **Then** the attempt is
   denied at the trusted data layer.
8. **Given** any of the changes above, **When** it completes, **Then** an audit record exists capturing
   who acted, what was done, on which resource, and within which tenant scope (FR-020).

---

### User Story 5 - Restaurant-Level QR Entry Point (Priority: P5)

The owner obtains the restaurant's V1 customer entry point: one QR code for the restaurant that encodes the restaurant's public entry URL and can be viewed and downloaded for printing. Scanning it opens that restaurant's public entry page; the customer then selects the table in the ordering flow, which is a later feature. The QR is restaurant-level by design: it encodes no branch and no table, and dynamic (per-table) QR codes remain outside the V1 scope.

**Why this priority**: §14 lists the QR as the V1 customer entry point and the master plan's customer flow begins with "Restaurant QR / public restaurant route" (§17), while §3.1 includes "restaurant-level QR" in the V1 scope and §3.2 excludes dynamic QR. It is P5 because it depends on the restaurant's public identifier (User Story 1) but blocks nothing else in this phase.

**Independent Test**: As an owner, obtain the QR; decode it and verify it resolves to the restaurant's current public entry URL; verify a non-owner cannot obtain it from the dashboard; verify the artifact keeps the same target across downloads while the identifier is unchanged, and that after an identifier change a newly obtained QR encodes the new URL (FR-004).

**Acceptance Scenarios**:

1. **Given** a restaurant owner, **When** they open the restaurant's entry point in the dashboard, **Then**
   they obtain one QR code for the restaurant encoding its public entry URL, downloadable for printing
   (FR-018).
2. **Given** the obtained QR artifact, **When** it is decoded, **Then** it resolves to that restaurant's
   public entry page and carries no branch or table information — the customer selects the table in the
   ordering flow, which is out of scope here.
3. **Given** a signed-in actor who is not an owner of the restaurant, **When** they attempt to obtain the
   restaurant's QR from the dashboard, **Then** the attempt is denied.
4. **Given** the restaurant's public identifier is unchanged, **When** the QR is obtained again, **Then**
   it encodes the same target (the artifact is stable for printing).
5. **Given** a restaurant owner, **When** they change the restaurant's public identifier (FR-004),
   **Then** the owner is warned that the old identifier no longer addresses this restaurant and is not
   retained or encoded anywhere (no alias, no redirect), and the QR obtained thereafter encodes the
   new public entry URL.
6. **Given** the restaurant's public entry point, **When** configuration data is changed anywhere in this
   phase, **Then** nothing beyond the restaurant's public entry surface becomes publicly accessible
   (FR-019).

---

### Edge Cases

- What happens when two restaurants choose the same public identifier? Rejected by the existing global
  uniqueness rule (feature 002); creation or change fails with a clear message and no partial record.
- What happens when a branch has no working hours configured? The branch reads as "no hours configured";
  what a customer-facing flow does with that state belongs to the customer-access feature (Assumptions).
- What happens when a branch's service runs past midnight? The interval's end time is earlier than its
  start time and means the following day (for example 18:00-02:00); it is stored as one interval under
  the day it starts on (FR-008).
- What happens when working hours are entered as a zero-length interval, or with overlapping intervals
  on the same day? Rejected; the stored schedule is left unchanged (User Story 2, scenario 4).
- What happens when a table label duplicates another table's label in the same branch? Rejected; the same
  label in a different branch remains allowed (feature 002 continuity).
- What happens when a table is deactivated while already inactive (or activated while already active)?
  The recorded state stays consistent — the transition changes nothing (Constitution VI).
- What happens when a table must stop being used? It is deactivated, never deleted; inactive tables
  remain visible to staff and are excluded from the tables offered to customers (FR-011/FR-012).
- What happens when the restaurant's last owner is removed or demoted? Rejected — the restaurant always
  keeps at least one owner (User Story 4, scenario 5).
- What happens when the same person is added to one restaurant twice with the same role and branch?
  Rejected as an exact duplicate (feature 002's uniqueness rule); a distinct role or branch remains a
  valid additional membership.
- What happens when a branch-scoped role is submitted without a branch (or an owner role with one)?
  Rejected — the role/branch relationship stays consistent (feature 002's rule); no partial membership is
  created.
- What happens when a required name or label is empty or only whitespace? Rejected with a clear message
  (restaurant, branch, table, and person records alike); nothing is created.
- What happens when a person is added with an email address that already has a platform identity? The
  existing person is linked and gains the membership; no duplicate person is created (FR-014).
- What happens when a membership is changed or removed while the affected person is signed in? Their
  effective access follows their current memberships on their next access (feature 003 FR-006).
- What happens when a non-owner — branch manager, cashier, or kitchen member — attempts a management
  action covered by this phase? Denied at the trusted data layer regardless of the access path
  (FR-005/FR-006; Constitution IV).
- What happens when a staff member of another restaurant crafts a direct data request for this
  restaurant's configuration? Denied — the tenant-isolation categories of features 002/003 are re-proven
  over the new surfaces (FR-022).
- What happens when two owners edit the same branch, table, or profile concurrently? Each accepted change
  is applied atomically; the final state reflects the accepted writes with no partial or contradictory
  records (Constitution VI).
- What happens when the platform super admin (no restaurant memberships) attempts restaurant management?
  Denied — the capability grants no tenant access (FR-021; feature 003 FR-012).
- What happens when a restaurant needs a corrected public identifier (for example a typo) after its QR
  has been printed? The owner may change it; the owner is warned that the old identifier no longer
  addresses this restaurant and is not retained or encoded anywhere (no alias, no redirect, no
  history), and the public entry URL and a re-downloaded QR encode the new identifier. How an old
  printed code or shared link then resolves is the public route's semantics — feature 001's placeholder
  and feature `007-customer-access-and-session` — not this phase's guarantee (FR-004).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A staff member with a linked profile MUST be able to create a restaurant, including its
  required identifying information; on creation its creator MUST hold the owner role for that restaurant,
  and the restaurant MUST appear in the creator's dashboard under that scope. Creation with missing
  required information, a malformed public identifier, or a public identifier already in use MUST be
  rejected without creating a partial record.
- **FR-002**: A restaurant's owners MUST be able to maintain the restaurant profile: display name, public
  identifier, brand information (a public-facing description), and contact information. Brand
  imagery (logos and other uploaded media) is not part of this phase (see Out of Scope).
- **FR-003**: A restaurant's owners MUST be able to maintain the restaurant's basic settings, which MUST
  include the restaurant's timezone — the reference that gives its branches' working hours their meaning.
- **FR-004**: A restaurant's owners MUST be able to change the public identifier after the restaurant is
  created; a change MUST be rejected if the identifier is malformed or already in use (FR-001). The
  restaurant's public entry URL and the restaurant-level QR always encode the current identifier: after
  a change, the old identifier no longer addresses this restaurant, and the application retains or
  encodes it nowhere — no alias, no redirect, no identifier history. Before a change is confirmed, the
  owner MUST be clearly warned of this consequence, and the QR MUST remain obtainable for re-download
  encoding the new URL. Public-URL resolution semantics — what a previously printed QR code or shared
  link resolves to, and the immediate reuse of a released identifier — belong to the customer-facing
  feature `007-customer-access-and-session` and the feature-001 placeholder route, not to this phase.
- **FR-005**: Every management action defined by this phase MUST be authorized at the trusted data layer
  against the acting member's current roles and scope (feature 003's authorization model), through every
  access path; requests outside the actor's scope MUST be denied, and interface visibility MUST NOT be
  treated as the authorization boundary (Constitution III/IV; master plan §5.2).
- **FR-006**: This phase's management actions MUST be performed by the restaurant's owners only —
  restaurant profile and settings (FR-002/FR-003), branch creation and editing, working hours, tables,
  and staff assignment. Branch managers, cashiers, and kitchen staff MUST NOT manage configuration in
  this phase; branch managers keep their feature 003 read/operational scope. No actor may manage anything
  outside their own scope. Widening management beyond owners belongs to a later phase.
- **FR-007**: The restaurant's owners MUST be able to create branches under the restaurant and edit a
  branch's name. A branch MUST belong to exactly one restaurant; branch display names are not required to
  be unique within the restaurant (feature 002 FR-002 continuity). Deleting branches is not offered in
  this phase (see Out of Scope).
- **FR-008**: Working hours MUST be maintainable per branch as a weekly recurring schedule: for every day
  of the week, zero or more open intervals (for example separate lunch and dinner services). An interval
  whose end time is earlier than its start time ends on the following day (for example 18:00-02:00,
  recorded under the day it starts on) — post-midnight closing hours MUST be representable within a
  single interval. A schedule where an interval is zero-length, or where two intervals on the same day
  overlap, MUST be rejected; intervals that only share a boundary (for example 10:00-14:00 and
  14:00-18:00) are touching, not overlapping. A day with no intervals reads as closed.
- **FR-009**: Working hours MUST be persisted as authoritative business state and presented in the branch
  view; this phase defines and captures them — their enforcement in a customer-facing flow belongs to the
  feature that consumes them (see Assumptions).
- **FR-010**: The restaurant's owners MUST be able to create tables in a chosen branch with a label.
  Every table MUST belong to exactly one branch, and its label MUST be unique within that branch; the same
  label in a different branch MUST remain allowed (feature 002 continuity).
- **FR-011**: The restaurant's owners MUST be able to rename or renumber a table — subject to the
  per-branch label uniqueness — and MUST be able to deactivate and reactivate tables. Activation state
  MUST be explicit persisted state; repeating a transition MUST leave a consistent state; tables MUST NOT
  be deleted in this phase (see Out of Scope).
- **FR-012**: A table's activation state MUST be the authoritative source of whether the table is offered
  to customers; the customer-facing flow that consumes it is delivered by the customer-access feature and
  is out of scope here.
- **FR-013**: The restaurant's owners MUST be able to add a person to the restaurant's staff by email
  address and display name, assigning exactly one role — owner, branch manager, cashier, or kitchen — and,
  for the three branch-scoped roles, exactly one branch of the same restaurant. The added person MUST gain
  sign-in access to the platform with exactly that scope. A person may hold more than one membership
  (feature 002's multi-membership rules); an exact duplicate membership MUST be rejected.
- **FR-014**: Adding a person whose email address already belongs to an existing person on the platform
  MUST link that existing person instead of creating a duplicate; a person's profile and sign-in identity
  MUST persist across membership changes, so access can be re-granted without recreating the person.
- **FR-015**: The restaurant's owners MUST be able to change a membership's role or branch and MUST be
  able to remove a membership. Effective access MUST reflect the person's current memberships on their
  next access, without any other account change (feature 003 FR-006 continuity).
- **FR-016**: Removing or demoting the last owner of a restaurant MUST be rejected: a restaurant always
  keeps at least one owner (feature 002's deferred rule, delivered here).
- **FR-017**: The staff area and the management surfaces of this phase MUST reflect the signed-in
  member's current roles and scope — an owner sees their restaurant(s) and every branch of them, and a
  branch-scoped member sees exactly their assigned branch's scope — and the boundaries established in
  feature 003 MUST remain in force (exit condition: "see the correct scoped dashboard").
- **FR-018**: A restaurant's owner MUST be able to obtain one restaurant-level QR for the restaurant,
  encoding its public entry URL (derived from the restaurant's public identifier), and to download it for
  printing. The artifact always encodes the current identifier's entry URL: after a public-identifier
  change, the QR obtained thereafter encodes the new URL, while the old identifier no longer addresses
  this restaurant and is retained or encoded nowhere by the application (FR-004). The QR MUST NOT encode
  a branch or a table — the customer selects the table in the ordering flow, which is out of scope here
  — and dynamic or per-table QR codes remain outside the V1 scope (master plan §3.2).
- **FR-019**: Obtaining the QR MUST NOT expose tenant configuration data publicly: the public surface
  remains limited to the restaurant's public entry page (feature 001), and all configuration data keeps
  the deny-by-default posture established in features 002 and 003.
- **FR-020**: Staff access-control changes (adding a person, role or branch changes, membership removals)
  and configuration changes (restaurant profile and settings, branches, working hours, tables) MUST be
  recorded in the audit foundation with actor, action, resource, and tenant scope (branch scope where
  applicable); the change/reason field remains optional (feature 002 FR-012). Audit records remain
  append-only and MUST NOT be readable through client-accessible paths in this phase (feature 002
  FR-013); an audit viewing experience belongs to a later feature.
- **FR-021**: The platform super-admin capability MUST NOT grant any restaurant configuration or
  management access in this phase (feature 003 FR-012 continuity); platform-level administration belongs
  to its own feature.
- **FR-022**: The project MUST include automated tests proving at least: (a) the authorization matrix of
  this phase's management surfaces — denials for unauthorized roles, for out-of-scope branches and
  restaurants, and through direct data access; (b) the validation rules — duplicate public identifier,
  duplicate table label within a branch, invalid working hours, the last-owner safeguard, and the
  exact-duplicate membership; (c) a newly added staff member's effective scope after sign-in; and (d) the
  audit records of FR-020.
- **FR-023**: The development seed MUST provide the fixture needed to demonstrate and test this phase
  without manual setup — the restaurants, branches, tables, and staff identities established in features
  002/003, extended with this phase's configuration data — and MUST remain idempotent and deterministic.
- **FR-024**: All schema changes for this phase MUST flow through the single canonical migration workflow
  (feature 001 FR-010; feature 002 FR-017; feature 003 FR-023); no parallel schema-change practice may be
  introduced.
- **FR-025**: The guarantees of features 002 and 003 MUST remain intact over every surface this phase
  touches: deny-by-default for public and unauthenticated access, tenant and branch isolation, and the
  staff-list visibility rules (feature 003 FR-007) unchanged.

### Key Entities

This phase extends the tenancy model that features 002 and 003 delivered — it creates no new core
tenancy entity. The new data it introduces is configuration content (profile, brand information,
settings, working hours, table state) plus the staff-account creation capability feature 003 deferred.

- **Restaurant** (feature 002, extended): the top-level tenant; creatable in this phase, with a profile
  (display name, public identifier, brand description, contact information) and basic settings
  (timezone).
- **Branch** (feature 002, extended): the operational boundary under exactly one restaurant; its name is
  editable, and it carries the branch's working hours.
- **Working Hours**: a branch's weekly recurring schedule — per day of the week, zero or more open
  intervals, where an interval whose end time is earlier than its start time ends on the following day
  (for example 18:00-02:00); a day with no intervals is closed.
- **Dining Table** (feature 002, extended): a physical table belonging to exactly one branch; label
  unique within the branch; explicit active/inactive state; never deleted.
- **Staff Membership** (features 002/003, now managed): binds a person to one restaurant with exactly one
  role (and one branch for branch-scoped roles); this phase adds its management — adding people, changing
  role or branch, removing membership — with the "at least one owner" safeguard.
- **Staff Account / Invitation**: the sign-in identity a person receives when added (the platform
  identity model of feature 003); persists across membership changes.
- **Restaurant QR / Public Entry Point**: the restaurant-level customer entry artifact — one QR encoding
  the restaurant's public entry URL; no branch or table information.
- **Audit Record** (feature 002, first business consumers): the append-only trace of sensitive actions;
  this phase produces its first business-operation records.

### Out of Scope

The following are explicitly out of scope for Phase 3 and belong to later phases per the master plan
(§10, §42) or outside the V1 scope (§3.2):

- Menu management — menus, categories, items, structured extras, availability, item images and image
  storage (master plan §15, feature `005-menu-management`). Brand imagery for the restaurant profile is
  likewise excluded: the master plan assigns image storage to the menu feature plan (§33).
- Tax engine and tax configuration (master plan §16, feature `006-tax-engine`).
- The customer flow after the QR entry point — restaurant page, branch selection, table selection,
  customer name/phone, sessions, and customer identity (master plan §17, feature
  `007-customer-access-and-session`); including dynamic or per-table QR codes (excluded from V1, §3.2).
- Cart and rounds / ordering (master plan §18, feature `008-cart-and-rounds`).
- Kitchen and cashier operations (master plan §19, feature `009-kitchen-and-cashier-operations`).
- Delivery and takeaway (master plan §20, feature `010-delivery-and-takeaway`).
- Bill, void, and audit viewing — retention, indexing, search/filter UI, and audit reads (master plan
  §21 and §37, feature `011-bill-void-and-audit`).
- Realtime delivery (master plan §22, feature `012-realtime-and-notifications`) and reports (master plan
  §23, feature `013-reports`).
- Super-admin platform capabilities, subscription administration, and platform-driven restaurant
  onboarding (master plan §24, feature `014-super-admin-and-subscriptions`).
- Restaurant, branch, and table deletion and archive lifecycles: this phase offers creation, editing, and
  (for tables) activation state only; nothing in this phase removes customer-facing history anchors.
- Branch-level overrides of domains that do not exist yet (menu availability, tax): "branch-level
  configuration" in this phase is realized as branch identity, working hours, tables, and staff
  assignment; domain-specific overrides arrive with their domains.
- Subscription gating of the restaurant's public entry point (master plan §24, feature
  `014-super-admin-and-subscriptions`).

This boundary enforces Constitution Principle VIII (Minimal and Intentional Complexity): Phase 3 delivers
restaurant, branch, table, and staff configuration plus the restaurant-level QR entry point only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner can complete the phase's full setup journey — create a restaurant, add a branch
  with working hours, add tables, add staff, and obtain the QR — in one session with no operator
  intervention; a typical first-time setup (one restaurant, one branch, ten tables, three staff members)
  completes in under 15 minutes.
- **SC-002**: 100% of unauthorized management attempts are denied — wrong role, other restaurant, other
  branch, and direct data-access attempts — with the denial enforced at the trusted data layer in every
  case.
- **SC-003**: 100% of invalid configuration inputs (duplicate public identifier, duplicate table label
  within a branch, invalid working hours, removal or demotion of the last owner, exact-duplicate
  membership) are rejected with a clear message and leave no partial or contradictory state.
- **SC-004**: A person added by an owner can sign in and reaches exactly the assigned scope; 100% of
  their out-of-scope access attempts are denied; role/branch changes take effect on their next access;
  membership removal ends their access immediately.
- **SC-005**: 100% of decodes of the obtained restaurant QR resolve to that restaurant's public entry
  page, and the artifact carries no branch or table information.
- **SC-006**: 100% of the staff access-control changes and configuration changes listed in FR-020 exist
  in the audit store with actor, action, resource, and tenant scope.
- **SC-007**: The seeded development database supports demonstrating the whole setup journey and its
  scoped dashboard with zero manual data setup.

## Assumptions

- **Restaurant creation bootstrap**: any authenticated staff member with a linked profile may create a
  restaurant and becomes its owner; this is the V1 onboarding path for a new tenant (public self-service
  sign-up remains disabled per feature 003 FR-022, and platform-driven onboarding arrives with the
  super-admin/subscriptions feature). The master plan's Phase 3 exit condition requires an owner to be
  able to create a restaurant.
- **Brand information is textual**: display name, public description, contact information. Uploaded brand
  imagery is excluded because the master plan assigns image storage to the menu feature plan (§33) and
  nothing in V1 requires a restaurant logo.
- **Timezone is a restaurant-level basic setting**: one timezone per restaurant (not per branch), which
  gives its branches' working hours their meaning; multi-timezone chains are not a V1 requirement.
- **Working hours are captured, not enforced, in this phase**: nothing in the platform consumes them yet;
  the customer-access/session feature defines what "open" means for ordering, including the
  "no hours configured" state.
- **Nothing in this phase deletes**: restaurants and branches are created and edited; tables are
  deactivated and reactivated. Deletion/archival lifecycles arrive with the features that can judge the
  consequences for ordering history.
- **A table's branch is chosen at creation**: a table physically belongs to one branch; moving tables
  between branches is not offered in this phase (the association is established when the table is
  created).
- **Staff invitations**: adding a person creates their sign-in access by email address; the delivery
  mechanism (a platform invitation message, a one-time link shared by the owner, or a temporary
  credential) is chosen by the technical plan within the master plan's rules — in particular no
  privileged credentials may ever reach browser code (§5.5) — and the platform's hosted email rate limits
  are a documented testing consideration (feature 003's precedent).
- **People are matched by email address**: an email already known to the platform links the existing
  person rather than creating a duplicate; identities and profiles persist when memberships are removed
  or changed.
- **Staff lists and profiles keep feature 003's visibility rules**: owners and branch managers of a
  restaurant can read its staff list; cashiers and kitchen staff cannot.
- **Audit records are write-only in this phase**: they land in the append-only foundation (feature 002
  FR-012/FR-013); reading, retention, indexing, and presentation arrive with the audit feature
  (master plan §37).
- **The restaurant's public entry page already exists** (feature 001's public restaurant route, addressed
  by the restaurant's public identifier); this phase provides the QR artifact that targets it, not the
  customer experience behind it.
- **Configuration stays private**: no configuration data introduced by this phase becomes publicly
  readable; only the restaurant's existing public entry surface remains public (FR-019).
- **The canonical workflow continues**: schema changes flow through migrations, generated data-access
  types are regenerated, the development seed stays idempotent and deterministic, and the existing test
  tiers (data-layer, integration, end-to-end) are extended rather than replaced.
