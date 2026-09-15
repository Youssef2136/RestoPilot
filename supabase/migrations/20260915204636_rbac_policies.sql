-- Role-aware access boundaries (spec 003 FR-005/FR-006/FR-007/FR-011;
-- data-model.md policy matrix; contracts/database-functions.md;
-- research.md §8–§9).
--
-- Adds the role dimension on top of Phase 1's tenant/branch boundaries:
-- three new private helpers, the narrowed staff_memberships select policy
-- (Phase 1's "any staff of the restaurant" arm is withdrawn exactly as
-- feature 002 FR-009 deferred), and the first-ever profiles select policy
-- + grant. restaurants, branches, dining_tables, audit_log, and app_meta
-- are untouched, and NO policy or grant anywhere reads is_super_admin
-- (FR-012).

-- ── private helpers: the role-aware scope-resolution family ─────────────────
-- Same discipline as feature 002: security definer + stable +
-- search_path = '' + schema-qualified bodies, so policies can read
-- staff_memberships/profiles without RLS recursion (42P17), evaluated once
-- per statement via the wrapped (select …) initPlan form.

-- The profile(s) linked to the identity — the "own rows" arm of the
-- memberships and profiles policies (at most one row by the unique
-- constraint on profiles.auth_user_id; empty for an unlinked identity).
create function private.staff_profile_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = p_user
$$;

-- Restaurants where the identity holds an owner or branch_manager
-- membership — the staff-list visibility set (spec FR-007, Clarifications
-- 2026-09-15). Superset of private.owned_restaurant_ids(p_user); reads
-- live membership rows, so a removal takes effect on the next statement
-- (FR-006).
create function private.managed_restaurant_ids(p_user uuid)
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
    and m.role in ('owner', 'branch_manager')
$$;

-- Profile ids holding any membership in one of the managed restaurants —
-- the "linked profiles' basic information" arm of the staff list
-- (FR-007). Composes managed_restaurant_ids; no cross-tenant leak is
-- expressible.
create function private.managed_staff_profile_ids(p_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.profile_id
  from public.staff_memberships m
  where m.restaurant_id in (
    select private.managed_restaurant_ids(p_user)
  )
$$;

revoke all on function private.staff_profile_ids(uuid) from public, anon;
revoke all on function private.managed_restaurant_ids(uuid) from public, anon;
revoke all on function private.managed_staff_profile_ids(uuid) from public, anon;
grant execute on function private.staff_profile_ids(uuid) to authenticated;
grant execute on function private.managed_restaurant_ids(uuid) to authenticated;
grant execute on function private.managed_staff_profile_ids(uuid) to authenticated;

-- ── staff_memberships: select policy replaced (narrowed) ────────────────────
-- Visible rows: the caller's OWN membership rows (self-knowledge, FR-011)
-- or rows of a restaurant the caller manages (owner/branch_manager — the
-- staff list, FR-007). Phase 1 granted visibility to any staff of the
-- restaurant; that arm is withdrawn here.

drop policy staff_memberships_staff_select on public.staff_memberships;

create policy staff_memberships_staff_select
  on public.staff_memberships
  for select
  to authenticated
  using (
    profile_id in (select private.staff_profile_ids((select auth.uid())))
    or restaurant_id in (select private.managed_restaurant_ids((select auth.uid())))
  );

-- ── profiles: first-ever client access — select policy + grant ──────────────
-- Own profile (the identity's linked row) or the profile of a member of a
-- restaurant the caller manages (the staff list's linked-profiles half).
-- staff_profile_ids returns PROFILE ids, so the own arm compares id (the
-- profile's own id) — the same shape as the memberships policy's profile_id
-- arm. Reads no other column or flag: is_super_admin is not consulted by any
-- policy or grant (FR-012) — the value only travels to the holder through
-- the own-profile arm.

grant select on table public.profiles to authenticated;

create policy profiles_staff_select
  on public.profiles
  for select
  to authenticated
  using (
    id in (select private.staff_profile_ids((select auth.uid())))
    or id in (select private.managed_staff_profile_ids((select auth.uid())))
  );
