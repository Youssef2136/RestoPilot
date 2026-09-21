/*
 * The new-round cue (spec 012 T009; contracts/realtime-client.md §2; US4):
 * an in-app, event-derived cue for the cashier's branch scope.
 *
 * No persistence, no outbound notification: the cue is react state set by
 * a `rounds` INSERT event and cleared by the round's first UPDATE (its
 * state advanced — the refetched list is the truth either way). The
 * rendered text is derived ("A new order arrived."); no payload data is
 * displayed beyond what the refetched list already shows (FR-008).
 *
 * The wiring lives in `bindNewRoundCue` — a plain factory the effect
 * calls — so the subscription contract is unit-testable without a DOM
 * (the house node-environment method).
 */

import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabase'
import { realtimeChannelName } from './useRealtimeInvalidation'

export interface NewRoundCue {
  roundId: string
}

/**
 * Wire the cue subscription: INSERT sets the cue, the round's own UPDATE
 * clears it. Returns the unmount cleanup.
 */
export function bindNewRoundCue(
  client: ReturnType<typeof getSupabaseClient>,
  input: {
    branchId: string
    onInsert: (roundId: string) => void
    onUpdateCleared: (roundId: string) => void
  },
): { channelName: string; unmount: () => void } {
  const { branchId, onInsert, onUpdateCleared } = input
  const channelName = realtimeChannelName('cue:rounds', branchId)
  const channel = client.channel(channelName)

  let currentRoundId: string | null = null

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'rounds',
        filter: `branch_id=eq.${branchId}`,
      },
      (payload: { new?: { id?: string } | null }) => {
        const id = payload.new?.id
        if (id) {
          currentRoundId = id
          onInsert(id)
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rounds',
        filter: `branch_id=eq.${branchId}`,
      },
      (payload: { new?: { id?: string } | null }) => {
        const id = payload.new?.id
        if (id && id === currentRoundId) {
          // The round left `new` (any state write is a staff action on a
          // new round) — the cue's job is done.
          currentRoundId = null
          onUpdateCleared(id)
        }
      },
    )
    .subscribe()

  return {
    channelName,
    unmount: () => {
      void client.removeChannel(channel)
    },
  }
}

export function useNewRoundCue(branchId: string | null): {
  cue: NewRoundCue | null
  clearCue: () => void
} {
  const [cue, setCue] = useState<NewRoundCue | null>(null)
  const roundIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (branchId === null) {
      return
    }
    const binding = bindNewRoundCue(getSupabaseClient(), {
      branchId,
      onInsert: (roundId) => {
        roundIdRef.current = roundId
        setCue({ roundId })
      },
      onUpdateCleared: () => {
        roundIdRef.current = null
        setCue(null)
      },
    })
    return binding.unmount
  }, [branchId])

  return { cue, clearCue: () => setCue(null) }
}
