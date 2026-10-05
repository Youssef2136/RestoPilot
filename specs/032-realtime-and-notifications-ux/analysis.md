# specs/032 — Analysis (pre-implementation)

- The plan's component list predates 023/029/030; the narrowing audit (baseline.md) maps every named component onto an existing artifact. Building duplicates was rejected (D1) — the phase's unification artifact is the announcement policy.
- Announcement inventory (current): customer submission → cue live region (role=status, 'A new order arrived.', Dismiss + 'Show the new order'); transport loss → boards' ReconnectingBanner (aria-live=polite, board copy) + shell OfflineBanner ('Reconnecting to live updates…'); navigator offline → shell ('You're offline…'); recovery → shell transient 'Back online — live updates restored.' (4 s, wasInterrupted machine); refetch → silent (invalidation-only); subscription → banner (status/alert) for 3 of 5 states. No duplicate-announcement path exists today; the policy makes that structural (F4).
- Toast host exclusion (D2): the host is for user-initiated outcomes (023); routing passive events there would double-announce against the live regions.
- Subscription payload is already fetched by `useMySubscription` (shared key) — the panel adds zero new reads; the copy map is pure and unit-testable.
- nearing_expiration derivation is server-side (≤7 days before end_date): the E2E drives it through the console (start=today, end=+3) exactly like platform.surfaces' expired flow, under the new mutex, then restores active.
- Sign-in budget: 3 new sign-ins total; existing journeys untouched.
