import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useCallback, useMemo } from 'react'
import { getSupabaseClient } from '../../lib/supabase'
import type { Database, Json } from '../../types/database.types'
import { useAuthSession } from './AuthProvider'

/**
 * Effective authorization context hook (contracts/auth-client.md) — the
 * single resolution path every guard and staff-area view consumes
 * (FR-010): a react-query cache over the `current_auth_context` RPC.
 *
 * The hook CACHES; it never decides — every predicate below is advisory for
 * presentation, and the RPC reads only what the caller's own RLS policies
 * allow (security invoker — Constitution IV/V; FR-009: nothing
 * credential-carried participates).
 */

export type StaffRole = Database['public']['Enums']['staff_role']

/** The RPC-shaped context (contracts/database-functions.md). */
export interface AuthContextProfile {
  id: string
  display_name: string
  is_super_admin: boolean
}

export interface AuthContextMembership {
  restaurant_id: string
  restaurant_slug: string
  restaurant_name: string
  role: StaffRole
  /** null for owners (restaurant-wide). */
  branch_id: string | null
  branch_name: string | null
}

export interface AuthContext {
  /** null when the identity has no linked profile. */
  profile: AuthContextProfile | null
  memberships: AuthContextMembership[]
}

export const AUTH_CONTEXT_QUERY_KEY = ['auth', 'context'] as const

async function fetchAuthContext(): Promise<AuthContext> {
  const { data, error } = await getSupabaseClient().rpc('current_auth_context')
  if (error) {
    throw error
  }
  const raw: Json = typeof data === 'string' ? (JSON.parse(data) as Json) : data
  const parsed = raw as unknown as AuthContext
  return {
    profile: parsed.profile ?? null,
    memberships: parsed.memberships ?? [],
  }
}

export type UseAuthContextResult = UseQueryResult<AuthContext, Error> & {
  profile: AuthContextProfile | null
  memberships: AuthContextMembership[]
  /** Staff-area entry: linked profile ∧ at least one membership. */
  isStaff: boolean
  /** Platform admin area (advisory — grants no data access, FR-012). */
  isSuperAdmin: boolean
  /** Staff-list visibility (FR-007): owner or branch_manager for the restaurant. */
  canReadStaffList: (restaurantId: string) => boolean
  /**
   * Management-surface visibility (spec 004 FR-017; contracts/management-client.md
   * §3): an `owner` membership of that restaurant. Presentation gate for the
   * management controls and pages — it grants nothing (Constitution IV).
   */
  canManageRestaurant: (restaurantId: string) => boolean
}

export function useAuthContext(): UseAuthContextResult {
  const { session, status } = useAuthSession()
  const queryClient = useQueryClient()
  const userId = session?.user.id ?? null

  // Invalidated on auth events: the query key carries the acting identity
  // (a sign-in as a different identity is a fresh fetch by construction),
  // and sign-out drops every cached variant so the next sign-in always
  // resolves live context.
  useEffect(() => {
    if (status === 'signed-out') {
      void queryClient.removeQueries({ queryKey: AUTH_CONTEXT_QUERY_KEY })
    }
  }, [status, queryClient])

  const query = useQuery({
    queryKey: [...AUTH_CONTEXT_QUERY_KEY, userId],
    queryFn: fetchAuthContext,
    // Only resolve context for an authenticated session.
    enabled: status === 'signed-in',
  })

  const profile = query.data?.profile ?? null
  const memberships = useMemo(() => query.data?.memberships ?? [], [query.data?.memberships])

  const isStaff = profile !== null && memberships.length > 0
  const isSuperAdmin = profile?.is_super_admin === true

  const canReadStaffList = useCallback(
    (restaurantId: string) =>
      memberships.some(
        (m) =>
          m.restaurant_id === restaurantId && (m.role === 'owner' || m.role === 'branch_manager'),
      ),
    [memberships],
  )

  const canManageRestaurant = useCallback(
    (restaurantId: string) =>
      memberships.some((m) => m.restaurant_id === restaurantId && m.role === 'owner'),
    [memberships],
  )

  return {
    ...query,
    profile,
    memberships,
    isStaff,
    isSuperAdmin,
    canReadStaffList,
    canManageRestaurant,
  }
}
