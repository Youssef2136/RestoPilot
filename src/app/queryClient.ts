import { QueryClient } from '@tanstack/react-query'

/**
 * The app's QueryClient policy (spec 021 FR-05; research.md R1/R2).
 *
 * Phase 01 codifies the behavior the app already exhibits — it does not
 * change it. Every default below is either the TanStack Query v5 default the
 * module-level client previously ran with, or a documented per-hook deviation
 * that stays in its hook:
 *
 * - `usePublicRestaurant` — retry: false, staleTime: 60_000
 * - `useSessionContext` / `useSessionMenu` — retry: false (token-scoped reads
 *   must not retry a refused or expired token)
 * - `useSessionRounds` — retry: false, refetchInterval: 10_000 (the
 *   customer's poll is their live order status; realtime is staff-only)
 * - realtime `SUBSCRIBED` recovery refetch — src/features/realtime (unchanged)
 *
 * Any future deviation that would alter observable behavior is a clarify
 * question with the owner — never a silent default change (spec 021 FR-05;
 * the policy statement lives in docs/development.md).
 *
 * The factory shape lets tests pin these defaults without touching the app
 * singleton (tests/unit/queryClient.test.ts).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // TanStack v5 defaults, kept verbatim: staff reads retry transient
        // failures, navigate-refetch freshness, window-focus refetch as the
        // complement to realtime invalidation.
        retry: 3,
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        // RPC-only business writes never auto-resubmit: a failed mutation
        // surfaces the server's message verbatim (FA-7), and E2E asserts
        // single-submit refusal semantics.
        retry: false,
      },
    },
  })
}

/** The application's single client (composition: src/app/App.tsx). */
export const queryClient = createQueryClient()
