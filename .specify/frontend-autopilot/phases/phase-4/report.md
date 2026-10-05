# Phase 04 Report — Authentication, Account & Customer Entry UX

**Status: DONE · CONVERGED (3 convergence rounds) · 2026-09-29**
**Spec:** `specs/024-auth-and-customer-entry-ux` · **Baseline:** `b14ad19` (phase 023)

## Objective

Re-skin the auth surfaces and the customer entry journey onto the 022 design system without touching the frozen spec-020 semantics; land the real `/` landing (C2) and the `/order/:branchId` redirect (C1); extend the E2E floor (mobile entry completion, entry-route a11y baseline); keep all 20+ existing suites green.

## Requirements → implementation → validation

| Requirement | Implementation | Validation |
| --- | --- | --- |
| FR-01..03 auth re-skin | `AuthCard` primitive (`src/components/auth/`) re-skinning `/signin`, `/reset-password`, `/account/password`; autocomplete audit; zero flow change | auth.routes verbatim walkthroughs green; unit pins |
| FR-04..06 entry presentation split | `CustomerShellHeader` / `ChannelSelector` / `SessionJoinNotice` + `entry.module.css`; RestaurantEntry re-skinned (sticky CTA, inputMode/autoComplete, focus-on-invalid); labels + logic frozen | session.surfaces, entry.mobile 2/2 |
| FR-08/09 C1+C2 | Real `/` landing (two real ways in); `/order/:branchId` → landing with branch echo; routes.ts meta | routes.test.ts 7/7 (C1 + C2 pins migrated) |
| Gates/UX/a11y | Mobile-viewport entry completion E2E; axe baseline extended with `/r/blue-olive`; console-clean entry navigation | entry.mobile 2/2; a11y.baseline 4/4 |
| FINISH | 5 evidence screenshots (390px entry steps, signin desktop+mobile, `/` landing) | committed with the checkpoint |
| Checkpoint/Report | `feat(024)` commit + push (auto-push rule); report + ledger + state DONE | this file; contracts ledger §Phase 024 |

## Files changed

**New:** `src/components/auth/` (AuthCard), `src/features/session/components/entry/{CustomerShellHeader,ChannelSelector,SessionJoinNotice,entry.module.css}`, `src/routes/RootPage.module.css`, `e2e/entry.mobile.test.ts`, `e2e/helpers/{entryLock,marinaT1Lock}.ts`, `tests/unit/routes-decisions.test.tsx`, `specs/024-auth-and-customer-entry-ux/`, evidence ×5 PNGs.
**Modified:** `RestaurantEntry.tsx`, `RootPage.tsx`, `OrderPage.tsx`, `SignInPage.tsx`, `src/app/routes.ts`, `e2e/{routes,a11y.baseline,realtime,platform.surfaces,management.surfaces,full-journey,bill.void.audit,kitchen.cashier,reports.surfaces}.test.ts`, `tests/unit/routeRegistry.test.ts`, `docs/frontend-presentation-contracts.md`.

## Backend contracts used

NOT_REQUIRED → no backend change. Consumed as-is: auth (sign-in/reset/update), public restaurant payload (ACTIVE tables only), session enter, `set_dining_table_active` RPC (browser-path flips only), realtime channels. The dev database was reset to the canonical seed mid-phase (D7); production untouched.

## Design / Impeccable

`impeccable detect src`: **0 anti-patterns** (final; one `.deepLinkNote` 3px one-sided border removed — F5). Visual review of the 5 evidence screenshots: the three 390px entry steps, the `/` landing, signin desktop — consistent with the 022 token system; frozen verbatim labels verified byte-identical.

## Validation results

`npm run verify` **PASS** (prettier, eslint+jsx-a11y, tsc, **unit 362/362**, **db 516/516**, **integration 38/38**, build 743.05 kB / gzip 204.10 kB) + `npm run test:e2e` **150/150 — 0 failed, 0 did not run** (9.1 min). All on the clean `db:reset` base.

## Fixes & convergence

3 rounds. R1 (carried): customer-submission fixture → `state:'attached'` option wait + branch-aware diagnostic (F1). R2: marinaT1 flip hydration race → row-wait before the toggle probe + `toPass` click+assert retry (F2). R3: entry-lock contention → platform's hold narrowed from file-spanning to the kill-switch window + afterAll re-enable safety net + realtime SC-001 queueing budget (F3). Incident: interrupted `db:reset` left a partial DB — completed the reset, re-proved verify (F4/D7). Full detail: findings.md F1–F5, decisions.md D1–D8.

## Git checkpoint

`feat(024)` on `main` (baseline `b14ad19`), pushed to origin per the standing auto-push rule. Untracked-by-design leftovers: `.agents/`, `.freebuff/`, `.zcode/`, `.specify/frontend-autopilot/`, `RestoPilot-Frontend-Master-Plan.md`, `DESIGN.md`.

## Remaining warnings

- R1 (carried): E2E leaves tenant residue by plan design — run verify before full E2E or reset first.
- R2 (carried): Impeccable launcher still detect-only.
- R3 (new): the disable test can briefly leave Blue Olive kill-switched for concurrent files until the afterAll safety net fires — bounded, self-healing (D5).

## Traceability

Spec FR-01…FR-09 → the files above → routes/entry.mobile/a11y.baseline/session/management suites + the full 150/150 run; new presentation contracts and E2E coordination helpers recorded in `docs/frontend-presentation-contracts.md` §"Phase 024 presentation record".
