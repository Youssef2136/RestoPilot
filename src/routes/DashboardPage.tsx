import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useMemo, useState, type FormEvent } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { SubscriptionBanner } from '../features/platform/SubscriptionBanner'
import { DashboardLiveCue } from './DashboardLiveCue'
import { NotAuthorized } from '../features/auth/guards'
import {
  AUTH_CONTEXT_QUERY_KEY,
  useAuthContext,
  type AuthContextMembership,
} from '../features/auth/useAuthContext'
import { managementClient } from '../features/management/managementClient'
import { visibleNavItems, STAFF_NAV_ITEMS } from '../app/navigation'
import { Card, Grid, SectionHeader, Stack, StatusPill } from '../components/ui'

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
 * Shortcut tiles' accessible names (T012 migration): descriptions that share
 * NO word with the nav item's own label (getByRole name matching is a
 * case-insensitive substring — a "Rounds" tile would collide with the
 * sidebar's Rounds link). Keyed by path.
 */
const SHORTCUT_ARIA: Record<string, string> = {
  '/dashboard': 'Your staff home',
  '/dashboard/sessions': 'Table oversight across branches',
  '/dashboard/rounds': 'The order operations queue',
  '/dashboard/kitchen': 'The preparation ticket board',
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
  const { profile, memberships, isPending, isError } = useAuthContext()

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

  // The operational shortcuts (spec 023 FR-04): the SAME nav model the shell
  // renders (FR-02 — never a second list), labeled as shortcuts on the home.
  const shortcuts =
    selectedRestaurant !== null
      ? visibleNavItems(STAFF_NAV_ITEMS, memberships, selectedRestaurant.restaurantId).filter(
          (item) => item.group === 'operations',
        )
      : []

  return (
    <section>
      <h1>Staff Dashboard</h1>
      <SubscriptionBanner />
      <DashboardLiveCue branchId={effectiveBranchId} />
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
        // null selection exactly then): the FR-001 creation bootstrap (Q6:
        // this panel stays ON the dashboard — E2E contract).
        <CreateRestaurantPanel />
      ) : (
        <Stack gap="7">
          <p>Signed in as {profile.display_name}.</p>

          {/* In-dashboard restaurant/branch context selection (FR-015).
              The shell's ContextSwitcher is the global affordance; these
              page-level selects remain the E2E contract (Q2). */}
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

          {/* Operational shortcuts (FR-04): the nav model's operations group
              as tiles — the same predicate matrix as the sidebar (FR-02).
              Each tile's accessible name is its DESCRIPTION ONLY: the item's
              own label ("Rounds", "Sessions"…) appears once on the page — in
              the sidebar — because getByRole name matching is a case-
              insensitive substring (T012 migration; a duplicated label in a
              tile would break `getByRole('link', { name: 'Rounds' })`). */}
          <section aria-label="Operational shortcuts">
            <Grid min="12rem" gap="4">
              {shortcuts.map((item) => (
                <Card key={item.path}>
                  <Link
                    to={item.path}
                    aria-label={SHORTCUT_ARIA[item.path] ?? item.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      padding: '0.25rem',
                    }}
                  >
                    <strong aria-hidden="true">{item.label}</strong>
                    <span
                      aria-hidden="true"
                      style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)' }}
                    >
                      {item.path === '/dashboard/sessions' && 'Oversight across your branches.'}
                      {item.path === '/dashboard/rounds' && 'The operations queue.'}
                      {item.path === '/dashboard/kitchen' && 'The ticket board.'}
                      {item.path === '/dashboard' && 'Your staff home.'}
                    </span>
                  </Link>
                </Card>
              ))}
            </Grid>
          </section>

          <section>
            <SectionHeader title="Your scope" />
            <ul>
              {memberships.map((membership) => (
                <li
                  key={`${membership.restaurant_id}:${membership.role}:${membership.branch_id ?? 'all'}`}
                >
                  {membership.restaurant_name} — {membership.role} —{' '}
                  {membership.branch_name ?? 'all branches'}{' '}
                  {membership.role === 'owner' && <StatusPill tone="brand">owner</StatusPill>}
                </li>
              ))}
            </ul>
          </section>

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
        </Stack>
      )}
    </section>
  )
}
