-- ────────────────────────────────────────────────────────────────────────────
-- Phase 7 (cart and rounds) — the two order RPCs (spec 008 T004; contracts/
-- database-functions.md; research.md §1).
--
-- Discipline inherited from features 002–007: `public` functions,
-- `security definer` (token authorization IS the function's own first act),
-- created with `set search_path = ''` and schema-qualified bodies. Zero
-- direct table access for any client role — these are the only write paths
-- to the four order tables (Constitution IV).
--
-- The token authorization reuses feature 007's exact verification idiom and
-- refusal vocabulary: unknown/tampered/closed sessions are the byte-identical
-- "This session is no longer available." (P0001).
--
-- The tax capture delegates to public.calculate_branch_taxes (the 006
-- engine) — invoked from this definer body, the invoker role is the owner
-- role, so the tax tables resolve (research.md §1). The money math exists in
-- exactly one place (Risk 6; SC-004).
-- ────────────────────────────────────────────────────────────────────────────

-- ── §1 submit_round(p_token, p_items): the critical transaction ──────────────

create function public.submit_round(p_token text, p_items jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_token_row public.session_tokens;
  v_session public.sessions;
  v_line jsonb;
  v_item_id uuid;
  v_quantity integer;
  v_line_extras jsonb;
  v_extra_id uuid;
  v_count integer;
  v_item public.menu_items;
  v_selections jsonb;
  v_calc jsonb;
  v_round public.rounds;
  v_ticket public.kitchen_tickets;
  v_round_item public.round_items;
  v_inserted_extras integer := 0;
begin
  -- ── 1. Token → session (open) — the indistinguishable refusal otherwise ──
  select * into v_token_row from public.session_tokens t where t.token_hash = v_token_hash;
  if v_token_row.id is null then
    raise exception 'This session is no longer available.' using errcode = 'P0001';
  end if;

  select * into v_session from public.sessions s where s.id = v_token_row.session_id;
  if v_session.id is null or v_session.status <> 'open' then
    -- Unknown and closed are deliberately indistinguishable (007's FR-014).
    raise exception 'This session is no longer available.' using errcode = 'P0001';
  end if;

  -- ── 2. Cart shape: non-empty array of well-formed lines ──────────────────
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A cart line is required.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'A cart line is malformed.' using errcode = 'P0001';
  end if;

  v_selections := '[]'::jsonb;

  for v_line in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_line) <> 'object'
      or jsonb_typeof(v_line -> 'item_id') <> 'string'
      or (v_line ->> 'item_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then
      raise exception 'A cart line is malformed.' using errcode = 'P0001';
    end if;

    v_item_id := (v_line ->> 'item_id')::uuid;

    -- Quantity: an integer string 1..99 (the server bound is authoritative).
    if jsonb_typeof(v_line -> 'quantity') <> 'string'
      or (v_line ->> 'quantity') !~ '^[0-9]+$'
      or (v_line ->> 'quantity')::int < 1
      or (v_line ->> 'quantity')::int > 99
    then
      raise exception 'A quantity must be between 1 and 99.' using errcode = 'P0001';
    end if;
    v_quantity := (v_line ->> 'quantity')::int;

    -- Extras: an array of string ids or {extra_id} objects, ≤ 20 per line.
    if v_line -> 'extras' is not null and jsonb_typeof(v_line -> 'extras') <> 'array' then
      raise exception 'A cart line is malformed.' using errcode = 'P0001';
    end if;
    v_line_extras := case when v_line -> 'extras' is null then '[]'::jsonb else v_line -> 'extras' end;
    if jsonb_array_length(v_line_extras) > 20 then
      raise exception 'A cart line is malformed.' using errcode = 'P0001';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_line_extras) as t(x)
      where jsonb_typeof(t.x) not in ('string', 'object')
        or (jsonb_typeof(t.x) = 'string' and (t.x #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
        or (jsonb_typeof(t.x) = 'object' and (t.x ->> 'extra_id') is null)
    ) then
      raise exception 'A cart line is malformed.' using errcode = 'P0001';
    end if;

    -- ── 3. Availability: the item exists in the session's restaurant, is
    -- available restaurant-wide, and is not overridden at this branch ───────
    select * into v_item
    from public.menu_items i
    where i.id = v_item_id and i.restaurant_id = v_session.restaurant_id;
    if v_item.id is null
      or not v_item.is_available
      or exists (
        select 1 from public.branch_unavailable_items u
        where u.branch_id = v_session.branch_id and u.item_id = v_item_id
      )
    then
      raise exception 'This item is not available here.' using errcode = 'P0001';
    end if;

    -- ── 4. Extras scope: every extra belongs to the submitted item ─────────
    select count(*) into v_count
    from jsonb_array_elements(v_line_extras) as t(x)
    where not exists (
      select 1 from public.menu_item_extras e
      where e.id = case jsonb_typeof(t.x)
                     when 'string' then (t.x #>> '{}')::uuid
                     else (t.x ->> 'extra_id')::uuid
                   end
        and e.item_id = v_item_id
        and e.restaurant_id = v_session.restaurant_id
    );
    if v_count > 0 then
      raise exception 'An extra does not belong to its item.' using errcode = 'P0001';
    end if;

    -- Duplicate extras within one line would violate the unique index.
    select count(*) into v_count
    from (
      select case jsonb_typeof(t.x)
               when 'string' then t.x #>> '{}'
               else t.x ->> 'extra_id'
             end as eid
      from jsonb_array_elements(v_line_extras) as t(x)
    ) d;
    if v_count <> (select count(distinct eid) from (
      select case jsonb_typeof(t.x)
               when 'string' then t.x #>> '{}'
               else t.x ->> 'extra_id'
             end as eid
      from jsonb_array_elements(v_line_extras) as t(x)
    ) d2) then
      raise exception 'A cart line is malformed.' using errcode = 'P0001';
    end if;

    v_selections := v_selections || jsonb_build_array(
      jsonb_build_object(
        'item_id', v_item_id,
        'extras', v_line_extras,
        'quantity', v_quantity::text
      )
    );
  end loop;

  -- ── 5. Taxes: the 006 engine, one canonical place (Risk 6) ───────────────
  v_calc := public.calculate_branch_taxes(v_session.branch_id, v_selections);

  -- ── 6. The writes: one body = one transaction; any failure aborts all ────
  insert into public.rounds (restaurant_id, branch_id, session_id, state, subtotal, tax_total, tax_lines)
  values (
    v_session.restaurant_id,
    v_session.branch_id,
    v_session.id,
    'new',
    (v_calc ->> 'subtotal')::numeric(14, 2),
    (v_calc ->> 'total')::numeric(14, 2),
    v_calc -> 'lines'
  )
  returning * into v_round;

  insert into public.kitchen_tickets (restaurant_id, branch_id, round_id, state)
  values (v_session.restaurant_id, v_session.branch_id, v_round.id, 'new')
  returning * into v_ticket;

  -- One round_items row per line; duplicate items merge into quantity — the
  -- unique (round_id, item_id) is structural, so merge BEFORE insert.
  for v_line in select * from jsonb_array_elements(v_selections) loop
    v_item_id := (v_line ->> 'item_id')::uuid;
    v_quantity := (v_line ->> 'quantity')::int;
    v_line_extras := v_line -> 'extras';

    select * into v_item from public.menu_items i where i.id = v_item_id;

    insert into public.round_items (restaurant_id, round_id, item_id, quantity, unit_price)
    values (v_session.restaurant_id, v_round.id, v_item_id, v_quantity, v_item.price)
    returning * into v_round_item;

    insert into public.round_item_extras (restaurant_id, round_item_id, extra_id, price_adjustment)
    select
      v_session.restaurant_id,
      v_round_item.id,
      case jsonb_typeof(t.x) when 'string' then (t.x #>> '{}')::uuid else (t.x ->> 'extra_id')::uuid end,
      e.price_adjustment
    from jsonb_array_elements(v_line_extras) as t(x)
    join public.menu_item_extras e
      on e.id = case jsonb_typeof(t.x) when 'string' then (t.x #>> '{}')::uuid else (t.x ->> 'extra_id')::uuid end;
    get diagnostics v_inserted_extras = row_count;
  end loop;

  return jsonb_build_object(
    'round', jsonb_build_object(
      'id', v_round.id,
      'restaurant_id', v_round.restaurant_id,
      'branch_id', v_round.branch_id,
      'session_id', v_round.session_id,
      'state', v_round.state,
      'subtotal', v_round.subtotal::text,
      'tax_total', v_round.tax_total::text,
      'tax_lines', v_round.tax_lines,
      'created_at', v_round.created_at
    ),
    'ticket_id', v_ticket.id,
    'items', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', ri.id,
          'item_id', ri.item_id,
          'quantity', ri.quantity,
          'unit_price', ri.unit_price::text,
          'extras', (
            select coalesce(jsonb_agg(
              jsonb_build_object('extra_id', rie.extra_id, 'price_adjustment', rie.price_adjustment::text)
              order by rie.extra_id
            ), '[]'::jsonb)
            from public.round_item_extras rie
            where rie.round_item_id = ri.id
          )
        ) order by ri.created_at, ri.id
      ), '[]'::jsonb)
      from public.round_items ri
      where ri.round_id = v_round.id
    )
  );
end;
$$;

-- ── §2 get_session_rounds(p_token): the history read (FR-011) ────────────────

create function public.get_session_rounds(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_token_row public.session_tokens;
  v_session public.sessions;
begin
  select * into v_token_row from public.session_tokens t where t.token_hash = v_token_hash;
  if v_token_row.id is null then
    raise exception 'This session is no longer available.' using errcode = 'P0001';
  end if;

  select * into v_session from public.sessions s where s.id = v_token_row.session_id;
  if v_session.id is null or v_session.status <> 'open' then
    raise exception 'This session is no longer available.' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'rounds', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'state', r.state,
          'subtotal', r.subtotal::text,
          'tax_total', r.tax_total::text,
          'tax_lines', r.tax_lines,
          'created_at', r.created_at,
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
            where ri.round_id = r.id
          ), '[]'::jsonb)
        ) order by r.created_at, r.id
      )
      from public.rounds r
      where r.session_id = v_session.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ── grants: both functions are the anon-reachable customer surface ───────────

revoke all on function public.submit_round(text, jsonb) from public;
revoke all on function public.get_session_rounds(text) from public;

grant execute on function public.submit_round(text, jsonb) to anon, authenticated;
grant execute on function public.get_session_rounds(text) to anon, authenticated;
