import { useState } from 'react'
import { ConfirmDialog, useToast } from '../components/ui'
import { RefusalAlert } from '../components/state'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { PlatformPayloadError } from '../features/platform/platformClient'
import { stateLabel } from '../features/platform/subscriptionCopy'
import { OnboardingPanel } from '../features/platform/components/OnboardingPanel'
// D6 — the shared card-fallback pattern (spec 033's reports module; the
// AuditLogPage precedent routes through it the same way).
import styles from '../features/reports/reports.surfaces.module.css'
import {
  usePlatformOverview,
  useSetPlatformDisabled,
  useSetSubscriptionDates,
} from '../features/platform/usePlatform'

/**
 * The platform console (spec 014 T007, FR-001–FR-005, FR-008; phase 034
 * D1–D4): every restaurant with its derived subscription state, dates,
 * disable flag, and usage counts; the super admin activates (sets dates),
 * changes dates, and disables with a mandatory reason. Spec 019 adds the
 * onboarding panel above the overview table. Route-gated by
 * RequireSuperAdmin; the RPCs re-verify the flag on every call
 * (Constitution IV). The state labels come from subscriptionCopy — the ONE
 * owner-facing vocabulary (D1); every action speaks through a toast (D2);
 * the tenant list is filterable/sortable (D3); the dates form validates
 * inline (D4); the table reflows to labelled cards below 720px (D6).
 */

export function PlatformConsolePage() {
  const { profile, isPending, isError } = useAuthContext()
  const toast = useToast()

  const overviewQuery = usePlatformOverview()
  const datesMutation = useSetSubscriptionDates()
  const disableMutation = useSetPlatformDisabled()

  const [error, setError] = useState<string | null>(null)
  const [disabling, setDisabling] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [editingDates, setEditingDates] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))

  // D3 — the tenant list is workable: a name filter plus sortable Name and
  // Subscription columns (client-side over the already-fetched rows — FR-10
  // holds, no new reads).
  const [nameFilter, setNameFilter] = useState('')
  const [sort, setSort] = useState<{ key: 'name' | 'state'; direction: 'asc' | 'desc' } | null>(
    null,
  )

  if (isPending) {
    return (
      <section>
        <h1>Platform console</h1>
        <p>Loading your account…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Platform console</h1>
        <p role="alert">Your account could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  if (profile === null || !profile.is_super_admin) {
    return <NotAuthorized />
  }

  const rows = overviewQuery.data
  const refusal = overviewQuery.error instanceof PlatformPayloadError ? overviewQuery.error : null

  // D4 — inline dates validation: the guard runs before the RPC; the server's
  // verbatim refusal still renders when it fires.
  const datesInvalid = endDate < startDate

  const visibleRows = (() => {
    if (rows === undefined) return []
    const needle = nameFilter.trim().toLowerCase()
    const filtered =
      needle === '' ? rows : rows.filter((r) => r.name.toLowerCase().includes(needle))
    if (sort === null) return filtered
    const dir = sort.direction === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dir
      return stateLabel(a.state).localeCompare(stateLabel(b.state)) * dir
    })
  })()

  function toggleSort(key: 'name' | 'state') {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  async function handleDates(restaurantId: string, name: string) {
    setError(null)
    const result = await datesMutation.mutateAsync({
      restaurantId,
      startDate,
      endDate,
    })
    if (result) {
      setEditingDates(null)
      toast.show({ severity: 'success', message: `Subscription dates saved for ${name}.` })
    }
  }

  async function handleDisable(restaurantId: string, disabled: boolean, name: string) {
    setError(null)
    try {
      await disableMutation.mutateAsync({ restaurantId, disabled, reason })
      setDisabling(null)
      setReason('')
      toast.show({
        severity: 'success',
        message: disabled
          ? `${name} was disabled — hosted actions stop; existing captured data is kept.`
          : `${name} was re-enabled — customers can order again.`,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The action failed.')
    }
  }

  return (
    <section aria-labelledby="platform-console-heading">
      <h1 id="platform-console-heading">Platform console</h1>
      <p>Signed in as {profile.display_name} — the platform super admin.</p>

      <OnboardingPanel />

      {refusal !== null && (
        <RefusalAlert
          message={
            refusal.code === '42501'
              ? 'You do not have access to the platform console.'
              : refusal.message
          }
          context="Platform console"
        />
      )}
      {error !== null && <p role="alert">{error}</p>}

      {overviewQuery.isPending && <p>Loading the platform overview…</p>}

      {rows !== undefined && refusal === null && (
        <>
          {/* D3 — the workable list: substring name filter (client-side). */}
          <label htmlFor="tenant-filter">
            Filter tenants{' '}
            <input
              id="tenant-filter"
              type="search"
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="e.g. Blue Olive"
            />
          </label>
          <table data-testid="platform-overview" className={styles.cardTable}>
            <thead>
              <tr>
                <th
                  scope="col"
                  aria-sort={
                    sort?.key === 'name'
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <button type="button" onClick={() => toggleSort('name')}>
                    Restaurant
                  </button>
                </th>
                <th
                  scope="col"
                  aria-sort={
                    sort?.key === 'state'
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <button type="button" onClick={() => toggleSort('state')}>
                    Subscription
                  </button>
                </th>
                <th scope="col">Dates</th>
                <th scope="col">Usage (branches / staff / sessions / rounds)</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.restaurant_id}>
                  <td data-label="Restaurant">
                    {row.name}
                    {row.platform_disabled && (
                      <span data-testid={`disabled-${row.slug}`}>
                        {' '}
                        — disabled
                        {row.platform_disabled_reason ? `: ${row.platform_disabled_reason}` : ''}
                      </span>
                    )}
                  </td>
                  <td data-label="Subscription">
                    {row.platform_disabled ? 'Disabled' : stateLabel(row.state)}
                  </td>
                  <td data-label="Dates">
                    {row.start_date === null || row.end_date === null
                      ? '—'
                      : `${row.start_date} → ${row.end_date}`}
                  </td>
                  <td data-label="Usage">
                    {row.branch_count} / {row.staff_count} / {row.session_count} / {row.round_count}
                  </td>
                  <td data-label="Actions">
                    <button
                      type="button"
                      disabled={datesMutation.isPending}
                      onClick={() => {
                        setEditingDates(row.restaurant_id)
                        setDisabling(null)
                      }}
                    >
                      {row.state === 'never_activated' ? 'Activate' : 'Change dates'}
                    </button>
                    {row.platform_disabled ? (
                      <button
                        type="button"
                        disabled={disableMutation.isPending}
                        onClick={() => void handleDisable(row.restaurant_id, false, row.name)}
                      >
                        Re-enable
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDisabling(row.restaurant_id)
                          setEditingDates(null)
                        }}
                      >
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {editingDates !== null && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!datesInvalid) {
              const name =
                rows?.find((r) => r.restaurant_id === editingDates)?.name ?? 'the restaurant'
              void handleDates(editingDates, name)
            }
          }}
        >
          <h2>Subscription dates</h2>
          <label>
            Start date{' '}
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            End date{' '}
            <input
              type="date"
              value={endDate}
              aria-invalid={datesInvalid}
              aria-describedby={datesInvalid ? 'dates-error' : undefined}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          {datesInvalid && (
            <p id="dates-error" role="alert">
              The end date must be the same day as, or after, the start date.
            </p>
          )}
          <button type="submit" disabled={datesMutation.isPending || datesInvalid}>
            Save dates
          </button>
          <button type="button" onClick={() => setEditingDates(null)}>
            Cancel
          </button>
        </form>
      )}

      {/* Spec 023 FR-06 (Q4): the disable flow runs through the
          ConfirmDialog primitive — names preserved verbatim: "Disable"
          opens, "Confirm disable" confirms, "Cancel" cancels (E2E
          contract names). The required-reason input keeps its guard. */}
      <ConfirmDialog
        open={disabling !== null}
        onCancel={() => {
          setDisabling(null)
          setReason('')
        }}
        onConfirm={() => {
          if (disabling === null || reason.trim() === '') return
          const name =
            overviewQuery.data?.find((r) => r.restaurant_id === disabling)?.name ?? 'the restaurant'
          void handleDisable(disabling, true, name)
        }}
        title="Disable restaurant"
        confirmLabel="Confirm disable"
        cancelLabel="Cancel"
        busy={disableMutation.isPending}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (disabling === null || reason.trim() === '') return
            const name =
              overviewQuery.data?.find((r) => r.restaurant_id === disabling)?.name ??
              'the restaurant'
            void handleDisable(disabling, true, name)
          }}
        >
          <label>
            Reason (required){' '}
            <input
              type="text"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this restaurant being disabled?"
            />
          </label>
        </form>
      </ConfirmDialog>
    </section>
  )
}
