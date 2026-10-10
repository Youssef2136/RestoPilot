import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { OfflineSurface, Skeleton, useOfflineState } from '../components/state'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { useNewRoundCue } from '../features/realtime/useNewRoundCue'
import { useRealtimeInvalidation } from '../features/realtime/useRealtimeInvalidation'
import { BillPanel } from '../features/staffOps/components/BillPanel'
import { ChannelFilter } from '../features/staffOps/components/ChannelFilter'
import { LiveBadge } from '../features/staffOps/components/LiveBadge'
import { NewRoundCueBanner } from '../features/staffOps/components/NewRoundCueBanner'
import { ReconnectingBanner } from '../features/staffOps/components/ReconnectingBanner'
import { RoundsBoard } from '../features/staffOps/components/RoundsBoard'
import type { ChannelFilterValue, RefusalAttempt } from '../features/staffOps/roundGroups'
import { matchesChannel, pickRefusal } from '../features/staffOps/roundGroups'
import styles from '../features/staffOps/staffOps.surfaces.module.css'
import type { TransitionHandlers } from '../features/staffOps/components/TransitionActions'
import {
  branchRoundsKey,
  kitchenQueueKey,
  useBranchRounds,
  useModifyRoundLine,
  useRoundTransition,
  useStaffBranchOptions,
  useVoidRound,
} from '../features/staffOps/useStaffOps'

/**
 * The cashier rounds dashboard (spec 009 T011/T013, `/dashboard/rounds`;
 * specs/029 FR-01…FR-10): the selected branch's rounds on the BOARD —
 * groups as labelled regions with counts, per-state controls, the cued new
 * round marked in place — with the freshness badge, the reconnecting banner,
 * the polite refresh announcement, and the selected session's bill. The page
 * gate is role-derived — cashier, manager or owner over the branch; kitchen
 * is explicitly refused here (its surface is `/dashboard/kitchen`) — while
 * every action is re-authorized by its RPC regardless (Constitution IV).
 *
 * Branch options come from the identity's memberships; the `?branch=`
 * deep-link pattern preselects one (the 007 sessions pattern).
 */

type RealtimeHealth = 'connected' | 'reconnecting'

export function CashierRoundsPage() {
  const { isPending, isError } = useAuthContext()
  const [searchParams] = useSearchParams()
  const requestedBranchId = searchParams.get('branch')

  // One option per branch the identity reaches: branch-scoped roles their
  // memberships, restaurant-wide roles (owners) every branch through the
  // table policies — including branches the owner created through the UI,
  // which carry no membership row at all (spec 017 T003 discovery).
  const {
    options: branchOptions,
    isPending: optionsPending,
    isError: optionsError,
  } = useStaffBranchOptions({ roles: ['cashier', 'branch_manager'] })

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const effectiveBranchId =
    selectedBranchId ??
    (requestedBranchId !== null && branchOptions.some((b) => b.id === requestedBranchId)
      ? requestedBranchId
      : (branchOptions[0]?.id ?? null))

  // Realtime health (specs/029 FR-07, D2): the binding's status callback —
  // unused by any surface until this phase — reports the transport;
  // SUBSCRIBED clears the banner (its recovery refetch reconciles the gap).
  // The handler is stable so the subscription never re-wires per render.
  const [realtimeHealth, setRealtimeHealth] = useState<RealtimeHealth>('connected')
  const handleRealtimeStatus = useCallback(
    (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => {
      setRealtimeHealth(status === 'SUBSCRIBED' ? 'connected' : 'reconnecting')
    },
    [],
  )

  // The live dashboard (spec 012 US1, FR-005): any committed write to this
  // branch's rounds (customer submissions, staff transitions, modifications,
  // voids) invalidates the branch reads — the next render refetches the
  // authoritative truth through the unchanged RPC reads. The bill keys are
  // ALL invalidated (the payload carries every selected session's rounds).
  useRealtimeInvalidation({
    scopeValue: effectiveBranchId,
    table: 'rounds',
    invalidate: (qc) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: branchRoundsKey(effectiveBranchId) }),
        qc.invalidateQueries({ queryKey: kitchenQueueKey(effectiveBranchId) }),
        qc.invalidateQueries({ queryKey: ['staffOps', 'sessionBill'] }),
      ]),
    onStatus: handleRealtimeStatus,
  })

  const roundsQuery = useBranchRounds(effectiveBranchId)
  const accept = useRoundTransition(effectiveBranchId, 'accept')
  const startPrep = useRoundTransition(effectiveBranchId, 'start')
  const ready = useRoundTransition(effectiveBranchId, 'ready')
  const lock = useRoundTransition(effectiveBranchId, 'lock')
  const outForDelivery = useRoundTransition(effectiveBranchId, 'out_for_delivery')
  const completed = useRoundTransition(effectiveBranchId, 'completed')
  const modify = useModifyRoundLine(effectiveBranchId)
  const voidRound = useVoidRound(effectiveBranchId)

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  // specs/031 FR-05 (D2): the channel filter — presentation over the read
  // set; 'all' (the default) renders exactly the unfiltered board.
  const [channelFilter, setChannelFilter] = useState<ChannelFilterValue>('all')

  // The new-round cue (spec 012 US4; specs/029 FR-08, D3): the cued round's
  // card is marked in place and scrolled into view — presentation only,
  // never a focus steal (a refetch never moves focus).
  const { cue, clearCue } = useNewRoundCue(effectiveBranchId)
  useEffect(() => {
    if (cue === null) {
      return
    }
    document
      .querySelector(`article[data-round-id="${cue.roundId}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cue])

  // The refresh announcement (FR-07): ONE polite region; it speaks when a
  // fetch RESOLVES (coalesced upstream by the binding), never per event.
  const [announcement, setAnnouncement] = useState('')
  const announcedAtRef = useRef(0)
  const dataUpdatedAt = roundsQuery.dataUpdatedAt
  useEffect(() => {
    if (dataUpdatedAt === 0 || dataUpdatedAt === announcedAtRef.current) {
      return
    }
    announcedAtRef.current = dataUpdatedAt
    const count = roundsQuery.data?.length ?? 0
    setAnnouncement(`The rounds board refreshed — ${count} rounds on the board.`)
  }, [dataUpdatedAt, roundsQuery.data])

  // The card's refusal text (FR-09): whichever mutation last failed for this
  // round, routed by the extracted picker — rendered verbatim, no optimistic
  // state anywhere (§5.4).
  const attempts: RefusalAttempt[] = [
    accept,
    startPrep,
    ready,
    lock,
    outForDelivery,
    completed,
    modify,
    voidRound,
  ]
  const refusalFor = (roundId: string): string | null => pickRefusal(roundId, attempts)

  // Spec 037 FR-07 (clarified): offline gates the whole action layer —
  // last-known data stays readable, actions disable with the reason carried
  // by the shell's OfflineBanner; reconnect reconciles via SUBSCRIBED.
  const { offline } = useOfflineState()

  const busy =
    accept.isPending ||
    startPrep.isPending ||
    ready.isPending ||
    lock.isPending ||
    outForDelivery.isPending ||
    completed.isPending ||
    modify.isPending ||
    voidRound.isPending ||
    offline

  const handlers: TransitionHandlers = {
    onAccept: (roundId) => accept.mutate(roundId),
    onStart: (roundId) => startPrep.mutate(roundId),
    onReady: (roundId) => ready.mutate(roundId),
    onLock: (roundId) => lock.mutate(roundId),
    onOutForDelivery: (roundId) => outForDelivery.mutate(roundId),
    onCompleted: (roundId) => completed.mutate(roundId),
  }

  if (isPending || optionsPending) {
    return (
      <section>
        <h1>Rounds</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError || optionsError) {
    return (
      <section>
        <h1>Rounds</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  if (branchOptions.length === 0) {
    return (
      <section>
        <h1>Rounds</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const rounds = roundsQuery.data ?? []
  const filteredRounds = rounds.filter((round) => matchesChannel(round, channelFilter))
  const staleError = roundsQuery.isError && roundsQuery.data !== undefined

  return (
    <section data-density="compact">
      <h1>Rounds</h1>

      {branchOptions.length > 1 && (
        <div>
          <label htmlFor="rounds-branch">Branch</label>
          <select
            id="rounds-branch"
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

      <header className={styles.boardToolbar}>
        <LiveBadge updatedAt={roundsQuery.dataUpdatedAt} fetching={roundsQuery.isFetching} />
      </header>

      <OfflineSurface actionNoun="floor" banner={false}>
        <ReconnectingBanner
          reconnecting={realtimeHealth === 'reconnecting'}
          staleError={staleError}
          onRetry={() => void roundsQuery.refetch()}
        />

        <ChannelFilter value={channelFilter} onChange={setChannelFilter} />

        {roundsQuery.isPending && (
          /* FR-02: the board is a network read past the ~300 ms threshold —
             placeholder text rows sized like the round cards' titles */
          <Skeleton testId="rounds-skeleton" variant="text" lines={3} />
        )}
        {roundsQuery.isError && roundsQuery.data === undefined && (
          <p role="alert">The rounds could not be loaded. Reload the page and try again.</p>
        )}

        <RoundsBoard
          rounds={filteredRounds}
          busy={busy}
          refusalFor={refusalFor}
          cuedRoundId={cue?.roundId ?? null}
          billSelectedSessionId={selectedSessionId}
          onSelectForBill={(round) =>
            setSelectedSessionId((current) =>
              current === round.session_id ? null : round.session_id,
            )
          }
          onModify={(round, itemId, action, quantity) =>
            modify.mutate({ roundId: round.round_id, itemId, action, quantity })
          }
          onVoid={(round, reason) => voidRound.mutate({ roundId: round.round_id, reason })}
          handlers={handlers}
        />
      </OfflineSurface>

      <p aria-live="polite" className={styles.srOnly}>
        {announcement}
      </p>

      <NewRoundCueBanner cue={cue} onDismiss={clearCue} />

      {selectedSessionId !== null && <BillPanel sessionId={selectedSessionId} />}
    </section>
  )
}
