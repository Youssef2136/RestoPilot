# Contracts: Database Functions (Phase 2)

**Feature**: 003-auth-and-rbac | **Date**: 2026-09-15

The durable database interface of the authenticated staff layer — the
extension of feature 002's
[database-functions contract](../../002-database-and-tenancy/contracts/database-functions.md)
with the role dimension (spec FR-010): three new `private` helpers that the
Phase 2 policies compose, and one public RPC that resolves the caller's
effective authorization context. The policy matrix that consumes them is in
[data-model.md](../data-model.md); decisions and rejected alternatives in
[research.md](../research.md) §7–§9.

---

## Common properties

The three new helpers follow the feature 002 discipline exactly: they live
in the **`private` schema** (never exposed via the data API), are
`security definer`, `stable`, created with `set search_path = ''`, use
schema-qualified names inside the body, and carry
`grant execute … to authenticated` (policies call them) with execute
revoked from `public` and `anon`.

---

## `private.staff_profile_ids`

```sql
staff_profile_ids(p_user uuid) returns setof uuid
-- language sql, stable, security definer, set search_path = ''
```

**Semantics**: the profile(s) whose `auth_user_id = p_user` — at most one
row (the unique constraint on `profiles.auth_user_id` guarantees it).
Empty for an unlinked identity; the "own rows" arm of the
`staff_memberships` and `profiles` policies falls out naturally
(deny-by-default).

**Callers**: the replaced `staff_memberships` select policy; the new
`profiles` select policy; `current_auth_context()` (via its policy-guarded
reads); tests.

**Guarantees**: read-only; deterministic for a given database state; the
Phase 2 FK guarantees any non-null linkage points at a real identity.

## `private.managed_restaurant_ids`

```sql
managed_restaurant_ids(p_user uuid) returns setof uuid
-- language sql, stable, security definer, set search_path = ''
```

**Semantics**: restaurants where the profile with `auth_user_id = p_user`
holds a membership with role **`owner` or `branch_manager`** — the
staff-list visibility set (spec FR-007, Clarifications 2026-09-15). Superset
of `owned_restaurant_ids(p_user)`.

**Callers**: the `staff_memberships` select policy (the managed arm); tests
(the role matrix).

**Guarantees**: read-only; subset of `staff_restaurant_ids(p_user)`;
changes take effect on the next statement when a membership is added or
removed (FR-006 immediacy — policies read live rows, no cache).

## `private.managed_staff_profile_ids`

```sql
managed_staff_profile_ids(p_user uuid) returns setof uuid
-- language sql, stable, security definer, set search_path = ''
```

**Semantics**: profile ids holding **any** membership in one of the actor's
managed restaurants — the "linked profiles' basic information" arm of the
staff list (FR-007).

**Callers**: the `profiles` select policy; tests.

**Guarantees**: read-only; every returned profile is a member of a
restaurant the actor manages (the two helpers compose; no cross-tenant
leak is expressible).

---

## `public.current_auth_context`

```sql
current_auth_context() returns jsonb
-- language sql, stable, security invoker, set search_path = ''
-- execute: granted to authenticated; revoked from public, anon
```

**Semantics**: resolves the caller's effective authorization context — the
single artifact every guard and staff-area view consumes (spec Key Entity
"Effective Authorization Context"; FR-010). Returns:

```jsonc
{
  "profile": {
    "id": "uuid",
    "display_name": "text",
    "is_super_admin": false
  },                                  // null when the identity has no linked profile
  "memberships": [
    {
      "restaurant_id": "uuid",
      "restaurant_slug": "text",
      "restaurant_name": "text",
      "role": "owner | branch_manager | cashier | kitchen",
      "branch_id": "uuid | null",     // null for owners (restaurant-wide)
      "branch_name": "text | null"
    }
  ]
}
```

**Execution model — security invoker, by design**: the function reads
`profiles`, `staff_memberships`, `restaurants`, and `branches` **under the
caller's own RLS policies**. It therefore cannot disclose anything the
policies do not already allow, and it can never drift from them — the
policies remain the single source of the rules and this RPC is their
read-through projection (research.md §8). One call resolves the whole
context (one round trip); restaurant and branch names come only from rows
the caller may already read.

**Callers**: the application's `useAuthContext` hook (navigation, guards,
context selection, profile view — contracts/auth-client.md); the
integration test suite (asserting the resolved context matches the seeded
membership matrix, SC-001).

**Guarantees**:

- Read-only; returns data about the caller only.
- Distinguishes the three guard cases: staff (profile + memberships),
  super admin (profile, no memberships — FR-012), unlinked identity
  (`profile: null` → no staff area, US1 scenario 3).
- Refuses nothing: unauthenticated calls are excluded by the execute grant
  (`anon` has none); an authenticated unlinked identity simply gets
  `{"profile":null,"memberships":[]}`.

**Failure modes**: none beyond query errors — the function has no
parameters and no side effects.

**Non-goals (explicit)**: it does not authorize anything (guards and
policies decide); it does not expose other members' data (the staff list is
read through table policies by the staff-list view, not through this RPC);
it carries no role information into credentials (no custom claims exist —
research.md §7).

---

## Policy matrix served by this contract (summary)

All `for select to authenticated`, wrapped `(select …)` initPlan form —
full table in [data-model.md](../data-model.md):

| Table | Predicate (shorthand) |
|-------|-----------------------|
| `profiles` *(new)* | `id ∈ staff_profile_ids(auth.uid())` or `id ∈ managed_staff_profile_ids(auth.uid())` |
| `staff_memberships` *(replaced)* | `profile_id ∈ staff_profile_ids(auth.uid())` or `restaurant_id ∈ managed_restaurant_ids(auth.uid())` |
| `restaurants`, `branches`, `dining_tables` | unchanged (feature 002 helpers `staff_restaurant_ids` / `staff_branch_ids` / `owned_restaurant_ids`) |

*Erratum (2026-09-15): the `profiles` own arm was originally quoted as
`auth_user_id ∈ staff_profile_ids(auth.uid())` — a typo.
`staff_profile_ids` returns **profile ids**, so the predicate compares `id`,
exactly as the applied `rbac_policies` migration does (proven by
`tests/database/auth.rbac.test.ts`).*

## Stability commitments for Phase 3+

1. **Feature 002's commitments remain in force** (signatures additive-only;
   the scope functions remain the single source of scope resolution;
   `record_audit` remains the only audit write path; the grants posture is
   part of the contract).
2. **The helper family remains the only policy predicate source.** New
   role-aware policies (Phase 3 staff management, Phase 5+ business domains)
   compose these functions rather than re-implementing membership queries —
   the recursion-safety and consistency guarantee extends to the role
   dimension.
3. **`current_auth_context` is additive-only.** Shape evolution must be
   backward-compatible (new optional keys), and any change ships together
   with contracts/auth-client.md.
4. **`is_super_admin` stays policy-free until Phase 13** defines platform
   capabilities; giving it data access before then would violate FR-012.
5. **The invoker property of `current_auth_context` is part of the
   contract** — converting it to `security definer` would create a second
   source of visibility rules and requires superseding this contract.
