-- Tax read policies: grants + one select policy per table (spec 006 FR-004,
-- FR-019, FR-021; data-model.md policy matrix).
--
-- Grants decide WHICH OPERATIONS a role may run; policies decide WHICH ROWS
-- (feature 002 convention). Select-only for client roles: no insert, update,
-- or delete grant exists — the six security definer RPCs of the tax_rpcs
-- migration are the only write paths (FR-021; Constitution IV).
--
-- Tax configuration is restaurant-level state the engine consumes, and the
-- staff preview reads the same data — so every table, including the override
-- rows and the snapshot records, follows the plain restaurant-membership arm
-- (data-model.md policy matrix; research.md §4). Branch-scoped members may
-- read their own restaurant's configuration — the same read scope the branch
-- menu preview of feature 005 grants over menu content.
--
-- Predicates keep the wrapped (select …) initPlan form so each helper
-- evaluates once per statement, exactly like the feature 002–005 policies.

revoke all on table public.tax_rules from anon, authenticated;
revoke all on table public.tax_rule_items from anon, authenticated;
revoke all on table public.tax_rule_categories from anon, authenticated;
revoke all on table public.tax_rule_compounds from anon, authenticated;
revoke all on table public.branch_tax_overrides from anon, authenticated;
revoke all on table public.tax_snapshots from anon, authenticated;

grant select on table public.tax_rules to authenticated;
grant select on table public.tax_rule_items to authenticated;
grant select on table public.tax_rule_categories to authenticated;
grant select on table public.tax_rule_compounds to authenticated;
grant select on table public.branch_tax_overrides to authenticated;
grant select on table public.tax_snapshots to authenticated;

create policy tax_rules_staff_select
  on public.tax_rules
  for select
  to authenticated
  using (restaurant_id in (select private.staff_restaurant_ids((select auth.uid()))));

create policy tax_rule_items_staff_select
  on public.tax_rule_items
  for select
  to authenticated
  using (restaurant_id in (select private.staff_restaurant_ids((select auth.uid()))));

create policy tax_rule_categories_staff_select
  on public.tax_rule_categories
  for select
  to authenticated
  using (restaurant_id in (select private.staff_restaurant_ids((select auth.uid()))));

create policy tax_rule_compounds_staff_select
  on public.tax_rule_compounds
  for select
  to authenticated
  using (restaurant_id in (select private.staff_restaurant_ids((select auth.uid()))));

create policy branch_tax_overrides_staff_select
  on public.branch_tax_overrides
  for select
  to authenticated
  using (restaurant_id in (select private.staff_restaurant_ids((select auth.uid()))));

create policy tax_snapshots_staff_select
  on public.tax_snapshots
  for select
  to authenticated
  using (restaurant_id in (select private.staff_restaurant_ids((select auth.uid()))));
