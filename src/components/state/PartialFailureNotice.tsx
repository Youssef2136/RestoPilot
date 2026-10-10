import { Alert } from '../ui'
import styles from './PartialFailureNotice.module.css'

/**
 * PartialFailureNotice (spec 037 FR-09/T002): the multi-call-surface partial
 * state. A failed part is NAMED with its reason and carries a per-part retry
 * slot — it is never rendered as zero and never silently merged into the
 * successful parts. Warning severity (a part failed; the whole did not).
 */

export type PartialFailureNoticeProps = {
  /** The part that failed (e.g. a branch name) — the failure is attributed. */
  part: string
  /** Why it failed, in plain language (never raw provider internals). */
  reason?: string
  /** The per-part retry affordance (the caller wires it to that part's read). */
  retry?: React.ReactNode
  className?: string
}

export function PartialFailureNotice({
  part,
  reason,
  retry,
  className,
}: PartialFailureNoticeProps) {
  return (
    <div className={`${styles.partial} ${className ?? ''}`} data-partial={part}>
      <Alert severity="warning" title={`${part}: couldn't load this part`}>
        <p className={styles.body}>
          {reason ?? 'Its data could not be retrieved, so it is not included here.'} Other parts
          loaded normally.
        </p>
      </Alert>
      {retry && <div className={styles.retry}>{retry}</div>}
    </div>
  )
}
