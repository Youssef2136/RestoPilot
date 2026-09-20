import { useState } from 'react'
import type { CartLine } from '../orderClient'
import { useSubmitRound } from '../useOrder'

/**
 * The submit control (spec 008 T016; contracts/order-client.md §4; US2).
 *
 * The double-submit guard's client half (FR-009): the button is disabled
 * while the cart is empty or the mutation is in flight — a second click
 * cannot produce a second submission. The server's unique-per-round writes
 * remain the authoritative guard.
 *
 * A refusal renders the server's message verbatim in a `role="alert"` and
 * the cart remains exactly as it was (FR-010 — this component never touches
 * the lines on failure). Success clears the cart (the mutation's own
 * onSuccess) and names the new round as feedback.
 */
export function SubmitControl({ lines }: { lines: CartLine[] }) {
  const submitRound = useSubmitRound()
  const [roundNumber, setRoundNumber] = useState<string | null>(null)

  const handleSubmit = () => {
    setRoundNumber(null)
    submitRound.mutate(lines, {
      onSuccess: (data) => {
        setRoundNumber(data.round.id)
      },
    })
  }

  const disabled = lines.length === 0 || submitRound.isPending

  return (
    <div>
      <button type="button" onClick={handleSubmit} disabled={disabled}>
        {submitRound.isPending ? 'Sending your order…' : 'Send order to the kitchen'}
      </button>
      {submitRound.isError && (
        <p role="alert">
          {submitRound.error instanceof Error
            ? submitRound.error.message
            : 'The order was refused.'}
        </p>
      )}
      {roundNumber !== null && (
        <p role="status">Your order is in — the kitchen has ticket {roundNumber}.</p>
      )}
    </div>
  )
}
