import { Link, useParams } from 'react-router'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { ManagementLayout } from '../components/management/ManagementLayout'
import { SectionCard } from '../components/management/SectionCard'
import { BranchTaxPanel } from '../features/tax/components/BranchTaxPanel'
import { TaxPreview } from '../features/tax/components/TaxPreview'
import { useBranchTaxConfig } from '../features/tax/useTax'
import { useBranchMenu } from '../features/menu/useMenu'

/**
 * The branch's tax view (contracts/tax-client.md §2; spec 006 US2; spec 028
 * T007 re-skin): the branch's effective tax configuration — computed by
 * `get_branch_tax_config`, never assembled in the client (Constitution V) —
 * now under the phase-026 management language (SectionCards inside a 'Branch
 * tax sections' nav: Effective configuration / Overrides / Calculation
 * preview), with the management controls only within `canManageBranchTax`.
 *
 * Route guarded by `RequireStaff`; the in-page gates are `canViewBranchTax`
 * (the page renders at all) and `canManageBranchTax` (the controls render).
 * The configuration RPC's own scope check decides server-side; this page's
 * gate only chooses what to render, and an out-of-scope branch renders the
 * explicit denial — rejected, not hidden (feature 004's posture).
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

  const sections = [
    { id: 'effective', label: 'Effective configuration' },
    ...(canManage ? [{ id: 'overrides', label: 'Overrides' }] : []),
    ...(menuQuery.data !== undefined ? [{ id: 'preview', label: 'Calculation preview' }] : []),
  ]

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

      <ManagementLayout label="Branch tax sections" sections={sections}>
        <SectionCard
          id="effective"
          title="Effective configuration"
          scope={canManage ? 'owner' : 'read-only'}
        >
          <BranchTaxPanel restaurantId={restaurantId} config={config} canManage={canManage} />
        </SectionCard>

        {canManage && (
          <SectionCard id="overrides" title="Overrides" scope="owner">
            <p>
              A replacement rate applies at this branch only; “Use restaurant default” clears it and
              the rule shows as inherited again. The badge on each rule says where its rate comes
              from.
            </p>
            {/* The per-rule override editor lives inside the effective list
                (BranchTaxPanel) — this section documents the posture and
                anchors the nav. */}
          </SectionCard>
        )}

        {menuQuery.data !== undefined && (
          <SectionCard id="preview" title="Calculation preview">
            <TaxPreview branchId={branchId!} menu={menuQuery.data} />
          </SectionCard>
        )}
      </ManagementLayout>

      <p>
        <Link to={`/dashboard/branches/${branchId}`}>Back to the branch</Link>
      </p>
    </section>
  )
}
