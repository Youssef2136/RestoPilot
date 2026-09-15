# Feature Specification: Database and Multi-Tenancy (Phase 1)

**Feature Branch**: `002-database-and-tenancy`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "create phase 1 specifications" — Phase 1 as defined in RestoPilot-Master-Plan.md §12 (Database and Multi-Tenancy), constrained by the RestoPilot Constitution (especially Principles III, IV, V, VI, and VII), the master plan's domain model direction (§6.1–§6.2, §7.1–§7.2), RLS strategy (§30), data integrity requirements (§35), audit strategy (§37), testing strategy (§40), and feature decomposition (§10).

## Clarifications

### Session 2026-09-15

- Q: Can one person hold staff memberships in more than one restaurant (and multiple branch assignments) at the same time? → A: Allowed — a person may hold multiple memberships across restaurants and/or branches; each membership carries exactly one role (and one branch for branch-scoped roles).
- Q: In Phase 1, should the platform super-admin capability grant any actual cross-tenant data access, or is it modeled in the data only for later phases? → A: Modeled only — the capability exists in the data model, but no cross-tenant access is granted or tested in Phase 1; the deny-by-default posture applies to every access path until Phase 2's role-based authorization.
- Q: May Phase 1's security tests use simulated staff identities at the data layer, or must they exercise real authenticated logins? → A: Simulated — tests set the acting identity directly at the data layer and exercise the real enforcement (no mocking of the protection itself); real login flows arrive with Phase 2 authentication, after which the same isolation suite can be re-run against real logins.
- Q: (Analyze finding F1) May branch-scoped staff read restaurant-scoped records (for example the restaurant record or its staff memberships) in Phase 1? → A: Yes — restaurant-scoped records are readable by all staff of the same restaurant; branch-scoped records are limited to the assigned branch for branch-scoped roles (owners keep every branch of their restaurant, master plan §30); role-specific narrowing is deferred to Phase 2 RBAC.
- Q: (Analyze finding F2) Must branch display names be unique within a restaurant? → A: No — branch display names are not uniqueness-constrained in Phase 1; branch identity is ID-based, with the (restaurant_id, id) composite anchor used for referential integrity.
- Q: (Checklist review CHK013/CHK018) Is the audit change/reason one field or two, and is it required? → A: One optional field on the record; the required write-time context is actor, action, resource, and tenant scope — writes omitting any of those are rejected.
- Q: (Checklist review CHK022/CHK023) Do the acceptance scenarios cover positive within-scope access and the multi-membership case? → A: Added — US2 now includes positive-path scenarios (owner, branch-scoped staff), a multi-restaurant member scenario, and a modeled-only super-admin posture scenario.
- Q: (Checklist review CHK027) Is an exact-duplicate staff membership rejected? → A: Yes — a person cannot hold the identical role/branch membership twice (edge case added); distinct memberships remain allowed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authoritative Tenancy Data Model (Priority: P1)

The system provides the authoritative data layer for the tenancy core: restaurants (the top-level tenants), branches, staff profiles, staff memberships with declared roles, and physical dining tables — with every relationship declared and enforced by the database, and every tenant-owned record carrying a deterministic ownership path back to its restaurant (and to its branch where the record is branch-scoped).

**Why this priority**: The master plan's Phase 1 goal is "the authoritative domain data layer and tenant isolation" (§12), and its critical requirement is the deterministic ownership path. Every later phase (auth, management, menu, ordering) hangs off this model; Constitution Principle V makes the database the single authoritative source of business state.

**Independent Test**: Inspect the rebuilt database: each tenancy entity exists with its declared attributes; referential and uniqueness rules hold (orphaned or cross-referenced records are rejected); the owning restaurant (and branch) of every tenant-owned record can be resolved deterministically from the record's declared relationships.

**Acceptance Scenarios**:

1. **Given** the migrated database, **When** a restaurant is created with its identifying
   attributes, **Then** it exists as a distinct tenant root, uniquely identified, including a
   unique human-readable public identifier usable in customer-facing URLs.
2. **Given** a restaurant, **When** a branch is created under it, **Then** the branch belongs
   to exactly one restaurant and is uniquely identified within that restaurant by its
   restaurant-scoped identity — not by its display name (FR-002).
3. **Given** a staff profile and a restaurant, **When** a staff membership is created with a
   declared role, **Then** the membership binds the profile to that restaurant with exactly
   one role, and for branch-scoped roles additionally to exactly one branch of the same
   restaurant.
4. **Given** a branch, **When** a dining table is created, **Then** it belongs to exactly one
   branch and is uniquely identifiable within that branch.
5. **Given** any tenant-owned record, **When** its ownership is examined, **Then** the owning
   restaurant (and the owning branch, for branch-scoped records) is determined from the
   record's declared relationships without ambiguity.
6. **Given** a change that would make a record reference data belonging to a different
   restaurant (for example a membership binding a branch-scoped role to another
   restaurant's branch), **When** the change is attempted, **Then** it is rejected by the
   data layer.

---

### User Story 2 - Enforced Tenant Isolation (Priority: P2)

Regardless of the access path — application code, direct data-access API, or a direct database session — tenant-owned data is invisible and untouchable outside its tenant: restaurant A's data cannot be read or modified from restaurant B's context, branch A's branch-scoped data cannot be read or modified from branch B's context within the same restaurant, and staff members cannot bypass their tenant or branch scope. All tenant-owned data uses a deny-by-default posture: nothing is accessible to public or unauthenticated access.

**Why this priority**: Constitution Principles III and IV make tenant isolation and server-enforced authorization non-negotiable, and the master plan lists exactly these as Phase 1's required security tests (§12). It is P2 only because the data model (User Story 1) must exist first; without enforced isolation, that model could not be trusted as the foundation every later phase builds on.

**Independent Test**: Run the automated database-level security suite against the seeded multi-tenant development data: every required test category (cross-restaurant, cross-branch, scope-bypass attempt, direct access) demonstrates denial, and within-scope reads succeed for every seeded actor class (owner, branch-scoped staff, multi-restaurant member).

**Acceptance Scenarios**:

1. **Given** two seeded restaurants, **When** a member of restaurant A's staff attempts to
   read or modify restaurant B's tenant-owned records through any access path, **Then** the
   attempt is denied by the data layer.
2. **Given** two branches of one restaurant, each with assigned branch-scoped staff,
   **When** one branch's staff attempts to read or modify the other branch's branch-scoped
   records, **Then** the attempt is denied.
3. **Given** an acting staff member, **When** they attempt to reach records outside their
   restaurant scope (or outside their assigned branch, for branch-scoped roles), **Then**
   the attempt is denied even when the request is crafted directly against the data layer
   rather than through application screens.
4. **Given** public or unauthenticated access, **When** any tenant-owned record is
   requested, **Then** access is denied (deny-by-default).
5. **Given** a database rebuilt from zero, **When** the isolation suite runs, **Then** all
   isolation guarantees hold identically to the originally migrated database.
6. **Given** the owner of a restaurant, **When** they read their restaurant's
   tenant-owned records, **Then** they can read the restaurant, every branch of it, its
   staff memberships, and its branch-scoped records (positive owner path — FR-009).
7. **Given** branch-scoped staff, **When** they read records of their assigned branch,
   **Then** they can read them (positive branch path), while every other branch remains
   outside their scope per scenarios 2 and 3.
8. **Given** a person holding memberships in two restaurants (for example an owner of
   one and branch-scoped staff of another), **When** they read tenant-owned records,
   **Then** they can read exactly the union of their two scopes — each restaurant's data
   through its own membership — and nothing beyond either (multi-membership,
   Clarifications 2026-09-15).
9. **Given** a profile carrying the platform super-admin capability and no staff
   memberships, **When** it attempts to read any tenant-owned records, **Then** access
   is denied everywhere — the capability grants no data access in Phase 1 (FR-004
   modeled-only posture; this verifies the posture, not an access path, per
   Clarifications 2026-09-15).

---

### User Story 3 - Audit Foundation (Priority: P3)

The data layer includes an append-only audit store: every audit record captures, at minimum, who acted (actor), when (timestamp), what was done (action), on what (resource), what changed or why (change/reason), and within which tenant scope. Audit records cannot be modified or deleted through any client-accessible path, and the mechanism is proven by automated tests before later features depend on it.

**Why this priority**: Constitution Principle VII requires reliable, server-side records of sensitive operations, and the master plan's Phase 1 outcomes include the "audit foundation" (§12) with the minimum field set defined in §37. Later phases (price changes, voids, configuration changes) write into this foundation, so it must exist and be trustworthy before they arrive — but no sensitive business operations exist yet, so it ranks behind the model and isolation.

**Independent Test**: Record an action through the supported mechanism and verify all required fields are captured; then attempt to read, modify, and delete audit records through every client-accessible access path and verify the deny-by-default posture holds and that modification and deletion are denied.

**Acceptance Scenarios**:

1. **Given** the audit foundation, **When** an action is recorded with its context (actor,
   action, resource, change/reason, scope), **Then** the record persists with its timestamp
   and all required fields.
2. **Given** a stored audit record, **When** a modification or deletion is attempted through
   any client-accessible path, **Then** the attempt is denied — audit records are
   append-only.
3. **Given** an audit write attempted with missing required context, **When** the write is
   attempted, **Then** it is rejected with a clear failure rather than silently stored
   incomplete.
4. **Given** the audit store, **When** client-side access is attempted, **Then** the
   deny-by-default posture applies exactly as it does to all other tenant-owned data.

---

### User Story 4 - Deterministic Rebuild and Tenancy Seed (Priority: P4)

The complete Phase 1 data layer — every tenancy entity, relationship, constraint, protection, and helper — is recreated from zero using only version-controlled migrations, and the development seed provides multi-tenant fixture data (at least two restaurants with branches and staff memberships covering the declared roles) so the isolation guarantees can be demonstrated and tested out of the box.

**Why this priority**: This is the master plan's Phase 1 exit condition — "Database can be reset from zero and recreated entirely from migrations" (§12) — and it operationalizes the Phase 0 reproducibility story (feature 001, US2) for the real domain schema. It is P4 because it formalizes and proves what the earlier stories build.

**Independent Test**: Run the documented reset-to-zero workflow twice; verify each rebuild applies all migrations deterministically, loads the seed, passes the full test suite, and produces equivalent state across runs.

**Acceptance Scenarios**:

1. **Given** a development database in any state, **When** the documented reset-to-zero
   workflow runs, **Then** the full Phase 1 schema and seed are rebuilt entirely from
   repository artifacts (migrations and seed data).
2. **Given** two consecutive zero-rebuilds, **When** the resulting states are compared,
   **Then** they are equivalent (deterministic rebuild).
3. **Given** the seeded development database, **When** the isolation suite runs, **Then**
   the seed provides the multi-tenant fixture (two restaurants, branches, and
   role-covering memberships) the tests rely on, with no manual data setup.
4. **Given** the rebuilt schema, **When** the documented type-generation step runs,
   **Then** data-access types cover the Phase 1 entities and are reproducible across
   rebuilds.

---

### Edge Cases

- What happens when a staff membership assigns a branch-scoped role with a branch that
  belongs to a different restaurant? The data layer rejects it (cross-tenant reference
  prevention, master plan §35).
- What happens when a duplicate restaurant public identifier is created? Rejected by
  uniqueness enforcement.
- What happens when a dining table identifier collides within its branch? Rejected;
  identifiers are unique per branch.
- What happens when a person holds memberships in multiple restaurants? Supported — roles
  are held per membership, not per person (see Assumptions).
- What happens when an identical staff membership is created twice (same person,
  restaurant, role, and branch)? Rejected — a person cannot hold the exact same
  membership more than once (uniqueness enforcement; distinct memberships remain
  allowed per the multi-membership rule).
- What happens when a restaurant would be left without any owner? No owner-removal flows
  exist in Phase 1; enforcing the "always at least one owner" business rule is deferred to
  the staff-management feature, and Phase 1 must not introduce a constraint it cannot
  enforce correctly (Constitution Principle VIII).
- What happens when isolation or audit tests run against a partially migrated or manually
  modified database? The documented reset workflow restores the known-good state first;
  test preconditions are documented.
- What happens when an audit write omits required context (actor, action, resource, or
  scope)? Rejected with a clear failure (User Story 3, scenario 3).
- What happens when tenant data is accessed while unauthenticated? Denied everywhere
  (deny-by-default, User Story 2, scenario 4).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST model the restaurant as the top-level tenant entity, uniquely
  identified, with a unique human-readable public identifier usable in customer-facing
  URLs.
- **FR-002**: The system MUST model the branch as an operational entity belonging to
  exactly one restaurant. Branch display names are NOT required to be unique within a
  restaurant in Phase 1: branch identity is ID-based, and referential integrity is
  anchored on the (restaurant_id, id) pairing rather than on display names
  (Clarifications 2026-09-15, analyze F2).
- **FR-003**: The system MUST model a staff profile representing a person associated with
  the platform; linkage to an authentication identity is completed in Phase 2.
- **FR-004**: The system MUST model staff membership binding a profile to a restaurant
  with exactly one declared role. The declared restaurant-scoped staff roles MUST be
  owner, branch manager, cashier, and kitchen staff; branch-scoped roles MUST additionally
  bind to exactly one branch of the same restaurant; and a distinct platform-level
  super-admin capability MUST be modeled separately from restaurant-scoped staff roles.
  In Phase 1 the super-admin capability is modeled only: it MUST NOT grant any
  cross-tenant data access — the deny-by-default posture (FR-008) applies to it like
  every other access path until role-based authorization arrives in Phase 2.
- **FR-005**: The system MUST model physical dining tables belonging to exactly one
  branch, uniquely identifiable within that branch.
- **FR-006**: Every tenant-owned record MUST carry a deterministic ownership path to its
  restaurant, and every branch-scoped record MUST additionally carry a deterministic path
  to its branch, through relationships declared and enforced by the data layer (master
  plan §12 critical requirement).
- **FR-007**: The data layer MUST enforce referential integrity: orphaned records and
  cross-tenant references (a record of one restaurant or branch referencing another's data
  where the business model forbids it) MUST be impossible (master plan §35).
- **FR-008**: All tenant-owned data MUST be protected by a deny-by-default access posture
  at the trusted data layer: no tenant-owned record is accessible to public,
  unauthenticated, or cross-tenant access through any access path (Constitution
  Principles III/IV; extends feature 001 FR-017 to all tenant-owned data).
- **FR-009**: The data layer MUST enforce that a staff member's data access is limited to
  their restaurant scope and, for branch-scoped roles, to their assigned branch scope —
  independent of how the access is initiated (application code, direct data-access API, or
  direct database session). In Phase 1 this means: restaurant-scoped records are readable
  by all staff of the same restaurant, and branch-scoped records are limited to the
  assigned branch for branch-scoped roles — owners retain access to every branch of their
  restaurant (master plan §30) — while role-specific narrowing within these boundaries is
  deferred to the Phase 2 RBAC policies (Clarifications 2026-09-15, analyze F1).
- **FR-010**: The data layer MUST provide reusable server-side scope-resolution mechanisms
  (determining the restaurant — and branch, where applicable — of an acting staff member)
  that authorization enforcement builds on, so all checks share one consistent resolution
  path (master plan §12 "database helper functions", §30).
- **FR-011**: The project MUST include automated database-level security tests proving, at
  minimum: (a) restaurant A cannot read or modify restaurant B's records; (b) branch A
  cannot read or modify branch B's records within the same restaurant; (c) staff cannot
  bypass their tenant or branch scope; and (d) direct data-layer access still respects
  these boundaries (master plan §12 required security tests).
- **FR-012**: The audit foundation MUST provide append-only audit records capturing, at
  minimum: actor, timestamp, action, resource, change/reason, and tenant scope (master
  plan §37). Change/reason is a single optional field on the record — it may be empty
  when no natural reason exists — while the required write-time context is actor,
  action, resource, and tenant scope (branch scope where applicable); a write omitting
  any of those MUST be rejected (Clarifications 2026-09-15, checklist review).
- **FR-013**: Audit records MUST NOT be modifiable or deletable through any
  client-accessible access path, and the audit store MUST share the deny-by-default
  posture of all tenant-owned data; the append-only behavior and field completeness MUST
  be proven by automated tests.
- **FR-014**: The complete Phase 1 data layer MUST be resettable to zero and fully
  recreatable from version-controlled migrations alone, deterministically (master plan §12
  exit condition).
- **FR-015**: The development seed MUST include at least two restaurants, each with at
  least one branch, and staff memberships covering the declared staff roles — sufficient
  to demonstrate and test tenant and branch isolation without manual data setup.
- **FR-016**: Data-access type definitions MUST be regenerated to cover the complete
  Phase 1 schema and MUST remain reproducible after a full zero-rebuild (extends feature
  001 FR-009).
- **FR-017**: All Phase 1 schema changes MUST flow through the single canonical migration
  workflow established in Phase 0 (feature 001 FR-010); no parallel schema-change practice
  may be introduced.

### Key Entities

- **Restaurant**: the top-level tenant; owns branches, staff scope, configuration, and
  (in later phases) subscription state. Key attributes: unique identity and a unique
  human-readable public identifier.
- **Branch**: the operational boundary under exactly one restaurant; orders, sessions,
  tables, and branch-level overrides (later phases) are isolated by branch.
- **Staff Profile**: a person associated with the platform; linked to an authentication
  identity in Phase 2.
- **Staff Membership**: binds a profile to one restaurant with one declared role (and one
  branch for branch-scoped roles); the unit of staff authorization scope.
- **Staff Role**: owner (all branches of the restaurant); branch manager, cashier, and
  kitchen staff (assigned branch); the platform-level super admin is modeled separately
  from restaurant-scoped staff roles.
- **Dining Table**: a physical table belonging to exactly one branch, uniquely identified
  within that branch.
- **Audit Record**: append-only trace of a sensitive action — actor, timestamp, action,
  resource, change/reason, and tenant scope.

### Out of Scope

The following are explicitly out of scope for Phase 1 and belong to later phases per the
master plan (§10, §42):

- Authentication flows — login, logout, session persistence, password recovery — and
  route guards (Phase 2).
- The complete role-based authorization matrix (what each role may do within its scope)
  and role-aware policies: Phase 1 enforces the tenant and branch boundaries (where
  access is allowed), not the full per-role permission model (Phase 2).
- Restaurant/branch management UI, working hours, restaurant QR configuration, and
  tenant settings (Phase 3).
- Menu, tax, ordering, session, round, kitchen, delivery, and takeaway schemas and data
  (Phases 4–10).
- Customer identity and the customer session security model (Phase 7; master plan §30
  requires it be designed explicitly there).
- Subscription records, subscription administration, and super-admin features (Phase 13);
  Phase 1 models only the super-admin role distinction.
- Audit event definitions for business operations, retention rules, indexing, and audit
  UI (arrive with their features; master plan §37).
- Realtime, reports, performance tuning, and production hardening (later phases).

This boundary enforces Constitution Principle VIII (Minimal and Intentional Complexity):
Phase 1 builds the tenancy backbone and its protections only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the required security-test categories (cross-restaurant,
  cross-branch, scope bypass, direct data-layer access) pass against the seeded database,
  with every attempted unauthorized operation denied.
- **SC-002**: A full reset-to-zero rebuild (schema + seed) from migrations alone succeeds
  and is deterministic — running it twice produces equivalent state.
- **SC-003**: 100% of tenant-owned entities in the Phase 1 schema are covered by automated
  deny-by-default and unauthorized-access checks; no tenant-owned record is retrievable
  through public or unauthenticated access.
- **SC-004**: Every audit record persists the full captured-field set (actor, timestamp, action,
  resource, change/reason, scope — change/reason optional per FR-012), and 100% of
  client-accessible attempts to modify or delete audit records are denied.
- **SC-005**: The seeded development database supports the isolation demonstration with
  zero manual data setup (two restaurants with branches and role-covering memberships
  present after seed).

## Assumptions

- The backend remains the configured Supabase Cloud project with the Phase 0
  migration/type-generation/reset workflow; exact schema object names, column types, and
  enforcement mechanisms — including how simulated staff identities are represented in
  security tests before authentication exists — are chosen by this feature's technical
  plan.
- Phase 1 enforces tenant and branch scope boundaries (where access is allowed). The
  complete role-permission matrix and its policies arrive in Phase 2, per the master
  plan's decomposition (§12 "RLS foundation" versus §13 "database RLS policies").
- Security tests in Phase 1 may exercise the data layer with seeded or simulated staff
  identities, since real authentication flows arrive in Phase 2; the tests must still
  exercise real data-layer enforcement, not mocked checks.
- A person may hold staff memberships in more than one restaurant; roles are held per
  membership, not per person. Multiple branch assignments for one person are represented
  as multiple memberships.
- The customer is not a staff role: guest ordering identity belongs to Phase 7's customer
  session model (master plan §13, §30).
- Business operations that write audit events arrive with their features (Phase 3+);
  Phase 1 delivers the append-only foundation and proves it with tests.
- Enforcing "a restaurant always keeps at least one owner" is deferred to the
  staff-management feature, because no owner-removal flows exist in Phase 1 (Constitution
  Principle VIII).
- Two-restaurant seed data is acceptable on the shared cloud development database; the
  documented reset workflow remains the path to a clean state.
