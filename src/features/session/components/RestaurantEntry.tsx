import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useEnterSession, usePublicRestaurant } from '../useSession'

/**
 * The public entry flow (contracts/session-client.md §1; spec 007 US1,
 * FR-001…FR-004).
 *
 * Steps: restaurant payload → branch (rendered only when more than one
 * branch exists — FR-002) → table (the branch's ACTIVE tables — FR-003) →
 * name/phone → `open_session_at_table`. Client-side bounds are feedback
 * only; the server re-validates every input (FR-004) and its messages are
 * surfaced verbatim. Unknown restaurants render the not-found state.
 */

interface Props {
  slug: string
}

export function RestaurantEntry({ slug }: Props) {
  const navigate = useNavigate()
  const restaurantQuery = usePublicRestaurant(slug)
  const enterMutation = useEnterSession()

  const [branchId, setBranchId] = useState<string | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  const payload = restaurantQuery.data

  // Reset the picks whenever the restaurant payload changes.
  useEffect(() => {
    setBranchId(null)
    setTableId(null)
  }, [payload])

  if (restaurantQuery.isPending) {
    return <p>Loading…</p>
  }

  if (restaurantQuery.isError || !payload) {
    return (
      <section>
        <h1>Restaurant not found</h1>
        <p role="alert">
          We could not find this restaurant. Check the link or ask the staff for the QR code again.
        </p>
      </section>
    )
  }

  const branches = payload.branches
  // A single-branch restaurant skips its picker (FR-002) but is still the
  // effective selection — the table options render without a choice step.
  const effectiveBranchId = branchId ?? (branches.length === 1 ? (branches[0]?.id ?? null) : null)
  const branch = branches.find((b) => b.id === effectiveBranchId) ?? null
  const tables = branch?.tables ?? []

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!payload || effectiveBranchId === null || tableId === null) {
      setError('Choose a table to continue.')
      return
    }
    const name = displayName.trim()
    const trimmedPhone = phone.replace(/[\s\-()]/g, '')
    if (name.length < 1) {
      setError('A display name is required.')
      return
    }
    if (name.length > 60) {
      setError('A display name may be at most 60 characters.')
      return
    }
    if (!/^\+?[0-9]{7,15}$/.test(trimmedPhone)) {
      setError('A valid phone number is required.')
      return
    }
    enterMutation.mutate(
      {
        restaurantId: payload.restaurant.id,
        branchId: effectiveBranchId,
        tableId,
        displayName: name,
        phone: trimmedPhone,
      },
      {
        onSuccess: () => {
          void navigate(`/r/${slug}/menu`)
        },
        onError: (err: Error) => {
          setError(err.message)
        },
      },
    )
  }

  return (
    <section>
      <h1>{payload.restaurant.name}</h1>
      {payload.restaurant.brand_description ? <p>{payload.restaurant.brand_description}</p> : null}

      {branches.length > 1 ? (
        <label>
          Branch
          <select
            value={branchId ?? ''}
            onChange={(e) => {
              setTableId(null)
              setBranchId(e.target.value || null)
            }}
          >
            <option value="">Choose a branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        // Single-branch restaurants skip the picker (FR-002).
        <input type="hidden" value={branches[0]?.id ?? ''} readOnly />
      )}

      {effectiveBranchId !== null ? (
        <label>
          Table
          <select value={tableId ?? ''} onChange={(e) => setTableId(e.target.value || null)}>
            <option value="">Choose a table…</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <form onSubmit={submit}>
        <label>
          Your name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            placeholder="Shown to the staff"
          />
        </label>
        <label>
          Phone number
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={enterMutation.isPending}>
          {enterMutation.isPending ? 'Joining…' : 'Join the table'}
        </button>
      </form>
    </section>
  )
}
