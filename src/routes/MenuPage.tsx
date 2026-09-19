import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext, type AuthContextMembership } from '../features/auth/useAuthContext'
import { MenuStructurePanel } from '../features/menu/components/MenuStructurePanel'
import { useRestaurantMenu } from '../features/menu/useMenu'

/**
 * Menu management (contracts/menu-client.md §2; spec 005 US1, FR-001…FR-010):
 * the owner's surface for the restaurant's single shared menu.
 *
 * Route guarded by `RequireStaff`; the in-page gate is `canManageRestaurant`,
 * which renders the explicit denial view for anyone else — rejected, not
 * hidden (feature 004's posture). Both are presentation only: every write in
 * this view travels through a `security definer` RPC that authorizes its
 * caller at the data layer (Constitution IV).
 */

export function MenuPage() {
  const { memberships, isPending, isError, canManageRestaurant } = useAuthContext()

  // The restaurants this caller could manage, one row per restaurant — the
  // same derivation the other management pages use.
  const managedRestaurants = useMemo(() => {
    const byId = new Map<string, AuthContextMembership>()
    for (const membership of memberships) {
      if (membership.role === 'owner' && !byId.has(membership.restaurant_id)) {
        byId.set(membership.restaurant_id, membership)
      }
    }
    return [...byId.values()]
  }, [memberships])

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null)
  const effectiveRestaurantId =
    selectedRestaurantId !== null &&
    managedRestaurants.some((membership) => membership.restaurant_id === selectedRestaurantId)
      ? selectedRestaurantId
      : (managedRestaurants[0]?.restaurant_id ?? null)

  const menuQuery = useRestaurantMenu(effectiveRestaurantId)

  if (isPending) {
    return (
      <section>
        <h1>Menu</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Menu</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  if (effectiveRestaurantId === null || !canManageRestaurant(effectiveRestaurantId)) {
    return (
      <section>
        <h1>Menu</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const selected = managedRestaurants.find((m) => m.restaurant_id === effectiveRestaurantId)

  return (
    <section>
      <h1>Menu</h1>
      <p>
        The shared menu of {selected?.restaurant_name ?? 'the selected restaurant'}. Everything here
        is restaurant-level: every branch serves this menu, and branches differ only by the
        availability of individual items.
      </p>

      {managedRestaurants.length > 1 && (
        <div>
          <label htmlFor="menu-restaurant">Restaurant</label>
          <select
            id="menu-restaurant"
            value={effectiveRestaurantId}
            onChange={(event) => setSelectedRestaurantId(event.target.value)}
          >
            {managedRestaurants.map((membership) => (
              <option key={membership.restaurant_id} value={membership.restaurant_id}>
                {membership.restaurant_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <h2>Categories and items</h2>
      {menuQuery.isPending && <p>Loading the menu…</p>}
      {menuQuery.isError && (
        <p role="alert">The menu could not be loaded. Reload the page and try again.</p>
      )}
      {menuQuery.data !== undefined && (
        <MenuStructurePanel restaurantId={effectiveRestaurantId} menu={menuQuery.data} />
      )}
    </section>
  )
}
