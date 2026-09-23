import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { getSupabaseClient, createEphemeralSupabaseClient } from '../../lib/supabase'

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

/**
 * The change-password flow's ONE distinct failure message (spec 020 FR-006,
 * clarify 2026-09-23): the incorrect current password is the only cause the
 * flow distinguishes — the actor is the session-proven account holder
 * verifying their own credential, so the honest hint carries no enumeration
 * risk. Every other failure (policy rejection, expired session, network)
 * shares the existing generic PASSWORD_RESET_FAILURE_MESSAGE.
 */
export const CURRENT_PASSWORD_FAILURE_MESSAGE =
  'The current password is incorrect. Check it and try again.'

export type ChangePasswordResult = { ok: true } | { ok: false; message: string }

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
   * Self-service password change (spec 020, contracts/auth-client.md) — a
   * distinct flow from recovery, sharing only platform primitives.
   *
   * Execution order (normative — the unit suite pins it):
   * 1. VERIFY — a sign-in attempt with the current password on a THROWAWAY
   *    client (`createEphemeralSupabaseClient()` — in-memory storage), never
   *    the app's shared client and never the shared localStorage slot: the
   *    attempt must not disturb the page's live session, fire app-visible
   *    auth events, or leave dead tokens in persisted storage. The
   *    platform's own sign-in operation is the verifier — no parallel
   *    verification mechanism exists, and its rate limiting is inherited.
   * 2. APPLY — `updateUser({ password })` on the page's own session. The
   *    platform invalidates every other independently established session
   *    and leaves the initiating session valid; the client performs no token
   *    operations and emulates none of it. Failure ⇒ the generic
   *    PASSWORD_RESET_FAILURE_MESSAGE.
   *
   * Self-targeted by construction: the input carries exactly
   * { currentPassword, newPassword } — no user id or email anywhere
   * (FR-003). Inputs are never logged (FR-010).
   */
  async changePassword(input: {
    currentPassword: string
    newPassword: string
  }): Promise<ChangePasswordResult> {
    // Step 1 — verify on an ephemeral (in-memory-storage) client that is
    // discarded immediately: no shared state, no persisted tokens.
    const { error: verifyError } = await createEphemeralSupabaseClient().auth.signInWithPassword({
      // The email is taken from the live session's own subject — one more
      // way this operation can only ever target the calling account.
      email: (await getSupabaseClient().auth.getUser()).data.user?.email ?? '',
      password: input.currentPassword,
    })
    if (verifyError) {
      return { ok: false, message: CURRENT_PASSWORD_FAILURE_MESSAGE }
    }

    // Step 2 — apply on the page's own session.
    const { error: updateError } = await getSupabaseClient().auth.updateUser({
      password: input.newPassword,
    })
    if (updateError) {
      return { ok: false, message: PASSWORD_RESET_FAILURE_MESSAGE }
    }
    return { ok: true }
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
