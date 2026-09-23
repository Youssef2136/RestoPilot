/*
 * Phase 8 — the staff operations hooks (spec 009 T010; contracts/
 * staff-ops-client.md §2).
 *
 * Reads are branch-keyed queries (the branch scope IS the tenancy boundary
 * here; the server still re-checks the JWT against every row). Transition
 * and modification mutations invalidate ALL branch reads on success — the
 * next render refetches the truth (no optimistic writes, the 008 posture).
 *
 * The kitchen queue intentionally has no refetch-on-focus suppression:
 * staff dashboards want fresh truth on every window focus (FR-013's
 * refetch-recovery posture), which is react-query's default.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuthContext } from '../auth/useAuthContext'
import { getSupabaseClient } from '../../lib/supabase'
import {
  acceptRound,
  getBranchRounds,
  getKitchenQueue,
  getSessionBill,
  lockRound,
  markCompleted,
  markOutForDelivery,
  markRoundReady,
  modifyRoundLine,
  startPreparation,
  voidRound,
  type ModifyAction,
} from './staffOpsClient'

export function branchRoundsKey(branchId: string | null) {
  return ['staffOps', 'branchRounds', branchId]
}
export function kitchenQueueKey(branchId: string | null) {
  return ['staffOps', 'kitchenQueue', branchId]
}
export function sessionBillKey(sessionId: string | null) {
  return ['staffOps', 'sessionBill', sessionId]
}

export interface StaffBranchOption {
  id: string
  label: string
}

/**
 * The branches the signed-in staff identity may run staff ops on (the two
 * dashboards' selector). Branch-scoped roles list their own memberships;
 * restaurant-wide roles (owners) read the restaurant's every branch through
 * the table policies (FR-007) — the DashboardPage/ReportsPage read path —
 * so a UI-created owner (one restaurant-wide membership, no branch rows)
 * still reaches the branches they created through the UI.
 */
export function useStaffBranchOptions(
  /** Branch-scoped roles to include. The cashier rounds page excludes
   * kitchen (its gate refuses kitchen outright, 009 FR-005); the kitchen
   * dashboard includes every staff role. Owners are always included. */
  input: { roles?: readonly ('cashier' | 'branch_manager' | 'kitchen')[] } = {},
): {
  options: StaffBranchOption[]
  isPending: boolean
  isError: boolean
} {
  const { memberships, isPending: contextPending, isError: contextError } = useAuthContext()
  const roles = input.roles ?? (['cashier', 'branch_manager', 'kitchen'] as const)

  // Branch-scoped options resolve from the context payload synchronously.
  const membershipOptions = useMemo<StaffBranchOption[]>(() => {
    const seen = new Map<string, StaffBranchOption>()
    for (const membership of memberships) {
      if (
        membership.branch_id !== null &&
        (roles as readonly string[]).includes(membership.role) &&
        !seen.has(membership.branch_id)
      ) {
        seen.set(membership.branch_id, {
          id: membership.branch_id,
          label: `${membership.restaurant_name} — ${membership.branch_name ?? membership.branch_id}`,
        })
      }
    }
    return [...seen.values()]
  }, [memberships, roles])

  const ownerRestaurantIds = useMemo(
    () =>
      memberships
        .filter((m) => m.role === 'owner')
        .map((m) => ({ restaurantId: m.restaurant_id, restaurantName: m.restaurant_name })),
    [memberships],
  )

  // Owners read their restaurants' branches through the table policies.
  const branchesQuery = useQuery({
    queryKey: ['staffOps', 'ownerBranchOptions', ownerRestaurantIds.map((r) => r.restaurantId)],
    queryFn: async () => {
      const all: { restaurantId: string; restaurantName: string; id: string; name: string }[] = []
      for (const { restaurantId, restaurantName } of ownerRestaurantIds) {
        const { data, error } = await getSupabaseClient()
          .from('branches')
          .select('id, name')
          .eq('restaurant_id', restaurantId)
          .order('name')
        if (error) {
          throw error
        }
        for (const branch of data ?? []) {
          all.push({ restaurantId, restaurantName, id: branch.id, name: branch.name })
        }
      }
      return all
    },
    enabled: ownerRestaurantIds.length > 0,
  })

  const options = useMemo<StaffBranchOption[]>(() => {
    const seen = new Map<string, StaffBranchOption>(membershipOptions.map((o) => [o.id, o]))
    for (const branch of branchesQuery.data ?? []) {
      if (!seen.has(branch.id)) {
        seen.set(branch.id, {
          id: branch.id,
          label: `${branch.restaurantName} — ${branch.name}`,
        })
      }
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [membershipOptions, branchesQuery.data])

  return {
    options,
    isPending: contextPending || (ownerRestaurantIds.length > 0 && branchesQuery.isPending),
    isError: contextError || branchesQuery.isError,
  }
}

/** The branch's rounds (cashier dataset, newest-first from the server). */
export function useBranchRounds(branchId: string | null) {
  return useQuery({
    queryKey: branchRoundsKey(branchId),
    queryFn: () => getBranchRounds(branchId as string),
    enabled: branchId !== null,
  })
}

/** The branch's kitchen queue (money-free by contract). */
export function useKitchenQueue(branchId: string | null) {
  return useQuery({
    queryKey: kitchenQueueKey(branchId),
    queryFn: () => getKitchenQueue(branchId as string),
    enabled: branchId !== null,
  })
}

/** The selected session's bill (grand total over captured money). */
export function useSessionBill(sessionId: string | null) {
  return useQuery({
    queryKey: sessionBillKey(sessionId),
    queryFn: () => getSessionBill(sessionId as string),
    enabled: sessionId !== null,
  })
}

function useInvalidateBranchReads(branchId: string | null) {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: branchRoundsKey(branchId) })
    await queryClient.invalidateQueries({ queryKey: kitchenQueueKey(branchId) })
    await queryClient.invalidateQueries({ queryKey: ['staffOps', 'sessionBill'] })
  }
}

/** One mutation factory per transition — success invalidates the branch reads. */
export function useRoundTransition(
  branchId: string | null,
  action: 'accept' | 'start' | 'ready' | 'lock' | 'out_for_delivery' | 'completed',
) {
  const invalidate = useInvalidateBranchReads(branchId)
  return useMutation({
    mutationFn: async (roundId: string) => {
      const map = {
        accept: acceptRound,
        start: startPreparation,
        ready: markRoundReady,
        lock: lockRound,
        out_for_delivery: markOutForDelivery,
        completed: markCompleted,
      } as const
      return map[action](roundId)
    },
    onSuccess: invalidate,
  })
}

/** A line modification (remove / reduce) — success invalidates the branch reads. */
export function useModifyRoundLine(branchId: string | null) {
  const invalidate = useInvalidateBranchReads(branchId)
  return useMutation({
    mutationFn: async (input: {
      roundId: string
      itemId: string
      action: ModifyAction
      quantity?: number
    }) => modifyRoundLine(input.roundId, input.itemId, input.action, input.quantity),
    onSuccess: invalidate,
  })
}

/**
 * Void a round at its channel boundary (spec 011 FR-004) — success
 * invalidates ALL branch reads (the rounds list, the bill the void reduced,
 * and the kitchen queue whose ticket mirror went dark).
 */
export function useVoidRound(branchId: string | null) {
  const invalidate = useInvalidateBranchReads(branchId)
  return useMutation({
    mutationFn: async (input: { roundId: string; reason: string }) =>
      voidRound(input.roundId, input.reason),
    onSuccess: invalidate,
  })
}
