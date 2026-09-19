import { Link, useParams } from 'react-router'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { BranchTaxPanel } from '../features/tax/components/BranchTaxPanel'
import { TaxPreview } from '../features/tax/components/TaxPreview'
import { useBranchTaxConfig } from '../features/tax/useTax'
import { useBranchMenu } from '../features/menu/useMenu'

/**
 * The branch's tax view (contracts/tax-client.md §2; spec 006 US2): the
 * branch's effective tax configuration — computed by
 * `get_branch_tax_config`, never assembled in the client (Constitution V) —
 * with the management controls only within `canManageBranchTax`.
 *
 * Route guarded by `RequireStaff`; the in-page gates are `canViewBranchTax`
 * (the page renders at all) and `canManageBranchTax` (the controls render).
 * The configuration RPC's own scope check remains the boundary — an
 * out-of-scope branch id resolves as a denial from the server side too
 * (Constitution IV).
 */
export function BranchTaxPage() {
  const { branchId } = useParams<{ branchId: string }>()
  const { memberships, isPending, isError, canManageRestaurant, canViewBranchTax } =
    useAuthContext()

  const configQuery = useBranchTaxConfig(branchId ?? null)
  // The preview needs the branch's customer-visible menu (item + extra names
  // and amounts) — the same projection the ordering surfaces read.
  const menuQuery = useBranchMenu(branchId ?? null)

  if (isPending) {
    return (
      <section>
        <h1>Branch tax</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Branch tax</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  if (branchId === undefined || !canViewBranchTax(branchId)) {
    return (
      <section>
        <h1>Branch tax</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  if (configQuery.isPending) {
    return (
      <section>
        <h1>Branch tax</h1>
        <p>Loading the tax configuration…</p>
      </section>
    )
  }

  if (configQuery.isError) {
    // Includes the server's own scope refusal for an out-of-scope branch —
    // rendered as the denial state, not an empty configuration.
    return (
      <section>
        <h1>Branch tax</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const config = configQuery.data
  // The controls gate mirrors the override RPC's authorization EXACTLY, now
  // that the projection has resolved the branch's restaurant: an owner of
  // that restaurant, or a branch_manager membership on THIS branch. (The
  // context's canManageBranchTax is the coarse pre-read gate — any owner
  // passes it, because ownership is restaurant-wide and a bare branch id
  // cannot resolve the restaurant; the precise composition happens here.)
  const restaurantId = config.restaurant_id
  const isBranchManagerHere = memberships.some(
    (m) => m.branch_id === branchId && m.role === 'branch_manager',
  )
  const canManage = canManageRestaurant(restaurantId) || isBranchManagerHere

  return (
    <section>
      <h1>{config.branch.name} tax</h1>
      <p>
        What this branch charges: the restaurant's rules in order, with any replacement rates this
        branch sets. Rules marked <strong>branch-only</strong> apply here and nowhere else.
      </p>

      {memberships.length > 1 && !canManage && (
        <p>You can view this configuration but not change it.</p>
      )}

      <BranchTaxPanel restaurantId={restaurantId} config={config} canManage={canManage} />

      {menuQuery.data !== undefined && <TaxPreview branchId={branchId!} menu={menuQuery.data} />}

      <p>
        <Link to={`/dashboard/branches/${branchId}`}>Back to the branch</Link>
      </p>
    </section>
  )
}
