/*
 * The audit trail hook (spec 011 T009; US3): a branch-filtered, action-
 * filtered, newest-first query over `get_audit_log`. The server owns the
 * reach — the filter is a preference, not a permission.
 */

import { useQuery } from '@tanstack/react-query'
import { getAuditLog } from './auditClient'

export function auditLogKey(branchId: string | null, action: string | null) {
  return ['audit', 'log', branchId, action]
}

export function useAuditLog(input: { branchId: string | null; action: string | null }) {
  return useQuery({
    queryKey: auditLogKey(input.branchId, input.action),
    queryFn: () => getAuditLog({ branchId: input.branchId, action: input.action, limit: 200 }),
  })
}
