# Quickstart: Super Admin and Subscriptions (Phase 13)

Created 2026-09-22 · the executable walkthroughs for spec 014, run through
the real development project (real sign-ins, real RPCs, real ordering).

## Prerequisites

- `npm run db:reset -- --yes` for a deterministic fixture (the seed
  provisions both restaurants with `never_activated` subscriptions and the
  platform admin with no memberships).
- `node --env-file-if-exists=.env scripts/run-platform-walkthroughs.mjs`
  runs all walkthroughs end to end and prints a PASS/FAIL transcript. The
  script is re-runnable: a setup phase repairs the fixture through the admin
  connection first (the RPC deliberately refuses to null dates, so only a
  direct update can restore `never_activated` after a previous run).

## Walkthrough A — the console read (US1, FR-001/FR-002/FR-008)

The platform admin signs in with no memberships — the `is_super_admin` flag
is the only key — and reads `get_platform_overview`: both restaurants with
their derived lifecycle, usage counts, and disable flag. Setting dates
flips the derived state at read time (`active`, then `nearing_expiration`
inside the 7-day window); nulling dates is refused ("Both subscription
dates are required.") — the lifecycle is manual-first and dates are SET,
never cleared.

## Walkthrough B — reach (FR-009)

Owner, cashier, and anon are all refused the console with the generic
42501 shape. The flag grants nothing to anyone else, and the RPC is not
even executable by anon.

## Walkthrough C — the two doors and the Important rule (FR-006)

A live dine-in round submits against the never_activated fixture (ordering
is free). Disabling Blue Olive makes the entry door
(`open_session_at_table`) and the ordering door (`submit_round`) refuse
with the verbatim "This restaurant is not available." — the existence of
the message is the contract, not an existence leak. Re-enabled and set
EXPIRED (−30 → −1), the same round submits again: **an expired subscription
never blocks ordering** — only the manual flag does. Re-enable confirmed
while the state still reads `expired`: two axes, independently displayed.

## Walkthrough D — the audit trail (FR-005)

Every disable/enable lands in the audit trail with the operator and reason,
and reaches the affected restaurant's OWNER through Phase 10's tenant reach
(`get_audit_log` as alice). The platform admin is refused the tenant audit
read: the flag grants the console, not the tenants' trails.

## Restore

`npm run db:reset -- --yes && npm run db:seed` returns the fixture to its
deterministic state (the walkthrough's subscriptions/disablements/audit
rows included). The quickstart's own restore discipline — reset, don't
reconcile — holds.

---

## Validation record (2026-09-22)

`scripts/run-platform-walkthroughs.mjs` — **17/17 checks PASS** against the
real development project: real hosted-auth sign-ins (platform admin, alice,
carla), real RPCs through the data API, live ordering through the seeded
dev-token, live disablement + restore, live audit assertions in both
directions (owner sees the platform actions; the platform admin is refused
the tenant read). Two walkthrough findings became contract clarifications,
not code changes: dates are set-never-cleared (A6 asserts the refusal), and
the audit read keeps the Phase 10 tenant reach (D2 asserts the platform
admin's own refusal). The setup phase's fixture repair is documented above.
