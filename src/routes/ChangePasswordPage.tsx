import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { authClient } from '../features/auth/authClient'
import { useAuthSession } from '../features/auth/AuthProvider'

/**
 * Account password page (spec 020, contracts/auth-client.md) — the
 * self-service change-password flow for ANY signed-in identity.
 *
 * Route posture: session-bearing auth page, exactly like /reset-password —
 * deliberately NOT RequireStaff/RequireProfile-guarded (FR-002): a linked
 * profile without memberships, an unlinked identity, and the platform super
 * admin must all reach their own credential surface; routing it through the
 * staff guard would conflate credential management with staff-area
 * authorization (the router comment records the rationale).
 *
 * Message policy (FR-006): authClient.changePassword returns the distinct
 * current-password message or the one generic message — this page renders
 * exactly what it receives, never inspects causes. Confirmation mismatch is
 * LOCAL presentational validation (FR-005) — refused before any platform
 * call. While submitting, the form is disabled (FR-011) and re-usable
 * immediately after any outcome. Password material is never rendered into
 * attributes beyond type/autocomplete, never logged, never persisted
 * (FR-010) — a refresh returns the form to its neutral state by construction
 * (state is component-local).
 *
 * Session expiry mid-flight (FR-012): the failed attempt renders the generic
 * message; the SIGNED_OUT event flips the provider and this page's
 * signed-out presentation takes over — the same guidance pattern as the
 * recovery page's no-session state.
 *
 * Success (FR-007): the confirmation states both verified session facts —
 * this device stays signed in; other signed-in devices were signed out. No
 * automatic navigation; the message remains readable until the user leaves.
 */
export function ChangePasswordPage() {
  const { status } = useAuthSession()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [succeeded, setSucceeded] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // FR-005: presentational validation, resolved locally — no platform call.
    if (newPassword !== confirmation) {
      setFailureMessage('The two passwords do not match.')
      return
    }
    setSubmitting(true)
    const result = await authClient.changePassword({ currentPassword, newPassword })
    setSubmitting(false)
    if (!result.ok) {
      setFailureMessage(result.message)
      return
    }
    setFailureMessage(null)
    setSucceeded(true)
  }

  return (
    <section aria-labelledby="account-password-heading">
      <h1 id="account-password-heading">Account password</h1>
      {status === 'loading' ? (
        // Session restore in flight — no premature signed-out guidance (the
        // guards' posture).
        <p>Checking your session…</p>
      ) : status === 'signed-out' ? (
        // Signed out — ALWAYS the signed-out presentation, regardless of any
        // earlier local success state (FR-012): the session loss takes over,
        // exactly like the guards re-protect the staff areas. A success
        // confirmation from a change this session just made is no longer
        // renderable — the session it described is gone.
        <>
          <p>
            Sign in first to change your account password from this page. If you cannot sign in,
            request a password recovery link from the sign-in page instead.
          </p>
          <p>
            <Link to="/signin">Go to sign in</Link>
          </p>
        </>
      ) : succeeded ? (
        // FR-007: both session facts, stated exactly. Rendered only while the
        // (surviving) session is present — see the signed-out branch above.
        <>
          <p role="status">
            Your password has been changed. This device stays signed in; other signed-in devices
            have been signed out.
          </p>
          <p>
            <Link to="/dashboard">Back to the dashboard</Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="account-password-current">Current password</label>
            <input
              id="account-password-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="account-password-new">New password</label>
            <input
              id="account-password-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="account-password-confirm">Confirm new password</label>
            <input
              id="account-password-confirm"
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
            {submitting ? 'Changing your password…' : 'Change password'}
          </button>
        </form>
      )}
    </section>
  )
}
