import { ConfirmDialog } from '../../../components/ui'
import type { BranchRound } from '../staffOpsClient'

/**
 * CompletionConfirmDialog (specs/031 FR-03, D3): `Mark completed` is
 * TERMINAL — "nothing fires after" — so the act is two-step. The card's
 * pinned 'Mark completed' button opens THIS dialog; the copy names the
 * consequence and the boundary in plain terms before the confirm. Dispatch
 * ('Send out for delivery') deliberately stays one-tap: it is significant
 * but recoverable by contract (the void remains legal at and beyond
 * out_for_delivery) — and the four-transition E2E journey clicks it
 * directly. Refusals are NOT rendered here: the mutation still fails into
 * the card's own refusal slot (the existing routing), so the dialog stays
 * open-free and the server's words land where refusals always land.
 */
export function CompletionConfirmDialog({
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
  onConfirm: () => void
}) {
  return (
    <ConfirmDialog
      open={open}
      busy={busy}
      onCancel={onCancel}
      title="Mark completed"
      confirmLabel={busy ? 'Completing…' : 'Complete the delivery'}
      cancelLabel="Not yet"
      onConfirm={onConfirm}
    >
      <p>
        Completing this delivery closes it for good — no further transitions or voids are possible.
        The round leaves the working board for good.
      </p>
      {round.delivery_address !== null && <p>Deliver to: {round.delivery_address}</p>}
    </ConfirmDialog>
  )
}
