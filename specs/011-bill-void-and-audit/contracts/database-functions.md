# Contracts: Database Functions (Phase 10)

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data model**: [data-model.md](data-model.md)

Created 2026-09-21

## §1 `void_round(p_round_id uuid, p_reason text) → jsonb`

Permission: `private.ops_profile_id()` non-null AND
`private.has_branch_role(profile, r.restaurant_id, r.branch_id,
array['cashier','branch_manager'])` on the target round's branch — owner
reach inherited from the membership shape (the 009 predicate).

Validation order (each refusal leaves zero rows changed):

1. `btrim(coalesce(p_reason,'')) = ''` → `P0001` `'A void reason is required.'`
2. `length(btrim(p_reason)) > 500` → `P0001` `'A void reason may be at most 500 characters.'`
3. Identity/permission → `42501` `'You do not have permission to update this round.'`
4. Guarded update (round unknown / already voided / not at the channel's
   void boundary — `lock` dine-in, `out_for_delivery`+ delivery, `ready`
   takeaway) → `P0001` `'This round is not available for that action.'`

Success: round gains `voided/voided_at/voided_by_profile_id/void_reason`
(trimmed, verbatim); the round's `kitchen_tickets` row gains
`voided = true` (same transaction); audit
`('round.void', 'round', round_id, btrim(p_reason), restaurant, branch)`.
Returns the 009 `round_payload` shape plus `voided`, `void_reason`,
`voided_at`. The round's `state` is NEVER changed by a void (research §1) —
consequently the delivery cutoff (which reads `state`) is not resurrected
(FR-011).

## §2 `get_audit_log(p_action text default null, p_branch_id uuid default null, p_limit integer default 100) → jsonb`

Permission: owner (restaurant-wide, `branch_id is null` rows included) /
branch_manager (union of managed branches) / otherwise `42501`
`'You do not have permission to view the audit trail.'`. A `p_branch_id`
outside reach → the same `42501`. `p_limit` clamped 1–200.

Returns `{ entries: [{ id, action, resource_type, resource_id, reason,
actor_display_name, branch_label, restaurant_id, branch_id, created_at }] }`
ordered `created_at desc, id desc`. `p_action` filters exact-match when
non-null.

## §3 `get_session_bill(p_session_id uuid)` — additive extension

Existing keys unchanged. Added per round: `items[]` (the
`get_branch_rounds` line shape: item_id, name, quantity, unit_price,
extras[] as captured adjustment strings), `voided`, `void_reason`,
`voided_at`. Added top-level: `participants[]` (id, display_name,
joined_at, ordered by joined_at). `grand_total` = sum of non-voided rounds'
`tax_total`-inclusive totals (the existing bill total rule — the captured
per-round total), voided rounds excluded.

`get_kitchen_queue` is unchanged (research §6): the queue stays state-keyed
and channel-blind; a voided ticket's row shows its final state.

## §4 Grants

```sql
revoke all on function public.void_round(uuid, text) from public, anon;
grant execute on function public.void_round(uuid, text) to authenticated;
revoke all on function public.get_audit_log(text, uuid, integer) from public, anon;
grant execute on function public.get_audit_log(text, uuid, integer) to authenticated;
```

## §5 Client contract (staffOps + audit)

- `staffOpsClient.voidRound(roundId, reason)` → `RoundActionResult` + the
  void fields; failures surface as the typed refusal with the verbatim
  message. The mandatory-reason gate is SERVER-side; the client enforces
  only a non-empty prompt (feedback, not authority — Constitution IV).
- `auditClient.getAuditLog(filters)` → the typed entries; react-query keyed
  `['audit', action, branchId]`, invalidated by nothing this phase (the
  trail is read-only display; fresh on mount and refetch-on-focus).
- The bill panel renders the voided section + participants from the
  extended payload; the grand total comes from the payload (FR-003 — the
  client computes nothing).
