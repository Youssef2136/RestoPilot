/**
 * TotalsPanel (spec 025 T001; UX "bill-like summary"): one component for the
 * two money surfaces the phase owns — the customer round's CAPTURED
 * subtotal/tax lines/total (from `get_session_rounds`, never recomputed) and
 * the cart's ADVISORY before-tax estimate (client-side, clearly advisory).
 *
 * The money-fidelity rule lives here structurally: captured rows render via
 * `MoneyText kind="captured"`; the advisory total is the only `advisory` row
 * and is labeled "before tax" so it can never read as authoritative money.
 */
import { MoneyText } from './MoneyText'
import styles from './TotalsPanel.module.css'

export interface CapturedTotals {
  subtotal: string | number
  /** The server's tax lines, verbatim: name + exact amount. */
  taxLines: ReadonlyArray<{ name?: string; amount?: string }>
  total: string | number
}

export function TotalsPanel({
  totals,
  advisoryTotal,
}: {
  totals?: CapturedTotals
  advisoryTotal?: string | number
}) {
  if (totals !== undefined) {
    return (
      <dl className={styles.panel}>
        <div className={styles.row}>
          <dt>Subtotal</dt>
          <dd>
            <MoneyText value={totals.subtotal} kind="captured" />
          </dd>
        </div>
        {totals.taxLines.map((line, index) => (
          <div key={`${line.name ?? 'Tax'}-${index}`} className={styles.row}>
            <dt>{line.name ?? 'Tax'}</dt>
            <dd>
              <MoneyText value={line.amount ?? ''} kind="captured" />
            </dd>
          </div>
        ))}
        <div className={`${styles.row} ${styles.total}`}>
          <dt>Total</dt>
          <dd>
            <MoneyText value={totals.total} kind="captured" />
          </dd>
        </div>
      </dl>
    )
  }

  return (
    <p className={styles.advisoryRow}>
      Total (before tax): <MoneyText value={advisoryTotal ?? 0} kind="advisory" />
    </p>
  )
}
