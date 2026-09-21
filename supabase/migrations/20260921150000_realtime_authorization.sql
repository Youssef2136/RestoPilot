-- ────────────────────────────────────────────────────────────────────────────
-- Phase 11 (realtime and in-app notifications) — the authorization and
-- replication surface (spec 012 T002; data-model.md §1–§2; research.md §1–§3).
--
-- No schema changes, no new grants, no new write paths. Exactly two things:
--
--   §1 the supabase_realtime publication gains the five event tables
--   §2 staff SELECT policies on the read-closed ordering tables so Realtime
--      can authorize per-row delivery (research §1)
--
-- The policies reuse the 009 authorization vocabulary VERBATIM:
-- `private.ops_profile_id()` (JWT → profile) +
-- `private.has_branch_role(profile, restaurant, branch, roles)` — the same
-- helper the write RPCs use, so policy and RPC cannot drift. Policy shape:
-- `to authenticated, for select, using (...)` — SELECT-only; the direct
-- tables stay write-closed (the RPCs remain the only write path).
--
-- Fail-closed by construction: tables without policies deliver nothing;
-- identities without memberships match nothing. No policy is added for
-- customers (research §3: the customer surface is poll+refetch, not push).
-- ────────────────────────────────────────────────────────────────────────────

-- ── §1 the publication (research §1: no events flow without this) ───────────

alter publication supabase_realtime add table
  public.rounds,
  public.kitchen_tickets,
  public.sessions,
  public.branch_unavailable_items,
  public.dining_tables;

-- ── §2 the staff SELECT policies (data-model.md §2) ─────────────────────────
-- Realtime evaluates the policies AS the subscriber's role — which requires
-- BOTH halves of Postgres access control: a SELECT grant (a missing grant
-- is `permission denied`, even for a policy-filtered read) AND a policy
-- that returns the row. The grant is SELECT-only; every write path remains
-- the RPC layer (Constitution IV).

grant select on public.rounds, public.kitchen_tickets, public.sessions
  to authenticated;

-- One policy per table; the predicate is IDENTICAL on all three ordering
-- tables: any staff role over the row's branch, or the restaurant's owner
-- (the has_branch_role owner arm). The customer session table uses the same
-- staff predicate — customers hold no membership, so they match nothing.

create policy rounds_select_authorized on public.rounds
  for select
  to authenticated
  using (
    private.has_branch_role(
      private.ops_profile_id(),
      restaurant_id,
      branch_id,
      array['cashier', 'branch_manager', 'kitchen', 'owner']::public.staff_role[]
    )
  );

create policy kitchen_tickets_select_authorized on public.kitchen_tickets
  for select
  to authenticated
  using (
    private.has_branch_role(
      private.ops_profile_id(),
      restaurant_id,
      branch_id,
      array['cashier', 'branch_manager', 'kitchen', 'owner']::public.staff_role[]
    )
  );

create policy sessions_select_authorized on public.sessions
  for select
  to authenticated
  using (
    private.has_branch_role(
      private.ops_profile_id(),
      restaurant_id,
      branch_id,
      array['cashier', 'branch_manager', 'kitchen', 'owner']::public.staff_role[]
    )
  );

-- `branch_unavailable_items` and `dining_tables` already carry their 005/004
-- SELECT policy families AND grants (availability and entry surfaces read
-- them through policies today) — realtime delivery inherits those unchanged.
-- No new policy, no new grant.

-- Cleanup probe (manual verification): carla + a submitted round reads 1
-- through the grant+policy pair; fiona and anon read 0 (fail-closed).
