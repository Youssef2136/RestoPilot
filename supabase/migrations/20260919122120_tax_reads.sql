-- Tax RPCs part 2: retire/delete, the branch override, the two security
-- invoker reads, and the snapshot function (spec 006 FR-009, FR-010, FR-011,
-- FR-016, FR-017, FR-020, FR-021; contracts/database-functions.md §1–§5;
-- research.md §2–§7). Conventions identical to 20260919122100_tax_rpcs.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- retire_tax_rule (FR-010): retirement is the lifecycle — an inactive rule
-- stops applying to new calculations immediately and stays visible with its
-- state. Idempotent no-op when already retired. A retired rule MAY be
-- reactivated via update_tax_rule (an ordinary edit).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.retire_tax_rule(p_rule_id uuid, p_active boolean default false)
returns public.tax_rules
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_context record;
  v_stored public.tax_rules;
  v_rule public.tax_rules;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_context from private.tax_rule_write_context(p_rule_id);

  if v_profile_id is null or v_context.restaurant_id is null or not v_context.authorized then
    raise exception 'You do not have permission to manage this restaurant''s tax configuration.'
      using errcode = '42501';
  end if;

  select * into v_stored from public.tax_rules r where r.id = p_rule_id;

  if v_stored.is_active = p_active then
    return v_stored;  -- no-op: nothing to change
  end if;

  update public.tax_rules set is_active = p_active where id = p_rule_id
  returning * into v_rule;

  perform private.record_audit(
    v_profile_id,
    case when p_active then 'tax.rule_reactivated' else 'tax.rule_retired' end,
    'tax_rule', p_rule_id::text,
    'name=' || v_stored.name, v_stored.restaurant_id, v_stored.branch_id
  );

  return v_rule;
end;
$$;

revoke all on function public.retire_tax_rule(uuid, boolean) from public, anon;
grant execute on function public.retire_tax_rule(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- delete_unused_tax_rule (FR-010's carve-out): a rule never applied in a
-- recorded snapshot and unreferenced by overrides or junction rows MAY be
-- deleted outright (a mistake made before use); anything else is refused.
-- The check embeds the rule's id in the recorded fingerprints (research §7):
-- snapshots are FK-free, so the reference lives inside their content.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.delete_unused_tax_rule(p_rule_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_context record;
  v_stored public.tax_rules;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_context from private.tax_rule_write_context(p_rule_id);

  if v_profile_id is null or v_context.restaurant_id is null or not v_context.authorized then
    raise exception 'You do not have permission to manage this restaurant''s tax configuration.'
      using errcode = '42501';
  end if;

  select * into v_stored from public.tax_rules r where r.id = p_rule_id;

  if exists (select 1 from public.branch_tax_overrides o where o.rule_id = p_rule_id)
     or exists (select 1 from public.tax_rule_items t where t.rule_id = p_rule_id)
     or exists (select 1 from public.tax_rule_categories t where t.rule_id = p_rule_id)
     or exists (
       -- Incoming references only: another rule compounding ON this one.
       -- The rule's own outgoing citations die with it — deleting a rule
       -- that cites sources does not orphan anything.
       select 1 from public.tax_rule_compounds t where t.source_rule_id = p_rule_id
     )
     or exists (
       select 1 from public.tax_snapshots s
       where s.restaurant_id = v_stored.restaurant_id
         and s.recorded_at is not null
         and s.fingerprint like '%rule:' || p_rule_id::text || '%'
     ) then
    raise exception 'This tax rule has been applied in recorded results and cannot be deleted.';
  end if;

  -- Junction rows cascade declaratively; the rule row goes last.
  delete from public.tax_rule_items where rule_id = p_rule_id;
  delete from public.tax_rule_categories where rule_id = p_rule_id;
  delete from public.tax_rule_compounds where rule_id = p_rule_id;
  delete from public.tax_rules where id = p_rule_id;

  perform private.record_audit(
    v_profile_id, 'tax.rule_deleted', 'tax_rule', p_rule_id::text,
    'name=' || v_stored.name, v_stored.restaurant_id, v_stored.branch_id
  );
end;
$$;

revoke all on function public.delete_unused_tax_rule(uuid) from public, anon;
grant execute on function public.delete_unused_tax_rule(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- set_branch_tax_override (FR-009; clarification 2): a replacement rate for a
-- restaurant-level rule at one branch — owner anywhere, that branch's manager
-- for their own branch. p_rate null clears the override (delete the row → the
-- branch returns to the restaurant default). Actual-change-only.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_branch_tax_override(
  p_branch_id uuid,
  p_rule_id uuid,
  p_rate text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_branch public.branches;
  v_rule public.tax_rules;
  v_rate numeric(7, 4);
  v_existing numeric(7, 4);
  v_constraint text;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  select * into v_branch from public.branches b where b.id = p_branch_id;
  select * into v_rule from public.tax_rules r where r.id = p_rule_id;

  if v_profile_id is null
     or v_branch.id is null
     or not (
       v_branch.restaurant_id in (select private.owned_restaurant_ids((select auth.uid())))
       or p_branch_id in (select private.branch_manager_branch_ids((select auth.uid())))
     ) then
    raise exception 'You do not have permission to manage this branch''s tax configuration.'
      using errcode = '42501';
  end if;

  if v_rule.id is null or v_rule.restaurant_id <> v_branch.restaurant_id then
    raise exception 'Tax rule not found.';
  end if;
  if v_rule.branch_id is not null then
    raise exception 'Only a restaurant-level rule can be overridden at a branch.';
  end if;
  if not v_rule.is_active then
    raise exception 'A retired tax rule cannot be overridden.';
  end if;

  if p_rate is null then
    -- Clear: delete the override row. Clearing a missing override is a no-op.
    select o.rate into v_existing from public.branch_tax_overrides o
    where o.branch_id = p_branch_id and o.rule_id = p_rule_id;
    if v_existing is null then
      return jsonb_build_object('changed', false, 'rate', null);
    end if;
    delete from public.branch_tax_overrides
    where branch_id = p_branch_id and rule_id = p_rule_id;

    perform private.record_audit(
      v_profile_id, 'tax.branch_override_cleared', 'tax_rule', p_rule_id::text,
      'rule=' || v_rule.name || '; rate=default', v_branch.restaurant_id, p_branch_id
    );
    return jsonb_build_object('changed', true, 'rate', null);
  end if;

  v_rate := private.validate_tax_rate(p_rate);

  select o.rate into v_existing from public.branch_tax_overrides o
  where o.branch_id = p_branch_id and o.rule_id = p_rule_id;

  if v_existing = v_rate then
    -- No-op: the same replacement rate is already in effect.
    return jsonb_build_object('changed', false, 'rate', v_rate::text);
  end if;

  begin
    insert into public.branch_tax_overrides (branch_id, rule_id, restaurant_id, rate)
    values (p_branch_id, p_rule_id, v_branch.restaurant_id, v_rate)
    on conflict (branch_id, rule_id) do update set rate = excluded.rate;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      raise;
  end;

  perform private.record_audit(
    v_profile_id, 'tax.branch_override_set', 'tax_rule', p_rule_id::text,
    'rule=' || v_rule.name || '; rate=' || v_rate::text
      || case when v_existing is null then '' else ' (was ' || v_existing::text || ')' end,
    v_branch.restaurant_id, p_branch_id
  );

  return jsonb_build_object('changed', true, 'rate', v_rate::text);
end;
$$;

revoke all on function public.set_branch_tax_override(uuid, uuid, text) from public, anon;
grant execute on function public.set_branch_tax_override(uuid, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_branch_tax_config (FR-020): the branch's effective configuration —
-- security invoker, explicit scope check first, reads under the caller's own
-- policies (the get_branch_menu posture). One entry per applicable rule:
-- restaurant-level rules of the branch's restaurant plus that branch's
-- branch-only rules, with the override rate where one exists, ordered by
-- (sort_order, name), each with its origin label.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_branch_tax_config(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security invoker
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
    raise exception 'You do not have permission to view this branch''s tax configuration.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'branch', jsonb_build_object('id', v_branch.id, 'name', v_branch.name),
    'restaurant_id', v_branch.restaurant_id,
    'rules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'rule_id', r.id,
          'name', r.name,
          'rate', coalesce(o.rate, r.rate)::text,
          'scope', r.scope,
          'sort_order', r.sort_order,
          'origin',
            case
              when r.branch_id is not null then 'branch-only'
              when o.rule_id is not null then 'override'
              else 'restaurant'
            end,
          'is_active', r.is_active,
          'item_ids', coalesce((
            select array_agg(t.item_id order by t.item_id)
            from public.tax_rule_items t where t.rule_id = r.id
          ), '{}'),
          'category_ids', coalesce((
            select array_agg(t.category_id order by t.category_id)
            from public.tax_rule_categories t where t.rule_id = r.id
          ), '{}'),
          'compound_sources', coalesce((
            select array_agg(c.source_rule_id order by c.source_rule_id)
            from public.tax_rule_compounds c where c.rule_id = r.id
          ), '{}')
        )
        order by r.sort_order, r.name, r.id
      )
      from public.tax_rules r
      left join public.branch_tax_overrides o
        on o.rule_id = r.id and o.branch_id = v_branch.id
      where r.restaurant_id = v_branch.restaurant_id
        and r.is_active
        and (r.branch_id is null or r.branch_id = v_branch.id)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_branch_tax_config(uuid) from public, anon;
grant execute on function public.get_branch_tax_config(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- calculate_branch_taxes (FR-011–FR-014): the canonical engine. Security
-- invoker with the same scope check as get_branch_tax_config; the effective
-- configuration is computed here — the client never assembles it
-- (Constitution V).
--
-- Algorithm (research.md §2, §5):
--   1. Resolve the branch's applicable rules: active, restaurant-level or
--      that branch's branch-only, ordered by (sort_order, name, id).
--   2. Compute each selection's taxable base: (base price + selected extras'
--      adjustments) × quantity (clarification 1).
--   3. Walk the rules in order; for each: item-scope applies to the named
--      items' bases, category-scope to the items of the named categories'
--      bases, total-scope to the subtotal of all bases; a rule's base adds
--      the amounts of its named compound sources that applied earlier in the
--      order. Each line's amount = round(base × rate / 100, 2) — rounded
--      once, half-up, at the end of that line's own calculation.
--   4. Total = subtotal + exact sum of the lines.
-- Selections: [{ item_id, extras: [extra_id...], quantity }]
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.calculate_branch_taxes(p_branch_id uuid, p_selections jsonb)
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

  if v_branch.id is null
     or not (
       v_branch.id in (select private.staff_branch_ids((select auth.uid())))
       or v_branch.restaurant_id in (select private.owned_restaurant_ids((select auth.uid())))
     ) then
    raise exception 'You do not have permission to calculate this branch''s taxes.'
      using errcode = '42501';
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

revoke all on function public.calculate_branch_taxes(uuid, jsonb) from public, anon;
grant execute on function public.calculate_branch_taxes(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- record_tax_snapshot (FR-016/FR-017): the once-only, immutable recording of
-- a real calculation result. Granted and test-proven; called by no surface in
-- this phase (clarification 3) — bills bind in features 007/008. Once-only is
-- the partial unique index; a conflicting re-record reports recorded:false
-- instead of failing (the guarantee is idempotent, not an error).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.record_tax_snapshot(
  p_restaurant_id uuid,
  p_branch_id uuid,
  p_fingerprint text,
  p_payload jsonb
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_existing uuid;
begin
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  -- Recording authority: the restaurant's owner (the flow that eventually
  -- calls this — bill binding — runs server-side for the tenant).
  if v_profile_id is null
     or not exists (
       select 1 from private.owned_restaurant_ids((select auth.uid())) as o(restaurant_id)
       where o.restaurant_id = p_restaurant_id
     ) then
    raise exception 'You do not have permission to record this restaurant''s tax snapshots.'
      using errcode = '42501';
  end if;

  if p_fingerprint is null or btrim(p_fingerprint) = '' then
    raise exception 'A snapshot fingerprint is required.';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'A snapshot payload is required.';
  end if;

  select s.id into v_existing
  from public.tax_snapshots s
  where s.restaurant_id = p_restaurant_id
    and s.branch_id = p_branch_id
    and s.fingerprint = p_fingerprint
    and s.recorded_at is not null;

  if v_existing is not null then
    return jsonb_build_object('recorded', false, 'snapshot_id', v_existing);
  end if;

  begin
    insert into public.tax_snapshots (restaurant_id, branch_id, fingerprint, recorded_at, payload)
    values (p_restaurant_id, p_branch_id, p_fingerprint, now(), p_payload)
    returning id into v_existing;
  exception
    when unique_violation then
      -- Lost a race against an identical recording: the once-only guarantee
      -- held; report not-recorded.
      select s.id into v_existing
      from public.tax_snapshots s
      where s.restaurant_id = p_restaurant_id
        and s.branch_id = p_branch_id
        and s.fingerprint = p_fingerprint
        and s.recorded_at is not null;
      return jsonb_build_object('recorded', false, 'snapshot_id', v_existing);
  end;

  return jsonb_build_object('recorded', true, 'snapshot_id', v_existing);
end;
$$;

revoke all on function public.record_tax_snapshot(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.record_tax_snapshot(uuid, uuid, text, jsonb) to authenticated;
