/*
 * The platform hooks (spec 014 T006): the console's overview query and the
 * tenant banner's subscription query, plus the two mutations (dates, kill-
 * switch). Mutations invalidate the overview on success — the next render
 * refetches the truth (no optimistic writes, the house posture).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getMySubscription,
  getPlatformOverview,
  setRestaurantPlatformDisabled,
  setSubscriptionDates,
} from './platformClient'

export function platformOverviewKey() {
  return ['platform', 'overview'] as const
}

export function mySubscriptionKey() {
  return ['platform', 'mySubscription'] as const
}

export function usePlatformOverview() {
  return useQuery({
    queryKey: platformOverviewKey(),
    queryFn: getPlatformOverview,
  })
}

export function useMySubscription() {
  return useQuery({
    queryKey: mySubscriptionKey(),
    queryFn: getMySubscription,
  })
}

export function useSetSubscriptionDates() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setSubscriptionDates,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: platformOverviewKey() })
      void queryClient.invalidateQueries({ queryKey: mySubscriptionKey() })
    },
  })
}

export function useSetPlatformDisabled() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setRestaurantPlatformDisabled,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: platformOverviewKey() })
      void queryClient.invalidateQueries({ queryKey: mySubscriptionKey() })
    },
  })
}
