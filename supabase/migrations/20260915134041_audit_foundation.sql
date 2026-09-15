-- Audit foundation: append-only audit_log + the single validated write path
-- (spec 002 FR-012/FR-013; master plan §37; data-model.md;
-- contracts/database-functions.md; research.md §10-§11).
--
-- Posture: RLS enabled, NO policies, NO client-role grants — audit records
-- are unreadable, unmodifiable, and undeletable through every
-- client-accessible path. Writes happen only through private.record_audit.

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_profile_id uuid not null references public.profiles (id),
  action text not null,
  resource_type text not null,
  resource_id text not null,
  reason text,
  restaurant_id uuid not null references public.restaurants (id),
  branch_id uuid,
  created_at timestamptz not null default now(),
  constraint audit_log_scope_fkey
    foreign key (restaurant_id, branch_id) references public.branches (restaurant_id, id)
);

create index audit_log_restaurant_created_idx
  on public.audit_log (restaurant_id, created_at desc);
create index audit_log_restaurant_branch_created_idx
  on public.audit_log (restaurant_id, branch_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_profile_id);

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated;

-- The ONLY write path (contracts): validates required context — actor,
-- action, resource type, resource id, and tenant scope — and raises an
-- exception naming the missing field. security definer so the insert is not
-- subject to audit_log's deny-all policies; execute is owner-only (no grant
-- to authenticated/anon — clients never write audit records directly).

create function private.record_audit(
  p_actor_profile_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_reason text,
  p_restaurant_id uuid,
  p_branch_id uuid
) returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_actor_profile_id is null then
    raise exception 'audit record requires an actor (actor_profile_id)';
  end if;
  if p_action is null or btrim(p_action) = '' then
    raise exception 'audit record requires an action';
  end if;
  if p_resource_type is null or btrim(p_resource_type) = '' then
    raise exception 'audit record requires a resource type (resource_type)';
  end if;
  if p_resource_id is null or btrim(p_resource_id) = '' then
    raise exception 'audit record requires a resource id (resource_id)';
  end if;
  if p_restaurant_id is null then
    raise exception 'audit record requires a tenant scope (restaurant_id)';
  end if;

  insert into public.audit_log
    (actor_profile_id, action, resource_type, resource_id, reason, restaurant_id, branch_id)
  values
    (p_actor_profile_id, p_action, p_resource_type, p_resource_id, p_reason, p_restaurant_id, p_branch_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.record_audit(uuid, text, text, text, text, uuid, uuid)
  from public, anon, authenticated;
