import { Route, Routes } from 'react-router'
import { AppShell } from '../components/AppShell'
import { AdminPage } from '../routes/AdminPage'
import { DashboardPage } from '../routes/DashboardPage'
import { OrderPage } from '../routes/OrderPage'
import { RestaurantPage } from '../routes/RestaurantPage'
import { RootPage } from '../routes/RootPage'

/**
 * Baseline route structure (spec FR-011/FR-012, master plan §38):
 * the public restaurant route, the branch ordering route, the staff
 * dashboard, and the super admin area — as placeholder views.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<RootPage />} />
        <Route path="/r/:restaurantSlug" element={<RestaurantPage />} />
        <Route path="/order/:branchId" element={<OrderPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  )
}
