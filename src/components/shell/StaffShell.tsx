import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useAuthContext } from '../../features/auth/useAuthContext'
import { useAuthSession } from '../../features/auth/AuthProvider'
import { authClient } from '../../features/auth/authClient'
import { PLATFORM_NAV_ITEMS, STAFF_NAV_ITEMS } from '../../app/navigation'
import { SkipLink } from '../SkipLink'
import { Button, IconButton } from '../ui'
import { ContextSwitcher, type DashboardContext } from './ContextSwitcher'
import { OfflineBanner } from './OfflineBanner'
import { ShellNav } from './ShellNav'
import styles from './StaffShell.module.css'

/**
 * StaffShell (spec 023 FR-01/T003): the staff/platform chrome — sidebar +
 * header + context switcher + global infrastructure. FA-15 bounds: this is
 * composition/infrastructure ONLY — it consumes the authentication context,
 * the navigation model, the context-switcher state, and the global UI
 * infrastructure; it owns no feature data, mutations, or lifecycle logic.
 * Authorization stays server-authoritative; everything rendered here is
 * presentation derived from the effective context.
 *
 * Platform variant (FR-01): `/admin/**` renders the same shell with the
 * platform nav group. Route group selection lives in router.tsx.
 */
export function StaffShell() {
  const { memberships, isSuperAdmin } = useAuthContext()
  const { status } = useAuthSession()
  const location = useLocation()
  const [context, setContext] = useState<DashboardContext>({
    restaurantId: null,
    branchId: null,
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const onAdminArea = location.pathname.startsWith('/admin')
  const navItems = onAdminArea && isSuperAdmin ? PLATFORM_NAV_ITEMS : STAFF_NAV_ITEMS
  // A membership-less linked profile (the FR-001 bootstrap) has no staff
  // surfaces to navigate: the nav renders only for members (Fiona's E2E
  // contract asserts NO 'Staff area' navigation on her dashboard; the super
  // admin's platform group still renders).

  // Close the mobile drawer on navigation (it is a route change affordance).
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className={styles.shell} data-density="compact">
      <SkipLink />
      <OfflineBanner />
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <Link to="/" className={styles.brand}>
            RestoPilot
          </Link>
          <div className={styles.sidebarNav}>
            {(memberships.length > 0 || (onAdminArea && isSuperAdmin)) && (
              <ShellNav
                items={navItems}
                memberships={memberships}
                restaurantId={context.restaurantId}
                navLabel={onAdminArea ? 'Platform area' : 'Staff area'}
              />
            )}
          </div>
        </aside>
        <div className={styles.mainColumn}>
          <header className={styles.header}>
            <IconButton
              icon="dashboard"
              label="Open navigation menu"
              className={styles.menuButton}
              onClick={() => setDrawerOpen(true)}
            />
            <div className={styles.context}>
              {!onAdminArea && (
                <ContextSwitcher memberships={memberships} onContextChange={setContext} />
              )}
            </div>
            <div className={styles.actions}>
              {status === 'signed-in' && (
                <>
                  <Link to="/account/password" className={styles.headerLink}>
                    Account password
                  </Link>
                  <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut}>
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </Button>
                </>
              )}
            </div>
          </header>
          <main id="main" className={styles.main}>
            <Outlet />
          </main>
        </div>
      </div>
      {/* The mobile drawer (FR-09): the same nav model, focus-trapped. */}
      {drawerOpen && (
        <DrawerSurface onClose={() => setDrawerOpen(false)}>
          <div className={styles.drawerNav}>
            {(memberships.length > 0 || (onAdminArea && isSuperAdmin)) && (
              <ShellNav
                items={navItems}
                memberships={memberships}
                restaurantId={context.restaurantId}
                navLabel={onAdminArea ? 'Platform area' : 'Staff area'}
                onNavigate={() => setDrawerOpen(false)}
              />
            )}
          </div>
        </DrawerSurface>
      )}
    </div>
  )
}

/**
 * The shell's drawer: a thin wrapper over the Phase 02 Drawer primitive so
 * the shell owns no focus-management logic (FA-15) — the primitive does.
 */
import { Drawer } from '../ui'

function DrawerSurface({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <Drawer open onClose={onClose} title="Navigation">
      {children}
    </Drawer>
  )
}
