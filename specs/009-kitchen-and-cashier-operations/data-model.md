# Data Model: Kitchen and Cashier Operations (Phase 8)

**Delta over Phase 7** — no new tables, no new columns, two check constraints
widen, seven new functions. The order tables keep **zero grants** (Constitution
IV); the RPCs remain the only write paths.

## State machines (the plan's §8.2 flow, defined here)

```text
rounds.state:          new → accepted → preparing → ready → lock (terminal)
kitchen_tickets.state: new → accepted → preparing → ready   (no lock; the round carries it)
```

- Both columns widen via `drop constraint … / add constraint … check (…)` in
  the lifecycle migration. Existing rows are all `'new'` (Phase 7 closed the
  checks); no backfill.
- The transition RPCs keep round and ticket in sync inside one transaction:
  accept/lock write both (ticket follows the round through `accepted`; the
  ticket's row is updated to match while stopping short of `lock`),
  preparing/ready write the ticket and mirror the round.

## Constraints (after the migration)

- `rounds_state_check`: `check (state in ('new', 'accepted', 'preparing', 'ready', 'lock'))`
- `kitchen_tickets_state_check`: `check (state in ('new', 'accepted', 'preparing', 'ready'))`
- Everything else unchanged from `20260920090000_order_schema.sql` (quantity
  bounds, money bounds, structural uniques, the one-per-round partial index,
  composite tenancy FKs, zero grants, RLS enabled with no policies).

## Functions added (all `security definer`, `set search_path = ''`)

| Function | Reads/writes | Notes |
|---|---|---|
| `accept_round(p_round_id uuid)` | rounds + tickets + audit | guard `where … and state = 'new'` |
| `start_preparation(p_round_id uuid)` | tickets + rounds + audit | guard `and tickets.state = 'accepted'` |
| `mark_round_ready(p_round_id uuid)` | tickets + rounds + audit | guard `and tickets.state = 'preparing'` |
| `lock_round(p_round_id uuid)` | rounds + tickets + audit | guard `and state = 'ready'`; terminal |
| `modify_round_line(p_round_id uuid, p_item_id uuid, p_action text, p_quantity integer default null)` | round_items/round_item_extras + rounds money + audit | engine re-derivation |
| `get_branch_rounds(p_branch_id uuid)` | read: rounds + items + session/table labels | cashier dashboard |
| `get_kitchen_queue(p_branch_id uuid)` | read: tickets + items — **no money keys** | kitchen dashboard |
| `get_session_bill(p_session_id uuid)` | read: the session's rounds' captured money | bill panel |

## Refusals (the established vocabulary)

- Unreachable/insufficient staff scope → `42501` with the action's own
  permission message (the close_session wording pattern).
- Illegal transition / unknown round → `P0001` `'This round is not available
  for that action.'` — one generic message for every state problem
  (unknown/tampered id included; the 007 indistinguishability posture applied
  to state).
- Modification on a frozen round or a quantity that would go below the floor →
  the same generic `P0001`.

## Audit rows (through `private.record_audit`)

| action | resource_type | reason |
|---|---|---|
| `round.accepted` | `round` | null |
| `ticket.preparing` | `ticket` | null |
| `ticket.ready` | `ticket` | null |
| `round.locked` | `round` | null |
| `round.item_removed` | `round_item` | `removed N × <item name>` |
| `round.item_quantity_reduced` | `round_item` | `quantity N → M` |

Actor = the caller's profile id (JWT-derived, never a client value); scope =
the round's restaurant/branch.
