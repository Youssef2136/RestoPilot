# specs/032 — Plan

## Routes

No new routes. Surfaces touched: the dashboard shell (subscription banner area), the cue components, both staff boards (copy sourcing only).

## Components

| New | Role |
| --- | --- |
| `src/features/realtime/announcementPolicy.ts` | THE one-place announcement policy (FR-07): event classes → { surface, politeness, copy }; pinned connection/cue strings move here byte-identically; `shouldAnnounce` dedupe guard (one event ⇒ one announcement). |
| `src/features/platform/SubscriptionDetailPanel.tsx` | FR-05 disclosure under `SubscriptionBanner`: state vocabulary line, dates, 'ordering is not affected by expiry', who can act (platform owner). Rendered only for nearing_expiration/expired/disabled; `<button aria-expanded>` disclosure; dismissible. |
| `e2e/helpers/subscriptionLock.ts` | Cross-file in-process mutex over the subscriptions row (mirrors t2Lock). |

Modified: `NewRoundCueBanner.tsx` + `ReconnectingBanner.tsx` + `OfflineBanner.tsx` (source their copy/politeness from the policy — strings byte-identical), `SubscriptionBanner.tsx` (mounts the panel), `platform.surfaces.test.ts` (wrap the two date tests in subscriptionLock — zero assertion changes).

## State/data flow

No new reads: the panel consumes `useMySubscription`'s already-fetched payload (shared query key via the existing hook). The policy module is pure (no React) — unit-testable node-environment.

## Backend contracts used

`get_my_subscription` (payload as-is), existing realtime bindings + registry, toast host untouched. Backend impact: **NOT_REQUIRED**.

## Accessibility

Disclosure is a real `<button aria-expanded>` + panel; copy is text (never color/icon-only); no new live regions (the banner keeps `role="status"`, the cue keeps `role="status"` — both pinned); reduced-motion: no new motion at all; no auto-focus; 390px: the panel scrolls within the page, never overlays.

## Testing strategy

Unit (node env): `tests/unit/announcementPolicy.test.ts` (mapping + dedupe + copy parity with the pinned strings), `tests/unit/subscriptionCopy.test.ts` (state → label/copy map incl. the expiry statement), cue supersede (in the policy file's suite or realtime.test extension — NEW tests only). E2E `e2e/live.awareness.test.ts` (2 tests, 3 sign-ins): (1) nearing_expiration via console → owner banner attribute + detail panel open → restore active; (2) cue no-payload (customer's unique name/amount never in the cue region) + 390px overflow pass with banner+cue present. Existing suites untouched (except the two lock wraps).

## Design strategy

022 tokens + existing banner/cue classes; the panel uses the token card treatment (management language) — no new primitives, no motion.

## Responsive

Banner + cue already 390px-safe (pinned journeys); the panel is in-flow (never fixed), so it cannot cover primary actions; assertion: no horizontal overflow with banner + panel open at 390px.

## Risks

Copy strings are pinned in three suites — the policy extraction must be byte-identical (unit test asserts the parity). The subscriptions row is shared: the mutex + restore (D7) is mandatory.
