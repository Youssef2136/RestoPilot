# Data Model: Bill, Void, and Audit (Phase 10)

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

Created 2026-09-21

## Schema changes

### `public.rounds` — the void overlay

```sql
alter table public.rounds
  add column voided boolean not null default false;
alter table public.rounds
  add column voided_at timestamptz;
alter table public.rounds
  add column voided_by_profile_id uuid references public.profiles (id);
alter table public.rounds
  add column void_reason text;
-- One constraint pair keeps the overlay internally consistent: a voided row
-- carries WHO/WHEN/WHY; a non-voided row carries none of them.
alter table public.rounds
  add constraint rounds_void_overlay_check
  check (
    (voided and voided_at is not null and voided_by_profile_id is not null
      and void_reason is not null and length(btrim(void_reason)) between 1 and 500)
    or
    (not voided and voided_at is null and voided_by_profile_id is null
      and void_reason is null)
  );
```

### `public.kitchen_tickets` — the void mirror

```sql
alter table public.kitchen_tickets
  add column voided boolean not null default false;
```

Set in the same transaction as the round's void (one RPC body). No
`voided_at`/`voided_by` on the ticket — the round is the source of truth;
the ticket only needs the display flag.

### No other schema changes

`audit_log` is unchanged (append-only; the `reason` column already exists).
`session_participants` is unchanged (the bill reads it as-is).

## New RPCs

### `public.void_round(p_round_id uuid, p_reason text) → jsonb`

`security definer`, `volatile`, `set search_path = ''`. Refusal vocabulary:

| Condition | Error |
| --- | --- |
| No ops profile / no cashier+ role on the round's branch | `42501` `You do not have permission to update this round.` |
| Reason blank after trim | `P0001` `A void reason is required.` |
| Reason > 500 chars after trim | `P0001` `A void reason may be at most 500 characters.` |
| Round unknown, not at the channel's void boundary, or already voided | `P0001` `This round is not available for that action.` |

The guarded update (one statement, race-safe):

```sql
update public.rounds r
set voided = true,
    voided_at = now(),
    voided_by_profile_id = v_profile_id,
    void_reason = btrim(p_reason)
where r.id = p_round_id
  and r.voided = false
  and (
    (r.state = 'lock')                                    -- dine-in
    or (r.state in ('out_for_delivery', 'completed')      -- delivery
        and exists (select 1 from public.sessions s
                    where s.id = r.session_id and s.type = 'delivery'))
    or (r.state = 'ready'                                 -- takeaway
        and exists (select 1 from public.sessions s
                    where s.id = r.session_id and s.type = 'takeaway'))
  )
returning * into v_updated;
```

Wait — dine-in `lock` must also verify the session type (a delivery round
could theoretically reach `lock` only if its state check allowed it, which
it does not; but the takeaway `ready` branch above correctly scopes by
session type, and the dine-in branch needs the same scoping to avoid a
takeaway round in `lock`... takeaway never reaches `lock` per 010's
cutoff-vocabulary, so the `lock` branch is dine-in by construction. The
migration documents this invariant inline.)

On success: mirror `kitchen_tickets.voided = true` for the round's ticket
(an update in the same body), then
`private.record_audit(v_profile_id, 'round.void', 'round', v_round.id::text, btrim(p_reason), v_round.restaurant_id, v_round.branch_id)`.
Returns `private.round_payload(v_updated)` plus `voided` fields.

### `public.get_audit_log(p_action text default null, p_branch_id uuid default null, p_limit integer default 100) → jsonb`

`security definer`, `stable`. Reach: owner = restaurant-wide (branch rows
with `branch_id is null` included); branch_manager = the union of their
managed branches; cashier/kitchen/anon = `42501`
(`'You do not have permission to view the audit trail.'`). A `p_branch_id`
outside the caller's reach → the same 42501 (validated, never silently
narrowed). Returns `{ entries: [...] }` newest-first, each entry
`{ id, action, resource_type, resource_id, reason, actor_display_name,
branch_label, restaurant_id, branch_id, created_at }`; `p_limit` clamped to
1..200.

### `public.get_session_bill(p_session_id uuid)` — extended in place

Additive keys only (research §3): per-round `items[]`, `voided`,
`void_reason`, `voided_at`; top-level `participants[]`; `grand_total`
recomputed over non-voided rounds.

## Payload shapes (contract-level)

```ts
// void_round → private.round_payload + { voided, void_reason, voided_at }
interface SessionBill {
  session_id: string
  session_type: 'dine-in' | 'delivery' | 'takeaway'
  delivery_address: string | null
  table_label: string | null
  participants: Array<{ id: string; display_name: string; joined_at: string }>
  rounds: Array<{
    round_id: string
    state: string
    voided: boolean
    void_reason: string | null
    voided_at: string | null
    subtotal: string
    tax_total: string
    tax_lines: unknown
    created_at: string
    items: Array<{ item_id: string; name: string; quantity: number;
                   unit_price: string; extras: string[] }>
  }>
  grand_total: string   // non-voided rounds only
}
```

## Seed additions

None required — the fixture's sessions/rounds suffice; the suites create
their own voided rounds. The walkthroughs void walkthrough-created rounds
and restore the fixture afterwards (the 009/010 method).
