import { StatusPill, type StatusTone } from '../../../components/ui'
import styles from '../kitchen.surfaces.module.css'
import { formatTicketAge, ticketAgeBand, ticketAgeMinutes } from '../ticketAge'
import type { KitchenTicket } from '../staffOpsClient'

/**
 * One kitchen ticket (spec 009 T014; specs/030 FR-02/03/04/08, D2/D3;
 * contracts/staff-ops-client.md §4): items, quantities, extras, the honest
 * age — and deliberately NO money text and NO delivery address anywhere.
 * The kitchen queue payload carries no money keys and no channel keys (the
 * database suite asserts the shape at runtime); this component must not
 * invent any either. A ticket without a table (the channel sessions) heads
 * 'Counter order' — never 'Table null'.
 *
 * Exactly two actions exist, with the pinned accessible names: 'Start
 * preparation' on accepted, 'Mark ready' on preparing — large targets,
 * busy/disabled protected (FR-04). A refused action renders the server's
 * message verbatim on the originating card (FR-08). The arrival highlight
 * (D1) is a one-shot composition treatment, cleared by the board.
 */

export interface TicketCardProps {
  ticket: KitchenTicket
  busy: boolean
  refusal: string | null
  /** The board's one-shot arrival treatment (D1) — presentation only. */
  justArrived?: boolean
  onStart: () => void
  onReady: () => void
}

const STARTABLE = new Set(['accepted'])
const READIABLE = new Set(['preparing'])

const STATE_TONES: Record<string, StatusTone> = {
  new: 'neutral',
  accepted: 'brand',
  preparing: 'info',
  ready: 'positive',
}

const STATE_LABELS: Record<string, string> = {
  new: 'Awaiting cashier',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
}

export function TicketCard({
  ticket,
  busy,
  refusal,
  justArrived = false,
  onStart,
  onReady,
}: TicketCardProps) {
  const minutes = ticketAgeMinutes(ticket.created_at)
  const band = ticketAgeBand(minutes)

  return (
    <article
      className={[styles.ticket, justArrived ? styles.ticketArrived : ''].filter(Boolean).join(' ')}
      data-ticket-id={ticket.ticket_id}
      data-ticket-state={ticket.state}
    >
      <header className={styles.ticketHeader}>
        <h3 className={styles.ticketHeading}>
          {ticket.table_label !== null ? `Table ${ticket.table_label}` : 'Counter order'}
        </h3>
        <p className={styles.ticketMeta}>
          <StatusPill tone={STATE_TONES[ticket.state] ?? 'neutral'}>
            {STATE_LABELS[ticket.state] ?? ticket.state}
          </StatusPill>
          <span
            className={[
              styles[`age${band.charAt(0).toUpperCase()}${band.slice(1)}`],
              band === 'late' ? styles.ageBadge : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {band === 'late' ? 'late — ' : ''}
            {formatTicketAge(minutes)}
          </span>
        </p>
      </header>

      <ul className={styles.itemList}>
        {ticket.items.map((item, index) => (
          <li key={`${ticket.ticket_id}-${index}`} className={styles.itemLine}>
            <span className={styles.itemQuantity}>{item.quantity}</span>
            <span>
              <span className={styles.itemName}>{item.name}</span>
              {item.extras.length > 0 ? (
                <span className={styles.itemExtras}> + {item.extras.join(', ')}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {refusal !== null && (
        <p role="alert" data-refusal className={styles.ticketRefusal}>
          {refusal}
        </p>
      )}

      <footer className={styles.actions}>
        {STARTABLE.has(ticket.state) && (
          <button type="button" className={styles.bigAction} disabled={busy} onClick={onStart}>
            Start preparation
          </button>
        )}
        {READIABLE.has(ticket.state) && (
          <button type="button" className={styles.bigAction} disabled={busy} onClick={onReady}>
            Mark ready
          </button>
        )}
      </footer>
    </article>
  )
}
