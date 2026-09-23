# Research: Super-Admin Tenant Onboarding

**Feature**: [spec.md](spec.md) · [plan.md](plan.md) · Created 2026-09-23

## R1 — The provisioning primitive already exists (compose, don't reinvent)

- **Decision**: the onboarding RPC calls
  `private.provision_staff_identity(p_email, p_display_name)` unchanged.
- **Verified behavior** (migration 20260916203911, read in full): three
  cases — no identity ⇒ creates `auth.users` + `auth.identities` +
  `profiles` and issues a one-time credential (`person_created = true`);
  identity without profile (unclaimed stub) ⇒ creates the profile and
  RE-ISSUES the credential (`person_created = false`); identity with
  profile ⇒ links only, `temporary_password = null`. Emails normalized to
  lowercase both ways; display names never overwritten; the email-uniqueness
  race is caught by constraint name and re-raised with a user-facing
  message.
- **Rationale**: FR-002/FR-003/FR-007 are this helper's exact contract.
  Duplicating it would create a second credential rulebook — the thing
  US2's single-rulebook principle forbids.
- **Alternatives considered**: a new platform-specific provisioning
  function (rejected: duplicate credential discipline to maintain and
  attack); direct inserts in the onboarding RPC (rejected: same
  duplication, worse).

## R2 — Tenant creation validation must be shared, not copied

- **Decision**: extract `create_restaurant`'s validation block (name/slug
  shape + conflict, brand/contact lengths, timezone membership in
  `pg_timezone_names`) into `private.validate_tenant_inputs(...)` returning
  the normalized fields; both `create_restaurant` and the new onboarding
  RPC call it. `create_restaurant`'s behavior is otherwise untouched
  (FR-008).
- **Verified**: the conflict message "This public identifier is already in
  use by another restaurant." and the timezone rules live in
  20260916174016 (lines 72–82). `create_restaurant` denies unlinked
  identities with 42501 — that path is preserved; the onboarding RPC's
  guard precedes any validation.
- **Rationale**: FR-005's "one rulebook, applied at the trusted layer". The
  standing management + security suites protect the refactor.
- **Alternatives considered**: copy the validation into the new RPC
  (rejected: the rulebooks drift the first time either changes).

## R3 — The subscription row is part of the onboarding (the console join demands it)

- **Decision**: the onboarding RPC inserts the `subscriptions` row (no
  dates ⇒ `never_activated`) inside the same transaction (FR-008a), and the
  migration ships an **idempotent backfill**
  (`insert … select r.id from restaurants r on conflict do nothing`) so
  pre-existing bootstrap-created tenants become visible too.
- **Verified live**: `get_platform_overview` inner-joins `subscriptions` —
  the two journey-created restaurants ('fiona', 'test') currently have no
  row and are invisible to the console. 014's spec even documents the
  no-row case ("shows it as never-activated") but the deployed join does
  not honor it; the backfill + atomic insert makes the deployed surface
  match the documented contract.
- **Alternatives considered**: changing the overview to a LEFT JOIN with a
  synthesized `never_activated` (rejected: edits the 014 surface and hides
  a genuine data-integrity gap; the row-per-restaurant invariant is 014's
  own assumption).

## R4 — Authorization and reach (FR-008b / FR-010)

- **Decision**: the new RPC follows the 014 console pattern exactly:
  `v_profile_id := private.ops_profile_id()`; refuse with the console
  denial (42501, "You do not have permission to view the platform
  console.") unless `private.is_super_admin_profile(v_profile_id)`. No
  grant to `anon`/`public`. No new policies, no new reads — the flag's
  standing reach is byte-identical after this phase.
- **Verified**: the pattern lives in all four 014 console RPCs;
  `private.ops_profile_id()` is the shared JWT→profile helper.
- **Alternatives considered**: a separate `platform` role (rejected: the
  flag is the documented single key; a second key is a new attack surface).

## R5 — Audit entry shape (FR-006)

- **Decision**: one `audit_log` row per successful onboarding — action
  `'platform.restaurant_onboarded'`, resource_type `'restaurant'`,
  resource_id = the new restaurant's id, restaurant_id = the same,
  reason = `first owner provisioned` / `first owner linked` (the outcome
  distinction the client also displays).
- **Verified**: matches 014's rows (`platform.subscription_dates_set`,
  `platform.platform_disabled_set`) and the foundation schema (actor,
  action, resource_type, resource_id, reason, restaurant_id NOT NULL —
  satisfied because the audit insert follows the restaurant insert).
- **Read reach**: the owner reads it via the standing tenant surface; the
  super admin is refused (014 Walkthrough D) — no change.

## R6 — Client surface (the console form + credential display)

- **Decision**: a new `OnboardingPanel` section above the overview table in
  `PlatformConsolePage.tsx`, following `StaffManagementPanel`'s established
  patterns: form state preserved on refusal, server messages verbatim,
  and the `IssuedCredential` one-time display (secret + outcome note +
  copy affordance, cleared on the next action, never logged).
- **Verified**: `StaffManagementPanel.tsx` lines 15–29 and 64–71 define the
  pattern; the platform module already has `platformOverviewKey()` to
  invalidate after a successful onboarding (US3's immediate visibility).
- **Alternatives considered**: a separate route (rejected: US3 wants one
  surface; the console is where the operator already works).

## R7 — Test strategy

- **Decision**: one db suite (`platform.onboarding.test.ts`) in the house
  style — `runAs`/`asUser` rolled-back transactions, fixture identities:
  (a) reach matrix (super admin OK; owner/manager/cashier/kitchen/anon
  refused 42501); (b) the three provisioning cases + owner membership
  + subscription row (all-or-nothing: identifier conflict ⇒ nothing
  persists — proven inside the rolled-back transaction by counting rows
  after the refusal); (c) audit row (actor + action + outcome in reason);
  (d) post-onboarding reach: the new owner passes the standing
  owner-reach queries for their restaurant and fails every other
  tenant's; (e) the duplicate-membership index
  (`staff_memberships_no_duplicates`, verified live) guards the race.
- **Unit**: extend `platform.test.ts` with the client mapping (verbatim
  messages, denial shape). **E2E**: extend `platform.surfaces.test.ts`
  with the walkthrough (form → credential shown once → owner signs in →
  console shows the tenant).
- **Rationale**: mirrors 014's test file layout exactly; zero new test
  infrastructure.
