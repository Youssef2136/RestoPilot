# Feature Specification: Super Admin and Subscriptions (Phase 13)

**Feature Branch**: `014-super-admin-and-subscriptions`

**Created**: 2026-09-22

**Status**: Draft

**Input**: Master plan §24 (Phase 13 — Super Admin and Subscriptions):
SaaS-level administration. The super admin views all restaurants, views
subscription state, manually activates subscriptions, manually changes
subscription dates, sees basic platform usage, and manually disables
restaurants if required. The subscription lifecycle supports active,
nearing expiration, expired, and manually disabled. Two governing rules:
expiration NEVER automatically disables ordering — the platform owner makes
that decision manually — and an in-app warning generates before expiration
according to the approved timing.

## User Scenarios & Testing *(mandatory)*

### US1 — The platform owner sees every restaurant (P1)

The super admin opens the platform console and sees every restaurant on the
platform with its subscription state, key dates, and basic usage (branches,
staff count, sessions and rounds count). No tenant policy limits this view —
it is the one surface where the platform outranks tenants, and it is reached
only through the `profiles.is_super_admin` flag (no role, no membership).

**Why**: the platform owner cannot steer what they cannot see; §24 names the
all-restaurants view first.

### US2 — The super admin manages the subscription lifecycle (P1, FR-003–FR-005)

From the console, the super admin manually activates a subscription, sets or
changes its subscription dates (start/end), and manually disables the
restaurant. Every change is an explicit platform action: audited, with the
operator identity, and (for disablement) a mandatory reason. Nothing about
expiration happens automatically — an expired subscription is a STATE the
console displays, not a behavior the system performs (the Important rule).

**Why**: §24's lifecycle is manual-first by design; automation is explicitly
rejected.

### US3 — The tenant sees the platform truth (P1, FR-006–FR-007)

A tenant (owner) signing in sees their restaurant's subscription state in
the dashboard shell: active (no noise), nearing expiration (the in-app
warning, shown before expiration per the approved timing), expired (an
informational banner — ordering is NOT blocked), and disabled (ordering and
staff surfaces refuse; the platform made that call). A disabled restaurant
is closed for business everywhere: entry, ordering, and staff reads fail
with the documented refusal.

**Why**: the tenant surface is where the two governing rules become visible:
expired ≠ disabled, and disabled = the platform's manual decision.

### US4 — Basic platform usage (P2, FR-008)

The console shows one usage figure per restaurant (branches, staff, sessions,
rounds) — read-time aggregates over existing rows, no usage-tracking tables.

**Why**: "basic platform usage" per §24; the normalized data already encodes
it (§23's anti-drift rule applied platform-wide).

### Edge Cases

- A super admin disabling an already-disabled restaurant: the action is
  idempotent; no second audit row is written for a no-op.
- A subscription end date moved into the past while active: the state reads
  "expired" at the next read; no write accompanies the read.
- A disabled restaurant's customers at entry: the public entry flow refuses
  with the documented "restaurant is not available" message — no existence
  leak beyond what the public page already shows.
- A super admin cannot disable themselves out of platform reach (the flag
  lives on profiles; disabling a restaurant never touches identities).
- A restaurant created with no subscription row yet: the console shows it as
  never-activated; the tenant sees no banner (nothing is owed yet).

### Assumptions

- "Approved timing" for the nearing-expiration warning: the warning shows
  when the subscription's end date is within 7 calendar days or less, and
  remains until the date passes (then the state reads expired).
- One subscription row per restaurant (created with the restaurant, default
  state `never_activated`), changed in place — the console displays the
  current truth, not a billing history.
- Disabled means a platform flag on the restaurant, not a subscription
  state: the lifecycle states describe the DATES; disabled is the manual
  kill-switch. Both render distinctly.
- No payments, invoices, plans, or pricing — the phase is administration,
  not billing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system provides a super-admin-only console listing every
  restaurant with its subscription state, dates, disabled flag, and usage
  figures; access requires `profiles.is_super_admin` and nothing else.
- **FR-002**: The system derives each restaurant's subscription state at
  read time from its dates and manual flag: `never_activated` (no dates
  set), `active` (now within [start, end]), `nearing_expiration` (end within
  7 days), `expired` (past end), `disabled` (manual flag) — never stored as
  a redundant column that can drift.
- **FR-003**: The system lets the super admin manually activate a
  subscription by setting its dates; the action is audited with the
  operator.
- **FR-004**: The system lets the super admin change subscription dates;
  the action is audited with before/after in the audit reason.
- **FR-005**: The system lets the super admin manually disable or re-enable
  a restaurant, requiring a non-empty reason (≤500 chars), audited; the
  action is idempotent (no second audit row for a no-op).
- **FR-006**: The system blocks all customer entry and ordering for a
  disabled restaurant — the public entry flow and the round submission RPC
  refuse with the documented message — while leaving tenant data intact.
- **FR-007**: The system shows tenants their subscription state in the staff
  dashboard: nearing expiration renders the in-app warning (≤7 days),
  expired renders an informational banner that does NOT block ordering, and
  disabled renders the platform-disabled notice.
- **FR-008**: The system reports per-restaurant usage (branch count, staff
  count, session count, round count) derived at read time from existing
  rows.
- **FR-009**: The system refuses every console RPC for non-super-admins
  with the generic refusal (no existence leaks, the 009 posture), and the
  console route renders the explicit denial for any other identity.
- **FR-010**: The system keeps expiration passive: no job, trigger, or
  write ever fires BECAUSE a subscription passed its end date.

### Key Entities

- **Subscription** — one row per restaurant: start/end dates, manual
  disable flag + reason + actor; state derived at read time (FR-002).
- **Platform usage** — read-time counts per restaurant (branches, staff,
  sessions, rounds).
- **Super admin** — a `profiles.is_super_admin` identity; the ONLY key to
  the console surface.

### Clarifications

*(none — §24's two governing rules (manual expiration, in-app warning) plus
the established audit/refusal/read-time-derivation conventions resolve every
question; the ≤7-day warning window and the never_activated default are
stated assumptions)*

## Review & Acceptance Checklist

*GATE: Quality gates for the implement phase — the reviewer owns these.*

- [ ] Super-admin reach proven (flag-only access; every tenant role refused)
- [ ] Lifecycle states derived at read time (no stored state column)
- [ ] The Important rule proven: expired subscription blocks nothing
- [ ] Disablement blocks entry + ordering and is audited + idempotent
- [ ] The ≤7-day warning and expired banner render for tenants
- [ ] No billing semantics (plans/invoices/pricing) introduced

---

*Phase 13 of RestoPilot-Master-Plan.md (§24). Builds on 002 (tenancy), 003
(auth + is_super_admin flag), 005 (audit discipline), 009 (refusal
vocabulary).*
