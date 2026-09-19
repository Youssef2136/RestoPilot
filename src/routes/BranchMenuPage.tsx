import { Link, useParams } from 'react-router'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import {
  BranchAvailabilityToggle,
  RestaurantAvailabilityToggle,
} from '../features/menu/components/AvailabilityControls'
import { BranchMenuPreview } from '../features/menu/components/BranchMenuPreview'
import { useBranchMenu } from '../features/menu/useMenu'

/**
 * Branch menu view (contracts/menu-client.md §2; spec 005 US2, FR-014/FR-015)
 * — the exit condition made visible: the owner (any branch of their
 * restaurant) or a branch-scoped member (their own branch) sees this branch's
 * menu exactly as customers will, with its effective availability, and may
 * adjust availability where their role allows.
 *
 * The projection's own scope check decides server-side; this page's gate only
 * chooses what to render, and an out-of-scope branch renders the explicit
 * denial — rejected, not hidden (feature 004's posture).
 */

export function BranchMenuPage() {
  const { branchId } = useParams<{ branchId: string }>()
  const {
    isPending,
    isError,
    canViewBranchMenu,
    canManageBranchAvailability,
    canManageRestaurant,
  } = useAuthContext()

  const branchMenuQuery = useBranchMenu(branchId ?? null)
  const menu = branchMenuQuery.data
  const restaurantId = menu?.restaurant.id ?? null

  if (isPending) {
    return (
      <section>
        <h1>Branch menu</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Branch menu</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  const outOfScope =
    branchId === undefined ||
    branchMenuQuery.isError ||
    (menu === undefined && !branchMenuQuery.isPending)

  if (outOfScope || (branchId !== undefined && !canViewBranchMenu(branchId))) {
    return (
      <section>
        <h1>Branch menu</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  if (menu === undefined) {
    return (
      <section>
        <h1>Branch menu</h1>
        <p>Loading the branch menu…</p>
      </section>
    )
  }

  const isOwner = restaurantId !== null && canManageRestaurant(restaurantId)
  const canManageBranch = canManageBranchAvailability(branchId)

  return (
    <section>
      <h1>{menu.branch.name} menu</h1>
      <p>
        {menu.restaurant.name} shares one menu across its branches. What customers see at{' '}
        {menu.branch.name} is this menu with the availability below applied — items stopped
        restaurant-wide, and items this branch has marked unavailable, are not offered.
      </p>

      <BranchMenuPreview menu={menu} />

      {canManageBranch && (
        <section aria-labelledby="branch-availability-heading">
          <h2 id="branch-availability-heading">Branch availability</h2>
          <p>{`Adjust what ${menu.branch.name} offers. This affects only this branch.`}</p>
          {menu.categories.map((category) => (
            <div key={category.id}>
              <h3>{category.name}</h3>
              <ul>
                {category.items.map((item) => (
                  <li key={item.id}>
                    <BranchAvailabilityToggle
                      restaurantId={menu.restaurant.id}
                      branchId={menu.branch.id}
                      itemId={item.id}
                      itemName={item.name}
                      isAvailableAtBranch={
                        item.is_offered || item.unavailable_reason === 'restaurant'
                      }
                      unavailableReason={item.unavailable_reason}
                      canManage={canManageBranch}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {isOwner && (
        <section aria-labelledby="restaurant-availability-heading">
          <h2 id="restaurant-availability-heading">Restaurant-wide availability</h2>
          <p>
            Owner controls that apply to every branch of {menu.restaurant.name}. They are also
            available on the menu management page.
          </p>
          {menu.categories.map((category) => (
            <div key={category.id}>
              <h3>{category.name}</h3>
              <ul>
                {category.items.map((item) => (
                  <li key={item.id}>
                    <RestaurantAvailabilityToggle
                      restaurantId={menu.restaurant.id}
                      itemId={item.id}
                      itemName={item.name}
                      isAvailable={item.unavailable_reason !== 'restaurant'}
                      canManage={isOwner}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <p>
        <Link to="/dashboard/branches">Back to branches</Link>
      </p>
    </section>
  )
}
