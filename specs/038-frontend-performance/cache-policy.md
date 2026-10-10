# Cache policy table (FR-04, T005)

**Discipline**: cache keys keep carrying identity/scope exactly as today
(modeled invariant); no new cross-identity caching; no persistent
business-data caches beyond react-query's in-memory cache; prefetch only for
surfaces the identity may already read.

| Query family | Keys | Freshness expectation | Retry | Poll/realtime | Client today | Table↔client diff |
|---|---|---|---|---|---|---|
| Public restaurant (guest landing) | `['public-restaurant', slug]` | staleTime 60 s (guest revisit within a minute reads cache) | false (token<!->range & public read must not retry refused/expired) | none | matches (`usePublicRestaurant`) | none |
| Customer session context/menu | `['session-context', ...]`, `['session-menu', ...]` token-scoped | fresh-on-mount each entry (no cross-token reuse) | false | none (context read once / menu on demand) | matches (`useSessionContext`/`useSessionMenu`) | none |
| Customer rounds | `['session-rounds', ...]` | freshness = the poll; every poll inspected server-side | false | refetchInterval 10 s (customer poll; realtime staff-only) | matches (`useSessionRounds`) | none |
| Staff auth context | `['auth','context', userId]` | fresh on sign-in; removed on sign-out | query default | realtime auth events invalidation | matches (`useAuthContext` effect; key carries the identity — the modeled invariant) | none |
| Staff boards (rounds/open-sessions/kitchen queue) | staff-client keys | realtime-invalidated (stale between events is VISIBLE staleness per 037, cleared by events/refocus) | query default (3) | realtime channel + focus refetch | matches | none |
| Reports | `report*` keys incl. anchorDate/period | fresh per navigation (staleTime 0); navigation re-derives keys | default (3) | none | matches | none |
| Audit/void logs | filter-param keys | fresh per filter change | default (3) | none | matches | none |
| Mutations (ALL) | per-action | — | **never** (FA-7; 037 D3 manual retry only) | realtime invalidation on success | matches (queryClient mutations retry:false) | none |

**Alignment action required**: none — the client matches the table today
(`src/app/queryClient.ts` documents exactly these defaults+deviations).
The table is the FR-04 written record; future deviations must amend BOTH.

**Prefetch posture (FR-05, D4)**: measured in W7 before any adoption; staff
surfaces only, identity-readable only; customer token reads NEVER prefetched.
