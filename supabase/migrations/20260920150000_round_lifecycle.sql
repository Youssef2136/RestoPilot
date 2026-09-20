-- ────────────────────────────────────────────────────────────────────────────
-- Phase 8 (kitchen and cashier operations) — the round state machine and its
-- staff surface (spec 009 T003; contracts/database-functions.md §1–§5;
-- research.md §1–§5, §8).
--
-- The state machine (master plan §8.2, defined here):
--   rounds:          new → accepted → preparing → ready → lock (terminal)
--   kitchen_tickets: new → accepted → preparing → ready   (no lock)
--
-- Discipline inherited from 002–008: `public` functions, `security definer`,
-- `set search_path = ''`, schema-qualified bodies, identity derived from the
-- JWT (never a parameter), tenant refusal 42501 with the action's own
-- message, and ONE generic state refusal (P0001) for every state problem —
-- skip/backward/repeat/terminal/unknown id are indistinguishable by design
-- (the 007 indistinguishability posture applied to state).
--
-- Concurrency: each transition is a guarded UPDATE
-- (`… where id = $1 and state = '<from>'`); row_count = 0 ⇒ refusal. Two
-- racing transitions execute serially at row level; exactly one guard
-- matches — the loser refuses with zero state change (research §1, Risk 7).
--
-- Money: modify_round_line re-derives through private.calculate_tax_totals
-- over the SURVIVING CAPTURED rows (never menu-current prices) — the Phase 7
-- capture path read backwards (research §4, Risk 6).
--
-- Audit: every mutation writes through private.record_audit with the actor
-- from private.staff_profile_ids((select auth.uid())) — research §8.
-- ────────────────────────────────────────────────────────────────────────────

-- ── §0 the state checks widen (data-model.md; research §3) ──────────────────

alter table public.rounds drop constraint rounds_state_check;
alter table public.rounds
  add constraint rounds_state_check
  check (state in ('new', 'accepted', 'preparing', 'ready', 'lock'));

alter table public.kitchen_tickets drop constraint kitchen_tickets_state_check;
alter table public.kitchen_tickets
  add constraint kitchen_tickets_state_check
  check (state in ('new', 'accepted', 'preparing', 'ready'));

-- ── §1 shared helpers (private, no grants) ──────────────────────────────────

-- The caller's profile id, or null when unauthenticated.
create or replace function private.ops_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sp.profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id)
  limit 1
$$;

-- The staff reach over a round: true when the caller's memberships cover the
-- round's branch (any staff role) or its restaurant (owner).
create or replace function private.can_act_on_round(p_profile_id uuid, p_round public.rounds)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_memberships m
    where m.profile_id = p_profile_id
      and (
        m.restaurant_id = p_round.restaurant_id
        or (m.branch_id = p_round.branch_id and m.restaurant_id = p_round.restaurant_id)
      )
  )
$$;

-- Whether the caller holds a specific role over the round's branch.
create or replace function private.has_branch_role(
  p_profile_id uuid,
  p_restaurant_id uuid,
  p_branch_id uuid,
  p_roles public.staff_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_memberships m
    where m.profile_id = p_profile_id
      and m.restaurant_id = p_restaurant_id
      and (
        (m.role = 'owner' and m.branch_id is null)
        or (m.branch_id = p_branch_id and m.role = any (p_roles))
      )
  )
$$;

-- The round's full payload (the post-action shape every transition returns;
-- FR-008). Money is read from the round's own captured columns; names join
-- at read time.
create or replace function private.round_payload(p_round public.rounds)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'round', jsonb_build_object(
      'id', p_round.id,
      'restaurant_id', p_round.restaurant_id,
      'branch_id', p_round.branch_id,
      'session_id', p_round.session_id,
      'state', p_round.state,
      'subtotal', p_round.subtotal::text,
      'tax_total', p_round.tax_total::text,
      'tax_lines', p_round.tax_lines,
      'created_at', p_round.created_at,
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', ri.id,
            'item_id', ri.item_id,
            'name', i.name,
            'quantity', ri.quantity,
            'unit_price', ri.unit_price::text,
            'extras', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'extra_id', rie.extra_id,
                  'name', e.name,
                  'price_adjustment', rie.price_adjustment::text
                ) order by rie.created_at, rie.id
              )
              from public.round_item_extras rie
              join public.menu_item_extras e on e.id = rie.extra_id
              where rie.round_item_id = ri.id
            ), '[]'::jsonb)
          ) order by ri.created_at, ri.id
        )
        from public.round_items ri
        join public.menu_items i on i.id = ri.item_id
        where ri.round_id = p_round.id
      ), '[]'::jsonb)
    )
  )
$$;

-- ── §2 accept_round: new → accepted (cashier/manager/owner; FR-002) ─────────

create or replace function public.accept_round(p_round_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := private.ops_profile_id();
  v_round public.rounds;
  v_updated public.rounds;
  v_ticket public.kitchen_tickets;
begin
  if v_profile_id is null then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  select * into v_round from public.rounds r where r.id = p_round_id;
  if v_round.id is null
    or not private.has_branch_role(v_profile_id, v_round.restaurant_id, v_round.branch_id, array['cashier', 'branch_manager']::public.staff_role[])
  then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  -- The guarded transition: row_count = 0 ⇒ any state problem refuses here.
  update public.rounds r
  set state = 'accepted'
  where r.id = p_round_id and r.state = 'new'
  returning * into v_updated;
  if not found then
    raise exception 'This round is not available for that action.' using errcode = 'P0001';
  end if;

  update public.kitchen_tickets t
  set state = 'accepted'
  where t.round_id = p_round_id and t.state = 'new'
  returning * into v_ticket;

  perform private.record_audit(
    v_profile_id, 'round.accepted', 'round', v_round.id::text, null,
    v_round.restaurant_id, v_round.branch_id
  );

  return private.round_payload(v_updated) || jsonb_build_object('ticket_state', coalesce(v_ticket.state, 'accepted'));
end;
$$;

-- ── §3 start_preparation: accepted → preparing (kitchen allowed; FR-003) ────

create or replace function public.start_preparation(p_round_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := private.ops_profile_id();
  v_round public.rounds;
  v_ticket public.kitchen_tickets;
  v_updated_round public.rounds;
begin
  if v_profile_id is null then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  select * into v_round from public.rounds r where r.id = p_round_id;
  if v_round.id is null
    or not private.has_branch_role(
      v_profile_id, v_round.restaurant_id, v_round.branch_id,
      array['kitchen', 'cashier', 'branch_manager']::public.staff_role[]
    )
  then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  update public.kitchen_tickets t
  set state = 'preparing'
  where t.round_id = p_round_id and t.state = 'accepted'
  returning * into v_ticket;
  if not found then
    raise exception 'This round is not available for that action.' using errcode = 'P0001';
  end if;

  update public.rounds r
  set state = 'preparing'
  where r.id = p_round_id and r.state = 'accepted'
  returning * into v_updated_round;

  perform private.record_audit(
    v_profile_id, 'ticket.preparing', 'ticket', coalesce(v_ticket.id::text, p_round_id::text), null,
    v_round.restaurant_id, v_round.branch_id
  );

  return private.round_payload(v_updated_round) || jsonb_build_object('ticket_state', 'preparing');
end;
$$;

-- ── §4 mark_round_ready: preparing → ready (kitchen allowed; FR-003) ────────

create or replace function public.mark_round_ready(p_round_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := private.ops_profile_id();
  v_round public.rounds;
  v_ticket public.kitchen_tickets;
  v_updated_round public.rounds;
begin
  if v_profile_id is null then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  select * into v_round from public.rounds r where r.id = p_round_id;
  if v_round.id is null
    or not private.has_branch_role(
      v_profile_id, v_round.restaurant_id, v_round.branch_id,
      array['kitchen', 'cashier', 'branch_manager']::public.staff_role[]
    )
  then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  update public.kitchen_tickets t
  set state = 'ready'
  where t.round_id = p_round_id and t.state = 'preparing'
  returning * into v_ticket;
  if not found then
    raise exception 'This round is not available for that action.' using errcode = 'P0001';
  end if;

  update public.rounds r
  set state = 'ready'
  where r.id = p_round_id and r.state = 'preparing'
  returning * into v_updated_round;

  perform private.record_audit(
    v_profile_id, 'ticket.ready', 'ticket', coalesce(v_ticket.id::text, p_round_id::text), null,
    v_round.restaurant_id, v_round.branch_id
  );

  return private.round_payload(v_updated_round) || jsonb_build_object('ticket_state', 'ready');
end;
$$;

-- ── §5 lock_round: ready → lock, terminal (kitchen DENIED; FR-004) ──────────

create or replace function public.lock_round(p_round_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := private.ops_profile_id();
  v_round public.rounds;
  v_updated public.rounds;
begin
  if v_profile_id is null then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  select * into v_round from public.rounds r where r.id = p_round_id;
  if v_round.id is null
    or not private.has_branch_role(v_profile_id, v_round.restaurant_id, v_round.branch_id, array['cashier', 'branch_manager']::public.staff_role[])
  then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  update public.rounds r
  set state = 'lock'
  where r.id = p_round_id and r.state = 'ready'
  returning * into v_updated;
  if not found then
    raise exception 'This round is not available for that action.' using errcode = 'P0001';
  end if;

  perform private.record_audit(
    v_profile_id, 'round.locked', 'round', v_round.id::text, null,
    v_round.restaurant_id, v_round.branch_id
  );

  return private.round_payload(v_updated) || jsonb_build_object('ticket_state', 'ready');
end;
$$;

-- ── §6 modify_round_line: line surgery + engine re-derivation (FR-006/007) ──

create or replace function public.modify_round_line(
  p_round_id uuid,
  p_item_id uuid,
  p_action text,
  p_quantity integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := private.ops_profile_id();
  v_round public.rounds;
  v_updated public.rounds;
  v_line public.round_items;
  v_item_name text;
  v_selections jsonb;
  v_overrides jsonb;
  v_calc jsonb;
  v_qty_before integer;
begin
  if v_profile_id is null then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  select * into v_round from public.rounds r where r.id = p_round_id;
  if v_round.id is null
    or not private.has_branch_role(v_profile_id, v_round.restaurant_id, v_round.branch_id, array['cashier', 'branch_manager']::public.staff_role[])
  then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  -- Frozen states: ready and lock refuse everything.
  if v_round.state in ('ready', 'lock') then
    raise exception 'This round is not available for that action.' using errcode = 'P0001';
  end if;

  select * into v_line
  from public.round_items ri
  where ri.round_id = p_round_id and ri.item_id = p_item_id;
  if v_line.id is null then
    raise exception 'This round is not available for that action.' using errcode = 'P0001';
  end if;
  v_qty_before := v_line.quantity;
  select i.name into v_item_name from public.menu_items i where i.id = p_item_id;

  if p_action = 'remove' then
    delete from public.round_item_extras rie where rie.round_item_id = v_line.id;
    delete from public.round_items ri where ri.id = v_line.id;
    perform private.record_audit(
      v_profile_id, 'round.item_removed', 'round_item', v_line.id::text,
      'removed ' || v_qty_before::text || ' × ' || coalesce(v_item_name, 'item'),
      v_round.restaurant_id, v_round.branch_id
    );
  elsif p_action = 'reduce' then
    if p_quantity is null or p_quantity < 1 or p_quantity >= v_qty_before then
      raise exception 'This round is not available for that action.' using errcode = 'P0001';
    end if;
    update public.round_items ri
    set quantity = p_quantity
    where ri.id = v_line.id;
    perform private.record_audit(
      v_profile_id, 'round.item_quantity_reduced', 'round_item', v_line.id::text,
      'quantity ' || v_qty_before::text || ' → ' || p_quantity::text,
      v_round.restaurant_id, v_round.branch_id
    );
  else
    raise exception 'This round is not available for that action.' using errcode = 'P0001';
  end if;

  -- Re-derive the money from the SURVIVING CAPTURED rows (research §4):
  -- the selections carry each line's identity/quantity, and the parallel
  -- overrides array pins each line's CAPTURED unit price and adjustments —
  -- the menu-current values never enter the re-derivation.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'item_id', ri.item_id,
      'extras', coalesce((
        select jsonb_agg(rie.extra_id::text order by rie.extra_id)
        from public.round_item_extras rie
        where rie.round_item_id = ri.id
      ), '[]'::jsonb),
      'quantity', ri.quantity::text
    ) order by ri.created_at, ri.id
  ), '[]'::jsonb)
  into v_selections
  from public.round_items ri
  where ri.round_id = p_round_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'unit_price', ri.unit_price::text,
      'extras', coalesce((
        select jsonb_object_agg(rie.extra_id::text, rie.price_adjustment::text)
        from public.round_item_extras rie
        where rie.round_item_id = ri.id
      ), '{}'::jsonb)
    ) order by ri.created_at, ri.id
  ), '[]'::jsonb)
  into v_overrides
  from public.round_items ri
  where ri.round_id = p_round_id;

  v_calc := private.calculate_tax_totals(v_round.branch_id, v_selections, v_overrides);

  update public.rounds r
  set subtotal = (v_calc ->> 'subtotal')::numeric(14, 2),
      tax_total = (v_calc ->> 'total')::numeric(14, 2),
      tax_lines = v_calc -> 'lines'
  where r.id = p_round_id
  returning * into v_updated;

  return private.round_payload(v_updated) || jsonb_build_object('ticket_state', v_round.state);
end;
$$;

-- ── grants: the staff surface (no anon anywhere) ────────────────────────────

revoke all on function public.accept_round(uuid) from public, anon;
revoke all on function public.start_preparation(uuid) from public, anon;
revoke all on function public.mark_round_ready(uuid) from public, anon;
revoke all on function public.lock_round(uuid) from public, anon;
revoke all on function public.modify_round_line(uuid, uuid, text, integer) from public, anon;
grant execute on function public.accept_round(uuid) to authenticated;
grant execute on function public.start_preparation(uuid) to authenticated;
grant execute on function public.mark_round_ready(uuid) to authenticated;
grant execute on function public.lock_round(uuid) to authenticated;
grant execute on function public.modify_round_line(uuid, uuid, text, integer) to authenticated;
