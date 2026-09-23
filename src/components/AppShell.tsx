import { Link, Outlet } from 'react-router'
import { useState } from 'react'
import { authClient } from '../features/auth/authClient'
import { useAuthSession } from '../features/auth/AuthProvider'
import styles from './AppShell.module.css'

/**
 * Application shell (spec FR-011): root layout with navigation for the three
 * application experiences — the staff area (DashboardPage, AdminPage) and the
 * public customer pages render inside it. Route guards and business UI belong
 * to later phases.
 *
 * Sign-out affordance (FR-017): a signed-in member can end the CURRENT
 * DEVICE's session from the shell (`authClient.signOut()` — local scope, so
 * concurrent sessions on other devices survive, spec Assumptions). The
 * SIGNED_OUT event flips the session provider, and the route guards
 * immediately re-protect the staff areas — no navigation logic lives here.
 */
export function AppShell() {
  const { status } = useAuthSession()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          RestoPilot
        </Link>
        <div className={styles.actions}>
          <nav className={styles.nav} aria-label="Application areas">
            <Link to="/r/demo-restaurant">Customer</Link>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/admin">Admin</Link>
          </nav>
          {/* The account-password link and the sign-out control appear only
              when there is a session — never for anonymous visitors of the
              public pages. The password link is role-neutral (spec 020
              FR-002): every signed-in identity reaches their own credential
              surface. */}
          {status === 'signed-in' && (
            <>
              <Link to="/account/password" className={styles.signOut}>
                Account password
              </Link>
              <button
                type="button"
                className={styles.signOut}
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          )}
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
