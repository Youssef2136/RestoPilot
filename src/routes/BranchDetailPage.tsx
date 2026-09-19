import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { useState, type FormEvent } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import {
  managementClient,
  type BranchRow,
  type DiningTableRow,
  type WorkingHoursRow,
} from '../features/management/managementClient'
import { WorkingHoursEditor } from '../features/management/components/WorkingHoursEditor'
import { WEEKDAY_LABELS, formatInterval, toEditorState } from '../features/management/workingHours'

/**
 * The branch view (contracts/management-client.md §2; FR-008, FR-009,
 * FR-010–FR-012, FR-017): the branch's name, its weekly working hours, and its
 * physical tables — the schedule and table list shared by every member who may
 * read the branch, plus the owner-only controls. A day with no intervals reads
 * as closed; a branch with no rows reads as "no hours configured" (FR-008).
 *
 * The reads are policy-scoped: a branch id outside the caller's scope (or
 * unknown) returns no row, and the page renders the explicit denial state
 * WITHOUT echoing the requested identity — names only for rows the caller may
 * read (feature 003's honesty rule; contract §5). The owner gate is
 * presentation only — the RPCs remain the authorization boundary
 * (Constitution IV).
 */

/** The branch row, read through the table policies (readable by its staff). */
async function fetchBranch(branchId: string | undefined): Promise<BranchRow | null> {
  if (branchId === undefined) {
    return null
  }
  const { data, error } = await getSupabaseClient()
    .from('branches')
    .select('*')
    .eq('id', branchId)
    .maybeSingle()
  if (error) {
    throw error
  }
  return data
}

/** The branch's working-hours rows, read through the table policies (same scope as the branch). */
async function fetchWorkingHours(branchId: string | undefined): Promise<WorkingHoursRow[]> {
  if (branchId === undefined) {
    return []
  }
  const { data, error } = await getSupabaseClient()
    .from('branch_working_hours')
    .select('*')
    .eq('branch_id', branchId)
  if (error) {
    throw error
  }
  return data ?? []
}

/** The branch's tables, read through the table policies (same scope as the branch). */
async function fetchDiningTables(branchId: string | undefined): Promise<DiningTableRow[]> {
  if (branchId === undefined) {
    return []
  }
  const { data, error } = await getSupabaseClient()
    .from('dining_tables')
    .select('*')
    .eq('branch_id', branchId)
    .order('label')
  if (error) {
    throw error
  }
  return data ?? []
}

function diningTablesQueryKey(branchId: string) {
  return ['management', 'dining-tables', branchId] as const
}

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

/**
 * One table row: its label and its EXPLICIT persisted state, plus the
 * owner-only rename and activation controls (FR-011/FR-012). An inactive table
 * stays listed with its state — there is no delete path, so the state is the
 * only thing that changes. Renaming is available while inactive. The RPC's
 * message is surfaced verbatim and the submitted value preserved on rejection.
 */
function DiningTableRowItem({ table, canManage }: { table: DiningTableRow; canManage: boolean }) {
  const queryClient = useQueryClient()
  const [renaming, setRenaming] = useState(false)
  const [label, setLabel] = useState(table.label)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function handleRename(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    const result = await managementClient.renameDiningTable({
      diningTableId: table.id,
      label,
    })
    setSubmitting(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    setRenaming(false)
    setLabel(result.data.label)
    void queryClient.invalidateQueries({ queryKey: diningTablesQueryKey(table.branch_id) })
    setFeedback({ tone: 'success', message: 'Table renamed.' })
  }

  async function handleToggleActive() {
    setSubmitting(true)
    setFeedback(null)
    const result = await managementClient.setDiningTableActive({
      diningTableId: table.id,
      active: !table.is_active,
    })
    setSubmitting(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    void queryClient.invalidateQueries({ queryKey: diningTablesQueryKey(table.branch_id) })
    setFeedback({
      tone: 'success',
      message: result.data.is_active ? 'Table activated.' : 'Table deactivated.',
    })
  }

  function handleCancelRename() {
    setRenaming(false)
    setFeedback(null)
    setLabel(table.label)
  }

  return (
    <li>
      <span>{table.label}</span> <span>{table.is_active ? 'Active' : 'Inactive'}</span>
      {canManage &&
        (renaming ? (
          <form onSubmit={handleRename}>
            <label htmlFor={`rename-table-${table.id}`}>New label for {table.label}</label>
            <input
              id={`rename-table-${table.id}`}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save label'}
            </button>
            <button type="button" onClick={handleCancelRename} disabled={submitting}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setRenaming(true)}>
            {`Rename ${table.label}`}
          </button>
        ))}
      {canManage && (
        <button type="button" onClick={handleToggleActive} disabled={submitting}>
          {table.is_active ? `Deactivate ${table.label}` : `Reactivate ${table.label}`}
        </button>
      )}
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </li>
  )
}

/**
 * The branch's tables section (FR-010–FR-012, FR-017): the list every reader
 * of the branch sees, and the owner-only create form. Labels are unique within
 * the branch and the same label is allowed in another branch — both rules are
 * the RPC's (its message is shown verbatim, nothing is created on rejection).
 */
function DiningTablesSection({ branchId, isOwner }: { branchId: string; isOwner: boolean }) {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // Only meaningful once the branch itself is readable — an out-of-scope id
  // never reaches a tables read.
  const tablesQuery = useQuery({
    queryKey: diningTablesQueryKey(branchId),
    queryFn: () => fetchDiningTables(branchId),
  })

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    const result = await managementClient.createDiningTable({ branchId, label })
    setSubmitting(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    setLabel('')
    void queryClient.invalidateQueries({ queryKey: diningTablesQueryKey(branchId) })
    setFeedback({ tone: 'success', message: `Table "${result.data.label}" created.` })
  }

  const tables = tablesQuery.data ?? []

  return (
    <section aria-labelledby="branch-tables-heading">
      <h2 id="branch-tables-heading">Tables</h2>
      {tablesQuery.isPending ? (
        <p>Loading the tables…</p>
      ) : tablesQuery.isError ? (
        <p role="alert">The tables could not be loaded. Try again.</p>
      ) : tables.length === 0 ? (
        <p>No tables in this branch yet.</p>
      ) : (
        <ul>
          {tables.map((table) => (
            <DiningTableRowItem key={table.id} table={table} canManage={isOwner} />
          ))}
        </ul>
      )}

      {isOwner && (
        <form onSubmit={handleCreate}>
          <div>
            <label htmlFor="create-table-label">Table label</label>
            <input
              id="create-table-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            <p>The label must be unique within this branch.</p>
          </div>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create table'}
          </button>
        </form>
      )}
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </section>
  )
}

export function BranchDetailPage() {
  const { branchId } = useParams<{ branchId: string }>()
  const { isPending: contextPending, isError: contextError, canManageRestaurant } = useAuthContext()

  const branchQuery = useQuery({
    queryKey: ['management', 'branch', branchId],
    queryFn: () => fetchBranch(branchId),
    enabled: branchId !== undefined,
  })

  // Only meaningful once the branch itself is readable — an out-of-scope id
  // never reaches a schedule read.
  const hoursQuery = useQuery({
    queryKey: ['management', 'working-hours', branchId],
    queryFn: () => fetchWorkingHours(branchId),
    enabled: branchQuery.data !== null && branchQuery.data !== undefined,
  })

  if (contextPending || branchQuery.isPending) {
    return (
      <section>
        <h1>Branch</h1>
        <p>Loading the branch…</p>
      </section>
    )
  }

  if (contextError || branchQuery.isError) {
    return (
      <section>
        <h1>Branch</h1>
        <p role="alert">The branch could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  if (branchQuery.data === undefined || branchQuery.data === null) {
    // The policy-scoped read returned nothing: the explicit denial, with no
    // requested identity echoed (contract §5).
    return (
      <section>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const branch = branchQuery.data
  const hours = hoursQuery.data ?? []
  const isOwner = canManageRestaurant(branch.restaurant_id)

  return (
    <section>
      <h1>{branch.name}</h1>

      <p>
        <Link to={`/dashboard/branches/${branch.id}/menu`}>{`${branch.name} menu`}</Link>
      </p>

      <p>
        <Link to={`/dashboard/branches/${branch.id}/tax`}>{`${branch.name} tax`}</Link>
      </p>

      <section aria-labelledby="branch-working-hours-heading">
        <h2 id="branch-working-hours-heading">Working hours</h2>
        {hoursQuery.isPending ? (
          <p>Loading the working hours…</p>
        ) : hoursQuery.isError ? (
          <p role="alert">The working hours could not be loaded. Try again.</p>
        ) : hours.length === 0 ? (
          // No rows at all — nothing configured yet (FR-008).
          <p>No hours configured.</p>
        ) : (
          <ul>
            {toEditorState(hours).map((day) => (
              <li key={day.weekday}>
                {WEEKDAY_LABELS[day.weekday]}:{' '}
                {day.intervals.length === 0
                  ? 'Closed'
                  : day.intervals.map((interval) => formatInterval(interval)).join(', ')}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && !hoursQuery.isPending && !hoursQuery.isError && (
        <WorkingHoursEditor key={branch.id} branchId={branch.id} schedule={hours} />
      )}

      <DiningTablesSection key={`tables-${branch.id}`} branchId={branch.id} isOwner={isOwner} />

      <p>
        <Link to="/dashboard/branches">All branches</Link>
      </p>
      <p>
        <Link to="/dashboard">Back to the dashboard</Link>
      </p>
    </section>
  )
}
