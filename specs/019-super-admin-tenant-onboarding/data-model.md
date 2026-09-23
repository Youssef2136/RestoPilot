# Data Model: Super-Admin Tenant Onboarding

**Feature**: [spec.md](spec.md) · [plan.md](plan.md) · Created 2026-09-23

**Schema changes: none.** Every entity below already exists; this feature
only composes them. The contract-level rules that the new RPC must uphold
are recorded here because they are the acceptance surface.

## Entities touched (all existing)

### Restaurant (created by the onboarding)

- Fields as deployed: id, name, slug, brand_description, contact_email,
  contact_phone, timezone, platform_disabled (default false), timestamps.
- Validation (shared helper, FR-005): name required; slug required,
  lowercase letters/digits/single hyphens, unique across the platform
  (conflict ⇒ "This public identifier is already in use by another
  restaurant."); timezone required and must exist in `pg_timezone_names`.
- Starts with: no branches, no tables, no menu, `platform_disabled = false`.

### Subscription (created by the onboarding — FR-008a)

- One row per restaurant (primary key restaurant_id); start_date/end_date
  NULL ⇒ derived state `never_activated` (read-time derivation, 014 §2).
- Lifecycle: `never_activated` until the console sets dates — onboarding
  never sets dates and never flips anything else.

### Profile / auth identity (provisioned or linked — FR-002)

- Via `private.provision_staff_identity` (unchanged): new person ⇒ identity
  + profile + one-time credential; unclaimed stub ⇒ profile + re-issued
  credential; known person ⇒ link only, credential untouched.
- Emails lowercase-normalized; display names only inserted, never updated.

### StaffMembership (created by the onboarding)

- role = 'owner', restaurant_id = the new tenant, branch_id NULL — the
  first-owner membership. Uniqueness guarded by the deployed
  `staff_memberships_no_duplicates` unique index (profile_id, restaurant_id,
  role, branch_id NULLS NOT DISTINCT) — a concurrent identical onboarding
  fails closed.

### Audit entry (written by the onboarding — FR-006)

- actor_profile_id = the acting super admin; action =
  'platform.restaurant_onboarded'; resource_type = 'restaurant';
  resource_id = restaurant_id (text); restaurant_id = the new tenant;
  reason = 'first owner provisioned' | 'first owner linked' (mirrors the
  client's displayed outcome).

## State transitions

```text
Onboarding submitted
  → validate (shared helper)          ── refuse ⇒ NOTHING persisted (FR-004)
  → guard (is_super_admin_profile)    ── refuse ⇒ 42501 console denial
  → insert restaurant                 ── conflict ⇒ verbatim refusal, nothing persisted
  → provision/link first owner        ── email race ⇒ verbatim refusal, nothing persisted
  → insert owner membership           ── duplicate ⇒ fail closed, nothing persisted
  → insert subscription row (never_activated)
  → insert audit row (actor, action, outcome)
  → return { restaurant, owner: { profile_id, temporary_password | null, outcome } }
```

All-or-nothing is transactional (VI): every refusal path leaves zero rows.

## Volume/scale assumptions

Operator-initiated and rare — no concurrency beyond the guarded races
above; no rate limiting introduced (the standing posture has none at the
RPC layer).
