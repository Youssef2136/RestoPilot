# Checklist: Platform Authority and Lifecycle (Phase 13)

**Purpose**: Domain gate before implementation — the ways a SaaS-admin
feature can go wrong.

**Feature**: [spec.md](../spec.md) | [Plan](../plan.md)

## Authority (who may act)

- [ ] Every console RPC verifies `profiles.is_super_admin` on EVERY call —
      not via role, membership, or JWT claim alone
- [ ] Owner / branch manager / cashier / kitchen / anon: refused with the
      generic 42501, indistinguishable from any other denial
- [ ] The `/admin` console route renders the explicit denial for any
      non-flag identity (presentation gate only; the RPCs re-enforce)
- [ ] Audit rows name the acting super admin (actor_profile_id)

## Lifecycle (derived, not stored)

- [ ] No stored state column exists; the state is one SQL CASE over the
      dates (grep-verifiable against the migration)
- [ ] Boundary precision: `nearing_expiration` exactly when
      `0 < end_date - now() ≤ 7 days`; `expired` when past the end; the
      state flips WITHOUT any write (a read-only proof)
- [ ] `never_activated` for a subscription with no dates
- [ ] The disabled flag overrides the date-derived state for display, and
      the two remain separately reportable

## The Important rule (passive expiration)

- [ ] No trigger, cron, pg_cron job, or conditional write fires on expiry —
      the migration contains none (grep-verifiable)
- [ ] A test drives a subscription past its end date (via dates, not
      clock-mocks) and proves ordering still succeeds
- [ ] The tenant expired banner renders without blocking any staff or
      customer action

## Disablement (the manual kill-switch)

- [ ] Reason mandatory and non-empty (≤500 chars) when disabling
- [ ] Idempotent: disabling a disabled restaurant changes nothing and writes
      no second audit row
- [ ] Both doors refuse verbatim: the entry RPCs (table + channel) and
      `submit_round` reject with the documented "This restaurant is not
      available." message
- [ ] Re-enable restores ordering; staff data was never blocked
- [ ] Tenant data survives disablement (rows intact)

## Tenant truth

- [ ] The owner's dashboard shows the payload-derived banner states:
      active (silent), nearing (warning), expired (informational), disabled
- [ ] A never-activated restaurant shows no banner
- [ ] No billing semantics anywhere: no plans, prices, invoices, payment
      rows (grep-verifiable)

## Walkthrough

- [ ] Quickstart walkthroughs drive the full lifecycle with real sign-ins
      and restore deterministic state afterwards
