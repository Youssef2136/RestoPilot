# Phase 04 Validation (specs/024-auth-and-customer-entry-ux)

Final validation 2026-09-29, all on the clean `db:reset` base (D7), branch `main`, baseline `b14ad19`.

## Gates

| Gate | Command | Result |
| --- | --- | --- |
| Format | `npm run format:check` | PASS (3 e2e files reformatted first) |
| Lint | `npm run lint` (eslint + jsx-a11y) | PASS |
| Typecheck | `npm run typecheck` (tsc -b) | PASS |
| Unit | `npm run test:unit` | **362/362** (28 files) |
| Database | `npm run test:db` | **516/516** (31 files) |
| Integration | `npm run test:integration` | **38/38** (7 files) |
| Build | `npm run build` | PASS — 743.05 kB (gzip 204.10 kB) |
| E2E (full) | `npm run test:e2e` | **150/150, 0 failed, 0 did not run** (9.1 min, 2 workers + mobile/tablet projects) |
| Design | `npx impeccable detect src` | **0 anti-patterns** (after F5 fix) |
| A11y | axe WCAG 2.2 AA baseline | 4/4 routes incl. new `/r/blue-olive` |

## Convergence evidence (targeted runs)

| Run | Result |
| --- | --- |
| `realtime.test.ts --grep "kitchen queue"` (after F2 fix) | 1/1 (23s) |
| `realtime + management.surfaces` (marinaT1Lock pair) | 18/18 (1.8 min) |
| `platform.surfaces + realtime` (entryLock contention pair, after F3 fix) | 11/11 (1.3 min) |
| Full `npm run test:e2e` (final) | **150/150** |

## Mid-phase incident (recorded)

- First full run (before F3): 146 passed / 1 failed (realtime SC-001 timeout) / 3 did not run.
- `npm run verify` db group failed once with 17 tests — cause: E2E residue (`onboarded-e2e-*` memberships) on the shared dev database; resolved by `db:reset --yes` + re-run (F4/D7), NOT a code regression.
- An earlier `db:reset` was interrupted mid-run (user abort) leaving the DB schema-less; completed the reset before further validation (F4).

## Prior in-phase validation

- T007 gate: `npm run verify` GREEN (unit 362, db 516, integration 38, build 1.88s) on 2026-09-28.
- routes 7/7, entry.mobile 2/2, a11y baseline 4 routes, realtime customer-submission fix (F1) proven before the full-run convergence.
