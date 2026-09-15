-- Tenancy core: staff_role enum + the five tenancy tables
-- (spec 002 FR-001..FR-007; data-model.md; research.md §5-§9)
--
-- Security posture from birth: every table gets RLS enabled and client-role
-- grants revoked in THIS migration, so the tables are never exposed without
-- protection between this migration and tenancy_rls (research.md §3).
-- The tenancy_rls migration later adds the scope functions, the select
-- grants, and the policies.

create type public.staff_role as enum ('owner', 'branch_manager', 'cashier', 'kitchen');

-- ── restaurants: the top-level tenant root (FR-001) ─────────────────────────

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurants_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint restaurants_slug_key unique (slug)
);

-- ── branches: operational unit under exactly one restaurant (FR-002) ────────
-- unique (restaurant_id, id) is the composite anchor every branch-scoped
-- table's tenant foreign key points at (FR-006/FR-007).

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branches_restaurant_id_id_key unique (restaurant_id, id)
);

create index branches_restaurant_id_idx on public.branches (restaurant_id);

-- ── profiles: a person on the platform (FR-003); platform-level, not ────────
-- tenant-owned. auth_user_id links to the (future) auth identity — populated
-- and FK-constrained in Phase 2 (research.md §7). is_super_admin models the
-- platform capability; nothing reads it in Phase 1 (FR-004, modeled only).

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  auth_user_id uuid,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_auth_user_id_key unique (auth_user_id)
);

-- ── staff_memberships: the unit of staff authorization scope (FR-004) ───────
-- Multi-membership allowed (Clarifications 2026-09-15); exact duplicates
-- rejected via unique nulls not distinct (PG15+; research.md §9).

create table public.staff_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  restaurant_id uuid not null references public.restaurants (id),
  role public.staff_role not null,
  branch_id uuid,
  created_at timestamptz not null default now(),
  constraint staff_memberships_scope_fkey
    foreign key (restaurant_id, branch_id) references public.branches (restaurant_id, id),
  constraint staff_memberships_role_branch_check check ((role = 'owner') = (branch_id is null)),
  constraint staff_memberships_no_duplicates
    unique nulls not distinct (profile_id, restaurant_id, role, branch_id)
);

create index staff_memberships_restaurant_id_idx on public.staff_memberships (restaurant_id);
create index staff_memberships_profile_id_idx on public.staff_memberships (profile_id);
create index staff_memberships_branch_id_idx on public.staff_memberships (branch_id);

-- ── dining_tables: physical table in a branch (FR-005) ──────────────────────

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  branch_id uuid not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dining_tables_label_check check (length(btrim(label)) > 0),
  constraint dining_tables_scope_fkey
    foreign key (restaurant_id, branch_id) references public.branches (restaurant_id, id),
  constraint dining_tables_branch_label_key unique (branch_id, label)
);

create index dining_tables_restaurant_id_idx on public.dining_tables (restaurant_id);
create index dining_tables_branch_id_idx on public.dining_tables (branch_id);

-- ── deny-by-default posture from creation (FR-008) ──────────────────────────

alter table public.restaurants enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_memberships enable row level security;
alter table public.dining_tables enable row level security;

revoke all on table public.restaurants from anon, authenticated;
revoke all on table public.branches from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.staff_memberships from anon, authenticated;
revoke all on table public.dining_tables from anon, authenticated;
