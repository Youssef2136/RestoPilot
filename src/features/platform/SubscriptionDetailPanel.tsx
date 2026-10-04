import { useState } from 'react'
import type { SubscriptionState } from './platformClient'
import { platformDisabledCopy, subscriptionCopy } from './subscriptionCopy'
import styles from './SubscriptionDetailPanel.module.css'

/**
 * The owner-facing subscription detail (specs/032 FR-05, T003; D5): a
 * disclosure under the banner — no route, never covering primary actions
 * (in-flow, scrolls with the page). The state vocabulary, the dates, and
 * the two honest truths (expiry does not stop ordering; the PLATFORM owner
 * is the actor) come from the copy map — nothing here derives state.
 *
 * Rendered only for the non-silent states (the banner decides); keyboard
 * dismissible by construction (a real button toggling aria-expanded); no
 * auto-focus, no motion.
 */
export function SubscriptionDetailPanel({
  state,
  endDate,
  platformDisabledReason,
}: {
  /** 'platform_disabled' is the manual kill-switch — not a lifecycle state. */
  state: SubscriptionState | 'platform_disabled'
  endDate: string | null
  platformDisabledReason: string | null
}) {
  const [open, setOpen] = useState(false)
  const disabled = state === 'platform_disabled'
  const copy = disabled ? platformDisabledCopy(platformDisabledReason) : subscriptionCopy(state)

  return (
    <section className={styles.panel} data-testid="subscription-detail">
      <button
        type="button"
        className={styles.disclosure}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        What does this mean?
      </button>
      {open && (
        <div className={styles.body}>
          <p className={styles.stateLine}>
            <strong>{copy.label}</strong>
            {!disabled && endDate !== null ? ` — through ${endDate}` : ''}
            {state === 'expired' && endDate !== null ? ' (ended)' : ''}
          </p>
          <p>{copy.detail}</p>
        </div>
      )}
    </section>
  )
}
