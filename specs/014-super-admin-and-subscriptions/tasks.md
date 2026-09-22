# Tasks: Super Admin and Subscriptions (Phase 13)

**Feature**: `014-super-admin-and-subscriptions` | [Spec](spec.md) | [Plan](plan.md)

**Conventions**: `[P]` = parallelizable. Tests follow the house suites
(`tests/database/*.test.ts`, `tests/unit/`, `e2e/` serial, writes through
real browser surfaces).

## Phase 1: Setup + migration

- [X] T001 Read §24, prior contracts (002 tenancy, 003 auth/audit, 009
      refusals), the audit helper shape, and the entry/submit RPC bodies;
      set `.specify/feature.json`
- [X] T002 Migration `20260922110000_platform_admin.sql`: `subscriptions`
      table (one row per restaurant, idempotent seed for existing
      restaurants), `restaurants.platform_disabled` + reason/actor columns;
      four RPCs (`get_platform_overview`, `get_my_subscription`,
      `set_subscription_dates`, `set_restaurant_platform_disabled`); the
      disablement predicate in the entry RPCs + `submit_round`; grants
      (plan D1–D4)
- [X] T003 `npm run types:gen`; contracts/database-functions.md for the four
      RPCs + the new refusal message

## Phase 2: Database tests

- [X] T004 Reach + derivation suite `tests/database/platform.admin.test.ts`:
      super-admin-only matrix, state CASE matrix incl. the 7-day boundary,
      no-write state flips (the Important rule), audit + idempotence
- [X] T005 Enforcement suite `tests/database/platform.enforcement.test.ts`:
      disabled → entry + submit refusals verbatim, re-enable restores,
      expired → ordering succeeds, tenant data intact

## Phase 3: Client + surfaces

- [X] T006 `src/features/platform/`: client (RPC calls, refusal mapping) +
      hooks
- [X] T007 Platform console under `/admin` (or `/admin/platform`):
      all-restaurants table with state, dates, disabled flag, usage, and
      the activate/dates/disable controls with reason prompt
- [X] T008 Tenant banner component in the dashboard shell (active silent /
      nearing warning / expired informational / disabled notice /
      never-activated silent)
- [X] T009 Contracts doc for the tenant payload + banner rules

## Phase 4: Tests + polish

- [x] T010 Unit suite `tests/unit/platform.test.ts`: client contract +
      banner-state selection
- [X] T011 E2E `e2e/platform.surfaces.test.ts`: console as super admin
      (all restaurants visible, dates set, disable with reason, re-enable);
      tenant banners; non-flag deep-link denial; disabled entry refusal
- [X] T012 Full gates: `npm run verify` + full e2e
- [x] T013 `docs/development.md` Phase 13 entry; quickstart walkthrough
      script + validation record
- [x] T014 Determinism: reset → seed → full db regression → `types:gen`
      byte-identical
- [x] T015 Post-implement analyze record + final commit

## Notes

- The Important rule is the phase's spine: expiration is passive — nothing
  in the migration may fire on a date.
- Disablement blocks the customer doors only (entry + submit_round); staff
  reads stay open (the banner explains).
- Reviewer-owned checklist items in
  `checklists/platform-authority-and-lifecycle.md` stay unchecked (house
  convention since 005).

## Post-implement analysis record (2026-09-22)

Verified the deployed surface against contracts/database-functions.md via
live pg_catalog probes: all four platform RPCs `security definer`,
`authenticated`-only (anon has no EXECUTE); the three doors keep
`security definer` + anon EXECUTE with the verbatim canonical bodies (one
inserted predicate each); `subscriptions` carries exactly the four declared
columns with `restaurant_id` PK; zero stored lifecycle columns anywhere
(read-time derivation only, probed). Audit actions are the three contract
names, idempotent writes only. Two walkthrough findings were resolved as
contract clarifications (dates set-never-cleared; audit read keeps Phase 10
tenant reach) — both asserted in the walkthrough script (A6, D2). Gaps
found and closed by this analyze: the missing contracts/database-functions.md
artifact (T003/T009 pointer) written against the deployed surface, and T010
confirmed complete (8/8 unit tests, green in verify's 244). All 15 tasks
verified complete.
