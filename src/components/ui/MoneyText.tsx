import { formatPrice } from '../../features/menu/money'
import { StatusPill, type StatusTone } from './Feedback'
import styles from './TotalsPanel.module.css'

/**
 * Domain-shared primitives (spec 022 FR-04/FR-10/T010; Master Plan §5.3
 * "Domain-shared" + §16): the product's money and state vocabulary rendered
 * ONCE — never re-derived per page.
 *
 * MoneyText wraps the existing exact formatters (`features/menu/money.ts`,
 * `features/tax/taxMoney.ts`) — it never re-implements money math or
 * formatting (FA-1: money truth comes from reads; display-only here).
 * Money renders with tabular numerals so columns align (R7).
 */

export function MoneyText({
  value,
  format = formatPrice,
  className,
}: {
  value: string | number
  /** A feature formatter (formatPrice default; formatAdjustment/formatRate where the surface means it). */
  format?: (value: string | number) => string
  className?: string
}) {
  return (
    <span className={[styles.money, className].filter(Boolean).join(' ')}>{format(value)}</span>
  )
}

/**
 * StateChip maps a domain status string to the status palette ONCE. The
 * mapping below is the vocabulary contract (rounds, tickets, subscription,
 * availability — Master Plan §5.3); a new status extends this map, never a
 * page-local palette choice (FR-10).
 */

export type DomainStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'lock'
  | 'out_for_delivery'
  | 'completed'
  | 'voided'
  | 'open'
  | 'closed'
  | 'active'
  | 'nearing_expiration'
  | 'expired'
  | 'never_activated'
  | 'available'
  | 'unavailable'
  | 'disabled'

const STATUS_TONES: Record<DomainStatus, StatusTone> = {
  // Round lifecycle (§3.5): terminal voided = danger; in-progress = brand.
  new: 'neutral',
  accepted: 'brand',
  preparing: 'info',
  ready: 'positive',
  lock: 'neutral',
  out_for_delivery: 'brand',
  completed: 'positive',
  voided: 'danger',
  // Session lifecycle.
  open: 'positive',
  closed: 'neutral',
  // Subscription derived states (§3.5).
  active: 'positive',
  nearing_expiration: 'warning',
  expired: 'danger',
  never_activated: 'neutral',
  disabled: 'danger',
  // Availability.
  available: 'positive',
  unavailable: 'danger',
}

/** Human labels for machine statuses (one vocabulary, one place). */
const STATUS_LABELS: Partial<Record<DomainStatus, string>> = {
  out_for_delivery: 'Out for delivery',
  nearing_expiration: 'Nearing expiration',
  never_activated: 'Never activated',
  lock: 'Locked',
}

export function StateChip({ status }: { status: DomainStatus }) {
  const tone = STATUS_TONES[status] ?? 'neutral'
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ')
  return <StatusPill tone={tone}>{label}</StatusPill>
}

/**
 * TotalsPanel — the money summary shell (bills, cart, tax previews). It
 * renders LINES as data; every total arrives pre-computed from the server
 * (§3.3: tax math is SQL-side; the UI renders results, FA-1).
 */

export type TotalsLine = {
  key: string
  label: string
  /** The formatted display string (callers format through MoneyText). */
  display: string
  kind?: 'normal' | 'emphasis'
  voided?: boolean
}

export type TotalsGroup = {
  key: string
  heading?: string
  lines: TotalsLine[]
}

export function TotalsPanel({
  groups,
  grandTotal,
  footer,
}: {
  groups: TotalsGroup[]
  grandTotal: TotalsLine
  footer?: React.ReactNode
}) {
  return (
    <div className={styles.panel}>
      {groups.map((group) => (
        <section key={group.key} className={styles.group}>
          {group.heading && <h3 className={styles.groupHeading}>{group.heading}</h3>}
          <dl className={styles.lines}>
            {group.lines.map((line) => (
              <div
                key={line.key}
                className={[
                  styles.line,
                  line.voided ? styles.lineVoided : '',
                  line.kind === 'emphasis' ? styles.lineEmphasis : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <dt className={styles.lineLabel}>{line.label}</dt>
                <dd className={styles.lineValue}>{line.display}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <div className={styles.grandTotalGroup}>
        <dl className={styles.lines}>
          <div className={`${styles.line} ${styles.grandTotal}`}>
            <dt className={styles.lineLabel}>{grandTotal.label}</dt>
            <dd className={styles.lineValue}>{grandTotal.display}</dd>
          </div>
        </dl>
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  )
}
