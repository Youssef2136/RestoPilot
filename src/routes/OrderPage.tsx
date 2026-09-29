import { Navigate, useParams } from 'react-router'

/**
 * The C1 deep-link redirect (spec 024 FR-09; Clarification Q2).
 *
 * `/order/:branchId` was the Phase-0 placeholder "branch ordering" route;
 * the real order surface is the customer menu at `/r/:slug/menu` reached
 * through the entry flow, and NO public branch→restaurant lookup exists
 * (adding one would be an unauthorized backend change — Constitution IV).
 * The route therefore redirects to the landing with the branch id echoed in
 * the query, where the guidance names the QR-code path. The echo is
 * acknowledgement only — nothing is fetched with it.
 *
 * The routes.test.ts '/order/demo-branch' h1 pin migrates deliberately to a
 * redirect assertion (F-G09/FA-8 — recorded in the ledger at the phase
 * checkpoint).
 */

/**
 * The pure redirect mapping (unit-pinned): the landing path with the branch
 * echo. `undefined`/empty branch ids land on the bare path.
 */
export function orderRedirectTarget(branchId: string | undefined): string {
  return branchId ? `/?branch=${encodeURIComponent(branchId)}` : '/'
}

export function OrderPage() {
  const { branchId } = useParams<{ branchId: string }>()
  return <Navigate to={orderRedirectTarget(branchId)} replace />
}
