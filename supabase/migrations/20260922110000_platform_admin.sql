-- ────────────────────────────────────────────────────────────────────────────
-- Phase 13 (super admin and subscriptions) — the platform administration
-- surface (spec 014 T002; plan.md D1–D5; contracts/database-functions.md).
--
-- Structure:
--   §1 subscriptions table (one row per restaurant) + restaurant disable
--      columns; idempotent seed for existing restaurants
--   §2 private helpers: super-admin check + the state derivation CASE
--      (READ-TIME ONLY — no stored state, no trigger, no job: the Important
--      rule is enforced by the absence of anything that could fire)
--   §3 the four RPCs: get_platform_overview, get_my_subscription,
--      set_subscription_dates, set_restaurant_platform_disabled
--   §4 the two doors: open_session_at_table / open_session_channel /
--      submit_round refuse when the restaurant is platform-disabled
--   §5 grants (authenticated execute only)
-- ────────────────────────────────────────────────────────────────────────────

-- ── §1 the subscription table + the disable flag ────────────────────────────

create table public.subscriptions (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  start_date date,
  end_date date,
  updated_at timestamptz not null default now()
);

-- Every restaurant gets exactly one subscription row (never_activated until
-- the platform sets dates). Idempotent for the seeded fixture.
insert into public.subscriptions (restaurant_id)
select r.id from public.restaurants r
on conflict (restaurant_id) do nothing;

alter table public.restaurants
  add column platform_disabled boolean not null default false;
alter table public.restaurants
  add column platform_disabled_reason text;
alter table public.restaurants
  add column platform_disabled_by_profile_id uuid references public.profiles (id);

-- ── §2 private helpers ──────────────────────────────────────────────────────

-- The platform identity: the is_super_admin flag is the ONLY key (plan D4).
create or replace function private.is_super_admin_profile(
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p where p.id = p_profile_id),
    false
  )
$$;

-- The derived lifecycle state (plan D1: read-time CASE, nothing stored).
--   never_activated : no dates yet
--   active          : now within [start, end]
--   nearing_expiration : 0 < end - now <= 7 days
--   expired         : past end
-- `platform_disabled` is a SEPARATE axis (the restaurant's flag); the client
-- renders the override from the payload's own fields.
create or replace function private.subscription_state(
  p_start_date date,
  p_end_date date
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_start_date is null or p_end_date is null then 'never_activated'
    when now()::date > p_end_date then 'expired'
    when p_end_date - now()::date <= 7 then 'nearing_expiration'
    when now()::date < p_start_date then 'active'
    else 'active'
  end
$$;

-- ── §3 the RPCs ─────────────────────────────────────────────────────────────

-- §3a The console read: every restaurant with its subscription payload,
-- derived state, disable flag, and usage counts (FR-001, FR-008).
create or replace function public.get_platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := private.ops_profile_id();
begin
  if v_profile_id is null or not private.is_super_admin_profile(v_profile_id) then
    raise exception 'You do not have permission to view the platform console.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'restaurant_id', r.id,
      'name', r.name,
      'slug', r.slug,
      'start_date', s.start_date,
      'end_date', s.end_date,
      'state', private.subscription_state(s.start_date, s.end_date),
      'platform_disabled', r.platform_disabled,
      'platform_disabled_reason', r.platform_disabled_reason,
      'branch_count', u.branch_count,
      'staff_count', u.staff_count,
      'session_count', u.session_count,
      'round_count', u.round_count
    ) order by r.name)
    from public.restaurants r
    join public.subscriptions s on s.restaurant_id = r.id
    left join lateral (
      select
        (select count(*) from public.branches b where b.restaurant_id = r.id) as branch_count,
        (select count(*) from public.staff_memberships m where m.restaurant_id = r.id) as staff_count,
        (select count(*) from public.sessions ss where ss.restaurant_id = r.id) as session_count,
        (select count(*) from public.rounds rw where rw.restaurant_id = r.id) as round_count
    ) u on true
  ), '[]'::jsonb);
end;
$$;

-- §3b The tenant read: the caller's restaurant's subscription payload with
-- the derived state + the disable flag (FR-007). Owners only; everyone else
-- gets a null payload (no banner data).
create or replace function public.get_my_subscription()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := private.ops_profile_id();
  v_restaurant_id uuid;
  v_row record;
begin
  if v_profile_id is null then
    return null;
  end if;

  -- The owner's restaurant (the only role the banner speaks to — the
  -- platform's terms are the owner's to know).
  select m.restaurant_id into v_restaurant_id
  from public.staff_memberships m
  where m.profile_id = v_profile_id and m.role = 'owner'
  limit 1;

  if v_restaurant_id is null then
    return null;
  end if;

  select s.start_date, s.end_date, r.platform_disabled, r.platform_disabled_reason
  into v_row
  from public.restaurants r
  join public.subscriptions s on s.restaurant_id = r.id
  where r.id = v_restaurant_id;

  return jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'start_date', v_row.start_date,
    'end_date', v_row.end_date,
    'state', private.subscription_state(v_row.start_date, v_row.end_date),
    'platform_disabled', v_row.platform_disabled,
    'platform_disabled_reason', v_row.platform_disabled_reason
  );
end;
$$;

-- §3c Set/replace the subscription dates (activate or change — one action;
-- FR-003/FR-004). Audited with before/after in the reason.
create or replace function public.set_subscription_dates(
  p_restaurant_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := private.ops_profile_id();
  v_before record;
  v_updated record;
  v_reason text;
begin
  if v_profile_id is null or not private.is_super_admin_profile(v_profile_id) then
    raise exception 'You do not have permission to manage subscriptions.' using errcode = '42501';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'Both subscription dates are required.' using errcode = 'P0001';
  end if;
  if p_end_date < p_start_date then
    raise exception 'The subscription end date must not precede its start date.' using errcode = 'P0001';
  end if;

  select s.start_date, s.end_date into v_before
  from public.subscriptions s where s.restaurant_id = p_restaurant_id;
  if v_before.start_date is null and not exists (
    select 1 from public.restaurants r where r.id = p_restaurant_id
  ) then
    raise exception 'Restaurant not found.' using errcode = 'P0001';
  end if;

  update public.subscriptions s
  set start_date = p_start_date,
      end_date = p_end_date,
      updated_at = now()
  where s.restaurant_id = p_restaurant_id
  returning * into v_updated;

  v_reason := format(
    'subscription dates set: %s → %s (was %s → %s)',
    p_start_date::text, p_end_date::text,
    coalesce(v_before.start_date::text, 'none'), coalesce(v_before.end_date::text, 'none')
  );

  insert into public.audit_log (actor_profile_id, action, resource_type, resource_id, reason, restaurant_id)
  values (v_profile_id, 'platform.subscription_dates_set', 'restaurant', p_restaurant_id::text, v_reason, p_restaurant_id);

  return jsonb_build_object(
    'restaurant_id', p_restaurant_id,
    'start_date', v_updated.start_date,
    'end_date', v_updated.end_date,
    'state', private.subscription_state(v_updated.start_date, v_updated.end_date)
  );
end;
$$;

-- §3d The manual kill-switch (FR-005): guarded, idempotent, audited on
-- actual change only (plan D2).
create or replace function public.set_restaurant_platform_disabled(
  p_restaurant_id uuid,
  p_disabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := private.ops_profile_id();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_current boolean;
  v_actor uuid;
begin
  if v_profile_id is null or not private.is_super_admin_profile(v_profile_id) then
    raise exception 'You do not have permission to disable restaurants.' using errcode = '42501';
  end if;

  if p_disabled is null then
    raise exception 'The disabled flag is required.' using errcode = 'P0001';
  end if;
  if p_disabled and v_reason = '' then
    raise exception 'A reason is required to disable a restaurant.' using errcode = 'P0001';
  end if;
  if length(v_reason) > 500 then
    raise exception 'A disable reason may be at most 500 characters.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.restaurants r where r.id = p_restaurant_id) then
    raise exception 'Restaurant not found.' using errcode = 'P0001';
  end if;

  select r.platform_disabled into v_current
  from public.restaurants r where r.id = p_restaurant_id;

  -- No-op: idempotent, no audit row (the guarded update's zero-row path).
  if v_current = p_disabled then
    return jsonb_build_object('restaurant_id', p_restaurant_id, 'platform_disabled', v_current, 'changed', false);
  end if;

  v_actor := case when p_disabled then v_profile_id else null end;

  update public.restaurants r
  set platform_disabled = p_disabled,
      platform_disabled_reason = case when p_disabled then v_reason end,
      platform_disabled_by_profile_id = v_actor
  where r.id = p_restaurant_id and r.platform_disabled <> p_disabled;

  insert into public.audit_log (actor_profile_id, action, resource_type, resource_id, reason, restaurant_id)
  values (
    v_profile_id,
    case when p_disabled then 'platform.restaurant_disabled' else 'platform.restaurant_enabled' end,
    'restaurant', p_restaurant_id::text,
    case when p_disabled then v_reason else 'platform re-enable' end,
    p_restaurant_id
  );

  return jsonb_build_object('restaurant_id', p_restaurant_id, 'platform_disabled', p_disabled, 'changed', true);
end;
$$;

-- ── §4 the two doors (plan D3; FR-006) ──────────────────────────────────────
-- The disablement predicate slots into each function's EXISTING validation
-- chain, after the restaurant existence check. The message is verbatim.

create or replace function public.open_session_at_table(
  p_restaurant_id uuid,
  p_branch_id uuid,
  p_table_id uuid,
  p_display_name text,
  p_phone text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_constraint text;
  v_name text := btrim(coalesce(p_display_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_session public.sessions;
  v_open_session public.sessions;
  v_participant public.session_participants;
  v_token text;
  v_token_row public.session_tokens;
  v_token_hash text;
begin
  -- Validation chain, in contract order; each act before the next.
  if not exists (select 1 from public.restaurants r where r.id = p_restaurant_id) then
    raise exception 'Restaurant not found.' using errcode = 'P0001';
  end if;

  -- Phase 13: the platform kill-switch (before any other work).
  if exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.platform_disabled
  ) then
    raise exception 'This restaurant is not available.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.restaurant_id = p_restaurant_id
  ) then
    raise exception 'Branch not found.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.dining_tables t
    where t.id = p_table_id and t.branch_id = p_branch_id and t.is_active
  ) then
    raise exception 'Table not found.' using errcode = 'P0001';
  end if;

  if v_name = '' then
    raise exception 'A display name is required.' using errcode = 'P0001';
  end if;
  if length(v_name) > 60 then
    raise exception 'A display name may be at most 60 characters.' using errcode = 'P0001';
  end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'A valid phone number is required.' using errcode = 'P0001';
  end if;

  -- (The remainder is the deployed 007 body, unchanged: open-session reuse,
  -- participant upsert, token minting — 32 server-random bytes base64url,
  -- only the SHA-256 hex stored.)
  select * into v_open_session from public.sessions s
  where s.table_id = p_table_id and s.status = 'open';
  if v_open_session.id is not null then
    v_session := v_open_session;
  else
    insert into public.sessions (restaurant_id, branch_id, table_id, type, status)
    values (p_restaurant_id, p_branch_id, p_table_id, 'dine-in', 'open')
    returning * into v_session;
  end if;

  select * into v_participant from public.session_participants sp
  where sp.session_id = v_session.id and sp.phone = v_phone;
  if v_participant.id is null then
    insert into public.session_participants (session_id, restaurant_id, display_name, phone)
    values (v_session.id, p_restaurant_id, v_name, v_phone)
    returning * into v_participant;
  else
    update public.session_participants sp
    set display_name = v_name
    where sp.id = v_participant.id
    returning * into v_participant;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'base64');
  v_token := replace(replace(rtrim(v_token, '=' || chr(10)), '+', '-'), '/', '_');
  insert into public.session_tokens (session_id, restaurant_id, token_hash)
  values (v_session.id, p_restaurant_id, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  returning * into v_token_row;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'type', v_session.type,
      'table_id', v_session.table_id,
      'status', v_session.status
    ),
    'participant', jsonb_build_object('id', v_participant.id, 'display_name', v_participant.display_name),
    'token', v_token
  );
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'sessions_one_open_per_table' then
      raise exception 'This table is already occupied.' using errcode = 'P0001';
    end if;
    raise;
end;
$$;

-- §4b The channel entry door (Phase 9's function, with the same predicate).
create or replace function public.open_session_channel(
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

  -- Phase 13: the platform kill-switch.
  if exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.platform_disabled
  ) then
    raise exception 'This restaurant is not available.' using errcode = 'P0001';
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
    v_address := null;
  end if;

  -- ── 2. Open the channel session (the 010 body, unchanged) ────────────────
  insert into public.sessions (restaurant_id, branch_id, table_id, type, status, delivery_address)
  values (p_restaurant_id, p_branch_id, null, case v_channel when 'delivery' then 'delivery' else 'takeaway' end, 'open', v_address)
  returning * into v_session;

  insert into public.session_participants (session_id, restaurant_id, display_name, phone)
  values (v_session.id, p_restaurant_id, v_name, v_phone)
  returning * into v_participant;

  -- The 007 issuance discipline, verbatim (32 bytes base64url, hash stored).
  v_token := encode(extensions.gen_random_bytes(32), 'base64');
  v_token := replace(replace(rtrim(v_token, '=' || chr(10)), '+', '-'), '/', '_');
  insert into public.session_tokens (session_id, restaurant_id, token_hash)
  values (v_session.id, p_restaurant_id, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  returning * into v_token_row;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'type', v_session.type,
      'status', v_session.status,
      'delivery_address', v_session.delivery_address
    ),
    'participant', jsonb_build_object('id', v_participant.id, 'display_name', v_participant.display_name),
    'token', v_token
  );
end;
$$;

-- §4c The ordering door (Phase 9's deployed submit_round body + predicate).
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
    raise exception 'This session is no longer available.' using errcode = 'P0001';
  end if;

  -- Phase 13: the platform kill-switch (unknown/closed stays indistinguishable).
  if exists (
    select 1 from public.restaurants r where r.id = v_session.restaurant_id and r.platform_disabled
  ) then
    raise exception 'This restaurant is not available.' using errcode = 'P0001';
  end if;

  -- ── 2. Selection validation (the 008 discipline, verbatim) ───────────────
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An order requires at least one item.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'An order may contain at most 50 items.' using errcode = 'P0001';
  end if;

  v_selections := '[]'::jsonb;
  for v_line in select * from jsonb_array_elements(p_items) loop
    v_item_id := nullif(btrim(coalesce(v_line->>'item_id', '')), '');
    if v_item_id is null then
      raise exception 'Each order line requires an item.' using errcode = 'P0001';
    end if;
    select * into v_item from public.menu_items m where m.id = v_item_id::uuid;
    if v_item.id is null then
      raise exception 'Menu item not found.' using errcode = 'P0001';
    end if;
    v_quantity := nullif(btrim(coalesce(v_line->>'quantity', '')), '');
    if v_quantity is null or v_quantity < 1 or v_quantity > 99 then
      raise exception 'A quantity between 1 and 99 is required.' using errcode = 'P0001';
    end if;
    v_line_extras := coalesce(v_line->'extras', '[]'::jsonb);
    if jsonb_typeof(v_line_extras) <> 'array' then
      raise exception 'Extras must be a list.' using errcode = 'P0001';
    end if;
    v_selections := v_selections || jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'quantity', v_quantity, 'extras', v_line_extras
    ));
  end loop;

  -- ── 3. Tax capture via the engine (Phase 6 — the deployed helper) ────────
  v_calc := private.calculate_tax_totals(v_session.branch_id, v_selections);

  -- ── 4. The writes — the deployed 008/009 body, verbatim: captured money
  -- (subtotal + total as numeric text → numeric), captured unit prices, one
  -- ticket, one transaction; any failure aborts all ───────────────────────
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

  insert into public.kitchen_tickets (restaurant_id, branch_id, round_id, state)
  values (v_round.restaurant_id, v_round.branch_id, v_round.id, 'new')
  returning * into v_ticket;

  return jsonb_build_object(
    'round', jsonb_build_object(
      'id', v_round.id,
      'session_id', v_round.session_id,
      'state', v_round.state,
      'subtotal', v_round.subtotal,
      'tax_total', v_round.tax_total,
      'tax_lines', v_round.tax_lines
    ),
    'ticket', jsonb_build_object('id', v_ticket.id, 'state', v_ticket.state)
  );
end;
$$;

-- ── §5 grants ───────────────────────────────────────────────────────────────
revoke execute on function public.get_platform_overview() from public, anon;
revoke execute on function public.get_my_subscription() from public, anon;
revoke execute on function public.set_subscription_dates(uuid, date, date) from public, anon;
revoke execute on function public.set_restaurant_platform_disabled(uuid, boolean, text) from public, anon;
grant execute on function public.get_platform_overview() to authenticated;
grant execute on function public.get_my_subscription() to authenticated;
grant execute on function public.set_subscription_dates(uuid, date, date) to authenticated;
grant execute on function public.set_restaurant_platform_disabled(uuid, boolean, text) to authenticated;
