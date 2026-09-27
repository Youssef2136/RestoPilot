import { Icon } from './Icon'
import styles from './Feedback.module.css'

/**
 * Feedback primitives (spec 022 FR-04/T009; first consumers: Phase 03+).
 *
 * StatusPill — the status vocabulary rendered once (StateChip wraps it for
 * domain states; this is the palette-side primitive).
 * Spinner — aria-busy + role="status" with an accessible loading label.
 * Skeleton — aria-hidden shimmer placeholder (the loading container carries
 * the announcement, not every bone).
 * EmptyState — teaches the interface (icon + title + guidance + optional
 * action); never bare "Nothing here".
 * ErrorState — the recoverable block: title, verbatim message (FA-7), retry.
 * ProgressBar — determinate progress with an accessible name.
 */

export type StatusTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info' | 'brand'

export function StatusPill({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return <span className={`${styles.pill} ${styles[tone]}`}>{children}</span>
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className={styles.spinnerWrap}>
      <span className={styles.spinner} aria-hidden="true" />
      <span role="status" className={styles.visuallyHidden}>
        {label}
      </span>
    </span>
  )
}

export function Skeleton({ height = '1rem', width }: { height?: string; width?: string }) {
  return <span className={styles.skeleton} style={{ height, width }} aria-hidden="true" />
}

export function EmptyState({
  icon = 'info',
  title,
  children,
  action,
}: {
  icon?: Parameters<typeof Icon>[0]['name']
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className={styles.stateBlock}>
      <span className={styles.stateIcon} aria-hidden="true">
        <Icon name={icon} size={28} />
      </span>
      <p className={styles.stateTitle}>{title}</p>
      {children && <div className={styles.stateBody}>{children}</div>}
      {action && <div className={styles.stateAction}>{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}: {
  title?: string
  /** The verbatim message (server text where one exists — FA-7). */
  message: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className={styles.stateBlock} role="alert">
      <span className={`${styles.stateIcon} ${styles.stateIconDanger}`} aria-hidden="true">
        <Icon name="alert-triangle" size={28} />
      </span>
      <p className={styles.stateTitle}>{title}</p>
      {message && <div className={styles.stateBody}>{message}</div>}
      {onRetry && (
        <div className={styles.stateAction}>
          <button type="button" className={styles.retry} onClick={onRetry}>
            {retryLabel}
          </button>
        </div>
      )}
    </div>
  )
}

export function ProgressBar({
  value,
  max = 100,
  label,
}: {
  value: number
  max?: number
  label: string
}) {
  const clamped = Math.max(0, Math.min(value, max))
  const fraction = max > 0 ? clamped / max : 0
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className={styles.progressFill} style={{ transform: `scaleX(${fraction})` }} />
    </div>
  )
}
