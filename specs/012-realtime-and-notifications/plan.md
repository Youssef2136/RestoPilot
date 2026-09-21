# Implementation Plan: Realtime and In-App Notifications (Phase 11)

**Branch**: `012-realtime-and-notifications` | **Spec**: [spec.md](spec.md) | **Created**: 2026-09-21

## Summary

Make the operational surfaces live WITHOUT a parallel state system: the
existing Supabase client's Postgres-Changes realtime subscriptions fire on
committed writes to the ordering tables; the handlers invalidate the
ALREADY-EXISTING react-query keys; the next render refetches through the
unchanged authorized RPC reads. Realtime changes WHEN data arrives, never
WHAT data may be read — the read layer (RLS + security-definer RPCs) stays
the boundary. In-app cues (US4) are derived in the client from the same
subscription events; nothing leaves the app.

## Technical Context (from the codebase)

- `@supabase/supabase-js` v2.116 is already the data layer (`src/lib/supabase.ts`); realtime is the same client's `.channel()` API — no new dependency
- Hosted Supabase: `wal_level=logical` confirmed; `[realtime] enabled = true` in `supabase/config.toml`; `supabase_realtime` publication exists with ZERO tables
- Authorization model: tenant tables carry RLS (enabled on rounds, kitchen_tickets, sessions, menu_items, …) but ordering-era tables were read EXCLUSIVELY through `security definer` RPCs — no per-role SELECT policies exist on `rounds`/`kitchen_tickets`/`sessions`
- React Query (`@tanstack/react-query`) owns every server read; keys and invalidation helpers already exist (`branchRoundsKey`, `kitchenQueueKey`, `sessionBillKey`, `auditLogKey`, menu/session keys)

## Constitution Alignment

- **I (the client displays the server's captured truth)**: realtime drives refetch of the captured truth; no client-side state projection
- **II (money math is server-only)**: events carry no money the reads don't already authorize; the queue stays money-free in event shape (FR-010)
- **IV (the data layer is the authorization boundary)**: Realtime RLS policies mirror the RPC role checks; a subscriber receives only rows its identity may read (FR-002/FR-003)
- **V (privacy)**: no new PII surfaces; customers subscribe to their own session only

## Design Decisions

### D1 — Postgres Changes + RLS (not Broadcast channels)

The spec's principle 4 ("channels scoped to authorized context") and the
Security section ("RLS where applicable") map to Postgres Changes with
per-table RLS: Realtime authorizes each subscriber against the policies
BEFORE delivering a row event. Private operational data therefore flows
only to authorized identities BY THE DATABASE'S OWN RULES — no
application-level channel secret to leak, no public-channel risk (FR-003).

### D2 — The missing SELECT policies are part of this phase

Realtime authorization reads the tables' SELECT policies. `rounds`,
`kitchen_tickets`, and `sessions` have RLS ENABLED but ZERO policies →
without policies every realtime subscriber sees nothing; with loose
policies they'd see too much. This migration adds exactly the SELECT
policies that mirror the RPC role checks:

- `rounds`/`kitchen_tickets`/`sessions` SELECT: staff over the row's branch (owner restaurant-wide via the membership shape, branch staff via their branch_id) — the 009 `get_branch_rounds`/`get_kitchen_queue` predicate, policy-shaped
- The customer path needs NO policy: customers never read these tables directly (they read through token-RPCs); their live status uses the STAFF-scoped subscription only where they hold a staff membership — for customers, refetch-on-event of their own session uses the session-token filter through the SAME RPC (their subscription filters on `session_id`, and the RLS policy above is staff-only, so a customer's direct subscribe receives nothing — their live status comes from their poll-after-event posture; see D4)

### D3 — Events invalidate queries; queries remain the only render path

A tiny `useRealtimeInvalidation` hook per surface subscribes (via
`getSupabaseClient().channel(...)`) to the table events for its scope and
calls the existing queryClient invalidators. No event payload is ever
rendered — the payload only names WHAT changed; the refetch pulls the
authorized truth. On `SUBSCRIBED` → refetch once (recover missed events on
reconnect, principle 3 / FR-004); on channel error → refetch (the posture
already covers staleness).

### D4 — The customer's live status

Customers hold no staff membership, so staff-scoped RLS delivers them
nothing — correct (FR-002/FR-003). Their live order status subscribes to
`rounds` filtered by their own `session_id=eq.<id>`; delivery of that
event still requires a policy. Adding a narrowly-scoped SELECT policy
(`session_id in (select id from sessions where token = current dev token)`
is not expressible — the token is hashed client-side…). RESOLUTION: the
customer's session identity lives in `sessions.token`; expose a
SECURITY DEFINER function `realtime_session_scope()` returning the
session ids the CURRENT caller (by token or staff membership) may
observe, and write the customer policy as
`session_id = any (select public.realtime_session_scope())` — a single
narrow gate reusing the 007 token discipline. The customer's payload via
RLS would carry full rows; the client NEVER renders the payload (D3) —
it only refetches through `get_session_context`/`get_session_menu`.

### D5 — In-app cues (US4) are event-derived, not stored

A new-round event on the cashier's subscription raises a toast/cue in the
dashboard shell; the cue lives in a small react state context, auto-clears
when the round leaves `new`, and renders nothing but derived text (no
payload data beyond what the refetched list already shows). No notification
table, no persistence — the master plan's "operational notifications" for
this phase is in-app only (Q1).

## Publication (migration)

`alter publication supabase_realtime add table rounds, kitchen_tickets,
sessions, branch_unavailable_items, dining_tables, sessions;` — the six
domains of §22 (menu availability = `branch_unavailable_items`, session
state = `sessions`, customer status = `rounds` filtered, incoming rounds =
`rounds`, ticket state = `kitchen_tickets`, notifications derive from the
same events). INSERT+UPDATE+DELETE only for the keys the reads need;
row-level filters do the rest.

## Risks / Mitigations

- **RLS policy drift vs RPC checks** — the policies reuse the SAME
  membership predicate helper (`private.has_branch_role`) the RPCs use;
  the database suite asserts both directions (a cashier receives own-branch
  events; fiona receives none; a customer receives only their session's)
- **Event storms** — invalidation is debounced per query key (react-query
  batches refetches naturally; the hook coalesces events in a 200ms window)
- **Reconnect staleness** — every `SUBSCRIBED` status transition triggers
  one refetch; SC-004 is a refetch proof, not an event-replay proof

## Feature → Task Mapping

- Migration (policies + publication): T002
- Realtime hook layer: T004–T005
- Cashier live (US1): T006 · Kitchen live (US2): T007 · Customer live (US3): T008
- In-app cues (US4): T009 · Sessions/availability live (US5): T010
- Database realtime suite: T003 · e2e live suite: T011 · unit suite: T012
- Polish (docs, determinism, gate, walkthroughs, commit): T013–T018

See [research.md](research.md) for the RLS/realtime authorization model
deep-dive and [data-model.md](data-model.md) for the exact policy/publish
SQL, [contracts/realtime-client.md](contracts/realtime-client.md) for the
hook API, [quickstart.md](quickstart.md) for the acceptance walkthroughs.
