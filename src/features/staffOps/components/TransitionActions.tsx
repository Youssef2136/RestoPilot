import { useState } from 'react'
import { Button } from '../../../components/ui'
import styles from '../staffOps.surfaces.module.css'
import type { BranchRound } from '../staffOpsClient'
import { CompletionConfirmDialog } from './CompletionConfirmDialog'

/**
 * The state-gated transition controls (specs/029 FR-02): EXACTLY the
 * actions the state machine allows, with the pinned accessible names (the
 * E2E contract — never reworded) and busy/disabled protection so a busy
 * queue cannot double-submit. Delivery extends the dine-in machine (spec
 * 010 §3): dispatch on `ready`, completion on `out_for_delivery` — lock is
 * not offered on delivery. The state predicates live in `roundGroups.ts`
 * (pure helpers, unit-tested).
 */

const ACCEPTABLE = new Set(['new'])
const STARTABLE = new Set(['accepted'])
const READIABLE = new Set(['preparing'])
const LOCKABLE = new Set(['ready'])
const DISPATCHABLE = new Set(['ready'])
const COMPLETABLE = new Set(['out_for_delivery'])

const IS_DELIVERY = (round: BranchRound) => round.session_type === 'delivery'

export interface TransitionHandlers {
  onAccept: (roundId: string) => void
  onStart: (roundId: string) => void
  onReady: (roundId: string) => void
  onLock: (roundId: string) => void
  onOutForDelivery: (roundId: string) => void
  onCompleted: (roundId: string) => void
}

export function TransitionActions({
  round,
  busy,
  handlers,
}: {
  round: BranchRound
  busy: boolean
  handlers: TransitionHandlers
}) {
  const id = round.round_id
  // specs/031 FR-03 (D3): completion is terminal — the pinned 'Mark
  // completed' button OPENS the consequence dialog; the dialog's confirm
  // fires the same handler. Dispatch stays one-tap.
  const [confirmingCompletion, setConfirmingCompletion] = useState(false)
  return (
    <div className={styles.actions}>
      {!round.voided && ACCEPTABLE.has(round.state) && (
        <Button
          variant="primary"
          className={styles.touchAction}
          disabled={busy}
          onClick={() => handlers.onAccept(id)}
        >
          Accept round
        </Button>
      )}
      {!round.voided && STARTABLE.has(round.state) && (
        <Button className={styles.touchAction} disabled={busy} onClick={() => handlers.onStart(id)}>
          Start preparation
        </Button>
      )}
      {!round.voided && READIABLE.has(round.state) && (
        <Button className={styles.touchAction} disabled={busy} onClick={() => handlers.onReady(id)}>
          Mark ready
        </Button>
      )}
      {!round.voided && LOCKABLE.has(round.state) && !IS_DELIVERY(round) && (
        <Button className={styles.touchAction} disabled={busy} onClick={() => handlers.onLock(id)}>
          Lock round
        </Button>
      )}
      {!round.voided && IS_DELIVERY(round) && DISPATCHABLE.has(round.state) && (
        <Button
          className={styles.touchAction}
          disabled={busy}
          onClick={() => handlers.onOutForDelivery(id)}
        >
          Send out for delivery
        </Button>
      )}
      {!round.voided && IS_DELIVERY(round) && COMPLETABLE.has(round.state) && (
        <>
          <Button
            className={styles.touchAction}
            disabled={busy}
            onClick={() => setConfirmingCompletion(true)}
          >
            Mark completed
          </Button>
          <CompletionConfirmDialog
            open={confirmingCompletion}
            round={round}
            busy={busy}
            onCancel={() => setConfirmingCompletion(false)}
            onConfirm={() => {
              setConfirmingCompletion(false)
              handlers.onCompleted(id)
            }}
          />
        </>
      )}
    </div>
  )
}
