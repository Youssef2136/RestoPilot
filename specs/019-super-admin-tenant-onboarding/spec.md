# Feature Specification: Super-Admin Tenant Onboarding

**Feature Branch**: `019-super-admin-tenant-onboarding`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "the platform super admin must be able to add new restaurants and their first owner account"

## Clarifications resolved (recorded 2026-09-23)

- **Q: Does this break FR-022 (no public self-service sign-up) or the FR-021
  posture that the super-admin flag grants nothing in restaurant creation?**
  No — and the boundary is the phase's core rule. Onboarding becomes
  **super-admin-provisioned**, not self-service: the same provisioning
  philosophy as the owner's staff invitation flow (Phase 4 assumptions,
  `add_staff_member`), moved up to the platform level. `create_restaurant`'s
  own bootstrap path (any profile-joined caller creates a restaurant and
  becomes its owner) remains untouched; the super admin gains a
  **parallel, platform-side path** that composes the existing primitives.
- **Q: What does the first owner receive, and how?** The same contract as a
  newly invited staff member (Phase 4): a sign-in identity is provisioned by
  email; a brand-new person receives a one-time temporary credential shown
  once to the super admin (never logged, never persisted recoverable); an
  email already known to the platform links the existing person — no
  duplicates, no second credential.
- **Q: Can the super admin add more owners later, or rename/delete
  restaurants from the console?** Out of scope. Adding *additional* owners
  stays exactly where it is today — the restaurant owner's staff panel
  (Phase 4 FR-007: owner-only). The console provisions the FIRST owner only.
  Renaming, deletion, and subscription management already live in their
  existing homes (Phase 2/4 and the Phase 13 console respectively).
- **Q: What ordering rules apply to an onboarded, not-yet-activated
  tenant?** The 014 rules verbatim, no new posture: `never_activated` does
  not block ordering (only the manual platform-disabled flag does), and the
  onboarding flow adds nothing to that law. Recorded after the scan
  corrected the draft's contrary implication.
- **Q: Who can read the onboarding audit entry?** The new restaurant's
  owner, through the standing tenant audit surface. The super admin is
  refused the tenant audit read — the flag grants the console, not the
  tenants' trails (014 Walkthrough D, unchanged).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The super admin onboards a restaurant with its first owner (Priority: P1)

From the platform console, the super admin provisions a brand-new tenant in
one flow: the restaurant's name, public identifier, optional brand/contact
details, and the first owner's email + display name. On success, the
restaurant exists, the first owner exists with an owner membership scoped
to it, and the super admin is shown the owner's one-time temporary
credential (for a new person) or an explicit "linked existing account"
confirmation (for a known email). The new owner can immediately sign in
with that credential and sees the creation panel's complement: their
restaurant, ready for branches, tables, and menu.

**Why this priority**: this is the requested capability and the missing
half of platform-driven onboarding (spec 004's recorded assumption deferred
it here); without it, production tenant creation requires manual database
work by an operator.

**Independent Test**: sign in as the super admin, onboard a tenant with a
fresh owner email, sign in as that owner with the displayed temporary
credential, and observe the restaurant present with owner reach. Fully
verifiable without any other phase's surface.

**Acceptance Scenarios**:

1. **Given** a signed-in super admin, **When** they submit the onboarding
   form with a new restaurant's details and a first-owner email unknown to
   the platform, **Then** the restaurant is created, an owner membership
   links the newly provisioned person to it, and a one-time temporary
   credential is displayed exactly once.
2. **Given** a signed-in super admin, **When** they onboard a tenant whose
   first-owner email already belongs to an existing platform person,
   **Then** the existing person is linked as the first owner (no duplicate
   person, no credential displayed) and the confirmation names the linkage.
3. **Given** an onboarded restaurant, **When** its first owner signs in,
   **Then** they reach the staff area with owner reach for that restaurant
   only — and cannot read any other tenant.
4. **Given** the onboarding flow, **When** the super admin submits a public
   identifier already in use, **Then** the creation is refused with the
   established identifier-conflict message and nothing is created (no
   orphan person, no orphan restaurant).

### User Story 2 - Onboarding honors every platform rule without a second rulebook (Priority: P1)

An onboarded restaurant is indistinguishable from a self-bootstrapped one:
the subscription lifecycle starts as `never_activated` (the Phase 13
console remains the activation surface), the entry/round refusal rules
apply to it identically, and the audit trail records the super admin's
onboarding action with actor, action, resource, and reason-grade detail.
The super admin's flag confers no restaurant-tenant data reach beyond what
this flow itself needs.

**Why this priority**: the platform's authority comes from its rules being
single-sourced; a second, weaker onboarding path would erode the
security posture the 015 phase attacked and the 017 journey proved.

**Independent Test**: onboard a tenant, then run the standing reach suite
against it (ordering succeeds while `never_activated`, owner-only reads, no
cross-tenant reach) and the audit-read surface — all pass without new
exceptions.

**Acceptance Scenarios**:

1. **Given** a newly onboarded restaurant with no subscription dates,
   **When** a customer attempts entry and submits a round, **Then** both
   succeed — an un-activated subscription NEVER blocks ordering (the 014
   Important rule; "ordering is free" until the platform owner decides
   otherwise) — and the tenant's staff dashboard reads its state as
   `never_activated`.
2. **Given** the onboarding just completed, **When** the new restaurant's
   owner reads the audit trail through the tenant surface, **Then** the
   provisioning action appears with the acting super admin recorded as the
   actor; the super admin themselves is refused the tenant audit read (the
   flag grants the console, not the tenants' trails — the 014 posture
   unchanged).
3. **Given** the super admin's identity, **When** they attempt to read a
   tenant's operational data (rounds, sessions, staff list) through the
   standing paths, **Then** the reach is unchanged from today — the flag
   grants no additional tenant read beyond the console's own aggregates
   (FR-021 posture preserved).

### User Story 3 - The console keeps one coherent tenant picture (Priority: P2)

After onboarding, the new restaurant appears in the platform console's
overview immediately (with its `never_activated` state and fresh usage
figures), so the super admin can proceed straight to activating its
subscription — one surface, no reload rituals, no second list.

**Why this priority**: workflow coherence; low risk, but it is the
difference between a capability and a usable flow.

**Independent Test**: onboard a tenant and observe the console overview
includes it with correct state and zeroed usage — no other surface needed.

**Acceptance Scenarios**:

1. **Given** a completed onboarding, **When** the console overview is
   re-read, **Then** the new restaurant is listed with `never_activated`
   and its usage counters reflect the newly created first owner.

---

### Edge Cases

- What happens when the first-owner email matches an **unclaimed stub**
  identity (an interrupted earlier provisioning)? The stub is completed
  exactly like the staff flow's rule: the account is finished and a
  credential is issued — no dead email, no duplicate.
- What happens when the first-owner email belongs to a **super admin
  themselves**? Allowed — a platform operator may also be a tenant owner
  (the dual-role case the seeded fixtures already model); the membership
  behaves like any owner membership.
- What happens when the onboarding form is submitted with a malformed
  public identifier or empty required fields? Refused with the field-level
  messages the tenant-creation surface already uses; nothing partial is
  created.
- What happens when two super admins onboard the same identifier
  concurrently? The identifier's unique constraint decides — one succeeds,
  the other receives the conflict refusal; no partial state from the loser
  survives (the same all-or-nothing rule the creation RPC already upholds).
- What happens when the super admin onboards a restaurant while its
  subscription will be activated later? Normal and expected — the tenant
  sits in `never_activated` until the console activates it (US2).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a signed-in super admin provision a new
  restaurant — with the same tenant-shaping inputs the tenant-creation
  surface uses (name, public identifier, optional brand description,
  contact email, contact phone, timezone) — from the platform console.
- **FR-002**: The system MUST, in the same indivisible onboarding action,
  provision or link the first owner: an owner membership scoped to the new
  restaurant; a brand-new email yields a provisioned person plus a
  one-time temporary credential; a known email links the existing person
  with no credential issued.
- **FR-003**: The system MUST display the one-time temporary credential
  exactly once to the acting super admin, following the staff-invitation
  credential rule: never logged, never stored in recoverable form, and
  rotatable later through the platform's password-recovery flow.
- **FR-004**: The system MUST refuse onboarding when the public identifier
  is already in use, with the established identifier-conflict refusal, and
  MUST leave no partial restaurant, person, or membership behind on any
  refusal (all-or-nothing).
- **FR-005**: The system MUST validate the onboarding inputs with the same
  rules as the existing tenant-creation surface (identifier shape,
  required fields, timezone validity) — one rulebook, applied at the
  trusted layer regardless of which surface calls it.
- **FR-006**: The system MUST record the onboarding in the audit trail with
  the acting super admin as actor and the created restaurant as the
  resource, following the platform-console audit convention (Phase 13).
- **FR-007**: The system MUST complete an unclaimed stub identity when the
  first-owner email matches one, issuing a credential exactly as the staff
  flow does — the stub never remains a dead end.
- **FR-008**: The onboarding flow MUST NOT alter: the self-bootstrap
  creation path's behavior, the `never_activated` subscription default,
  the standing refusal rules, the reach rules of any existing role (the
  super-admin flag grants no additional tenant reads), or the owner-only
  rule for adding *additional* owners after the first.
- **FR-008a**: The onboarding MUST create the tenant's subscription row
  (the `never_activated` default) in the same indivisible action, so the
  console's overview join sees the new tenant immediately — no row can be
  left missing by a partially-composed creation path.
- **FR-009**: The system MUST reflect an onboarded restaurant in the
  platform console overview immediately, with its derived subscription
  state and usage counters computed the same way as for every other
  tenant.
- **FR-010**: Access to the onboarding capability MUST require the
  super-admin flag and nothing else; the trusted layer re-verifies the
  flag on every call, and the capability is not executable by
  non-super-admin identities or unauthenticated callers.

### Key Entities *(include if feature involves data)*

- **Restaurant**: the tenant created by the onboarding — same shape and
  validation as self-bootstrapped tenants; begins with no branches, no
  tables, no menu, and no subscription dates.
- **First owner**: the person linked or provisioned with an owner
  membership scoped to the new restaurant; for a new person, a
  provisioned sign-in identity with a one-time temporary credential.
- **Super admin**: the acting platform identity — the actor of record for
  the audit entry; gains no standing tenant reach from performing the
  action.
- **Audit entry**: the platform-console record of the onboarding action —
  actor, action, resource (the new restaurant), and the outcome
  (provisioned vs. linked first owner).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A super admin can onboard a new restaurant with its first
  owner in a single flow in under 2 minutes, ending with the owner able to
  sign in.
- **SC-002**: 100% of refused onboardings (identifier conflicts, malformed
  inputs) leave zero partial state — proven by the standing all-or-nothing
  suite extended to this flow.
- **SC-003**: Every onboarding produces exactly one audit entry with the
  acting super admin as actor; the audit surface shows it without any
  reconciliation step.
- **SC-004**: The new owner's first sign-in reaches their restaurant's
  staff area with correct owner-only reach on the first attempt (no
  password reset, no support touch required beyond the one-time
  credential).
- **SC-005**: The standing reach/refusal suites (015's attack surface,
  017's journey posture) pass against onboarded tenants with no new
  exceptions — one rulebook, provably.

## Assumptions

- The platform's credential-delivery assumption (spec 004): the temporary
  credential is relayed by the super admin to the owner out-of-band
  (displayed once in the console); automated email delivery remains out of
  scope platform-wide.
- The first owner is provisioned as a **staff-role owner** (the existing
  `owner` role), not a new platform-side role; ownership semantics are
  unchanged.
- Subscription activation remains a separate, explicit console action
  (Phase 13); onboarding does not auto-activate.
- The existing seeded super-admin identity and the dual-role fixtures
  remain the test identities for this flow.
- Timezone input uses the same zone set the tenant-creation surface
  offers; changing it later follows the existing tenant-edit path.

## Done When

- [ ] All P1 user stories have working implementations and passing tests
- [ ] All FR-001…FR-010 are covered by at least one standing proof
- [ ] The 015 reach suites and the identifier-conflict / all-or-nothing
      proofs pass against onboarded tenants
- [ ] The console shows onboarded tenants immediately (SC-005's one
      rulebook + FR-009 verified together)

## Clarifications

### Session 2026-09-23

- Q: Do the 014 ordering rules apply verbatim to an onboarded, not-yet-activated tenant? → A: Yes — `never_activated` never blocks ordering (only the manual flag does); the scan corrected the draft's contrary implication.
- Q: Who reads the onboarding audit entry? → A: The new restaurant's owner through the tenant audit surface; the super admin is refused the tenant audit read (the flag grants the console, not the tenants' trails).
