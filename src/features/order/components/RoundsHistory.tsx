import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSessionRounds, sessionRoundsKey } from '../useOrder'
import { roundStateLabel } from '../roundStateLabels'
import { sessionTokenScope } from '../../session/useSession'
import { TotalsPanel } from '../../../components/money/TotalsPanel'
import styles from './order.surfaces.module.css'

/**
 * The rounds history (spec 025 T006/T007; FR-06/FR-09): the session's rounds
 * with items, extras, and the CAPTURED money — read from the server on mount
 * and invalidated by a new submission, on the unchanged 10 s poll (the
 * customer has no realtime subscription; the poll IS their live status).
 *
 * Every money figure renders through TotalsPanel/MoneyText from the round's
 * own columns and rows — the captured state, never a recomputation.
 *
 * Freshness (Q3): an "Updated Xs ago" line ticks each second, and the manual
 * refresh button invalidates the rounds read immediately. While a fetch is
 * in flight the button marks itself `data-stale` (FR-09's honest degradation
 * — the last good data stays on screen).
 */

function RefreshAffordance({
  updatedAt,
  isFetching,
  onRefresh,
}: {
  updatedAt: number
  isFetching: boolean
  onRefresh: () => void
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000))

  return (
    <p className={styles.refreshMeta}>
      Updated {seconds}s ago{' '}
      <button
        type="button"
        className={styles.smallButton}
        data-stale={isFetching || undefined}
        onClick={onRefresh}
      >
        Refresh
      </button>
    </p>
  )
}

export function RoundsHistory() {
  const roundsQuery = useSessionRounds()
  const queryClient = useQueryClient()
  const token = sessionTokenScope()
  const refetchRounds = () =>
    void queryClient.invalidateQueries({ queryKey: sessionRoundsKey(token) })

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
      <div className={styles.historyHeader}>
        <h2>Your rounds</h2>
        <RefreshAffordance
          updatedAt={roundsQuery.dataUpdatedAt}
          isFetching={roundsQuery.isFetching}
          onRefresh={refetchRounds}
        />
      </div>
      {rounds.length === 0 && <p>No rounds yet.</p>}
      <ul className={styles.roundList}>
        {rounds.map((round, index) => (
          <li key={round.id} className={styles.roundCard}>
            <p className={styles.roundHeading}>
              <strong>
                Round {index + 1} — {new Date(round.created_at).toLocaleTimeString()}
              </strong>{' '}
              <span className={styles.stateChip}>{roundStateLabel(round.state)}</span>
            </p>
            <ul className={styles.itemListCompact}>
              {round.items.map((item) => (
                <li key={item.id}>
                  {item.name} × {item.quantity}
                  {item.extras.length > 0 && (
                    <ul>
                      {item.extras.map((extra) => (
                        <li key={extra.extra_id}>{extra.name}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <TotalsPanel
              totals={{
                subtotal: round.subtotal,
                taxLines: round.tax_lines.map((line) => {
                  const taxLine = line as { name?: string; amount?: string }
                  return { name: taxLine.name ?? 'Tax', amount: taxLine.amount ?? '' }
                }),
                total: round.tax_total,
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
