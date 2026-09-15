import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { authClient } from '../features/auth/authClient'
import { useAuthContext } from '../features/auth/useAuthContext'

/**
 * Staff sign-in page (contracts/auth-client.md route surface; FR-001).
 *
 * Every failed attempt shows the single generic message returned by
 * `authClient.signIn` — never which part of the credentials was wrong
 * (FR-002). On success the page navigates to the remembered destination
 * (`location.state.from`, set by RequireAuth — FR-013) or the default
 * landing: a super admin without memberships lands on /admin (FR-012);
 * everyone else lands on /dashboard. There is no forced restaurant or role
 * chooser before entering the staff area (FR-015) — multi-membership
 * members switch context inside the dashboard.
 *
 * The "Forgot your password?" affordance (FR-018) switches the page into the
 * recovery-request mode: it collects the account email and calls
 * `authClient.requestPasswordReset`. The confirmation is the SAME generic
 * message for existing and non-existent addresses — no account enumeration
 * (US5 scenario 5); the wrapper intentionally never surfaces request errors
 * for the same reason.
 */

/** Reads the return-to destination carried by RequireAuth's redirect (FR-013). */
function readReturnTo(state: unknown): string | null {
  if (state !== null && typeof state === 'object' && 'from' in state) {
    const from = (state as { from: unknown }).from
    // Same-app paths only — never an absolute or external URL.
    if (typeof from === 'string' && from.startsWith('/')) {
      return from
    }
  }
  return null
}

/** The page's two modes: the sign-in form and the recovery request form. */
type Mode = 'signin' | 'recover'

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // The effective context resolves once the sign-in establishes a session
  // (the hook's query is disabled while signed out); it decides the default
  // landing.
  const { memberships, isSuperAdmin, isPending } = useAuthContext()

  const [mode, setMode] = useState<Mode>('signin')
  // Shared by both forms: a member who typed their email before realizing
  // they forgot the password finds the recovery form pre-filled.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  // Set after a successful sign-in — navigation then waits for the
  // effective context to resolve.
  const [awaitingContext, setAwaitingContext] = useState(false)
  // Recovery-request mode: sending state and the requested confirmation.
  const [sendingReset, setSendingReset] = useState(false)
  const [resetRequested, setResetRequested] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setFailureMessage(null)
    setResetRequested(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await authClient.signIn(email, password)
    if (!result.ok) {
      // The one generic, user-presentable message (FR-002).
      setFailureMessage(result.message)
      return
    }
    setFailureMessage(null)
    setAwaitingContext(true)
  }

  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSendingReset(true)
    // Always the generic outcome — the wrapper resolves identically whether
    // or not the account exists (US5 scenario 5, no account enumeration).
    await authClient.requestPasswordReset(email)
    setSendingReset(false)
    setResetRequested(true)
  }

  // Land on the remembered destination or the default landing once the
  // effective context resolves. `isPending` turns false when the query
  // settles, successfully or not — a failed resolution falls back to the
  // /dashboard landing, where the guards present the denial view.
  useEffect(() => {
    if (!awaitingContext || isPending) {
      return
    }
    const returnTo = readReturnTo(location.state)
    const defaultLanding = isSuperAdmin && memberships.length === 0 ? '/admin' : '/dashboard'
    navigate(returnTo ?? defaultLanding, { replace: true })
  }, [awaitingContext, isPending, isSuperAdmin, memberships, location.state, navigate])

  if (mode === 'recover') {
    return (
      <section aria-labelledby="recover-heading">
        <h1 id="recover-heading">Password recovery</h1>
        {resetRequested ? (
          // The same generic confirmation for existing and non-existent
          // addresses (US5 scenario 5) — it never states whether the account
          // exists.
          <>
            <p role="status">
              If an account exists for that email address, a password recovery link has been sent to
              it. Follow the link in the email to set a new password.
            </p>
            <p>
              <button type="button" onClick={() => switchMode('signin')}>
                Back to sign in
              </button>
            </p>
          </>
        ) : (
          <form onSubmit={handleResetSubmit}>
            <div>
              <label htmlFor="recover-email">Email</label>
              <input
                id="recover-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={sendingReset}
              />
            </div>
            <button type="submit" disabled={sendingReset}>
              {sendingReset ? 'Sending…' : 'Send recovery link'}
            </button>
            <p>
              <button type="button" onClick={() => switchMode('signin')} disabled={sendingReset}>
                Back to sign in
              </button>
            </p>
          </form>
        )}
      </section>
    )
  }

  return (
    <section aria-labelledby="signin-heading">
      <h1 id="signin-heading">Staff sign-in</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="signin-email">Email</label>
          <input
            id="signin-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={awaitingContext}
          />
        </div>
        <div>
          <label htmlFor="signin-password">Password</label>
          <input
            id="signin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={awaitingContext}
          />
        </div>
        {failureMessage !== null && <p role="alert">{failureMessage}</p>}
        <button type="submit" disabled={awaitingContext}>
          {awaitingContext ? 'Signing you in…' : 'Sign in'}
        </button>
      </form>
      {/* FR-018: the recovery-request affordance. */}
      <p>
        <button type="button" onClick={() => switchMode('recover')} disabled={awaitingContext}>
          Forgot your password?
        </button>
      </p>
    </section>
  )
}
