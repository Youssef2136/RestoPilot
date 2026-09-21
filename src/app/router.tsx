import { Route, Routes } from 'react-router'
import { AppShell } from '../components/AppShell'
import { RequireProfile, RequireStaff, RequireSuperAdmin } from '../features/auth/guards'
import { AdminPage } from '../routes/AdminPage'
import { AuditLogPage } from '../routes/AuditLogPage'
import { BranchDetailPage } from '../routes/BranchDetailPage'
import { BranchMenuPage } from '../routes/BranchMenuPage'
import { BranchTaxPage } from '../routes/BranchTaxPage'
import { CashierRoundsPage } from '../routes/CashierRoundsPage'
import { BranchesPage } from '../routes/BranchesPage'
import { CustomerMenuPage } from '../routes/CustomerMenuPage'
import { DashboardPage } from '../routes/DashboardPage'
import { KitchenDashboardPage } from '../routes/KitchenDashboardPage'
import { ManageRestaurantPage } from '../routes/ManageRestaurantPage'
import { MenuPage } from '../routes/MenuPage'
import { OrderPage } from '../routes/OrderPage'
import { ProfilePage } from '../routes/ProfilePage'
import { ResetPasswordPage } from '../routes/ResetPasswordPage'
import { RestaurantPublicPage } from '../routes/RestaurantPublicPage'
import { RootPage } from '../routes/RootPage'
import { SignInPage } from '../routes/SignInPage'
import { StaffListPage } from '../routes/StaffListPage'
import { StaffSessionsPage } from '../routes/StaffSessionsPage'
import { TaxPage } from '../routes/TaxPage'

/**
 * Route surface (contracts/auth-client.md, revised by
 * contracts/management-client.md §2): the public customer-facing routes and
 * the sign-in page; the staff area behind `RequireStaff` (unauthenticated
 * entry redirects to /signin with return-to; a signed-in non-staff identity —
 * including the unlinked case — gets the NotAuthorized view); the platform
 * admin area behind `RequireSuperAdmin`. `/dashboard/staff` and
 * `/dashboard/restaurant` additionally enforce their presentation gates
 * inside the view (FR-007; spec 004 FR-006/FR-017 — rejected, not hidden),
 * and the `/dashboard/branches` rows render their policy-scoped reads behind
 * `RequireStaff` exactly like the other staff surfaces.
 * The guards are presentation only — the data layer remains the
 * authorization boundary (Constitution IV; FR-008).
 *
 * The one revision to feature 003's route contract (spec 004 FR-001): the
 * `/dashboard` guard is `RequireProfile` — a linked profile WITHOUT
 * memberships must reach restaurant creation, and `RequireStaff` excludes
 * exactly that identity by definition. The unlinked-identity denial is
 * unchanged.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* Public routes. The /r/:slug entry flow (spec 007 FR-001) supersedes
            the Phase 0 restaurant placeholder — same path, real surface. */}
        <Route index element={<RootPage />} />
        <Route path="/order/:branchId" element={<OrderPage />} />
        <Route path="/signin" element={<SignInPage />} />
        {/* Customer session routes (spec 007 FR-001/FR-021): the public
            entry flow and the token-guarded customer menu. Both render
            WITHOUT dashboard chrome — the customer side has no auth context
            at all; every read verifies the token server-side. */}
        <Route path="/r/:slug" element={<RestaurantPublicPage />} />
        <Route path="/r/:slug/menu" element={<CustomerMenuPage />} />
        {/* Password recovery (FR-018): PUBLIC and session-bearing — reached
            through the emailed recovery link, which establishes a session and
            fires PASSWORD_RECOVERY. Deliberately NOT RequireStaff-guarded: a
            recovery session is an authenticated identity changing its own
            credential, not a staff-area visit — the staff guard would deny
            unlinked identities their own recovery and conflate credential
            recovery with staff-area authorization. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Staff area (RequireStaff) — except /dashboard, which admits the
            membership-less linked profile for the FR-001 bootstrap
            (RequireProfile; the only revision to feature 003's surface). */}
        <Route
          path="/dashboard"
          element={
            <RequireProfile>
              <DashboardPage />
            </RequireProfile>
          }
        />
        <Route
          path="/dashboard/profile"
          element={
            <RequireStaff>
              <ProfilePage />
            </RequireStaff>
          }
        />
        <Route
          path="/dashboard/staff"
          element={
            <RequireStaff>
              <StaffListPage />
            </RequireStaff>
          }
        />
        {/* Session oversight (spec 007 US2/US4, FR-017): the signed-in
            identity's readable branches with their open sessions and the
            close action. The page's own gate renders the denial for
            identities the session matrix excludes (kitchen and everyone
            else), and the RPC re-checks scope server-side. */}
        <Route
          path="/dashboard/sessions"
          element={
            <RequireStaff>
              <StaffSessionsPage />
            </RequireStaff>
          }
        />
        {/* Round operations (spec 009 US2, `/dashboard/rounds`): the cashier
            dashboard. The page's own role gate renders the denial for kitchen
            or outsiders; every action is re-authorized by its RPC. */}
        <Route
          path="/dashboard/rounds"
          element={
            <RequireStaff>
              <CashierRoundsPage />
            </RequireStaff>
          }
        />
        {/* Kitchen display (spec 009 US3, `/dashboard/kitchen`): the queue
            with start/ready controls. The page's own role gate renders the
            denial for identities without branch reach. */}
        <Route
          path="/dashboard/kitchen"
          element={
            <RequireStaff>
              <KitchenDashboardPage />
            </RequireStaff>
          }
        />
        {/* The audit trail (spec 011 US3, `/dashboard/audit`): owner and
            branch_manager only at the presentation layer; the RPC re-enforces
            the reach for every caller regardless. */}
        <Route
          path="/dashboard/audit"
          element={
            <RequireStaff>
              <AuditLogPage />
            </RequireStaff>
          }
        />
        <Route
          path="/dashboard/restaurant"
          element={
            <RequireStaff>
              <ManageRestaurantPage />
            </RequireStaff>
          }
        />
        {/* Menu management (spec 005 US1/US2, FR-003): `RequireStaff` plus the
            page's in-page owner gate — a non-owner deep link renders the
            denial view, and every write is authorized by its RPC regardless. */}
        <Route
          path="/dashboard/menu"
          element={
            <RequireStaff>
              <MenuPage />
            </RequireStaff>
          }
        />
        {/* Tax configuration (spec 006 US1, FR-003): `RequireStaff` plus the
            page's in-page owner gate — a non-owner deep link renders the
            denial view, and every write is authorized by its RPC regardless. */}
        <Route
          path="/dashboard/tax"
          element={
            <RequireStaff>
              <TaxPage />
            </RequireStaff>
          }
        />
        {/* Branch surfaces (spec 004 FR-007/FR-008/FR-017): `RequireStaff`
            plus the pages' policy-scoped reads — an owner sees every branch
            of the restaurant, a branch-scoped member exactly their own; an
            out-of-scope branch id renders the denial state, never a name. */}
        <Route
          path="/dashboard/branches"
          element={
            <RequireStaff>
              <BranchesPage />
            </RequireStaff>
          }
        />
        <Route
          path="/dashboard/branches/:branchId"
          element={
            <RequireStaff>
              <BranchDetailPage />
            </RequireStaff>
          }
        />
        {/* The branch menu view (spec 005 US2, FR-014/FR-015): the branch's
            customer-visible menu, the exit condition's artifact. The page
            renders the denial state for out-of-scope branches while the
            projection's own scope check decides server-side. */}
        <Route
          path="/dashboard/branches/:branchId/menu"
          element={
            <RequireStaff>
              <BranchMenuPage />
            </RequireStaff>
          }
        />
        {/* The branch tax view (spec 006 US2, FR-020): the branch's effective
            tax configuration, the override controls gated in-page. The
            projection's own scope check decides server-side. */}
        <Route
          path="/dashboard/branches/:branchId/tax"
          element={
            <RequireStaff>
              <BranchTaxPage />
            </RequireStaff>
          }
        />
        {/* Platform admin area (RequireSuperAdmin). */}
        <Route
          path="/admin"
          element={
            <RequireSuperAdmin>
              <AdminPage />
            </RequireSuperAdmin>
          }
        />
      </Route>
    </Routes>
  )
}
