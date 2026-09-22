import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The reports client unit suite (spec 013 T010; contracts/
 * database-functions.md §1–§2). One seam, mocked: `getSupabaseClient` — no
 * network, no DOM (the house node-environment method).
 *
 * The client must: pass parameters through verbatim (period vocabulary,
 * anchor string), map RPC errors to ReportsPayloadError with the server's
 * code (the 42501/P0001 mapping the pages render), and fail closed on a
 * malformed payload (the audit/staffOps convention). NO arithmetic exists
 * here to test — that absence IS the Constitution II contract.
 */

const harness = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: harness.rpc,
  }),
}))

const { ReportsPayloadError, getBranchSalesReport, getBranchVoidReport } =
  await import('../../src/features/reports/reportsClient')

afterEach(() => {
  harness.rpc.mockReset()
})

const GOOD_REPORT = {
  branch_id: 'b-1',
  period: 'day',
  from: '2026-09-19T00:00:00+00:00',
  to: '2026-09-20T00:00:00+00:00',
  rounds_submitted: 3,
  rounds_voided: 1,
  net_total: 41.5,
  net_tax_total: 6.5,
  channels: [
    { type: 'dine_in', rounds: 2, net_total: 30 },
    { type: 'delivery', rounds: 0, net_total: 0 },
    { type: 'takeaway', rounds: 1, net_total: 11.5 },
  ],
  best_sellers: [{ item_id: 'i-1', name: 'Lamb kebab', quantity: 4 }],
}

describe('getBranchSalesReport', () => {
  it('T010-A passes parameters through verbatim and returns the payload', async () => {
    harness.rpc.mockResolvedValueOnce({ data: GOOD_REPORT, error: null })
    const report = await getBranchSalesReport({
      restaurantId: 'r-1',
      branchId: 'b-1',
      period: 'week',
      anchorDate: '2026-09-19',
    })
    expect(harness.rpc).toHaveBeenCalledWith('get_branch_sales_report', {
      p_restaurant_id: 'r-1',
      p_branch_id: 'b-1',
      p_period: 'week',
      p_anchor_date: '2026-09-19',
    })
    expect(report.rounds_submitted).toBe(3)
    expect(report.channels).toHaveLength(3)
    expect(report.best_sellers[0]!.name).toBe('Lamb kebab')
  })

  it('T010-B maps an RPC refusal to ReportsPayloadError with the server code', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'You do not have permission to read this report.' },
    })
    await expect(
      getBranchSalesReport({
        restaurantId: 'r-1',
        branchId: 'b-2',
        period: 'day',
        anchorDate: '2026-09-19',
      }),
    ).rejects.toMatchObject({ code: '42501', name: 'ReportsPayloadError' })
  })

  it('T010-C maps a validation refusal (P0001) through the same error type', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'validation failed' },
    })
    await expect(
      getBranchSalesReport({
        restaurantId: 'r-1',
        branchId: 'b-1',
        period: 'quarter' as never,
        anchorDate: '2026-09-19',
      }),
    ).rejects.toMatchObject({ code: 'P0001' })
  })

  it('T010-D fails closed on a malformed payload', async () => {
    harness.rpc.mockResolvedValueOnce({ data: { hello: 'world' }, error: null })
    await expect(
      getBranchSalesReport({
        restaurantId: 'r-1',
        branchId: 'b-1',
        period: 'day',
        anchorDate: '2026-09-19',
      }),
    ).rejects.toMatchObject({ code: 'malformed' })
    harness.rpc.mockResolvedValueOnce({ data: null, error: null })
    await expect(
      getBranchSalesReport({
        restaurantId: 'r-1',
        branchId: 'b-1',
        period: 'day',
        anchorDate: '2026-09-19',
      }),
    ).rejects.toBeInstanceOf(ReportsPayloadError)
  })
})

describe('getBranchVoidReport', () => {
  it('T010-E returns the void rows and defaults the limit', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: [
        {
          round_id: 'r-9',
          voided_at: '2026-09-19T13:00:00+00:00',
          void_reason: 'Guest left',
          voided_by_profile_id: 'p-3',
          voided_by_name: 'Carla',
          session_id: 's-1',
          session_type: 'dine-in',
          captured_total: 21.5,
        },
      ],
      error: null,
    })
    const rows = await getBranchVoidReport({ restaurantId: 'r-1', branchId: 'b-1' })
    expect(harness.rpc).toHaveBeenCalledWith('get_branch_void_report', {
      p_restaurant_id: 'r-1',
      p_branch_id: 'b-1',
      p_limit: 100,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.void_reason).toBe('Guest left')
  })

  it('T010-F fails closed when the payload is not an array', async () => {
    harness.rpc.mockResolvedValueOnce({ data: { surprise: true }, error: null })
    await expect(
      getBranchVoidReport({ restaurantId: 'r-1', branchId: 'b-1' }),
    ).rejects.toMatchObject({ code: 'malformed' })
  })
})
