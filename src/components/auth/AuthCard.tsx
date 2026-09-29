import type { ReactNode } from 'react'
import styles from './AuthCard.module.css'

/**
 * AuthCard (spec 024 T002): the credential surfaces' wrapper — a centered,
 * max-measure column with the surface's h1 and the form beneath. Visual
 * contract: trust-forward and restrained (Operate mode) — neutral surface,
 * one accent on the primary action, generous spacing, no decoration. All
 * values are Phase-02 tokens (spec 022 FR-07).
 */
export function AuthCard({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className={styles.card} aria-labelledby="auth-card-heading">
      <h1 id="auth-card-heading" className={styles.heading}>
        {heading}
      </h1>
      {children}
    </section>
  )
}
