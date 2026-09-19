-- Menu read policies: grants + one select policy per table (spec 005 FR-004,
-- FR-024, FR-026; data-model.md policy matrix; research.md §1, §3).
--
-- Grants decide WHICH OPERATIONS a role may run; policies decide WHICH ROWS
-- (feature 002 convention). Select-only for client roles: no insert, update,
-- or delete grant exists — the fourteen security definer RPCs of the
-- menu_rpcs migration are the only write paths.
--
-- Predicates keep the wrapped (select …) initPlan form so each helper
-- evaluates once per statement, exactly like the feature 002/003 policies.

revoke all on table public.menu_categories from anon, authenticated;
revoke all on table public.menu_items from anon, authenticated;
revoke all on table public.menu_item_extras from anon, authenticated;
revoke all on table public.branch_unavailable_items from anon, authenticated;

grant select on table public.menu_categories to authenticated;
grant select on table public.menu_items to authenticated;
grant select on table public.menu_item_extras to authenticated;
grant select on table public.branch_unavailable_items to authenticated;

-- Restaurant-scoped menu content: any member of the restaurant reads the
-- shared menu (FR-004). The menu belongs to the restaurant, not to a branch.
create policy menu_categories_staff_select
  on public.menu_categories
  for select
  to authenticated
  using (restaurant_id in (select private.staff_restaurant_ids((select auth.uid()))));

create policy menu_items_staff_select
  on public.menu_items
  for select
  to authenticated
  using (restaurant_id in (select private.staff_restaurant_ids((select auth.uid()))));

create policy menu_item_extras_staff_select
  on public.menu_item_extras
  for select
  to authenticated
  using (restaurant_id in (select private.staff_restaurant_ids((select auth.uid()))));

-- Branch-scoped override rows follow the dining_tables shape: a branch-scoped
-- member reads their own branch's overrides; owners read every branch of the
-- restaurant (FR-013). This is the narrowing FR-004's restaurant-level
-- statement leaves open — recorded by the analysis pass (I2) and the
-- security-and-data-integrity checklist (CHK008).
create policy branch_unavailable_items_staff_select
  on public.branch_unavailable_items
  for select
  to authenticated
  using (
    restaurant_id in (select private.staff_restaurant_ids((select auth.uid())))
    and (
      branch_id in (select private.staff_branch_ids((select auth.uid())))
      or restaurant_id in (select private.owned_restaurant_ids((select auth.uid())))
    )
  );
