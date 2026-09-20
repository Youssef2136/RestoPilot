# Contract: Database Functions (spec 008)

The two new RPCs. Both are `security definer`, `set search_path = ''`,
schema-qualified, token-authorized as their first act — the session token is the
only identity input, and unknown/tampered/closed sessions produce the
established indistinguishable refusal (`P0001` "This session is no longer
available."). Zero direct table access for any client role; these functions are
the only write path to the four new tables.

## §1 `submit_round(p_token text, p_items jsonb) → jsonb`

Grant: `anon, authenticated`.

Validation chain, in order, each act before the next:

1. Token → session (hash lookup, session open) — the indistinguishable refusal otherwise.
2. `p_items` is a non-empty jsonb array of 1..50 lines; each line: `item_id` a
   UUID string, `extras` an array (string ids or `{extra_id}` objects, ≤ 20
   per line), `quantity` an integer 1..99 — malformed → `P0001` "A cart line is
   malformed." / empty → `P0001` "A cart line is required." / bounds → `P0001`
   "A quantity must be between 1 and 99."
3. Every item exists in the session's restaurant (`menu_items`), is
   `is_available`, and is not overridden unavailable at the session's branch
   (`branch_unavailable_items`) — refusal `P0001` "This item is not available
   here." naming nothing else (per-line first failure; zero rows written).
4. Every extra id exists under its submitted item (`menu_item_extras`
   composite scope) — refusal `P0001` "An extra does not belong to its item."
5. Taxes: `private.calculate_tax_totals(session.branch_id, selections)` — the
   computation core extracted verbatim from the 006 engine
   (`20260920103000_tax_core_split.sql`; the staff-facing
   `calculate_branch_taxes` is now a thin authorizing delegator over it). The
   token authorization in step 1 IS this call's authorization — the core's
   own validation applies and its refusal propagates verbatim.
6. Inserts (one transaction): the round (`state 'new'`, `subtotal` and
   `tax_total`/`tax_lines` from the engine's output), one `round_items` row per
   line (`unit_price` = the menu price, captured), one `round_item_extras` row
   per selected extra (`price_adjustment` captured), exactly one
   `kitchen_tickets` row (state `'new'`).

Returns:

```json
{
  "round": { "id", "restaurant_id", "branch_id", "session_id", "state",
             "subtotal", "tax_total", "tax_lines", "created_at" },
  "ticket_id": "…",
  "items": [ { "id", "item_id", "quantity", "unit_price",
               "extras": [ { "extra_id", "price_adjustment" } ] } ]
}
```

## §2 `get_session_rounds(p_token text) → jsonb`

Grant: `anon, authenticated`.

Token → session (open) — the indistinguishable refusal otherwise. Returns the
session's rounds ordered by `created_at`, each with its items (and their
extras) and the captured tax lines exactly as submitted:

```json
{ "rounds": [ { "id", "state", "subtotal", "tax_total", "tax_lines",
                "created_at",
                "items": [ { "id", "item_id", "name", "quantity", "unit_price",
                             "extras": [ { "extra_id", "name", "price_adjustment" } ] } ] } ] }
```

Item and extra names join from the menu tables at read time (display data);
the captured prices/adjustments are the round's own columns (the snapshot).

## §3 Authorization summary

| Caller | `submit_round` | `get_session_rounds` |
| --- | --- | --- |
| `anon` with a valid session token | ✓ own session | ✓ own session |
| `authenticated` with a valid session token | ✓ own session | ✓ own session |
| Any caller, unknown/tampered/closed token | ✗ the indistinguishable refusal | ✗ the indistinguishable refusal |

No staff or admin surface reads rounds in this phase (FR-013); no client role
can write the four tables directly (the zero-grant posture).

## §4 Error vocabulary

`P0001` with the messages quoted above; the session refusal is byte-identical
with feature 007's. `42501` is not produced by these functions (their
authorization IS the token; grants are `anon`-wide). The 006 engine's own
refusals (malformed selection) may surface for hostile payloads — fail closed
before any write either way.
