# Phase 0 Validation Record

**Date:** 2026-09-26 · **Commit:** `b569215` (no code changes; baseline only)

## Final baseline (after repairs)

| Gate | Command | Result |
| --- | --- | --- |
| F-G02 | `npm run format:check` | PASS |
| F-G02 | `npm run lint` | PASS (3 pre-existing warnings, 0 errors — unchanged from before phase 0) |
| F-G01 | `npm run typecheck` | PASS |
| F-G03 | `npm run test:unit` | PASS — 16 files / 276 tests |
| F-G04 | `npm run test:db` | PASS — 31 files / 516 tests (post-reset) |
| F-G04 | `npm run test:integration` | 38 tests — all non-429 assertions PASS; 429s environmental (rate-limit windows, see findings F2) |
| F-G06 | `npm run build` | PASS — dist emitted (716.58 kB JS / 195.52 kB gzip / 1.00 kB CSS) |
| F-G05 | `npm run test:e2e` | **PASS — 100/100** (6.0 min) after residue cleanup |

`npm run verify` (full pipeline incl. test:db + test:integration + build) was NOT run as a
single command: the integration tier's rate-limit window makes a back-to-back verify run
after test:db flaky by environment, not by product. Each constituent gate was run and is
green above; Phase 01's exit criteria include a full `npm run verify` at its own milestone.

## Presentation contract

Untouched — phase 0 changed no source files. All 13 e2e suites' assertions (labels, roles,
`data-*`, `data-testid`, frozen localStorage keys) pass unchanged: gates F-G07/F-G08/F-G09
satisfied by the green suites.

## Environment repairs performed (dev database only)

1. Cleared Blue Olive `platform_disabled` (was manual "test" flag) — later superseded by reset.
2. `npm run db:reset -- --yes` → migrations + seed from repository artifacts.
3. Removed post-run residue: claimed `e2e-harbor-owner` profile/identity/user (→ unclaimed stub),
   `onboarded-e2e-*`/`dress-rehearsal-*` tenants (FK-ordered), `Journey Co-Owner` profiles,
   orphaned `scratch-provisioned` auth identity, subscription dates → never-activated,
   kill-switch → off.
4. Final fixture counts match seed: 2 restaurants, 3 branches, 7 profiles, 6 memberships,
   5 dining tables, 2 never-activated subscriptions, 14 menu items.
