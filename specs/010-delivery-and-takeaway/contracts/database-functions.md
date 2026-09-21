# Contracts: Database Functions (Phase 9)

All functions: `public`, `security definer`, `set search_path = ''`, schema-qualified
bodies, identity/token derived server-side, the 007 refusal vocabulary extended per
research §5. Grants: `revoke all … from public, anon; grant execute … to authenticated`
for the staff RPCs; the entry + submission RPCs grant to `anon, authenticated` (the
customer surface, as 007/008).

## §1 `open_session_channel(p_restaurant_id uuid, p_branch_id uuid, p_channel text, p_display_name text, p_phone text, p_delivery_address text default null) → jsonb`

*(Analyze reconciliation 2026-09-21: the deployed signature carries `default null`
on `p_delivery_address` — takeaway callers omit it, and the generated supabase
client type correctly marks it `string | null` optional.)*

Customer entry for delivery/takeaway. Validation order: restaurant/branch exist and are
active (the 007 texts); `p_channel in ('delivery','takeaway')` else
`'Choose delivery or takeaway.'` (P0001); name/phone bounds = the 007 rules; delivery
requires a trimmed non-empty address ≤ 200 chars (`'A delivery address is required.'`),
takeaway ignores any address passed. Creates the session (`type = p_channel`,
`delivery_address` set iff delivery) + participant, issues the token, returns the
007 entry payload shape (`session` incl. `type`/`delivery_address`, `token`,
`participant`). One customer per channel session: calling again on the same branch
does NOT join anything — it opens a NEW session (no table join semantics).

## §2 Cutoff in `submit_round(p_token, p_items)`

After the existing open-session check and BEFORE cart validation, when the session's
type is `delivery`: if any round of the session has state `out_for_delivery` or
`completed` → refuse `'Your order is already on its way — no additional items can be
added.'` (P0001). When the type is `takeaway`: if any round has state `ready` (or
beyond) → refuse `'Your order is ready for pickup — no additional items can be
added.'` (P0001). Dine-in: unchanged behavior. The refusal clears nothing (FR-008).

## §3 `mark_out_for_delivery(p_round_id uuid) → jsonb`

Staff transition `ready → out_for_delivery`. Authorization: cashier/branch_manager/owner
reach (the 009 predicate); kitchen → 42501. Channel guard: the round's session type
must be `delivery` — any other type refuses the generic `'This round is not available
for that action.'` (indistinguishable from a state problem, per 009). Guarded update;
round↔audit sync only (the ticket is untouched — it ended at `ready`). Audit
`round.out_for_delivery`. Returns the 009 action payload shape.

## §4 `mark_completed(p_round_id uuid) → jsonb`

Same contract for `out_for_delivery → completed`. Terminal: nothing fires after
`completed`.

## §5 Read-shape additions

`get_branch_rounds(p_branch_id)` and `get_session_bill(p_session_id)` payloads add
`session_type` per round, and top-level `delivery_address` (null for non-delivery).
`get_kitchen_queue` is unchanged. `get_session_context`/`get_session_menu` already
carry `type`; `get_session_context` additionally echoes `delivery_address` in its
session object (added this phase, spec FR-010's read-only indicator echo — no new
customer read).

## §6 Grants

```sql
revoke all on function open_session_channel(uuid, uuid, text, text, text, text) from public;
grant execute on function open_session_channel(uuid, uuid, text, text, text, text) to anon, authenticated;
revoke all on function mark_out_for_delivery(uuid) from public, anon;
revoke all on function mark_completed(uuid) from public, anon;
grant execute on function mark_out_for_delivery(uuid) to authenticated;
grant execute on function mark_completed(uuid) to authenticated;
```

(`submit_round`'s grant already covers the cutoff.)
