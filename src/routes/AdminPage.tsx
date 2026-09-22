import { useAuthContext } from '../features/auth/useAuthContext'

/**
 * The platform admin area shell (FR-012) — reachable only via
 * RequireSuperAdmin (the route wiring owns the guard; see the route surface
 * in contracts/auth-client.md). The shell fetches NO restaurant tenant
 * data: the super-admin capability grants none in this phase, and
 * platform-wide capabilities arrive with the Phase 13 features. The only
 * read is the caller's own effective context (own profile row — how the
 * capability is recognized).
 */
export function AdminPage() {
  const { profile, isPending, isError } = useAuthContext()

  return (
    <section>
      <h1>Super Admin</h1>
      {isPending ? (
        <p>Loading your account…</p>
      ) : isError ? (
        <p role="alert">Your account could not be loaded. Reload the page and try again.</p>
      ) : (
        <>
          {profile === null ? (
            <p>No platform profile is linked to this account.</p>
          ) : (
            <>
              <p>Signed in as {profile.display_name}.</p>
              {profile.is_super_admin && (
                <p>This account holds the platform super-admin capability.</p>
              )}
            </>
          )}
          <p>
            <a href="/admin/platform">Open the platform console</a> — every restaurant, its
            subscription state, and platform usage (Phase 13).
          </p>
        </>
      )}
    </section>
  )
}
