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
