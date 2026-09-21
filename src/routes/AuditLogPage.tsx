import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { NotAuthorized } from '../features/auth/guards'
import { useAuthContext } from '../features/auth/useAuthContext'
import { AuditPayloadError } from '../features/audit/auditClient'
import { useAuditLog } from '../features/audit/useAudit'

/**
 * The audit trail (spec 011 T009, `/dashboard/audit`; US3, FR-009/FR-010):
 * the newest-first, filterable record of every audited staff action.
 *
 * Gate: owner or branch_manager only — a kitchen/cashier deep link renders
 * the explicit denial view (rejected, not hidden, the established posture);
 * the reach itself is re-enforced by the `get_audit_log` RPC regardless
 * (Constitution IV). Branch options come from the identity's memberships —
 * owners list every branch of their restaurant, managers their own.
 */

export function AuditLogPage() {
  const { memberships, isPending, isError } = useAuthContext()

  const branchOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>()
    for (const membership of memberships) {
      if (membership.role !== 'owner' && membership.role !== 'branch_manager') {
        continue
      }
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

  const canViewAudit = memberships.some((m) => m.role === 'owner' || m.role === 'branch_manager')

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState<string>('')

  const effectiveBranchId =
    selectedBranchId !== null && branchOptions.some((b) => b.id === selectedBranchId)
      ? selectedBranchId
      : null

  const auditQuery = useAuditLog({
    branchId: effectiveBranchId,
    action: actionFilter.trim() === '' ? null : actionFilter.trim(),
  })

  if (isPending) {
    return (
      <section>
        <h1>Audit trail</h1>
        <p>Loading your staff context…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h1>Audit trail</h1>
        <p role="alert">Your staff context could not be loaded. Reload the page and try again.</p>
      </section>
    )
  }

  if (!canViewAudit || memberships.length === 0) {
    return (
      <section>
        <h1>Audit trail</h1>
        <NotAuthorized />
        <p>
          <Link to="/dashboard">Back to the dashboard</Link>
        </p>
      </section>
    )
  }

  const entries = auditQuery.data?.entries ?? []

  return (
    <section>
      <h1>Audit trail</h1>

      <div>
        <label htmlFor="audit-branch">Branch</label>
        <select
          id="audit-branch"
          value={effectiveBranchId ?? ''}
          onChange={(event) =>
            setSelectedBranchId(event.target.value === '' ? null : event.target.value)
          }
        >
          <option value="">All my branches</option>
          {branchOptions.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="audit-action">Action</label>
        <input
          id="audit-action"
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value)}
          placeholder="e.g. round.void"
        />
      </div>

      {auditQuery.isPending && <p>Loading the audit trail…</p>}
      {auditQuery.isError && (
        <p role="alert">
          {auditQuery.error instanceof AuditPayloadError
            ? auditQuery.error.message
            : 'The audit trail could not be loaded.'}
        </p>
      )}

      {!auditQuery.isPending && !auditQuery.isError && (
        <table data-testid="audit-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Action</th>
              <th scope="col">Actor</th>
              <th scope="col">Branch</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5}>No audit entries match.</td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} data-audit-action={entry.action}>
                  <td>{new Date(entry.created_at).toLocaleString()}</td>
                  <td>{entry.action}</td>
                  <td>{entry.actor_display_name}</td>
                  <td>{entry.branch_label ?? '—'}</td>
                  <td>{entry.reason ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      <p>
        <Link to="/dashboard">Back to the dashboard</Link>
      </p>
    </section>
  )
}
