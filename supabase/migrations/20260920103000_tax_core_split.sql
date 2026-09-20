-- ────────────────────────────────────────────────────────────────────────────
-- Phase 7 hotfix (spec 008 T008): the money math becomes callable from the
-- token-based submission RPC.
--
-- The delegation in submit_round → public.calculate_branch_taxes could not
-- work: the 006 engine is `security invoker` and its first act is a
-- staff/owner authorization against `auth.uid()` — null inside a
-- token-authorized definer body (no JWT exists on the customer surface).
-- The engine is now split (research.md §1, revised):
--
--   private.calculate_tax_totals(p_branch_id, p_selections) — the pure
--     computation core, verbatim from calculate_branch_taxes' body. Owner
--     role only; NO execute grant of any kind (privileged namespace).
--
--   public.calculate_branch_taxes(p_branch_id, p_selections) — the staff
--     surface, byte-identical behavior: authorize as before, then delegate
--     to the core. Its grant set is unchanged.
--
--   public.submit_round — now calls private.calculate_tax_totals directly;
--     its own token authorization is the caller's authorization (the
--     session refusal precedes every computation).
--
-- One canonical money math (Risk 6, SC-004): the rules walk, rounding and
-- payload shape exist in exactly one body.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function private.calculate_tax_totals(p_branch_id uuid, p_selections jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_branch public.branches;
  v_subtotal numeric(14, 2);
  v_bases jsonb;
  v_rule record;
  v_scope_base numeric(14, 4);
  v_compound_add numeric(14, 4);
  v_amount numeric(14, 2);
  v_amounts jsonb := '{}'::jsonb; -- rule_id → applied amount (for compounding)
  v_lines jsonb := '[]'::jsonb;
begin
  select * into v_branch from public.branches b where b.id = p_branch_id;

  if v_branch.id is null then
    raise exception 'A calculation selection is malformed.';
  end if;

  if p_selections is null or jsonb_typeof(p_selections) <> 'array' then
    raise exception 'A calculation selection is malformed.';
  end if;

  -- Every entry must name its item as a UUID string, and every extras entry
  -- must be an extra id (string) or an {extra_id} object — anything else is
  -- malformed and rejected loudly (fail closed, including before any uuid
  -- cast can surface a raw 22P02).
  if exists (
    select 1
    from jsonb_array_elements(p_selections) s
    where jsonb_typeof(s -> 'item_id') <> 'string'
       or (s ->> 'item_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) or exists (
    select 1
    from jsonb_array_elements(p_selections) s,
         jsonb_array_elements(
           case jsonb_typeof(s -> 'extras')
             when 'array' then s -> 'extras'
             else '[]'::jsonb
           end
         ) as t(x)
    where jsonb_typeof(t.x) not in ('string', 'object')
       or (jsonb_typeof(t.x) = 'object' and (t.x ->> 'extra_id') is null)
  ) then
    raise exception 'A calculation selection is malformed.';
  end if;

  -- ── 1+2. Per-selection bases: (price + selected extras) × quantity ────────
  -- One pass, no session state (a stable function cannot create tables):
  -- every selection joins its item of THIS restaurant and produces exactly
  -- one base row, kept positionally in a jsonb array.
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'item_id', i.id,
             'base',
             (i.price + coalesce((
               select sum(e.price_adjustment)
               from public.menu_item_extras e
               where e.item_id = i.id
                 and e.id::text in (
                   select case jsonb_typeof(x)
                            when 'string' then x #>> '{}'
                            when 'object' then x ->> 'extra_id'
                          end
                   from jsonb_array_elements(
                          case jsonb_typeof(s -> 'extras')
                            when 'array' then s -> 'extras'
                            else '[]'::jsonb end
                        ) as t2(x)
                 )
             ), 0))
               * greatest(coalesce(nullif(btrim(s ->> 'quantity'), ''), '1')::numeric, 0)
           )
           order by j.ord
         ), '[]'::jsonb)
  into v_bases
  from (
    select s, ord
    from jsonb_array_elements(p_selections) with ordinality as t(s, ord)
  ) j
  join public.menu_items i
    on i.id = (s ->> 'item_id')::uuid and i.restaurant_id = v_branch.restaurant_id;

  -- A selection naming an item of another restaurant, or a malformed entry,
  -- produces no base row — detect and reject loudly (fail closed).
  if jsonb_array_length(p_selections) <> jsonb_array_length(v_bases) then
    raise exception 'A calculation selection is malformed.';
  end if;

  v_subtotal := round(coalesce((
    select sum((b ->> 'base')::numeric) from jsonb_array_elements(v_bases) b
  ), 0), 2);

  -- ── 3. Walk the applicable rules in their explicit order ─────────────────
  -- Active, restaurant-level or this branch's branch-only, ordered by
  -- (sort_order, name, id). Each rule's scope base comes from v_bases; its
  -- base adds the amounts of its named compound sources that applied EARLIER
  -- in the walk (they are in v_amounts exactly when they sorted earlier).
  -- amount = round(base × rate / 100, 2) — rounded once, half-up, at the end
  -- of that line's own calculation (research.md §2). A zero amount is still
  -- emitted when another rule compounds on it (its amount feeds that base).
  for v_rule in
    select r.id, r.name, coalesce(o.rate, r.rate) as rate, r.scope, r.sort_order
    from public.tax_rules r
    left join public.branch_tax_overrides o
      on o.rule_id = r.id and o.branch_id = v_branch.id
    where r.restaurant_id = v_branch.restaurant_id
      and r.is_active
      and (r.branch_id is null or r.branch_id = v_branch.id)
    order by r.sort_order, r.name, r.id
  loop
    v_scope_base :=
      case v_rule.scope
        when 'total' then v_subtotal
        when 'items' then coalesce((
          select sum((b ->> 'base')::numeric)
          from jsonb_array_elements(v_bases) b
          where (b ->> 'item_id')::uuid in (
            select t.item_id from public.tax_rule_items t where t.rule_id = v_rule.id
          )
        ), 0)
        when 'categories' then coalesce((
          select sum((b ->> 'base')::numeric)
          from jsonb_array_elements(v_bases) b
          where (b ->> 'item_id')::uuid in (
            select i2.id from public.menu_items i2
            where i2.category_id in (
              select t.category_id from public.tax_rule_categories t where t.rule_id = v_rule.id
            )
          )
        ), 0)
      end;

    v_compound_add := coalesce((
      select sum((v_amounts ->> s.source_rule_id::text)::numeric)
      from public.tax_rule_compounds s
      where s.rule_id = v_rule.id
        and v_amounts ? s.source_rule_id::text
    ), 0);

    v_amount := round((v_scope_base + v_compound_add) * v_rule.rate / 100, 2);
    v_amounts := jsonb_set(v_amounts, array[v_rule.id::text], v_amount::text::jsonb);

    -- Emit the line only when it charges something: a zero amount (an empty
    -- subtotal, or a zero rate) contributes nothing to any compound base —
    -- the amounts map below already carries it — so the line itself is
    -- dropped. FR-012's empty-basket edge case falls out of this: no
    -- basket, no lines at all.
    if v_amount <> 0 then
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'rule_id', v_rule.id,
          'name', v_rule.name,
          'rate', v_rule.rate::text,
          'scope', v_rule.scope,
          'sort_order', v_rule.sort_order,
          'amount', v_amount::text
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'branch_id', v_branch.id,
    'restaurant_id', v_branch.restaurant_id,
    'lines', v_lines,
    'subtotal', v_subtotal::text,
    'total', (v_subtotal + coalesce((
      select sum((l ->> 'amount')::numeric) from jsonb_array_elements(v_lines) l
    ), 0))::text
  );
end;
$$;

-- The privileged core: owner role only, no execute grant of any kind. It is
-- callable solely from definer bodies owned by this role (the staff surface
-- and the submission RPC below).
revoke all on function private.calculate_tax_totals(uuid, jsonb) from public, anon, authenticated;

-- ── The 006 staff surface becomes a thin authorizing delegator ───────────────
-- Byte-identical behavior: same authorization, same refusals, same payload.

create or replace function public.calculate_branch_taxes(p_branch_id uuid, p_selections jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_branch public.branches;
begin
  select * into v_branch from public.branches b where b.id = p_branch_id;

  if v_branch.id is null
     or not (
       v_branch.id in (select private.staff_branch_ids((select auth.uid())))
       or v_branch.restaurant_id in (select private.owned_restaurant_ids((select auth.uid())))
     ) then
    raise exception 'You do not have permission to calculate this branch''s taxes.'
      using errcode = '42501';
  end if;

  return private.calculate_tax_totals(p_branch_id, p_selections);
end;
$$;

revoke all on function public.calculate_branch_taxes(uuid, jsonb) from public, anon;
grant execute on function public.calculate_branch_taxes(uuid, jsonb) to authenticated;

-- ── submit_round: the money capture now calls the privileged core ────────────

create or replace function public.submit_round(p_token text, p_items jsonb)
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
  v_count integer;
  v_item public.menu_items;
  v_selections jsonb;
  v_calc jsonb;
  v_round public.rounds;
  v_ticket public.kitchen_tickets;
  v_round_item public.round_items;
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

  -- ── 5. Taxes: the privileged core — the token authorization above IS the
  -- caller's authorization; one canonical money math (Risk 6) ─────────────
  v_calc := private.calculate_tax_totals(v_session.branch_id, v_selections);

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

  -- One round_items row per line; captured unit_price from menu_items.
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

revoke all on function public.submit_round(text, jsonb) from public;
grant execute on function public.submit_round(text, jsonb) to anon, authenticated;
