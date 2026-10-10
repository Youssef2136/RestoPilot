import { createContext, useContext, useEffect, useState } from 'react'
import { useRealtimeChannelHealth } from '../../features/realtime/realtimeStatus'

/**
 * The offline gate (spec 037 FR-07/T002): what OfflineSurface hands its
 * children. Consumers disable their action layer with the reason — blocked,
 * never hidden (the clarified offline decision; no deferred-write queue
 * exists). Separate from the component file so the component file exports
 * only components (the react-refresh rule).
 */

export type OfflineGate = { offline: boolean; reason: string | null }

export const OfflineGateContext = createContext<OfflineGate>({
  offline: false,
  reason: null,
})

export function useOfflineGate(): OfflineGate {
  return useContext(OfflineGateContext)
}

/**
 * The connectivity state the offline gate reads: `!navigator.onLine` OR any
 * active realtime binding reconnecting (the shell OfflineBanner's sources —
 * one truth, two consumers). SSR/node-safe: optimistic online when there is
 * no window. Browser flips win from the first effect onward.
 */
export function useOfflineState(): { offline: boolean; reconnecting: boolean } {
  const channelHealth = useRealtimeChannelHealth()
  const [online, setOnline] = useState(() =>
    typeof window === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const goOffline = () => setOnline(false)
    const goOnline = () => setOnline(true)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  return { offline: !online, reconnecting: online && channelHealth === 'reconnecting' }
}
