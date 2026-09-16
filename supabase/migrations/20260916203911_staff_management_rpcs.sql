-- Staff management RPCs: provisioning, membership add/update/remove
-- (spec 004 FR-013–FR-016, FR-020, FR-022; contracts/database-functions.md
-- "Staff operations" and "private.provision_staff_identity";
-- research.md §4–§6; data-model.md "Staff identity provisioning").
--
-- Phase 3 migration 5 of 5. Two layers:
--
--   1. private.provision_staff_identity — the ONLY production writer to the
--      platform-managed auth tables (besides supabase/seed.sql). It uses the
--      exact insert contract feature 003 verified live
--      (specs/003-auth-and-rbac/contracts/supabase-auth-surface.md part B):
--      a runtime id, email_confirmed_at = now(), the five token columns as
--      EMPTY STRINGS (NULL breaks sign-in with a 500), raw_app_meta_data with
--      the email provider, plus the linked profiles row — all in the same
--      transaction. The one-time temporary credential is generated in the
--      database (pgcrypto, the `extensions` schema) and stored only as a
--      bcrypt hash (cost 10). Execute is revoked from every client role: the
--      only caller is public.add_staff_member (security definer, owner-
--      executed), so clients can never invoke provisioning directly.
--
--   2. add_staff_member / update_staff_membership / remove_staff_membership —
--      the public data-API surface. Each authorizes its caller as its first
--      act through the existing private helper family (owner-only —
--      FR-006/FR-013), validates the role/branch consistency rules, and
--      writes exactly one private.record_audit record per accepted change in
--      the same transaction (FR-020). Execute is granted to `authenticated`
--      only (revoked from public/anon); no table write grant exists anywhere.
--
-- Concurrency (research §6): every membership-mutating RPC takes the SAME
-- first lock — the restaurant row (`for update`) — so the "at least one
-- owner" invariant has exactly one serialization point and the lock order is
-- identical everywhere (restaurant, then membership row).
--
-- Error model (as in the configuration RPCs): 42501 authorization denial;
-- P0001 validation failure and every constraint violation these functions can
-- hit, caught BY CONSTRAINT NAME and re-raised with a user-facing message
-- (duplicate membership, role/branch consistency checks, the auth-users email
-- uniqueness race). Those SQLSTATEs never reach the client through these RPCs.

-- ─────────────────────────────────────────────────────────────────────────────
-- The internal provisioning helper (not a client API)
-- ─────────────────────────────────────────────────────────────────────────────

-- provision_staff_identity: resolves the person by email and returns the
-- linked identity + profile plus the temporary credential when one was issued
-- (research §5):
--
--   no identity            ⇒ create auth.users + auth.identities + profiles,
--                            issue the credential, person_created = true
--   identity, no profile   ⇒ create the linked profile, RE-ISSUE the
--   (unclaimed stub)         credential, person_created = false
--   identity with profile  ⇒ link only, credential untouched,
--                            temporary_password = null
--
-- A linked person's credential is never touched; a display name is never
-- overwritten (the profile is only inserted, never updated). Emails are
-- normalized to lowercase on both lookup and insert so one person is never
-- duplicated by case.
create function private.provision_staff_identity(
  p_email        text,
  p_display_name text
) returns table (
  auth_user_id       uuid,
  profile_id         uuid,
  temporary_password text,
  person_created     boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email        text := lower(btrim(coalesce(p_email, '')));
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_auth_user_id uuid;
  v_profile_id   uuid;
  v_password     text;
  v_constraint   text;
begin
  select u.id into v_auth_user_id
  from auth.users u
  where lower(u.email) = v_email
  order by u.created_at
  limit 1;

  if v_auth_user_id is null then
    -- New person: the feature-003 live-verified insert contract, with the
    -- runtime id and the server-generated one-time credential.
    v_password := encode(extensions.gen_random_bytes(12), 'hex');
    v_auth_user_id := gen_random_uuid();

    begin
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change,
        email_change_token_new, email_change_token_current,
        created_at, updated_at
      ) values (
        v_auth_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        '', '', '', '', '',
        now(),
        now()
      );
    exception
      when unique_violation then
        -- Only a concurrent provisioning of the same email can land here
        -- (the lookup above found no row); the winner's person is the person.
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'users_email_partial_key' then
          raise exception 'A person with this email address already exists.';
        end if;
        raise;
    end;

    insert into auth.identities (
      id, user_id, provider, provider_id, identity_data, created_at, updated_at
    ) values (
      v_auth_user_id,
      v_auth_user_id,
      'email',
      v_auth_user_id::text,
      jsonb_build_object(
        'sub', v_auth_user_id::text,
        'email', v_email,
        'email_verified', true
      ),
      now(),
      now()
    );

    insert into public.profiles (display_name, auth_user_id)
    values (v_display_name, v_auth_user_id)
    returning id into v_profile_id;

    return query select v_auth_user_id, v_profile_id, v_password, true;
    return;
  end if;

  select p.id into v_profile_id
  from public.profiles p
  where p.auth_user_id = v_auth_user_id;

  if v_profile_id is not null then
    -- The normal case: an existing linked person. Link only; the profile's
    -- display_name and the credential are untouched (research §5).
    return query select v_auth_user_id, v_profile_id, null::text, false;
    return;
  end if;

  -- An unclaimed stub (e.g. an interrupted earlier attempt, or a post-reset
  -- orphan): give it a profile and a usable credential. This can never
  -- affect a claimed account — a linked one returned above.
  v_password := encode(extensions.gen_random_bytes(12), 'hex');

  insert into public.profiles (display_name, auth_user_id)
  values (v_display_name, v_auth_user_id)
  returning id into v_profile_id;

  update auth.users u
     set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
         updated_at = now()
   where u.id = v_auth_user_id;

  return query select v_auth_user_id, v_profile_id, v_password, false;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Staff membership operations (FR-013, FR-014, FR-015)
-- ─────────────────────────────────────────────────────────────────────────────

-- add_staff_member: adds a person to the restaurant's staff in one
-- transaction (FR-013/FR-014) — resolves or provisions the identity by
-- email, links the profile, inserts the membership, records the audit. The
-- returned `temporary_password` is non-null ONLY when a credential was issued
-- (a new person, or a completed unclaimed stub); the owner displays it once
-- and it is stored nowhere in recoverable form.
create function public.add_staff_member(
  p_restaurant_id uuid,
  p_email         text,
  p_display_name  text,
  p_role          public.staff_role,
  p_branch_id     uuid default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
  v_email            text := lower(btrim(coalesce(p_email, '')));
  v_display_name     text := btrim(coalesce(p_display_name, ''));
  v_new_profile_id   uuid;
  v_password         text;
  v_person_created   boolean;
  v_constraint       text;
  v_membership       public.staff_memberships;
begin
  -- Authorization (first act): owner of the restaurant (FR-006/FR-013). A
  -- nonexistent id resolves to no owned restaurant and is denied alike.
  if p_restaurant_id is null
     or p_restaurant_id not in (select private.owned_restaurant_ids((select auth.uid())))
  then
    raise exception 'You do not have permission to manage this restaurant.'
      using errcode = '42501';
  end if;
  select sp.profile_id into v_actor_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  -- Validation (P0001 in every case; nothing is created).
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' then
    raise exception 'A valid email address is required.';
  end if;
  if v_display_name = '' then
    raise exception 'A display name is required.';
  end if;
  if p_role is null then
    raise exception 'A staff role is required.';
  end if;
  if p_role = 'owner' and p_branch_id is not null then
    raise exception 'Owners are restaurant-wide and must not have a branch.';
  end if;
  if p_role <> 'owner' then
    if p_branch_id is null
       or not exists (
         select 1 from public.branches b
         where b.id = p_branch_id and b.restaurant_id = p_restaurant_id
       )
    then
      raise exception 'Select a branch of this restaurant for this role.';
    end if;
  end if;

  -- The one serialization point for the membership invariants (research §6).
  perform 1 from public.restaurants r where r.id = p_restaurant_id for update;

  -- Resolve/link/provision the person, then attach the membership. The helper
  -- raises its own P0001 for the impossible same-email race.
  select pi.profile_id, pi.temporary_password, pi.person_created
    into v_new_profile_id, v_password, v_person_created
  from private.provision_staff_identity(v_email, v_display_name) as pi;

  begin
    insert into public.staff_memberships (profile_id, restaurant_id, role, branch_id)
    values (v_new_profile_id, p_restaurant_id, p_role, p_branch_id)
    returning * into v_membership;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'staff_memberships_no_duplicates' then
        raise exception 'This person already holds this exact membership.';
      end if;
      raise;
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'staff_memberships_role_branch_check' then
        raise exception 'Owners are restaurant-wide and must not have a branch.';
      end if;
      raise;
    when foreign_key_violation then
      raise exception 'Select a branch of this restaurant for this role.';
  end;

  perform private.record_audit(
    v_actor_profile_id,
    'staff.added',
    'staff_membership',
    v_membership.id::text,
    null,
    p_restaurant_id,
    v_membership.branch_id
  );

  return jsonb_build_object(
    'membership', jsonb_build_object(
      'id', v_membership.id,
      'profile_id', v_membership.profile_id,
      'restaurant_id', v_membership.restaurant_id,
      'role', v_membership.role,
      'branch_id', v_membership.branch_id
    ),
    'profile_id', v_new_profile_id,
    'person_created', v_person_created,
    'temporary_password', v_password
  );
end;
$$;

-- update_staff_membership: changes a membership's role and/or branch
-- (FR-015). Effective access follows the new membership on the person's next
-- access (policies read live rows); the person's identity and profile are
-- untouched. The restaurant row is locked so concurrent owner changes
-- serialize (FR-016; research §6).
create function public.update_staff_membership(
  p_membership_id uuid,
  p_role          public.staff_role,
  p_branch_id     uuid default null
) returns public.staff_memberships
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
  v_restaurant_id    uuid;
  v_other_owners     int;
  v_constraint       text;
  v_membership       public.staff_memberships;
begin
  -- Authorization (first act): owner of the membership's restaurant (FR-015).
  -- A nonexistent membership resolves no restaurant and is denied.
  select m.restaurant_id into v_restaurant_id
  from public.staff_memberships m
  where m.id = p_membership_id;
  if v_restaurant_id is null
     or v_restaurant_id not in (select private.owned_restaurant_ids((select auth.uid())))
  then
    raise exception 'You do not have permission to manage this staff member.'
      using errcode = '42501';
  end if;
  select sp.profile_id into v_actor_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  -- Validation (P0001; the membership is unchanged).
  if p_role is null then
    raise exception 'A staff role is required.';
  end if;
  if p_role = 'owner' and p_branch_id is not null then
    raise exception 'Owners are restaurant-wide and must not have a branch.';
  end if;
  if p_role <> 'owner' then
    if p_branch_id is null
       or not exists (
         select 1 from public.branches b
         where b.id = p_branch_id and b.restaurant_id = v_restaurant_id
       )
    then
      raise exception 'Select a branch of this restaurant for this role.';
    end if;
  end if;

  -- Lock order everywhere: the restaurant row first, then the membership row
  -- — the invariant's single serialization point (research §6).
  perform 1 from public.restaurants r where r.id = v_restaurant_id for update;

  select m.* into v_membership
  from public.staff_memberships m
  where m.id = p_membership_id
  for update;
  if not found then
    -- Removed concurrently after the authorization read: nothing to update.
    raise exception 'You do not have permission to manage this staff member.'
      using errcode = '42501';
  end if;

  -- FR-016: a change that removes `owner` from the restaurant's only owner is
  -- rejected (the count is stable under the restaurant lock). Re-submitting
  -- the current values is not a removal and passes.
  if v_membership.role = 'owner' and p_role <> 'owner' then
    select count(*)::int into v_other_owners
    from public.staff_memberships m
    where m.restaurant_id = v_restaurant_id
      and m.role = 'owner'
      and m.id <> p_membership_id;
    if v_other_owners = 0 then
      raise exception 'A restaurant always keeps at least one owner.';
    end if;
  end if;

  begin
    update public.staff_memberships m
       set role = p_role,
           branch_id = p_branch_id
     where m.id = p_membership_id
    returning * into v_membership;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'staff_memberships_no_duplicates' then
        raise exception 'This person already holds this exact membership.';
      end if;
      raise;
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'staff_memberships_role_branch_check' then
        raise exception 'Owners are restaurant-wide and must not have a branch.';
      end if;
      raise;
    when foreign_key_violation then
      raise exception 'Select a branch of this restaurant for this role.';
  end;

  perform private.record_audit(
    v_actor_profile_id,
    'staff.updated',
    'staff_membership',
    v_membership.id::text,
    null,
    v_restaurant_id,
    v_membership.branch_id
  );

  return v_membership;
end;
$$;

-- remove_staff_membership: removes the membership (FR-015/FR-016). Access to
-- that restaurant ends immediately; the person's profile and sign-in identity
-- persist, so they can be re-added without recreating the person (FR-014).
-- The audit record is written before the row is deleted, in the same
-- transaction (contract).
create function public.remove_staff_membership(
  p_membership_id uuid
) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
  v_restaurant_id    uuid;
  v_role             public.staff_role;
  v_branch_id        uuid;
  v_other_owners     int;
begin
  -- Authorization (first act): owner of the membership's restaurant (FR-015).
  select m.restaurant_id into v_restaurant_id
  from public.staff_memberships m
  where m.id = p_membership_id;
  if v_restaurant_id is null
     or v_restaurant_id not in (select private.owned_restaurant_ids((select auth.uid())))
  then
    raise exception 'You do not have permission to manage this staff member.'
      using errcode = '42501';
  end if;
  select sp.profile_id into v_actor_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);

  -- Lock order everywhere: the restaurant row first, then the membership row.
  perform 1 from public.restaurants r where r.id = v_restaurant_id for update;

  select m.role, m.branch_id into v_role, v_branch_id
  from public.staff_memberships m
  where m.id = p_membership_id
  for update;
  if v_role is null then
    -- Removed concurrently after the authorization read: nothing to remove.
    raise exception 'You do not have permission to manage this staff member.'
      using errcode = '42501';
  end if;

  -- FR-016: removing the restaurant's last owner is rejected.
  if v_role = 'owner' then
    select count(*)::int into v_other_owners
    from public.staff_memberships m
    where m.restaurant_id = v_restaurant_id
      and m.role = 'owner'
      and m.id <> p_membership_id;
    if v_other_owners = 0 then
      raise exception 'A restaurant always keeps at least one owner.';
    end if;
  end if;

  perform private.record_audit(
    v_actor_profile_id,
    'staff.removed',
    'staff_membership',
    p_membership_id::text,
    null,
    v_restaurant_id,
    v_branch_id
  );

  delete from public.staff_memberships m where m.id = p_membership_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Execute grants: authenticated only, revoked from public and anon
-- (contracts/database-functions.md "Common properties"). The provisioning
-- helper is NOT a client API: it is revoked from every client role and is
-- callable only from the owner-executed public RPC above.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function private.provision_staff_identity(text, text)
  from public, anon, authenticated;

revoke all on function public.add_staff_member(uuid, text, text, public.staff_role, uuid)
  from public, anon;
revoke all on function public.update_staff_membership(uuid, public.staff_role, uuid)
  from public, anon;
revoke all on function public.remove_staff_membership(uuid)
  from public, anon;

grant execute on function public.add_staff_member(uuid, text, text, public.staff_role, uuid)
  to authenticated;
grant execute on function public.update_staff_membership(uuid, public.staff_role, uuid)
  to authenticated;
grant execute on function public.remove_staff_membership(uuid)
  to authenticated;
