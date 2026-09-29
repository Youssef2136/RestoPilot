import styles from './MoneyText.module.css'
import { formatPrice } from '../../features/menu/money'

/**
 * MoneyText (spec 025 T001; Visual requirements): the SINGLE money
 * presentation component for the customer surfaces. Every amount on screen —
 * the advisory cart total AND the captured round money — renders here.
 *
 * Display only: `formatPrice` never feeds computation (the data layer's
 * exactness rule — menu/money.ts). The `kind` distinguishes the two semantic
 * modes the checklist's money-fidelity bar demands: `captured` (the server's
 * authoritative money from the 006 engine) renders strong, `advisory` (the
 * client-side cart estimate) renders muted and is always introduced by its
 * calling surface's "before tax" wording — never presented as truth.
 */
export function MoneyText({
  value,
  kind = 'captured',
  'aria-label': ariaLabel,
}: {
  value: string | number
  kind?: 'captured' | 'advisory'
  'aria-label'?: string
}) {
  return (
    <span
      className={kind === 'advisory' ? styles.advisory : styles.captured}
      aria-label={ariaLabel}
    >
      {formatPrice(value)}
    </span>
  )
}
