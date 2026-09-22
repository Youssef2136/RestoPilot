# Implementation Plan: Super Admin and Subscriptions (Phase 13)

**Branch**: `014-super-admin-and-subscriptions` | **Spec**: [spec.md](spec.md) | **Created**: 2026-09-22

## Summary

One new table (`subscriptions`, one row per restaurant) and one manual flag
(`restaurants.platform_disabled` + reason/actor columns) carry the whole
phase. The lifecycle state (`never_activated`/`active`/`nearing_expiration`/
`expired`) is DERIVED at read time from the dates — no stored state, no job,
no trigger (FR-002/FR-010). Two security definer RPC families: the platform
console (list-all-restaurants with usage, set subscription dates, set
disable flag — all gated on `profiles.is_super_admin` and audited) and the
tenant read (`get_my_subscription` — the dates + flag as the payload, state
derived client-side from the payload's dates for display only; the SERVER
derives disablement effects). Disablement blocks the public entry RPC and
`submit_round` with a documented refusal; ordering under an expired
subscription is untouched (the Important rule, FR-010).

## Technical Context (from the codebase)

- `profiles.is_super_admin` exists since Phase 3; `current_auth_context` already exposes it to the client; the seeded `platform-admin@restopilot.dev` / `dev-platform-admin-2026` identity is super-admin-flagged
- `audit_log` (Phase 5) carries actor/action/resource/reason with a restaurant-scope FK; staff RPCs write audit rows inline (Phase 6+ convention); `get_audit_log` reads the trail (owner/manager reach)
- `restaurants` (Phase 2) is the tenant root: id, name, slug, contact columns — no subscription columns exist yet
- Refusal vocabulary: generic `42501`/`P0001` with verbatim messages (009 posture); disablement needs a NEW public-facing message ("This restaurant is not available.")
- Client: `src/features/management/` module shape (`*Client.ts` + hook + components), React Query everywhere, staff shell routing with in-page gates (`AuditLogPage` posture)
- The `admin` area (`/admin`, `AdminPage.tsx`, `SuperAdminGate`) already exists for the flag-carrying identity — the console mounts under it

## Constitution Alignment

- **I (client displays the server's captured truth)**: the console and tenant banner render RPC payloads verbatim; state labels derive from server-provided dates per the documented rule
- **II (money math is server-only)**: usage figures are counts computed in SQL; nothing client-computed
- **III (engines in the database)**: state derivation is one SQL CASE in the read RPCs; no client logic beyond choosing which banner to render from the derived state
- **IV (data layer is the boundary)**: console RPCs verify `is_super_admin` on every call; the route gates are presentation only; disablement enforcement lives in the entry/submit RPCs, not the client
- **V (privacy)**: the console shows operational metadata only (names, counts, dates); no customer PII beyond existing counts

## Design Decisions

### D1 — Subscription state is derived, never stored (FR-002, FR-010)

`subscriptions(start_date, end_date, disabled... )` — actually two axes:
dates on the subscription row, and `platform_disabled` + reason/actor on the
restaurant (disablement is a property of the restaurant per the spec's
Assumptions). The state is a CASE over `now()` vs the dates, with
`platform_disabled` overriding for display. NO trigger, NO cron, NO stored
state column: an expired subscription is a read-time fact (the Important
rule's mechanical guarantee — nothing exists that COULD fire on expiry).

### D2 — Disablement is a guarded UPDATE with idempotent audit

`set_restaurant_platform_disabled(p_restaurant_id, p_disabled, p_reason)`:
validate reason (mandatory non-empty ≤500 when disabling), verify the
super-admin flag, then the guarded update
`where id = $1 and platform_disabled <> p_disabled` — `row_count = 0` means
either no-op (already in that state → success, no audit row) or unknown
restaurant (→ generic refusal). One audit row per actual state change.

### D3 — Enforcement at the two doors

Disablement blocks exactly the customer-facing doors: `open_session_at_table`
/ `open_session_channel` (entry) and `submit_round` (ordering). Each gains
one predicate: refuse when the restaurant's `platform_disabled` is true, with
the same verbatim message. Staff RPCs are NOT blocked (the platform may want
staff to still see their data; §24 only says "manually disable restaurants",
and the tenant banner explains the state). Expiry touches nothing.

### D4 — One console RPC, one tenant RPC

`get_platform_overview()`: all restaurants × {subscription payload, derived
state, usage counts} in one jsonb (the console's single read).
`get_my_subscription()`: the caller's restaurant's payload + derived state
(resolves the restaurant from the identity's owner membership; non-staff →
null payload, the display needs no data). Writes: `set_subscription_dates`
(activate/change — one action, before/after in the audit reason) and
`set_restaurant_platform_disabled`. Four functions total; every one
re-verifies the flag or the membership server-side.

### D5 — The warning window is data, not configuration

The ≤7-day nearing-expiration threshold is a constant in the SQL derivation,
documented in the contract. Changing it later is a one-line migration — not
a new settings table (§24 says "according to the approved timing"; 7 days is
the approved timing, stated in the spec's Assumptions).

## Risks / Trade-offs

- **One subscription row per restaurant, changed in place** — no billing
  history (explicitly out of scope); the audit log IS the history.
- **Staff surfaces stay readable when disabled** — chosen over blocking:
  §24 grants "manually disable restaurants if required" for ordering
  control, not staff lockout; the flag's effects are enumerated (FR-006)
  and the banner explains the state.
- **`now()` in indexes/views** — none; the derivation sits inside function
  bodies only.

## Verification

- `test:db`: super-admin reach matrix (flag identity OK; owner/manager/cashier/kitchen/anon refused on every console RPC), state derivation matrix (never_activated / active / nearing (boundary 7/8 days) / expired / disabled-overrides), audit rows (dates change → before/after; disable → reason; no-op → no row), disablement enforcement (entry + submit_round refuse verbatim; expired → ordering succeeds), idempotent disable
- unit: client parameter/error mapping, state-label selection from the payload
- e2e: platform console renders all restaurants as the super admin; tenant banner states (active silent / warning ≤7d / expired non-blocking / disabled); non-super-admin deep link denial; disabled restaurant entry refusal through the public surface
- quickstart walkthroughs: real sign-ins through the whole lifecycle with restore
