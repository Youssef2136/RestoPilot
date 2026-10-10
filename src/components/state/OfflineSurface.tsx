import { Icon } from '../ui'
import { OfflineGateContext, useOfflineState, type OfflineGate } from './offlineGate'
import styles from './OfflineSurface.module.css'

/**
 * OfflineSurface (spec 037 FR-07/T002; clarified behavior): the operational
 * offline wrapper for cashier, kitchen, and session oversight. Contract:
 * the last-known data stays readable (children stay MOUNTED — never unmounted
 * by connectivity), staleness is obvious (text as well as color), and actions
 * disable with a reason (blocked, never hidden — no deferred-write queue
 * exists). Consumers read `useOfflineGate()` to disable their action layer;
 * reconnection reconciles through the standing realtime SUBSCRIBED recovery
 * — this component adds nothing to the data path.
 *
 * Two banner modes:
 * - `banner` (default): renders this surface's staleness banner ABOVE the
 *   children (never an overlay over primary actions — the Responsive rule).
 * - `banner={false}` (mark mode): for surfaces whose shells already carry the
 *   offline copy (StaffShell's OfflineBanner, the operational
 *   ReconnectingBanner) — rendering a second banner would double the
 *   announcements; the surface is marked with the outline + `data-offline`
 *   and the gate still disables the actions.
 */

export type OfflineSurfaceProps = {
  children: React.ReactNode
  /** What this surface's actions write (used in the disabled reason). */
  actionNoun?: string
  /** Render the staleness banner (mark mode = false). Default true. */
  banner?: boolean
  className?: string
}

export function OfflineSurface({
  children,
  actionNoun,
  banner = true,
  className,
}: OfflineSurfaceProps) {
  const { offline, reconnecting } = useOfflineState()
  const interrupted = offline || reconnecting
  const reason = offline ? "You're offline" : 'Live updates are reconnecting'
  const gate: OfflineGate = {
    offline: interrupted,
    reason: interrupted ? reason : null,
  }

  return (
    <OfflineGateContext.Provider value={gate}>
      <div
        className={`${styles.surface} ${interrupted ? styles.interrupted : ''} ${className ?? ''}`}
        data-offline={interrupted || undefined}
      >
        {interrupted && banner && (
          <div className={styles.banner} role="status">
            <Icon name="alert-triangle" size={16} className={styles.icon} />
            <p className={styles.message}>
              {reason} — showing the last known data
              {actionNoun ? `; ${actionNoun} actions are paused` : '; actions are paused'} until the
              connection returns.
            </p>
          </div>
        )}
        {children}
      </div>
    </OfflineGateContext.Provider>
  )
}
