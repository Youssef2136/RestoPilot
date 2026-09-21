# Contracts: Realtime Client (Phase 11)

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data model**: [data-model.md](data-model.md)

Created 2026-09-21

## §1 `useRealtimeInvalidation(input)` — the subscription hook

```ts
useRealtimeInvalidation({
  branchId: string | null,
  table: 'rounds' | 'kitchen_tickets' | 'sessions' | 'branch_unavailable_items' | 'dining_tables',
  filterColumn?: string,          // default 'branch_id'
  invalidate: () => Promise<unknown>,  // the queryClient invalidators
  refetchOnSubscribe?: boolean,   // default true — the reconnect recovery
})
```

Behavior:

1. One Supabase channel per (table, scope) — channel name
   `realtime:<table>:<scopeValue>`, reused across surfaces via the
   client's channel registry (the same scope twice = one channel)
2. `.on('postgres_changes', { event: '*', schema: 'public', table,
   filter: '<filterColumn>=eq.<scopeValue>' }, handler)`
3. The handler IGNORES the payload contents (it names the table at most)
   and calls a COALESCED invalidate: events inside a 200ms window trigger
   ONE invalidate
4. On `SUBSCRIBED` → one immediate invalidate (the reconnect/refetch
   recovery, FR-004)
5. On `CHANNEL_ERROR`/`TIMED_OUT` → one invalidate when the channel
   returns to `SUBSCRIBED` (the recovery covers the gap; the error
   itself never renders)
6. Cleanup on unmount/scope change: `.removeChannel(channel)`

The hook NEVER renders payload data (plan D3): the reads stay the only
render path.

## §2 `useNewRoundCue(branchId)` — the US4 in-app cue

```ts
const { cue, clearCue } = useNewRoundCue(branchId)
// cue: { roundId: string } | null
```

- Subscribes to `rounds` INSERT for the branch (its own channel via §1's
  registry), sets `cue` on INSERT
- Clears when the round leaves `new` (a `rounds` UPDATE event for that id
  → the next refetch decides; the cue clears on the UPDATE event for
  simplicity — the refetched list is the truth either way)
- Rendered as `<div role="status" data-live-cue>` in the dashboard shell;
  text is derived ("A new order arrived."), never payload data

## §3 Wire-in contract per surface

| Surface | Subscription | Invalidates |
| --- | --- | --- |
| `CashierRoundsPage` | `rounds` @ branch | branchRounds + kitchenQueue + sessionBill (all keys) |
| `KitchenDashboardPage` | `kitchen_tickets` @ branch (+ `rounds` for new tickets) | kitchenQueue |
| `StaffSessionsPage` | `sessions` @ branch | staffSessions keys |
| `BranchMenuPage` | `branch_unavailable_items` @ branch | the branch menu query |
| `DashboardPage` (shell) | `useNewRoundCue` | none (cue state only) |

## §4 What realtime does NOT do

- No payload rendering (§1.6) — no money, no PII, no kitchen state from events
- No customer Postgres subscription (research §3: the customer surface's
  live-adjacent status is the 10s poll + mutation refetch through
  `get_session_context`/`get_session_menu` — unchanged reads)
- No new write paths, no optimistic state, no event-sourced local state
