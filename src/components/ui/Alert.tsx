import styles from './Alert.module.css'

/**
 * Alert (spec 022 FR-04/T009): the inline feedback block. Severity roles =
 * the status vocabulary (info/success/warning/danger). Announced via
 * role="alert" for danger/warning (assertive relevance); info/success stay
 * polite live regions (role="status") — async outcomes are announced,
 * decoration is not (UX requirement).
 *
 * Dismissibility and an optional action slot are built in; the caller owns
 * dismissal state (a component library that owns it silently swallows
 * caller intent).
 */

export type AlertSeverity = 'info' | 'success' | 'warning' | 'danger'

export type AlertProps = {
  severity: AlertSeverity
  /** Bold first line (the problem/success name). */
  title?: string
  /** Body: the verbatim message or guidance around it (FA-7). */
  children?: React.ReactNode
  /** Renders a dismiss button (the caller holds the state). */
  onDismiss?: () => void
  /** Labels the dismiss button for AT (required with onDismiss). */
  dismissLabel?: string
  /** Optional action area (button/link) beside the message. */
  action?: React.ReactNode
}

export function Alert({
  severity,
  title,
  children,
  onDismiss,
  dismissLabel = 'Dismiss',
  action,
}: AlertProps) {
  const role = severity === 'danger' || severity === 'warning' ? 'alert' : 'status'
  return (
    <div className={`${styles.alert} ${styles[severity]}`} role={role}>
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.content}>{children}</div>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
      {onDismiss && (
        <button
          type="button"
          className={styles.dismiss}
          onClick={onDismiss}
          aria-label={dismissLabel}
        >
          ×
        </button>
      )}
    </div>
  )
}
