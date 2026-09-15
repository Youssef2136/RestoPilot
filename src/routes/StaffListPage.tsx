import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useMemo, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { NotAuthorized } from '../features/auth/guards'
import {
  useAuthContext,
  type AuthContextMembership,
  type StaffRole,
} from '../features/auth/useAuthContext'

/**
 * The restaurant staff list (FR-007): the selected restaurant's
 * staff_memberships plus the linked profiles' basic information, read
 * through the table policies with the typed client — an owner or branch
 * manager of the restaurant reads them; any other identity gets nothing.
 * The `canReadStaffList` gate below is presentation over that boundary
 * (Constitution IV): deep links by members without the role are rejected,
 * never merely hidden (FR-014).
 */

interface StaffListRow {
  profileId: string
  displayName: string | null
  role: StaffRole
  branchId: string | null
}

/**
 * One policy-guarded read: the membership rows of the restaurant with each
 * linked profile's display name (embedded join — both sides are narrowed by
 * the caller's own RLS policies).
 */
async function fetchStaffList(restaurantId: string | null): Promise<StaffListRow[]> {
  if (restaurantId === null) {
    return []
  }
  const { data, error } = await getSupabaseClient()
    .from('staff_memberships')
    .select('profile_id, role, branch_id, profiles(display_name)')
    .eq('restaurant_id', restaurantId)
  if (error) {
    throw error
  }
  const rows = (data ?? []).map((row) => ({
    profileId: row.profile_id,
    displayName: row.profiles?.display_name ?? null,
    role: row.role,
    branchId: row.branch_id,
  }))
  rows.sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''))
  return rows
}

/** Branches of the restaurant the caller may read (names for the list). */
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

export function StaffListPage() {
  const { memberships, isPending, isError, canReadStaffList } = useAuthContext()

  // The restaurants whose staff list this member may read: memberships with
  // role owner or branch_manager (canReadStaffList, FR-007), deduplicated
  // per restaurant.
  const readableRestaurants = useMemo(() => {
    const byId = new Map<string, AuthContextMembership>()
    for (const membership of memberships) {
      if (canReadStaffList(membership.restaurant_id) && !byId.has(membership.restaurant_id)) {
        byId.set(membership.restaurant_id, membership)
      }
    }
    return [...byId.values()]
  }, [memberships, canReadStaffList])

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null)
  const effectiveRestaurantId =
    selectedRestaurantId !== null &&
    readableRestaurants.some((membership) => membership.restaurant_id === selectedRestaurantId)
      ? selectedRestaurantId
      : (readableRestaurants[0]?.restaurant_id ?? null)

  const staffQuery = useQuery({
    queryKey: ['staff-list', effectiveRestaurantId],
    queryFn: () => fetchStaffList(effectiveRestaurantId),
    enabled: effectiveRestaurantId !== null,
  })
  const branchesQuery = useQuery({
    queryKey: ['branches', effectiveRestaurantId],
    queryFn: () => fetchBranchOptions(effectiveRestaurantId),
    enabled: effectiveRestaurantId !== null,
  })

  const branchNames = useMemo(() => {
    const byId = new Map<string, string>()
    for (const branch of branchesQuery.data ?? []) {
      byId.set(branch.id, branch.name)
    }
    return byId
  }, [branchesQuery.data])

  const selectedRestaurant =
    readableRestaurants.find((membership) => membership.restaurant_id === effectiveRestaurantId) ??
    null

  /** Branch label, honest about policy: names only for branches the caller may read. */
  function describeBranch(branchId: string | null): string {
    if (branchId === null) {
      return 'All branches'
    }
    return branchNames.get(branchId) ?? 'Another branch'
  }

  if (isPending) {
    return (
      <section>
        <h1>Staff list</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Staff list</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  // The gate (presentation): owners and branch managers only (FR-007). The
  // data read above is narrowed by the table policies regardless.
  if (effectiveRestaurantId === null) {
    return (
      <section>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  return (
    <section>
      <h1>Staff list</h1>
      {readableRestaurants.length > 1 && (
        <div>
          <label htmlFor="staff-list-restaurant">Restaurant</label>
          <select
            id="staff-list-restaurant"
            value={effectiveRestaurantId}
            onChange={(event) => setSelectedRestaurantId(event.target.value)}
          >
            {readableRestaurants.map((membership) => (
              <option key={membership.restaurant_id} value={membership.restaurant_id}>
                {membership.restaurant_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <p>
        Members of {selectedRestaurant?.restaurant_name ?? 'the selected restaurant'} and their
        roles.
      </p>

      {staffQuery.isPending ? (
        <p>Loading the staff list…</p>
      ) : staffQuery.isError ? (
        <p role="alert">The staff list could not be loaded. Try again.</p>
      ) : staffQuery.data.length === 0 ? (
        <p>No staff members found for this restaurant.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Branch</th>
            </tr>
          </thead>
          <tbody>
            {staffQuery.data.map((row) => (
              <tr key={`${row.profileId}:${row.role}:${row.branchId ?? 'all'}`}>
                <td>{row.displayName ?? 'Unknown member'}</td>
                <td>{row.role}</td>
                <td>{describeBranch(row.branchId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p>
        <Link to="/dashboard">Back to the dashboard</Link>
      </p>
    </section>
  )
}
