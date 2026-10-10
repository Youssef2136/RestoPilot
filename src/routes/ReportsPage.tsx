import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Skeleton } from '../components/state'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { formatPrice } from '../features/menu/money'
import { ReportsPayloadError, type ReportPeriod } from '../features/reports/reportsClient'
import { useSalesReport } from '../features/reports/useReports'
import { barShare, comparisonPeriodSentence } from '../features/reports/reportFormat'
import styles from '../features/reports/reports.surfaces.module.css'
import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'

/**
 * Branch reports (spec 013 T007/T008, `/dashboard/reports`; US1/US2):
 * per-branch per-period aggregates — rounds submitted, voids, net money,
 * channel breakdown, best-sellers — plus the owner's comparison view (one
 * call per branch, plan D2). Managers get the same surface permanently
 * scoped to their branch(es): no cross-branch picker. Cashiers and kitchen
 * deep-linking render the denial (US4); every figure is re-authorized by
 * the RPC regardless. All money renders through the formatter — no client
 * arithmetic (Constitution II).
 */

const PERIODS: Array<{ value: ReportPeriod; label: string }> = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

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

export function ReportsPage() {
  const { memberships, isPending, isError } = useAuthContext()

  // The reporting domain is owner/manager (spec FR-005/FR-007). The SCOPES
  // come from the identity's memberships; branch NAMES come from the
  // policy-guarded branches read (the dashboard's pattern — the membership
  // list alone cannot label the owner's sibling branches). Managers keep
  // exactly their own branches; owners every branch of their restaurant.
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
    queryKey: ['reports', 'branches', reportingRestaurantIds],
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
    // A manager's own branch ids; an owner's every branch of their restaurants.
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
  const [period, setPeriod] = useState<ReportPeriod>('day')
  const [anchorDate, setAnchorDate] = useState(() => new Date().toISOString().slice(0, 10))

  const scope = scopes[scopeIndex] ?? null

  const reportQuery = useSalesReport({
    restaurantId: scope?.restaurantId ?? null,
    branchId: scope?.branchId ?? null,
    period,
    anchorDate,
  })

  if (isPending) {
    return (
      <section>
        <h1>Reports</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Reports</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  if (scopes.length === 0) {
    return (
      <section>
        <h1>Reports</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const report = reportQuery.data
  const refusal = reportQuery.error instanceof ReportsPayloadError ? reportQuery.error : null

  // The bars are presentation shares of the visible list's max (D4) — no
  // money arithmetic, no charting dependency, aria-hidden next to real text.
  const maxChannelRounds =
    report !== undefined ? Math.max(0, ...report.channels.map((c) => c.rounds)) : 0
  const maxItemQuantity =
    report !== undefined ? Math.max(0, ...report.best_sellers.map((item) => item.quantity)) : 0

  return (
    <section aria-labelledby="reports-heading">
      <h1 id="reports-heading">Reports</h1>

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

      <fieldset>
        <legend>Period</legend>
        {PERIODS.map((p) => (
          <label key={p.value}>
            <input
              type="radio"
              name="period"
              value={p.value}
              checked={period === p.value}
              onChange={() => setPeriod(p.value)}
            />{' '}
            {p.label}
          </label>
        ))}
      </fieldset>

      <label>
        Anchor date{' '}
        <input
          type="date"
          value={anchorDate}
          onChange={(event) => {
            if (event.target.value !== '') {
              setAnchorDate(event.target.value)
            }
          }}
        />
      </label>

      {reportQuery.isPending && (
        /* FR-02: the report is a slow aggregate read — placeholder text rows
           sized like the summary figures' content */
        <Skeleton testId="report-skeleton" variant="text" lines={5} />
      )}

      {refusal !== null && (
        <p role="alert">
          {refusal.code === '42501'
            ? 'You do not have access to reports for this branch.'
            : refusal.message}
        </p>
      )}

      {report !== undefined && refusal === null && (
        <>
          <h2>
            {period === 'day' ? 'Day' : period === 'week' ? 'Week' : 'Month'} of{' '}
            {report.from.slice(0, 10)} → {new Date(report.to).toISOString().slice(0, 10)}
          </h2>
          <dl data-testid="report-aggregates">
            <dt>Rounds submitted</dt>
            <dd>{report.rounds_submitted}</dd>
            <dt>Rounds voided</dt>
            <dd>{report.rounds_voided}</dd>
            <dt>Net total (after voids)</dt>
            <dd>{formatPrice(report.net_total)}</dd>
            <dt>Net tax</dt>
            <dd>{formatPrice(report.net_tax_total)}</dd>
          </dl>

          {/* Zero vs empty (D6): the figures stay rendered byte-for-byte; the
              hint distinguishes a genuinely empty period from a broken one. */}
          {report.rounds_submitted === 0 && report.rounds_voided === 0 && (
            <p className={styles.zeroHint}>Nothing was recorded in this period.</p>
          )}

          <h3>Channels</h3>
          <table data-testid="report-channels" className={styles.cardTable}>
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col">Rounds</th>
                <th scope="col">Net total</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {report.channels.map((channel) => (
                <tr key={channel.type}>
                  <td data-label="Channel">{channel.type.replace('_', '-')}</td>
                  <td data-label="Rounds">{channel.rounds}</td>
                  <td data-label="Net total">{formatPrice(channel.net_total)}</td>
                  <td data-label="Share">
                    <span aria-hidden="true" className={styles.barTrack}>
                      <span
                        className={styles.barFill}
                        style={{
                          width: `${Math.round(barShare(channel.rounds, maxChannelRounds) * 100)}%`,
                        }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Best sellers</h3>
          {report.best_sellers.length === 0 ? (
            <EmptyState testId="report-best-sellers-empty" title="No items sold in this period.">
              The best-sellers list fills in as rounds are submitted.
            </EmptyState>
          ) : (
            <ol data-testid="report-best-sellers">
              {report.best_sellers.map((item) => (
                <li key={item.item_id}>
                  {item.name} — {item.quantity}
                  <span aria-hidden="true" className={styles.barTrack}>
                    <span
                      className={styles.barFill}
                      style={{
                        width: `${Math.round(barShare(item.quantity, maxItemQuantity) * 100)}%`,
                      }}
                    />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      {isOwnerSomewhere && scopes.length > 1 && (
        <BranchComparison
          scopes={scopes}
          period={period}
          anchorDate={anchorDate}
          from={report?.from}
          to={report?.to}
        />
      )}
    </section>
  )
}

/** The owner's side-by-side view (FR-003): one call per branch, plan D2. */
function BranchComparison(props: {
  scopes: Scope[]
  period: ReportPeriod
  anchorDate: string
  /** The anchored branch's server-returned bounds — the same-period proof. */
  from?: string
  to?: string
}) {
  const sentence =
    props.from !== undefined && props.to !== undefined
      ? comparisonPeriodSentence(props.period, props.from, props.to)
      : null
  return (
    <>
      <h2>Branch comparison</h2>
      {sentence !== null && (
        <p className={styles.periodSentence}>
          {sentence} — every row loads its own copy of this exact range.
        </p>
      )}
      <table data-testid="report-comparison" className={styles.cardTable}>
        <thead>
          <tr>
            <th scope="col">Branch</th>
            <th scope="col">Rounds</th>
            <th scope="col">Net total</th>
          </tr>
        </thead>
        <tbody>
          {props.scopes.map((scope) => (
            <ComparisonRow
              key={scope.branchId}
              scope={scope}
              period={props.period}
              anchorDate={props.anchorDate}
            />
          ))}
        </tbody>
      </table>
    </>
  )
}

function ComparisonRow(props: { scope: Scope; period: ReportPeriod; anchorDate: string }) {
  const query = useSalesReport({
    restaurantId: props.scope.restaurantId,
    branchId: props.scope.branchId,
    period: props.period,
    anchorDate: props.anchorDate,
  })
  // D1 honest posture: a pending row, a failed row, and a zero row are three
  // different truths — never one silent '—'.
  const rounds = query.data ? query.data.rounds_submitted : null
  const netTotal = query.data ? formatPrice(query.data.net_total) : null
  const posture = query.isPending
    ? 'Loading…'
    : query.data === undefined
      ? 'Load failed — the figures for this branch could not be loaded.'
      : null
  return (
    <tr>
      <td data-label="Branch">{props.scope.label}</td>
      {posture !== null ? (
        <td colSpan={2} className={styles.comparisonStatus} aria-live="polite">
          {posture}
        </td>
      ) : (
        <>
          <td data-label="Rounds">{rounds}</td>
          <td data-label="Net total">{netTotal}</td>
        </>
      )}
    </tr>
  )
}
