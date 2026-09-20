# Contract: Database Functions (spec 009)

All functions are `public`, `security definer`, `set search_path = ''`, with
the actor derived from `auth.uid()` through the private helpers — never a
parameter. The four order tables keep zero grants; these RPCs are the only
write paths. Grants: `authenticated` only (no anon surface exists in this
phase).

Shared refusal vocabulary:

- Insufficient scope: `42501` — the action's message, e.g. `'You do not have
  permission to update this round.'`
- Any state problem (unknown id, illegal transition, frozen round): `P0001` —
  `'This round is not available for that action.'` (indistinguishable by
  design; the dashboards reflect state through the reads, not error classes).

## §1 `accept_round(p_round_id uuid) → jsonb`

Authorization: cashier or branch_manager whose membership covers the round's
branch; owner of the round's restaurant. Kitchen is denied.

Effect (one transaction): `update rounds set state = 'accepted' where id =
p_round_id and state = 'new' and <tenant guards>` — zero rows ⇒ the generic
refusal. The round's ticket moves `new → accepted` in the same body.
Audit `round.accepted`.

Returns the post-action round payload:

```json
{ "round": { "id", "state", "subtotal", "tax_total", "tax_lines", "created_at",
             "items": [ { "id", "item_id", "name", "quantity", "unit_price",
                          "extras": [ { "extra_id", "name", "price_adjustment" } ] } ] },
  "ticket_state": "accepted" }
```

## §2 `start_preparation(p_round_id uuid) → jsonb`

Authorization: kitchen/cashier/branch_manager of the branch, owner of the
restaurant.

Effect: `update kitchen_tickets set state = 'preparing' where round_id = … and
state = 'accepted'` — zero rows ⇒ refusal. The round mirrors `preparing`.
Audit `ticket.preparing`. Returns the §1 shape with the new states.

## §3 `mark_round_ready(p_round_id uuid) → jsonb`

Authorization: same set as §2. Effect: ticket `preparing → ready`, round
mirrors. Audit `ticket.ready`. Returns the §1 shape.

## §4 `lock_round(p_round_id uuid) → jsonb`

Authorization: cashier/branch_manager of the branch, owner of the restaurant —
**kitchen denied**. Effect: `update rounds set state = 'lock' where … and
state = 'ready'` (terminal; every later action refuses). The ticket stays
`ready`. Audit `round.locked`. Returns the §1 shape with `"ticket_state":
"ready"`.

## §5 `modify_round_line(p_round_id uuid, p_item_id uuid, p_action text, p_quantity integer default null) → jsonb`

Authorization: cashier/branch_manager of the branch, owner of the restaurant —
kitchen denied. Allowed only while the round is `new`/`accepted`/`preparing`
(`ready`/`lock` are frozen → the generic refusal).

- `p_action = 'remove'`: deletes the round_items row (and its extras rows).
- `p_action = 'reduce'`: `p_quantity` must be an integer ≥ 1 and < the line's
  current quantity (reaching 0 is what `remove` is for).

Effect (one transaction): apply the line change, rebuild the selections from
the SURVIVING captured rows (`unit_price`/`price_adjustment` as stored — never
menu-current), re-run `private.calculate_tax_totals`, update the round's
`subtotal`/`tax_total`/`tax_lines`. Audit `round.item_removed` /
`round.item_quantity_reduced` with the before→after reason.

Returns the §1 shape (re-derived money included).

## §6 `get_branch_rounds(p_branch_id uuid) → jsonb`

Read. Authorization: the branch's kitchen/cashier/manager, the restaurant's
owner (the `list_open_sessions` predicate). Returns ALL rounds of the branch's
open and closed sessions with per-round lines (names joined), captured money,
state, and the session/table labels — the cashier dashboard's dataset,
ordered newest-first.

## §7 `get_kitchen_queue(p_branch_id uuid) → jsonb`

Read. Authorization: same predicate as §6. Returns the branch's non-locked
tickets grouped by state (`new`/`accepted`/`preparing`/`ready`) with items,
quantities, extras — **no `unit_price`, no `subtotal`, no `tax_*` keys
anywhere in the payload** (FR-010, test-asserted shape).

## §8 `get_session_bill(p_session_id uuid) → jsonb`

Read. Authorization: staff with reach over the session's branch. Returns the
session's rounds grouped by state with each round's captured `subtotal`,
`tax_lines`, `tax_total`, plus the session's grand total — the exact sum of
the captured values (SC-005). Display-only; no payment concept.

## §9 Grants

```sql
revoke all on function … from public, anon;
grant execute on function … to authenticated;
```

(eight functions, one grant line each; the schema migration grants nothing).
