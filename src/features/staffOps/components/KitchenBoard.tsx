import { Skeleton } from '../../../components/ui'
import styles from '../kitchen.surfaces.module.css'
import type { KitchenTicket } from '../staffOpsClient'
import { TicketCard } from './TicketCard'

/**
 * The kitchen board (specs/030 FR-01, D3): three columns — Incoming
 * (awaiting cashier, the contract's `new` mirror), In preparation (the
 * accepted+preparing merge the queue itself carries), Ready to serve —
 * each with a real heading, a count, and its tickets or a named empty.
 * "Readability over density": the columns are slabs, the counts are large,
 * and a ticket that changed state elsewhere moves columns through the
 * refetched read — never a stale double-render.
 *
 * The columns are DIVs, deliberately not regions: the kitchen route's
 * frozen `section`-innerText pin reads ONE section, so the board must add
 * none (the page's root section stays the only one — the a11y-guided
 * heading structure below is heading-first, which the axe scan accepts).
 */

export interface KitchenBoardProps {
  tickets: KitchenTicket[]
  busy: boolean
  loading: boolean
  refusalFor: (roundId: string) => string | null
  arrivedTicketIds: ReadonlySet<string>
  onStart: (roundId: string) => void
  onReady: (roundId: string) => void
}

const COLUMNS: ReadonlyArray<{
  key: 'new' | 'preparing' | 'ready'
  label: string
  heading: string
  states: readonly string[]
}> = [
  { key: 'new', label: 'Incoming (awaiting cashier)', heading: 'Incoming', states: ['new'] },
  {
    key: 'preparing',
    label: 'In preparation',
    heading: 'In preparation',
    states: ['accepted', 'preparing'],
  },
  { key: 'ready', label: 'Ready to serve', heading: 'Ready to serve', states: ['ready'] },
]

export function KitchenBoard({
  tickets,
  busy,
  loading,
  refusalFor,
  arrivedTicketIds,
  onStart,
  onReady,
}: KitchenBoardProps) {
  if (loading) {
    return (
      <div className={styles.board} data-testid="kitchen-board" aria-hidden="true">
        {COLUMNS.map((column) => (
          <div key={column.key} className={styles.column}>
            <Skeleton height="2rem" />
            <Skeleton height="9rem" />
            <Skeleton height="9rem" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.board} data-testid="kitchen-board">
      {COLUMNS.map((column) => {
        const columnTickets = tickets.filter((ticket) => column.states.includes(ticket.state))
        return (
          <div
            key={column.key}
            aria-label={column.label}
            data-kitchen-column={column.key}
            className={styles.column}
          >
            <header className={styles.columnHeader}>
              <h2 className={styles.columnHeading}>{column.heading}</h2>
              <span className={styles.columnCount}>{columnTickets.length}</span>
            </header>
            {columnTickets.length === 0 ? (
              <p className={styles.columnEmpty}>Nothing waiting here right now.</p>
            ) : (
              <ul className={styles.columnList}>
                {columnTickets.map((ticket) => (
                  <li key={ticket.ticket_id}>
                    <TicketCard
                      ticket={ticket}
                      busy={busy}
                      refusal={refusalFor(ticket.round_id)}
                      justArrived={arrivedTicketIds.has(ticket.ticket_id)}
                      onStart={() => onStart(ticket.round_id)}
                      onReady={() => onReady(ticket.round_id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
