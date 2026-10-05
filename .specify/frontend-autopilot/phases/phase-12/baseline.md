# Phase 12 baseline — Realtime, Notifications & Subscription Awareness UX (specs/032)

Recorded 2026-10-04 at checkpoint `6591d49` (feat(031) pushed to origin/main; tree clean).

## What already exists (the audit that narrows this phase)

| Plan component | Existing artifact (from earlier phases) | Gap |
| --- | --- | --- |
| `ConnectionBanner` | `src/components/shell/OfflineBanner.tsx` (023): full state matrix healthy/offline/reconnecting/**recovered** (4s transient) + Retry now, polite `role="status"`, pinned copy in `e2e/shell.test.ts` ('Back online — live updates restored.') | none functional |
| staff-board connection | `ReconnectingBanner` (029) on BOTH boards (`CashierRoundsPage`, `KitchenDashboardPage`) wired to each binding's `onStatus`; pinned in cashier.operations (visible → hidden) | copy is board-local, not sourced from one policy |
| `LiveStatusBadge` | `LiveBadge` (029/030) freshness badge on both boards + customer 'Updated Xs ago' (025, pinned regexes + cadence window in customer.menu) | none — a second always-on badge would duplicate |
| `NewRoundCue` | `useNewRoundCue` (012) + `NewRoundCueBanner`/`DashboardLiveCue` (029): event-derived, single-slot (supersede), auto-clear on advance, Dismiss + 'Show the new order' path, pinned in realtime.test | supersede/coalesce semantics not unit-pinned |
| `SubscriptionBanner` | `platform/SubscriptionBanner.tsx` (014): disabled/nearing/expired rendered with `data-banner-state`; active/never_activated silent; E2E pins for expired + disabled in platform.surfaces | no owner-facing detail; 'ordering not affected' only on expired copy |
| `AnnouncementHost` | none — announcement decisions are implicit in each component | **the gap FR-07 names** |
| `SubscriptionDetailPanel` | none | **the gap FR-05 names** |
| FR-08 activity panel | — | default NOT built (plan default) |

## Binding infrastructure (untouchable)

`useRealtimeInvalidation`: invalidation-only (payloads never rendered), 200 ms coalescing, SUBSCRIBED → recovery refetch, optional `onStatus` → `realtimeStatus.ts` registry (aggregate online/reconnecting merged with navigator.onLine at the shell). Customer 10 s poll unchanged.

## Frozen pins this phase must not move

- shell.test: 'Back online — live updates restored.', Retry now, banner role=status.
- cashier.operations: `reconnecting-banner` visible → hidden journey.
- customer.menu: `Updated \d+s ago` regex + Refresh + cadence window.
- realtime.test (4 journeys) incl. cue render after SUBSCRIBED.
- platform.surfaces: `subscription-banner` `data-banner-state` = expired/disabled + kill-switch entry lock.

## Sign-in budget (§12.5)

New E2E adds 3 sign-ins total (platformAdmin + alice for the nearing_expiration journey; alice for the cue/no-payload leg) under a new cross-file `subscriptionLock` mutex shared with platform.surfaces' date tests.
