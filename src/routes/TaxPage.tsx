import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext, type AuthContextMembership } from '../features/auth/useAuthContext'
import { TaxRulesPanel } from '../features/tax/components/TaxRulesPanel'
import { useRestaurantTaxRules } from '../features/tax/useTax'
import { useRestaurantMenu } from '../features/menu/useMenu'

/**
 * Tax configuration (contracts/tax-client.md §2; spec 006 US1): the owner's
 * surface for the restaurant's tax rules.
 *
 * Route guarded by `RequireStaff`; the in-page gate is `canManageRestaurant`,
 * which renders the explicit denial view for anyone else — rejected, not
 * hidden (the established posture). Presentation only: every write travels
 * through a `security definer` RPC that authorizes its caller at the data
 * layer (Constitution IV).
 */
export function TaxPage() {
  const { memberships, isPending, isError, canManageRestaurant } = useAuthContext()

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

  const taxQuery = useRestaurantTaxRules(effectiveRestaurantId)
  // The target pickers need the restaurant's categories and items by name —
  // the same management read the menu editor uses, under the same policies.
  const menuQuery = useRestaurantMenu(effectiveRestaurantId)

  if (isPending) {
    return (
      <section>
        <h1>Tax</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Tax</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  if (effectiveRestaurantId === null || !canManageRestaurant(effectiveRestaurantId)) {
    return (
      <section>
        <h1>Tax</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const selected = managedRestaurants.find((m) => m.restaurant_id === effectiveRestaurantId)
  const targets = {
    categories: (menuQuery.data?.categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
    })),
    items: (menuQuery.data?.categories ?? []).flatMap((category) =>
      category.items.map((item) => ({ id: item.id, name: item.name })),
    ),
  }

  return (
    <section>
      <h1>Tax</h1>
      <p>
        The tax rules of {selected?.restaurant_name ?? 'the selected restaurant'}. Rules apply in
        the order shown; every branch charges them unless a branch overrides a rate.
      </p>

      {managedRestaurants.length > 1 && (
        <div>
          <label htmlFor="tax-restaurant">Restaurant</label>
          <select
            id="tax-restaurant"
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

      {taxQuery.isPending && <p>Loading the tax configuration…</p>}
      {taxQuery.isError && (
        <p role="alert">
          The tax configuration could not be loaded. Reload the page and try again.
        </p>
      )}
      {taxQuery.data !== undefined && (
        <TaxRulesPanel
          restaurantId={effectiveRestaurantId}
          inventory={taxQuery.data}
          targets={targets}
        />
      )}
    </section>
  )
}
