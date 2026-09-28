import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { useAuthSession } from './AuthProvider'
import { useAuthContext } from './useAuthContext'

/**
 * Route guards (contracts/auth-client.md, extended by
 * contracts/management-client.md §2/§3) — PRESENTATION ONLY. The enforced
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
    <section aria-labelledby="not-authorized-heading" style={{ maxWidth: '38rem' }}>
      <h1 id="not-authorized-heading">Not authorized</h1>
      <p>You are signed in, but your account does not have access to this area.</p>
      <p>
        This area needs a role your account does not hold (for example, an owner or branch manager
        role). Ask your restaurant's owner to grant you the right role from the staff list, or
        return to where you can work.
      </p>
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
 *
 * Spec 023 FR-08: the redirect carries `expired: true` when the visitor had
 * reached a guarded route while signed-in state was still possible — i.e.
 * the redirect happened from a genuine signed-out resolution rather than a
 * cold visit. SignInPage reads it for the friendly "your session ended"
 * note. DECISION SEMANTICS UNCHANGED: the same redirect, same return-to.
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
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: location.pathname + location.search, expired: true }}
      />
    )
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
 * Requires a linked profile (spec 004 FR-001 bootstrap;
 * contracts/management-client.md §2/§3): a signed-in identity with a profile
 * — with memberships (the staff area) or without (restaurant creation). The
 * unlinked-identity denial stays exactly as feature 003 defined it: no
 * profile ⇒ the denial view (FR-005, FR-014).
 */
export function RequireProfile({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <ProfileGate>{children}</ProfileGate>
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

function ProfileGate({ children }: { children: ReactNode }) {
  const { profile, isPending } = useAuthContext()

  if (isPending) {
    // Effective context still resolving — no denial flash.
    return null
  }
  // Same deny-by-default posture as StaffGate: a failed context query and
  // the genuinely unlinked identity both render the denial view.
  return profile !== null ? children : <NotAuthorized />
}

function SuperAdminGate({ children }: { children: ReactNode }) {
  const { isSuperAdmin, isPending } = useAuthContext()

  if (isPending) {
    return null
  }
  return isSuperAdmin ? children : <NotAuthorized />
}
