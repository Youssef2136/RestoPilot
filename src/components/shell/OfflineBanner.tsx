import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Icon } from '../ui'
import { useRealtimeChannelHealth } from '../../features/realtime/realtimeStatus'
import styles from './OfflineBanner.module.css'

/**
 * OfflineBanner (spec 023 FR-07/T008; Clarification Q5): the global
 * offline/reconnect surface. Source = realtime channel health (any active
 * binding in CHANNEL_ERROR/TIMED_OUT) OR `!navigator.onLine`, whichever
 * reports first; recovery = SUBSCRIBED after an error, or the `online`
 * flip. "Retry now" refetches every active query — the manual arm of the
 * existing SUBSCRIBED auto-recovery (FA-2's posture, user-invoked).
 *
 * Announced politely (`role="status"`) — never assertive for passive news.
 * Renders nothing while healthy (no layout reservation: the shell must not
 * shift when the banner appears — UX rule — because it is fixed at the top
 * overlaying nothing; it pushes via a grid row that collapses).
 */

export type BannerState = 'healthy' | 'offline' | 'reconnecting' | 'recovered'

export function OfflineBanner() {
  const queryClient = useQueryClient()
  const channelHealth = useRealtimeChannelHealth()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [justRecovered, setJustRecovered] = useState(false)
  const [wasInterrupted, setWasInterrupted] = useState(false)

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

  const interrupted = !online || channelHealth === 'reconnecting'

  useEffect(() => {
    if (interrupted) {
      setWasInterrupted(true)
      setJustRecovered(false)
      return
    }
    // Recovery after a real interruption: show the recovered state briefly.
    if (wasInterrupted) {
      setJustRecovered(true)
      setWasInterrupted(false)
      const timer = setTimeout(() => setJustRecovered(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [interrupted, wasInterrupted])

  if (!interrupted && !justRecovered) return null

  const retry = () => {
    void queryClient.refetchQueries({ type: 'active' })
  }

  const state: BannerState = !online
    ? 'offline'
    : channelHealth === 'reconnecting'
      ? 'reconnecting'
      : 'recovered'

  return (
    <div className={`${styles.banner} ${styles[state]}`} role="status">
      <Icon
        name={state === 'recovered' ? 'check' : 'alert-triangle'}
        size={16}
        className={styles.icon}
      />
      <p className={styles.message}>
        {state === 'offline' && "You're offline — changes can't reach the server right now."}
        {state === 'reconnecting' && 'Reconnecting to live updates…'}
        {state === 'recovered' && 'Back online — live updates restored.'}
      </p>
      {state !== 'recovered' && (
        <button type="button" className={styles.retry} onClick={retry}>
          Retry now
        </button>
      )}
    </div>
  )
}
