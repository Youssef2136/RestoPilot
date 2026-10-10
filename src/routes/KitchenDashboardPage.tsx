import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EmptyState, OfflineSurface, useOfflineState } from '../components/state'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { useRealtimeInvalidation } from '../features/realtime/useRealtimeInvalidation'
import { KitchenBoard } from '../features/staffOps/components/KitchenBoard'
import { LiveBadge } from '../features/staffOps/components/LiveBadge'
import { ReconnectingBanner } from '../features/staffOps/components/ReconnectingBanner'
import kitchenStyles from '../features/staffOps/kitchen.surfaces.module.css'
import {
  kitchenQueueKey,
  useKitchenQueue,
  useRoundTransition,
  useStaffBranchOptions,
} from '../features/staffOps/useStaffOps'

/**
 * The kitchen dashboard (spec 009 T014/T015, `/dashboard/kitchen`; specs/
 * 030 FR-01…FR-09): the KDS board — three columns with counts and real
 * headings, tickets at display scale, the honest age — with the freshness
 * badge, the reconnecting banner, and the polite refresh announcement.
 * Exactly two actions exist ('Start preparation', 'Mark ready' — the
 * pinned names); a `new` ticket awaits the cashier (D3: visible, not
 * actionable — the accept control does not exist here). No money text
 * anywhere (FR-010 — the payload carries none and the surface must not
 * invent any). Access is role-derived (kitchen/cashier/manager/owner) and
 * every action re-authorized by its RPC (Constitution IV).
 */

type RealtimeHealth = 'connected' | 'reconnecting'

const ARRIVAL_HIGHLIGHT_MS = 3_000

export function KitchenDashboardPage() {
  const { isPending, isError } = useAuthContext()
  const [searchParams] = useSearchParams()
  const requestedBranchId = searchParams.get('branch')

  // Same posture as the rounds dashboard: branch-scoped roles their
  // memberships, owners every branch through the table policies (a UI-created
  // owner holds no branch membership rows — spec 017 T003 discovery).
  const {
    options: branchOptions,
    isPending: optionsPending,
    isError: optionsError,
  } = useStaffBranchOptions()

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const effectiveBranchId =
    selectedBranchId ??
    (requestedBranchId !== null && branchOptions.some((b) => b.id === requestedBranchId)
      ? requestedBranchId
      : (branchOptions[0]?.id ?? null))

  // Realtime health (specs/030 FR-05): the ticket binding reports the
  // transport; SUBSCRIBED clears the banner (its recovery refetch reconciles
  // the gap). The handler is stable so the subscription never re-wires.
  const [realtimeHealth, setRealtimeHealth] = useState<RealtimeHealth>('connected')
  const handleTicketStatus = useCallback(
    (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => {
      setRealtimeHealth(status === 'SUBSCRIBED' ? 'connected' : 'reconnecting')
    },
    [],
  )

  // The live queue (spec 012 US2, FR-006): new tickets and ticket state
  // changes invalidate the queue — the money-free, channel-blind contract
  // is unchanged (the events invalidate, the READ decides what may render).
  useRealtimeInvalidation({
    scopeValue: effectiveBranchId,
    table: 'kitchen_tickets',
    invalidate: (qc) => qc.invalidateQueries({ queryKey: kitchenQueueKey(effectiveBranchId) }),
    onStatus: handleTicketStatus,
  })
  // A newly submitted round creates the ticket — `rounds` events keep the
  // queue live for the incoming column too.
  useRealtimeInvalidation({
    scopeValue: effectiveBranchId,
    table: 'rounds',
    invalidate: (qc) => qc.invalidateQueries({ queryKey: kitchenQueueKey(effectiveBranchId) }),
  })

  const queueQuery = useKitchenQueue(effectiveBranchId)
  const start = useRoundTransition(effectiveBranchId, 'start')
  const ready = useRoundTransition(effectiveBranchId, 'ready')
  // Spec 037 FR-07 (clarified): offline gates the board's action layer —
  // the last-known board stays readable; the ReconnectingBanner carries the
  // copy; reconnect reconciles via SUBSCRIBED.
  const { offline } = useOfflineState()

  const refusalFor = (roundId: string): string | null => {
    for (const mutation of [start, ready]) {
      if (mutation.isError && mutation.variables === roundId) {
        return mutation.error instanceof Error ? mutation.error.message : 'The action was refused.'
      }
    }
    return null
  }

  // The one-shot arrival highlight (D1): track ticket ids the board has
  // already shown; brand-new ids get the entry treatment for a beat, then
  // the id joins the seen set — an unrelated refetch never re-arms it.
  const [arrivedTicketIds, setArrivedTicketIds] = useState<ReadonlySet<string>>(new Set())
  const seenTicketIdsRef = useRef<ReadonlySet<string>>(new Set())
  const tickets = useMemo(() => queueQuery.data ?? [], [queueQuery.data])
  useEffect(() => {
    const unseen = tickets
      .map((ticket) => ticket.ticket_id)
      .filter((id) => !seenTicketIdsRef.current.has(id))
    if (unseen.length === 0) {
      return
    }
    seenTicketIdsRef.current = new Set([...seenTicketIdsRef.current, ...unseen])
    setArrivedTicketIds(new Set(unseen))
    const timer = setTimeout(() => setArrivedTicketIds(new Set()), ARRIVAL_HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [tickets])

  // The refresh announcement (the 029 pattern): ONE polite region, speaks
  // when a fetch RESOLVES (coalesced upstream), never per event.
  const [announcement, setAnnouncement] = useState('')
  const announcedAtRef = useRef(0)
  const dataUpdatedAt = queueQuery.dataUpdatedAt
  useEffect(() => {
    if (dataUpdatedAt === 0 || dataUpdatedAt === announcedAtRef.current) {
      return
    }
    announcedAtRef.current = dataUpdatedAt
    setAnnouncement(`The kitchen queue refreshed — ${tickets.length} tickets on the board.`)
  }, [dataUpdatedAt, tickets.length])

  if (isPending || optionsPending) {
    return (
      <section>
        <h1>Kitchen</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError || optionsError) {
    return (
      <section>
        <h1>Kitchen</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  if (branchOptions.length === 0) {
    return (
      <section>
        <h1>Kitchen</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const busy = start.isPending || ready.isPending || offline
  const staleError = queueQuery.isError && queueQuery.data !== undefined

  return (
    <section>
      <h1>Kitchen</h1>

      <div className={kitchenStyles.boardToolbar}>
        <LiveBadge updatedAt={queueQuery.dataUpdatedAt} fetching={queueQuery.isFetching} />
        {branchOptions.length > 1 && (
          <div>
            <label htmlFor="kitchen-branch">Branch</label>
            <select
              id="kitchen-branch"
              value={effectiveBranchId ?? ''}
              onChange={(event) => setSelectedBranchId(event.target.value)}
            >
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <OfflineSurface actionNoun="kitchen" banner={false}>
        <ReconnectingBanner
          reconnecting={realtimeHealth === 'reconnecting'}
          staleError={staleError}
          onRetry={() => void queueQuery.refetch()}
        />

        {queueQuery.isError && queueQuery.data === undefined && (
          <p role="alert">The queue could not be loaded. Reload the page and try again.</p>
        )}

        {tickets.length === 0 && !queueQuery.isPending && (
          <EmptyState testId="kitchen-board-empty" title="The kitchen queue is empty">
            Incoming, in preparation and ready columns are all clear.
          </EmptyState>
        )}

        <KitchenBoard
          tickets={tickets}
          busy={busy}
          loading={queueQuery.isPending && tickets.length === 0}
          refusalFor={refusalFor}
          arrivedTicketIds={arrivedTicketIds}
          onStart={(roundId) => start.mutate(roundId)}
          onReady={(roundId) => ready.mutate(roundId)}
        />
      </OfflineSurface>

      <p aria-live="polite" className={kitchenStyles.srOnly ?? undefined}>
        {announcement}
      </p>
    </section>
  )
}
