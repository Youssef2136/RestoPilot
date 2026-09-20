-- Session RPCs: the seven Phase 6 functions (spec 007; contracts/database-functions.md;
-- research.md §1, §3, §4, §6).
--
-- Discipline inherited from features 002–006: every public function is
-- `security definer`, created with `set search_path = ''` and schema-qualified
-- bodies, and authorizes/validates as its first act. The three session tables
-- carry ZERO client grants (the previous migration) — these functions are the
-- entire surface, so participant PII and token hashes are never directly
-- row-readable (research §5; Constitution IV/V).
--
-- The access token (research §1): 32 server-random bytes, returned to the
-- customer exactly once as base64url, stored only as its SHA-256 hex digest.
-- Verification hashes the presented token and looks the hash up — the unique
-- index makes that one row or none.
--
-- The seventh function is `private.menu_payload`: feature 005's branch-menu
-- assembly extracted so the customer's `get_session_menu` and the staff's
-- `get_branch_menu` share one canonical payload (Constitution II — the engine
-- is never duplicated).

-- ── private.menu_payload: the single canonical branch-menu assembly ─────────
-- Security invoker: it runs inside its two definer callers under their
-- authority; no client grant exists or is needed.

create function private.menu_payload(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_branch public.branches;
  v_restaurant public.restaurants;
begin
  select * into v_branch from public.branches b where b.id = p_branch_id;
  if v_branch.id is null then
    return null;
  end if;

  select * into v_restaurant from public.restaurants r where r.id = v_branch.restaurant_id;

  return jsonb_build_object(
    'branch', jsonb_build_object('id', v_branch.id, 'name', v_branch.name),
    'restaurant', jsonb_build_object(
      'id', v_restaurant.id, 'name', v_restaurant.name, 'slug', v_restaurant.slug
    ),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'description', c.description,
          'sort_order', c.sort_order,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', i.id,
                'name', i.name,
                'description', i.description,
                'price', i.price::text,
                'sort_order', i.sort_order,
                'image_path', i.image_path,
                'is_offered',
                  i.is_available
                  and not exists (
                    select 1 from public.branch_unavailable_items o
                    where o.branch_id = v_branch.id and o.item_id = i.id
                  ),
                'unavailable_reason',
                  case
                    when not i.is_available then 'restaurant'
                    when exists (
                      select 1 from public.branch_unavailable_items o
                      where o.branch_id = v_branch.id and o.item_id = i.id
                    ) then 'branch'
                    else null
                  end,
                'extras', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', e.id,
                      'name', e.name,
                      'price_adjustment', e.price_adjustment::text,
                      'sort_order', e.sort_order
                    )
                    order by e.sort_order, e.name, e.id
                  )
                  from public.menu_item_extras e
                  where e.item_id = i.id
                ), '[]'::jsonb)
              )
              order by i.sort_order, i.created_at, i.id
            )
            from public.menu_items i
            where i.category_id = c.id
          ), '[]'::jsonb)
        )
        order by c.sort_order, c.created_at, c.id
      )
      from public.menu_categories c
      where c.restaurant_id = v_branch.restaurant_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ── §1 get_public_restaurant: the public page payload ────────────────────────

create function public.get_public_restaurant(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_restaurant public.restaurants;
begin
  select * into v_restaurant from public.restaurants r where r.slug = p_slug;
  if v_restaurant.id is null then
    raise exception 'Restaurant not found.' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'restaurant', jsonb_build_object(
      'id', v_restaurant.id,
      'name', v_restaurant.name,
      'slug', v_restaurant.slug,
      'brand_description', v_restaurant.brand_description
    ),
    -- Each branch nests its ACTIVE tables (id + label only): the entry flow
    -- must offer exactly the selectable tables (FR-003) without exposing
    -- anything beyond that (stopped tables, other restaurants, none).
    'branches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'tables', coalesce((
            select jsonb_agg(
              jsonb_build_object('id', t.id, 'label', t.label)
              order by t.label, t.id
            )
            from public.dining_tables t
            where t.branch_id = b.id and t.is_active
          ), '[]'::jsonb)
        )
        order by b.name, b.id
      )
      from public.branches b
      where b.restaurant_id = v_restaurant.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ── §2 open_session_at_table: entry, open-or-join, token issuance ────────────

create function public.open_session_at_table(
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
  v_token_hash text;
begin
  -- Validation chain, in contract order; each act before the next.
  if not exists (select 1 from public.restaurants r where r.id = p_restaurant_id) then
    raise exception 'Restaurant not found.' using errcode = 'P0001';
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

  -- Token: 32 server-random bytes, base64url; only the SHA-256 hex is stored.
  v_token := encode(extensions.gen_random_bytes(32), 'base64');
  v_token := replace(replace(rtrim(v_token, '=' || chr(10)), '+', '-'), '/', '_');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  -- Open-or-join (research §3): the pre-check reads intent; the partial
  -- unique index `sessions_one_open_per_table` is the race-free guarantee.
  select * into v_open_session
  from public.sessions s
  where s.restaurant_id = p_restaurant_id
    and s.branch_id = p_branch_id
    and s.table_id = p_table_id
    and s.status = 'open';

  if v_open_session.id is not null then
    insert into public.session_participants (session_id, restaurant_id, display_name, phone)
    values (v_open_session.id, p_restaurant_id, v_name, v_phone)
    returning * into v_participant;

    insert into public.session_tokens (session_id, restaurant_id, token_hash)
    values (v_open_session.id, p_restaurant_id, v_token_hash);

    return jsonb_build_object(
      'session', jsonb_build_object(
        'id', v_open_session.id,
        'restaurant_id', v_open_session.restaurant_id,
        'branch_id', v_open_session.branch_id,
        'table_id', v_open_session.table_id,
        'type', v_open_session.type,
        'status', v_open_session.status,
        'opened_at', v_open_session.opened_at
      ),
      'token', v_token,
      'participant', jsonb_build_object(
        'id', v_participant.id,
        'display_name', v_participant.display_name,
        'joined_at', v_participant.joined_at
      )
    );
  end if;

  begin
    insert into public.sessions (restaurant_id, branch_id, table_id)
    values (p_restaurant_id, p_branch_id, p_table_id)
    returning * into v_session;
  exception
    -- Lost the open race (a concurrent entry won the partial unique index);
    -- identified by the constraint's name, per the contract.
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'sessions_one_open_per_table' then
        raise exception 'A session is already open at this table. Join it instead.'
          using errcode = 'P0001';
      end if;
      raise;
  end;

  insert into public.session_participants (session_id, restaurant_id, display_name, phone)
  values (v_session.id, p_restaurant_id, v_name, v_phone)
  returning * into v_participant;

  insert into public.session_tokens (session_id, restaurant_id, token_hash)
  values (v_session.id, p_restaurant_id, v_token_hash);

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'restaurant_id', v_session.restaurant_id,
      'branch_id', v_session.branch_id,
      'table_id', v_session.table_id,
      'type', v_session.type,
      'status', v_session.status,
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

-- ── §2 get_session_context: token-verified session payload ──────────────────

create function public.get_session_context(p_token text)
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
    -- Unknown and closed are deliberately indistinguishable (FR-014).
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

-- ── §2 get_session_menu: the session's branch menu, shared assembly ─────────

create function public.get_session_menu(p_token text)
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

  return private.menu_payload(v_session.branch_id);
end;
$$;

-- ── §3 get_branch_open_sessions: the staff oversight list ────────────────────

create function public.get_branch_open_sessions(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_branch public.branches;
begin
  if v_uid is null then
    raise exception 'You do not have permission to view this branch''s sessions.'
      using errcode = '42501';
  end if;

  select * into v_branch from public.branches b where b.id = p_branch_id;
  if v_branch.id is null
     or not (
       v_branch.restaurant_id in (select private.owned_restaurant_ids(v_uid))
       or (
         v_branch.id in (select private.staff_branch_ids(v_uid))
         and exists (
           select 1
           from public.staff_memberships m
           join public.profiles p on p.id = m.profile_id
           where p.auth_user_id = v_uid
             and m.branch_id = v_branch.id
             and m.role in ('branch_manager', 'cashier')
         )
       )
     ) then
    raise exception 'You do not have permission to view this branch''s sessions.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'sessions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'table_id', s.table_id,
          'table_label', (select t.label from public.dining_tables t where t.id = s.table_id),
          'opened_at', s.opened_at,
          'participants', coalesce((
            select jsonb_agg(
              jsonb_build_object('id', p.id, 'display_name', p.display_name, 'joined_at', p.joined_at)
              order by p.joined_at, p.id
            )
            from public.session_participants p
            where p.session_id = s.id
          ), '[]'::jsonb)
        )
        order by s.opened_at, s.id
      )
      from public.sessions s
      where s.branch_id = v_branch.id and s.status = 'open'
    ), '[]'::jsonb)
  );
end;
$$;

-- ── §3 close_session: terminal closure, audited ──────────────────────────────

create function public.close_session(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile_id uuid;
  v_session public.sessions;
  v_label text;
begin
  if v_uid is null then
    raise exception 'You do not have permission to close this session.'
      using errcode = '42501';
  end if;

  select sp.profile_id into v_profile_id
  from private.staff_profile_ids(v_uid) as sp(profile_id);
  if v_profile_id is null then
    raise exception 'You do not have permission to close this session.'
      using errcode = '42501';
  end if;

  select * into v_session from public.sessions s where s.id = p_session_id;
  if v_session.id is null then
    raise exception 'You do not have permission to close this session.'
      using errcode = '42501';
  end if;

  if not (
    v_session.restaurant_id in (select private.owned_restaurant_ids(v_uid))
    or (
      v_session.branch_id in (select private.staff_branch_ids(v_uid))
      and exists (
        select 1
        from public.staff_memberships m
        join public.profiles p on p.id = m.profile_id
        where p.auth_user_id = v_uid
          and m.branch_id = v_session.branch_id
          and m.role in ('branch_manager', 'cashier')
      )
    )
  ) then
    raise exception 'You do not have permission to close this session.'
      using errcode = '42501';
  end if;

  if v_session.status = 'closed' then
    raise exception 'This session is already closed.' using errcode = 'P0001';
  end if;

  select t.label into v_label from public.dining_tables t where t.id = v_session.table_id;

  update public.sessions
  set status = 'closed',
      closed_at = now(),
      closed_by_profile_id = v_profile_id
  where id = v_session.id
  returning * into v_session;

  perform private.record_audit(
    v_profile_id,
    'session.closed',
    'session',
    v_session.id::text,
    'table=' || v_label,
    v_session.restaurant_id,
    v_session.branch_id
  );

  return jsonb_build_object('closed', true, 'closed_at', v_session.closed_at);
end;
$$;

-- ── grants: five customer/public functions to anon+authenticated; two staff ──

revoke all on function private.menu_payload(uuid) from public, anon, authenticated;

revoke all on function public.get_public_restaurant(text) from public;
revoke all on function public.open_session_at_table(uuid, uuid, uuid, text, text) from public;
revoke all on function public.get_session_context(text) from public;
revoke all on function public.get_session_menu(text) from public;
revoke all on function public.get_branch_open_sessions(uuid) from public, anon;
revoke all on function public.close_session(uuid) from public, anon;

grant execute on function public.get_public_restaurant(text) to anon, authenticated;
grant execute on function public.open_session_at_table(uuid, uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.get_session_context(text) to anon, authenticated;
grant execute on function public.get_session_menu(text) to anon, authenticated;
grant execute on function public.get_branch_open_sessions(uuid) to authenticated;
grant execute on function public.close_session(uuid) to authenticated;
