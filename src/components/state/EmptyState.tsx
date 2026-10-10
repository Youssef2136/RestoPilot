import { Icon } from '../ui'
import styles from './EmptyState.module.css'

/**
 * EmptyState (spec 037 FR-03/T001): the "nothing yet" state that names the
 * next action. Distinct from ErrorState by design: neutral/positive ink, an
 * informational icon, and a body that describes the reachable next step —
 * never an alarm color, never an error verb. Real text (a11y rule), never an
 * image of text.
 */

export type EmptyStateProps = {
  title: string
  /** Plain-language body: why it's empty and what to do next. */
  children?: React.ReactNode
  /** Stable hook for tests/data-state consumers (e.g. state matrix rows). */
  testId?: string
  /** The named next action (button/link) — EmptyState names it, the caller renders it. */
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ title, children, action, className, testId }: EmptyStateProps) {
  return (
    <div
      className={`${styles.empty} ${className ?? ''}`}
      role="status"
      data-state="empty"
      data-testid={testId}
    >
      <Icon name="info" size={28} className={styles.icon} />
      <p className={styles.title}>{title}</p>
      {children && <div className={styles.body}>{children}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
