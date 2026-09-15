# Feature Specification: Auth and RBAC (Phase 2)

**Feature Branch**: `003-auth-and-rbac`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "create Phase 2 specifications" — Phase 2 as defined in RestoPilot-Master-Plan.md §13 (Auth and RBAC: staff login, staff logout, session persistence, password recovery, role mapping, restaurant/branch scope, route guards, database RLS policies, authorization helpers; roles: Super Admin, Owner, Branch Manager, Cashier, Kitchen, Customer-as-guest; the platform authentication service handles authenticated staff identities while RBAC uses database-backed role membership, with credential claims supporting — never replacing — database authorization; exit condition: each staff role can sign in and only access the intended scope), constrained by the RestoPilot Constitution (especially Principles II, III, IV, V, and VII), the master plan's architecture direction and architectural rules (§4, §5), identity and tenancy domain (§6.1), RLS strategy (§30), UI architecture and routing direction (§38), testing strategy (§40), and feature decomposition (§10), building directly on the Phase 1 data layer delivered in `specs/002-database-and-tenancy` (tenancy schema, enforced tenant isolation, audit foundation, seeded multi-tenant fixtures).

## Clarifications

### Session 2026-09-15

- Q: Which roles may read a restaurant's staff list (its staff memberships and the linked profiles' basic information)? → A: Owners and branch managers only — cashiers and kitchen staff cannot read the staff list.
- Q: What may the platform super admin access in Phase 2? → A: Minimal — the platform admin area only, with no cross-tenant restaurant data access; platform-wide capabilities arrive with the Phase 13 features.
- Q: What happens after sign-in for a member holding staff memberships in more than one restaurant? → A: A unified staff area reflecting the union of their scopes, with in-dashboard context selection; no forced restaurant/role chooser at sign-in.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff Sign-In and Role Mapping (Priority: P1)

A staff member signs in with their staff account credentials (email address and password). A valid sign-in establishes the authenticated identity, which the system links to exactly one staff profile from the Phase 1 data layer; the member's effective roles and restaurant/branch scope resolve from their current staff memberships. Sign-in with invalid or unknown credentials is rejected without revealing which part was wrong. The roles that can sign in are the restaurant-scoped staff roles (owner, branch manager, cashier, kitchen) and the platform super admin; customers are not staff accounts — guest ordering identity belongs to Phase 7.

**Why this priority**: The master plan's Phase 2 goal is "authenticated staff access and authorization boundaries" (§13), and its exit condition begins with "each staff role can sign in". Phase 1 explicitly deferred the identity linkage to this phase (feature 002 FR-003/FR-004): until real staff can sign in and be mapped to their roles and scope, no other Phase 2 outcome can be built, demonstrated, or proven. Constitution Principle V keeps role and scope resolution grounded in the authoritative data layer rather than in client state.

**Independent Test**: Using the seeded staff identities — covering an owner, a branch manager, a cashier, a kitchen member, a multi-restaurant member, and the platform super admin — every fixture account can sign in; each resolved role/scope set matches the seeded membership matrix exactly; invalid credentials and unknown accounts are rejected indistinguishably.

**Acceptance Scenarios**:

1. **Given** a seeded staff identity with valid credentials, **When** the member signs in, **Then**
   they are authenticated and their effective roles and restaurant/branch scope resolve from
   their current staff memberships.
2. **Given** a sign-in attempt with a wrong password or with a nonexistent account, **When** the
   attempt is made, **Then** it is rejected with a generic response that does not reveal whether
   the account exists or which part of the credentials was wrong.
3. **Given** an authenticated identity with no linked staff profile, **When** any staff data
   access or staff-area entry is attempted, **Then** access is denied — deny-by-default (feature
   002 FR-008 extended to the authenticated context).
4. **Given** the one-to-one identity-to-profile linkage, **When** a signed-in identity is
   resolved, **Then** it maps to exactly one staff profile and that profile's memberships —
   never to several profiles.
5. **Given** the seeded multi-restaurant member (owner of one restaurant and cashier of a branch
   in another), **When** they sign in, **Then** their effective data scope is the union of both
   memberships — each restaurant's data through its own membership — and nothing beyond either
   (feature 002 Clarifications 2026-09-15).
6. **Given** the seeded platform super-admin profile (capability flag, no staff memberships),
   **When** they sign in, **Then** authentication succeeds and the platform capability is
   recognized, admitting them to the platform admin area with no restaurant tenant data
   access (FR-012).

---

### User Story 2 - Role-Aware, Server-Enforced Access Boundaries (Priority: P2)

Within the tenant and branch boundaries Phase 1 established, access to the tenancy data is additionally limited by role: owners access their restaurant and every branch of it; branch managers, cashiers, and kitchen staff access only their assigned branch's scope; the staff list of a restaurant is visible to its owners and branch managers only. Every authorization decision is made at the trusted data layer against the authenticated member's effective roles and current memberships — through every access path — and role or scope information carried by the signed-in credentials can never grant access that current memberships do not back. The Phase 1 tenant-isolation guarantees are proven again, this time against real authenticated sign-ins.

**Why this priority**: This is the RBAC core of master plan §13 (role mapping, restaurant/branch scope, database RLS policies, authorization helpers) and the direct realization of Constitution Principles III and IV on top of the Phase 1 foundation. Phase 1 deliberately deferred role-specific narrowing to this phase (feature 002 FR-009, Clarifications 2026-09-15). It is P2 only because it needs User Story 1's real authenticated identities to enforce and prove.

**Independent Test**: Run the extended automated security suite with real authenticated sign-ins for every seeded role: each in-scope access succeeds; each out-of-scope access (other restaurants, other branches, above-role data such as the staff list for cashier and kitchen roles) is denied; the four Phase 1 isolation categories pass unchanged against real logins; and attempts that rely on role or scope information attached to the credentials but not backed by current memberships are denied.

**Acceptance Scenarios**:

1. **Given** a signed-in owner, **When** they access their restaurant's data, **Then** they can
   read the restaurant, every branch of it, the dining tables of every branch, and the
   restaurant's staff list (FR-007).
2. **Given** a signed-in branch manager (or cashier or kitchen member) of branch A, **When**
   they access data, **Then** branch A's branch-scoped data is reachable and every other branch
   of the same restaurant is not (master plan §30); the branch manager can additionally read
   the restaurant's staff list, while the cashier and kitchen member cannot (FR-007).
3. **Given** a signed-in staff member of restaurant A, **When** restaurant B's data is requested
   through any access path, **Then** the request is denied — the Phase 1 cross-tenant
   categories re-proven with real logins.
4. **Given** a signed-in staff member, **When** requests are crafted directly against the data
   layer rather than through application screens, **Then** the same role and scope boundaries
   hold.
5. **Given** a signed-in member whose credentials carry role or scope information not backed by
   their current memberships, **When** data access is attempted on that basis, **Then** access
   is denied per the database-backed memberships (FR-009).
6. **Given** a signed-in member whose staff membership is removed, **When** they next access
   that restaurant's data, **Then** that access is gone — effective access reflects current
   memberships only (FR-006).
7. **Given** any signed-in staff member, **When** they view their own basic profile information
   and effective roles and scope, **Then** they can (FR-011).
8. **Given** a signed-in cashier or kitchen member, **When** they request their restaurant's
   staff list, **Then** the request is denied (FR-007).

---

### User Story 3 - Protected Staff Areas and Route Guards (Priority: P3)

Staff-facing areas are protected: unauthenticated visitors are redirected to sign-in and returned to their originally requested destination after signing in. Signed-in staff can reach only the views their effective roles and scope permit; navigation shows only permitted entries; deep links to unauthorized views are rejected rather than merely hidden. The platform admin area is reserved for the platform super admin. Route guards are a user-experience layer: the enforced boundaries of User Story 2 remain the security boundary (Constitution Principle IV).

**Why this priority**: Route guards are a §13 outcome and the surface on which the phase's exit condition is demonstrated, but they are conveniences layered over the enforced boundaries — the system stays secure without them — so they follow the enforcement core (User Story 2). They extend the Phase 0 routing shell (staff dashboard and admin areas) with protection and role-awareness (master plan §38).

**Independent Test**: Walk each seeded account through the route matrix: every protected route denies unauthenticated entry; each role reaches exactly its intended views and no others; deep links to unauthorized views fail; the super admin reaches the platform admin area.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor opening a deep link to a staff view, **When** the link
   is followed, **Then** they are redirected to sign-in and, after a valid sign-in, reach the
   originally requested view.
2. **Given** a signed-in owner, branch manager, cashier, or kitchen member, **When** they use
   the staff area, **Then** navigation shows only the entries their roles and scope permit and
   every permitted view is reachable.
3. **Given** a signed-in staff member, **When** they deep-link to a view their roles or scope
   do not permit, **Then** the view is denied, not merely hidden from navigation.
4. **Given** the signed-in platform super admin, **When** they enter the platform admin area,
   **Then** they are admitted, and no restaurant tenant data is accessible from it in this
   phase (FR-012).
5. **Given** a member holding staff memberships in more than one restaurant, **When** they
   complete sign-in, **Then** they enter a unified staff area reflecting the union of their
   scopes, and can switch context between their restaurants and branches within the dashboard
   (FR-015).
6. **Given** a signed-out visitor using a previously valid staff URL (for example via the
   browser's back button), **When** the URL is opened, **Then** they are redirected to
   sign-in.

---

### User Story 4 - Session Persistence and Sign-Out (Priority: P4)

A signed-in staff member remains authenticated across page reloads and browser restarts until they sign out. Sign-out ends their session so that protected areas and staff data require re-authentication.

**Why this priority**: Operational continuity: staff dashboards are used across whole shifts, and losing the session on every reload would make the authenticated system unusable in practice. It is P4 because it refines the sign-in experience User Story 1 establishes rather than adding a new security boundary.

**Independent Test**: Sign in, reload the page, and reopen the browser: the member remains signed in with the same resolved identity and scope. Sign out: protected areas redirect to sign-in and staff data access is denied until re-authentication.

**Acceptance Scenarios**:

1. **Given** a signed-in staff member, **When** the page is reloaded, **Then** they remain
   signed in with the same identity and effective scope.
2. **Given** a signed-in staff member, **When** the browser is closed and reopened, **Then**
   they remain signed in.
3. **Given** a signed-in staff member, **When** they sign out, **Then** the session ends:
   protected areas redirect to sign-in and staff data access is denied until they sign in
   again.

---

### User Story 5 - Self-Service Password Recovery (Priority: P5)

A staff member who forgets their password regains access without operator help: they request recovery using their account email, follow a time-limited single-use recovery path, set a new password, and sign in with it. The previous password stops working, and nothing else about the account — profile, memberships, roles, scope — changes.

**Why this priority**: Password recovery is a §13 outcome and a necessary access-restoration capability, but it does not block the authenticated operation of the system, and it depends on User Story 1's identity model, so it comes last.

**Independent Test**: With a seeded identity, complete the full recovery flow and verify: the recovery path arrives at the account email; a new password set within the validity window enables sign-in; the old password is rejected; an expired or already-used recovery path is rejected; memberships, roles, and scope are unchanged.

**Acceptance Scenarios**:

1. **Given** a staff member's account email, **When** recovery is requested, **Then** a
   time-limited, single-use recovery path is delivered to that email.
2. **Given** an unused recovery path within its validity window, **When** a new password is
   set, **Then** subsequent sign-in with the new password succeeds.
3. **Given** a completed password change, **When** the previous password is used, **Then**
   sign-in is rejected.
4. **Given** an expired or already-used recovery path, **When** it is used, **Then** it is
   rejected.
5. **Given** a recovery request for a nonexistent email address, **When** the request is made,
   **Then** the response is generic and indistinguishable from the valid case.
6. **Given** a completed password recovery, **When** the member signs in, **Then** their
   profile, memberships, roles, and scope are unchanged.

---

### Edge Cases

- What happens when an authenticated identity has no linked staff profile? No staff data
  access and no staff-area entry; deny-by-default (User Story 1, scenario 3).
- What happens when a staff profile has no linked sign-in identity (no credentials exist)? The
  profile cannot sign in; provisioning identities for new staff arrives with Phase 3 staff
  management (see Assumptions).
- What happens when a staff membership is removed while the member is signed in? The access
  that membership granted ends; effective access always reflects current memberships (User
  Story 2, scenario 6).
- What happens when a cashier or kitchen member requests the staff list? Denied — the staff
  list is limited to owners and branch managers (FR-007, User Story 2, scenario 8).
- What happens when credentials carry role or scope information not backed by current
  memberships? Denied — credential-carried role information is advisory only (User Story 2,
  scenario 5).
- What happens when a staff member signs in on multiple devices? Allowed; sign-out ends the
  session on the current device (see Assumptions).
- What happens when sign-in is attempted with a wrong password repeatedly? The platform
  authentication service's built-in abuse protections apply; no custom lockout rule is added
  in this phase (see Assumptions).
- What happens when the super admin (no staff memberships) signs in? Authentication succeeds;
  they reach the platform admin area and access no restaurant tenant data (FR-012).
- What happens when a customer tries to use staff sign-in? Customers are not staff accounts —
  no customer identity exists in this phase; guest ordering identity belongs to Phase 7
  (FR-022).
- What happens when a visitor attempts self-service sign-up? Rejected — public sign-up is
  disabled on the platform; staff identities are provisioned, never self-registered
  (FR-022).
- What happens when a recovery path is requested for an email with no account? A generic
  response; no account enumeration (User Story 5, scenario 5).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST authenticate staff members using account credentials consisting
  of an email address and a password, and MUST reject sign-in attempts with invalid
  credentials.
- **FR-002**: Rejections of invalid-credential and unknown-account sign-in attempts MUST be
  indistinguishable, revealing neither account existence nor which part of the credentials was
  wrong.
- **FR-003**: Every authenticated staff identity MUST correspond to exactly one staff profile
  in the Phase 1 data layer, and this one-to-one linkage MUST be declared and enforced by the
  data layer — completing the linkage feature 002 FR-003 deferred to this phase.
- **FR-004**: The system MUST resolve a signed-in member's effective roles and
  restaurant/branch scope from their current staff memberships (role mapping); an
  authenticated identity with no memberships has no staff scope.
- **FR-005**: Authenticated identities without a linked staff profile MUST be denied all staff
  data access and all staff-area entry, extending the deny-by-default posture of feature 002
  FR-008 to the authenticated context.
- **FR-006**: A staff member's effective access MUST reflect their current memberships: when a
  membership ceases to exist, the access it granted MUST end, without requiring any other
  account change.
- **FR-007**: The data layer MUST enforce role-aware access boundaries on the tenancy data in
  addition to the Phase 1 tenant and branch boundaries (feature 002 FR-009): an owner accesses
  their restaurant and every branch of it; a branch manager, cashier, or kitchen member
  accesses only their assigned branch's scope; and every staff member of a restaurant can read
  that restaurant's own record. Reading the staff list of a restaurant (its staff memberships
  and the linked profiles' basic information) MUST be limited to owners and branch managers of
  that restaurant; cashiers and kitchen staff MUST NOT read the staff list (Clarifications
  2026-09-15).
- **FR-008**: Every protected operation MUST be validated at the trusted data layer against
  the authenticated member's effective roles and scope, independent of the access path
  (application screens, direct data access, or direct database session). Frontend role checks
  MAY control presentation only and MUST NOT be treated as the authorization boundary
  (Constitution Principle IV; master plan §5.2).
- **FR-009**: Any role or scope information attached to the signed-in identity's credentials
  MUST be derived from database-backed memberships and MUST be treated as advisory: it MUST
  NOT be accepted as a source of authorization, and access not backed by current memberships
  MUST be denied (master plan §13 Supabase direction — claims support, never replace,
  database authorization).
- **FR-010**: The system MUST provide shared server-side authorization helpers that resolve an
  authenticated identity's effective roles and restaurant/branch scope through one consistent
  path, used by all authorization checks — extending the Phase 1 scope-resolution helpers
  (feature 002 FR-010) with the role dimension.
- **FR-011**: A signed-in staff member MUST be able to view their own basic profile
  information together with their effective roles and scope.
- **FR-012**: The platform super-admin capability MUST be recognized at sign-in and MUST admit
  the holder to the platform admin area. The super-admin scope in this phase is minimal: the
  capability MUST NOT grant any cross-tenant restaurant data access — platform-wide
  capabilities arrive with the Phase 13 features — so a super admin without staff memberships
  accesses no restaurant tenant data (Clarifications 2026-09-15).
- **FR-013**: Unauthenticated access to staff or admin areas MUST be redirected to sign-in,
  and after a successful sign-in the member MUST be taken to their originally requested
  destination when one exists.
- **FR-014**: Signed-in staff MUST be able to reach only the views their effective roles and
  scope permit; navigation MUST reflect those roles, and deep links to unauthorized views MUST
  be rejected rather than merely hidden (master plan §38: navigation visibility is a UX
  concern; authorization remains a backend concern).
- **FR-015**: A member holding staff memberships in more than one restaurant MUST be presented
  with a unified staff area reflecting the union of their scopes, with in-dashboard context
  selection between their restaurants and branches; sign-in MUST NOT force a restaurant or
  role choice before entering the staff area (Clarifications 2026-09-15).
- **FR-016**: A signed-in staff member MUST remain authenticated across page reloads and
  browser restarts until they sign out, with the session bound to the same identity.
- **FR-017**: Sign-out MUST end the staff member's session such that protected areas and staff
  data access require re-authentication.
- **FR-018**: The system MUST provide self-service password recovery: a recovery request using
  the account email, a time-limited single-use recovery path, and the setting of a new
  password. After a successful change the previous password MUST stop working.
- **FR-019**: Password recovery MUST NOT alter the member's profile, memberships, roles, or
  scope.
- **FR-020**: The project MUST include automated security tests that (a) re-run the Phase 1
  tenant-isolation categories (cross-restaurant, cross-branch, scope bypass, direct access)
  against real authenticated sign-ins for every seeded staff role — as feature 002's
  clarifications anticipated — and (b) prove this phase's role-aware boundaries, including
  direct data-layer access and credential-carried role information not backed by memberships.
- **FR-021**: The development seed MUST provide working sign-in identities for the seeded
  fixture profiles covering every declared role — including the multi-restaurant member and
  the platform super admin — so every Phase 2 behavior is demonstrable and testable without
  manual setup.
- **FR-022**: Customers MUST NOT receive staff accounts or staff sign-in identities: the
  customer is a guest ordering participant, and guest ordering identity with its session
  security model belongs to Phase 7 (master plan §13, §30). Public self-service sign-up
  MUST be disabled on the platform authentication service — no one can self-register an
  account: staff sign-in identities exist only through provisioning (the seeded profiles
  of FR-021 in this phase; the invitation flow arrives with Phase 3), and customer
  participants receive no accounts; the deny-by-default posture (FR-005) holds
  regardless of the platform setting.
- **FR-023**: All schema, policy, and platform-configuration changes for this phase MUST flow
  through the single canonical change workflow established in Phases 0–1 (feature 001 FR-010,
  feature 002 FR-017); no parallel change practice may be introduced.

### Key Entities

- **Staff Sign-In Identity**: the sign-in identity — an email address with a password
  credential — managed by the platform authentication service; linked one-to-one with a staff
  profile.
- **Staff Profile** (Phase 1, extended): the person record; its linkage to the sign-in
  identity, deferred by feature 002, is completed and enforced in this phase.
- **Staff Membership / Staff Role** (Phase 1, unchanged): remains the single authoritative
  source of role and scope truth — owner (restaurant and all its branches); branch manager,
  cashier, kitchen (assigned branch); the platform super-admin capability remains modeled on
  the profile, separate from restaurant-scoped roles.
- **Effective Authorization Context**: the resolved set of roles plus restaurant/branch scope
  for a signed-in identity — the single artifact every guard and policy checks.
- **Protected Area**: a route region requiring authentication — the staff area (role-aware)
  and the platform admin area (super admin).
- **Recovery Path**: the time-limited, single-use instrument delivered to the account email
  for regaining access.

### Out of Scope

The following are explicitly out of scope for Phase 2 and belong to later phases per the
master plan (§10, §42):

- Staff account creation, invitation, and membership management (assigning or changing roles
  and branches, owner-removal safeguards) — Phase 3 restaurant and branch management. Phase 2
  provisions identities only for existing seeded profiles.
- Super-admin platform capabilities — viewing all restaurants, subscription administration,
  platform usage, disabling restaurants — Phase 13. In this phase the super-admin scope is the
  platform admin area only, with no cross-tenant restaurant data access (FR-012,
  Clarifications 2026-09-15).
- Role policies for business-domain data — menu (Phase 5), customer sessions (Phase 7),
  ordering (Phase 8), kitchen and cashier operational data (Phase 9): Phase 2 defines the
  role-aware boundaries for the tenancy data that exists and the shared authorization model
  those phases will build on. At the tenancy layer, branch manager, cashier, and kitchen share
  the assigned-branch scope; their operational differentiation arrives with their domains.
- Customer identity, guest sessions, and the customer session security model (Phase 7).
- Realtime delivery of authorization-relevant changes (Phase 12).
- Authentication-event auditing in the tenant audit store, audit retention, and audit UI
  (later phases; see Assumptions).
- Two-factor authentication, single sign-on, and hardware credentials (not in the approved
  roadmap).

This boundary enforces Constitution Principle VIII (Minimal and Intentional Complexity):
Phase 2 delivers authenticated staff access and authorization boundaries only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the seeded role × scope matrix passes with real authenticated sign-ins —
  every in-scope access succeeds and every out-of-scope access (other restaurants, other
  branches, above-role data) is denied.
- **SC-002**: 100% of the Phase 1 isolation test categories (cross-restaurant, cross-branch,
  scope bypass, direct access) pass when re-run against real authenticated logins.
- **SC-003**: 100% of attempts to obtain elevated access using role or scope information
  attached to the signed-in credentials but not backed by current staff memberships are
  denied.
- **SC-004**: A signed-in staff member remains authenticated across 100% of page-reload and
  browser-restart checks until sign-out; after sign-out, 100% of protected-area and staff-data
  access attempts require re-authentication.
- **SC-005**: A staff member completes the full self-service password recovery flow and
  regains access without operator intervention, with the previous password rejected in 100% of
  post-change attempts.
- **SC-006**: 100% of protected routes are inaccessible to unauthenticated visitors; each
  staff role reaches its intended views and no others.
- **SC-007**: The seeded identities support demonstrating every role's sign-in and
  intended-scope access with zero manual setup.

## Assumptions

- The credential model is email address plus password, per the platform direction fixed in
  master plan §13 (the platform authentication service manages staff identities); no SSO,
  OAuth, or multi-factor authentication in this phase.
- Sessions persist until sign-out; signing out ends the session on the current device;
  concurrent sessions on other devices are permitted (standard staff-application default).
- The platform authentication service's built-in protections (secure credential storage,
  request abuse and rate limiting) apply as-is; no custom lockout policy is added.
- Authentication activity (sign-in, sign-out, password recovery) is not written to the tenant
  audit store in this phase: the audit foundation requires a tenant scope (feature 002
  FR-012) that platform-level authentication events do not have, and the authentication
  service retains its own security records. Product-level audit events arrive with their
  features.
- Identity provisioning in this phase covers existing seeded profiles only; the staff
  invitation and creation flow arrives with Phase 3 staff management. Seeded credentials are
  documented, development-only values.
- Recovery paths are delivered to the account email and are time-limited and single-use.
- Restaurant-record readability: every staff member of a restaurant can read that restaurant's
  own record (the context baseline carried over from feature 002 FR-009's clarified posture);
  the staff list carries the narrower visibility rule of FR-007 (Clarifications 2026-09-15).
- Multi-membership data scope is the union of the member's memberships (established in
  feature 002's clarifications); FR-015 governs only the post-sign-in presentation, not the
  enforced scope.
- The backend remains the configured Supabase cloud project with the Phase 0–1 migration,
  type-generation, and reset workflow; exact enforcement mechanisms — including whether and
  where credential-carried role information is used at all — belong to this feature's
  technical plan, within the master plan §13 constraints.
