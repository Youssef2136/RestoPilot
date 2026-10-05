# Phase 06 Validation (specs/026-management-ux)

Final validation 2026-09-29, branch `main`, baseline `2cdbe11`.

## Gates

| Gate | Command | Result |
| --- | --- | --- |
| Format | `npm run format:check` | PASS (prettier run on the new files first) |
| Lint | `npm run lint` | PASS |
| Typecheck | `npm run typecheck` | PASS |
| Unit | `npm run test:unit` | **369/369** (client layer untouched — `management.client`/`workingHours`/`management.qr` suites green UNCHANGED) |
| Database | `npm run test:db` | **516/516** (on a clean `db:reset` base — residue incident below) |
| Integration | `npm run test:integration` | **38/38** |
| Build | `npm run build` | PASS — 752.10 kB (gzip 207.14 kB) |
| E2E (full) | `npm run test:e2e` | **161/161, 0 failed, 0 did not run** (9.6 min; 156 prior + 5 new management.staff) |
| Design | `npx impeccable detect src` | **0 anti-patterns** (exit 0, no output) |
| A11y | semantics + denials | `th scope` kept; denial h1s re-verified; read-only badges text-bearing; 390px card fallback asserted |

## Frozen-contract proof (the phase's central risk)

`e2e/management.surfaces.test.ts` 13/13 + `e2e/full-journey.test.ts` 3/3 + shell suites — every
management anchor (h1/h2s, identifier warning copy + confirm/cancel, hours labels, tables
listitems + toggle names, QR heading/payload/downloads, all denial h1s) passed WITHOUT assertion
edits on the re-skinned pages. `workingHours`/`management` unit suites untouched and green.

## Convergence (targeted) evidence

- management.surfaces (restaurant subset) after T002: 3/3.
- management.surfaces (branch subset) after T004: 4/4.
- management.surfaces + full-journey after T005/T006: 17/17.
- management.staff: 1/5 → 5/5 (clipboard permission grant; unique per-run staff names + bounded
  residue cleanup; verbatim server strings — 'sign-in identity remain', 'A restaurant always
  keeps at least one owner.'; Read-only badge count pinned at 2).

## Mid-phase incident (recorded)

First `npm run verify` failed 45 db tests — E2E residue from the new staff-provisioning suite
(scratch identities + memberships) plus prior journey rows; `db:reset --yes` re-run, the full
gate re-proven on the clean base (phase-05 F5's bidirectional rule, applied again).
