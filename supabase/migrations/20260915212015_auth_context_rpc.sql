-- Auth context RPC (spec 003 FR-004/FR-010; contracts/database-functions.md;
-- research.md §8; data-model.md "current_auth_context").
--
-- public.current_auth_context() resolves the caller's effective
-- authorization context — the single artifact every guard and staff-area
-- view consumes. It is SECURITY INVOKER BY DESIGN: it reads profiles,
-- staff_memberships, restaurants, and branches under the caller's own RLS
-- policies, so it can never disclose anything the policies do not allow and
-- can never drift from them (the policies remain the single source of the
-- rules; this RPC is their read-through projection).
--
-- Shape (jsonb so one call carries the profile even when memberships are
-- empty — a super admin (profile, no memberships) is distinguishable from an
-- unlinked identity (profile: null) for guard decisions):
--   { "profile": { id, display_name, is_super_admin } | null,
--     "memberships": [ { restaurant_id, restaurant_slug, restaurant_name,
--                        role, branch_id, branch_name } ] }
-- branch_id/branch_name are null for owners (restaurant-wide). An
-- authenticated unlinked identity gets {"profile":null,"memberships":[]}.

create function public.current_auth_context()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'is_super_admin', p.is_super_admin
      )
      from public.profiles p
      where p.auth_user_id = (select auth.uid())
    ),
    'memberships', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'restaurant_id', m.restaurant_id,
          'restaurant_slug', r.slug,
          'restaurant_name', r.name,
          'role', m.role,
          'branch_id', m.branch_id,
          'branch_name', b.name
        )
        order by r.slug, b.name nulls first, m.role
      )
      from public.staff_memberships m
      join public.restaurants r on r.id = m.restaurant_id
      left join public.branches b on b.id = m.branch_id
      where m.profile_id in (select private.staff_profile_ids((select auth.uid())))
    ), '[]'::jsonb)
  )
$$;

-- Execute: authenticated only. Unauthenticated calls are excluded by the
-- grant (anon has none) — the "refuses nothing" posture of the contract.
revoke all on function public.current_auth_context() from public, anon;
grant execute on function public.current_auth_context() to authenticated;
