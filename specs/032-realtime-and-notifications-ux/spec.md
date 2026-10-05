# specs/032 — Realtime, Notifications & Subscription Awareness UX

**Mode:** Operate · **Depends on:** Phases 03, 05, 09, 10 · **Backend impact: NOT_REQUIRED** (presentation-only; any backend-requiring idea = contract conflict §3.8, recorded not implemented).

## Purpose

One coherent story for "the product tells me things": what arrives live, how it is announced, how a reconnect heals it, and how subscription state is communicated to owners — without implying that expiry stops ordering.

## The narrowing audit (why this phase is smaller than the plan's component list)

Phases 023/029/030 already built most of the plan's named surfaces (see phase-12 baseline.md): the shell's OfflineBanner carries the full connection matrix **including recovered** (E2E-pinned), both staff boards carry LiveBadge + ReconnectingBanner wired to each binding's `onStatus`, the customer's freshness + poll cadence are pinned, and the cue exists with its clear path. The plan's `LiveStatusBadge`/`ConnectionBanner` therefore map onto **existing** artifacts (D1) — building duplicates would add a second truth. The genuinely missing pieces are the ones below.

## Functional requirements → this phase's deliverables

- **FR-01 one connection model** — satisfied by the EXISTING registry + banner/badges; this phase adds the one-place POLICY (D2) so every announcement decision routes through a single module; no new badge (D1).
- **FR-02 cue** — semantics unchanged (D6); supersede/coalesce (a second INSERT supersedes, never stacks) unit-pinned for the first time.
- **FR-03 freshness** — already on both staff boards + customer (pinned); audited, nothing added.
- **FR-04 reconnect → recovery → confirmation** — already implemented (SUBSCRIBED refetch + transient 'recovered' banner, pinned); audited.
- **FR-05 subscription awareness** — NEW `SubscriptionDetailPanel`: a disclosure under the banner with the state vocabulary, the honest 'ordering is not affected by expiry' statement, and the truthful call-to-action (the PLATFORM owner acts, not the restaurant).
- **FR-06 platform-disabled** — the dashboard banner + the platform console already surface it; no new route (D4).
- **FR-07 announcement policy in one place** — NEW `announcementPolicy.ts`: the single mapping (event class → surface + politeness) with the pinned copy strings moving INTO it byte-identically, and a duplicate-suppression guard; toasts are NOT used for passive events (D2).
- **FR-08 activity panel** — NOT built (plan default; no notification store invented) (D3).

## Decisions

- **D1 — Component mapping, not duplication.** `LiveStatusBadge` ≡ existing `LiveBadge`; `ConnectionBanner` ≡ existing `OfflineBanner`/`ReconnectingBanner`. The unification artifact is `announcementPolicy.ts`, not new components.
- **D2 — Toasts stay out of passive announcements.** The toast host remains for user-initiated outcomes; arrivals = the cue's live region, connection = banners, refetch = silent. One event ⇒ one announcement (the policy's dedupe guard).
- **D3 — No activity panel.** FR-08 default holds; `get_audit_log`/branch reads stay their existing surfaces'.
- **D4 — Disabled-state surfaces unchanged.** Dashboard banner (E2E-pinned) + platform console (phase 034's home). No owner route.
- **D5 — Subscription detail = disclosure panel under the banner** (no route), rendered only for a non-silent state, dismissible, never covering primary actions at 390 px.
- **D6 — Cue semantics frozen**: event-derived, single-slot (supersede), auto-clear on the round's first advance, manual Dismiss, 'Show the new order' path; no persistence; no payload fields.
- **D7 — nearing_expiration E2E via the console journey** (start today, end +3 days) under a NEW cross-file `subscriptionLock` mutex (also wrapped around platform.surfaces' two date tests) with an active-state restore — the shared subscriptions row never races.
- **D8 — Realtime transport untouched**: no authorization/publication/filter/poll/coalescing change; the binding files gain no behavioral edit.

## State matrix (as implemented)

Connection: connected / reconnecting / offline / recovered (shell banner; boards show the reconnecting subset). Cue: none / arrived / superseded (single-slot) / dismissed. Freshness: fresh / stale / refetch-in-flight (LiveBadge pulse) / error-with-retry (stale banner). Subscription: never_activated / active (silent) / nearing_expiration / expired / manually disabled (banner + detail). Announcement: cue live region / connection banner / silent.

## Security

Realtime stays policy-filtered server-side; event payloads never rendered (the new E2E asserts the cue carries no payload fields); subscription reads stay self-scoped (`get_my_subscription`); no cache keyed by branch id crosses a restaurant context change.

## Testing

Unit: announcement policy mapping + dedupe; cue supersede; subscription detail copy mapping. E2E new `e2e/live.awareness.test.ts`: nearing_expiration + detail panel (restored), cue no-payload + 390px; existing journeys preserved untouched.

## Exit criteria

Policy module is the single announcement authority; detail panel live with the honest expiry statement; supersede pinned; no payload rendered (E2E); existing journeys pass; no notification infrastructure invented.
