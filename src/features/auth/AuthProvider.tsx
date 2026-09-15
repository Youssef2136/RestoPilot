import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authClient } from './authClient'

/**
 * Session provider (contracts/auth-client.md) — session state via the single
 * `onAuthStateChange` subscription.
 *
 * Session ≠ staff context: an authenticated identity with no linked profile
 * is `signed-in` with an empty context — that case is handled by the guards,
 * not by the provider.
 */

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out'

export interface AuthSessionState {
  session: Session | null
  status: AuthStatus
}

const AuthSessionContext = createContext<AuthSessionState | undefined>(undefined)

const INITIAL_STATE: AuthSessionState = { session: null, status: 'loading' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthSessionState>(INITIAL_STATE)

  useEffect(() => {
    // One subscription drives everything: the SDK's INITIAL_SESSION restore
    // on mount (status stays 'loading' until then — no signed-out flash,
    // FR-016) and every subsequent event (SIGNED_IN, SIGNED_OUT,
    // PASSWORD_RECOVERY — a recovery link establishes a session — and
    // token-refresh events keep the member signed in). Events carrying a
    // session mean signed-in; events without one mean signed-out.
    const {
      data: { subscription },
    } = authClient.onAuthStateChange((_event, session) => {
      setState({ session, status: session ? 'signed-in' : 'signed-out' })
    })

    // Cleanup on unmount — no leaked subscriptions.
    return () => subscription.unsubscribe()
  }, [])

  return <AuthSessionContext.Provider value={state}>{children}</AuthSessionContext.Provider>
}

/** Reads the session state provided by {@link AuthProvider}. */
export function useAuthSession(): AuthSessionState {
  const context = useContext(AuthSessionContext)
  if (context === undefined) {
    throw new Error('useAuthSession must be used within an AuthProvider')
  }
  return context
}
