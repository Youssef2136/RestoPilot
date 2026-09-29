import { useState } from 'react'
import type { CartLine } from '../orderClient'
import { useSubmitRound } from '../useOrder'
import styles from './order.surfaces.module.css'

/**
 * SubmitBar (spec 025 T005; FR-05): the submission control. The client half
 * of the double-submit guard is the disabled/busy state (empty cart or in
 * flight); the server's guard remains authoritative. Success renders the
 * round's ticket in a `status` region (pinned wording family "your order is
 * in — the kitchen has ticket …"); a refusal renders the server's message
 * VERBATIM in an `alert` region and this component never touches the lines —
 * the preserved-cart rule.
 */
export function SubmitBar({ lines }: { lines: CartLine[] }) {
  const submitRound = useSubmitRound()
  const [roundTicket, setRoundTicket] = useState<string | null>(null)

  const disabled = lines.length === 0 || submitRound.isPending

  return (
    <div className={styles.submitBar}>
      <button
        type="button"
        className={styles.submitButton}
        onClick={handleSubmit}
        disabled={disabled}
      >
        {submitRound.isPending ? 'Sending your order…' : 'Send order to the kitchen'}
      </button>
      {submitRound.isError && (
        <p role="alert">
          {submitRound.error instanceof Error
            ? submitRound.error.message
            : 'The order was refused.'}
        </p>
      )}
      {roundTicket !== null && (
        <p role="status">Your order is in — the kitchen has ticket {roundTicket}.</p>
      )}
    </div>
  )

  function handleSubmit() {
    setRoundTicket(null)
    submitRound.mutate(lines, {
      onSuccess: (data) => {
        setRoundTicket(data.round.id)
      },
    })
  }
}
