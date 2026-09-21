# Research: Realtime and In-App Notifications (Phase 11)

Created 2026-09-21 · resolves the design questions the spec and plan depend on.

## 1. How does Supabase Realtime authorize a subscriber?

Postgres Changes subscriptions are authorized per-row by the table's RLS
SELECT policies at delivery time: Realtime connects with the user's JWT,
sets the claims, and evaluates the policies — a row whose policy rejects
the subscriber is never sent. `wal_level=logical` is already set on the
hosted project and the `supabase_realtime` publication exists (empty).
A table MUST be added to the publication for events to flow at all, and
MUST have RLS enabled for per-row authorization — both are one-time
migrations. Broadcast/Presence channels are application rooms WITHOUT
row-level authorization; using them for private operational data would
violate FR-002/FR-003. Decision: Postgres Changes only.

## 2. The zero-policy gap

`rounds`, `kitchen_tickets`, and `sessions` have RLS ENABLED with ZERO
policies (verified via `pg_policies`). The ordering phase deliberately
routed every read through `security definer` RPCs — the tables are
read-closed to clients. Realtime authorization is policy-based, so:

- Adding the tables to the publication WITHOUT policies delivers nothing
  (fail-closed — safe default, but no feature).
- The phase must add SELECT policies that mirror the RPC role checks
  EXACTLY. The predicate reuses `private.has_branch_role(profile,
  restaurant_id, branch_id, roles)` — the same helper the 009/010/011
  RPCs use — so policy and RPC cannot drift in vocabulary. The policy is
  SELECT-only (no writes through the direct tables — Constitution: the
  RPCs remain the only write path).

Which tables: `rounds` (incoming rounds, state changes, customer status),
`kitchen_tickets` (queue), `sessions` (session state, customer scope
resolution), `branch_unavailable_items` (menu availability — ALREADY has
an availability policy family from 005; realtime reuses it), and
`dining_tables` (table activation state feeds the entry surface).
`branch_menu_availability` doesn't exist — 005's availability lives in
`branch_unavailable_items` (verified).

## 3. The customer's scope: a policy cannot read a header

The customer's only credential is the 007 session token, presented as an
RPC argument — NOT in the JWT — so a plain policy cannot resolve "this
caller's session". RLS policies can only use what the database can see:
JWT claims (`auth.uid()`), the row, and SECURITY DEFINER helpers.
Solution (D4 in plan.md): a `security definer` function
`realtime_session_scope()` that returns `uuid[]` — the session ids the
current caller may observe:

- A caller presenting a VALID dev/session token via
  `current_setting('request.headers', true)::json->>'x-session-token'`…
  is NOT available to postgres (headers are not passed into RLS on the
  realtime path). Final shape: the customer's browser makes ONE
  authenticated call to a new SECURITY DEFINER RPC
  `bind_session_observer(p_token text)` which stores
  `set_config('app.session_observer', p_session_id::text)` — no; per-
  connection state is per-POOL, not per-user in Realtime's pooled
  connections.

RESOLUTION (the deployable one): the customer policy filters
`session_id = any (public.realtime_session_scope(auth.uid()))` where the
function resolves the PROFILE's sessions — but customers have no profile.
FINAL RESOLUTION: customers do NOT subscribe to Postgres Changes at all.
Their live order status uses the 007 `get_session_context` read on the
react-query `refetchInterval` — a 10-second poll — PLUS an immediate
refetch triggered by their own mutations (already the case). This is
honest to the master plan: "clients can recover missed events by
refetching authoritative state" — the customer surface's primary channel
IS the refetch; polling makes it live-adjacent without fabricating a
customer-side authorization model the substrate doesn't support. The
spec's Q2 answer (their own session's status advances live) is met by
the poll cadence within the realtime interval; staff surfaces get true
push. The quickstart asserts the poll cadence as the customer experience.
The remaining four domains are staff-scoped with true push.

## 4. Event → invalidation mapping

| Event | Fires on | Invalidates | Surface |
| --- | --- | --- | --- |
| `rounds` INSERT | a customer submits a round | `branchRoundsKey(branchId)` | cashier (US1) |
| `rounds` UPDATE | accept/start/ready/lock/dispatch/complete/modify/void | `branchRoundsKey(branchId)`, `kitchenQueueKey(branchId)`, `sessionBillKey(*)` | cashier + kitchen (US1/US2) |
| `kitchen_tickets` INSERT/UPDATE | ticket created / start/ready/void mirror | `kitchenQueueKey(branchId)` | kitchen (US2) |
| `sessions` UPDATE | close/lock | staff sessions key + branch rounds | staff sessions (US5) |
| `branch_unavailable_items` INSERT/DELETE | availability toggles | branch menu keys | menu surfaces (US5) |
| `dining_tables` UPDATE | activation | entry/tables keys | entry (US5) |

The client filters subscriptions by `branch_id=eq.<id>` (server-side
filter — filtered-out events never leave the database). The event payload
is used ONLY for its table name; the refetch is through the unchanged
authorized RPC reads (plan D3).

## 5. In-app cues (US4)

No persistence: the cue is a piece of react context state set by the
cashier subscription on `rounds` INSERT, cleared when the round leaves
`new` (the refetched list is the truth). Rendered in the dashboard shell
as a passive live region (`role="status"` — announced by screen readers,
harmless otherwise). Nothing network-outbound exists in this phase.

## 6. Testing strategy

- **Database suite** (`realtime.schema.test.ts`): the policies exist with
  the exact predicates (has_branch_role shapes), the publication carries
  exactly the six tables, INSERT/UPDATE/DELETE flags, RLS still enabled,
  no direct-table grants appeared (the RPC-only write posture holds), and
  the fail-closed direction: a policy-less table delivers nothing
  (asserted structurally, not by socket).
- **Unit suite**: the hook layer — event → invalidator mapping, the
  coalescing window, subscribe/unsubscribe lifecycle, the cue
  set/clear cycle. No sockets (the channel is mocked).
- **e2e suite**: two browser contexts — staff acts, staff/customer
  observes within the realtime interval (SC-001/SC-002/SC-003), the
  money-free assertion over the live kitchen queue, and the refetch
  recovery after a reload (SC-004's browser-shaped proof).
