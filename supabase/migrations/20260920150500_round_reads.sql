-- ────────────────────────────────────────────────────────────────────────────
-- Phase 8 — the staff READ surface (spec 009 T004; contracts/database-functions.md
-- §6–§9; research.md §6).
--
-- Three reads, `public` + `security definer` + `set search_path = ''`, the
-- JWT-derived identity, and the `list_open_sessions` reach predicate as each
-- function's first act. Names joined at read time; ordering newest-first.
--
-- `get_kitchen_queue` carries NO money keys anywhere in its payload (FR-010,
-- test-asserted shape) — the kitchen surface works from quantities and names.
--
-- Grants per §9 (T003's migration granted the five writers).
-- ────────────────────────────────────────────────────────────────────────────

-- ── §6 get_branch_rounds — the cashier dashboard's dataset ──────────────────

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
      'table_label', dt.label,
      'state', r.state,
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
    join public.dining_tables dt on dt.id = s.table_id
  ) rounds_view
  where exists (select 1 from reach);
$$;

-- ── §7 get_kitchen_queue — tickets by state, ZERO money keys (FR-010) ───────

create or replace function public.get_kitchen_queue(p_branch_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with reach as (
    select b.id as branch_id
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
  select coalesce(jsonb_agg(tj order by tj -> 'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'ticket_id', t.id,
      'round_id', t.round_id,
      'state', t.state,
      'table_label', dt.label,
      'created_at', t.created_at,
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', i.name,
            'quantity', ri.quantity,
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
        where ri.round_id = t.round_id
      ), '[]'::jsonb)
    ) as tj
    from reach
    join public.kitchen_tickets t on t.branch_id = reach.branch_id
    join public.rounds r on r.id = t.round_id
    join public.sessions s on s.id = r.session_id
    join public.dining_tables dt on dt.id = s.table_id
    where t.state <> 'lock' and r.state <> 'lock'
  ) tickets_view
  where exists (select 1 from reach);
$$;

-- ── §8 get_session_bill — grouped rounds + the captured grand total ─────────

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
    'table_label', dt.label,
    'rounds', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'round_id', r.id,
          'state', r.state,
          'subtotal', r.subtotal::text,
          'tax_total', r.tax_total::text,
          'tax_lines', r.tax_lines,
          'created_at', r.created_at
        ) order by r.created_at asc, r.id
      )
      from public.rounds r
      where r.session_id = v_session.id
    ), '[]'::jsonb),
    'grand_total', (
      select coalesce(sum(r.subtotal + r.tax_total), 0)::numeric(14, 2)
      from public.rounds r
      where r.session_id = v_session.id
    )::text
  )
  into v_payload
  from public.dining_tables dt
  where dt.id = v_session.table_id;

  return v_payload;
end;
$$;

-- ── §9 grants ───────────────────────────────────────────────────────────────

revoke all on function public.get_branch_rounds(uuid) from public, anon;
revoke all on function public.get_kitchen_queue(uuid) from public, anon;
revoke all on function public.get_session_bill(uuid) from public, anon;
grant execute on function public.get_branch_rounds(uuid) to authenticated;
grant execute on function public.get_kitchen_queue(uuid) to authenticated;
grant execute on function public.get_session_bill(uuid) to authenticated;
