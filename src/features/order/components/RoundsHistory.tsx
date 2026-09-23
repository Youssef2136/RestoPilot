import { formatPrice } from '../../menu/money'
import { useSessionRounds } from '../useOrder'

/**
 * The rounds history (spec 008 T019; contracts/order-client.md §4; US3,
 * FR-011): the session's rounds with items, extras, the CAPTURED prices,
 * and the captured tax lines — read from the server on mount (the reload
 * proof, SC-005's server half) and invalidated by a new submission.
 *
 * Every money figure here comes from the round's own columns and rows —
 * the captured state, never a recomputation (Risk 6; Constitution II).
 */
/**
 * Customer-facing wording for a round's lifecycle state (the §8.2 machine,
 * 009): the customer sees where their order stands, not the raw column.
 * `new` is "Sent to kitchen" — the submission is the customer's last act;
 * `lock` is "Served" — the cashier's close of service.
 */
const ROUND_STATE_LABEL: Record<string, string> = {
  new: 'Sent to kitchen',
  accepted: 'Accepted',
  preparing: 'Being prepared',
  ready: 'Ready',
  lock: 'Served',
}

export function RoundsHistory() {
  const roundsQuery = useSessionRounds()

  if (roundsQuery.isPending) {
    return null
  }
  if (roundsQuery.isError || !roundsQuery.data) {
    // The history is supplementary: the menu page's recovery rule already
    // handles the unavailable-session case; any other read failure surfaces
    // as retryable text without disturbing the cart.
    return (
      <section aria-label="Your rounds">
        <h2>Your rounds</h2>
        <p role="alert">{roundsQuery.error?.message ?? 'The rounds could not be loaded.'}</p>
      </section>
    )
  }

  const rounds = roundsQuery.data.rounds

  return (
    <section aria-label="Your rounds">
      <h2>Your rounds</h2>
      {rounds.length === 0 && <p>No rounds yet.</p>}
      <ul>
        {rounds.map((round, index) => (
          <li key={round.id}>
            <p>
              <strong>
                Round {index + 1} — {new Date(round.created_at).toLocaleTimeString()}
              </strong>{' '}
              — {ROUND_STATE_LABEL[round.state] ?? round.state}
            </p>
            <ul>
              {round.items.map((item) => (
                <li key={item.id}>
                  {item.name} × {item.quantity} — {formatPrice(item.unit_price)}
                  {item.extras.length > 0 && (
                    <ul>
                      {item.extras.map((extra) => (
                        <li key={extra.extra_id}>
                          {extra.name} — {formatPrice(extra.price_adjustment)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <p>
              Subtotal {formatPrice(round.subtotal)}
              {round.tax_lines.length > 0 && (
                <>
                  {' '}
                  {round.tax_lines.map((line) => {
                    const taxLine = line as { name?: string; amount?: string }
                    return `${taxLine.name ?? 'Tax'} ${taxLine.amount ?? ''}`.trim()
                  })}
                </>
              )}{' '}
              — Total {formatPrice(round.tax_total)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
