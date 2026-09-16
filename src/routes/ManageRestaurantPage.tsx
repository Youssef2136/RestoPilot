import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useMemo, useState, type FormEvent } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext, type AuthContextMembership } from '../features/auth/useAuthContext'
import { managementClient, type RestaurantRow } from '../features/management/managementClient'
import { RestaurantQrPanel } from '../features/management/components/RestaurantQrPanel'

/**
 * Restaurant management page (contracts/management-client.md §2/§4.1): the
 * selected restaurant's profile form — display name, brand description,
 * contact information, and the public identifier with the FR-004 warning
 * flow — plus the settings form (timezone). Owner-only: the in-page gate
 * renders the explicit denial view for every non-owner (FR-006/FR-017 —
 * rejected, not hidden); presentation only, the management RPCs remain the
 * authorization boundary (Constitution IV).
 *
 * The owner's QR entry point panel renders here too (FR-018): it re-derives
 * its payload from the restaurant's current public identifier, so a confirmed
 * identifier change is reflected by the next rendering.
 */

/** The selected restaurant, read through the table policies (owner-readable). */
async function fetchRestaurant(restaurantId: string | null): Promise<RestaurantRow | null> {
  if (restaurantId === null) {
    return null
  }
  const { data, error } = await getSupabaseClient()
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .maybeSingle()
  if (error) {
    throw error
  }
  return data
}

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

interface ProfileFormState {
  name: string
  slug: string
  brandDescription: string
  contactEmail: string
  contactPhone: string
}

function profileFormState(restaurant: RestaurantRow): ProfileFormState {
  return {
    name: restaurant.name,
    slug: restaurant.slug,
    brandDescription: restaurant.brand_description ?? '',
    contactEmail: restaurant.contact_email ?? '',
    contactPhone: restaurant.contact_phone ?? '',
  }
}

/**
 * The restaurant profile form (FR-002) with the FR-004 identifier flow: a
 * submitted identifier that differs from the stored one is NOT saved before
 * the owner acknowledges the consequence warning and explicitly confirms;
 * cancelling discards the submitted value and leaves the identifier
 * unchanged. After a confirmed change the page shows the new public entry
 * URL.
 */
function RestaurantProfileForm({ restaurant }: { restaurant: RestaurantRow }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ProfileFormState>(() => profileFormState(restaurant))
  // The submitted identifier awaiting explicit confirmation, or null.
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  // The new public entry URL after a confirmed identifier change (FR-004).
  const [entryUrl, setEntryUrl] = useState<string | null>(null)

  async function save(slug: string) {
    setSubmitting(true)
    setFeedback(null)
    const result = await managementClient.updateRestaurantProfile({
      restaurantId: restaurant.id,
      name: form.name,
      slug,
      brandDescription: form.brandDescription,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
    })
    setSubmitting(false)
    if (!result.ok) {
      // The server's message, verbatim, with the form state preserved.
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    const updated = result.data
    setForm(profileFormState(updated))
    setPendingSlug(null)
    // The RPC returns the stored row — the authoritative result, not an
    // optimistic write (Constitution V).
    queryClient.setQueryData(['management', 'restaurant', restaurant.id], updated)
    void queryClient.invalidateQueries({
      queryKey: ['management', 'restaurant', restaurant.id],
    })
    if (updated.slug !== restaurant.slug) {
      // FR-004: the old identifier no longer addresses this restaurant and
      // is retained or encoded nowhere — show the new public entry URL.
      setEntryUrl(`${window.location.origin}/r/${updated.slug}`)
      setFeedback({
        tone: 'success',
        message:
          'Restaurant profile saved. The public identifier changed — the old identifier no longer addresses this restaurant and is not retained anywhere (no alias, no redirect).',
      })
    } else {
      setFeedback({ tone: 'success', message: 'Restaurant profile saved.' })
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.slug !== restaurant.slug) {
      // The identifier change is confirmed only after the warning below.
      setPendingSlug(form.slug)
      return
    }
    await save(form.slug)
  }

  async function handleConfirm() {
    if (pendingSlug === null) {
      return
    }
    await save(pendingSlug)
  }

  function handleCancel() {
    // Cancelling leaves the identifier unchanged: discard the submitted value.
    setPendingSlug(null)
    setForm((current) => ({ ...current, slug: restaurant.slug }))
  }

  return (
    <section aria-labelledby="restaurant-profile-heading">
      <h2 id="restaurant-profile-heading">Profile</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="restaurant-name">Display name</label>
          <input
            id="restaurant-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor="restaurant-brand">Brand description</label>
          <textarea
            id="restaurant-brand"
            value={form.brandDescription}
            onChange={(event) => setForm({ ...form, brandDescription: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor="restaurant-email">Contact email</label>
          <input
            id="restaurant-email"
            value={form.contactEmail}
            onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor="restaurant-phone">Contact phone</label>
          <input
            id="restaurant-phone"
            value={form.contactPhone}
            onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor="restaurant-slug">Public identifier</label>
          <input
            id="restaurant-slug"
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: event.target.value })}
          />
          <p>
            Lowercase letters, digits, and single hyphens — it addresses this restaurant's public
            page.
          </p>
        </div>

        {/* FR-004: the consequence warning shown before a changed identifier
            is saved; the save continues only after explicit confirmation. */}
        {pendingSlug !== null && (
          <div role="alert">
            <p>
              The public identifier will change from <code>{restaurant.slug}</code> to{' '}
              <code>{pendingSlug}</code>. The old identifier will no longer address this restaurant
              and is not retained anywhere — no alias, no redirect, no history.
            </p>
            <button type="button" onClick={handleConfirm} disabled={submitting}>
              Confirm identifier change
            </button>
            <button type="button" onClick={handleCancel} disabled={submitting}>
              Cancel
            </button>
          </div>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
      {entryUrl !== null && (
        <p>
          New public entry URL: <code>{entryUrl}</code>
        </p>
      )}
    </section>
  )
}

/**
 * The restaurant settings form (FR-003): the timezone, offered from the
 * browser's IANA list (research.md §10) with the stored value always
 * selectable; the RPC's message is surfaced verbatim on rejection.
 */
function RestaurantSettingsForm({ restaurant }: { restaurant: RestaurantRow }) {
  const queryClient = useQueryClient()
  const [timezone, setTimezone] = useState(restaurant.timezone)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const zones = useMemo(() => {
    // The browser's list can omit the stored zone (`UTC` is absent) — keep
    // the stored value selectable so the form never misrepresents it.
    const supported = Intl.supportedValuesOf('timeZone')
    return supported.includes(restaurant.timezone) ? supported : [restaurant.timezone, ...supported]
  }, [restaurant.timezone])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    const result = await managementClient.updateRestaurantSettings({
      restaurantId: restaurant.id,
      timezone,
    })
    setSubmitting(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    queryClient.setQueryData(['management', 'restaurant', restaurant.id], result.data)
    void queryClient.invalidateQueries({
      queryKey: ['management', 'restaurant', restaurant.id],
    })
    setFeedback({ tone: 'success', message: 'Restaurant settings saved.' })
  }

  return (
    <section aria-labelledby="restaurant-settings-heading">
      <h2 id="restaurant-settings-heading">Settings</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="restaurant-timezone">Timezone</label>
          <select
            id="restaurant-timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          <p>The reference timezone for this restaurant's working hours.</p>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save settings'}
        </button>
      </form>
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </section>
  )
}

export function ManageRestaurantPage() {
  const { memberships, isPending, isError } = useAuthContext()

  // The restaurants this member may manage: owner memberships (FR-006),
  // deduplicated per restaurant. `canManageRestaurant` is the same predicate
  // expressed for controls; the gate here needs the membership rows.
  const ownedRestaurants = useMemo(() => {
    const byId = new Map<string, AuthContextMembership>()
    for (const membership of memberships) {
      if (membership.role === 'owner' && !byId.has(membership.restaurant_id)) {
        byId.set(membership.restaurant_id, membership)
      }
    }
    return [...byId.values()]
  }, [memberships])

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null)
  const effectiveRestaurantId =
    selectedRestaurantId !== null &&
    ownedRestaurants.some((membership) => membership.restaurant_id === selectedRestaurantId)
      ? selectedRestaurantId
      : (ownedRestaurants[0]?.restaurant_id ?? null)

  const restaurantQuery = useQuery({
    queryKey: ['management', 'restaurant', effectiveRestaurantId],
    queryFn: () => fetchRestaurant(effectiveRestaurantId),
    enabled: effectiveRestaurantId !== null,
  })

  if (isPending) {
    return (
      <section>
        <h1>Restaurant</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Restaurant</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  // The in-page owner gate (contract §2): branch managers, cashiers, kitchen
  // staff, and other restaurants' members are rejected, not hidden.
  if (effectiveRestaurantId === null) {
    return (
      <section>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const restaurant = restaurantQuery.data ?? null

  return (
    <section>
      <h1>Restaurant</h1>
      {ownedRestaurants.length > 1 && (
        <div>
          <label htmlFor="manage-restaurant-selector">Restaurant</label>
          <select
            id="manage-restaurant-selector"
            value={effectiveRestaurantId}
            onChange={(event) => setSelectedRestaurantId(event.target.value)}
          >
            {ownedRestaurants.map((membership) => (
              <option key={membership.restaurant_id} value={membership.restaurant_id}>
                {membership.restaurant_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {restaurantQuery.isPending ? (
        <p>Loading the restaurant…</p>
      ) : restaurantQuery.isError ? (
        <p role="alert">The restaurant could not be loaded. Reload the page and try again.</p>
      ) : restaurant === null ? (
        // Nothing readable behind the selection: the empty state echoes no
        // identity, exactly like every other policy-scoped read (FR-017).
        <p>The restaurant's configuration is not available.</p>
      ) : (
        <>
          <RestaurantProfileForm key={restaurant.id} restaurant={restaurant} />
          <RestaurantSettingsForm key={restaurant.id} restaurant={restaurant} />
          {/* Keyed on the slug: a confirmed identifier change re-renders the
              panel with the new payload, so the next download encodes the new
              public entry URL (FR-004/FR-018). */}
          <RestaurantQrPanel key={`qr-${restaurant.slug}`} slug={restaurant.slug} />
        </>
      )}

      <p>
        <Link to="/dashboard">Back to the dashboard</Link>
      </p>
    </section>
  )
}
