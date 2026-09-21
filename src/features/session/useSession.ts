import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clearSessionToken,
  closeSession,
  enterSession,
  getBranchOpenSessions,
  getPublicRestaurant,
  getSessionContext,
  getSessionMenu,
  openChannelSession,
  readSessionToken,
} from './sessionClient'

/**
 * Session reads and their invalidation rules (contracts/session-client.md §1).
 *
 * Query keys carry the token scope: the customer's context and menu are keyed
 * under the stored token, so a close (which clears the token through the
 * refused recovery) drops those cache entries naturally and the customer
 * surfaces re-render into the entry state. The staff list is keyed per
 * branch and invalidated by the close mutation.
 *
 * No optimistic writes anywhere — the server's outcome is the state.
 */

/** The customer reads' token scope; null when no token is stored. */
export function sessionTokenScope() {
  return readSessionToken()
}

export function publicRestaurantKey(slug: string | null) {
  return ['session', 'public-restaurant', slug] as const
}

export function sessionContextKey(token: string | null) {
  return ['session', 'context', token] as const
}

export function sessionMenuKey(token: string | null) {
  return ['session', 'menu', token] as const
}

export function branchSessionsKey(branchId: string | null) {
  return ['session', 'branch-sessions', branchId] as const
}

export function usePublicRestaurant(slug: string | null) {
  return useQuery({
    queryKey: publicRestaurantKey(slug),
    queryFn: async () => {
      if (slug === null) {
        throw new Error('No slug')
      }
      const result = await getPublicRestaurant(slug)
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    enabled: slug !== null,
    retry: false,
    staleTime: 60_000,
  })
}

/** The entry mutation: success stores the token through the client (§2). */
export function useEnterSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      restaurantId: string
      branchId: string
      tableId: string
      displayName: string
      phone: string
    }) => {
      const result = await enterSession(input)
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    onSuccess: () => {
      // The token changed — drop every token-scoped customer cache entry.
      void queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })
}

/**
 * The channel entry mutation (spec 010 FR-002): delivery/takeaway entry
 * through `open_session_channel`. Same token discipline as dine-in — the
 * payload's token is stored through the client, and every token-scoped
 * customer cache entry drops on success.
 */
export function useEnterChannelSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      restaurantId: string
      branchId: string
      channel: 'delivery' | 'takeaway'
      displayName: string
      phone: string
      address?: string
    }) => {
      const result = await openChannelSession({
        restaurantId: input.restaurantId,
        branchId: input.branchId,
        channel: input.channel,
        name: input.displayName,
        phone: input.phone,
        address: input.address,
      })
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })
}

export function useSessionContext() {
  const token = sessionTokenScope()
  return useQuery({
    queryKey: sessionContextKey(token),
    queryFn: async () => {
      const result = await getSessionContext()
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    enabled: token !== null,
    retry: false,
  })
}

export function useSessionMenu() {
  const token = sessionTokenScope()
  return useQuery({
    queryKey: sessionMenuKey(token),
    queryFn: async () => {
      const result = await getSessionMenu()
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    enabled: token !== null,
    retry: false,
  })
}

export function useBranchOpenSessions(branchId: string | null) {
  return useQuery({
    queryKey: branchSessionsKey(branchId),
    queryFn: async () => {
      if (branchId === null) {
        throw new Error('No branch')
      }
      const result = await getBranchOpenSessions(branchId)
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    enabled: branchId !== null,
  })
}

/**
 * The staff close mutation: invalidates the branch list and the token-scoped
 * customer reads on success — the closed session's customers discover the
 * close through their own refused recovery (FR-014); dropping the cached
 * entries here keeps any in-session customer surface in this browser honest.
 */
export function useCloseSession(branchId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const result = await closeSession(sessionId)
      if (!result.ok) {
        throw new Error(result.message)
      }
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: branchSessionsKey(branchId) })
      void queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })
}

/**
 * Drop the stored token and the token-scoped cache (the shared clear used by
 * the recovery-refusal redirect and any explicit leave action).
 */
export function forgetSession(queryClient: ReturnType<typeof useQueryClient>) {
  clearSessionToken()
  void queryClient.invalidateQueries({ queryKey: ['session'] })
}
