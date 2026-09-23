# Quickstart: Super-Admin Tenant Onboarding

**Feature**: [spec.md](spec.md) · [plan.md](plan.md)

## What this phase delivers

1. The platform console gains an **Onboard a restaurant** section: tenant
   fields + first-owner email/display name; on success the console shows
   the one-time credential (new person / completed stub) or the
   linked-account confirmation.
2. One new RPC (`onboard_restaurant`) guarded by the super-admin flag,
   composing the existing provisioning/validation primitives; the
   subscription row and the audit entry land in the same transaction.
3. The standing `create_restaurant` path is behavior-identical (its
   validation is extracted into a shared helper).

## Prerequisites

```bash
npm run db:reset -- --yes && npm run db:seed   # deterministic fixture
npm run types:gen                              # after the migration, types include the new RPC
```

## Walkthrough A — the console flow (US1, US3, FR-001–FR-005, FR-009)

Sign in as `platform-admin@restopilot.dev` / `dev-platform-admin-2026`,
open `/admin/platform`:

1. Fill the onboarding form (a fresh slug + a first-owner email unknown to
   the platform) → the console displays the one-time credential exactly
   once with the "new person" outcome note.
2. Re-read the overview → the new restaurant appears immediately with
   `never_activated`, staff_count = 1 (its first owner), zero usage.
3. Fill the form again with a slug already in use → the verbatim
   identifier-conflict message; form state preserved; nothing created
   (the overview row count is unchanged).
4. Fill the form with an existing platform email (e.g. `dan@…`) → the
   "linked existing account" confirmation, no credential shown.

## Walkthrough B — the new owner's first sign-in (SC-004)

In a private window: sign in as the onboarded owner with the displayed
one-time credential → the staff dashboard shows the new restaurant with
owner reach (create branch/table/menu affordances present) and nothing
from any other tenant.

## Walkthrough C — one rulebook (US2, SC-005, FR-006–FR-008b)

- As the new owner: `/dashboard/audit` shows
  `platform.restaurant_onboarded` with the platform admin as actor and the
  outcome in the reason.
- Ordering from the onboarded tenant succeeds while `never_activated`
  (the 014 Important rule — un-activated never blocks ordering).
- As the platform admin: the tenant audit read and any tenant operational
  surface remain refused — the flag grants the console, not the tenants'
  trails (FR-008b).
- As any seeded non-admin: the console and the new RPC refuse with the
  generic 42501 denial.

## Automated gates

```bash
npx vitest run tests/database/platform.onboarding.test.ts   # reach, all-or-nothing, audit, post-reach
npx vitest run tests/unit/platform.test.ts                  # client mapping
npx playwright test e2e/platform.surfaces.test.ts           # the console walkthrough
npm run verify                                              # the full gate
```

## Restore

`npm run db:reset -- --yes && npm run db:seed` returns the fixture to its
deterministic state (onboarded tenants included). Reset, don't reconcile —
the 014 discipline holds.
