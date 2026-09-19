-- Menu RPC price-format correction (spec 005 FR-016/FR-024;
-- contracts/database-functions.md §1: "prices formatted to two decimals").
--
-- The two update functions render their audit change string from the incoming
-- PARAMETER, which is an unconstrained `numeric` — so a price of 24.5 was
-- recorded as "price: 24.00 -> 24.5" instead of the contract's
-- "price: 24.00 -> 24.50". The stored columns were always exact
-- (`numeric(12,2)`); only the recorded change string was under-scaled, which
-- the US3 database test caught.
--
-- Found by tests/database/menu.rpc.test.ts (US3 block). Replacements keep the
-- existing signature, body, and ACLs — `create or replace` preserves grants,
-- so no grant statements are needed here.

create or replace function public.update_menu_item(
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
    v_changes := v_changes || 'price: ' || v_stored.price::text || ' -> ' || round(p_price, 2)::numeric(12, 2)::text;
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

create or replace function public.update_menu_item_extra(
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
      || v_stored.price_adjustment::text
      || ' -> '
      || round(p_price_adjustment, 2)::numeric(12, 2)::text;
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
