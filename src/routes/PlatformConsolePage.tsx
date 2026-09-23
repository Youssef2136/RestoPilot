import { useState } from 'react'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { PlatformPayloadError } from '../features/platform/platformClient'
import { OnboardingPanel } from '../features/platform/components/OnboardingPanel'
import {
  usePlatformOverview,
  useSetPlatformDisabled,
  useSetSubscriptionDates,
} from '../features/platform/usePlatform'

/**
 * The platform console (spec 014 T007, FR-001–FR-005, FR-008): every
 * restaurant with its derived subscription state, dates, disable flag, and
 * usage counts; the super admin activates (sets dates), changes dates, and
 * disables with a mandatory reason. Spec 019 adds the onboarding panel
 * above the overview table: provision a new restaurant + first owner.
 * Route-gated by RequireSuperAdmin; the
 * RPCs re-verify the flag on every call (Constitution IV).
 */
const STATE_LABELS: Record<string, string> = {
  never_activated: 'Never activated',
  active: 'Active',
  nearing_expiration: 'Nearing expiration',
  expired: 'Expired',
}

export function PlatformConsolePage() {
  const { profile, isPending, isError } = useAuthContext()

  const overviewQuery = usePlatformOverview()
  const datesMutation = useSetSubscriptionDates()
  const disableMutation = useSetPlatformDisabled()

  const [error, setError] = useState<string | null>(null)
  const [disabling, setDisabling] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [editingDates, setEditingDates] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))

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

  async function handleDates(restaurantId: string) {
    setError(null)
    const result = await datesMutation.mutateAsync({
      restaurantId,
      startDate,
      endDate,
    })
    if (result) {
      setEditingDates(null)
    }
  }

  async function handleDisable(restaurantId: string, disabled: boolean) {
    setError(null)
    try {
      await disableMutation.mutateAsync({ restaurantId, disabled, reason })
      setDisabling(null)
      setReason('')
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
        <p role="alert">
          {refusal.code === '42501'
            ? 'You do not have access to the platform console.'
            : refusal.message}
        </p>
      )}
      {error !== null && <p role="alert">{error}</p>}

      {overviewQuery.isPending && <p>Loading the platform overview…</p>}

      {rows !== undefined && refusal === null && (
        <table data-testid="platform-overview">
          <thead>
            <tr>
              <th scope="col">Restaurant</th>
              <th scope="col">Subscription</th>
              <th scope="col">Dates</th>
              <th scope="col">Usage (branches / staff / sessions / rounds)</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.restaurant_id}>
                <td>
                  {row.name}
                  {row.platform_disabled && (
                    <span data-testid={`disabled-${row.slug}`}>
                      {' '}
                      — disabled
                      {row.platform_disabled_reason ? `: ${row.platform_disabled_reason}` : ''}
                    </span>
                  )}
                </td>
                <td>{row.platform_disabled ? 'Disabled' : STATE_LABELS[row.state]}</td>
                <td>
                  {row.start_date === null || row.end_date === null
                    ? '—'
                    : `${row.start_date} → ${row.end_date}`}
                </td>
                <td>
                  {row.branch_count} / {row.staff_count} / {row.session_count} / {row.round_count}
                </td>
                <td>
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
                      onClick={() => void handleDisable(row.restaurant_id, false)}
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
      )}

      {editingDates !== null && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleDates(editingDates)
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
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <button type="submit" disabled={datesMutation.isPending}>
            Save dates
          </button>
          <button type="button" onClick={() => setEditingDates(null)}>
            Cancel
          </button>
        </form>
      )}

      {disabling !== null && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (reason.trim() === '') return
            void handleDisable(disabling, true)
          }}
        >
          <h2>Disable restaurant</h2>
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
          <button type="submit" disabled={disableMutation.isPending || reason.trim() === ''}>
            Confirm disable
          </button>
          <button
            type="button"
            onClick={() => {
              setDisabling(null)
              setReason('')
            }}
          >
            Cancel
          </button>
        </form>
      )}
    </section>
  )
}
