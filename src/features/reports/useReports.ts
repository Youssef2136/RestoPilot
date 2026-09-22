/*
 * The reports hooks (spec 013 T006): branch-keyed queries over the two
 * report RPCs. The client submits period + anchor parameters only — every
 * aggregate arrives computed (Constitution II). Anchors are the
 * representative date strings the pickers produce; the database derives
 * the bucket boundaries.
 */

import { useQuery } from '@tanstack/react-query'
import { getBranchSalesReport, getBranchVoidReport, type ReportPeriod } from './reportsClient'

export function salesReportKey(
  restaurantId: string | null,
  branchId: string | null,
  period: ReportPeriod,
  anchorDate: string,
) {
  return ['reports', 'sales', restaurantId, branchId, period, anchorDate]
}

export function voidReportKey(restaurantId: string | null, branchId: string | null) {
  return ['reports', 'voids', restaurantId, branchId]
}

export function useSalesReport(input: {
  restaurantId: string | null
  branchId: string | null
  period: ReportPeriod
  anchorDate: string
}) {
  return useQuery({
    queryKey: salesReportKey(input.restaurantId, input.branchId, input.period, input.anchorDate),
    queryFn: () =>
      getBranchSalesReport({
        restaurantId: input.restaurantId as string,
        branchId: input.branchId as string,
        period: input.period,
        anchorDate: input.anchorDate,
      }),
    enabled: input.restaurantId !== null && input.branchId !== null,
  })
}

export function useVoidReport(input: { restaurantId: string | null; branchId: string | null }) {
  return useQuery({
    queryKey: voidReportKey(input.restaurantId, input.branchId),
    queryFn: () =>
      getBranchVoidReport({
        restaurantId: input.restaurantId as string,
        branchId: input.branchId as string,
        limit: 200,
      }),
    enabled: input.restaurantId !== null && input.branchId !== null,
  })
}
