-- ────────────────────────────────────────────────────────────────────────────
-- Phase 9 (delivery and takeaway) — the channel schema and RPCs (spec 010
-- T003; contracts/database-functions.md §1–§6; research.md §1–§5).
--
-- Reuse principle (master plan §20): sessions/rounds/pricing/tax/kitchen/
-- cashier/audit are untouched — only channel-specific behavior is added:
--   · sessions.type widens to dine-in/delivery/takeaway; delivery carries
--     its address, set once (no write path after entry),
--   · a NEW open_session_channel RPC handles non-dine-in entry (no table
--     join semantics; one customer per channel session),
--   · submit_round gains the STATE-driven cutoffs (delivery: any round
--     out_for_delivery/completed; takeaway: any round ready+; dine-in: never),
--   · two cashier transitions extend the delivery machine (§8.3) — audited,
--     kitchen-denied, delivery-only,
--   · the staff reads carry session_type; the address surfaces on the
--     cashier/bill reads only — the kitchen queue stays channel-blind.
--
-- Discipline inherited from 007–009: `public` functions, `security definer`,
-- `set search_path = ''`, schema-qualified bodies, identity/token derived
-- from the request (never a parameter), the 007 refusal vocabulary, and the
-- 009 indistinguishability posture on state (one generic message).
-- ────────────────────────────────────────────────────────────────────────────

-- ── §0 the checks widen (data-model.md) ─────────────────────────────────────

alter table public.sessions drop constraint sessions_type_check;
alter table public.sessions
  add constraint sessions_type_check
  check (type in ('dine-in', 'delivery', 'takeaway'));

alter table public.sessions add column if not exists delivery_address text;

-- The two delivery-address checks, idempotent: the migration may re-apply on
-- a database where an earlier partial application left them behind (the
-- 009/010 repair discipline).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_delivery_address_check'
  ) then
    alter table public.sessions
      add constraint sessions_delivery_address_check
      check (delivery_address is null or length(btrim(delivery_address)) between 1 and 200);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_delivery_address_required_check'
  ) then
    alter table public.sessions
      add constraint sessions_delivery_address_required_check
      check (type <> 'delivery' or delivery_address is not null);
  end if;
end
$$;

alter table public.rounds drop constraint rounds_state_check;
alter table public.rounds
  add constraint rounds_state_check
  check (state in ('new', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'lock'));

-- Channel sessions have no table: relax 007's NOT NULL. NULL table_id keeps
-- the one-open-per-table partial unique index silent for channels (NULLs are
-- distinct), so multiple open delivery/takeaway sessions coexist per branch
-- while dine-in keeps its race-free single-session guarantee.
alter table public.sessions alter column table_id drop not null;

-- ── §0b the context payload carries the address echo (spec 010 FR-010) ──────
-- get_session_context's session object gains delivery_address (null for
-- non-delivery) so the customer indicator can render it read-only without a
-- new read. The other session keys are untouched.
create or replace function public.get_session_context(p_token text)
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
    'session', jsonb_build_object(
      'id', v_session.id,
      'restaurant_id', v_session.restaurant_id,
      'branch_id', v_session.branch_id,
      'table_id', v_session.table_id,
      'type', v_session.type,
      'status', v_session.status,
      'delivery_address', v_session.delivery_address,
      'opened_at', v_session.opened_at
    ),
    'indicator', jsonb_build_object(
      'restaurant_name', (select r.name from public.restaurants r where r.id = v_session.restaurant_id),
      'branch_name', (select b.name from public.branches b where b.id = v_session.branch_id),
      'table_label', (select t.label from public.dining_tables t where t.id = v_session.table_id)
    ),
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', p.id, 'display_name', p.display_name, 'joined_at', p.joined_at)
        order by p.joined_at, p.id
      )
      from public.session_participants p
      where p.session_id = v_session.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ── §1 open_session_channel: the non-dine-in entry (research §1) ────────────

drop function if exists public.open_session_channel(uuid, uuid, text, text, text, text);
create function public.open_session_channel(
  p_restaurant_id uuid,
  p_branch_id uuid,
  p_channel text,
  p_display_name text,
  p_phone text,
  p_delivery_address text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_channel text := btrim(coalesce(p_channel, ''));
  v_name text := btrim(coalesce(p_display_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_address text := btrim(coalesce(p_delivery_address, ''));
  v_branch public.branches;
  v_session public.sessions;
  v_participant public.session_participants;
  v_token text;
  v_token_row public.session_tokens;
begin
  -- ── 1. The 007 entry validation chain (same texts, same order) ───────────
  select * into v_branch from public.branches b
  where b.restaurant_id = p_restaurant_id and b.id = p_branch_id;
  if v_branch.id is null then
    raise exception 'Restaurant or branch not found.' using errcode = 'P0001';
  end if;

  if v_channel not in ('delivery', 'takeaway') then
    raise exception 'Choose delivery or takeaway.' using errcode = 'P0001';
  end if;

  if v_name = '' or length(v_name) > 60 then
    raise exception 'Enter your name (1–60 characters).' using errcode = 'P0001';
  end if;
  if v_phone = '' or length(v_phone) > 20 then
    raise exception 'Enter your phone number (up to 20 characters).' using errcode = 'P0001';
  end if;

  if v_channel = 'delivery' then
    if v_address = '' or length(v_address) > 200 then
      raise exception 'A delivery address is required.' using errcode = 'P0001';
    end if;
  else
    v_address := null; -- takeaway ignores any address passed (research §1)
  end if;

  -- ── 2. The channel session: no join semantics, one customer ─────────────
  insert into public.sessions
    (restaurant_id, branch_id, table_id, type, status, delivery_address, opened_at)
  values
    (p_restaurant_id, p_branch_id, null, v_channel, 'open',
     case when v_channel = 'delivery' then v_address end, now())
  returning * into v_session;

  insert into public.session_participants
    (session_id, restaurant_id, display_name, phone, joined_at)
  values
    (v_session.id, p_restaurant_id, v_name, v_phone, now())
  returning * into v_participant;

  -- ── 3. The token (the 007 issuance discipline, verbatim) ─────────────────
  -- 32 server-random bytes, base64url; only the SHA-256 hex is stored.
  v_token := encode(extensions.gen_random_bytes(32), 'base64');
  v_token := replace(replace(rtrim(v_token, '=' || chr(10)), '+', '-'), '/', '_');
  insert into public.session_tokens (session_id, restaurant_id, token_hash)
  values (v_session.id, p_restaurant_id, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  returning * into v_token_row;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'restaurant_id', v_session.restaurant_id,
      'branch_id', v_session.branch_id,
      'table_id', v_session.table_id,
      'type', v_session.type,
      'status', v_session.status,
      'delivery_address', v_session.delivery_address,
      'opened_at', v_session.opened_at
    ),
    'token', v_token,
    'participant', jsonb_build_object(
      'id', v_participant.id,
      'display_name', v_participant.display_name,
      'joined_at', v_participant.joined_at
    )
  );
end;
$$;

-- ── §2 the cutoff in submit_round (research §2, contracts §2) ───────────────
-- The 008 submission body is amended in place: the deployed body was extracted
-- verbatim from pg_proc, the cutoff block inserted after the open-session gate
-- (before cart validation), and re-applied — zero drift from the canonical body.

drop function if exists public.submit_round(text, jsonb);
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

  -- ── 1b. The channel cutoffs (Phase 9; state-driven — spec 010 research §2) ─
  -- Delivery: any round out_for_delivery/completed. Takeaway: any round
  -- ready (or beyond). Dine-in: never (session close governs). Evaluated in
  -- this transaction — the same serialization backs the transitions, so a
  -- racing transition + submission resolves to one deterministic outcome.
  -- (v_session MUST be assigned before this block — the probe proved the
  -- unassigned-variable NULL silently disables both checks.)
  if v_session.type = 'delivery' then
    if exists (
      select 1 from public.rounds r
      where r.session_id = v_session.id
        and r.state in ('out_for_delivery', 'completed')
    ) then
      raise exception 'Your order is already on its way — no additional items can be added.'
        using errcode = 'P0001';
    end if;
  elsif v_session.type = 'takeaway' then
    if exists (
      select 1 from public.rounds r
      where r.session_id = v_session.id
        and r.state in ('ready', 'lock')
    ) then
      raise exception 'Your order is ready for pickup — no additional items can be added.'
        using errcode = 'P0001';
    end if;
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

-- ── §5 the staff reads go channel-safe (contracts §5; research §4) ──────────
-- Two changes, both forced by channels:
--  1. the INNER join on dining_tables DROPPED every channel row (a channel
--     session has no table) — the cashier's rounds view, the kitchen queue,
--     and the bill were blind to delivery/takeaway. All three become LEFT
--     joins (table_label null for channels — the UI shows the channel chip).
--  2. the payload keys: session_type per round everywhere; delivery_address
--     on the branch rounds (per delivery row) and the bill (top-level) —
--     the kitchen queue gains neither key (channel-blind: no addresses, no
--     money, unchanged shape beyond the left join's rescued rows).

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
    left join public.dining_tables dt on dt.id = s.table_id
    where t.state <> 'lock' and r.state <> 'lock'
  ) tickets_view
  where exists (select 1 from reach);
$$;

drop function if exists public.get_session_bill(uuid);
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
    'rounds', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'round_id', r.id,
          'state', r.state,
          'session_type', v_session.type,
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
  into v_payload;

  return v_payload;
end;
$$;

-- ── §3 mark_out_for_delivery: delivery-channel round transition ────────────
-- 009 posture: identity (42501) → tenant/role (42501, unknown id
-- indistinguishable) → one guarded update. The delivery-channel existence
-- check is folded into the guard's where clause, so wrong-channel and
-- wrong-state are the SAME zero-rows generic refusal (contracts §3) — race
-- safe by the serial-update arbiter, no separate probe to TOCTOU.

drop function if exists public.mark_out_for_delivery(uuid);
create or replace function public.mark_out_for_delivery(p_round_id uuid)
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
    or not private.has_branch_role(
      v_profile_id, v_round.restaurant_id, v_round.branch_id,
      array['cashier', 'branch_manager']::public.staff_role[]
    )
  then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  update public.rounds r
  set state = 'out_for_delivery'
  where r.id = p_round_id
    and r.state = 'ready'
    and exists (
      select 1 from public.sessions s
      where s.id = r.session_id and s.type = 'delivery'
    )
  returning * into v_updated;
  if not found then
    raise exception 'This round is not available for that action.' using errcode = 'P0001';
  end if;

  perform private.record_audit(
    v_profile_id, 'round.out_for_delivery', 'round', v_round.id::text, null,
    v_round.restaurant_id, v_round.branch_id
  );

  -- The ticket is untouched: it ended at 'ready' with the round (009 sync).
  return private.round_payload(v_updated);
end;
$$;

-- ── §4 mark_completed: the delivery machine's terminal transition ───────────

drop function if exists public.mark_completed(uuid);
create or replace function public.mark_completed(p_round_id uuid)
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
    or not private.has_branch_role(
      v_profile_id, v_round.restaurant_id, v_round.branch_id,
      array['cashier', 'branch_manager']::public.staff_role[]
    )
  then
    raise exception 'You do not have permission to update this round.' using errcode = '42501';
  end if;

  update public.rounds r
  set state = 'completed'
  where r.id = p_round_id
    and r.state = 'out_for_delivery'
    and exists (
      select 1 from public.sessions s
      where s.id = r.session_id and s.type = 'delivery'
    )
  returning * into v_updated;
  if not found then
    raise exception 'This round is not available for that action.' using errcode = 'P0001';
  end if;

  perform private.record_audit(
    v_profile_id, 'round.completed', 'round', v_round.id::text, null,
    v_round.restaurant_id, v_round.branch_id
  );

  return private.round_payload(v_updated);
end;
$$;

-- ── grants (contracts §6) ───────────────────────────────────────────────────

revoke all on function public.open_session_channel(uuid, uuid, text, text, text, text) from public;
grant execute on function public.open_session_channel(uuid, uuid, text, text, text, text) to anon, authenticated;
revoke all on function public.mark_out_for_delivery(uuid) from public, anon;
revoke all on function public.mark_completed(uuid) from public, anon;
grant execute on function public.mark_out_for_delivery(uuid) to authenticated;
grant execute on function public.mark_completed(uuid) to authenticated;
