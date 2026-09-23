-- ─────────────────────────────────────────────────────────────────────────────
-- 019 Super-Admin Tenant Onboarding
--   §1 private.validate_tenant_inputs — the tenant-creation rulebook
--      extracted verbatim from create_restaurant (20260916174016), which is
--      re-created here to call it — behavior-identical (spec FR-005, FR-008)
--   §2 public.onboard_restaurant — the one indivisible platform action:
--      guard → validate → restaurant → first owner → membership →
--      subscription → audit (spec FR-001…FR-007, FR-008a, FR-010)
--   §3 the idempotent subscription backfill — makes pre-existing bootstrap
--      tenants visible to the console overview join (spec FR-008a, R3)
-- Conventions: security definer + empty search_path everywhere; refusals
-- are verbatim P0001 messages; SQLSTATEs are caught BY CONSTRAINT NAME and
-- re-raised with user-facing text; the audit trail records every action.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── §1 the shared tenant-creation rulebook (extracted, verbatim) ────────────

-- validate_tenant_inputs: normalize + validate the tenant-creation inputs
-- exactly as create_restaurant did (20260916174016 lines 63–82). One
-- rulebook for every tenant-creation surface (spec FR-005): the messages
-- are the contract — a clear P0001 in every case, nothing created.
create or replace function private.validate_tenant_inputs(
  p_name              text,
  p_slug              text,
  p_brand_description text,
  p_contact_email     text,
  p_contact_phone     text,
  p_timezone          text
) returns table (
  v_name              text,
  v_slug              text,
  v_brand_description text,
  v_contact_email     text,
  v_contact_phone     text,
  v_timezone          text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  v_name              := btrim(coalesce(p_name, ''));
  v_slug              := btrim(coalesce(p_slug, ''));
  v_brand_description := nullif(btrim(coalesce(p_brand_description, '')), '');
  v_contact_email     := nullif(btrim(coalesce(p_contact_email, '')), '');
  v_contact_phone     := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_timezone          := btrim(coalesce(p_timezone, ''));

  if v_name = '' then
    raise exception 'A restaurant name is required.';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'The public identifier may contain only lowercase letters, digits, and single hyphens.';
  end if;
  if exists (select 1 from public.restaurants r where r.slug = v_slug) then
    raise exception 'This public identifier is already in use by another restaurant.';
  end if;
  if v_timezone = '' then
    raise exception 'A timezone is required.';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = v_timezone) then
    raise exception 'Unknown timezone.';
  end if;

  return query
    select validate_tenant_inputs.v_name,
           validate_tenant_inputs.v_slug,
           validate_tenant_inputs.v_brand_description,
           validate_tenant_inputs.v_contact_email,
           validate_tenant_inputs.v_contact_phone,
           validate_tenant_inputs.v_timezone;
end;
$$;

-- create_restaurant: re-created to validate through the shared rulebook.
-- EVERYTHING else is byte-for-byte the 20260916174016 behavior: the linked-
-- profile authorization first act, the insert's constraint-name-caught
-- refusals, the creator's owner membership, the audit row (spec FR-008).
create or replace function public.create_restaurant(
  p_name              text,
  p_slug              text,
  p_brand_description text default null,
  p_contact_email     text default null,
  p_contact_phone     text default null,
  p_timezone          text default 'UTC'
) returns public.restaurants
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id        uuid;
  v_normalized        record;
  v_constraint        text;
  v_restaurant        public.restaurants;
begin
  -- Authorization (first act): a linked profile — the person-level
  -- entitlement FR-001's bootstrap grants.
  select sp.profile_id into v_profile_id
  from private.staff_profile_ids((select auth.uid())) as sp(profile_id);
  if v_profile_id is null then
    raise exception 'A linked profile is required to create a restaurant.'
      using errcode = '42501';
  end if;

  -- Validation: the shared rulebook — a clear P0001 in every case; nothing
  -- is created.
  select * into v_normalized
  from private.validate_tenant_inputs(
    p_name, p_slug, p_brand_description, p_contact_email, p_contact_phone, p_timezone
  );

  begin
    insert into public.restaurants
      (name, slug, brand_description, contact_email, contact_phone, timezone)
    values
      (v_normalized.v_name, v_normalized.v_slug, v_normalized.v_brand_description,
       v_normalized.v_contact_email, v_normalized.v_contact_phone, v_normalized.v_timezone)
    returning * into v_restaurant;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'restaurants_slug_key' then
        raise exception 'This public identifier is already in use by another restaurant.';
      end if;
      raise;
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'restaurants_name_check' then
        raise exception 'A restaurant name is required.';
      elsif v_constraint = 'restaurants_slug_check' then
        raise exception 'The public identifier may contain only lowercase letters, digits, and single hyphens.';
      elsif v_constraint = 'restaurants_timezone_check' then
        raise exception 'A timezone is required.';
      end if;
      raise;
  end;

  -- The creator becomes the restaurant's first owner (FR-001); that
  -- membership is what makes the restaurant visible to them under the
  -- existing policies.
  insert into public.staff_memberships (profile_id, restaurant_id, role)
  values (v_profile_id, v_restaurant.id, 'owner');

  perform private.record_audit(
    v_profile_id,
    'restaurant.created',
    'restaurant',
    v_restaurant.id::text,
    null,
    v_restaurant.id,
    null
  );

  return v_restaurant;
end;
$$;

-- ── §2 the platform onboarding RPC ───────────────────────────────────────────

-- onboard_restaurant: the super admin provisions a new restaurant and its
-- first owner in ONE indivisible action (spec FR-001/FR-002; plan §2). The
-- flag is the only key (014 D4); it gains no standing reads (FR-008b) —
-- the composition below is the entire capability.
--
-- First-owner provisioning composes private.provision_staff_identity
-- (20260916203911) unchanged: new person ⇒ credential issued,
-- person_created = true; unclaimed stub ⇒ profile completed + credential
-- re-issued; known person ⇒ linked only, credential untouched.
--
-- The subscription row lands here too (FR-008a): never_activated — the
-- console overview's join must see every tenant. Ordering from an
-- un-activated tenant is NEVER blocked (014's Important rule, untouched).
--
-- The audit row records the acting super admin as actor and the outcome
-- (provisioned vs. linked) in the reason (FR-006).
create or replace function public.onboard_restaurant(
  p_name               text,
  p_slug               text,
  p_owner_email        text,
  p_owner_display_name text,
  p_brand_description  text default null,
  p_contact_email      text default null,
  p_contact_phone      text default null,
  p_timezone           text default 'UTC'
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id   uuid;
  v_normalized   record;
  v_constraint   text;
  v_restaurant   public.restaurants;
  v_provisioned  record;
  v_owner_email  text;
begin
  -- Authorization (first act; FR-010): the super-admin flag and nothing
  -- else — the 014 console refusal, verbatim and indistinguishable.
  v_profile_id := private.ops_profile_id();
  if v_profile_id is null or not private.is_super_admin_profile(v_profile_id) then
    raise exception 'You do not have permission to view the platform console.' using errcode = '42501';
  end if;

  -- Validation: the shared rulebook (FR-005) — same messages, nothing
  -- created on refusal.
  select * into v_normalized
  from private.validate_tenant_inputs(
    p_name, p_slug, p_brand_description, p_contact_email, p_contact_phone, p_timezone
  );

  v_owner_email := lower(btrim(coalesce(p_owner_email, '')));
  if v_owner_email = '' or position('@' in v_owner_email) = 0 then
    raise exception 'A valid owner email address is required.';
  end if;
  if btrim(coalesce(p_owner_display_name, '')) = '' then
    raise exception 'A display name for the first owner is required.';
  end if;

  -- The restaurant (all-or-nothing, FR-004): the slug race is caught by
  -- constraint name and re-raised verbatim.
  begin
    insert into public.restaurants
      (name, slug, brand_description, contact_email, contact_phone, timezone)
    values
      (v_normalized.v_name, v_normalized.v_slug, v_normalized.v_brand_description,
       v_normalized.v_contact_email, v_normalized.v_contact_phone, v_normalized.v_timezone)
    returning * into v_restaurant;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'restaurants_slug_key' then
        raise exception 'This public identifier is already in use by another restaurant.';
      end if;
      raise;
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'restaurants_name_check' then
        raise exception 'A restaurant name is required.';
      elsif v_constraint = 'restaurants_slug_check' then
        raise exception 'The public identifier may contain only lowercase letters, digits, and single hyphens.';
      elsif v_constraint = 'restaurants_timezone_check' then
        raise exception 'A timezone is required.';
      end if;
      raise;
  end;

  -- The first owner: provision or link, via the staff helper verbatim.
  select * into v_provisioned
  from private.provision_staff_identity(v_owner_email, p_owner_display_name);

  -- The owner membership (first owner only — additional owners stay with
  -- the restaurant owner's staff panel, spec non-requirement). A concurrent
  -- identical onboarding fails closed on the no-duplicates index.
  begin
    insert into public.staff_memberships (profile_id, restaurant_id, role)
    values (v_provisioned.profile_id, v_restaurant.id, 'owner');
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'staff_memberships_no_duplicates' then
        raise exception 'This person is already a member of this restaurant.';
      end if;
      raise;
  end;

  -- The subscription row: never_activated (FR-008a).
  insert into public.subscriptions (restaurant_id)
  values (v_restaurant.id)
  on conflict (restaurant_id) do nothing;

  -- The audit row: actor = the acting super admin; the outcome distinction
  -- (provisioned vs. linked) in the reason (FR-006).
  perform private.record_audit(
    v_profile_id,
    'platform.restaurant_onboarded',
    'restaurant',
    v_restaurant.id::text,
    case when v_provisioned.temporary_password is not null
         then 'first owner provisioned'
         else 'first owner linked'
    end,
    v_restaurant.id,
    null
  );

  return jsonb_build_object(
    'restaurant_id', v_restaurant.id,
    'name', v_restaurant.name,
    'slug', v_restaurant.slug,
    'owner', jsonb_build_object(
      'profile_id', v_provisioned.profile_id,
      'email', v_owner_email,
      'temporary_password', v_provisioned.temporary_password,
      'outcome', case when v_provisioned.temporary_password is not null
                      then 'provisioned'
                      else 'linked'
                 end
    )
  );
end;
$$;

revoke all on function public.onboard_restaurant(
  text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.onboard_restaurant(
  text, text, text, text, text, text, text, text
) to authenticated;

-- ── §3 the subscription backfill (idempotent) ────────────────────────────────

-- Every restaurant gets exactly one subscription row (014's assumption);
-- the bootstrap creation path predates it, and the console overview's
-- inner join hides any tenant without one (verified live: the
-- journey-created tenants). Backfill idempotently — never touches dates.
insert into public.subscriptions (restaurant_id)
select r.id from public.restaurants r
on conflict (restaurant_id) do nothing;
