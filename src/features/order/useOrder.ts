/*
 * Phase 7 — the order hooks (spec 008 T015; contracts/order-client.md §3).
 *
 * `useCart` renders from the cartState subscription (the cart is client
 * state, not a react-query cache). `useSubmitRound` wraps the RPC in a
 * mutation: success clears the cart and invalidates the history read (the
 * server's row is the state; no optimistic writes); a refusal touches
 * nothing. `useSessionRounds` recovers the history from the server on mount.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addToCart, clearCart, loadCart, saveCart, subscribeToCart } from './cartState'
import { getSessionRounds, submitRound, type CartLine, type RoundsPayload } from './orderClient'
import { readSessionToken } from '../session/sessionClient'
import { sessionTokenScope } from '../session/useSession'

/** The history read's query key (contract §3). */
export function sessionRoundsKey(token: string | null) {
  return ['order', 'rounds', token]
}

/**
 * The advisory cart, scoped to the device's session token. Renders from the
 * module subscription so every surface stays in sync after add/adjust/remove.
 */
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>(() => loadCart(readSessionToken))

  useEffect(() => {
    // Re-read on (re)mount and on any cart mutation; the module's token
    // scoping means a new session on this device swaps the rendered cart.
    setLines(loadCart(readSessionToken))
    return subscribeToCart(() => {
      setLines(loadCart(readSessionToken))
    })
  }, [])

  const update = useCallback((next: CartLine[]) => {
    saveCart(readSessionToken, next)
  }, [])

  const addLine = useCallback((item_id: string, extra_ids: string[], quantity: number) => {
    addToCart(readSessionToken, item_id, extra_ids, quantity)
  }, [])

  const clear = useCallback(() => {
    clearCart()
  }, [])

  return useMemo(() => ({ lines, update, addLine, clear }), [lines, update, addLine, clear])
}

/** Submits the given lines as one atomic round (contract §1). */
export function useSubmitRound() {
  const token = sessionTokenScope()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (lines: CartLine[]) => {
      const result = await submitRound(lines)
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    onSuccess: () => {
      // The cart clears only on success (FR-010's other side); the server's
      // row is the history state — invalidate, never optimistically write.
      clearCart()
      void queryClient.invalidateQueries({ queryKey: sessionRoundsKey(token) })
    },
  })
}

/** The session's rounds history — recovered from the server on mount. */
export function useSessionRounds() {
  const token = sessionTokenScope()
  return useQuery({
    queryKey: sessionRoundsKey(token),
    queryFn: async (): Promise<RoundsPayload> => {
      const result = await getSessionRounds()
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    enabled: token !== null,
    retry: false,
  })
}
