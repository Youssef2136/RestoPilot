import { Link } from 'react-router'
import { useAuthContext } from '../features/auth/useAuthContext'

/**
 * Own profile page (FR-011): the signed-in member's basic profile
 * information (display name) together with their effective roles and scope,
 * resolved from their current memberships through the context RPC (FR-004)
 * — the same resolution path the guards and the dashboard consume.
 */
export function ProfilePage() {
  const { profile, memberships, isSuperAdmin, isPending, isError } = useAuthContext()

  return (
    <section>
      <h1>Your profile</h1>
      {isPending ? (
        <p>Loading your profile…</p>
      ) : isError ? (
        <p role="alert">Your profile could not be loaded. Reload the page and try again.</p>
      ) : (
        <>
          {profile === null ? (
            <p>No staff profile is linked to this account.</p>
          ) : (
            <>
              <h2>Basic information</h2>
              <dl>
                <dt>Display name</dt>
                <dd>{profile.display_name}</dd>
              </dl>
              {isSuperAdmin && <p>This account holds the platform super-admin capability.</p>}
            </>
          )}

          <h2>Effective roles and scope</h2>
          {memberships.length === 0 ? (
            <p>No staff memberships — no restaurant scope.</p>
          ) : (
            <ul>
              {memberships.map((membership) => (
                <li
                  key={`${membership.restaurant_id}:${membership.role}:${membership.branch_id ?? 'all'}`}
                >
                  {membership.restaurant_name} ({membership.restaurant_slug}) — {membership.role} —{' '}
                  {membership.branch_name ?? 'all branches'}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p>
        <Link to="/dashboard">Back to the dashboard</Link>
      </p>
    </section>
  )
}
