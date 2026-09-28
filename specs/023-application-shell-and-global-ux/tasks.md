# Phase 03 Tasks — Application Shell, Navigation & Global UX

**Feature dir:** `specs/023-application-shell-and-global-ux` · **Date:** 2026-09-27

| # | Task | Covers | Status |
|---|---|---|---|
| T001 | `src/app/navigation.ts`: the one nav-model declaration (canonical order Q1, predicates, groups incl. platform) + unit tests (exhaustive persona × item matrix) | FR-02 | [x] |
| T002 | Realtime status: optional `onStatus` consumer in the binding + `useRealtimeStatus` aggregate hook (FA-2 semantics pinned by existing realtime unit tests) | FR-07 | [x] |
| T003 | `StaffShell` + `CustomerShell` + `ShellNav` (landmarks, skip link target, header composition incl. sign-out/account-password, `aria-current`) + router re-mount by route group; AppShell retired | FR-01, FR-12 | [x] |
| T004 | `ContextSwitcher` (sessionStorage persistence, owner "All branches", invalid-id fallback, distinct labels) with unit tests | FR-03 | [x] |
| T005 | `DashboardPage` home restructure (h1 preserved, shortcuts from the nav model, scope, branch links, SubscriptionBanner + LiveCue + CreateRestaurantPanel preserved) | FR-04 | [x] |
| T006 | ToastProvider at app root; adopt `useToast` for silent/inline-only mutation outcomes (inline text preserved) | FR-05, Q3 | [x] |
| T007 | `ConfirmDialog` adoption at the 4 destructive sites (session close, void, membership removal, subscription disable) with verbatim names + migration list | FR-06, Q4 | [x] |
| T008 | `OfflineBanner` (offline/reconnecting/recovered + "Retry now" refetching active queries) | FR-07, Q5 | [x] |
| T009 | Mobile drawer nav (menu button <1024px, Drawer primitive, aria-current inside) | FR-09 | [x] |
| T010 | `NotAuthorized` restyle (heading preserved; why + how, no tenant disclosure); SignInPage expired-session note (FR-08) | FR-08, FR-11 | [x] |
| T011 | E2E `shell.test.ts`: persona nav matrix, context persistence, drawer at mobile viewport, confirm-dialog session close, offline banner retry, sign-out | Gates | [x] |
| T012 | Full-suite E2E migration pass: fix selector drift, record the migration list in the report + ledger update | F-G09 | [x] |
| T013 | `impeccable detect` on changed files; screenshots (staff shell desktop+mobile, customer shell, banner states) into evidence | FINISH | [x] |
| T014 | Validation: `npm run verify` + full `test:e2e` + build grep | Gates | [x] |
| T015 | Convergence: fix findings (≤3 rounds) | CONVERGE | [x] |
| T016 | Checkpoint `feat(023)` + push (auto-push rule); report + state DONE | CHECKPOINT/REPORT | [x] |
