import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useMemo, useState, type FormEvent } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { NotAuthorized } from '../features/auth/guards'
import {
  AUTH_CONTEXT_QUERY_KEY,
  useAuthContext,
  type AuthContextMembership,
} from '../features/auth/useAuthContext'
import { managementClient } from '../features/management/managementClient'

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
 *
 * Spec 004 FR-001 extends the surface: the route guard admits a linked
 * profile WITHOUT memberships (`RequireProfile`), and this page renders the
 * create-restaurant panel for it — creation is the V1 onboarding bootstrap,
 * and its success refreshes the effective context so the new restaurant
 * appears as the selected context.
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

/**
 * The browser's IANA timezone list (research.md §10) — a convenience for the
 * form; the authoritative validation is the RPC against the database's own
 * list, and its message is surfaced verbatim.
 */
const TIME_ZONES = Intl.supportedValuesOf('timeZone')

/**
 * The current/browser zone may be absent from the browser's list (`UTC` is);
 * keeping it selectable means the form never misrepresents the stored value.
 */
function timeZoneOptions(current: string): string[] {
  return TIME_ZONES.includes(current) ? TIME_ZONES : [current, ...TIME_ZONES]
}

/**
 * The creation bootstrap (FR-001): a linked profile with no memberships
 * creates its restaurant here. The RPC is the validator — its message is
 * shown verbatim and no partial record exists on rejection — and on success
 * the auth context is refreshed so the owner membership makes the new
 * restaurant the dashboard's selected context.
 */
function CreateRestaurantPanel() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [brandDescription, setBrandDescription] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  // Pre-filled from the browser (research.md §10); the owner may change it.
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const zones = useMemo(() => timeZoneOptions(timezone), [timezone])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    const result = await managementClient.createRestaurant({
      name,
      slug,
      brandDescription,
      contactEmail,
      contactPhone,
      timezone,
    })
    setSubmitting(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    // The creator's owner membership arrives with the new restaurant (FR-001):
    // refresh the effective context so it becomes the selected context.
    await queryClient.invalidateQueries({ queryKey: AUTH_CONTEXT_QUERY_KEY })
  }

  return (
    <section aria-labelledby="create-restaurant-heading">
      <h2 id="create-restaurant-heading">Create your restaurant</h2>
      <p>Your account is not yet part of a restaurant. Create one to get started.</p>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="create-restaurant-name">Restaurant name</label>
          <input
            id="create-restaurant-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="create-restaurant-slug">Public identifier</label>
          <input
            id="create-restaurant-slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
          <p>
            Lowercase letters, digits, and single hyphens — it addresses your public restaurant
            page.
          </p>
        </div>
        <div>
          <label htmlFor="create-restaurant-brand">Brand description (optional)</label>
          <textarea
            id="create-restaurant-brand"
            value={brandDescription}
            onChange={(event) => setBrandDescription(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="create-restaurant-email">Contact email (optional)</label>
          <input
            id="create-restaurant-email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="create-restaurant-phone">Contact phone (optional)</label>
          <input
            id="create-restaurant-phone"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="create-restaurant-timezone">Timezone</label>
          <select
            id="create-restaurant-timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create restaurant'}
        </button>
        {message !== null && <p role="alert">{message}</p>}
      </form>
    </section>
  )
}

export function DashboardPage() {
  const { profile, memberships, isPending, isError, canReadStaffList, canManageRestaurant } =
    useAuthContext()

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
      ) : profile === null ? (
        // The RequireProfile guard already denies this identity; the explicit
        // denial view is rendered here too so the page never shows a
        // membership-shaped surface to an unlinked account (FR-014 posture).
        <NotAuthorized />
      ) : selectedRestaurant === null ? (
        // A linked profile with no memberships (the derivation above yields a
        // null selection exactly then): the FR-001 creation bootstrap.
        <CreateRestaurantPanel />
      ) : (
        <>
          <p>Signed in as {profile.display_name}.</p>

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
              presentation only (master plan §38). The management entry is
              owner-only (FR-006/FR-017); the data layer stays the boundary. */}
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
              {canManageRestaurant(selectedRestaurant.restaurantId) && (
                <li>
                  <Link to="/dashboard/restaurant">Restaurant</Link>
                </li>
              )}
              {canManageRestaurant(selectedRestaurant.restaurantId) && (
                <li>
                  <Link to="/dashboard/menu">Menu</Link>
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

          {/* Branch links, per scope (FR-017): the policy-scoped read above
              yields exactly the caller's readable branches — every branch for
              an owner, the assigned branch for a branch-scoped member. */}
          {branchOptions.some((option) => option.id !== '') && (
            <nav aria-label="Branches">
              <ul>
                {branchOptions
                  .filter((option) => option.id !== '')
                  .map((branch) => (
                    <li key={branch.id}>
                      <Link to={`/dashboard/branches/${branch.id}`}>{branch.name}</Link>
                    </li>
                  ))}
              </ul>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
