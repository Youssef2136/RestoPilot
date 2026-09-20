import { formatPrice } from '../../menu/money'
import { useSessionBill } from '../useStaffOps'

/**
 * The session bill (spec 009 T012; contracts/staff-ops-client.md §4; US2,
 * FR-009, SC-005): the selected session's rounds grouped by state with their
 * CAPTURED subtotals, tax lines and totals, and the grand total exactly as
 * the server summed the captured values.
 *
 * Display-only: every figure comes from the bill payload; the client computes
 * nothing (Constitution I, II). No payment, invoice or discount concept
 * exists in this feature — the word appears nowhere by design.
 */

export function BillPanel({ sessionId }: { sessionId: string }) {
  const billQuery = useSessionBill(sessionId)

  if (billQuery.isPending) {
    return (
      <section aria-label="Session bill">
        <h3>Bill</h3>
        <p>Loading the bill…</p>
      </section>
    )
  }

  if (billQuery.isError || billQuery.data === undefined) {
    return (
      <section aria-label="Session bill">
        <h3>Bill</h3>
        <p role="alert">The bill could not be loaded.</p>
      </section>
    )
  }

  const bill = billQuery.data
  const groups = new Map<string, typeof bill.rounds>()
  for (const round of bill.rounds) {
    const group = groups.get(round.state) ?? []
    group.push(round)
    groups.set(round.state, group)
  }

  return (
    <section aria-label="Session bill" data-testid="session-bill">
      <h3>Bill — table {bill.table_label}</h3>
      {[...groups.entries()].map(([state, rounds]) => (
        <div key={state}>
          <h4>{state}</h4>
          <ul>
            {rounds.map((round) => (
              <li key={round.round_id} data-bill-round={round.round_id}>
                Round {round.round_id.slice(0, 8)} — subtotal {formatPrice(round.subtotal)}, tax{' '}
                {formatPrice(round.tax_total)}, total {formatPrice(round.tax_total)}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p data-testid="bill-grand-total">
        <strong>Grand total {formatPrice(bill.grand_total)}</strong>
      </p>
    </section>
  )
}
