# Phase 03 Research

**Date:** 2026-09-27 · **Baseline:** `306c0ae`

## R1 — The nav model today (repository truth)

The dashboard's `<nav aria-label="Staff area">` holds the per-persona link set: Dashboard,
Profile, Staff list (`canReadStaffList`), Restaurant/Menu/Tax (`canManageRestaurant`), Sessions
(owner/manager/cashier somewhere), Rounds (same), Kitchen (+kitchen role), Audit/Reports/Void log
(owner or manager), plus a "Branches" nav of per-branch links from the policy-scoped read. E2E
asserts presence AND absence per persona (`session.surfaces.test.ts`: kitchen has 0 "Sessions"
links; `management.surfaces` and others assert positive sets). The nav model extraction must
reproduce this matrix exactly — pinned by a new exhaustive unit test.

## R2 — Context selects are per-page E2E contracts

`getByLabel('Restaurant')` (StaffSessionsPage `sessions-restaurant`) and `getByLabel('Branch')`
(StaffSessionsPage, CashierRoundsPage `rounds-branch`, BranchDetailPage?, ReportsPage,
bill/void suites, kitchen/cashier suites, realtime suite — six+ files) select per-page context.
The Master Plan's "`?restaurant=` / `?branch=` preserved where already used" plus the ledger's
stability rule ⇒ Q2: the shell's ContextSwitcher uses distinct labels ("Context — Restaurant")
and sessionStorage persistence; page selects stay verbatim. A bare-label duplicate would break
`getByLabel` strict mode in 6+ suites.

## R3 — Realtime status surface

`useRealtimeInvalidation` subscribes per (table, scope); its `channel.subscribe` callback
deliberately ignores CHANNEL_ERROR/TIMED_OUT (renders nothing; SUBSCRIBED refetches). For the
banner: extend the callback to also report into an optional consumer. Status source choices:
(a) per-binding React state — wrong layer (bindings live in feature components); (b) a
module-level registry of active channel statuses + a `useSyncExternalStore` hook — right layer
for a shell-level aggregate. Semantics: offline = any active binding in CHANNEL_ERROR/TIMED_OUT
or `!navigator.onLine`; recovered = SUBSCRIBED after an error, or `online` flip triggering
refetch of active queries. FA-2 untouched: events still never render; SUBSCRIBED still refetches.

## R4 — Destructive actions inventory (FR-06 sites)

- Session close: `StaffSessionsPage`/BranchDetail — "Close session for T1" → "Confirm closing T1"
  (E2E `session.surfaces` asserts both names + the success `role="status"` text).
- Void round: BillPanel/round flows — the existing void flow's two-step names (E2E
  `bill.void.audit`).
- Membership removal: StaffListPage two-step confirm (E2E `management.surfaces`).
- Subscription disable: PlatformConsolePage two-step confirm (E2E `platform.surfaces`).
Adoption pattern: first button (same name) opens `ConfirmDialog`; the dialog's confirm button
carries the former second-step name verbatim; the cancel affordance is NEW (name "Cancel") —
E2E never asserted a cancel on these flows (they clicked confirm directly), so the dialog adds
an escape without breaking assertions. Migration list per site recorded in the report.

## R5 — Signed-out/expiry surface

`RequireAuth` redirects to `/signin` with `state.from` (existing, E2E-asserted). The friendly
expiry note (FR-08) must not change the flow: SignInPage reads the auth event that preceded the
landing (a `SIGNED_OUT` event fired by token expiry vs a cold visit) — the simplest honest
signal is `location.state.expired` set by the guards when the session was known-signed-in and
then lost. Guards' decision logic unchanged; only an informational prop is added.

## R6 — Shell CSS from tokens

Sidebar 16rem (`--space` rhythm), header 3.5rem; content max-width 72rem (denser than the old
60rem? No — the incumbent `.main` max-width 60rem is an E2E-visual incumbent; keep 60rem in the
shell to avoid silent layout shifts, revisit in surface phases). Compact density on the shell
root per Q-density (`data-density="compact"`). Customer shell: max-width 34rem column.

## R7 — What E2E asserts about the shell chrome today

`auth.routes` "Account password" link + "Sign out" button in the header (signed-in only);
`route.titles` per-route titles (untouched); 404-in-shell (skip link + main). All preserved by
keeping the header's right side composition (brand left; password/sign-out right) in StaffShell
and a minimal header in CustomerShell (sign-in link only on credential routes — no assertion
depends on it).
