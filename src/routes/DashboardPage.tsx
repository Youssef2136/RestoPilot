import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useMemo, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { useAuthContext, type AuthContextMembership } from '../features/auth/useAuthContext'

/**
 * The unified staff area (FR-015): one dashboard across ALL memberships — a
 * member of several restaurants never picks a restaurant at sign-in; they
 * switch context here, inside the dashboard. Restaurant options come from
 * the effective context (`useAuthContext` memberships) and branch options
 * from a policy-guarded `branches` read, so the selector can only ever
 * offer what the caller may already read (an owner sees every branch of
 * their restaurant; branch-scoped roles see their assigned branch only —
 * FR-007). Navigation lists only the entries the effective roles and scope
 * permit — presentation only (master plan §38); the data layer remains the
 * authorization boundary (Constitution IV).
 */

interface RestaurantOption {
  restaurantId: string
  restaurantName: string
  isOwner: boolean
}

/** Groups the effective memberships into one option per restaurant. */
function groupByRestaurant(memberships: AuthContextMembership[]): RestaurantOption[] {
  const byId = new Map<string, RestaurantOption>()
  for (const membership of memberships) {
    const existing = byId.get(membership.restaurant_id)
    if (existing) {
      existing.isOwner ||= membership.role === 'owner'
    } else {
      byId.set(membership.restaurant_id, {
        restaurantId: membership.restaurant_id,
        restaurantName: membership.restaurant_name,
        isOwner: membership.role === 'owner',
      })
    }
  }
  return [...byId.values()]
}

/** Branches of a restaurant, read through the table policies (FR-007). */
async function fetchBranchOptions(restaurantId: string | null) {
  if (restaurantId === null) {
    return []
  }
  const { data, error } = await getSupabaseClient()
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .order('name')
  if (error) {
    throw error
  }
  return data ?? []
}

export function DashboardPage() {
  const { profile, memberships, isPending, isError, canReadStaffList } = useAuthContext()

  const restaurants = useMemo(() => groupByRestaurant(memberships), [memberships])

  // The member's context selection. The effective values fall back to the
  // first membership, so a fresh sign-in lands on a defined context without
  // a forced chooser (FR-015).
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)

  const effectiveRestaurantId =
    selectedRestaurantId !== null &&
    restaurants.some((option) => option.restaurantId === selectedRestaurantId)
      ? selectedRestaurantId
      : (restaurants[0]?.restaurantId ?? null)
  const selectedRestaurant =
    restaurants.find((option) => option.restaurantId === effectiveRestaurantId) ?? null

  const branchesQuery = useQuery({
    queryKey: ['branches', effectiveRestaurantId],
    queryFn: () => fetchBranchOptions(effectiveRestaurantId),
    enabled: effectiveRestaurantId !== null,
  })

  const branchOptions = useMemo(() => {
    const branches = (branchesQuery.data ?? []).map((branch) => ({
      id: branch.id,
      name: branch.name,
    }))
    if (selectedRestaurant?.isOwner) {
      // Owners are restaurant-wide (FR-007): every readable branch plus the
      // whole-restaurant context.
      return [{ id: '', name: 'All branches' }, ...branches]
    }
    return branches
  }, [branchesQuery.data, selectedRestaurant])

  const effectiveBranchId =
    selectedBranchId !== null && branchOptions.some((option) => option.id === selectedBranchId)
      ? selectedBranchId
      : (branchOptions[0]?.id ?? '')

  return (
    <section>
      <h1>Staff Dashboard</h1>
      {isPending ? (
        <p>Loading your staff context…</p>
      ) : isError ? (
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      ) : selectedRestaurant === null ? (
        <p>No staff memberships on this account.</p>
      ) : (
        <>
          <p>Signed in as {profile?.display_name ?? 'a staff member'}.</p>

          {/* In-dashboard restaurant/branch context selection (FR-015). */}
          <div>
            <label htmlFor="dashboard-restaurant">Restaurant</label>
            <select
              id="dashboard-restaurant"
              value={effectiveRestaurantId}
              onChange={(event) => {
                setSelectedRestaurantId(event.target.value)
                // Branch options differ per restaurant — start over.
                setSelectedBranchId(null)
              }}
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.restaurantId} value={restaurant.restaurantId}>
                  {restaurant.restaurantName}
                </option>
              ))}
            </select>

            <label htmlFor="dashboard-branch">Branch</label>
            <select
              id="dashboard-branch"
              value={effectiveBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
            >
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Only the entries the effective roles and scope permit —
              presentation only (master plan §38). */}
          <nav aria-label="Staff area">
            <ul>
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
              <li>
                <Link to="/dashboard/profile">Profile</Link>
              </li>
              {canReadStaffList(selectedRestaurant.restaurantId) && (
                <li>
                  <Link to="/dashboard/staff">Staff list</Link>
                </li>
              )}
            </ul>
          </nav>

          <h2>Your scope</h2>
          <ul>
            {memberships.map((membership) => (
              <li
                key={`${membership.restaurant_id}:${membership.role}:${membership.branch_id ?? 'all'}`}
              >
                {membership.restaurant_name} — {membership.role} —{' '}
                {membership.branch_name ?? 'all branches'}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
