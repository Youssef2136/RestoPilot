import { useEffect, useState } from 'react'
import styles from '../staffOps.surfaces.module.css'

/**
 * The freshness affordance (specs/029 FR-07, D2): 'Updated Xs ago' ticks
 * each second from the reads' `dataUpdatedAt`; the dot pulses while a
 * refetch is in flight (stale-while-refetching made visible). The tick is
 * display-only — the announcement of refreshes lives on the page's ONE
 * polite live region, not here.
 */
export function LiveBadge({ updatedAt, fetching }: { updatedAt: number; fetching: boolean }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000))
  const label =
    updatedAt === 0
      ? 'Not loaded yet'
      : seconds < 5
        ? 'Updated just now'
        : `Updated ${seconds}s ago`

  return (
    <span className={styles.freshness} data-testid="queue-updated">
      <span
        aria-hidden="true"
        className={[
          styles.freshnessDot,
          fetching ? styles.freshnessDotFetching : '',
          fetching ? styles.pulse : '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
      {label}
    </span>
  )
}
