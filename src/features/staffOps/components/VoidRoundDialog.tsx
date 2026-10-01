import { useId, useState } from 'react'
import { ConfirmDialog } from '../../../components/ui'
import styles from '../staffOps.surfaces.module.css'
import type { BranchRound } from '../staffOpsClient'

/**
 * The two-step void (spec 011 FR-004; specs/029 FR-04, D4): the names are
 * the E2E contract — 'Void round' opens, 'Confirm void' confirms, 'Cancel'
 * cancels, the input is labelled 'Void reason' — and the confirm stays
 * disabled until a reason exists (client feedback; the server re-validates
 * in its documented order regardless). The dialog states the consequence:
 * the round leaves the bill at its channel boundary, the void is NOT
 * reversible (no undo — the audit trail keeps the record with the actor
 * and the reason), and other rounds are unaffected.
 */
export function VoidRoundDialog({
  open,
  round,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  round: BranchRound
  busy: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const reasonOk = reason.trim().length > 0

  const submit = () => {
    if (!reasonOk || busy) return
    onConfirm(reason.trim())
    setReason('')
  }

  return (
    <ConfirmDialog
      open={open}
      onCancel={() => {
        setReason('')
        onCancel()
      }}
      onConfirm={submit}
      title={`Void ${round.table_label ?? 'round'}`.trim()}
      confirmLabel="Confirm void"
      cancelLabel="Cancel"
      confirmDisabled={!reasonOk}
      busy={busy}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <p className={styles.modifyHint}>
          Voiding removes this round from the bill at its channel boundary and cannot be undone —
          the audit trail keeps the record with the reason and the acting staff member. Other rounds
          stay on the bill.
        </p>
        <label htmlFor={reasonId}>Void reason</label>
        <input
          id={reasonId}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          placeholder="Why is this round being voided?"
        />
      </form>
    </ConfirmDialog>
  )
}
