import styles from './ErrorState.module.css'

/**
 * ErrorState (spec 037 FR-04/T001): the page-level read-failure state.
 * Plain-language guidance typography — it reads as guidance, not alarm —
 * with a retry slot (`RetryButton`) where a retry can help. Retry never
 * re-issues a mutation (mutations refuse inline at the action site per the
 * clarified FR-05 split); this component is the READ path.
 */

export type ErrorStateProps = {
  title?: string
  /** Plain-language body: what happened and what the user can do. */
  children?: React.ReactNode
  /** The retry affordance (a RetryButton) — ErrorState offers it, the caller wires it. */
  retry?: React.ReactNode
  className?: string
}

export function ErrorState({
  title = "Couldn't load this",
  children,
  retry,
  className,
}: ErrorStateProps) {
  return (
    <div className={`${styles.error} ${className ?? ''}`} role="alert" data-state="error">
      <p className={styles.title}>{title}</p>
      {children && <div className={styles.body}>{children}</div>}
      {retry && <div className={styles.retry}>{retry}</div>}
    </div>
  )
}
