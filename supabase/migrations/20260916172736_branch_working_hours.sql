-- Branch working hours: the `weekday` enum, the btree_gist-backed schedule
-- table, its declarative guarantees, RLS, and the one new select policy
-- (spec 004 FR-008/FR-009/FR-025; data-model.md "Enum: weekday" and
-- "Entity: branch_working_hours"; research.md §2–§3, §12, §14).
--
-- Phase 3 migration 3 of 5. One row per open interval, stored under the
-- weekday it starts on. Only zero-length intervals and same-day overlaps are
-- rejected; a shared boundary is legal (half-open int4range); an interval
-- whose close precedes its open ends the following day — one row under its
-- start day, the +1440 normalization carried by `end_minute`.

create type public.weekday as enum (
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
);

-- ── btree_gist: the equality opclasses the exclusion constraint needs ───────
-- Supabase-supported extension, installed to the `extensions` schema. The
-- constraint references the standard opclass names schema-qualified, so a
-- name deviation fails loudly here rather than silently weakening the
-- constraint. `int4range` and its GiST opclass are core PostgreSQL.

create extension if not exists btree_gist with schema extensions;

-- ── branch_working_hours: the weekly recurring schedule (FR-008/FR-009) ─────

create table public.branch_working_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  branch_id uuid not null,
  weekday public.weekday not null,
  open_time time not null,
  close_time time not null,
  start_minute integer generated always as ((extract(epoch from open_time))::integer / 60) stored,
  end_minute integer generated always as (
    case
      when close_time > open_time then (extract(epoch from close_time))::integer / 60
      else (extract(epoch from close_time))::integer / 60 + 1440
    end
  ) stored,
  created_at timestamptz not null default now(),
  constraint branch_working_hours_scope_fkey
    foreign key (restaurant_id, branch_id) references public.branches (restaurant_id, id),
  constraint branch_working_hours_open_close_check check (open_time <> close_time),
  constraint branch_working_hours_minute_precision_check
    check (extract(second from open_time) = 0 and extract(second from close_time) = 0),
  constraint branch_working_hours_no_overlap
    exclude using gist (
      branch_id extensions.gist_uuid_ops with =,
      weekday extensions.gist_enum_ops with =,
      int4range(start_minute, end_minute) with &&
    )
);

-- The generated minute offsets keep the exclusion semantics exact and
-- self-describing; rows are immutable (created_at only) and replaced
-- wholesale by `replace_branch_working_hours`.

create index branch_working_hours_restaurant_id_idx on public.branch_working_hours (restaurant_id);
create index branch_working_hours_branch_id_idx on public.branch_working_hours (branch_id);

-- ── access posture (FR-025; research.md §12) ────────────────────────────────
-- Read-only for clients: the select policy mirrors dining_tables verbatim
-- (any staff of the restaurant; within it, the caller's assigned branch or
-- any branch of an owned restaurant). Every write goes through the
-- `replace_branch_working_hours` RPC (a security definer function).

alter table public.branch_working_hours enable row level security;

revoke all on table public.branch_working_hours from anon, authenticated;
grant select on table public.branch_working_hours to authenticated;

create policy branch_working_hours_staff_select
  on public.branch_working_hours
  for select
  to authenticated
  using (
    restaurant_id in (select private.staff_restaurant_ids((select auth.uid())))
    and (
      branch_id in (select private.staff_branch_ids((select auth.uid())))
      or restaurant_id in (select private.owned_restaurant_ids((select auth.uid())))
    )
  );
