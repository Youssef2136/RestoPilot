# Contracts: Database Functions (Phase 1)

**Feature**: 002-database-and-tenancy | **Date**: 2026-09-15

The durable internal interface this feature exposes to later phases. Phase 1 has
no HTTP/API contracts (no Edge Functions, no new client operations — plan.md).
These four functions are the surface Phase 2 (RBAC policies, real logins) and
Phase 3+ (management features, audit-writing operations) build on, per the master
plan's contract strategy (§34): high-risk operations get explicit contracts.

Common properties (research.md §4): all functions live in the **`private`**
schema (never exposed via the data API), are `security definer`, and are created
with `set search_path = ''` and schema-qualified names inside the body — the
combination official Supabase guidance requires for policy-supporting functions.

---

## `private.staff_restaurant_ids`

```sql
staff_restaurant_ids(p_user uuid) returns setof uuid
-- language sql, stable, security definer, set search_path = ''
```

**Semantics**: every restaurant where the profile with
`profiles.auth_user_id = p_user` holds a staff membership (any role).

**Callers**: RLS policies on `restaurants` and `staff_memberships`; Phase 2
role policies; tests. **Execute grant**: `authenticated` (policies call it);
revoked from `anon`.

**Guarantees**: read-only; deterministic for a given database state; empty result
for an unknown user (deny-by-default falls out naturally). Duplicate memberships
are prevented by constraint, so the result is a clean set.

## `private.staff_branch_ids`

```sql
staff_branch_ids(p_user uuid) returns setof uuid
-- language sql, stable, security definer, set search_path = ''
```

**Semantics**: every branch referenced by a branch-scoped membership
(`branch_manager` / `cashier` / `kitchen`) of the profile with
`profiles.auth_user_id = p_user`. Owner memberships contribute nothing here.

**Callers**: RLS policies on `branches` and `dining_tables`; Phase 2+.

**Guarantees**: read-only; every returned branch id is guaranteed (by the
composite FK on `staff_memberships`) to belong to a restaurant the same user has
a membership in — branch scope never leaks across the tenant boundary.

## `private.owned_restaurant_ids`

```sql
owned_restaurant_ids(p_user uuid) returns setof uuid
-- language sql, stable, security definer, set search_path = ''
```

**Semantics**: restaurants where the profile with `profiles.auth_user_id =
p_user` holds an `owner` membership (restaurant-wide scope: every branch).

**Callers**: the owner arm of the `branches` / `dining_tables` policies;
Phase 2+.

**Guarantees**: read-only; subset of `staff_restaurant_ids(p_user)`.

---

## `private.record_audit`

```sql
record_audit(
  p_actor_profile_id uuid,
  p_action           text,
  p_resource_type    text,
  p_resource_id      text,
  p_reason           text,          -- may be null
  p_restaurant_id    uuid,
  p_branch_id        uuid           -- may be null
) returns bigint
-- language plpgsql, volatile, security definer, set search_path = ''
```

**Semantics**: appends one row to `public.audit_log` and returns the new row's
identity value. This is the **only** write path to the audit store.

**Validation (raises `exception` — P0001 — naming the field)**:

| Check | Rule |
|-------|------|
| Actor | `p_actor_profile_id` not null **and** exists in `profiles` (FK enforces existence) |
| Action | `p_action` non-empty after trim |
| Resource | `p_resource_type` and `p_resource_id` non-empty after trim |
| Tenant scope | `p_restaurant_id` not null **and** exists (FK) |
| Branch scope | when `p_branch_id` is provided, the composite FK guarantees it belongs to `p_restaurant_id` |
| Reason | optional (nullable) |

**Callers**: Phase 1 — tests (owner role) proving the contract; Phase 3+ —
server-side business operations and their triggers/functions record sensitive
actions (master plan §37). **Execute grant**: owner role only — **no** execute
grant for `authenticated`/`anon`; client code never writes audit records
directly.

**Failure modes**: any failed validation aborts the caller's transaction with a
message naming the missing/invalid field (spec Edge Case: incomplete audit
writes must be rejected, never silently stored).

**Non-goals (explicit)**: no client-readable path for audit rows (none is
specified until the audit/report phase); no structured `jsonb` change payloads
(arrive with the features that produce them); no retention/archival behavior
(audit/report phase).

---

## Stability commitments for Phase 2+

1. **Signatures are additive-only.** Breaking changes to these functions require
   a feature spec that supersedes this contract.
2. **The scope functions remain the single source of scope resolution.** Phase 2
   role policies compose them (e.g. owned-restaurant checks for owner-only
   writes) rather than re-implementing membership queries inline — that is the
   recursion-safety and consistency guarantee (research.md §4).
3. **`record_audit` remains the only audit write path.** Features that need
   audit records call it (directly or from triggers) and must not be granted
   table access.
4. **The grants posture is part of the contract.** Any future grant of table
   privileges to client roles must arrive with the policies that make it safe
   (grants decide operations; policies decide rows — research.md §3).
