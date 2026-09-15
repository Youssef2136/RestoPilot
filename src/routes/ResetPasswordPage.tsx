import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { authClient } from '../features/auth/authClient'
import { useAuthSession } from '../features/auth/AuthProvider'

/**
 * Password recovery page (contracts/auth-client.md route surface; FR-018).
 *
 * Reached through the time-limited, single-use recovery link delivered to
 * the account email: following the link establishes a session and fires the
 * PASSWORD_RECOVERY auth event. This page listens for that event, collects
 * the new password, and calls `authClient.completePasswordReset`
 * (`updateUser({ password })` — the platform's documented recovery step).
 *
 * The route is PUBLIC and deliberately NOT RequireStaff-guarded: it is a
 * session-bearing auth page, not a staff-area view. A recovery session is
 * simply an authenticated identity changing its own credential — routing it
 * through the staff guard would wrongly deny identities whose profile is not
 * linked (the guard renders NotAuthorized for the unlinked case) and would
 * conflate credential recovery with staff-area authorization. The guards are
 * presentation over the staff area; this page guards nothing but the form's
 * own submit (Constitution IV).
 */
export function ResetPasswordPage() {
  const { status } = useAuthSession()

  // Set when the PASSWORD_RECOVERY event fires on this page. The event may
  // also fire during app bootstrap (the recovery link lands directly here
  // and the SDK exchanges the token at client init) — the session state
  // covers that case: any established session enables the form.
  const [recoverySession, setRecoverySession] = useState(false)

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [succeeded, setSucceeded] = useState(false)

  useEffect(() => {
    // Listen for the recovery event (FR-018): following the recovery link
    // establishes a session and fires PASSWORD_RECOVERY. Cleanup on unmount —
    // no leaked subscriptions.
    const {
      data: { subscription },
    } = authClient.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoverySession(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const formReady = recoverySession || status === 'signed-in'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmation) {
      setFailureMessage('The two passwords do not match.')
      return
    }
    setSubmitting(true)
    const result = await authClient.completePasswordReset(password)
    setSubmitting(false)
    if (!result.ok) {
      // The one generic, user-presentable failure message (FR-018).
      setFailureMessage(result.message)
      return
    }
    setFailureMessage(null)
    setSucceeded(true)
  }

  return (
    <section aria-labelledby="reset-password-heading">
      <h1 id="reset-password-heading">Reset your password</h1>
      {succeeded ? (
        // FR-018/FR-019: the previous password is dead and nothing else
        // about the account changed — sign in with the new password.
        <>
          <p role="status">Your password has been updated.</p>
          <p>
            <Link to="/signin">Continue to sign in with your new password</Link>
          </p>
        </>
      ) : formReady ? (
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="reset-password-new">New password</label>
            <input
              id="reset-password-new"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="reset-password-confirm">Confirm new password</label>
            <input
              id="reset-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              disabled={submitting}
            />
          </div>
          {failureMessage !== null && <p role="alert">{failureMessage}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Updating your password…' : 'Set new password'}
          </button>
        </form>
      ) : status === 'loading' && !recoverySession ? (
        // Session restore / link exchange still in flight — no premature
        // "no recovery link" guidance (same posture as the guards).
        <p>Checking your recovery link…</p>
      ) : (
        // No session and no recovery event: this page is only meaningful
        // through the emailed link. The recovery request affordance lives on
        // the sign-in page (FR-018).
        <>
          <p>
            This page is reached through the password recovery link sent to your email address.
            Request a recovery link from the sign-in page, then follow the link in the email.
          </p>
          <p>
            <Link to="/signin">Back to sign in</Link>
          </p>
        </>
      )}
    </section>
  )
}
