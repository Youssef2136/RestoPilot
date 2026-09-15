import { Route, Routes } from 'react-router'
import { AppShell } from '../components/AppShell'
import { RequireStaff, RequireSuperAdmin } from '../features/auth/guards'
import { AdminPage } from '../routes/AdminPage'
import { DashboardPage } from '../routes/DashboardPage'
import { OrderPage } from '../routes/OrderPage'
import { ProfilePage } from '../routes/ProfilePage'
import { ResetPasswordPage } from '../routes/ResetPasswordPage'
import { RestaurantPage } from '../routes/RestaurantPage'
import { RootPage } from '../routes/RootPage'
import { SignInPage } from '../routes/SignInPage'
import { StaffListPage } from '../routes/StaffListPage'

/**
 * Route surface (contracts/auth-client.md; spec FR-013/FR-014): the public
 * customer-facing routes and the sign-in page; the staff area behind
 * `RequireStaff` (unauthenticated entry redirects to /signin with return-to;
 * a signed-in non-staff identity — including the unlinked case — gets the
 * NotAuthorized view); the platform admin area behind `RequireSuperAdmin`.
 * `/dashboard/staff` additionally enforces `canReadStaffList` inside the
 * view (FR-007). The guards are presentation only — the data layer remains
 * the authorization boundary (Constitution IV; FR-008).
 */
export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* Public routes (Phase 0 placeholders unchanged). */}
        <Route index element={<RootPage />} />
        <Route path="/r/:restaurantSlug" element={<RestaurantPage />} />
        <Route path="/order/:branchId" element={<OrderPage />} />
        <Route path="/signin" element={<SignInPage />} />
        {/* Password recovery (FR-018): PUBLIC and session-bearing — reached
            through the emailed recovery link, which establishes a session and
            fires PASSWORD_RECOVERY. Deliberately NOT RequireStaff-guarded: a
            recovery session is an authenticated identity changing its own
            credential, not a staff-area visit — the staff guard would deny
            unlinked identities their own recovery and conflate credential
            recovery with staff-area authorization. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Staff area (RequireStaff). */}
        <Route
          path="/dashboard"
          element={
            <RequireStaff>
              <DashboardPage />
            </RequireStaff>
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
