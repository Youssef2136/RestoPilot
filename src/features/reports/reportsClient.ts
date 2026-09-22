/*
 * Phase 12 — the reports client (spec 013 T006; contracts/
 * database-functions.md §1–§2).
 *
 * Two reads, both rendered verbatim: `get_branch_sales_report` (one
 * calendar bucket of aggregates for one branch) and
 * `get_branch_void_report` (the void ledger with who/when/why). The server
 * owns every figure (Constitution II) — this module shapes parameters and
 * validates payload shape, nothing else. The void LOG filter view over the
 * audit trail stays in `features/audit` (plan D3 — no second ledger).
 *
 * Fail-closed payload discipline (the audit/staffOps convention): a null
 * answer or a payload missing its contract keys is malformed, never
 * rendered. Refusals map to `ReportsPayloadError` with the server's code —
 * the UI renders denial for 42501 and the message for P0001 validation.
 */

import { getSupabaseClient } from '../../lib/supabase'

export type ReportPeriod = 'day' | 'week' | 'month'

export interface ReportChannelRow {
  type: 'dine_in' | 'delivery' | 'takeaway'
  rounds: number
  net_total: number
}

export interface ReportBestSeller {
  item_id: string
  name: string
  quantity: number
}

export interface BranchSalesReport {
  branch_id: string
  period: ReportPeriod
  from: string
  to: string
  rounds_submitted: number
  rounds_voided: number
  net_total: number
  net_tax_total: number
  channels: ReportChannelRow[]
  best_sellers: ReportBestSeller[]
}

export interface BranchVoidRow {
  round_id: string
  voided_at: string | null
  void_reason: string | null
  voided_by_profile_id: string | null
  voided_by_name: string | null
  session_id: string
  session_type: string
  captured_total: number
}

export class ReportsPayloadError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ReportsPayloadError'
    this.code = code
  }
}

function isReportPeriod(value: unknown): value is ReportPeriod {
  return value === 'day' || value === 'week' || value === 'month'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseSalesReport(raw: unknown): BranchSalesReport {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    throw new ReportsPayloadError('malformed', 'The report payload was malformed.')
  }
  const r = raw as Record<string, unknown>
  if (
    typeof r.branch_id !== 'string' ||
    !isReportPeriod(r.period) ||
    typeof r.from !== 'string' ||
    typeof r.to !== 'string' ||
    !isFiniteNumber(r.rounds_submitted) ||
    !isFiniteNumber(r.rounds_voided) ||
    !isFiniteNumber(r.net_total) ||
    !isFiniteNumber(r.net_tax_total) ||
    !Array.isArray(r.channels) ||
    !Array.isArray(r.best_sellers)
  ) {
    throw new ReportsPayloadError('malformed', 'The report payload was malformed.')
  }
  return {
    branch_id: r.branch_id,
    period: r.period,
    from: r.from,
    to: r.to,
    rounds_submitted: r.rounds_submitted,
    rounds_voided: r.rounds_voided,
    net_total: r.net_total,
    net_tax_total: r.net_tax_total,
    channels: r.channels as ReportChannelRow[],
    best_sellers: r.best_sellers as ReportBestSeller[],
  }
}

export async function getBranchSalesReport(input: {
  restaurantId: string
  branchId: string
  period: ReportPeriod
  anchorDate: string
}): Promise<BranchSalesReport> {
  const { data, error } = await getSupabaseClient().rpc('get_branch_sales_report', {
    p_restaurant_id: input.restaurantId,
    p_branch_id: input.branchId,
    p_period: input.period,
    p_anchor_date: input.anchorDate,
  })
  if (error) {
    throw new ReportsPayloadError(error.code ?? 'unexpected', error.message)
  }
  return parseSalesReport(data)
}

export async function getBranchVoidReport(input: {
  restaurantId: string
  branchId: string
  limit?: number
}): Promise<BranchVoidRow[]> {
  const { data, error } = await getSupabaseClient().rpc('get_branch_void_report', {
    p_restaurant_id: input.restaurantId,
    p_branch_id: input.branchId,
    p_limit: input.limit ?? 100,
  })
  if (error) {
    throw new ReportsPayloadError(error.code ?? 'unexpected', error.message)
  }
  if (!Array.isArray(data)) {
    throw new ReportsPayloadError('malformed', 'The void report payload was malformed.')
  }
  return data as unknown as BranchVoidRow[]
}
