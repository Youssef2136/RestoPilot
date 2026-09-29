import styles from './management.module.css'

/**
 * ScopeBadge (spec 026 T001; Q4): the explicit scope treatment. 'owner'
 * marks an owner-controls section; 'read-only' tells a scoped member WHY the
 * controls are absent — positive clarity instead of mysterious negative
 * space. Text-bearing (never color-only).
 */
export function ScopeBadge({ scope }: { scope: 'owner' | 'read-only' }) {
  return (
    <span className={scope === 'owner' ? styles.badgeOwner : styles.badgeReadOnly}>
      {scope === 'owner' ? 'Owner controls' : 'Read-only'}
    </span>
  )
}
