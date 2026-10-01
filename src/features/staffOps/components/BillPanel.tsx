import { formatPrice } from '../../menu/money'
import { channelLabel } from '../../session/sessionClient'
import { MoneyText } from '../../../components/ui'
import styles from '../staffOps.surfaces.module.css'
import { useSessionBill } from '../useStaffOps'

/**
 * The session bill (spec 009 T012; spec 010 T013; spec 011 T008; specs/029
 * FR-05, D1; contracts/staff-ops-client.md §4): the COMPLETE display of
 * captured money, rendered inline on the rounds page like a printed check —
 * raised surface, hairline separators, tabular numerals. Every round renders
 * its per-line detail (name, quantity, captured unit price, extras) and its
 * captured tax lines by name; the session's named participants are listed;
 * VOIDED rounds leave the totals and render in a separate voided section
 * with their reasons (FR-003) — the bill is still the truth, now including
 * the correction.
 *
 * Display-only: every figure comes from the bill payload; the client
 * computes nothing authoritative (Constitution I, II) — the grand total is
 * the server's non-voided sum. The numeric presentation pins are structural:
 * the voided line carries EXACTLY two decimal figures (subtotal, tax) and
 * the grand-total element EXACTLY one — bill.void.audit's delta math parses
 * them. No payment, invoice or discount concept exists in this feature — the
 * word appears nowhere by design; payment happens in the external POS.
 */
export function BillPanel({ sessionId }: { sessionId: string }) {
  const billQuery = useSessionBill(sessionId)

  if (billQuery.isPending) {
    return (
      <section aria-label="Session bill" data-testid="session-bill" className={styles.bill}>
        <h3 className={styles.billHeading}>Bill</h3>
        <p>Loading the bill…</p>
      </section>
    )
  }

  if (billQuery.isError || billQuery.data === undefined) {
    return (
      <section aria-label="Session bill" data-testid="session-bill" className={styles.bill}>
        <h3 className={styles.billHeading}>Bill</h3>
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
    <section aria-label="Session bill" data-testid="session-bill" className={styles.bill}>
      <h3 className={styles.billHeading}>
        Bill —{' '}
        {bill.table_label !== null ? `table ${bill.table_label}` : channelLabel(bill.session_type)}
      </h3>
      <p className={styles.billSub}>
        Captured figures as the server returned them — payment happens in the external POS.
      </p>

      {bill.delivery_address ? (
        <p data-testid="bill-address" className={styles.addressLine}>
          Deliver to: {bill.delivery_address}
        </p>
      ) : null}

      {bill.participants.length > 0 && (
        <div data-testid="bill-participants" className={styles.billMeta}>
          <span>Participants:</span>
          {bill.participants.map((participant) => (
            <span key={participant.id} className={styles.participantChip}>
              {participant.display_name}
            </span>
          ))}
        </div>
      )}

      {[...groups.entries()].map(([state, rounds]) => (
        <div key={state}>
          <h4>{state}</h4>
          {rounds.map((round) => (
            <article
              key={round.round_id}
              data-bill-round={round.round_id}
              className={styles.billRound}
            >
              <header className={styles.billRoundHeading}>
                <span>Round {round.round_id.slice(0, 8)}</span>
                <span>
                  total{' '}
                  <MoneyText
                    value={(parseFloat(round.subtotal) + parseFloat(round.tax_total)).toFixed(2)}
                  />
                </span>
              </header>
              <ul data-bill-lines className={styles.billLines}>
                {round.items.map((item) => (
                  <li key={`${round.round_id}-${item.item_id}`} className={styles.billLine}>
                    <span>
                      {item.name} × {item.quantity}
                      {item.extras.length > 0 ? ` (+ ${item.extras.join(', ')})` : ''}
                    </span>
                    <span className={styles.billLineValue}>
                      {formatPrice(item.unit_price)} each
                    </span>
                  </li>
                ))}
              </ul>
              <ul data-bill-tax-lines className={styles.billTaxLines}>
                {(Array.isArray(round.tax_lines) ? round.tax_lines : []).map((line: unknown) => {
                  const record = line as { name?: string; amount?: string }
                  return (
                    <li key={`${round.round_id}-tax-${record.name}`} className={styles.billLine}>
                      <span>{record.name}</span>
                      <span className={styles.billLineValue}>
                        <MoneyText value={record.amount ?? '0'} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            </article>
          ))}
        </div>
      ))}

      {active.length === 0 && voided.length === 0 && (
        <p className={styles.groupEmpty}>No rounds on this bill.</p>
      )}

      {voided.length > 0 && (
        <div data-testid="bill-voided-section" className={styles.billVoidedSection}>
          <h4 className={styles.billVoidedHeading}>Voided</h4>
          <ul className={styles.billVoidedList}>
            {voided.map((round) => (
              <li
                key={round.round_id}
                data-bill-voided-round={round.round_id}
                className={styles.billVoidedItem}
              >
                Round {round.round_id.slice(0, 8)} (was {round.state})
                {round.void_reason !== null ? ` — ${round.void_reason}` : ''} — subtotal{' '}
                <MoneyText value={round.subtotal} />, tax <MoneyText value={round.tax_total} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <p data-testid="bill-grand-total" className={styles.grandTotalRow}>
        <span>Grand total</span> <MoneyText value={bill.grand_total} />
      </p>
    </section>
  )
}
