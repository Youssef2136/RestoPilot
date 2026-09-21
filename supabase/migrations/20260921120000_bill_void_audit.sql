-- ────────────────────────────────────────────────────────────────────────────
-- Phase 10 (bill, void, and audit) — the accounting-display boundary (spec 011
-- T002; contracts/database-functions.md §1–§4; research.md §1–§6).
--
-- Reuse principle: no new engines — the void is an OVERLAY on `rounds`
-- (state is never changed by a void, so the 010 cutoffs hold unchanged),
-- the bill extends additively, and the audit trail (already written by
-- 005–010) becomes inspectable through one management-level read.
--
--   · rounds gains the void overlay: voided/voided_at/voided_by_profile_id/
--     void_reason with one consistency check (all-or-nothing columns),
--   · kitchen_tickets mirrors voided (set in the SAME transaction — one
--     RPC body, no partial states),
--   · void_round: mandatory reason (blank / >500 refused verbatim), the
--     009 permission posture (cashier/branch_manager, owner reach, kitchen
--     denied), the channel-boundary guarded update (lock dine-in,
--     out_for_delivery+ delivery, ready takeaway), audit 'round.void',
--   · get_audit_log: owner restaurant-wide (branch_id-null rows included),
--     branch_manager the union of their branches, everyone else 42501;
--     p_action / p_branch_id (validated, never silently narrowed) / p_limit
--     clamped 1..200, newest first,
--   · get_session_bill extends additively: per-round items (the captured
--     line shape), voided/void_reason/voided_at, participants; the grand
--     total becomes the NON-voided sum (FR-003).
--
-- Discipline inherited from 007–010: `public` functions, `security definer`,
-- `set search_path = ''`, schema-qualified bodies, identity derived from the
-- request (never a parameter), the 009 refusal vocabulary, and the audit
-- write through private.record_audit on every mutation.
-- ────────────────────────────────────────────────────────────────────────────

-- ── §0 the void overlay (data-model.md) ─────────────────────────────────────

alter table public.rounds add column if not exists voided boolean not null default false;
alter table public.rounds add column if not exists voided_at timestamptz;
alter table public.rounds add column if not exists voided_by_profile_id uuid references public.profiles (id);
alter table public.rounds add column if not exists void_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rounds_void_overlay_check'
  ) then
    alter table public.rounds
      add constraint rounds_void_overlay_check
      check (
        (voided and voided_at is not null and voided_by_profile_id is not null
          and void_reason is not null and length(btrim(void_reason)) between 1 and 500)
        or
        (not voided and voided_at is null and voided_by_profile_id is null
          and void_reason is null)
      );
  end if;
end
$$;

alter table public.kitchen_tickets add column if not exists voided boolean not null default false;

-- ── §1 void_round (research §1, §2, §5; contracts §1) ────────────────────────
-- Validation order (each refusal leaves ZERO rows changed):
--   1. blank reason  → P0001 'A void reason is required.'
--   2. reason > 500  → P0001 'A void reason may be at most 500 characters.'
--   3. identity/role → 42501 'You do not have permission to update this round.'
--   4. guarded update (unknown id / already voided / not at the channel's
--      void boundary) → P0001 'This round is not available for that action.'
--
-- The boundary predicate: `lock` (dine-in by construction — takeaway never
-- reaches lock per the 010 cutoff vocabulary), `out_for_delivery`/`completed`
-- (delivery only), `ready` (takeaway only). One guarded update, race-safe by
-- the 009 mechanism: row_count = 0 ⇒ the generic refusal.
--
-- The round's `state` is NEVER written by a void (research §1) — the 010
-- cutoff reads `state`, so a voided completed delivery round still blocks
-- new orders (FR-011) with no special-casing.

create or replace function public.void_round(p_round_id uuid, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := private.ops_profile_id();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_round public.rounds;
  v_updated public.rounds;
begin
  if v_reason = '' then
    raise exception 'A void reason is required.' using errcode = 'P0001';
  end if;
  if length(v_reason) > 500 then
    raise exception 'A void reason may be at most 500 characters.' using errcode = 'P0001';
  end if;

  select * into v_round from public.rounds r where r.id = p_round_id;
  if v_round.id is not null
    and not private.has_branch_role(
      v_profile_id, v_round.restaurant_id, v_round.branch_id,
      array['cashier', 'branch_manager']::public.staff_role[]
    )
  then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  -- Unknown ids fall through to the guarded update below and share the
  -- generic refusal with wrong-boundary/already-voided — the 009 posture
  -- (an unknown round is indistinguishable from an unactionable one).

  update public.rounds r
  set voided = true,
      voided_at = now(),
      voided_by_profile_id = v_profile_id,
      void_reason = v_reason
  where r.id = p_round_id
    and r.voided = false
    and (
      (r.state = 'lock')
      or (
        r.state in ('out_for_delivery', 'completed')
        and exists (
          select 1 from public.sessions s
          where s.id = r.session_id and s.type = 'delivery'
        )
      )
      or (
        r.state = 'ready'
        and exists (
          select 1 from public.sessions s
          where s.id = r.session_id and s.type = 'takeaway'
        )
      )
    )
  returning * into v_updated;

  if not found then
    raise exception 'This round is not available for that action.' using errcode = 'P0001';
  end if;

  -- The ticket mirror: same transaction, no partial states (research §6).
  update public.kitchen_tickets t
  set voided = true
  where t.round_id = v_updated.id;

  perform private.record_audit(
    v_profile_id, 'round.void', 'round', v_updated.id::text, v_reason,
    v_updated.restaurant_id, v_updated.branch_id
  );

  return private.round_payload(v_updated)
    || jsonb_build_object(
         'voided', v_updated.voided,
         'void_reason', v_updated.void_reason,
         'voided_at', v_updated.voided_at
       );
end;
$$;

-- ── §2 get_audit_log (research §4; contracts §2) ─────────────────────────────
-- Reach: owner = the whole restaurant INCLUDING branch_id-null rows; branch
-- manager = the union of their managed branches; cashier/kitchen/anon =
-- 42501. A p_branch_id outside the caller's reach is the same 42501 —
-- validated, never silently narrowed. p_limit clamped to 1..200.

create or replace function public.get_audit_log(
  p_action text default null,
  p_branch_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := private.ops_profile_id();
  v_is_owner boolean;
  v_branch_ids uuid[];
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  if v_profile_id is null then
    raise exception 'You do not have permission to view the audit trail.' using errcode = '42501';
  end if;

  select bool_or(m.role = 'owner' and m.branch_id is null),
         coalesce(array_agg(m.branch_id) filter (where m.branch_id is not null), '{}')
    into v_is_owner, v_branch_ids
    from public.staff_memberships m
    where m.profile_id = v_profile_id
      and m.role in ('owner', 'branch_manager');

  if v_is_owner is not true and coalesce(array_length(v_branch_ids, 1), 0) = 0 then
    raise exception 'You do not have permission to view the audit trail.' using errcode = '42501';
  end if;

  if p_branch_id is not null
    and not (v_is_owner or p_branch_id = any(v_branch_ids))
  then
    raise exception 'You do not have permission to view the audit trail.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'action', a.action,
          'resource_type', a.resource_type,
          'resource_id', a.resource_id,
          'reason', a.reason,
          'actor_display_name', p.display_name,
          'branch_label', (
            select b.name from public.branches b
            where b.restaurant_id = a.restaurant_id and b.id = a.branch_id
          ),
          'restaurant_id', a.restaurant_id,
          'branch_id', a.branch_id,
          'created_at', a.created_at
        ) order by a.created_at desc, a.id desc
      )
      from public.audit_log a
      join public.profiles p on p.id = a.actor_profile_id
      where a.restaurant_id = (select m.restaurant_id from public.staff_memberships m
                               where m.profile_id = v_profile_id
                                 and (v_is_owner or m.branch_id = any(v_branch_ids))
                               limit 1)
        and (v_is_owner or a.branch_id = any(v_branch_ids))
        and (p_action is null or a.action = p_action)
        and (p_branch_id is null or a.branch_id = p_branch_id)
      limit v_limit
    ), '[]'::jsonb)
  );
end;
$$;

-- ── §3 get_session_bill — the additive extension (research §3; contracts §3) ─
-- Existing keys unchanged; added: per-round items/voided/void_reason/
-- voided_at, top-level participants; grand_total = the NON-voided sum.
-- The 008/010 strict clients parse additively — no key is renamed or removed.

create or replace function public.get_session_bill(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
  v_payload jsonb;
begin
  select * into v_session from public.sessions s where s.id = p_session_id;
  if v_session.id is null
    or not (
      exists (
        select 1 from public.staff_memberships m
        where m.profile_id = private.ops_profile_id()
          and m.role = 'owner' and m.branch_id is null
          and m.restaurant_id = v_session.restaurant_id
      )
      or exists (
        select 1 from public.staff_memberships m
        where m.profile_id = private.ops_profile_id()
          and m.branch_id = v_session.branch_id
          and m.restaurant_id = v_session.restaurant_id
          and m.role in ('cashier', 'branch_manager', 'kitchen')
      )
    )
  then
    raise exception 'You do not have permission to view this bill.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'session_id', v_session.id,
    'session_type', v_session.type,
    'delivery_address', v_session.delivery_address,
    'table_label', (
      select dt.label from public.dining_tables dt where dt.id = v_session.table_id
    ),
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', sp.id, 'display_name', sp.display_name, 'joined_at', sp.joined_at)
        order by sp.joined_at, sp.id
      )
      from public.session_participants sp
      where sp.session_id = v_session.id
    ), '[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'round_id', r.id,
          'state', r.state,
          'session_type', v_session.type,
          'voided', r.voided,
          'void_reason', r.void_reason,
          'voided_at', r.voided_at,
          'subtotal', r.subtotal::text,
          'tax_total', r.tax_total::text,
          'tax_lines', r.tax_lines,
          'created_at', r.created_at,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'item_id', ri.item_id,
                'name', i.name,
                'quantity', ri.quantity,
                'unit_price', ri.unit_price::text,
                'extras', coalesce((
                  select jsonb_agg(e.name order by e.name)
                  from public.round_item_extras rie
                  join public.menu_item_extras e on e.id = rie.extra_id
                  where rie.round_item_id = ri.id
                ), '[]'::jsonb)
              ) order by ri.created_at, ri.id
            )
            from public.round_items ri
            join public.menu_items i on i.id = ri.item_id
            where ri.round_id = r.id
          ), '[]'::jsonb)
        ) order by r.created_at asc, r.id
      )
      from public.rounds r
      where r.session_id = v_session.id
    ), '[]'::jsonb),
    'grand_total', (
      select coalesce(sum(r.subtotal + r.tax_total), 0)::numeric(14, 2)
      from public.rounds r
      where r.session_id = v_session.id
        and r.voided = false
    )::text
  )
  into v_payload;

  return v_payload;
end;
$$;

-- ── §4 grants (contracts §4) ─────────────────────────────────────────────────

revoke all on function public.void_round(uuid, text) from public, anon;
grant execute on function public.void_round(uuid, text) to authenticated;
revoke all on function public.get_audit_log(text, uuid, integer) from public, anon;
grant execute on function public.get_audit_log(text, uuid, integer) to authenticated;

-- ── §5 get_branch_rounds — the cashier's void visibility (contracts §3 note) ──
-- Additive: the deployed 010 body verbatim + per-round 'voided'/'void_reason'/
-- 'voided_at' so the cashier's card can render the voided display state
-- without a second read. Keys are only ADDED — the 009/010 strict clients
-- parse subset-wise.

drop function if exists public.get_branch_rounds(uuid);

create or replace function public.get_branch_rounds(p_branch_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with reach as (
    select b.id as branch_id, b.restaurant_id
    from public.branches b
    where b.id = p_branch_id
      and (
        exists (
          select 1 from public.staff_memberships m
          where m.profile_id = private.ops_profile_id()
            and m.role = 'owner' and m.branch_id is null
            and m.restaurant_id = b.restaurant_id
        )
        or exists (
          select 1 from public.staff_memberships m
          where m.profile_id = private.ops_profile_id()
            and m.branch_id = b.id
            and m.restaurant_id = b.restaurant_id
            and m.role in ('cashier', 'branch_manager', 'kitchen')
        )
      )
  )
  select coalesce(jsonb_agg(rj order by rj -> 'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'round_id', r.id,
      'session_id', r.session_id,
      'session_type', s.type,
      'delivery_address', s.delivery_address,
      'table_label', dt.label,
            'state', r.state,
      'voided', r.voided,
      'void_reason', r.void_reason,
      'voided_at', r.voided_at,
      'subtotal', r.subtotal::text,
      'tax_total', r.tax_total::text,
      'tax_lines', r.tax_lines,
      'created_at', r.created_at,
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'item_id', ri.item_id,
            'name', i.name,
            'quantity', ri.quantity,
            'unit_price', ri.unit_price::text,
            'extras', coalesce((
              select jsonb_agg(e.name order by e.name)
              from public.round_item_extras rie
              join public.menu_item_extras e on e.id = rie.extra_id
              where rie.round_item_id = ri.id
            ), '[]'::jsonb)
          ) order by ri.created_at, ri.id
        )
        from public.round_items ri
        join public.menu_items i on i.id = ri.item_id
        where ri.round_id = r.id
      ), '[]'::jsonb)
    ) as rj
    from reach
    join public.rounds r on r.branch_id = reach.branch_id
    join public.sessions s on s.id = r.session_id
    left join public.dining_tables dt on dt.id = s.table_id
  ) rounds_view
  where exists (select 1 from reach);
$$;

revoke all on function public.get_branch_rounds(uuid) from public, anon;
grant execute on function public.get_branch_rounds(uuid) to authenticated;
