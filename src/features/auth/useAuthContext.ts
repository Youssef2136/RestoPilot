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
  /**
   * Branch-menu visibility (spec 005 FR-014; contracts/menu-client.md §3): an
   * owner of the branch's restaurant, or ANY branch-scoped membership on that
   * branch. Presentation gate for the branch menu view — the projection's own
   * scope check is the boundary.
   */
  canViewBranchMenu: (branchId: string) => boolean
  /**
   * Branch availability control (spec 005 FR-003; contracts/menu-client.md §3):
   * an owner of the branch's restaurant, or that branch's `branch_manager`.
   */
  canManageBranchAvailability: (branchId: string) => boolean
  /**
   * Branch tax view (spec 006 FR-020; contracts/tax-client.md §2): an owner of
   * the branch's restaurant, or ANY branch-scoped membership on that branch —
   * the same read arm as `canViewBranchMenu` (the configuration RPC's own
   * scope check is the boundary).
   */
  canViewBranchTax: (branchId: string) => boolean
  /**
   * Branch tax control (spec 006 FR-003, clarification 2; contracts/tax-client.md
   * §2): an owner of the branch's restaurant, or that branch's `branch_manager`.
   */
  canManageBranchTax: (branchId: string) => boolean
  /**
   * Session oversight visibility (spec 007 FR-017/FR-019): an owner of the
   * branch's restaurant, or a branch-scoped `branch_manager`/`cashier`
   * membership on that branch — the same matrix `get_branch_open_sessions`
   * enforces. Kitchen and everyone else false. Presentation only — the RPC's
   * scope check is the boundary (Constitution IV).
   */
  canViewSessions: (branchId: string) => boolean
  /**
   * Session close control (spec 007 FR-009): the identical matrix —
   * `close_session` authorizes exactly the roles that may view.
   */
  canCloseSession: (branchId: string) => boolean
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

  // Branch predicates. Ownership is restaurant-wide, so a bare branch id
  // cannot resolve it: any owner passes these presentation gates and the
  // server decides (the projection's scope check and the availability RPC are
  // the boundary — Constitution IV). Branch-scoped members are resolved
  // exactly, from their own membership rows.
  const canViewBranchMenu = useCallback(
    (branchId: string) =>
      memberships.some((m) => m.role === 'owner') ||
      memberships.some((m) => m.branch_id === branchId),
    [memberships],
  )

  const canManageBranchAvailability = useCallback(
    (branchId: string) =>
      memberships.some((m) => m.role === 'owner') ||
      memberships.some((m) => m.branch_id === branchId && m.role === 'branch_manager'),
    [memberships],
  )

  const canViewBranchTax = useCallback(
    (branchId: string) =>
      memberships.some((m) => m.role === 'owner') ||
      memberships.some((m) => m.branch_id === branchId),
    [memberships],
  )

  const canManageBranchTax = useCallback(
    (branchId: string) =>
      memberships.some((m) => m.role === 'owner') ||
      memberships.some((m) => m.branch_id === branchId && m.role === 'branch_manager'),
    [memberships],
  )

  // Session predicates (spec 007 US2/US4): ownership is restaurant-wide and a
  // bare branch id cannot resolve it, so any owner passes the coarse gate and
  // the session RPC's own scope check decides server-side. Branch-scoped
  // members resolve exactly: manager or cashier on THAT branch; kitchen never.
  const canViewSessions = useCallback(
    (branchId: string) =>
      memberships.some((m) => m.role === 'owner') ||
      memberships.some(
        (m) => m.branch_id === branchId && (m.role === 'branch_manager' || m.role === 'cashier'),
      ),
    [memberships],
  )
  // close_session authorizes exactly the roles that may view (FR-009/FR-019).
  const canCloseSession = canViewSessions

  return {
    ...query,
    profile,
    memberships,
    isStaff,
    isSuperAdmin,
    canReadStaffList,
    canManageRestaurant,
    canViewBranchMenu,
    canManageBranchAvailability,
    canViewBranchTax,
    canManageBranchTax,
    canViewSessions,
    canCloseSession,
  }
}
