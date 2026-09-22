import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { formatPrice } from '../features/menu/money'
import { ReportsPayloadError } from '../features/reports/reportsClient'
import { useVoidReport } from '../features/reports/useReports'
import { getSupabaseClient } from '../lib/supabase'

/**
 * The void log (spec 013 T009, `/dashboard/voids`; US3, FR-006): who voided
 * what, when, and why — read from the Phase 10 void overlay's own report
 * RPC (the audit trail remains the action ledger; the void report adds the
 * overlay join with the round's captured money, plan D3/D4). Owner and
 * branch_manager only; every other role deep-linking renders the denial,
 * and the RPC re-enforces reach regardless (Constitution IV).
 */

/** Branches of a restaurant, read through the table policies (FR-007). */
async function fetchBranchOptions(restaurantId: string) {
  const { data, error } = await getSupabaseClient()
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .order('name')
  if (error) {
    throw error
  }
  return data ?? []
}

interface Scope {
  restaurantId: string
  branchId: string
  label: string
}

export function VoidReportPage() {
  const { memberships, isPending, isError } = useAuthContext()

  const reportingRestaurantIds = useMemo(() => {
    const ids = new Set<string>()
    for (const membership of memberships) {
      if (membership.role === 'owner' || membership.role === 'branch_manager') {
        ids.add(membership.restaurant_id)
      }
    }
    return [...ids]
  }, [memberships])

  const isOwnerSomewhere = memberships.some((m) => m.role === 'owner')

  const branchesQuery = useQuery({
    queryKey: ['reports', 'void-branches', reportingRestaurantIds],
    queryFn: async () => {
      const all: Array<{ restaurantId: string; id: string; name: string }> = []
      for (const restaurantId of reportingRestaurantIds) {
        const rows = await fetchBranchOptions(restaurantId)
        for (const row of rows) {
          all.push({ restaurantId, id: row.id, name: row.name })
        }
      }
      return all
    },
    enabled: reportingRestaurantIds.length > 0,
  })

  const scopes = useMemo<Scope[]>(() => {
    const restaurantName = new Map<string, string>()
    for (const membership of memberships) {
      if (
        (membership.role === 'owner' || membership.role === 'branch_manager') &&
        !restaurantName.has(membership.restaurant_id)
      ) {
        restaurantName.set(membership.restaurant_id, membership.restaurant_name)
      }
    }
    const allowed = new Set<string>(
      memberships
        .filter((m) => m.role === 'branch_manager' && m.branch_id !== null)
        .map((m) => m.branch_id as string),
    )
    return (branchesQuery.data ?? [])
      .filter((row) => restaurantName.has(row.restaurantId))
      .filter((row) => isOwnerSomewhere || allowed.has(row.id))
      .map((row) => ({
        restaurantId: row.restaurantId,
        branchId: row.id,
        label: `${restaurantName.get(row.restaurantId) ?? ''} — ${row.name}`.replace(/^ — /, ''),
      }))
  }, [branchesQuery.data, memberships, isOwnerSomewhere])

  const [scopeIndex, setScopeIndex] = useState(0)
  const scope = scopes[scopeIndex] ?? null

  const voidQuery = useVoidReport({
    restaurantId: scope?.restaurantId ?? null,
    branchId: scope?.branchId ?? null,
  })

  if (isPending) {
    return (
      <section>
        <h1>Void log</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Void log</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  if (scopes.length === 0) {
    return (
      <section>
        <h1>Void log</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const rows = voidQuery.data
  const refusal = voidQuery.error instanceof ReportsPayloadError ? voidQuery.error : null

  return (
    <section aria-labelledby="void-log-heading">
      <h1 id="void-log-heading">Void log</h1>

      {scopes.length > 1 && (
        <label>
          Branch{' '}
          <select
            value={scopeIndex}
            onChange={(event) => setScopeIndex(Number(event.target.value))}
          >
            {scopes.map((s, index) => (
              <option key={s.branchId} value={index}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {voidQuery.isPending && <p>Loading the void log…</p>}

      {refusal !== null && (
        <p role="alert">
          {refusal.code === '42501'
            ? 'You do not have access to the void log for this branch.'
            : refusal.message}
        </p>
      )}

      {rows !== undefined && refusal === null && rows.length === 0 && (
        <p data-testid="void-log-empty">No voids recorded for this branch.</p>
      )}

      {rows !== undefined && refusal === null && rows.length > 0 && (
        <table data-testid="void-log-table">
          <thead>
            <tr>
              <th scope="col">Round</th>
              <th scope="col">Voided by</th>
              <th scope="col">When</th>
              <th scope="col">Reason</th>
              <th scope="col">Captured total</th>
              <th scope="col">Channel</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.round_id}>
                <td>{row.round_id.slice(0, 8)}</td>
                <td>{row.voided_by_name ?? 'Unknown'}</td>
                <td>{row.voided_at === null ? '—' : new Date(row.voided_at).toLocaleString()}</td>
                <td>{row.void_reason ?? '—'}</td>
                <td>{formatPrice(row.captured_total)}</td>
                <td>{row.session_type.replace('_', '-')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
