import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext, type AuthContextMembership } from '../features/auth/useAuthContext'
import { ManagementLayout } from '../components/management/ManagementLayout'
import { SectionCard } from '../components/management/SectionCard'
import { SnapshotAction } from '../features/tax/components/SnapshotAction'
import { TaxRulesPanel } from '../features/tax/components/TaxRulesPanel'
import { useRestaurantTaxRules } from '../features/tax/useTax'
import { useRestaurantMenu } from '../features/menu/useMenu'

/**
 * Tax configuration (contracts/tax-client.md §2; spec 006 US1; spec 028 T002
 * re-skin): the owner's surface for the restaurant's tax rules, now under the
 * phase-026 management language — SectionCards inside a 'Tax sections' nav
 * (Rules / Add a rule / Tax snapshot). The snapshot section is this phase's
 * D1 addition: owner-only, once-only per configuration fingerprint.
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

      <ManagementLayout
        label="Tax sections"
        sections={[
          { id: 'rules', label: 'Tax rules' },
          { id: 'add-rule', label: 'Add a rule' },
          { id: 'snapshot', label: 'Tax snapshot' },
        ]}
      >
        <SectionCard id="rules" title="Tax rules" scope="owner">
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
        </SectionCard>

        <SectionCard id="add-rule" title="Add a rule" scope="owner">
          <p>
            A rule needs a name, a rate (0–100, up to four decimals), a scope, and — for
            item/category scopes — at least one target. Compound rules apply after the rules they
            name.
          </p>
          <div id="add-rule-anchor">
            {/* The create form lives in TaxRulesPanel (its 'Add a tax rule'
                button toggles it in place — the pinned affordance). This
                section anchors the nav; the panel's create mode renders inside
                the rules card above. */}
            <p className="hintText">
              Use “Add a tax rule” in the rules list above — the form opens there.
            </p>
          </div>
        </SectionCard>

        <SectionCard id="snapshot" title="Tax snapshot" scope="owner">
          <SnapshotAction restaurantId={effectiveRestaurantId} />
        </SectionCard>
      </ManagementLayout>
    </section>
  )
}
