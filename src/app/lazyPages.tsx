import { lazy } from 'react'
import { Skeleton } from '../components/state'

/**
 * The lazy-pages registry (spec 038 FR-02, D2): route-level code splitting
 * declared OUTSIDE the E2E-imported modules. `routes.ts` and the route
 * declarations stay statically analyzable — E2E specs import `routes.ts`
 * transpiled WITHOUT Vite defines, so this registry never leaks into those
 * imports. Each entry is one shell-side page; the shell components, the
 * guards, and the 404 view stay eager (first paint depends on the contract
 * landmarks — skip link, `#main`, nav).
 *
 * The chunk SLOW state is the Phase 17 vocabulary: the shell-level Suspense
 * fallback renders the family Skeleton; a chunk FAILURE is caught by the
 * router's ErrorBoundary (the RouteErrorView posture — never a white
 * screen). The ADMIN pages split separately so platform code never rides
 * staff navigation either.
 */

/** The suspense fallback shared by every lazy page mount. */
export function PageSuspenseFallback() {
  return (
    <div style={{ maxWidth: '38rem' }}>
      <Skeleton variant="text" lines={4} />
    </div>
  )
}

// The import map FIRST (its `lazy()` boundaries are the declarations the
// exports below re-export; block-scoped order matters).
const lazyComponents = {
  root: lazy(() => import('../routes/RootPage').then((m) => ({ default: m.RootPage }))),
  order: lazy(() => import('../routes/OrderPage').then((m) => ({ default: m.OrderPage }))),
  restaurantPublic: lazy(() =>
    import('../routes/RestaurantPublicPage').then((m) => ({ default: m.RestaurantPublicPage })),
  ),
  customerMenu: lazy(() =>
    import('../routes/CustomerMenuPage').then((m) => ({ default: m.CustomerMenuPage })),
  ),
  signIn: lazy(() => import('../routes/SignInPage').then((m) => ({ default: m.SignInPage }))),
  resetPassword: lazy(() =>
    import('../routes/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
  ),
  changePassword: lazy(() =>
    import('../routes/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage })),
  ),
  dashboard: lazy(() =>
    import('../routes/DashboardPage').then((m) => ({ default: m.DashboardPage })),
  ),
  profile: lazy(() => import('../routes/ProfilePage').then((m) => ({ default: m.ProfilePage }))),
  staffList: lazy(() =>
    import('../routes/StaffListPage').then((m) => ({ default: m.StaffListPage })),
  ),
  staffSessions: lazy(() =>
    import('../routes/StaffSessionsPage').then((m) => ({ default: m.StaffSessionsPage })),
  ),
  cashierRounds: lazy(() =>
    import('../routes/CashierRoundsPage').then((m) => ({ default: m.CashierRoundsPage })),
  ),
  kitchenBoard: lazy(() =>
    import('../routes/KitchenDashboardPage').then((m) => ({ default: m.KitchenDashboardPage })),
  ),
  audit: lazy(() => import('../routes/AuditLogPage').then((m) => ({ default: m.AuditLogPage }))),
  reports: lazy(() => import('../routes/ReportsPage').then((m) => ({ default: m.ReportsPage }))),
  voids: lazy(() =>
    import('../routes/VoidReportPage').then((m) => ({ default: m.VoidReportPage })),
  ),
  manageRestaurant: lazy(() =>
    import('../routes/ManageRestaurantPage').then((m) => ({ default: m.ManageRestaurantPage })),
  ),
  menu: lazy(() => import('../routes/MenuPage').then((m) => ({ default: m.MenuPage }))),
  tax: lazy(() => import('../routes/TaxPage').then((m) => ({ default: m.TaxPage }))),
  branches: lazy(() => import('../routes/BranchesPage').then((m) => ({ default: m.BranchesPage }))),
  branchDetail: lazy(() =>
    import('../routes/BranchDetailPage').then((m) => ({ default: m.BranchDetailPage })),
  ),
  branchMenu: lazy(() =>
    import('../routes/BranchMenuPage').then((m) => ({ default: m.BranchMenuPage })),
  ),
  branchTax: lazy(() =>
    import('../routes/BranchTaxPage').then((m) => ({ default: m.BranchTaxPage })),
  ),
  admin: lazy(() => import('../routes/AdminPage').then((m) => ({ default: m.AdminPage }))),
  platformConsole: lazy(() =>
    import('../routes/PlatformConsolePage').then((m) => ({ default: m.PlatformConsolePage })),
  ),
}

// ── Customer shell pages (public + in-session) ─────────────────────────────
export const CustomerRootPage = lazyComponents.root
export const CustomerOrderPage = lazyComponents.order
export const CustomerRestaurantPublicPage = lazyComponents.restaurantPublic
export const CustomerMenuPage = lazyComponents.customerMenu
export const SignInPage = lazyComponents.signIn
export const ResetPasswordPage = lazyComponents.resetPassword
export const ChangePasswordPage = lazyComponents.changePassword

// ── Staff shell pages ──────────────────────────────────────────────────────
export const DashboardPage = lazyComponents.dashboard
export const ProfilePage = lazyComponents.profile
export const StaffListPage = lazyComponents.staffList
export const StaffSessionsPage = lazyComponents.staffSessions
export const CashierRoundsPage = lazyComponents.cashierRounds
export const KitchenDashboardPage = lazyComponents.kitchenBoard
export const AuditLogPage = lazyComponents.audit
export const ReportsPage = lazyComponents.reports
export const VoidReportPage = lazyComponents.voids
export const ManageRestaurantPage = lazyComponents.manageRestaurant
export const MenuManagementPage = lazyComponents.menu
export const TaxConfigurationPage = lazyComponents.tax
export const BranchesPage = lazyComponents.branches
export const BranchDetailPage = lazyComponents.branchDetail
export const BranchMenuPage = lazyComponents.branchMenu
export const BranchTaxPage = lazyComponents.branchTax

// ── Admin (super-admin) pages ──────────────────────────────────────────────
export const AdminConsolePage = lazyComponents.admin
export const PlatformConsolePage = lazyComponents.platformConsole
