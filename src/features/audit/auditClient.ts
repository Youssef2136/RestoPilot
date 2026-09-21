/*
 * Phase 10 — the audit trail client (spec 011 T009; contracts/
 * database-functions.md §2; US3, FR-009/FR-010).
 *
 * `get_audit_log` is the single read for the trail: owner sees the whole
 * restaurant (the `branch_id is null` rows included), a branch manager the
 * union of their managed branches — the server enforces the reach, the
 * client only scopes the FILTER (a `p_branch_id` outside reach is refused
 * with the same verbatim 42501 as any other denial).
 *
 * Fail-closed payload discipline (the staffOps convention): a null answer
 * or a payload without an `entries` array is malformed, never rendered.
 */

import { getSupabaseClient } from '../../lib/supabase'

export interface AuditEntry {
  id: string
  action: string
  resource_type: string
  resource_id: string
  reason: string | null
  actor_display_name: string
  branch_label: string | null
  restaurant_id: string
  branch_id: string | null
  created_at: string
}

export interface AuditPage {
  entries: AuditEntry[]
}

export class AuditPayloadError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AuditPayloadError'
    this.code = code
  }
}

export async function getAuditLog(input: {
  action?: string | null
  branchId?: string | null
  limit?: number
}): Promise<AuditPage> {
  const { data, error } = await getSupabaseClient().rpc('get_audit_log', {
    p_action: input.action ?? undefined,
    p_branch_id: input.branchId ?? undefined,
    p_limit: input.limit ?? 100,
  })
  if (error) {
    throw new AuditPayloadError(error.code ?? 'unexpected', error.message)
  }
  const page = data as unknown
  if (
    page === null ||
    page === undefined ||
    typeof page !== 'object' ||
    !Array.isArray((page as AuditPage).entries)
  ) {
    throw new AuditPayloadError('malformed', 'The audit trail returned no data.')
  }
  return page as AuditPage
}
