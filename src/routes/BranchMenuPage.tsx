import { Link, useParams } from 'react-router'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { useRealtimeInvalidation } from '../features/realtime/useRealtimeInvalidation'
import {
  BranchAvailabilityToggle,
  RestaurantAvailabilityToggle,
} from '../features/menu/components/AvailabilityControls'
import { BranchMenuPreview } from '../features/menu/components/BranchMenuPreview'
import { invalidateMenuForRealtime, useBranchMenu } from '../features/menu/useMenu'
import { ManagementLayout } from '../components/management/ManagementLayout'
import { SectionCard } from '../components/management/SectionCard'

/**
 * Branch menu view (contracts/menu-client.md §2; spec 005 US2, FR-014/FR-015;
 * spec 027 T006 re-skin) — the exit condition made visible: the owner (any
 * branch of their restaurant) or a branch-scoped member (their own branch)
 * sees this branch's menu exactly as customers will, with its effective
 * availability, and may adjust availability where their role allows. The
 * sections live in the phase-06 SectionCards with the ScopeBadge treatment
 * (owner vs manager clarity).
 *
 * Realtime (spec 027 Q5/FR-09): one `branch_unavailable_items` subscription
 * invalidates BOTH projections — the customer-visible branch menu AND the
 * restaurant availability surface — so a mid-service toggle lands without a
 * manual refresh (the exit criterion; the E2E proves it). The event payload
 * is never rendered (Constitution I).
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

  // One subscription, both projections: the branch menu (customer-visible)
  // and every restaurant menu tree. invalidateMenuForRealtime clears the
  // whole `['menu', …]` root — the branch key is a child of it.
  useRealtimeInvalidation({
    scopeValue: branchId ?? null,
    table: 'branch_unavailable_items',
    invalidate: invalidateMenuForRealtime,
  })

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

  const sections = [
    { id: 'preview', label: 'Menu preview' },
    ...(canManageBranch ? [{ id: 'branch-availability', label: 'Branch availability' }] : []),
    ...(isOwner ? [{ id: 'restaurant-availability', label: 'Restaurant-wide availability' }] : []),
  ]

  return (
    <section>
      <h1>{menu.branch.name} menu</h1>
      <p>
        {menu.restaurant.name} shares one menu across its branches. What customers see at{' '}
        {menu.branch.name} is this menu with the availability below applied — items stopped
        restaurant-wide, and items this branch has marked unavailable, are not offered.
      </p>

      <ManagementLayout label="Branch menu sections" sections={sections}>
        <SectionCard id="preview">
          {/* The preview owns its category headings — no section h2 between
              the h1 and them (the customer-mirror contract). */}
          <BranchMenuPreview menu={menu} />
        </SectionCard>

        {canManageBranch && (
          <SectionCard
            id="branch-availability"
            title="Branch availability"
            scope={isOwner ? 'owner' : undefined}
          >
            <p>{`Adjust what ${menu.branch.name} offers. This affects only this branch.`}</p>
            <AvailabilityGroups
              menu={menu}
              render={(category) => (
                <BranchAvailabilityToggle
                  restaurantId={menu.restaurant.id}
                  branchId={menu.branch.id}
                  itemId={category.item.id}
                  itemName={category.item.name}
                  isAvailableAtBranch={
                    category.item.is_offered || category.item.unavailable_reason === 'restaurant'
                  }
                  unavailableReason={category.item.unavailable_reason}
                  canManage={canManageBranch}
                />
              )}
            />
          </SectionCard>
        )}

        {isOwner && (
          <SectionCard
            id="restaurant-availability"
            title="Restaurant-wide availability"
            scope="owner"
          >
            <p>
              Owner controls that apply to every branch of {menu.restaurant.name}. They are also
              available on the menu management page.
            </p>
            <AvailabilityGroups
              menu={menu}
              render={(category) => (
                <RestaurantAvailabilityToggle
                  restaurantId={menu.restaurant.id}
                  itemId={category.item.id}
                  itemName={category.item.name}
                  isAvailable={category.item.unavailable_reason !== 'restaurant'}
                  canManage={isOwner}
                />
              )}
            />
          </SectionCard>
        )}
      </ManagementLayout>

      <p>
        <Link to="/dashboard/branches">Back to branches</Link>
      </p>
    </section>
  )
}

/**
 * The per-category grouping shared by both availability sections (T006): the
 * projection's categories in order, each item rendered by the section's
 * toggle. The h3-per-category structure is the pinned shape the toggles'
 * reasons hang from.
 */
function AvailabilityGroups({
  menu,
  render,
}: {
  menu: import('../features/menu/menuClient').BranchMenu
  render: (entry: {
    category: import('../features/menu/menuClient').BranchMenuCategory
    item: import('../features/menu/menuClient').BranchMenuItem
  }) => React.ReactNode
}) {
  return (
    <div>
      {menu.categories.map((category) => (
        <div key={category.id} className="availabilityGroup">
          <h3>{category.name}</h3>
          <ul>
            {category.items.map((item) => (
              <li key={item.id}>{render({ category, item })}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
