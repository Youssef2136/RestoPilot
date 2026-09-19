-- Tax RPCs: the nine Phase 5 functions (spec 006 FR-002, FR-003, FR-005–FR-018,
-- FR-021; contracts/database-functions.md; research.md §1–§7).
--
-- Discipline inherited from features 002–005: every function lives in the
-- `public` schema, is `security definer` (except the two reads, which are
-- `security invoker` by design), created with `set search_path = ''` and
-- schema-qualified bodies, authorizes its caller as its first act through the
-- private helper family, and writes exactly one private.record_audit record
-- per accepted change in the same transaction. Execute is granted to
-- `authenticated` only; no table write grant exists anywhere — these
-- functions are the only write paths to tax data.
--
-- Error model (load-bearing for the client contract):
--   42501 — authorization denial (wrong role, other restaurant, other
--           branch, no linked profile, out-of-scope read).
--   P0001 — validation failure, and every constraint violation these
--           functions can hit, caught BY CONSTRAINT NAME and re-raised with
--           a user-facing message. The constraints remain the declarative
--           backstop for any other writer.
--
-- Shared rules:
--   * "actual change only" — a call whose values already match writes nothing
--     (no audit row) and returns the stored state.
--   * rates are numeric(7,4), 0–100 inclusive; a value with more than four
--     decimals is REJECTED, never rounded (research.md §1).
--   * amounts are computed in SQL `numeric` only; every line is rounded once,
--     half-up, at the end of its own calculation — round(numeric, 2) rounds
--     half away from zero, and tax bases here are always non-negative
--     (research.md §1).
--
-- NOTE ON THIS MIGRATION'S TWO FILES: the bodies are long, so the functions
-- are split across this file's two halves at creation time — the schema part
-- (tax_schema) created the tables; this migration creates the rate validator
-- and the six write functions; the reads and the snapshot function follow in
-- 20260919122120_tax_reads.sql, and the grants for every function live with
-- their creation. The canonical workflow is unchanged: this file is applied
-- once, never edited afterwards (FR-024).

-- ─────────────────────────────────────────────────────────────────────────────
-- Shared rate validation (research.md §1): an exact percentage string of up
-- to four decimals in [0, 100]. The client validates the same shape before
-- submit; the database is the authority.
--
-- numeric(7,4): widened from the originally written numeric(5,4) — the seed's
-- own 10% fixture cannot be stored in (5,4), which caps at 9.9999.
-- ─────────────────────────────────────────────────────────────────────────────

create function private.validate_tax_rate(p_rate text)
returns numeric(7, 4)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_rate is null or btrim(p_rate) = '' then
    raise exception 'A tax rate is required.';
  end if;
  if btrim(p_rate) !~ '^\d{1,3}(\.\d{1,4})?$' then
    raise exception 'A tax rate must be between 0 and 100 with at most four decimal places.';
  end if;
  if btrim(p_rate)::numeric > 100 then
    raise exception 'A tax rate must be between 0 and 100 with at most four decimal places.';
  end if;
  return btrim(p_rate)::numeric;
end;
$$;

revoke all on function private.validate_tax_rate(text) from public, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rule authorization helper (shared shape): returns the rule's restaurant id
-- when the caller may WRITE the rule — owner for restaurant-level rules;
-- owner or the owning branch's branch manager for branch-only rules — and
-- null otherwise. Split out so create/update/reorder/retire/delete share one
-- definition of clarification 2's boundary.
-- ─────────────────────────────────────────────────────────────────────────────

create function private.tax_rule_write_context(p_rule_id uuid)
returns table (restaurant_id uuid, branch_id uuid, authorized boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rule public.tax_rules;
  v_is_owner boolean;
  v_is_branch_manager boolean;
begin
  select * into v_rule from public.tax_rules r where r.id = p_rule_id;
  if v_rule.id is null then
    return;
  end if;

  v_is_owner := v_rule.restaurant_id in (
    select o.restaurant_id from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
  );
  v_is_branch_manager := v_rule.branch_id in (
    select b.branch_id from private.branch_manager_branch_ids((select auth.uid())) as b(branch_id)
  );

  restaurant_id := v_rule.restaurant_id;
  branch_id := v_rule.branch_id;
  authorized := v_is_owner or (v_rule.branch_id is not null and v_is_branch_manager);
  -- RETURNS TABLE is a set-returning function: a bare `return;` emits NO row
  -- (even with the OUT parameters assigned) — the row must be emitted.
  return next;
end;
$$;

revoke all on function private.tax_rule_write_context(uuid) from public, anon;
grant execute on function private.tax_rule_write_context(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- create_tax_rule (FR-005; owner for restaurant-level, owner or that branch's
-- manager for branch-only)
-- ─────────────────────────────────────────────────────────────────────────────

create function public.create_tax_rule(
  p_restaurant_id uuid,
  p_name text,
  p_rate text,
  p_scope text,
  p_branch_id uuid default null,
  p_sort_order integer default null,
  p_item_ids uuid[] default null,
  p_category_ids uuid[] default null,
  p_compound_source_ids uuid[] default null
) returns public.tax_rules
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_rate numeric(7, 4);
  v_branch public.branches;
  v_rule public.tax_rules;
  v_source uuid;
  v_constraint text;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  if v_profile_id is null then
    raise exception 'You do not have permission to manage tax configuration.'
      using errcode = '42501';
  end if;

  if p_branch_id is null then
    -- Restaurant-level rule: owner only.
    if not exists (
      select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
      where o.restaurant_id = p_restaurant_id
    ) then
      raise exception 'You do not have permission to manage this restaurant''s tax configuration.'
        using errcode = '42501';
    end if;
  else
    -- Branch-only rule: owner of the restaurant, or a branch manager of THAT
    -- branch (clarification 2). The branch must belong to the restaurant.
    select * into v_branch from public.branches b where b.id = p_branch_id;
    if v_branch.id is null or v_branch.restaurant_id <> p_restaurant_id then
      raise exception 'Tax rule not found.';
    end if;
    if not (
      p_restaurant_id in (select private.owned_restaurant_ids((select auth.uid())))
      or p_branch_id in (select private.branch_manager_branch_ids((select auth.uid())))
    ) then
      raise exception 'You do not have permission to manage this branch''s tax configuration.'
        using errcode = '42501';
    end if;
  end if;

  if v_name = '' then
    raise exception 'A tax rule name is required.';
  end if;
  if length(v_name) > 80 then
    raise exception 'A tax rule name may be at most 80 characters.';
  end if;
  v_rate := private.validate_tax_rate(p_rate);
  if p_scope not in ('total', 'items', 'categories') then
    raise exception 'A tax rule scope must be total, items, or categories.';
  end if;
  if p_scope = 'total'
     and coalesce(array_length(p_item_ids, 1), 0) + coalesce(array_length(p_category_ids, 1), 0) > 0 then
    raise exception 'A total-scope tax rule takes no item or category targets.';
  end if;
  if p_scope = 'items' and coalesce(array_length(p_item_ids, 1), 0) = 0 then
    raise exception 'An items-scope tax rule requires at least one item.';
  end if;
  if p_scope = 'items' and p_category_ids is not null then
    raise exception 'An items-scope tax rule takes no category targets.';
  end if;
  if p_scope = 'categories' and coalesce(array_length(p_category_ids, 1), 0) = 0 then
    raise exception 'A categories-scope tax rule requires at least one category.';
  end if;
  if p_scope = 'categories' and p_item_ids is not null then
    raise exception 'A categories-scope tax rule takes no item targets.';
  end if;
  if p_branch_id is not null and coalesce(array_length(p_compound_source_ids, 1), 0) > 0 then
    raise exception 'A branch-only rule cannot compound on another rule.';
  end if;

  begin
    insert into public.tax_rules (restaurant_id, branch_id, name, rate, scope, sort_order)
    values (
      p_restaurant_id, p_branch_id, v_name, v_rate, p_scope,
      coalesce(p_sort_order, coalesce((
        select max(r.sort_order) + 1 from public.tax_rules r
        where r.restaurant_id = p_restaurant_id
          and r.branch_id is not distinct from p_branch_id
      ), 1))
    )
    returning * into v_rule;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'tax_rules_restaurant_name_key' then
        raise exception 'A tax rule with this name already exists.';
      end if;
      raise;
  end;

  -- Targets and compound sources: the composite FKs make cross-restaurant
  -- references structurally impossible (23503 caught below and translated);
  -- the source checks here add the active/inactive and self-reference rules
  -- the schema cannot express.
  begin
    if p_item_ids is not null then
      insert into public.tax_rule_items (restaurant_id, rule_id, item_id)
      select p_restaurant_id, v_rule.id, x from unnest(p_item_ids) as x;
    end if;
    if p_category_ids is not null then
      insert into public.tax_rule_categories (restaurant_id, rule_id, category_id)
      select p_restaurant_id, v_rule.id, x from unnest(p_category_ids) as x;
    end if;
  exception
    when foreign_key_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint like 'tax_rule_%scope_fkey' then
        raise exception 'A tax rule target must belong to the same restaurant.';
      end if;
      raise;
  end;

  if p_compound_source_ids is not null then
    foreach v_source in array p_compound_source_ids loop
      if v_source = v_rule.id then
        raise exception 'A tax cannot compound on itself.';
      end if;
      if not exists (
        select 1 from public.tax_rules s
        where s.id = v_source
          and s.restaurant_id = p_restaurant_id
          and s.branch_id is null
          and s.is_active
      ) then
        raise exception 'A compound source must be an active restaurant-level rule of this restaurant.';
      end if;
      insert into public.tax_rule_compounds (restaurant_id, rule_id, source_rule_id)
      values (p_restaurant_id, v_rule.id, v_source);
    end loop;
  end if;

  perform private.record_audit(
    v_profile_id, 'tax.rule_created', 'tax_rule', v_rule.id::text,
    'name=' || v_name || '; scope=' || p_scope
      || '; rate=' || v_rule.rate::text || '; order=' || v_rule.sort_order::text,
    p_restaurant_id, p_branch_id
  );

  return v_rule;
end;
$$;

revoke all on function public.create_tax_rule(uuid, text, text, text, uuid, integer, uuid[], uuid[], uuid[])
  from public, anon;
grant execute on function public.create_tax_rule(uuid, text, text, text, uuid, integer, uuid[], uuid[], uuid[])
  to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- update_tax_rule (FR-005): the full-shape edit. Targets and compound sources
-- are replaced wholesale by the submitted sets (exact-coverage semantics, the
-- reorder pattern). Snapshots are unaffected by any edit — they are
-- self-contained (research.md §7) — so a referenced rule MAY be edited.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.update_tax_rule(
  p_rule_id uuid,
  p_name text,
  p_rate text,
  p_scope text,
  p_sort_order integer,
  p_item_ids uuid[] default null,
  p_category_ids uuid[] default null,
  p_compound_source_ids uuid[] default null
) returns public.tax_rules
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_context record;
  v_stored public.tax_rules;
  v_name text := btrim(coalesce(p_name, ''));
  v_rate numeric(7, 4);
  v_stored_items uuid[] := coalesce((
    select array_agg(t.item_id order by t.item_id) from public.tax_rule_items t where t.rule_id = p_rule_id
  ), '{}');
  v_stored_categories uuid[] := coalesce((
    select array_agg(t.category_id order by t.category_id)
    from public.tax_rule_categories t where t.rule_id = p_rule_id
  ), '{}');
  v_stored_sources uuid[] := coalesce((
    select array_agg(t.source_rule_id order by t.source_rule_id)
    from public.tax_rule_compounds t where t.rule_id = p_rule_id
  ), '{}');
  v_new_items uuid[] := coalesce((
    select array_agg(distinct x order by x) from unnest(coalesce(p_item_ids, '{}')) as x
  ), '{}');
  v_new_categories uuid[] := coalesce((
    select array_agg(distinct x order by x) from unnest(coalesce(p_category_ids, '{}')) as x
  ), '{}');
  v_new_sources uuid[] := coalesce((
    select array_agg(distinct x order by x) from unnest(coalesce(p_compound_source_ids, '{}')) as x
  ), '{}');
  v_changes text := '';
  v_source uuid;
  v_rule public.tax_rules;
  v_constraint text;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_context from private.tax_rule_write_context(p_rule_id);

  if v_profile_id is null or v_context.restaurant_id is null or not v_context.authorized then
    raise exception 'You do not have permission to manage this restaurant''s tax configuration.'
      using errcode = '42501';
  end if;

  select * into v_stored from public.tax_rules r where r.id = p_rule_id;

  if v_name = '' then
    raise exception 'A tax rule name is required.';
  end if;
  if length(v_name) > 80 then
    raise exception 'A tax rule name may be at most 80 characters.';
  end if;
  v_rate := private.validate_tax_rate(p_rate);
  if p_scope not in ('total', 'items', 'categories') then
    raise exception 'A tax rule scope must be total, items, or categories.';
  end if;
  if p_scope = 'total'
     and coalesce(array_length(v_new_items, 1), 0) + coalesce(array_length(v_new_categories, 1), 0) > 0 then
    raise exception 'A total-scope change takes no item or category targets.';
  end if;
  if p_scope = 'items' and coalesce(array_length(v_new_items, 1), 0) = 0 then
    raise exception 'An items-scope change requires at least one item.';
  end if;
  if p_scope = 'categories' and coalesce(array_length(v_new_categories, 1), 0) = 0 then
    raise exception 'A categories-scope change requires at least one category.';
  end if;
  if v_stored.branch_id is not null and coalesce(array_length(v_new_sources, 1), 0) > 0 then
    raise exception 'A branch-only rule cannot compound on another rule.';
  end if;

  -- Actual change only: identical values (including identical target sets)
  -- write nothing and return the stored row.
  if v_stored.name = v_name
     and v_stored.rate = v_rate
     and v_stored.scope = p_scope
     and v_stored.sort_order = p_sort_order
     and v_stored_items is not distinct from v_new_items
     and v_stored_categories is not distinct from v_new_categories
     and v_stored_sources is not distinct from v_new_sources
  then
    return v_stored;
  end if;

  begin
    update public.tax_rules
    set name = v_name, rate = v_rate, scope = p_scope, sort_order = p_sort_order
    where id = p_rule_id
    returning * into v_rule;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'tax_rules_restaurant_name_key' then
        raise exception 'A tax rule with this name already exists.';
      end if;
      raise;
  end;

  -- Replace the target sets wholesale (exact-coverage semantics).
  delete from public.tax_rule_items where rule_id = p_rule_id;
  delete from public.tax_rule_categories where rule_id = p_rule_id;
  if v_new_items <> '{}' then
    begin
      insert into public.tax_rule_items (restaurant_id, rule_id, item_id)
      select v_stored.restaurant_id, p_rule_id, x from unnest(v_new_items) as x;
    exception
      when foreign_key_violation then
        raise exception 'A tax rule target must belong to the same restaurant.';
    end;
  end if;
  if v_new_categories <> '{}' then
    begin
      insert into public.tax_rule_categories (restaurant_id, rule_id, category_id)
      select v_stored.restaurant_id, p_rule_id, x from unnest(v_new_categories) as x;
    exception
      when foreign_key_violation then
        raise exception 'A tax rule target must belong to the same restaurant.';
    end;
  end if;

  -- Replace the compound set wholesale; re-validate the source rules.
  delete from public.tax_rule_compounds where rule_id = p_rule_id;
  foreach v_source in array v_new_sources loop
    if v_source = p_rule_id then
      raise exception 'A tax cannot compound on itself.';
    end if;
    if not exists (
      select 1 from public.tax_rules s
      where s.id = v_source
        and s.restaurant_id = v_stored.restaurant_id
        and s.branch_id is null
        and s.is_active
    ) then
      raise exception 'A compound source must be an active restaurant-level rule of this restaurant.';
    end if;
    insert into public.tax_rule_compounds (restaurant_id, rule_id, source_rule_id)
    values (v_stored.restaurant_id, p_rule_id, v_source);
  end loop;

  if v_stored.name <> v_name then
    v_changes := 'name: "' || v_stored.name || '" -> "' || v_name || '"';
  end if;
  if v_stored.rate <> v_rate then
    v_changes := case when v_changes = '' then '' else v_changes || '; ' end
      || 'rate: ' || v_stored.rate::text || ' -> ' || v_rate::text;
  end if;
  if v_stored.scope <> p_scope or v_stored.sort_order <> p_sort_order
     or v_stored_items is distinct from v_new_items
     or v_stored_categories is distinct from v_new_categories
     or v_stored_sources is distinct from v_new_sources then
    v_changes := case when v_changes = '' then '' else v_changes || '; ' end || 'shape updated';
  end if;

  perform private.record_audit(
    v_profile_id, 'tax.rule_updated', 'tax_rule', p_rule_id::text,
    v_changes, v_stored.restaurant_id, v_stored.branch_id
  );

  return v_rule;
end;
$$;

revoke all on function public.update_tax_rule(uuid, text, text, text, integer, uuid[], uuid[], uuid[])
  from public, anon;
grant execute on function public.update_tax_rule(uuid, text, text, text, integer, uuid[], uuid[], uuid[])
  to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- reorder_tax_rules (FR-008): the complete ordered list for one context —
-- the restaurant-level set (owner only) or one branch's branch-only rules
-- (owner or that branch's manager). Exact coverage: every rule of the context
-- exactly once. The deterministic calculation order is (sort_order, name);
-- reordering assigns positions; ties that remain resolve by name.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.reorder_tax_rules(
  p_restaurant_id uuid,
  p_rule_ids uuid[],
  p_branch_id uuid default null
) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_expected integer;
  v_position integer := 0;
  v_rule_id uuid;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  if v_profile_id is null then
    raise exception 'You do not have permission to manage tax configuration.'
      using errcode = '42501';
  end if;

  if p_branch_id is null then
    if not exists (
      select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
      where o.restaurant_id = p_restaurant_id
    ) then
      raise exception 'You do not have permission to manage this restaurant''s tax configuration.'
        using errcode = '42501';
    end if;
    select count(*) into v_expected
    from public.tax_rules r
    where r.restaurant_id = p_restaurant_id and r.branch_id is null;
  else
    if not exists (
      select 1 from public.branches b
      where b.id = p_branch_id and b.restaurant_id = p_restaurant_id
    ) then
      raise exception 'Tax rule not found.';
    end if;
    if not (
      p_restaurant_id in (select private.owned_restaurant_ids((select auth.uid())))
      or p_branch_id in (select private.branch_manager_branch_ids((select auth.uid())))
    ) then
      raise exception 'You do not have permission to manage this branch''s tax configuration.'
        using errcode = '42501';
    end if;
    select count(*) into v_expected
    from public.tax_rules r
    where r.restaurant_id = p_restaurant_id and r.branch_id = p_branch_id;
  end if;

  if coalesce(array_length(p_rule_ids, 1), 0) <> v_expected
     or (select count(distinct x) from unnest(p_rule_ids) as x) <> v_expected then
    raise exception 'The reorder list must contain every rule of the context exactly once.';
  end if;

  -- Every submitted id must exist in the addressed context.
  foreach v_rule_id in array p_rule_ids loop
    if not exists (
      select 1 from public.tax_rules r
      where r.id = v_rule_id
        and r.restaurant_id = p_restaurant_id
        and r.branch_id is not distinct from p_branch_id
    ) then
      raise exception 'The reorder list must contain every rule of the context exactly once.';
    end if;
  end loop;

  foreach v_rule_id in array p_rule_ids loop
    v_position := v_position + 1;
    update public.tax_rules set sort_order = v_position where id = v_rule_id;
  end loop;

  perform private.record_audit(
    v_profile_id, 'tax.rules_reordered', 'tax_rule', p_restaurant_id::text,
    'context=' || coalesce(p_branch_id::text, 'restaurant') || '; positions=' || v_expected::text,
    p_restaurant_id, p_branch_id
  );
end;
$$;

revoke all on function public.reorder_tax_rules(uuid, uuid[], uuid) from public, anon;
grant execute on function public.reorder_tax_rules(uuid, uuid[], uuid) to authenticated;
