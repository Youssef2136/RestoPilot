import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { useRealtimeInvalidation } from '../features/realtime/useRealtimeInvalidation'
import { TicketCard } from '../features/staffOps/components/TicketCard'
import {
  kitchenQueueKey,
  useKitchenQueue,
  useRoundTransition,
} from '../features/staffOps/useStaffOps'

/**
 * The kitchen dashboard (spec 009 T014/T015, `/dashboard/kitchen`): the
 * selected branch's non-locked tickets in three columns — new (incoming),
 * preparing, ready — with start/ready controls per state (a `new` ticket
 * needs the cashier's accept first, per US3's clarification; kitchen acts
 * from `accepted`). No money text anywhere (FR-010). Access is role-derived
 * (kitchen/cashier/manager/owner) and every action re-authorized by its RPC
 * (Constitution IV).
 */
export function KitchenDashboardPage() {
  const { memberships, isPending, isError } = useAuthContext()
  const [searchParams] = useSearchParams()
  const requestedBranchId = searchParams.get('branch')

  const branchOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>()
    for (const membership of memberships) {
      if (membership.role === 'owner') {
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

  // The live queue (spec 012 US2, FR-006): new tickets and ticket state
  // changes invalidate the queue — the money-free, channel-blind contract
  // is unchanged (the events invalidate, the READ decides what may render).
  useRealtimeInvalidation({
    scopeValue: effectiveBranchId,
    table: 'kitchen_tickets',
    invalidate: (qc) => qc.invalidateQueries({ queryKey: kitchenQueueKey(effectiveBranchId) }),
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

  const refusalFor = (roundId: string): string | null => {
    for (const mutation of [start, ready]) {
      if (mutation.isError && mutation.variables === roundId) {
        return mutation.error instanceof Error ? mutation.error.message : 'The action was refused.'
      }
    }
    return null
  }

  if (isPending) {
    return (
      <section>
        <h1>Kitchen</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
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

  const tickets = queueQuery.data ?? []
  const columns: Array<[string, typeof tickets]> = [
    ['new', tickets.filter((t) => t.state === 'new')],
    ['preparing', tickets.filter((t) => t.state === 'accepted' || t.state === 'preparing')],
    ['ready', tickets.filter((t) => t.state === 'ready')],
  ]

  return (
    <section>
      <h1>Kitchen</h1>

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

      {queueQuery.isPending && <p>Loading the kitchen queue…</p>}
      {queueQuery.isError && (
        <p role="alert">The queue could not be loaded. Reload the page and try again.</p>
      )}

      {columns.map(([label, columnTickets]) => (
        <div key={label} data-kitchen-column={label}>
          <h2>{label}</h2>
          {columnTickets.length === 0 ? (
            <p>Nothing here.</p>
          ) : (
            columnTickets.map((ticket) => (
              <TicketCard
                key={ticket.ticket_id}
                ticket={ticket}
                busy={start.isPending || ready.isPending}
                refusal={refusalFor(ticket.round_id)}
                onStart={() => start.mutate(ticket.round_id)}
                onReady={() => ready.mutate(ticket.round_id)}
              />
            ))
          )}
        </div>
      ))}
    </section>
  )
}
