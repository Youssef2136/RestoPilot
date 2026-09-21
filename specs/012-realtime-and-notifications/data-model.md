# Data Model: Realtime and In-App Notifications (Phase 11)

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

Created 2026-09-21

No schema changes. No new tables. The phase's database surface is
authorization and replication only:

## 1. The realtime publication

```sql
alter publication supabase_realtime add table
  public.rounds,
  public.kitchen_tickets,
  public.sessions,
  public.branch_unavailable_items,
  public.dining_tables;
```

(INSERT + UPDATE + DELETE flags default on for `alter publication add
table`.) Five tables = the seven §22 domains: menu availability
(`branch_unavailable_items`), incoming rounds + round state changes +
customer order status (`rounds`), kitchen ticket state
(`kitchen_tickets`), session state (`sessions`), table/entry state
(`dining_tables`), and operational notifications derive from the same
events client-side (no table).

## 2. Staff SELECT policies (RLS — the realtime authorization model)

One policy per table, SELECT-only, `to authenticated`, reusing the
`private.has_branch_role` helper the write RPCs use:

```sql
create policy rounds_select_authorized on public.rounds
  for select to authenticated
  using (
    private.has_branch_role(
      (select m.profile_id from public.staff_memberships m
       where m.auth_user_id = (select auth.uid()) limit 1),
      restaurant_id, branch_id,
      array['cashier','branch_manager','kitchen','owner']::public.staff_role[]
    )
  );
```

Identical for `kitchen_tickets` and `sessions` (owner reach comes from
the membership shape: `role='owner' and branch_id is null` matches every
branch of the restaurant — the 009 predicate).

The profile resolution must match the existing helper's expectation —
the implementation reuses whatever the 009-era helper accepts
(`private.ops_profile_id()` if it resolves from the JWT directly); the
policy predicate is `private.has_branch_role(private.ops_profile_id(),
restaurant_id, branch_id, ...)` with NO new helper. Verified against the
deployed 009 bodies before writing.

## 3. What does NOT change

- No direct-table grants: `rounds`/`kitchen_tickets`/`sessions` keep zero
  client SELECT grants (the policies authorize Realtime's per-row check;
  the tables' grant surface stays closed — realtime authorization is
  policy-based, not grant-based)
- All existing RPCs, policies on other tables, keys, and contracts
- No new columns, no audit changes, no tax changes

## 4. Client artifacts (no database)

- `src/features/realtime/useRealtimeInvalidation.ts` — the subscription
  hook (channel per scope, table events → query invalidation, the
  SUBSCRIBED → refetch recovery)
- `src/features/realtime/useNewRoundCue.ts` — the US4 in-app cue state
- Wire-ins in `CashierRoundsPage`, `KitchenDashboardPage`,
  `StaffSessionsPage`, `BranchMenuPage`, `DashboardPage` (the cue
  region)
