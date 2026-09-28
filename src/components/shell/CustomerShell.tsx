import { useState } from 'react'
import { Outlet } from 'react-router'
import { useAuthSession } from '../../features/auth/AuthProvider'
import { authClient } from '../../features/auth/authClient'
import { SkipLink } from '../SkipLink'
import { Button } from '../ui'
import styles from './CustomerShell.module.css'

/**
 * CustomerShell (spec 023 FR-01/T003): the lightweight, mobile-first shell
 * for the public/customer experiences — NO staff chrome, NO navigation
 * links (customers are anonymous; the restaurant's own page is the nav).
 * Credential routes render through this shell without any nav links.
 *
 * The signed-out affordance: a signed-in visitor on a credential route must
 * keep a way out — `authClient.signOut()` (the exact contract StaffShell
 * uses). It is not a navigation link (FR-01 intact: zero nav links; the
 * shell stays landmark-pure), it is the account action. On
 * `/account/password` the phase-020 walkthrough signs out from the page
 * itself — the regression this action prevents (auth.routes E2E pins that
 * button there).
 *
 * FA-15: pure composition — it owns nothing but layout and landmarks.
 */
export function CustomerShell() {
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
      <SkipLink />
      {status === 'signed-in' && (
        <div className={styles.sessionBar}>
          <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      )}
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
