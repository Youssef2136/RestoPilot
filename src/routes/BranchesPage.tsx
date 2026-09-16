import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useMemo, useState, type FormEvent } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext, type AuthContextMembership } from '../features/auth/useAuthContext'
import { managementClient, type BranchRow } from '../features/management/managementClient'

/**
 * Branch list (contracts/management-client.md §2/§4.5; FR-007, FR-017): the
 * selected restaurant's branches, read through the table policies — an owner
 * sees every branch of the restaurant, a branch-scoped member exactly their
 * assigned branch. The owner-only create and rename affordances are gated by
 * `canManageRestaurant` (presentation only: the management RPCs remain the
 * authorization boundary — Constitution IV), and a caller with nothing
 * readable behind the selection gets the explicit denial view — non-owner
 * deep links are rejected, not hidden (FR-014 posture).
 *
 * Branch display names are deliberately not unique within the restaurant
 * (FR-007): nothing here rejects or collapses duplicates.
 */

/** The one query-key shape this page's reads and mutations share (contract §1). */
function branchesQueryKey(restaurantId: string | null) {
  return ['management', 'branches', restaurantId] as const
}

/** Branches of the restaurant the caller may read (the policy narrows the rows). */
async function fetchBranches(restaurantId: string | null): Promise<BranchRow[]> {
  if (restaurantId === null) {
    return []
  }
  const { data, error } = await getSupabaseClient()
    .from('branches')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('name')
  if (error) {
    throw error
  }
  return data ?? []
}

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

/**
 * The owner-only creation form (FR-007). The RPC is the validator — its
 * message is shown verbatim and nothing is created on rejection.
 */
function CreateBranchForm({ restaurantId }: { restaurantId: string }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    const result = await managementClient.createBranch({ restaurantId, name })
    setSubmitting(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    setName('')
    void queryClient.invalidateQueries({ queryKey: branchesQueryKey(restaurantId) })
    setFeedback({ tone: 'success', message: `Branch "${result.data.name}" created.` })
  }

  return (
    <section aria-labelledby="create-branch-heading">
      <h2 id="create-branch-heading">Create a branch</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="create-branch-name">Branch name</label>
          <input
            id="create-branch-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <p>Display names are not required to be unique within the restaurant.</p>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create branch'}
        </button>
      </form>
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </section>
  )
}

/**
 * One branch row: the identity link to the branch view, plus the owner-only
 * inline rename (FR-007). The RPC's message is surfaced verbatim on
 * rejection; the submitted value is preserved so the owner can correct it.
 */
function BranchRowItem({ branch, canManage }: { branch: BranchRow; canManage: boolean }) {
  const queryClient = useQueryClient()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(branch.name)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function handleRename(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    const result = await managementClient.renameBranch({ branchId: branch.id, name })
    setSubmitting(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    setRenaming(false)
    setName(result.data.name)
    // The authoritative stored row is the RPC's return; the list refetches.
    void queryClient.invalidateQueries({ queryKey: branchesQueryKey(branch.restaurant_id) })
    setFeedback({ tone: 'success', message: 'Branch renamed.' })
  }

  function handleCancel() {
    setRenaming(false)
    setFeedback(null)
    setName(branch.name)
  }

  return (
    <li>
      <Link to={`/dashboard/branches/${branch.id}`}>{branch.name}</Link>
      {canManage &&
        (renaming ? (
          <form onSubmit={handleRename}>
            <label htmlFor={`rename-branch-${branch.id}`}>New name for {branch.name}</label>
            <input
              id={`rename-branch-${branch.id}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save name'}
            </button>
            <button type="button" onClick={handleCancel} disabled={submitting}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setRenaming(true)}>
            {`Rename ${branch.name}`}
          </button>
        ))}
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </li>
  )
}

export function BranchesPage() {
  const { memberships, isPending, isError, canManageRestaurant } = useAuthContext()

  // Every staff member reads at least their own branch of every restaurant
  // they belong to (the table policies narrow the read below), so the
  // selection offers each restaurant once — the same derivation as the
  // staff list, without its role narrowing.
  const readableRestaurants = useMemo(() => {
    const byId = new Map<string, AuthContextMembership>()
    for (const membership of memberships) {
      if (!byId.has(membership.restaurant_id)) {
        byId.set(membership.restaurant_id, membership)
      }
    }
    return [...byId.values()]
  }, [memberships])

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null)
  const effectiveRestaurantId =
    selectedRestaurantId !== null &&
    readableRestaurants.some((membership) => membership.restaurant_id === selectedRestaurantId)
      ? selectedRestaurantId
      : (readableRestaurants[0]?.restaurant_id ?? null)

  const branchesQuery = useQuery({
    queryKey: branchesQueryKey(effectiveRestaurantId),
    queryFn: () => fetchBranches(effectiveRestaurantId),
    enabled: effectiveRestaurantId !== null,
  })

  if (isPending) {
    return (
      <section>
        <h1>Branches</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Branches</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  // Nothing readable behind the selection (an identity the guard already
  // denies, defensively): the explicit denial — rejected, not hidden.
  if (effectiveRestaurantId === null) {
    return (
      <section>
        <h1>Branches</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const selectedRestaurant =
    readableRestaurants.find((membership) => membership.restaurant_id === effectiveRestaurantId) ??
    null
  const isOwner = canManageRestaurant(effectiveRestaurantId)
  const branches = branchesQuery.data ?? []

  // A non-owner whose policy-scoped read returns nothing has no branch in
  // scope here — the explicit denial again (an owner legitimately starts
  // with none, which the empty state below covers).
  if (!branchesQuery.isPending && !branchesQuery.isError && branches.length === 0 && !isOwner) {
    return (
      <section>
        <h1>Branches</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  return (
    <section>
      <h1>Branches</h1>
      {readableRestaurants.length > 1 && (
        <div>
          <label htmlFor="branches-restaurant">Restaurant</label>
          <select
            id="branches-restaurant"
            value={effectiveRestaurantId}
            onChange={(event) => setSelectedRestaurantId(event.target.value)}
          >
            {readableRestaurants.map((membership) => (
              <option key={membership.restaurant_id} value={membership.restaurant_id}>
                {membership.restaurant_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <p>Branches of {selectedRestaurant?.restaurant_name ?? 'the selected restaurant'}.</p>

      {branchesQuery.isPending ? (
        <p>Loading the branches…</p>
      ) : branchesQuery.isError ? (
        <p role="alert">The branches could not be loaded. Try again.</p>
      ) : branches.length === 0 ? (
        <p>No branches yet.</p>
      ) : (
        <ul>
          {branches.map((branch) => (
            <BranchRowItem key={branch.id} branch={branch} canManage={isOwner} />
          ))}
        </ul>
      )}

      {isOwner && <CreateBranchForm restaurantId={effectiveRestaurantId} />}

      <p>
        <Link to="/dashboard">Back to the dashboard</Link>
      </p>
    </section>
  )
}
