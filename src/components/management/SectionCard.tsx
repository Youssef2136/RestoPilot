import { ScopeBadge } from './ScopeBadge'
import styles from './management.module.css'

/**
 * SectionCard (spec 026 T001): one management section — an optional h2 (when
 * omitted, the children own the heading — e.g. the QR panel's pinned
 * 'Customer entry QR'), an optional scope badge (the owner/read-only clarity
 * of Q4), a toolbar slot, and the section body. The id IS the section-nav
 * anchor (Q1 fragments).
 */
export function SectionCard({
  id,
  title,
  scope,
  toolbar,
  children,
}: {
  id: string
  title?: string
  scope?: 'owner' | 'read-only'
  toolbar?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className={styles.sectionCard}
      aria-labelledby={title !== undefined ? `${id}-heading` : undefined}
    >
      {(title !== undefined || scope !== undefined || toolbar !== undefined) && (
        <div className={styles.sectionHeader}>
          {title !== undefined && <h2 id={`${id}-heading`}>{title}</h2>}
          {scope !== undefined && <ScopeBadge scope={scope} />}
          {toolbar !== undefined && <div className={styles.sectionToolbar}>{toolbar}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
