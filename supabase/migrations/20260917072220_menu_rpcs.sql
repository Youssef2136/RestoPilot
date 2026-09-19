-- Menu RPCs: the fourteen write operations, the branch menu read projection,
-- and the one new private helper (spec 005 FR-002, FR-003, FR-005–FR-025;
-- contracts/database-functions.md; data-model.md audit vocabulary;
-- research.md §1, §6–§9).
--
-- Discipline inherited from features 002–004: every function lives in the
-- `public` schema, is `security definer` (except the read projection, which is
-- `security invoker` by design), created with `set search_path = ''` and
-- schema-qualified bodies, authorizes its caller as its first act through the
-- private helper family, and writes exactly one private.record_audit record
-- per accepted change in the same transaction. Execute is granted to
-- `authenticated` only; no table write grant exists anywhere — these
-- functions are the only write paths to menu data.
--
-- Error model (load-bearing for the client contract):
--   42501 — authorization denial (wrong role, other restaurant, other
--           branch, no linked profile, out-of-scope branch read).
--   P0001 — validation failure, and every constraint violation these
--           functions can hit, caught BY CONSTRAINT NAME and re-raised with
--           a user-facing message. The constraints remain the declarative
--           backstop for any other writer.
--
-- Shared rules:
--   * "actual change only" — a call whose values already match writes nothing
--     (no updated_at bump, no audit row) and returns the stored row. This is
--     how FR-016's "saving an unchanged price MUST NOT produce a recorded
--     change" is satisfied.
--   * prices are numeric(12,2), 0 … 999999999.99, and a value with more than
--     two decimals is REJECTED, never rounded (research.md §9).

-- ─────────────────────────────────────────────────────────────────────────────
-- The new private helper: the branches a caller manages as branch manager
-- (the clarified role split — availability is owner-or-that-branch's-manager)
-- ─────────────────────────────────────────────────────────────────────────────

create function private.branch_manager_branch_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.branch_id
  from public.staff_memberships m
  join public.profiles p on p.id = m.profile_id
  where p.auth_user_id = p_user
    and m.role = 'branch_manager'
    and m.branch_id is not null
$$;

revoke all on function private.branch_manager_branch_ids(uuid) from public, anon;
grant execute on function private.branch_manager_branch_ids(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Categories (owner only)
-- ─────────────────────────────────────────────────────────────────────────────

create function public.create_menu_category(
  p_restaurant_id uuid,
  p_name text,
  p_description text default null
) returns public.menu_categories
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_sort_order integer;
  v_category public.menu_categories;
  v_constraint text;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  if v_profile_id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = p_restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'A category name is required.';
  end if;
  if length(v_name) > 80 then
    raise exception 'A category name may be at most 80 characters.';
  end if;
  if v_description is not null and length(v_description) > 500 then
    raise exception 'A category description may be at most 500 characters.';
  end if;

  select coalesce(max(c.sort_order) + 1, 1) into v_sort_order
  from public.menu_categories c
  where c.restaurant_id = p_restaurant_id;

  begin
    insert into public.menu_categories (restaurant_id, name, description, sort_order)
    values (p_restaurant_id, v_name, v_description, v_sort_order)
    returning * into v_category;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'menu_categories_restaurant_name_key' then
        raise exception 'A category with this name already exists.';
      end if;
      raise;
  end;

  perform private.record_audit(
    v_profile_id, 'menu.category_created', 'menu_category', v_category.id::text,
    null, p_restaurant_id, null
  );

  return v_category;
end;
$$;

create function public.update_menu_category(
  p_category_id uuid,
  p_name text,
  p_description text default null
) returns public.menu_categories
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_stored public.menu_categories;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_changes text := '';
  v_category public.menu_categories;
  v_constraint text;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_stored from public.menu_categories c where c.id = p_category_id;

  if v_profile_id is null
     or v_stored.id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = v_stored.restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'A category name is required.';
  end if;
  if length(v_name) > 80 then
    raise exception 'A category name may be at most 80 characters.';
  end if;
  if v_description is not null and length(v_description) > 500 then
    raise exception 'A category description may be at most 500 characters.';
  end if;

  -- Actual change only: an unchanged call writes nothing and audits nothing.
  if v_stored.name = v_name and v_stored.description is not distinct from v_description then
    return v_stored;
  end if;

  if v_stored.name <> v_name then
    v_changes := 'name: "' || v_stored.name || '" -> "' || v_name || '"';
  end if;
  if v_stored.description is distinct from v_description then
    if v_changes <> '' then
      v_changes := v_changes || '; ';
    end if;
    v_changes := v_changes || 'description: '
      || case when v_stored.description is null then 'none' else '"' || v_stored.description || '"' end
      || ' -> '
      || case when v_description is null then 'none' else '"' || v_description || '"' end;
  end if;

  begin
    update public.menu_categories c
    set name = v_name, description = v_description, updated_at = now()
    where c.id = p_category_id
    returning * into v_category;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'menu_categories_restaurant_name_key' then
        raise exception 'A category with this name already exists.';
      end if;
      raise;
  end;

  perform private.record_audit(
    v_profile_id, 'menu.category_updated', 'menu_category', v_category.id::text,
    v_changes, v_category.restaurant_id, null
  );

  return v_category;
end;
$$;

create function public.delete_menu_category(p_category_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_stored public.menu_categories;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_stored from public.menu_categories c where c.id = p_category_id;

  if v_profile_id is null
     or v_stored.id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = v_stored.restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  begin
    delete from public.menu_categories c where c.id = p_category_id;
  exception
    when foreign_key_violation then
      raise exception 'This category still contains items; move them to another category first.';
  end;

  perform private.record_audit(
    v_profile_id, 'menu.category_deleted', 'menu_category', p_category_id::text,
    null, v_stored.restaurant_id, null
  );
end;
$$;

create function public.reorder_menu_categories(
  p_restaurant_id uuid,
  p_category_ids uuid[]
) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_distinct integer;
  v_owned integer;
  v_current uuid[];
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  if v_profile_id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = p_restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  if p_category_ids is null or cardinality(p_category_ids) = 0 then
    raise exception 'The new order must list every category of this restaurant.';
  end if;

  select (select count(distinct x) from unnest(p_category_ids) as u(x)),
         (select count(*) from public.menu_categories c
           where c.restaurant_id = p_restaurant_id and c.id = any (p_category_ids))
    into v_distinct, v_owned;

  if v_distinct <> cardinality(p_category_ids) then
    raise exception 'The new order contains a duplicate category.';
  end if;
  if v_owned <> cardinality(p_category_ids)
     or (select count(*) from public.menu_categories c where c.restaurant_id = p_restaurant_id)
        <> cardinality(p_category_ids) then
    raise exception 'The new order must list every category of this restaurant.';
  end if;

  select array_agg(c.id order by c.sort_order, c.created_at, c.id) into v_current
  from public.menu_categories c
  where c.restaurant_id = p_restaurant_id;

  if v_current = p_category_ids then
    return;  -- actual change only
  end if;

  update public.menu_categories c
  set sort_order = u.ord, updated_at = now()
  from unnest(p_category_ids) with ordinality as u(id, ord)
  where c.id = u.id
    and c.restaurant_id = p_restaurant_id;

  perform private.record_audit(
    v_profile_id, 'menu.categories_reordered', 'menu_category', p_restaurant_id::text,
    null, p_restaurant_id, null
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Items (owner only)
-- ─────────────────────────────────────────────────────────────────────────────

create function public.create_menu_item(
  p_category_id uuid,
  p_name text,
  p_description text default null,
  p_price numeric default null
) returns public.menu_items
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_category public.menu_categories;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_sort_order integer;
  v_item public.menu_items;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_category from public.menu_categories c where c.id = p_category_id;

  if v_profile_id is null
     or v_category.id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = v_category.restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'An item name is required.';
  end if;
  if length(v_name) > 120 then
    raise exception 'An item name may be at most 120 characters.';
  end if;
  if v_description is not null and length(v_description) > 1000 then
    raise exception 'An item description may be at most 1000 characters.';
  end if;
  if p_price is null then
    raise exception 'A price is required.';
  end if;
  if p_price < 0 then
    raise exception 'A price may not be negative.';
  end if;
  if p_price <> round(p_price, 2) then
    raise exception 'A price may have at most two decimal places.';
  end if;
  if p_price > 999999999.99 then
    raise exception 'This price is too large.';
  end if;

  select coalesce(max(i.sort_order) + 1, 1) into v_sort_order
  from public.menu_items i
  where i.category_id = p_category_id;

  insert into public.menu_items (restaurant_id, category_id, name, description, price, sort_order)
  values (v_category.restaurant_id, p_category_id, v_name, v_description, p_price, v_sort_order)
  returning * into v_item;

  perform private.record_audit(
    v_profile_id, 'menu.item_created', 'menu_item', v_item.id::text,
    null, v_item.restaurant_id, null
  );

  return v_item;
end;
$$;

create function public.update_menu_item(
  p_item_id uuid,
  p_name text,
  p_description text default null,
  p_price numeric default null
) returns public.menu_items
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_stored public.menu_items;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_changes text := '';
  v_price_changed boolean := false;
  v_action text;
  v_item public.menu_items;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_stored from public.menu_items i where i.id = p_item_id;

  if v_profile_id is null
     or v_stored.id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = v_stored.restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'An item name is required.';
  end if;
  if length(v_name) > 120 then
    raise exception 'An item name may be at most 120 characters.';
  end if;
  if v_description is not null and length(v_description) > 1000 then
    raise exception 'An item description may be at most 1000 characters.';
  end if;
  if p_price is null then
    raise exception 'A price is required.';
  end if;
  if p_price < 0 then
    raise exception 'A price may not be negative.';
  end if;
  if p_price <> round(p_price, 2) then
    raise exception 'A price may have at most two decimal places.';
  end if;
  if p_price > 999999999.99 then
    raise exception 'This price is too large.';
  end if;

  -- Actual change only (FR-016): an unchanged save is silent.
  if v_stored.name = v_name
     and v_stored.description is not distinct from v_description
     and v_stored.price = p_price then
    return v_stored;
  end if;

  v_price_changed := v_stored.price <> p_price;

  if v_stored.name <> v_name then
    v_changes := 'name: "' || v_stored.name || '" -> "' || v_name || '"';
  end if;
  if v_stored.description is distinct from v_description then
    if v_changes <> '' then
      v_changes := v_changes || '; ';
    end if;
    v_changes := v_changes || 'description: '
      || case when v_stored.description is null then 'none' else '"' || v_stored.description || '"' end
      || ' -> '
      || case when v_description is null then 'none' else '"' || v_description || '"' end;
  end if;
  if v_price_changed then
    if v_changes <> '' then
      v_changes := v_changes || '; ';
    end if;
    v_changes := v_changes || 'price: ' || v_stored.price::text || ' -> ' || p_price::text;
  end if;

  update public.menu_items i
  set name = v_name, description = v_description, price = p_price, updated_at = now()
  where i.id = p_item_id
  returning * into v_item;

  -- A real price change is recorded under its own action (FR-016).
  v_action := case when v_price_changed then 'menu.item_price_changed' else 'menu.item_updated' end;

  perform private.record_audit(
    v_profile_id, v_action, 'menu_item', v_item.id::text,
    v_changes, v_item.restaurant_id, null
  );

  return v_item;
end;
$$;

create function public.move_menu_item(
  p_item_id uuid,
  p_category_id uuid
) returns public.menu_items
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_stored public.menu_items;
  v_source public.menu_categories;
  v_target public.menu_categories;
  v_sort_order integer;
  v_item public.menu_items;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_stored from public.menu_items i where i.id = p_item_id;

  if v_profile_id is null
     or v_stored.id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = v_stored.restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  select * into v_target from public.menu_categories c where c.id = p_category_id;

  -- A cross-tenant target is a denial, never a validation message.
  if v_target.id is null or v_target.restaurant_id <> v_stored.restaurant_id then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  if v_target.id = v_stored.category_id then
    raise exception 'This item is already in that category.';
  end if;

  select * into v_source from public.menu_categories c where c.id = v_stored.category_id;

  select coalesce(max(i.sort_order) + 1, 1) into v_sort_order
  from public.menu_items i
  where i.category_id = p_category_id;

  update public.menu_items i
  set category_id = p_category_id, sort_order = v_sort_order, updated_at = now()
  where i.id = p_item_id
  returning * into v_item;

  perform private.record_audit(
    v_profile_id, 'menu.item_moved', 'menu_item', v_item.id::text,
    'category: "' || v_source.name || '" -> "' || v_target.name || '"',
    v_item.restaurant_id, null
  );

  return v_item;
end;
$$;

create function public.reorder_menu_items(
  p_category_id uuid,
  p_item_ids uuid[]
) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_category public.menu_categories;
  v_count integer;
  v_owned integer;
  v_current uuid[];
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_category from public.menu_categories c where c.id = p_category_id;

  if v_profile_id is null
     or v_category.id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = v_category.restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    raise exception 'The new order must list every item of this category.';
  end if;

  if (select count(distinct x) from unnest(p_item_ids) as u(x)) <> cardinality(p_item_ids) then
    raise exception 'The new order contains a duplicate item.';
  end if;

  select (select count(*) from public.menu_items i
           where i.category_id = p_category_id and i.id = any (p_item_ids))
    into v_owned;

  if v_owned <> cardinality(p_item_ids)
     or (select count(*) from public.menu_items i where i.category_id = p_category_id)
        <> cardinality(p_item_ids) then
    raise exception 'The new order must list every item of this category.';
  end if;

  select array_agg(i.id order by i.sort_order, i.created_at, i.id) into v_current
  from public.menu_items i
  where i.category_id = p_category_id;

  if v_current = p_item_ids then
    return;  -- actual change only
  end if;

  update public.menu_items i
  set sort_order = u.ord, updated_at = now()
  from unnest(p_item_ids) with ordinality as u(id, ord)
  where i.id = u.id
    and i.category_id = p_category_id;

  perform private.record_audit(
    v_profile_id, 'menu.items_reordered', 'menu_item', p_category_id::text,
    null, v_category.restaurant_id, null
  );
end;
$$;

create function public.set_menu_item_availability(
  p_item_id uuid,
  p_is_available boolean
) returns public.menu_items
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_stored public.menu_items;
  v_item public.menu_items;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_stored from public.menu_items i where i.id = p_item_id;

  if v_profile_id is null
     or v_stored.id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = v_stored.restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  if p_is_available is null then
    raise exception 'An availability state is required.';
  end if;

  if v_stored.is_available = p_is_available then
    return v_stored;  -- actual change only
  end if;

  update public.menu_items i
  set is_available = p_is_available, updated_at = now()
  where i.id = p_item_id
  returning * into v_item;

  perform private.record_audit(
    v_profile_id, 'menu.item_availability_changed', 'menu_item', v_item.id::text,
    'restaurant availability: '
      || case when v_stored.is_available then 'available' else 'unavailable' end
      || ' -> '
      || case when p_is_available then 'available' else 'unavailable' end,
    v_item.restaurant_id, null
  );

  return v_item;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Branch availability (owner of the restaurant, or the manager of THAT branch)
-- ─────────────────────────────────────────────────────────────────────────────

create function public.set_branch_item_availability(
  p_branch_id uuid,
  p_item_id uuid,
  p_is_available_at_branch boolean
) returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_branch public.branches;
  v_item public.menu_items;
  v_inserted_id uuid;
  v_changed boolean := false;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_branch from public.branches b where b.id = p_branch_id;

  if v_profile_id is null
     or v_branch.id is null
     or not (
       exists (
         select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
         where o.restaurant_id = v_branch.restaurant_id
       )
       or v_branch.id in (select private.branch_manager_branch_ids((select auth.uid())))
     ) then
    raise exception 'You do not have permission to manage this branch''s availability.'
      using errcode = '42501';
  end if;

  select * into v_item from public.menu_items i where i.id = p_item_id;

  if v_item.id is null or v_item.restaurant_id <> v_branch.restaurant_id then
    raise exception 'You do not have permission to manage this branch''s availability.'
      using errcode = '42501';
  end if;

  if p_is_available_at_branch is null then
    raise exception 'An availability state is required.';
  end if;

  if p_is_available_at_branch then
    -- Clearing the override returns the branch to the restaurant-wide state.
    if exists (
      select 1 from public.branch_unavailable_items o
      where o.branch_id = p_branch_id and o.item_id = p_item_id
    ) then
      delete from public.branch_unavailable_items o
      where o.branch_id = p_branch_id and o.item_id = p_item_id;
      v_changed := true;
    end if;
  else
    begin
      insert into public.branch_unavailable_items (restaurant_id, branch_id, item_id)
      values (v_branch.restaurant_id, p_branch_id, p_item_id)
      on conflict on constraint branch_unavailable_items_branch_item_key do nothing
      returning id into v_inserted_id;

      v_changed := v_inserted_id is not null;
    exception
      when unique_violation then
        v_changed := false;  -- concurrent duplicate: already unavailable, idempotent
    end;
  end if;

  if v_changed then
    perform private.record_audit(
      v_profile_id, 'menu.branch_availability_changed', 'menu_item', p_item_id::text,
      'branch availability: '
        || case when p_is_available_at_branch then 'unavailable -> available' else 'available -> unavailable' end,
      v_branch.restaurant_id, p_branch_id
    );
  end if;

  return v_changed;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Item image reference (owner only)
-- ─────────────────────────────────────────────────────────────────────────────

create function public.set_menu_item_image(
  p_item_id uuid,
  p_image_path text
) returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_stored public.menu_items;
  v_path text := nullif(btrim(coalesce(p_image_path, '')), '');
  v_prefix text;
  v_name text;
  v_previous text;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_stored from public.menu_items i where i.id = p_item_id;

  if v_profile_id is null
     or v_stored.id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = v_stored.restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  if v_path is not null then
    v_prefix := 'restaurant/' || v_stored.restaurant_id::text || '/item/' || v_stored.id::text || '/';
    if length(v_path) > 200 or left(v_path, length(v_prefix)) <> v_prefix then
      raise exception 'The image path does not belong to this item.';
    end if;
    v_name := substr(v_path, length(v_prefix) + 1);
    if v_name !~ '^[A-Za-z0-9._-]{1,120}$' or v_name !~* '\.(jpg|jpeg|png|webp)$' then
      raise exception 'The image path does not belong to this item.';
    end if;
  end if;

  -- Actual change only. A no-op returns NULL: nothing was superseded, so the
  -- client must not delete the object the item still references.
  if v_stored.image_path is not distinct from v_path then
    return null;
  end if;

  v_previous := v_stored.image_path;

  update public.menu_items i
  set image_path = v_path, updated_at = now()
  where i.id = p_item_id;

  perform private.record_audit(
    v_profile_id, 'menu.item_image_changed', 'menu_item', p_item_id::text,
    'image: ' || coalesce(v_previous, 'none') || ' -> ' || coalesce(v_path, 'none'),
    v_stored.restaurant_id, null
  );

  return v_previous;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Extras (owner only; the 20-per-item bound is serialized by an item row lock)
-- ─────────────────────────────────────────────────────────────────────────────

create function public.add_menu_item_extra(
  p_item_id uuid,
  p_name text,
  p_price_adjustment numeric default 0
) returns public.menu_item_extras
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_item public.menu_items;
  v_name text := btrim(coalesce(p_name, ''));
  v_sort_order integer;
  v_extra public.menu_item_extras;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  -- The row lock serializes the extras bound for concurrent writers
  -- (research.md §8; the same discipline as feature 004's last-owner rule).
  select * into v_item from public.menu_items i where i.id = p_item_id for update;

  if v_profile_id is null
     or v_item.id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = v_item.restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'An extra name is required.';
  end if;
  if length(v_name) > 80 then
    raise exception 'An extra name may be at most 80 characters.';
  end if;
  if p_price_adjustment is null then
    raise exception 'A price adjustment is required.';
  end if;
  if p_price_adjustment < 0 then
    raise exception 'A price adjustment may not be negative.';
  end if;
  if p_price_adjustment <> round(p_price_adjustment, 2) then
    raise exception 'A price adjustment may have at most two decimal places.';
  end if;
  if p_price_adjustment > 999999999.99 then
    raise exception 'This price adjustment is too large.';
  end if;

  if (select count(*) from public.menu_item_extras e where e.item_id = p_item_id) >= 20 then
    raise exception 'This item already has the maximum of 20 extras.';
  end if;

  select coalesce(max(e.sort_order) + 1, 1) into v_sort_order
  from public.menu_item_extras e
  where e.item_id = p_item_id;

  insert into public.menu_item_extras (restaurant_id, item_id, name, price_adjustment, sort_order)
  values (v_item.restaurant_id, p_item_id, v_name, p_price_adjustment, v_sort_order)
  returning * into v_extra;

  perform private.record_audit(
    v_profile_id, 'menu.item_extra_added', 'menu_item_extra', v_extra.id::text,
    null, v_extra.restaurant_id, null
  );

  return v_extra;
end;
$$;

create function public.update_menu_item_extra(
  p_extra_id uuid,
  p_name text,
  p_price_adjustment numeric default 0
) returns public.menu_item_extras
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_stored public.menu_item_extras;
  v_name text := btrim(coalesce(p_name, ''));
  v_changes text := '';
  v_extra public.menu_item_extras;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_stored from public.menu_item_extras e where e.id = p_extra_id;

  if v_profile_id is null
     or v_stored.id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = v_stored.restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'An extra name is required.';
  end if;
  if length(v_name) > 80 then
    raise exception 'An extra name may be at most 80 characters.';
  end if;
  if p_price_adjustment is null then
    raise exception 'A price adjustment is required.';
  end if;
  if p_price_adjustment < 0 then
    raise exception 'A price adjustment may not be negative.';
  end if;
  if p_price_adjustment <> round(p_price_adjustment, 2) then
    raise exception 'A price adjustment may have at most two decimal places.';
  end if;
  if p_price_adjustment > 999999999.99 then
    raise exception 'This price adjustment is too large.';
  end if;

  if v_stored.name = v_name and v_stored.price_adjustment = p_price_adjustment then
    return v_stored;  -- actual change only
  end if;

  if v_stored.name <> v_name then
    v_changes := 'name: "' || v_stored.name || '" -> "' || v_name || '"';
  end if;
  if v_stored.price_adjustment <> p_price_adjustment then
    if v_changes <> '' then
      v_changes := v_changes || '; ';
    end if;
    v_changes := v_changes || 'price_adjustment: '
      || v_stored.price_adjustment::text || ' -> ' || p_price_adjustment::text;
  end if;

  update public.menu_item_extras e
  set name = v_name, price_adjustment = p_price_adjustment, updated_at = now()
  where e.id = p_extra_id
  returning * into v_extra;

  perform private.record_audit(
    v_profile_id, 'menu.item_extra_updated', 'menu_item_extra', v_extra.id::text,
    v_changes, v_extra.restaurant_id, null
  );

  return v_extra;
end;
$$;

create function public.remove_menu_item_extra(p_extra_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_stored public.menu_item_extras;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_stored from public.menu_item_extras e where e.id = p_extra_id;

  if v_profile_id is null
     or v_stored.id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = v_stored.restaurant_id
     ) then
    raise exception 'You do not have permission to manage this restaurant''s menu.'
      using errcode = '42501';
  end if;

  delete from public.menu_item_extras e where e.id = p_extra_id;

  perform private.record_audit(
    v_profile_id, 'menu.item_extra_removed', 'menu_item_extra', p_extra_id::text,
    null, v_stored.restaurant_id, null
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read projection: the branch's menu as customers see it (security INVOKER)
-- ─────────────────────────────────────────────────────────────────────────────
-- Authorizes explicitly (owner of the branch's restaurant, or any
-- branch-scoped membership on that branch), then reads under the caller's own
-- policies — so even a mistake in the check can only expose rows the policies
-- already allow (feature 003's current_auth_context posture, FR-014).

create function public.get_branch_menu(p_branch_id uuid)
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

  if v_branch.id is null
     or not (
       v_branch.id in (select private.staff_branch_ids((select auth.uid())))
       or v_branch.restaurant_id in (select private.owned_restaurant_ids((select auth.uid())))
     ) then
    raise exception 'You do not have permission to view this branch''s menu.'
      using errcode = '42501';
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Execute grants: authenticated only (revoked from public/anon)
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.create_menu_category(uuid, text, text) from public, anon;
revoke all on function public.update_menu_category(uuid, text, text) from public, anon;
revoke all on function public.delete_menu_category(uuid) from public, anon;
revoke all on function public.reorder_menu_categories(uuid, uuid[]) from public, anon;
revoke all on function public.create_menu_item(uuid, text, text, numeric) from public, anon;
revoke all on function public.update_menu_item(uuid, text, text, numeric) from public, anon;
revoke all on function public.move_menu_item(uuid, uuid) from public, anon;
revoke all on function public.reorder_menu_items(uuid, uuid[]) from public, anon;
revoke all on function public.set_menu_item_availability(uuid, boolean) from public, anon;
revoke all on function public.set_branch_item_availability(uuid, uuid, boolean) from public, anon;
revoke all on function public.set_menu_item_image(uuid, text) from public, anon;
revoke all on function public.add_menu_item_extra(uuid, text, numeric) from public, anon;
revoke all on function public.update_menu_item_extra(uuid, text, numeric) from public, anon;
revoke all on function public.remove_menu_item_extra(uuid) from public, anon;
revoke all on function public.get_branch_menu(uuid) from public, anon;

grant execute on function public.create_menu_category(uuid, text, text) to authenticated;
grant execute on function public.update_menu_category(uuid, text, text) to authenticated;
grant execute on function public.delete_menu_category(uuid) to authenticated;
grant execute on function public.reorder_menu_categories(uuid, uuid[]) to authenticated;
grant execute on function public.create_menu_item(uuid, text, text, numeric) to authenticated;
grant execute on function public.update_menu_item(uuid, text, text, numeric) to authenticated;
grant execute on function public.move_menu_item(uuid, uuid) to authenticated;
grant execute on function public.reorder_menu_items(uuid, uuid[]) to authenticated;
grant execute on function public.set_menu_item_availability(uuid, boolean) to authenticated;
grant execute on function public.set_branch_item_availability(uuid, uuid, boolean) to authenticated;
grant execute on function public.set_menu_item_image(uuid, text) to authenticated;
grant execute on function public.add_menu_item_extra(uuid, text, numeric) to authenticated;
grant execute on function public.update_menu_item_extra(uuid, text, numeric) to authenticated;
grant execute on function public.remove_menu_item_extra(uuid) to authenticated;
grant execute on function public.get_branch_menu(uuid) to authenticated;
