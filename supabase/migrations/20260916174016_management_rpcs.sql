-- Management RPCs: the nine Phase 3 configuration operations
-- (spec 004 FR-001–FR-012, FR-020; contracts/database-functions.md;
-- research.md §1, §6–§10; data-model.md audit vocabulary).
--
-- Phase 3 migration 4 of 5. Every function lives in the `public` schema (the
-- data-API surface), is `security definer`, `language plpgsql`, created with
-- `set search_path = ''` and schema-qualified bodies, authorizes its caller
-- as its first act through the existing private helper family (owner-only —
-- FR-006), and writes exactly one private.record_audit record per accepted
-- change in the same transaction (FR-020). Execute is granted to
-- `authenticated` only (revoked from public/anon); no table write grant
-- exists anywhere — these functions are the only write paths to
-- configuration data.
--
-- Error model (load-bearing for the client contract):
--   42501 — authorization denial (wrong role, other restaurant, other
--           branch, no linked profile).
--   P0001 — validation failure, and every constraint violation these
--           functions can hit, caught BY CONSTRAINT NAME and re-raised with
--           a user-facing message: 23505 duplicate slug/label, 23514
--           blank/zero-length checks, 23P01 working-hours overlap. Those
--           SQLSTATEs never reach the client through these RPCs; the
--           constraints themselves remain the declarative backstop for any
--           other writer.

-- ─────────────────────────────────────────────────────────────────────────────
-- Restaurant operations (FR-001, FR-002, FR-003, FR-004)
-- ─────────────────────────────────────────────────────────────────────────────

-- create_restaurant: creates the tenant and its first owner in one
-- transaction (FR-001). Any caller with a linked profile may bootstrap a
-- restaurant; the super-admin flag grants nothing here (FR-021), and an
-- unlinked identity is denied 42501.
create function public.create_restaurant(
  p_name              text,
  p_slug              text,
  p_brand_description text default null,
  p_contact_email     text default null,
  p_contact_phone     text default null,
  p_timezone          text default 'UTC'
) returns public.restaurants
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id        uuid;
  v_name              text := btrim(coalesce(p_name, ''));
  v_slug              text := btrim(coalesce(p_slug, ''));
  v_brand_description text := nullif(btrim(coalesce(p_brand_description, '')), '');
  v_contact_email     text := nullif(btrim(coalesce(p_contact_email, '')), '');
  v_contact_phone     text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_timezone          text := btrim(coalesce(p_timezone, ''));
  v_constraint        text;
  v_restaurant        public.restaurants;
begin
  -- Authorization (first act): a linked profile — the person-level
  -- entitlement FR-001's bootstrap grants.
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);
  if v_profile_id is null then
    raise exception 'A linked profile is required to create a restaurant.'
      using errcode = '42501';
  end if;

  -- Validation: a clear P0001 in every case; nothing is created.
  if v_name = '' then
    raise exception 'A restaurant name is required.';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'The public identifier may contain only lowercase letters, digits, and single hyphens.';
  end if;
  if exists (select 1 from public.restaurants r where r.slug = v_slug) then
    raise exception 'This public identifier is already in use by another restaurant.';
  end if;
  if v_timezone = '' then
    raise exception 'A timezone is required.';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = v_timezone) then
    raise exception 'Unknown timezone.';
  end if;

  begin
    insert into public.restaurants
      (name, slug, brand_description, contact_email, contact_phone, timezone)
    values
      (v_name, v_slug, v_brand_description, v_contact_email, v_contact_phone, v_timezone)
    returning * into v_restaurant;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'restaurants_slug_key' then
        raise exception 'This public identifier is already in use by another restaurant.';
      end if;
      raise;
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'restaurants_name_check' then
        raise exception 'A restaurant name is required.';
      elsif v_constraint = 'restaurants_slug_check' then
        raise exception 'The public identifier may contain only lowercase letters, digits, and single hyphens.';
      elsif v_constraint = 'restaurants_timezone_check' then
        raise exception 'A timezone is required.';
      end if;
      raise;
  end;

  -- The creator becomes the restaurant's first owner (FR-001); that
  -- membership is what makes the restaurant visible to them under the
  -- existing policies.
  insert into public.staff_memberships (profile_id, restaurant_id, role)
  values (v_profile_id, v_restaurant.id, 'owner');

  perform private.record_audit(
    v_profile_id,
    'restaurant.created',
    'restaurant',
    v_restaurant.id::text,
    null,
    v_restaurant.id,
    null
  );

  return v_restaurant;
end;
$$;

-- update_restaurant_profile: full-profile update — display name, public
-- identifier (FR-004: the identifier is replaced; no alias, redirect, or
-- history exists), brand description, contact information (FR-002).
-- Owner-only. The restaurant's own current slug is accepted unchanged; a
-- slug used by another restaurant is rejected.
create function public.update_restaurant_profile(
  p_restaurant_id     uuid,
  p_name              text,
  p_slug              text,
  p_brand_description text default null,
  p_contact_email     text default null,
  p_contact_phone     text default null
) returns public.restaurants
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id        uuid;
  v_name              text := btrim(coalesce(p_name, ''));
  v_slug              text := btrim(coalesce(p_slug, ''));
  v_brand_description text := nullif(btrim(coalesce(p_brand_description, '')), '');
  v_contact_email     text := nullif(btrim(coalesce(p_contact_email, '')), '');
  v_contact_phone     text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_constraint        text;
  v_restaurant        public.restaurants;
begin
  -- Authorization (first act): owner of the target restaurant (FR-006). A
  -- nonexistent id resolves to no owned restaurant and is denied alike.
  if p_restaurant_id is null
     or p_restaurant_id not in (select private.owned_restaurant_ids((select auth.uid())))
  then
    raise exception 'You do not have permission to manage this restaurant.'
      using errcode = '42501';
  end if;
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  -- Validation: as in create_restaurant; uniqueness is checked against
  -- OTHER restaurants, so the stored identifier is always resubmittable.
  if v_name = '' then
    raise exception 'A restaurant name is required.';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'The public identifier may contain only lowercase letters, digits, and single hyphens.';
  end if;
  if exists (
    select 1 from public.restaurants r
    where r.slug = v_slug and r.id <> p_restaurant_id
  ) then
    raise exception 'This public identifier is already in use by another restaurant.';
  end if;

  begin
    update public.restaurants r
       set name = v_name,
           slug = v_slug,
           brand_description = v_brand_description,
           contact_email = v_contact_email,
           contact_phone = v_contact_phone,
           updated_at = now()
     where r.id = p_restaurant_id
    returning * into v_restaurant;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'restaurants_slug_key' then
        raise exception 'This public identifier is already in use by another restaurant.';
      end if;
      raise;
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'restaurants_name_check' then
        raise exception 'A restaurant name is required.';
      elsif v_constraint = 'restaurants_slug_check' then
        raise exception 'The public identifier may contain only lowercase letters, digits, and single hyphens.';
      end if;
      raise;
  end;

  perform private.record_audit(
    v_profile_id,
    'restaurant.profile_updated',
    'restaurant',
    v_restaurant.id::text,
    null,
    v_restaurant.id,
    null
  );

  return v_restaurant;
end;
$$;

-- update_restaurant_settings: the restaurant-level basic settings (FR-003) —
-- the timezone that anchors its branches' working-hours meaning. Owner-only;
-- the value is validated against PostgreSQL's own IANA list (research §10).
create function public.update_restaurant_settings(
  p_restaurant_id uuid,
  p_timezone      text
) returns public.restaurants
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_timezone   text := btrim(coalesce(p_timezone, ''));
  v_constraint text;
  v_restaurant public.restaurants;
begin
  -- Authorization (first act): owner (FR-006).
  if p_restaurant_id is null
     or p_restaurant_id not in (select private.owned_restaurant_ids((select auth.uid())))
  then
    raise exception 'You do not have permission to manage this restaurant.'
      using errcode = '42501';
  end if;
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  if v_timezone = '' then
    raise exception 'A timezone is required.';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = v_timezone) then
    raise exception 'Unknown timezone.';
  end if;

  begin
    update public.restaurants r
       set timezone = v_timezone,
           updated_at = now()
     where r.id = p_restaurant_id
    returning * into v_restaurant;
  exception
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'restaurants_timezone_check' then
        raise exception 'A timezone is required.';
      end if;
      raise;
  end;

  perform private.record_audit(
    v_profile_id,
    'restaurant.settings_updated',
    'restaurant',
    v_restaurant.id::text,
    null,
    v_restaurant.id,
    null
  );

  return v_restaurant;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Branch operations (FR-007, FR-008, FR-009)
-- ─────────────────────────────────────────────────────────────────────────────

-- create_branch: creates a branch under the restaurant (FR-007). Display
-- names are deliberately not unique-constrained (feature 002 FR-002
-- continuity). Owner-only.
create function public.create_branch(
  p_restaurant_id uuid,
  p_name          text
) returns public.branches
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_name       text := btrim(coalesce(p_name, ''));
  v_constraint text;
  v_branch     public.branches;
begin
  -- Authorization (first act): owner of the restaurant (FR-006).
  if p_restaurant_id is null
     or p_restaurant_id not in (select private.owned_restaurant_ids((select auth.uid())))
  then
    raise exception 'You do not have permission to manage this restaurant.'
      using errcode = '42501';
  end if;
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  if v_name = '' then
    raise exception 'A branch name is required.';
  end if;

  begin
    insert into public.branches (restaurant_id, name)
    values (p_restaurant_id, v_name)
    returning * into v_branch;
  exception
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'branches_name_check' then
        raise exception 'A branch name is required.';
      end if;
      raise;
  end;

  perform private.record_audit(
    v_profile_id,
    'branch.created',
    'branch',
    v_branch.id::text,
    null,
    v_branch.restaurant_id,
    v_branch.id
  );

  return v_branch;
end;
$$;

-- rename_branch: edits the branch name (FR-007); the branch's identity and
-- everything attached to it are unaffected. Owner-only.
create function public.rename_branch(
  p_branch_id uuid,
  p_name      text
) returns public.branches
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id    uuid;
  v_restaurant_id uuid;
  v_name          text := btrim(coalesce(p_name, ''));
  v_constraint    text;
  v_branch        public.branches;
begin
  -- Authorization (first act): the branch resolves its restaurant, then the
  -- same owner check (cross-tenant targets denied 42501).
  select b.restaurant_id into v_restaurant_id
  from public.branches b where b.id = p_branch_id;
  if v_restaurant_id is null
     or v_restaurant_id not in (select private.owned_restaurant_ids((select auth.uid())))
  then
    raise exception 'You do not have permission to manage this branch.'
      using errcode = '42501';
  end if;
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  if v_name = '' then
    raise exception 'A branch name is required.';
  end if;

  begin
    update public.branches b
       set name = v_name,
           updated_at = now()
     where b.id = p_branch_id
    returning * into v_branch;
  exception
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'branches_name_check' then
        raise exception 'A branch name is required.';
      end if;
      raise;
  end;

  perform private.record_audit(
    v_profile_id,
    'branch.renamed',
    'branch',
    v_branch.id::text,
    null,
    v_branch.restaurant_id,
    v_branch.id
  );

  return v_branch;
end;
$$;

-- replace_branch_working_hours: replaces the branch's entire weekly schedule
-- atomically — delete + insert in one transaction, so a rejection leaves the
-- stored schedule unchanged (FR-008's all-or-nothing). An empty array clears
-- the schedule; a close_time earlier than open_time means the following day
-- and is stored under the weekday it starts on (the generated end_minute
-- carries the +1440 normalization). Owner-only; the branch row is locked so
-- concurrent saves cannot interleave into a mixed schedule (research §7).
create function public.replace_branch_working_hours(
  p_branch_id uuid,
  p_intervals jsonb
) returns setof public.branch_working_hours
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id    uuid;
  v_restaurant_id uuid;
  v_intervals     jsonb := coalesce(p_intervals, '[]'::jsonb);
  v_item          jsonb;
  v_constraint    text;
begin
  -- Authorization (first act): the branch resolves its restaurant, then the
  -- same owner check (cross-tenant targets denied 42501).
  select b.restaurant_id into v_restaurant_id
  from public.branches b where b.id = p_branch_id;
  if v_restaurant_id is null
     or v_restaurant_id not in (select private.owned_restaurant_ids((select auth.uid())))
  then
    raise exception 'You do not have permission to manage this branch.'
      using errcode = '42501';
  end if;
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  -- Validation: input shape (a JSON array of weekday/open/close objects with
  -- HH:MM times, 00:00–23:59).
  if jsonb_typeof(v_intervals) is distinct from 'array' then
    raise exception 'Working hours must be a list of weekday intervals with HH:MM times.';
  end if;

  for v_item in select e from jsonb_array_elements(v_intervals) as t(e) loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or coalesce(jsonb_typeof(v_item -> 'weekday'), 'missing') <> 'string'
       or coalesce(jsonb_typeof(v_item -> 'open_time'), 'missing') <> 'string'
       or coalesce(jsonb_typeof(v_item -> 'close_time'), 'missing') <> 'string'
       or (v_item ->> 'weekday') not in
            ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
       or (v_item ->> 'open_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or (v_item ->> 'close_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then
      raise exception 'Working hours must be a list of weekday intervals with HH:MM times.';
    end if;

    -- Zero-length intervals are rejected (FR-008).
    if (v_item ->> 'open_time') = (v_item ->> 'close_time') then
      raise exception 'An interval cannot start and end at the same time.';
    end if;
  end loop;

  -- Validation: no two intervals of the SAME weekday overlap; a shared
  -- boundary is legal (half-open int4range — 10:00–14:00 + 14:00–18:00
  -- touches). The exclusion constraint remains the backstop.
  if exists (
    with ranges as (
      select
        row_number() over () as rn,
        (e ->> 'weekday')::public.weekday as weekday,
        (extract(epoch from (e ->> 'open_time')::time))::integer / 60 as start_minute,
        (extract(epoch from (e ->> 'close_time')::time))::integer / 60
          + case
              when (e ->> 'close_time')::time > (e ->> 'open_time')::time then 0
              else 1440
            end as end_minute
      from jsonb_array_elements(v_intervals) as t(e)
    )
    select 1
    from ranges a
    join ranges b
      on a.weekday = b.weekday
     and a.rn < b.rn
     and int4range(a.start_minute, a.end_minute) && int4range(b.start_minute, b.end_minute)
  ) then
    raise exception 'Two intervals on the same day overlap.';
  end if;

  -- Serialize concurrent replacements on the branch row.
  perform 1 from public.branches b where b.id = p_branch_id for update;

  delete from public.branch_working_hours w where w.branch_id = p_branch_id;

  begin
    insert into public.branch_working_hours
      (restaurant_id, branch_id, weekday, open_time, close_time)
    select
      v_restaurant_id,
      p_branch_id,
      (e ->> 'weekday')::public.weekday,
      (e ->> 'open_time')::time,
      (e ->> 'close_time')::time
    from jsonb_array_elements(v_intervals) as t(e);
  exception
    when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'branch_working_hours_no_overlap' then
        raise exception 'Two intervals on the same day overlap.';
      end if;
      raise;
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'branch_working_hours_open_close_check' then
        raise exception 'An interval cannot start and end at the same time.';
      end if;
      raise;
  end;

  perform private.record_audit(
    v_profile_id,
    'branch.working_hours_updated',
    'branch',
    p_branch_id::text,
    null,
    v_restaurant_id,
    p_branch_id
  );

  return query
    select w.*
    from public.branch_working_hours w
    where w.branch_id = p_branch_id
    order by w.weekday, w.open_time;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Table operations (FR-010, FR-011, FR-012)
-- ─────────────────────────────────────────────────────────────────────────────

-- create_dining_table: creates a table in the branch (the association is
-- chosen at creation). The label is unique within the branch; the same label
-- in another branch is valid. Owner-only.
create function public.create_dining_table(
  p_branch_id uuid,
  p_label     text
) returns public.dining_tables
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id    uuid;
  v_restaurant_id uuid;
  v_label         text := btrim(coalesce(p_label, ''));
  v_constraint    text;
  v_table         public.dining_tables;
begin
  -- Authorization (first act): the branch resolves its restaurant, then the
  -- same owner check (cross-tenant targets denied 42501).
  select b.restaurant_id into v_restaurant_id
  from public.branches b where b.id = p_branch_id;
  if v_restaurant_id is null
     or v_restaurant_id not in (select private.owned_restaurant_ids((select auth.uid())))
  then
    raise exception 'You do not have permission to manage this branch.'
      using errcode = '42501';
  end if;
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  if v_label = '' then
    raise exception 'A table label is required.';
  end if;

  begin
    insert into public.dining_tables (restaurant_id, branch_id, label)
    values (v_restaurant_id, p_branch_id, v_label)
    returning * into v_table;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'dining_tables_branch_label_key' then
        raise exception 'This table label is already in use in this branch.';
      end if;
      raise;
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'dining_tables_label_check' then
        raise exception 'A table label is required.';
      end if;
      raise;
  end;

  perform private.record_audit(
    v_profile_id,
    'table.created',
    'dining_table',
    v_table.id::text,
    null,
    v_table.restaurant_id,
    v_table.branch_id
  );

  return v_table;
end;
$$;

-- rename_dining_table: renames/renumbers a table — including while inactive
-- (FR-011, US3 scenario 6); per-branch label uniqueness applies. Owner-only.
create function public.rename_dining_table(
  p_dining_table_id uuid,
  p_label           text
) returns public.dining_tables
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id    uuid;
  v_restaurant_id uuid;
  v_label         text := btrim(coalesce(p_label, ''));
  v_constraint    text;
  v_table         public.dining_tables;
begin
  -- Authorization (first act): the table resolves its restaurant, then the
  -- same owner check (cross-tenant targets denied 42501).
  select t.restaurant_id into v_restaurant_id
  from public.dining_tables t where t.id = p_dining_table_id;
  if v_restaurant_id is null
     or v_restaurant_id not in (select private.owned_restaurant_ids((select auth.uid())))
  then
    raise exception 'You do not have permission to manage this table.'
      using errcode = '42501';
  end if;
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  if v_label = '' then
    raise exception 'A table label is required.';
  end if;

  begin
    update public.dining_tables t
       set label = v_label,
           updated_at = now()
     where t.id = p_dining_table_id
    returning * into v_table;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'dining_tables_branch_label_key' then
        raise exception 'This table label is already in use in this branch.';
      end if;
      raise;
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'dining_tables_label_check' then
        raise exception 'A table label is required.';
      end if;
      raise;
  end;

  perform private.record_audit(
    v_profile_id,
    'table.renamed',
    'dining_table',
    v_table.id::text,
    null,
    v_table.restaurant_id,
    v_table.branch_id
  );

  return v_table;
end;
$$;

-- set_dining_table_active: sets the explicit activation state (FR-011/FR-012).
-- Repeating a transition is a no-op that leaves state consistent and writes
-- NO audit record (nothing changed). Tables are never deleted. Owner-only.
create function public.set_dining_table_active(
  p_dining_table_id uuid,
  p_active          boolean
) returns public.dining_tables
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id    uuid;
  v_restaurant_id uuid;
  v_table         public.dining_tables;
begin
  -- Authorization (first act): the table resolves its restaurant, then the
  -- same owner check (cross-tenant targets denied 42501).
  select t.restaurant_id into v_restaurant_id
  from public.dining_tables t where t.id = p_dining_table_id;
  if v_restaurant_id is null
     or v_restaurant_id not in (select private.owned_restaurant_ids((select auth.uid())))
  then
    raise exception 'You do not have permission to manage this table.'
      using errcode = '42501';
  end if;
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  if p_active is null then
    raise exception 'An activation state is required.';
  end if;

  select t.* into v_table
  from public.dining_tables t where t.id = p_dining_table_id;

  -- No-op when the state already holds (Constitution VI); no audit record.
  if v_table.is_active is distinct from p_active then
    update public.dining_tables t
       set is_active = p_active,
           updated_at = now()
     where t.id = p_dining_table_id
    returning * into v_table;

    perform private.record_audit(
      v_profile_id,
      case when p_active then 'table.activated' else 'table.deactivated' end,
      'dining_table',
      v_table.id::text,
      null,
      v_table.restaurant_id,
      v_table.branch_id
    );
  end if;

  return v_table;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Execute grants: authenticated only, revoked from public and anon
-- (contracts/database-functions.md "Common properties").
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.create_restaurant(text, text, text, text, text, text)
  from public, anon;
revoke all on function public.update_restaurant_profile(uuid, text, text, text, text, text)
  from public, anon;
revoke all on function public.update_restaurant_settings(uuid, text)
  from public, anon;
revoke all on function public.create_branch(uuid, text)
  from public, anon;
revoke all on function public.rename_branch(uuid, text)
  from public, anon;
revoke all on function public.replace_branch_working_hours(uuid, jsonb)
  from public, anon;
revoke all on function public.create_dining_table(uuid, text)
  from public, anon;
revoke all on function public.rename_dining_table(uuid, text)
  from public, anon;
revoke all on function public.set_dining_table_active(uuid, boolean)
  from public, anon;

grant execute on function public.create_restaurant(text, text, text, text, text, text)
  to authenticated;
grant execute on function public.update_restaurant_profile(uuid, text, text, text, text, text)
  to authenticated;
grant execute on function public.update_restaurant_settings(uuid, text)
  to authenticated;
grant execute on function public.create_branch(uuid, text)
  to authenticated;
grant execute on function public.rename_branch(uuid, text)
  to authenticated;
grant execute on function public.replace_branch_working_hours(uuid, jsonb)
  to authenticated;
grant execute on function public.create_dining_table(uuid, text)
  to authenticated;
grant execute on function public.rename_dining_table(uuid, text)
  to authenticated;
grant execute on function public.set_dining_table_active(uuid, boolean)
  to authenticated;
