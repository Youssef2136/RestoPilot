import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useEnterChannelSession, useEnterSession, usePublicRestaurant } from '../useSession'

/**
 * The public entry flow (contracts/session-client.md §1+§3; spec 007 US1 and
 * spec 010 US2, FR-001…FR-004).
 *
 * Steps: restaurant payload → branch (rendered only when more than one
 * branch exists — FR-002) → channel (dine-in default) → dine-in: table pick;
 * delivery: address; takeaway: nothing further → name/phone → the matching
 * entry RPC. Client-side bounds are feedback only; the server re-validates
 * every input (FR-004) and its messages are surfaced verbatim. Unknown
 * restaurants render the not-found state.
 *
 * Dine-in keeps 007's `open_session_at_table` at table pick; delivery and
 * takeaway go through 010's `open_session_channel` — one submit, no table
 * join semantics (research §1).
 */

interface Props {
  slug: string
}

type Channel = 'dine-in' | 'delivery' | 'takeaway'

const ADDRESS_MAX = 200

export function RestaurantEntry({ slug }: Props) {
  const navigate = useNavigate()
  const restaurantQuery = usePublicRestaurant(slug)
  const enterMutation = useEnterSession()
  const channelMutation = useEnterChannelSession()

  const [branchId, setBranchId] = useState<string | null>(null)
  const [channel, setChannel] = useState<Channel>('dine-in')
  const [tableId, setTableId] = useState<string | null>(null)
  const [address, setAddress] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  const payload = restaurantQuery.data
  const pending = enterMutation.isPending || channelMutation.isPending

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
  // effective selection — the next step renders without a choice.
  const effectiveBranchId = branchId ?? (branches.length === 1 ? (branches[0]?.id ?? null) : null)
  const branch = branches.find((b) => b.id === effectiveBranchId) ?? null
  const tables = branch?.tables ?? []

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!payload || effectiveBranchId === null) {
      setError('Choose a branch to continue.')
      return
    }
    const name = displayName.trim()
    const trimmedPhone = phone.replace(/[\s\-()]/g, '')
    const trimmedAddress = address.trim()
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
    if (channel === 'dine-in' && tableId === null) {
      setError('Choose a table to continue.')
      return
    }
    if (channel === 'delivery' && trimmedAddress.length < 1) {
      setError('A delivery address is required.')
      return
    }
    if (channel === 'delivery' && trimmedAddress.length > ADDRESS_MAX) {
      setError(`A delivery address may be at most ${ADDRESS_MAX} characters.`)
      return
    }
    const shared = {
      restaurantId: payload.restaurant.id,
      branchId: effectiveBranchId,
      displayName: name,
      phone: trimmedPhone,
    }
    const onDone = {
      onSuccess: () => {
        void navigate(`/r/${slug}/menu`)
      },
      onError: (err: Error) => {
        setError(err.message)
      },
    }
    if (channel === 'dine-in') {
      enterMutation.mutate({ ...shared, tableId: tableId as string }, onDone)
    } else {
      channelMutation.mutate(
        {
          ...shared,
          channel,
          address: channel === 'delivery' ? trimmedAddress : undefined,
        },
        onDone,
      )
    }
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
        <fieldset>
          <legend>How would you like your order?</legend>
          <label>
            <input
              type="radio"
              name="channel"
              value="dine-in"
              checked={channel === 'dine-in'}
              onChange={() => setChannel('dine-in')}
            />{' '}
            Dine-in
          </label>
          <label>
            <input
              type="radio"
              name="channel"
              value="delivery"
              checked={channel === 'delivery'}
              onChange={() => setChannel('delivery')}
            />{' '}
            Delivery
          </label>
          <label>
            <input
              type="radio"
              name="channel"
              value="takeaway"
              checked={channel === 'takeaway'}
              onChange={() => setChannel('takeaway')}
            />{' '}
            Takeaway
          </label>
        </fieldset>
      ) : null}

      {effectiveBranchId !== null && channel === 'dine-in' ? (
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

      {effectiveBranchId !== null && channel === 'delivery' ? (
        <label>
          Delivery address
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={ADDRESS_MAX + 20}
            rows={3}
            placeholder="Street, building, apartment…"
          />
          <small>{`${address.trim().length}/${ADDRESS_MAX}`}</small>
        </label>
      ) : null}

      {effectiveBranchId !== null ? (
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
          <button type="submit" disabled={pending}>
            {pending
              ? 'Joining…'
              : channel === 'dine-in'
                ? 'Join the table'
                : channel === 'delivery'
                  ? 'Start a delivery order'
                  : 'Start a takeaway order'}
          </button>
        </form>
      ) : null}
    </section>
  )
}
