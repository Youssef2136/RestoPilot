# Data Model: Delivery and Takeaway (Phase 9)

Deltas only — everything else inherits Phases 2–8 unchanged.

## `sessions` (alter)

| Change | Detail |
|---|---|
| `sessions_type_check` widens | `type in ('dine-in', 'delivery', 'takeaway')` (drop-and-add) |
| NEW `delivery_address text null` | `delivery_address_check`: null OR `length(btrim(x)) between 1 and 200` |
| NEW `sessions_delivery_address_required_check` | `type <> 'delivery' or delivery_address is not null` — the DB enforces FR-003's presence rule |
| Immutability | No UPDATE path exists for the column (no RPC writes it after entry; zero table grants) |

## `rounds` (alter)

| Change | Detail |
|---|---|
| `rounds_state_check` widens | `('new','accepted','preparing','ready','out_for_delivery','completed','lock')` — drop-and-add |

The extended delivery machine (§8.3):

```
new → accepted → preparing → ready → out_for_delivery → completed   (delivery)
new → accepted → preparing → ready                                  (takeaway — then cutoff)
new → accepted → preparing → ready → lock                           (dine-in, unchanged)
```

`lock` stays the dine-in terminal; `completed` is delivery's terminal. Transition
authorization: `out_for_delivery`/`completed` = cashier/branch_manager/owner on
DELIVERY sessions only (FR-005/FR-006), kitchen denied.

## `kitchen_tickets` — UNCHANGED

The ticket machine ends at `ready` for every channel (research §4). `out_for_delivery`
and `completed` are round-only states.

## New/changed RPCs

| RPC | Change |
|---|---|
| `open_session_channel(uuid, uuid, text, text, text, text)` | NEW — non-dine-in entry; returns the 007 entry payload shape |
| `submit_round` | Adds the channel cutoffs (FR-007) before the existing validation chain |
| `mark_out_for_delivery(uuid)` | NEW — `ready → out_for_delivery`, delivery only |
| `mark_completed(uuid)` | NEW — `out_for_delivery → completed`, delivery only |
| `get_branch_rounds` / `get_session_bill` | Payload adds `session_type`, and `delivery_address` for delivery sessions |
| `get_kitchen_queue` | UNCHANGED (channel-blind, money-blind) |

## Audit vocabulary (extends §8/§37)

| action | resource_type | reason |
|---|---|---|
| `round.out_for_delivery` | `round` | null |
| `round.completed` | `round` | null |

## Seed additions

Two fixture sessions (Blue Olive/Downtown): one `delivery` (address "12 Marina Walk"),
one `takeaway`, each with a dev token (`dev-token-downtown-delivery-2026`,
`dev-token-downtown-takeaway-2026`) and no rounds — histories start empty.
