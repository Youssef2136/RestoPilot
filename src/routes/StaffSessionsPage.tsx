import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getSupabaseClient } from '../lib/supabase'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext, type AuthContextMembership } from '../features/auth/useAuthContext'
import { BranchSessionsPanel } from '../features/session/components/BranchSessionsPanel'

/**
 * The staff sessions view (spec 007 US2/US4, `/dashboard/sessions`): the
 * signed-in identity's readable branches, one at a time, each rendering
 * `BranchSessionsPanel`. The branch options come from the policy-scoped
 * `branches` read — an owner sees every branch of their restaurant, a
 * branch-scoped member exactly their own — so the selector can only offer
 * what the caller may already read. A kitchen member (or any identity the
 * `canViewSessions` gate refuses for every readable branch) gets the
 * explicit denial — rejected, not hidden.
 *
 * Presentation only: `get_branch_open_sessions` re-checks scope server-side
 * for whatever branch is rendered (Constitution IV).
 */

/** Branches of the selected restaurant, read through the table policies. */
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

export function StaffSessionsPage() {
  const { memberships, isPending, isError, canViewSessions } = useAuthContext()
  // A deep link (`?branch=<id>`) preselects that branch — the dashboard's
  // branch detail page links here per branch.
  const [searchParams] = useSearchParams()
  const requestedBranchId = searchParams.get('branch')

  // One option per membership restaurant (the BranchesPage derivation).
  const readableRestaurants = useMemo(() => {
    const byId = new Map<string, AuthContextMembership>()
    for (const membership of memberships) {
      if (!byId.has(membership.restaurant_id)) {
        byId.set(membership.restaurant_id, membership)
      }
    }
    return [...byId.values()]
  }, [memberships])

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const effectiveRestaurantId =
    selectedRestaurantId !== null &&
    readableRestaurants.some((membership) => membership.restaurant_id === selectedRestaurantId)
      ? selectedRestaurantId
      : (readableRestaurants[0]?.restaurant_id ?? null)

  const branchesQuery = useQuery({
    queryKey: ['branches', effectiveRestaurantId],
    queryFn: () => fetchBranchOptions(effectiveRestaurantId),
    enabled: effectiveRestaurantId !== null,
  })

  if (isPending) {
    return (
      <section>
        <h1>Sessions</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Sessions</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  const branches = branchesQuery.data ?? []
  // The first branch the gate admits, else nothing renderable.
  const firstViewable = branches.find((branch) => canViewSessions(branch.id)) ?? null

  if (effectiveRestaurantId === null || (!branchesQuery.isPending && firstViewable === null)) {
    return (
      <section>
        <h1>Sessions</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const effectiveBranchId =
    selectedBranchId !== null && branches.some((branch) => branch.id === selectedBranchId)
      ? selectedBranchId
      : requestedBranchId !== null &&
          branches.some((branch) => branch.id === requestedBranchId) &&
          canViewSessions(requestedBranchId)
        ? requestedBranchId
        : (firstViewable?.id ?? null)
  const effectiveBranch = branches.find((branch) => branch.id === effectiveBranchId) ?? null

  return (
    <section>
      <h1>Sessions</h1>

      {readableRestaurants.length > 1 && (
        <div>
          <label htmlFor="sessions-restaurant">Restaurant</label>
          <select
            id="sessions-restaurant"
            value={effectiveRestaurantId}
            onChange={(event) => {
              setSelectedRestaurantId(event.target.value)
              setSelectedBranchId(null)
            }}
          >
            {readableRestaurants.map((membership) => (
              <option key={membership.restaurant_id} value={membership.restaurant_id}>
                {membership.restaurant_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {branches.length > 1 && effectiveBranchId !== null && (
        <div>
          <label htmlFor="sessions-branch">Branch</label>
          <select
            id="sessions-branch"
            value={effectiveBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {effectiveBranch !== null && (
        <BranchSessionsPanel
          branchId={effectiveBranch.id}
          branchName={effectiveBranch.name}
          canClose={canViewSessions(effectiveBranch.id)}
        />
      )}

      <p>
        <Link to="/dashboard">Back to the dashboard</Link>
      </p>
    </section>
  )
}
