import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { BillPanel } from '../features/staffOps/components/BillPanel'
import { RoundCard } from '../features/staffOps/components/RoundCard'
import {
  useBranchRounds,
  useModifyRoundLine,
  useRoundTransition,
} from '../features/staffOps/useStaffOps'

/**
 * The cashier rounds dashboard (spec 009 T011/T013, `/dashboard/rounds`):
 * the selected branch's rounds grouped by state, with the per-state controls
 * and the selected session's bill. The page gate is role-derived — cashier,
 * manager or owner over the branch; kitchen is explicitly refused here (its
 * surface is `/dashboard/kitchen`) — while every action is re-authorized by
 * its RPC regardless (Constitution IV).
 *
 * Branch options come from the identity's memberships; the `?branch=`
 * deep-link pattern preselects one (the 007 sessions pattern).
 */

export function CashierRoundsPage() {
  const { memberships, isPending, isError } = useAuthContext()
  const [searchParams] = useSearchParams()
  const requestedBranchId = searchParams.get('branch')

  // One option per branch the identity reaches: owners carry the restaurant's
  // every branch (branch_id null on the membership), branch staff their own.
  const branchOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>()
    for (const membership of memberships) {
      const staffOpsCapable =
        membership.role === 'owner' ||
        membership.role === 'cashier' ||
        membership.role === 'branch_manager'
      if (!staffOpsCapable) {
        continue
      }
      if (membership.role === 'owner') {
        // Owner: every branch of the restaurant (resolved from siblings).
        for (const sibling of memberships) {
          if (
            sibling.restaurant_id === membership.restaurant_id &&
            sibling.branch_id !== null &&
            !seen.has(sibling.branch_id)
          ) {
            seen.set(sibling.branch_id, {
              id: sibling.branch_id,
              label: `${membership.restaurant_name} — ${sibling.branch_name ?? sibling.branch_id}`,
            })
          }
        }
      } else if (membership.branch_id !== null && !seen.has(membership.branch_id)) {
        seen.set(membership.branch_id, {
          id: membership.branch_id,
          label: `${membership.restaurant_name} — ${membership.branch_name ?? membership.branch_id}`,
        })
      }
    }
    return [...seen.values()]
  }, [memberships])

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const effectiveBranchId =
    selectedBranchId ??
    (requestedBranchId !== null && branchOptions.some((b) => b.id === requestedBranchId)
      ? requestedBranchId
      : (branchOptions[0]?.id ?? null))

  const roundsQuery = useBranchRounds(effectiveBranchId)
  const accept = useRoundTransition(effectiveBranchId, 'accept')
  const startPrep = useRoundTransition(effectiveBranchId, 'start')
  const ready = useRoundTransition(effectiveBranchId, 'ready')
  const lock = useRoundTransition(effectiveBranchId, 'lock')
  const outForDelivery = useRoundTransition(effectiveBranchId, 'out_for_delivery')
  const completed = useRoundTransition(effectiveBranchId, 'completed')
  const modify = useModifyRoundLine(effectiveBranchId)

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // The card's refusal text: whichever mutation last failed for this round,
  // rendered verbatim — no optimistic state anywhere (§5.4).
  const refusalFor = (roundId: string): string | null => {
    for (const mutation of [accept, startPrep, ready, lock, outForDelivery, completed, modify]) {
      if (mutation.isError && mutation.variables === roundId) {
        return mutation.error instanceof Error ? mutation.error.message : 'The action was refused.'
      }
    }
    return null
  }

  if (isPending) {
    return (
      <section>
        <h1>Rounds</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
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
  const groups: Array<[string, typeof rounds]> = [
    ['new', rounds.filter((r) => r.state === 'new')],
    ['in progress', rounds.filter((r) => r.state === 'accepted' || r.state === 'preparing')],
    ['ready', rounds.filter((r) => r.state === 'ready')],
    // The delivery machine (spec 010 §3): dispatched and delivered rounds are
    // terminal-adjacent groups of their own — dine-in never reaches them.
    ['out for delivery', rounds.filter((r) => r.state === 'out_for_delivery')],
    ['delivered', rounds.filter((r) => r.state === 'completed')],
    ['served', rounds.filter((r) => r.state === 'lock')],
  ]

  return (
    <section>
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

      {roundsQuery.isPending && <p>Loading the branch rounds…</p>}
      {roundsQuery.isError && (
        <p role="alert">The rounds could not be loaded. Reload the page and try again.</p>
      )}

      {groups.map(([label, groupRounds]) => (
        <div key={label}>
          <h2>{label}</h2>
          {groupRounds.length === 0 ? (
            <p>Nothing here.</p>
          ) : (
            groupRounds.map((round) => (
              <RoundCard
                key={round.round_id}
                round={round}
                busy={
                  accept.isPending ||
                  startPrep.isPending ||
                  ready.isPending ||
                  lock.isPending ||
                  outForDelivery.isPending ||
                  completed.isPending ||
                  modify.isPending
                }
                refusal={refusalFor(round.round_id)}
                billSelected={selectedSessionId === round.session_id}
                onSelectForBill={() =>
                  setSelectedSessionId((current) =>
                    current === round.session_id ? null : round.session_id,
                  )
                }
                onAccept={() => accept.mutate(round.round_id)}
                onStart={() => startPrep.mutate(round.round_id)}
                onReady={() => ready.mutate(round.round_id)}
                onLock={() => lock.mutate(round.round_id)}
                onOutForDelivery={() => outForDelivery.mutate(round.round_id)}
                onCompleted={() => completed.mutate(round.round_id)}
                onModify={(itemId, action, quantity) =>
                  modify.mutate({ roundId: round.round_id, itemId, action, quantity })
                }
              />
            ))
          )}
        </div>
      ))}

      {selectedSessionId !== null && <BillPanel sessionId={selectedSessionId} />}
    </section>
  )
}
