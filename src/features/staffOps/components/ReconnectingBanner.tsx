import { Button } from '../../../components/ui'
import {
  BOARD_RECONNECTING_COPY,
  RETRY_NOW_COPY,
  STALE_RETRY_COPY,
} from '../../realtime/announcementPolicy'
import styles from '../staffOps.surfaces.module.css'

/**
 * The connection banner (specs/029 FR-07, D2): the realtime binding's
 * status callback reports the transport — CHANNEL_ERROR/TIMED_OUT/CLOSED
 * land here as 'reconnecting' until the SUBSCRIBED that follows the
 * client's auto-reconnect (whose recovery refetch reconciles anything
 * missed). A fetch failure WITH data lands as the stale-data retry posture:
 * the last-known board stays readable (never a blank on a transient error).
 *
 * The banner is a polite live region, deliberately NOT role="status" —
 * /dashboard/sessions pins a strict single role=status lookup (the closure
 * notice), and banners never render there. This component appears on the
 * rounds page only.
 */
export function ReconnectingBanner({
  reconnecting,
  staleError,
  onRetry,
}: {
  reconnecting: boolean
  staleError: boolean
  onRetry: () => void
}) {
  if (!reconnecting && !staleError) {
    return null
  }
  const message = reconnecting ? BOARD_RECONNECTING_COPY : STALE_RETRY_COPY
  return (
    <p className={styles.banner} aria-live="polite" data-testid="reconnecting-banner">
      <span>{message}</span>
      <Button size="sm" onClick={onRetry}>
        {RETRY_NOW_COPY}
      </Button>
    </p>
  )
}
