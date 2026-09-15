import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'

/**
 * Auth client module (contracts/auth-client.md) — the typed wrapper that is
 * the ONLY import path for `supabase.auth.*` in application code. One place
 * to audit for the FR-002 (single generic sign-in failure) and FR-017
 * (local-scope sign-out) properties.
 */

export type SignInResult = { ok: true } | { ok: false; message: string }

export type PasswordResetResult = { ok: true } | { ok: false; message: string }

/**
 * The one generic, user-presentable sign-in failure message (FR-002). Never
 * dissected per cause — wrong password and unknown account are
 * indistinguishable (the platform already returns identical errors; the
 * wrapper preserves that property and never inspects error.message).
 */
export const SIGN_IN_FAILURE_MESSAGE =
  'Sign-in failed. Check your email and password, then try again.'

export const PASSWORD_RESET_FAILURE_MESSAGE = 'Password update failed. Please try again.'

export const authClient = {
  /**
   * Sign in with email + password. On failure the result carries exactly one
   * generic message — never whether the account exists or which field was
   * wrong (FR-002).
   */
  async signIn(email: string, password: string): Promise<SignInResult> {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
    if (error) {
      return { ok: false, message: SIGN_IN_FAILURE_MESSAGE }
    }
    return { ok: true }
  },

  /**
   * Sign out the CURRENT DEVICE only — `scope: 'local'` is part of the
   * contract (FR-017). The SDK's `global` default would end every device's
   * session, contradicting the approved current-device assumption.
   */
  async signOut(): Promise<void> {
    await getSupabaseClient().auth.signOut({ scope: 'local' })
  },

  /**
   * Request a password recovery email. Always resolves with the generic
   * outcome — the caller presents the same confirmation for existing and
   * non-existent addresses (US5 scenario 5, no account enumeration); errors
   * are intentionally not surfaced for the same reason.
   */
  async requestPasswordReset(email: string): Promise<void> {
    await getSupabaseClient()
      .auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })
      .catch(() => undefined)
  },

  /**
   * Complete password recovery with a new password. Valid only with the
   * recovery-established session; on success the previous password is dead
   * and nothing else about the account changed (FR-018/FR-019).
   */
  async completePasswordReset(newPassword: string): Promise<PasswordResetResult> {
    const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword })
    if (error) {
      return { ok: false, message: PASSWORD_RESET_FAILURE_MESSAGE }
    }
    return { ok: true }
  },

  /** Session access, delegated to the SDK (FR-016 — localStorage persistence). */
  getSession(): Promise<{ data: { session: Session | null } }> {
    return getSupabaseClient().auth.getSession()
  },

  /** Auth-event subscription, delegated to the SDK. */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return getSupabaseClient().auth.onAuthStateChange(callback)
  },
}
