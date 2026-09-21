import { formatPrice } from '../../menu/money'
import { channelLabel } from '../../session/sessionClient'
import type { BranchRound, RoundActionResult } from '../staffOpsClient'

/**
 * One branch round on the cashier dashboard (spec 009 T011; spec 010 T013;
 * contracts/staff-ops-client.md §4; contracts/session-client.md §4; US2, US3).
 *
 * Controls are enabled exactly per state: accept on `new`; modify (remove a
 * line, reduce a quantity) on `new`–`preparing`; lock on `ready`; nothing on
 * `lock` (and nothing ever for kitchen — that gate lives server-side, the
 * refusal renders verbatim). DELIVERY rounds extend the machine (spec 010
 * FR-005): "Send out for delivery" on `ready`, "Mark completed" on
 * `out_for_delivery` — lock is not offered on delivery, `completed` is its
 * terminal. The card carries the channel chip (FR-009); money text is the
 * round's CAPTURED values only.
 */

export interface RoundCardProps {
  round: BranchRound
  busy: boolean
  refusal: string | null
  onAccept: () => void
  onStart: () => void
  onReady: () => void
  onModify: (itemId: string, action: 'remove' | 'reduce', quantity?: number) => void
  onLock: () => void
  onOutForDelivery: () => void
  onCompleted: () => void
  onSelectForBill: () => void
  billSelected: boolean
}

const ACCEPTABLE = new Set(['new'])
const STARTABLE = new Set(['accepted'])
const READIABLE = new Set(['preparing'])
const MODIFIABLE = new Set(['new', 'accepted', 'preparing'])
const LOCKABLE = new Set(['ready'])
const DISPATCHABLE = new Set(['ready'])
const COMPLETABLE = new Set(['out_for_delivery'])
const IS_DELIVERY = (round: BranchRound) => round.session_type === 'delivery'

export function RoundCard({
  round,
  busy,
  refusal,
  onAccept,
  onStart,
  onReady,
  onModify,
  onLock,
  onOutForDelivery,
  onCompleted,
  onSelectForBill,
  billSelected,
}: RoundCardProps) {
  return (
    <article data-round-id={round.round_id} data-round-state={round.state}>
      <header>
        <h3>
          {round.table_label !== null
            ? `Table ${round.table_label}`
            : channelLabel(round.session_type)}{' '}
          — round {round.round_id.slice(0, 8)}{' '}
          <span data-channel-chip>{channelLabel(round.session_type)}</span>
        </h3>
        <p>
          State: <strong>{round.state}</strong>
        </p>
        {IS_DELIVERY(round) && round.delivery_address ? (
          <p>Deliver to: {round.delivery_address}</p>
        ) : null}
      </header>

      <ul>
        {round.items.map((item) => (
          <li key={`${round.round_id}-${item.item_id}`}>
            {item.name} × {item.quantity} — {formatPrice(item.unit_price)} each
            {item.extras.length > 0 ? ` (+ ${item.extras.join(', ')})` : ''} ={' '}
            {formatPrice((parseFloat(item.unit_price) * item.quantity).toFixed(2))}{' '}
            {MODIFIABLE.has(round.state) && (
              <span>
                {' '}
                {item.quantity > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onModify(item.item_id, 'reduce', item.quantity - 1)}
                  >
                    Reduce one
                  </button>
                )}{' '}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onModify(item.item_id, 'remove')}
                >
                  Remove line
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      <p>
        Subtotal {formatPrice(round.subtotal)} · tax {formatPrice(round.tax_total)}
      </p>

      {refusal !== null && (
        <p role="alert" data-refusal>
          {refusal}
        </p>
      )}

      <footer>
        {ACCEPTABLE.has(round.state) && (
          <button type="button" disabled={busy} onClick={onAccept}>
            Accept round
          </button>
        )}
        {STARTABLE.has(round.state) && (
          <button type="button" disabled={busy} onClick={onStart}>
            Start preparation
          </button>
        )}
        {READIABLE.has(round.state) && (
          <button type="button" disabled={busy} onClick={onReady}>
            Mark ready
          </button>
        )}
        {LOCKABLE.has(round.state) && !IS_DELIVERY(round) && (
          <button type="button" disabled={busy} onClick={onLock}>
            Lock round
          </button>
        )}
        {IS_DELIVERY(round) && DISPATCHABLE.has(round.state) && (
          <button type="button" disabled={busy} onClick={onOutForDelivery}>
            Send out for delivery
          </button>
        )}
        {IS_DELIVERY(round) && COMPLETABLE.has(round.state) && (
          <button type="button" disabled={busy} onClick={onCompleted}>
            Mark completed
          </button>
        )}
        {round.state === 'lock' && <span>Served (locked)</span>}
        {round.state === 'completed' && <span>Delivered (completed)</span>}
        <label>
          <input
            type="checkbox"
            checked={billSelected}
            onChange={onSelectForBill}
            disabled={busy}
          />
          Show bill
        </label>
      </footer>
    </article>
  )
}

/** Map a transition result to the state label the card re-renders from. */
export function resultState(result: RoundActionResult): string {
  return result.round.state
}
