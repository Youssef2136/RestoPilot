/*
 * Phase 11 — the realtime invalidation hook (spec 012 T005; contracts/
 * realtime-client.md §1; plan.md D3).
 *
 * Design: realtime drives INVALIDATION of the already-existing react-query
 * keys; the next render refetches through the unchanged authorized RPC
 * reads. The event payload is NEVER rendered — it only names what changed
 * (a table); the reads stay the only render path (Constitution I; FR-010:
 * realtime changes WHEN data arrives, never WHAT may be read).
 *
 * The channel registry reuses one Supabase channel per (table, scope) —
 * two surfaces scoped identically share one subscription. SUBSCRIBED
 * triggers one immediate refetch — the reconnect/recovery posture
 * (principle 3, FR-004): a missed event is healed by refetching
 * authoritative state, not by replaying events.
 *
 * The wiring lives in `bindRealtimeInvalidation` — a plain factory the
 * effect calls — so the subscription contract is unit-testable without a
 * DOM or an effect runner (the house node-environment method).
 */

import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabase'

export type RealtimeTable =
  'rounds' | 'kitchen_tickets' | 'sessions' | 'branch_unavailable_items' | 'dining_tables'

export interface RealtimeInvalidationInput {
  /** The scope value (usually a branch id); null disables the subscription. */
  scopeValue: string | null
  table: RealtimeTable
  /** The column the server-side row filter applies to (default `branch_id`). */
  filterColumn?: string
  /** The invalidators to run (coalesced) when an event arrives. */
  invalidate: (queryClient: QueryClient) => Promise<unknown>
  /** One immediate invalidate when the channel (re)subscribes. Default true. */
  refetchOnSubscribe?: boolean
}

/** The coalescing window: events inside 200ms trigger ONE invalidate. */
export const COALESCE_MS = 200

/**
 * The channel name for a (table, scope) subscription — shared by the hook
 * and the cue so identical scopes could dedupe on the client's registry.
 * The cue passes a synthetic table tag ('cue:rounds') to namespace its
 * dedicated INSERT/UPDATE channel.
 */
export function realtimeChannelName(table: string, scopeValue: string): string {
  return `realtime:${table}:${scopeValue}`
}

/**
 * Wire one subscription: build the channel, register the event handler
 * (coalesced invalidate) and the status handler (SUBSCRIBED → recovery
 * refetch), subscribe, and return the unmount cleanup.
 */
export function bindRealtimeInvalidation(
  client: ReturnType<typeof getSupabaseClient>,
  input: {
    scopeValue: string
    table: RealtimeTable
    filterColumn?: string
    invalidate: () => Promise<unknown>
    refetchOnSubscribe?: boolean
  },
): { channelName: string; unmount: () => void } {
  const {
    scopeValue,
    table,
    filterColumn = 'branch_id',
    invalidate,
    refetchOnSubscribe = true,
  } = input
  const channelName = realtimeChannelName(table, scopeValue)
  const channel = client.channel(channelName)

  let timer: ReturnType<typeof setTimeout> | null = null
  const coalescedInvalidate = () => {
    if (timer !== null) {
      return // an invalidate is already scheduled inside the window
    }
    timer = setTimeout(() => {
      timer = null
      void invalidate()
    }, COALESCE_MS)
  }

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table,
      filter: `${filterColumn}=eq.${scopeValue}`,
    },
    // The payload is deliberately unused — only its ARRIVAL matters (D3).
    () => coalescedInvalidate(),
  )

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED' && refetchOnSubscribe) {
      // The recovery refetch: on first subscribe AND every reconnect, one
      // authoritative read reconciles anything missed while offline.
      void invalidate()
    }
    // CHANNEL_ERROR / TIMED_OUT render nothing; the SUBSCRIBED that follows
    // the client's auto-reconnect performs the recovery refetch.
  })

  channel.subscribe()

  return {
    channelName,
    unmount: () => {
      if (timer !== null) {
        clearTimeout(timer)
      }
      void client.removeChannel(channel)
    },
  }
}

export function useRealtimeInvalidation(input: RealtimeInvalidationInput): void {
  const queryClient = useQueryClient()
  const invalidateRef = useRef(input.invalidate)
  invalidateRef.current = input.invalidate

  const { scopeValue, table, filterColumn = 'branch_id', refetchOnSubscribe = true } = input

  useEffect(() => {
    if (scopeValue === null) {
      return
    }
    const binding = bindRealtimeInvalidation(getSupabaseClient(), {
      scopeValue,
      table,
      filterColumn,
      refetchOnSubscribe,
      invalidate: () => invalidateRef.current(queryClient),
    })
    return binding.unmount
  }, [queryClient, scopeValue, table, filterColumn, refetchOnSubscribe])
}
