# State matrix — spec 037 (FR-01, SC-001..SC-005)

Every route mapped across the twelve canonical states. **Component** names the
vocabulary piece that renders the state (`src/components/state/*` unless
marked otherwise); **Test** names the pinning test (e2e unless marked unit).
Posture rule (D8): a failure is handled exactly ONCE — a row-level posture
never composes a page-level notice for the same failure, and vice versa.

Legend: **—** = state cannot occur on the route (guard-eliminated or
read-free); **(inherited)** = the shared shell handles it.

## Staff shell (all `/dashboard/*`)

| State | Component | Test |
| --- | --- | --- |
| loading | per-page skeleton (`Skeleton`) or `Loading your staff context…` | state.reads (reports/staff legs); unit |
| refetch | background refetch — existing data stays mounted (TanStack v5) | state.reads (control-box stability) |
| empty | `EmptyState` per surface (below) | state.reads (void/audit legs) |
| partial | per-row posture on the comparison surface (ReportsPage) | state.expiry.partial leg3 |
| read-error | `RouteErrorView` / page `role=alert` honesty line | state.reads; state.expiry.partial leg1 |
| in-flight | disabled button + in-flight guard on every mutation button (FR-06) | state.operations leg2 |
| refused | `RefusalAlert` inline at the acting control (verbatim) | state.operations leg2; state.customer |
| forbidden | `Not authorized` explicit denial view (guards.tsx) | auth.routes; state.expiry.partial leg1 |
| expired | deny-by-default denial on failed context read; SIGNED_OUT → RequireAuth redirect w/ `expired:true` | state.expiry.partial legs1–2 |
| offline | `OfflineSurface` banner + blocked writes w/ reason (offlineGate) | state.operations leg1 |
| reconnected | banner clears, `refetchOnReconnect` (queryClient policy) | state.operations leg1 |
| stale | last-known data stays readable offline; staleness visible via banner, data never blanked | state.operations leg1 |

## Route rows

### /signin (+ /recover, /reset-password, /change-password)
loading —; refetch —; empty —; partial —; read-error form `role=alert`; in-flight submitting state on both forms; refused form message verbatim; forbidden —; expired **session-ended note** (`readExpired`); offline native browser; reconnected —; stale —. Test: state.expiry.partial leg2; auth.routes.

### /dashboard (DashboardPage)
loading context `Loading your staff context…`; refetch — (context only); empty **CreateRestaurantPanel** (linked profile, no memberships); partial —; read-error `role=alert` context line; in-flight create-restaurant submit; refused create message; forbidden `NotAuthorized` (RequireProfile); expired denial/redirect (above); offline (inherited); reconnected (inherited); stale —. Test: auth.routes; state.expiry.partial leg1.

### /dashboard/sessions (BranchSessionsPanel)
loading panel skeleton; refetch realtime invalidation; empty `EmptyState` (sessions-empty posture); partial —; read-error panel error line; in-flight close-session confirm disabled while pending; refused inline `RefusalAlert` verbatim; forbidden `Not authorized` (kitchen/dan matrix); expired denial/redirect; offline banner + close **disabled with reason**; reconnected banner clears + refetch; stale last-known list readable. Test: state.operations leg1; session.surfaces.

### /dashboard/rounds (CashierRoundsPage)
loading `rounds-skeleton` (Skeleton, lines 3); refetch realtime; empty board empty posture; partial —; read-error board error line; in-flight per-card button guard; refused `RefusalAlert` on the pinned card (`[data-refusal]`, one per card after burst); forbidden `Not authorized` (dan); expired denial/redirect; offline banner + writes blocked; reconnected refetch; stale last-known board. Test: state.operations leg2; state.reads (skeleton leg).

### /dashboard/kitchen (KitchenDashboardPage)
loading skeleton column (pre-existing); refetch realtime; empty `kitchen-board-empty` (`EmptyState`); partial —; read-error board error; in-flight ticket transitions guarded; refused inline verbatim; forbidden `Not authorized` (cashier); expired denial/redirect; offline banner + writes blocked; reconnected refetch; stale last-known tickets. Test: state.operations (banner leg); kitchen surfaces suites.

### /dashboard/reports (ReportsPage)
loading `report-skeleton` (Skeleton, lines 5); refetch anchor/period key change; empty `report-best-sellers-empty` (`EmptyState`); partial **per-row** 'Load failed — the figures for this branch could not be loaded.' while siblings intact (NO page-level notice — D8); read-error row posture (same line); in-flight — (reads only); refused — (reads surface row posture); forbidden `Not authorized` (non-owner); expired denial/redirect; offline (inherited); reconnected refetch; stale prior figures stay until fresh resolve. Test: state.reads (skeleton + hold leg); state.expiry.partial leg3.

### /dashboard/voids (VoidReportPage)
loading skeleton posture; refetch —; empty `void-log-empty` (`EmptyState`, testId kept for reports.readability pins); partial —; read-error page error; in-flight —; refused —; forbidden `Not authorized` (non-owner); expired denial/redirect; offline (inherited); reconnected refetch; stale —. Test: state.reads (void empty leg).

### /dashboard/audit (AuditLogPage)
loading skeleton posture; refetch filter keys; empty `audit-log-empty` (`EmptyState`, td colSpan 5); partial —; read-error **AuditPayloadError 'malformed'** page error (`{entries:[]}` object shape is the real contract); in-flight —; refused —; forbidden `Not authorized`; expired denial/redirect; offline (inherited); reconnected refetch; stale —. Test: state.reads (audit leg).

### /dashboard/staff (StaffListPage + StaffManagementPanel)
loading `staff-list-skeleton` (lines 4); refetch membership keys; empty `staff-list-empty` / `management-members-empty` (`EmptyState` ×2); partial —; read-error page error; in-flight invite/role buttons guarded; refused inline verbatim; forbidden `Not authorized` (cashier — canReadStaffList); expired denial/redirect; offline (inherited); reconnected refetch; stale —. Test: state.reads (staff skeleton leg); management.surfaces.

### /dashboard/branches (+ /dashboard/branches/:id)
loading skeleton posture; refetch —; empty `branches-empty` / `tables-empty` (`EmptyState` ×2); partial —; read-error page error; in-flight —; refused —; forbidden `Not authorized`; expired denial/redirect; offline (inherited); reconnected refetch; stale —. Test: state.reads-family unit pins; branches suites.

### /dashboard/menu + /dashboard/branches/:id/menu + /dashboard/branches/:id/tax
loading existing skeletons; refetch mutation invalidation; empty menu-empty postures; partial —; read-error page errors; in-flight availability/tax toggles guarded; refused inline verbatim; forbidden `Not authorized` (canView/canManage predicates); expired denial/redirect; offline (inherited); reconnected refetch; stale —. Test: menu.surfaces; tax.surfaces.

### /r/:slug (RestaurantPublicPage → CustomerMenuPage/OrderPage)
loading pending-branch Skeleton (title `&nbsp;` + text lines + block); refetch poll 10s (rounds); empty menu-empty posture; partial —; read-error page error; in-flight **submit button guarded, cart preserved**; refused inline verbatim (400 body rendered as-is); forbidden — (public token surface); expired token → error posture (retry:false, never auto-retry a refused token); offline `OfflineSurface` customer posture + submit blocked; reconnected refetch; stale last-known menu/rounds readable. Test: state.customer legs1–2; state.reads (menu skeleton leg); full-journey.

### /profile, /platform (PlatformConsolePage), /admin (AdminPage), /dashboard/manage (ManageRestaurantPage)
All inherit the shell matrix; guards: profile — signed-in; platform — RequireSuperAdmin denial; admin — super-admin denial; manage — RequireProfile + owner predicate. Denied = `Not authorized` explicit view; expired = denial/redirect; every mutation refused inline verbatim. Test: platform.surfaces; management.surfaces; auth.routes.

### Dev-only (/dev/gallery — DevGalleryPage)
Not user-facing; excluded from the matrix by constitution (dev surface).

## Classification completeness (SC-001)

Zero unclassified routes: every route in `src/app` router resolves a row above
(either directly or through the staff-shell/customer-surface inheritance
declared per route). The twelve states are exhaustive per the spec's SC rows;
"partial" occurs only where a multi-part surface exists (reports comparison) —
single-read pages route their failure through read-error honestly instead of
fabricating a partial.
