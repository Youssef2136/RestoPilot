import styles from './management.module.css'

/**
 * StatusPill (spec 026 T001): the Active/Inactive management state chip.
 * Text-bearing (never color-only); the 022 token vocabulary; the same visual
 * family as the customer phase-05 state chip, at management density.
 */
export function StatusPill({ state }: { state: 'Active' | 'Inactive' }) {
  return (
    <span className={state === 'Active' ? styles.pillActive : styles.pillInactive}>{state}</span>
  )
}
