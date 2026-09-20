# Data Model: Cart and Rounds (Phase 7)

Created 2026-09-20 · the four new tables, their constraints, and the zero-grant posture.
Column order below is the migration's ordinal order (the schema suite asserts it).

## `rounds`

One customer submission — the atomic transaction's primary artifact.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` |
| `restaurant_id` | `uuid` | not null; FK → `restaurants(id)` |
| `branch_id` | `uuid` | not null; composite FK → `branches(restaurant_id, id)` |
| `session_id` | `uuid` | not null; composite FK → `sessions(restaurant_id, id)` |
| `state` | `text` | not null default `'new'`; check `state in ('new')` — the closed shape Phase 8 extends |
| `subtotal` | `numeric(14,2)` | not null; check `subtotal >= 0` — the sum of line bases at capture |
| `tax_total` | `numeric(14,2)` | not null; check `tax_total >= 0` — the engine's total at capture |
| `tax_lines` | `jsonb` | not null default `'[]'` — the engine's per-rule lines array at capture |
| `created_at` | `timestamptz` | not null default `now()` |

- Composite FK `rounds_scope_fkey (restaurant_id, branch_id) → branches (restaurant_id, id)`.
- Composite FK `rounds_session_scope_fkey (restaurant_id, session_id) → sessions (restaurant_id, id)`.
- Index `rounds_session_id_idx on (session_id)` — the history read's path.
- Attribution is session-level (clarified): no participant column exists.

## `round_items`

A line of a round — the item, quantity, and the captured unit price.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` |
| `restaurant_id` | `uuid` | not null; FK → `restaurants(id)` |
| `round_id` | `uuid` | not null; composite FK → `rounds(restaurant_id, id)` |
| `item_id` | `uuid` | not null; composite FK → `menu_items(restaurant_id, id)` |
| `quantity` | `integer` | not null; check `quantity between 1 and 99` |
| `unit_price` | `numeric(12,2)` | not null; check `unit_price >= 0` — the menu price at capture (the snapshot) |
| `created_at` | `timestamptz` | not null default `now()` |

- Unique `(round_id, item_id)` — one line per item per round (the client merges duplicate items into quantity).
- Index `round_items_round_id_idx on (round_id)`.

## `round_item_extras`

The structured extras selected on a line, with captured adjustments.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` |
| `restaurant_id` | `uuid` | not null; FK → `restaurants(id)` |
| `round_item_id` | `uuid` | not null; composite FK → `round_items(restaurant_id, id)` |
| `extra_id` | `uuid` | not null; composite FK → `menu_item_extras(restaurant_id, id)` |
| `price_adjustment` | `numeric(12,2)` | not null; check `price_adjustment >= 0` — the extra's adjustment at capture |
| `created_at` | `timestamptz` | not null default `now()` |

- Unique `(round_item_id, extra_id)` — an extra appears once per line (the flat 005 model).

## `kitchen_tickets`

The operational header for one round (§7.5). Its items are the round's items by
construction (research §4) — no copy exists to drift.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` |
| `restaurant_id` | `uuid` | not null; FK → `restaurants(id)` |
| `branch_id` | `uuid` | not null; composite FK → `branches(restaurant_id, id)` |
| `round_id` | `uuid` | not null; composite FK → `rounds(restaurant_id, id)` |
| `state` | `text` | not null default `'new'`; check `state in ('new')` — the closed shape Phase 8 extends |
| `created_at` | `timestamptz` | not null default `now()` |

- **Partial unique index** `kitchen_tickets_one_per_round on (round_id)` — exactly
  one ticket per round, forever.
- Index `kitchen_tickets_branch_id_idx on (branch_id)` — Phase 8's kitchen surface path.

## Posture

- `revoke all on rounds, round_items, round_item_extras, kitchen_tickets from anon, authenticated` — **no grant of any kind follows** (the established zero-grant posture; the RPCs are the only paths).
- RLS enabled on all four tables with no policies (deny-by-default for any direct access).
- All money columns are `numeric` and travel as strings through the client (research §9).
- The engine's `tax_lines` shape is whatever `calculate_branch_taxes` returned at capture — recomputable from the round's own rows (SC-004).
