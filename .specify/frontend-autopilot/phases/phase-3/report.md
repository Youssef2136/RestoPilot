# Phase 03 Report — Application Shell, Navigation & Global UX

**Status: DONE · CONVERGED (4 convergence rounds) · 2026-09-28**
**Spec:** `specs/023-application-shell-and-global-ux` · **Baseline:** `306c0ae` (phase 022)

## Objective

Replace the single AppShell with the two-shell architecture (StaffShell / CustomerShell), centralize navigation + context into declaration points, and land the global UX layer (toasts, confirm dialogs, offline banner, expiry note, mobile drawer) without breaking any of the 20+ shipped E2E suites' verbatim presentation contracts.

## Requirements → implementation → validation

| Requirement | Implementation | Validation |
| --- | --- | --- |
| FR-01 two shells, one declaration point | `router.tsx` route groups; AppShell git-rm'd; `design.literals` allowlist 1 | shell.test.ts 11/11; smoke rewritten; unit structure pins |
| FR-02 nav model declaration | `src/app/navigation.ts` (13 staff items + platform group + predicates) | navigation.test.ts 9/9 persona matrix; shell nav matrix |
| FR-03 ContextSwitcher | `ContextSwitcher.tsx` ("Viewing — Where/Scope", sessionStorage `restopilot.dashboard-context`) | shell.test.ts persistence test; unit pins |
| FR-04 dashboard home | DashboardPage: h1 + shortcut tiles (SHORTCUT_ARIA) + scope + branch links + preserved banner/cue/creation panel | E2E across session/management suites green |
| FR-05 toasts | ToastProvider at root (`App.tsx`); BranchSessionsPanel adopts `useToast`; inline text preserved | structure pin (region role); session suites |
| FR-06 ConfirmDialog ×4 | Dialog.tsx `confirmDisabled`; BranchSessionsPanel, StaffManagementPanel, PlatformConsolePage, RoundCard — verbatim names | bill.void.audit 2/2; session/full-journey close flows; shell.test dialog test |
| FR-07 offline banner + onStatus | OfflineBanner (4 states, "Retry now" refetch); realtimeStatus.ts registry; `onStatus` threaded through useRealtimeInvalidation | shell.test.ts offline Retry test; realtime 9/9 |
| FR-08 expiry note | guards carry `state.expired`; SignInPage "Your session has ended…" | auth.guards pin; auth.routes green |
| FR-09 mobile drawer | StaffShell drawer <1024px via Phase-02 Drawer, aria-current inside | shell.test.ts drawer test (480px) |
| FR-10 route titles | untouched registry; no chrome titles | route.titles suite green |
| FR-11 NotAuthorized restyle | Phase-02 vocabulary, heading preserved | platform/management denial suites green |
| FR-12 landmark purity | exactly one `main` per shell; skip link → `#main` | shell.test.ts; a11y.baseline green |

## Files changed

**New:** `src/components/shell/{StaffShell,CustomerShell,ShellNav,ContextSwitcher,OfflineBanner}.tsx` + `.module.css`, `src/app/navigation.ts`, `src/features/realtime/realtimeStatus.ts`, `e2e/shell.test.ts`, `e2e/helpers/{signInAs,fionaLock}.ts`, evidence ×5 PNGs.
**Modified:** `router.tsx`, `App.tsx`, `DashboardPage.tsx`, `SignInPage.tsx`, `guards.tsx`, `Dialog.tsx`, `Toast.tsx`, `useRealtimeInvalidation.ts`, `BranchSessionsPanel.tsx`, `StaffManagementPanel.tsx`, `PlatformConsolePage.tsx`, `RoundCard.tsx`, 11 e2e specs (helper wiring + strict-mode pins), `smoke.test.ts`, unit pins ×3, `docs/frontend-presentation-contracts.md`, `package.json` (integration serialization).
**Removed:** `src/components/AppShell.tsx` + `.module.css`.

## Backend contracts used

NOT_REQUIRED → no backend change. Consumed as-is: auth (sign-in/out, updateUser), `branches` scoped read, dashboard RPCs, all staff-ops/platform RPCs, realtime channels. Database touched only by the dev-project `db:reset` + residue cleanup scripts (dev project, documented in decisions/validation).

## Design / Impeccable

`impeccable detect src`: **0 anti-patterns** (also 0 on the shell/navigations/dashboard scope). Visual review of the 5 evidence screenshots: staff desktop (sidebar+header composition), mobile drawer, customer shell, offline/recovered banner states — consistent with the 022 token system, no layout shift from the fixed banner.

## Validation results

`npm run verify` **PASS end-to-end** (prettier, eslint+jsx-a11y, tsc, unit 349, **db 516/516**, **integration 38/38**, build 740.82 kB) + `npm run test:e2e` **146/146** (includes shell.test.ts 11/11). Build grep: gallery excluded, `--color-brand:` ×1.

## Fixes & convergence

4 rounds (residue/strict-mode → parallel-flake diagnosis → structural fixes: resilient shared signInAs, fionaLock, round-id scoping, T2 move, per-run owner email, describe serialization → gate + T011). Full detail: findings.md F1–F10, decisions.md D1–D11.

## Git checkpoint

`feat(023)` on `main` (baseline `306c0ae`), pushed to origin per the standing auto-push rule. Untracked-by-design leftovers: `.agents/`, `.freebuff/`, `.zcode/`, `.specify/frontend-autopilot/`, `RestoPilot-Frontend-Master-Plan.md`, `DESIGN.md` (phase-022 convention).

## Remaining warnings

- R1: E2E residue persists by plan D1 — run verify before full E2E or reset first (validation.md).
- R2: Impeccable launcher still detect-only (carried from 022).
- The 31-worker vitest burst right after `db:reset` can transiently pile up connections (ENVIRONMENT; rerun settles).

## Traceability

Spec FR-01…FR-12 → files above → shell.test.ts + the named suites; migration list (smoke nav removal, shortcut aria-labels, switcher labels, toast region role, ConfirmDialog sites, guards expired pin, CustomerShell session bar) recorded in `docs/frontend-presentation-contracts.md` §"Phase 023 presentation migrations".
