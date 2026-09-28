import { useSyncExternalStore } from 'react'

/**
 * Realtime channel status registry (spec 023 FR-07/T002; research R3).
 *
 * A module-level store that active realtime bindings report into via the
 * binding's optional `onStatus` consumer. The shell's OfflineBanner reads
 * the aggregate through `useRealtimeStatus()`. FA-2 semantics untouched:
 * events still never render; SUBSCRIBED still refetches; the default
 * (no consumer) behaves exactly as before — render nothing on errors.
 *
 * Aggregate states: 'online' (no error reported), 'reconnecting' (any
 * active binding errored/timed out), 'offline' (navigator.onLine false
 * wins, merged at the hook level).
 */

export type ChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'

type Registry = {
  /** One entry per active binding (keyed by its channel name). */
  statuses: Map<string, ChannelStatus>
  listeners: Set<() => void>
}

const registry: Registry = { statuses: new Map(), listeners: new Set() }

function emit() {
  for (const listener of registry.listeners) listener()
}

/** Report a binding's status (called from the binding's subscribe callback). */
export function reportChannelStatus(channelName: string, status: ChannelStatus): void {
  const previous = registry.statuses.get(channelName)
  registry.statuses.set(channelName, status)
  if (previous !== status) emit()
}

/** Clear a binding's entry on unmount. */
export function clearChannelStatus(channelName: string): void {
  if (registry.statuses.delete(channelName)) emit()
}

function subscribe(listener: () => void): () => void {
  registry.listeners.add(listener)
  return () => registry.listeners.delete(listener)
}

function getSnapshot(): 'online' | 'reconnecting' {
  for (const status of registry.statuses.values()) {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') return 'reconnecting'
  }
  return 'online'
}

function getServerSnapshot(): 'online' | 'reconnecting' {
  return 'online' // SSR/first render: optimistic online (no bindings yet)
}

/** The shell-level aggregate over every active realtime binding. */
export function useRealtimeChannelHealth(): 'online' | 'reconnecting' {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
