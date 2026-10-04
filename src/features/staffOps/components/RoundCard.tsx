import { useState } from 'react'
import { Button, MoneyText, StateChip, type DomainStatus } from '../../../components/ui'
import { formatPrice } from '../../menu/money'
import { channelLabel } from '../../session/sessionClient'
import { ChannelChip } from '../../session/components/ChannelChip'
import styles from '../staffOps.surfaces.module.css'
import type { BranchRound } from '../staffOpsClient'
import { MODIFIABLE, isVoidable } from '../roundGroups'
import { RefusalText } from './RefusalText'
import { TransitionActions, type TransitionHandlers } from './TransitionActions'
import { VoidRoundDialog } from './VoidRoundDialog'

/**
 * One branch round on the cashier board (spec 009 T011; spec 010 T013;
 * spec 011 T008; specs/029 FR-02/03/04, D5; contracts/staff-ops-client.md
 * §4; contracts/session-client.md §4).
 *
 * The card is the board's workhorse: header (table/channel + the pinned
 * 'round <id8>' fragment + state chip + cued marker), item lines with the
 * inline modify controls ('Reduce one' / 'Remove line' — D5, the E2E
 * contract), the captured money line, the state-gated transition actions
 * (pinned names), the boundary-aware two-step void, and the 'Show bill'
 * selection. Everything re-renders from the refetched read — no optimistic
 * state (§5.4). The void is an OVERLAY: `data-voided` flips while the round
 * keeps its state, and the voided note carries the reason verbatim.
 */

export interface RoundCardProps {
  round: BranchRound
  busy: boolean
  refusal: string | null
  /** The new-round cue names THIS round (FR-08, D3) — visible marker only. */
  cued?: boolean
  billSelected: boolean
  onSelectForBill: () => void
  onModify: (itemId: string, action: 'remove' | 'reduce', quantity?: number) => void
  onVoid: (reason: string) => void
  handlers: TransitionHandlers
}

export function RoundCard({
  round,
  busy,
  refusal,
  cued = false,
  billSelected,
  onSelectForBill,
  onModify,
  onVoid,
  handlers,
}: RoundCardProps) {
  const [voiding, setVoiding] = useState(false)
  const modifiable = !round.voided && MODIFIABLE.has(round.state)

  return (
    <article
      className={[styles.card, cued ? styles.cardCued : ''].filter(Boolean).join(' ')}
      data-round-id={round.round_id}
      data-round-state={round.state}
      data-voided={round.voided}
    >
      <header className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          {round.table_label !== null
            ? `Table ${round.table_label}`
            : channelLabel(round.session_type)}{' '}
          — round {round.round_id.slice(0, 8)}
        </h3>
        <div className={styles.cardMeta}>
          {cued && <span className={styles.cueBadge}>New order</span>}
          <StateChip status={round.voided ? 'voided' : (round.state as DomainStatus)} />
          <ChannelChip type={round.session_type} />
        </div>
        {round.voided && (
          <p data-voided-note className={styles.voidedNote}>
            <strong>Voided</strong>
            {round.void_reason !== null ? ` — ${round.void_reason}` : ''}
          </p>
        )}
        {round.session_type === 'delivery' && round.delivery_address ? (
          <p className={styles.addressLine}>Deliver to: {round.delivery_address}</p>
        ) : null}
      </header>

      <ul className={styles.lineList}>
        {round.items.map((item) => (
          <li key={`${round.round_id}-${item.item_id}`} className={styles.lineRow}>
            <span className={styles.lineMain}>
              <span>
                {item.name} × {item.quantity}
                {item.extras.length > 0 ? ` (+ ${item.extras.join(', ')})` : ''}
              </span>
              <span className={styles.lineMoney}>
                {formatPrice(item.unit_price)} each ·{' '}
                <MoneyText value={(parseFloat(item.unit_price) * item.quantity).toFixed(2)} />
              </span>
            </span>
            {modifiable && (
              <span className={styles.lineModify}>
                {item.quantity > 1 && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => onModify(item.item_id, 'reduce', item.quantity - 1)}
                  >
                    Reduce one
                  </Button>
                )}
                <Button size="sm" disabled={busy} onClick={() => onModify(item.item_id, 'remove')}>
                  Remove line
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {modifiable && round.items.length > 0 && (
        <p className={styles.modifyHint}>
          Reducing or removing a line tells the kitchen immediately — the server re-derives the
          captured prices.
        </p>
      )}

      <p className={styles.totalsRow}>
        <span>
          Subtotal <MoneyText value={round.subtotal} />
        </span>
        <span>
          tax <MoneyText value={round.tax_total} />
        </span>
      </p>

      {refusal !== null && <RefusalText message={refusal} />}

      <TransitionActions round={round} busy={busy} handlers={handlers} />

      {!round.voided && isVoidable(round) && (
        <>
          <Button
            variant="danger"
            className={styles.touchAction}
            disabled={busy}
            onClick={() => setVoiding(true)}
          >
            Void round
          </Button>
          <VoidRoundDialog
            open={voiding}
            round={round}
            busy={busy}
            onCancel={() => setVoiding(false)}
            onConfirm={(reason) => {
              onVoid(reason)
              setVoiding(false)
            }}
          />
        </>
      )}

      <label className={styles.billToggle}>
        <input type="checkbox" checked={billSelected} onChange={onSelectForBill} disabled={busy} />{' '}
        Show bill
      </label>
    </article>
  )
}
