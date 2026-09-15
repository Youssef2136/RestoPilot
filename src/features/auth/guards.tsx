import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { useAuthSession } from './AuthProvider'
import { useAuthContext } from './useAuthContext'

/**
 * Route guards (contracts/auth-client.md) — PRESENTATION ONLY. The enforced
 * boundary is the data layer (Constitution IV; spec FR-008): guards shape
 * navigation and render the explicit denial view; they never authorize a
 * data operation. Guard decisions consume the effective context from
 * `useAuthContext` (the `current_auth_context` RPC — the single resolution
 * path, FR-010) — never raw table state.
 */

/**
 * The explicit denial view (FR-014): a signed-in visitor who deep-links to a
 * view their account does not permit lands here — rejected, never merely
 * hidden from navigation.
 */
export function NotAuthorized() {
  return (
    <section aria-labelledby="not-authorized-heading">
      <h1 id="not-authorized-heading">Not authorized</h1>
      <p>You are signed in, but your account does not have access to this area.</p>
      <p>
        <Link to="/">Back to the home page</Link>
      </p>
    </section>
  )
}

/**
 * Requires an authenticated session (FR-013): an unauthenticated visitor is
 * redirected to /signin with the requested location in `location.state.from`
 * — the return-to destination after a successful sign-in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuthSession()
  const location = useLocation()

  if (status === 'loading') {
    // Session restore is in flight — render nothing rather than flash
    // protected content or a premature redirect.
    return null
  }

  if (status === 'signed-out') {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />
  }

  return children
}

/**
 * Requires a staff member — a linked profile holding at least one
 * membership. A signed-in identity that is not staff — including the
 * unlinked-identity case (FR-005) — gets the denial view (FR-014).
 */
export function RequireStaff({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <StaffGate>{children}</StaffGate>
    </RequireAuth>
  )
}

/**
 * Requires the platform super-admin capability (FR-012). A signed-in
 * identity without the capability gets the denial view (FR-014).
 */
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <SuperAdminGate>{children}</SuperAdminGate>
    </RequireAuth>
  )
}

function StaffGate({ children }: { children: ReactNode }) {
  const { isStaff, isPending } = useAuthContext()

  if (isPending) {
    // Effective context still resolving — no denial flash.
    return null
  }
  // A failed context resolution (query error) also lands on the denial
  // view: deny-by-default presentation. The data layer is the boundary
  // regardless of what the guard renders.
  return isStaff ? children : <NotAuthorized />
}

function SuperAdminGate({ children }: { children: ReactNode }) {
  const { isSuperAdmin, isPending } = useAuthContext()

  if (isPending) {
    return null
  }
  return isSuperAdmin ? children : <NotAuthorized />
}
