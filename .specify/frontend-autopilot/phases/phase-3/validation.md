# Phase 03 — Validation

**Date:** 2026-09-28 · **Gate command:** `npm run verify` + `npm run test:e2e` (docs/development.md step 9)

| Gate | Command | Result | Evidence / notes |
| --- | --- | --- | --- |
| Format | `prettier --check .` (in verify) | PASS | 13 files auto-formatted once mid-phase; clean at the gate |
| Lint (incl. a11y) | `npm run lint` (in verify) | PASS | jsx-a11y over `src/**` — no errors |
| Typecheck | `tsc -b` (in verify) | PASS | clean after every change round |
| Unit | `npm run test:unit` | PASS | 349/349 (incl. navigation persona matrix 9, ui structure 34 with the toast-region pin, auth.guards with `expired: true`) |
| DB | `npm run test:db` | PASS | **516/516** on the reset+seeded database (runs before E2E residue exists) |
| Integration | `npm run test:integration` | PASS | **38/38** — serialized via `--no-file-parallelism` (structural fix for the provisioning/signin race, findings F9) |
| Build | `npm run build` (in verify) | PASS | 740.82 kB JS / 20.70 kB CSS |
| Build grep | dist scan | **GALLERY-EXCLUDED** · tokens once | `dev/gallery` absent from `dist/assets/*.js`; `--color-brand:` definitions: 1 |
| E2E full | `npm run test:e2e` | **146/146** (8.5m) | includes the new `e2e/shell.test.ts` 11/11 (two shells, persona nav matrix, aria-current, mobile drawer, context persistence, confirm-dialog close, offline Retry, sign-out) |
| Impeccable detect | `npx impeccable detect src` | **0 findings** (exit 0, JSON `[]`) | scoped pass on `src/components/shell` + navigation + DashboardPage also 0 |
| Screenshots | evidence captures | committed | `specs/023-application-shell-and-global-ux/evidence/`: staff desktop 1440, staff mobile drawer 390, customer 390, offline + recovered banners (DPR 2) |

## Convergence rounds (FIX → TARGETED_VALIDATE)

1. **Round 1 (residue + strict-mode):** duplicate journey-tenant Harbor branches (same-day reruns) blocked a branch delete via `audit_log` then `dining_tables` FKs → FK-safe ordered cascade delete script; full-journey strict-mode collisions after the toast landed (regex matched inline status + toast) → assertions pinned to `getByRole('status')`. full-journey 3/3.
2. **Round 2 (parallel flakes):** Fiona's password re-poisoned mid-run by the concurrent auth.routes walkthrough (sign-ins of OTHER suites redirected to /signin); reports US3 void dialog drift; 4 "did not run". → full-suite round: 126 passed / 5 failed, root causes separated.
3. **Round 3 (structural fixes):** shared resilient `signInAs` (3-attempt retry) across all 11 specs; cross-file `fionaLock` (mkdir mutex): brief on Fiona sign-ins, held across the walkthrough's poisoned window and the journey's whole span; reports US3 scoped to `data-round-id` (bill.void.audit pattern); reports rounds moved T3→T2 (cross-file T3 pileup); platform onboarding owner email made per-run unique; auth.routes password describe serialized. Targeted 4-file run: 36/36.
4. **Gate:** full E2E 135/135 → T011 `e2e/shell.test.ts` written (11/11 first run) → verify green → final full E2E **146/146**.

## Environment notes

- `db:reset --yes` + `types:gen` twice during convergence; generated types unchanged (`git status` clean on `src/types/database.types.ts`).
- verify must run BEFORE a full E2E pass or after `db:reset`: E2E residue (journey tenant, extra owner identity) breaks exact-seed DB assertions by design (17 failing files mid-gate were all this class; green after reset).
- The 31-worker vitest burst immediately after `db:reset` produced one transient connection pile-up (48 fails) that fully resolved on rerun — recorded as ENVIRONMENT, no code change.
