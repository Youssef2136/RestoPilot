-- Tenant isolation: private scope-resolution functions, grants, and RLS
-- policies (spec 002 FR-008..FR-011; data-model.md policy matrix;
-- contracts/database-functions.md; research.md §3-§4, §17).
--
-- Grants decide WHICH OPERATIONS a role may run; policies decide WHICH ROWS.
-- Both are set for every exposed table (official Supabase guidance).

-- ── private schema: never exposed via the data API (research.md §4) ─────────

create schema if not exists private;

revoke all on schema private from anon, authenticated, public;
grant usage on schema private to authenticated;

-- ── scope-resolution helpers (FR-010; contracts) ────────────────────────────
-- security definer + search_path = '' + schema-qualified names: the documented
-- pattern that avoids per-row RLS evaluation and the 42P17 policy recursion
-- (a policy on staff_memberships must not read staff_memberships through RLS).

create function private.staff_restaurant_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.restaurant_id
  from public.staff_memberships m
  join public.profiles p on p.id = m.profile_id
  where p.auth_user_id = p_user
$$;

create function private.staff_branch_ids(p_user uuid)
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
    and m.branch_id is not null
$$;

create function private.owned_restaurant_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.restaurant_id
  from public.staff_memberships m
  join public.profiles p on p.id = m.profile_id
  where p.auth_user_id = p_user
    and m.role = 'owner'
$$;

revoke all on function private.staff_restaurant_ids(uuid) from public, anon;
revoke all on function private.staff_branch_ids(uuid) from public, anon;
revoke all on function private.owned_restaurant_ids(uuid) from public, anon;
grant execute on function private.staff_restaurant_ids(uuid) to authenticated;
grant execute on function private.staff_branch_ids(uuid) to authenticated;
grant execute on function private.owned_restaurant_ids(uuid) to authenticated;

-- ── grants posture (FR-008/FR-009; research.md §3) ──────────────────────────
-- Select-only for client roles in Phase 1: every write path is denied by
-- grants (no insert/update/delete grants exist) and arrives with the feature
-- that owns it. profiles receives no client grants at all.

revoke all on table public.restaurants from anon, authenticated;
revoke all on table public.branches from anon, authenticated;
revoke all on table public.staff_memberships from anon, authenticated;
revoke all on table public.dining_tables from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;

grant select on table public.restaurants to authenticated;
grant select on table public.branches to authenticated;
grant select on table public.staff_memberships to authenticated;
grant select on table public.dining_tables to authenticated;

-- ── policies: one select policy per staff-readable table (FR-009) ───────────
-- Wrapped (select …) subqueries evaluate once per statement (initPlan).
-- Restaurant-scoped rows: any membership of the restaurant.
-- Branch-scoped rows: own assigned branch, or any branch of an owned
-- restaurant (owners see every branch — master plan §30; FR-009 clarified
-- 2026-09-15, analyze F1).

create policy restaurants_staff_select
  on public.restaurants
  for select
  to authenticated
  using (id in (select private.staff_restaurant_ids((select auth.uid()))));

create policy staff_memberships_staff_select
  on public.staff_memberships
  for select
  to authenticated
  using (restaurant_id in (select private.staff_restaurant_ids((select auth.uid()))));

create policy branches_staff_select
  on public.branches
  for select
  to authenticated
  using (
    restaurant_id in (select private.staff_restaurant_ids((select auth.uid())))
    and (
      id in (select private.staff_branch_ids((select auth.uid())))
      or restaurant_id in (select private.owned_restaurant_ids((select auth.uid())))
    )
  );

create policy dining_tables_staff_select
  on public.dining_tables
  for select
  to authenticated
  using (
    restaurant_id in (select private.staff_restaurant_ids((select auth.uid())))
    and (
      branch_id in (select private.staff_branch_ids((select auth.uid())))
      or restaurant_id in (select private.owned_restaurant_ids((select auth.uid())))
    )
  );
