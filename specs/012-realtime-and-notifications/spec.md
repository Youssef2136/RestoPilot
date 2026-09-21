# Feature Specification: Realtime and In-App Notifications (Phase 11)

**Feature Branch**: `012-realtime-and-notifications`

**Created**: 2026-09-21

**Status**: Draft

**Input**: Master plan §22 (Phase 11 — Realtime and In-App Notifications): make operational workflows live. Realtime domains: menu availability, incoming rounds, round state changes, kitchen ticket state, session state, customer order status, operational notifications. Design principles: the database write succeeds first; realtime communicates the new state; clients recover missed events by refetching authoritative state; realtime channels are scoped to authorized restaurant/branch/session context. Security: private realtime access protected through the appropriate realtime authorization model and RLS where applicable; public channels must not carry private restaurant operational data. Exit condition: open clients see authorized state changes without manual refresh while reconnecting safely after network interruptions.

## Clarifications

### Q1: What does "realtime" deliver in this phase — live data pushes, or human notifications?

**Answer (2026-09-21)**: Both, on one substrate. The operational surfaces (cashier rounds, kitchen queue, customer menu/order status, staff sessions) subscribe to database changes so their existing queries refetch when the underlying rows change — the query cache invalidation becomes an EVENT, not a manual refresh. Operational notifications are in-app items derived from the same events (a new round arrives → the cashier sees a live "new round" cue), rendered from already-authorized data. No email/push/SMS — in-app only.

### Q2: How do customers learn their order status live?

**Answer (2026-09-21)**: The customer's order-status surface subscribes to their OWN session's changes only (their token, their session row). They see their rounds' states advance (accepted → preparing → ready / out for delivery) live. They never see other sessions' data, staff-only fields, or money beyond their own bill (which they already reach through the 008 reads).

### Q3: What exactly must the kitchen see live?

**Answer (2026-09-21)**: New tickets for their branch appear without refresh, and ticket states advance live. The queue stays MONEY-FREE and channel-blind in realtime exactly as in the 009 reads (SC-004) — realtime changes what arrives WHEN, never WHAT the payload may carry.

## User Scenarios & Testing

### US1 — The cashier's live dashboard (Priority: P1)

A cashier keeps `/dashboard/rounds` open. A customer submits a round → it appears in the incoming group without a manual refresh. Another staff member advances a round → the card's state group moves live. The void journey from 011 lands live too. The cashier never sees a stale state or acts on a round someone else already handled without the card reflecting it.

**Why first**: it is the workflow where staleness directly causes double-handling and missed orders.

### US2 — The kitchen's live queue (Priority: P1)

Kitchen staff keep `/dashboard/kitchen` open. New tickets appear live; ticket states advance live; the money-free and channel-blind guarantee holds in realtime.

### US3 — The customer's live order status (Priority: P1)

A customer with an open session sees their order status advance live (their rounds' states) without refreshing. When a cutoff or refusal happens server-side, their next view reflects the authoritative state.

### US4 — Operational notifications (Priority: P2)

Staff with a dashboard open receive in-app cues for the operational events in their authorized scope (a new round arrived for their branch). Cues are derived from authorized data, render in-app, and clear naturally as the state advances. No notification leaves the app.

### US5 — Staff sessions and menu availability go live (Priority: P3)

Session-state changes (a session closed at the front desk) and menu-availability changes (an item disabled mid-service) reflect live on the already-open surfaces that read them.

## Requirements

- **FR-001**: Database writes remain the source of truth; realtime only communicates changes that a committed write produced (principle 1, 2)
- **FR-002**: Every realtime subscription is scoped by restaurant/branch/session identity and re-authorized server-side; a client never receives events for rows its roles cannot read
- **FR-003**: Public channels carry no private operational data (customer PII, money of other sessions, kitchen-internal state)
- **FR-004**: On reconnect after a network interruption, clients recover by refetching authoritative state (principle 3); a missed event never leaves a surface stale
- **FR-005**: The cashier's rounds view refetches live on new rounds, state changes, modifications, and voids in their branch scope
- **FR-006**: The kitchen queue refetches live on new tickets and ticket state changes in their branch scope, staying money-free (SC-004)
- **FR-007**: The customer's order-status view refetches live on changes to their own session's rounds
- **FR-008**: In-app notification cues exist for new-round events in the staff's authorized branch scope, rendered from authorized data only (US4)
- **FR-009**: Session-state and menu-availability changes refetch live on the surfaces that display them (US5)
- **FR-010**: Realtime changes never carry money where the corresponding read forbids it (the kitchen queue in realtime = the kitchen queue in REST — the same contract, event-shaped)

## Success Criteria

- **SC-001**: A round submitted by one browser appears in another browser's cashier dashboard within the realtime interval without manual refresh (US1)
- **SC-002**: A kitchen queue in one browser updates when a ticket state changes in another browser, without manual refresh, with zero money keys visible (US2)
- **SC-003**: A customer browser sees their order status advance within the realtime interval without manual refresh (US3)
- **SC-004**: Killing and restoring the network leads to a refetch that reconciles any missed events (US1–US3, FR-004)
- **SC-005**: A client subscribed out of its scope receives no events for foreign rows (FR-002)

## Constraints

- The database write succeeds FIRST; the event is a consequence, never a prerequisite (principle 1)
- No new money computation anywhere; realtime never re-derives captured values
- The existing query cache remains the render path — realtime drives invalidation/refetch of EXISTING queries, not a parallel state system
