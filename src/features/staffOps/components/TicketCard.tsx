/**
 * One kitchen ticket (spec 009 T014; contracts/staff-ops-client.md §4; US3,
 * FR-003, FR-010): items, quantities, extras — and deliberately NO money
 * text anywhere. The kitchen queue payload carries no money keys (the
 * database suite asserts the shape at runtime); this component must not
 * invent any either.
 */

import type { KitchenTicket } from '../staffOpsClient'

export interface TicketCardProps {
  ticket: KitchenTicket
  busy: boolean
  refusal: string | null
  onStart: () => void
  onReady: () => void
}

const STARTABLE = new Set(['accepted'])
const READIABLE = new Set(['preparing'])

export function TicketCard({ ticket, busy, refusal, onStart, onReady }: TicketCardProps) {
  return (
    <article data-ticket-id={ticket.ticket_id} data-ticket-state={ticket.state}>
      <header>
        <h3>Table {ticket.table_label}</h3>
        <p>
          State: <strong>{ticket.state}</strong>
        </p>
      </header>
      <ul>
        {ticket.items.map((item, index) => (
          <li key={`${ticket.ticket_id}-${index}`}>
            {item.quantity} × {item.name}
            {item.extras.length > 0 ? ` (+ ${item.extras.join(', ')})` : ''}
          </li>
        ))}
      </ul>
      {refusal !== null && (
        <p role="alert" data-refusal>
          {refusal}
        </p>
      )}
      <footer>
        {STARTABLE.has(ticket.state) && (
          <button type="button" disabled={busy} onClick={onStart}>
            Start preparation
          </button>
        )}
        {READIABLE.has(ticket.state) && (
          <button type="button" disabled={busy} onClick={onReady}>
            Mark ready
          </button>
        )}
      </footer>
    </article>
  )
}
