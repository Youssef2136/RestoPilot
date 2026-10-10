import { Alert } from '../ui'
import styles from './RefusalAlert.module.css'

/**
 * RefusalAlert (spec 037 FR-05/T002): the inline mutation-refusal carrier.
 * Renders the server's VERBATIM message plus context at the action site —
 * never paraphrased, never toast-only (the clarified split: inline for
 * mutations, page-level ErrorState for reads). Single-alert semantics: keyed
 * on the message, so a re-render of the same refusal does not re-announce.
 * The caller's input survives by composition — the caller keeps the form
 * mounted and renders this beside it.
 *
 * VERBATIM DISCIPLINE (FA-7 / the presentation ledger): the ALERT region's
 * text is the verbatim message ALONE — the caller's context sentence is a
 * container description (`aria-describedby`), announced after/with the
 * message by AT but never inside `role=alert` text. Surfaces whose E2E
 * pins the alert text exactly (`toHaveText('This item is not available
 * here.')`) hold: the context composes without entering the region.
 */

export type RefusalAlertProps = {
  /** The verbatim server message (pinned presentation contract). */
  message: string
  /** Context around the verbatim message (what was being attempted). */
  context?: string
  className?: string
}

export function RefusalAlert({ message, context, className }: RefusalAlertProps) {
  const contextId =
    context === undefined ? undefined : `${context.replace(/\s+/g, '-').toLowerCase()}-context`
  return (
    <div
      className={`${styles.refusal} ${className ?? ''}`}
      data-refusal="inline"
      aria-describedby={contextId}
    >
      {context !== undefined && (
        <p id={contextId} className={styles.context}>
          {context}
        </p>
      )}
      <Alert severity="danger" key={message}>
        <p className={styles.message}>{message}</p>
      </Alert>
    </div>
  )
}
