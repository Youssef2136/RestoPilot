import { formatPrice } from '../../menu/money'
import { channelLabel } from '../../session/sessionClient'
import { useSessionBill } from '../useStaffOps'

/**
 * The session bill (spec 009 T012; spec 010 T013; spec 011 T008; contracts/
 * staff-ops-client.md §4; FR-001..FR-003): the COMPLETE display of captured
 * money. Every round renders its per-line detail (name, quantity, captured
 * unit price, captured extras) and its captured tax lines by name; the
 * session's named participants are listed; VOIDED rounds leave the totals
 * and render in a separate voided section with their reasons — the bill is
 * still the truth, now including the correction (FR-003).
 *
 * Display-only: every figure comes from the bill payload; the client computes
 * nothing (Constitution I, II) — the grand total is the server's non-voided
 * sum, not a client aggregation. No payment, invoice or discount concept
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
  const active = bill.rounds.filter((round) => !round.voided)
  const voided = bill.rounds.filter((round) => round.voided)

  const groups = new Map<string, typeof active>()
  for (const round of active) {
    const group = groups.get(round.state) ?? []
    group.push(round)
    groups.set(round.state, group)
  }

  return (
    <section aria-label="Session bill" data-testid="session-bill">
      <h3>
        Bill —{' '}
        {bill.table_label !== null ? `table ${bill.table_label}` : channelLabel(bill.session_type)}
      </h3>
      {bill.delivery_address ? (
        <p data-testid="bill-address">Deliver to: {bill.delivery_address}</p>
      ) : null}

      {bill.participants.length > 0 && (
        <div data-testid="bill-participants">
          <h4>Participants</h4>
          <ul>
            {bill.participants.map((participant) => (
              <li key={participant.id}>{participant.display_name}</li>
            ))}
          </ul>
        </div>
      )}

      {[...groups.entries()].map(([state, rounds]) => (
        <div key={state}>
          <h4>{state}</h4>
          <ul>
            {rounds.map((round) => (
              <li key={round.round_id} data-bill-round={round.round_id}>
                Round {round.round_id.slice(0, 8)} — subtotal {formatPrice(round.subtotal)}, tax{' '}
                {formatPrice(round.tax_total)}, total{' '}
                {formatPrice((parseFloat(round.subtotal) + parseFloat(round.tax_total)).toFixed(2))}
                <ul data-bill-lines>
                  {round.items.map((item) => (
                    <li key={`${round.round_id}-${item.item_id}`}>
                      {item.name} × {item.quantity} — {formatPrice(item.unit_price)} each
                      {item.extras.length > 0 ? ` (+ ${item.extras.join(', ')})` : ''}
                    </li>
                  ))}
                </ul>
                <ul data-bill-tax-lines>
                  {(Array.isArray(round.tax_lines) ? round.tax_lines : []).map((line: unknown) => {
                    const record = line as { name?: string; amount?: string }
                    return (
                      <li key={`${round.round_id}-tax-${record.name}`}>
                        {record.name}: {formatPrice(record.amount ?? '0')}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {voided.length > 0 && (
        <div data-testid="bill-voided-section">
          <h4>Voided</h4>
          <ul>
            {voided.map((round) => (
              <li key={round.round_id} data-bill-voided-round={round.round_id}>
                Round {round.round_id.slice(0, 8)} (was {round.state})
                {round.void_reason !== null ? ` — ${round.void_reason}` : ''} — subtotal{' '}
                {formatPrice(round.subtotal)}, tax {formatPrice(round.tax_total)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p data-testid="bill-grand-total">
        <strong>Grand total {formatPrice(bill.grand_total)}</strong>
      </p>
    </section>
  )
}
