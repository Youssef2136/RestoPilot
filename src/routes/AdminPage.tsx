import { useAuthContext } from '../features/auth/useAuthContext'
import { usePlatformOverview } from '../features/platform/usePlatform'

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

  // D5 — the landing posture rides the SAME overview query the console uses
  // (no second shape, no tenant data beyond the payload — FR-10). Rendered
  // only once it resolves; a failure here leaves the console link intact.
  const overview = usePlatformOverview()

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
              {profile.is_super_admin && overview.data !== undefined && (
                <p>
                  Platform posture: {overview.data.length} tenants ·{' '}
                  {overview.data.filter((r) => r.platform_disabled).length} disabled. This
                  capability administers tenants — it grants no restaurant data beyond the overview.
                </p>
              )}
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
