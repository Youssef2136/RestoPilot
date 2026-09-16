# Contracts: Database Functions (Phase 3)

**Feature**: 004-restaurant-and-branch-management | **Date**: 2026-09-16

The durable database interface of the management layer — the extension of
feature 002's
[database-functions contract](../../002-database-and-tenancy/contracts/database-functions.md)
and feature 003's
[database-functions contract](../../003-auth-and-rbac/contracts/database-functions.md)
with the Phase 3 operations (spec FR-001…FR-016, FR-020). The schema effects
are in [data-model.md](../data-model.md); decisions and rejected alternatives
in [research.md](../research.md) §1–§11.

---

## Common properties

All twelve functions below live in the **`public` schema** (the data-API
surface), are `security definer`, `language plpgsql`, created with
`set search_path = ''` and schema-qualified bodies, and carry
`grant execute … to authenticated` with execute revoked from `public` and
`anon`.

Being exposed is deliberate: unlike feature 002's policy-supporting helpers
(which must never be client-callable and stay in `private`), these functions
*are* the client API — each performs its own authorization as its first act
and never trusts a parameter for the acting identity (`auth.uid()` resolves
the caller; the private helper family resolves their scope). No function
accepts an actor, a password, or an audit field from the caller.

**Shared invariants**:

- The caller's profile resolves through `private.staff_profile_ids(auth.uid())`;
  an identity without a linked profile is denied everywhere (`create_restaurant`
  denies it too — FR-001 requires a linked profile).
- Owner scope resolves through `private.owned_restaurant_ids(auth.uid())`
  (FR-006 — every operation in this phase is owner-only); branch/table
  targets first resolve their `restaurant_id`, then the same check.
- Every successful mutation writes exactly one audit record through
  `private.record_audit` in the same transaction (FR-020; vocabulary in
  [data-model.md](../data-model.md)).
- Errors follow the contract's error model (below): `42501` for authorization
  denial, `P0001` for validation and for every constraint violation the
  function detects (translated to a clear message).

**Error model** (load-bearing for the client contract): the functions catch
every constraint violation they can hit — a duplicate slug or label (`23505`),
a blank or zero-length check (`23514`), a working-hours overlap (`23P01`) — by
constraint name and re-raise it as `P0001` with the user-facing message, so
those SQLSTATEs never reach the client through these RPCs. The constraints
remain the declarative backstop for any other writer (and no client write
grants exist); anything unrecognized at the client is therefore a true last
resort, not a mapping gap.

| SQLSTATE | Meaning | Client behavior |
|----------|---------|-----------------|
| `42501` `insufficient_privilege` | The caller is not authorized for the target resource (wrong role, other restaurant, other branch, no linked profile) | Show the generic denial message |
| `P0001` `raise_exception` | Validation failure or a caught-and-translated constraint violation; the message is written for humans and is shown verbatim | Show the message, keep the form state |
| anything else | Not produced by these RPCs (a true last resort, e.g. a transient connection error) | The client's generic retry message |

---

## Restaurant operations

### `create_restaurant`

```sql
create_restaurant(
  p_name              text,
  p_slug              text,
  p_brand_description text default null,
  p_contact_email     text default null,
  p_contact_phone     text default null,
  p_timezone          text default 'UTC'
) returns public.restaurants
```

**Semantics**: creates the tenant and its first owner in one transaction: the
restaurant row, then a `staff_memberships` row for the caller's profile with
`role = 'owner'` and no branch (FR-001). The creator's dashboard gains the
restaurant because the membership makes it visible under the existing
policies.

**Authorization**: any caller with a linked profile (FR-001's bootstrap; the
Assumptions' V1 onboarding path). The platform super-admin flag grants nothing
here and nothing anywhere in this contract — creation is the person-level
entitlement.

**Validation** (clear `P0001` in every case; nothing is created):

| Rule | Message intent |
|------|----------------|
| `p_name` non-empty after trim | "A restaurant name is required." |
| `p_slug` matches `^[a-z0-9]+(-[a-z0-9]+)*$` | "The public identifier may contain only lowercase letters, digits, and single hyphens." |
| `p_slug` not already in use (unique constraint backstop) | "This public identifier is already in use by another restaurant." |
| `p_timezone` present in `pg_timezone_names` | "Unknown timezone." |
| Optional text fields: trimmed; empty ⇒ stored as `NULL` | — |

**Audit**: `restaurant.created` (resource = the new restaurant; no branch
scope).

**Returns**: the created restaurant row.

### `update_restaurant_profile`

```sql
update_restaurant_profile(
  p_restaurant_id     uuid,
  p_name              text,
  p_slug              text,
  p_brand_description text default null,
  p_contact_email     text default null,
  p_contact_phone     text default null
) returns public.restaurants
```

**Semantics**: full-profile update (display name, public identifier, brand
description, contact information) — FR-002. Changing `p_slug` is the FR-004
flow: the identifier is replaced, and because the public entry URL and the QR
derive from it ([qr-entry-point.md](./qr-entry-point.md)), the old identifier
no longer addresses this restaurant and the application retains or encodes it
nowhere. **This is the specified behavior, not an error**: no alias, no
redirect, no history — the released identifier is immediately reusable, and
what an old code or link resolves to is the public route's semantics
(features 001/007), not this function's. The API client
contract requires the UI to obtain explicit confirmation *before* calling this
function with a changed identifier ([management-client.md](./management-client.md)).

**Authorization**: owner of `p_restaurant_id` (`42501` otherwise).

**Validation**: as in `create_restaurant` (name, slug shape, slug uniqueness
against other restaurants — the restaurant's own current slug is accepted
unchanged). Optional fields trimmed; empty ⇒ `NULL`.

**Audit**: `restaurant.profile_updated` (one record per accepted call,
identifier changes included).

**Returns**: the updated restaurant row.

### `update_restaurant_settings`

```sql
update_restaurant_settings(
  p_restaurant_id uuid,
  p_timezone      text
) returns public.restaurants
```

**Semantics**: the restaurant-level basic settings (FR-003) — currently the
timezone that anchors its branches' working-hours meaning.

**Authorization**: owner (`42501`).
**Validation**: non-empty, present in `pg_timezone_names` (`P0001`).
**Audit**: `restaurant.settings_updated`.
**Returns**: the updated restaurant row.

---

## Branch operations

### `create_branch`

```sql
create_branch(p_restaurant_id uuid, p_name text) returns public.branches
```

**Semantics**: creates a branch under the restaurant (FR-007). Display names
are not unique-constrained (feature 002 FR-002 continuity).

**Authorization**: owner of `p_restaurant_id` (`42501`).
**Validation**: `p_name` non-empty after trim (`P0001`).
**Audit**: `branch.created` (branch scope = the new branch).
**Returns**: the created branch row.

### `rename_branch`

```sql
rename_branch(p_branch_id uuid, p_name text) returns public.branches
```

**Semantics**: edits the branch name (FR-007); the branch's identity and
everything attached to it are unaffected.

**Authorization**: owner of the branch's restaurant (`42501`).
**Validation**: non-empty after trim (`P0001`).
**Audit**: `branch.renamed` (branch scope).
**Returns**: the updated branch row.

### `replace_branch_working_hours`

```sql
replace_branch_working_hours(
  p_branch_id  uuid,
  p_intervals  jsonb
) returns setof public.branch_working_hours
```

**Semantics**: replaces the branch's entire weekly schedule atomically
(delete + insert in one transaction) — the all-or-nothing behavior FR-008
requires ("the stored schedule is left unchanged" on rejection). Input shape:

```jsonc
[
  { "weekday": "monday",    "open_time": "11:00", "close_time": "15:00" },
  { "weekday": "monday",    "open_time": "18:00", "close_time": "02:00" },
  { "weekday": "saturday",  "open_time": "12:00", "close_time": "02:00" }
]
```

An empty array clears the schedule (every day reads as closed). A
`close_time` earlier than `open_time` means the following day and is stored
normalized (`end_minute` includes the `+1440` offset) under the weekday it
starts on. A day with no intervals reads as closed; a branch with no rows
reads as "no hours configured" (the customer-facing meaning belongs to the
customer-access feature).

**Authorization**: owner of the branch's restaurant (`42501`). The function
locks the branch row (`for update`) for the replacement, so concurrent saves
cannot interleave into a mixed schedule.

**Validation** (`P0001`, schedule unchanged):

| Rule | Message intent |
|------|----------------|
| Input is a JSON array of objects with `weekday` (enum name), `open_time`/`close_time` (`HH:MM`, 00:00–23:59) | "Working hours must be a list of weekday intervals with HH:MM times." |
| `open_time <> close_time` (zero-length rejected) | "An interval cannot start and end at the same time." |
| No two intervals of the **same weekday** overlap; a shared boundary is legal | "Two intervals on the same day overlap." |

The exclusion constraint (`branch_working_hours_no_overlap`) is the backstop
for every write path; the function's pre-check provides the clear message.

**Audit**: `branch.working_hours_updated` (branch scope).
**Returns**: the stored rows (deterministic order: weekday, `open_time`).

---

## Table operations

### `create_dining_table`

```sql
create_dining_table(p_branch_id uuid, p_label text) returns public.dining_tables
```

**Semantics**: creates a table in the branch (the association is chosen at
creation — moving tables between branches is not offered in this phase).
Label unique within the branch; the same label in another branch is valid.

**Authorization**: owner of the branch's restaurant (`42501`).
**Validation**: non-empty label after trim; duplicate within the branch
(`P0001`, unique-constraint backstop).
**Audit**: `table.created` (branch scope).
**Returns**: the created row (`is_active = true`).

### `rename_dining_table`

```sql
rename_dining_table(p_dining_table_id uuid, p_label text) returns public.dining_tables
```

**Semantics**: renames/renumbers a table — incl. while inactive (FR-011,
US3 scenario 6); per-branch uniqueness applies.

**Authorization**: owner of the table's restaurant (`42501`).
**Validation**: non-empty; duplicate within the branch (`P0001`).
**Audit**: `table.renamed` (branch scope).
**Returns**: the updated row.

### `set_dining_table_active`

```sql
set_dining_table_active(p_dining_table_id uuid, p_active boolean) returns public.dining_tables
```

**Semantics**: sets the explicit activation state (FR-011/FR-012). Repeating
a transition is a no-op that leaves state consistent (Constitution VI); it
writes **no** audit record because nothing changed. Tables are never deleted.

**Authorization**: owner of the table's restaurant (`42501`).
**Audit**: `table.activated` / `table.deactivated` — only on actual change
(branch scope).
**Returns**: the row, with the resulting state.

---

## Staff operations

### `add_staff_member`

```sql
add_staff_member(
  p_restaurant_id uuid,
  p_email         text,
  p_display_name  text,
  p_role          public.staff_role,
  p_branch_id     uuid default null
) returns jsonb
```

**Semantics**: adds a person to the restaurant's staff in one transaction
(FR-013/FR-014): resolves the identity by email, provisions it when new
(§provisioning below), creates the linked profile when absent, inserts the
membership, records the audit. Returns:

```jsonc
{
  "membership": { "id": "…", "profile_id": "…", "restaurant_id": "…",
                  "role": "cashier", "branch_id": "…" },
  "profile_id": "…",
  "person_created": true,          // false when an existing person was linked
  "temporary_password": "3f9c…"    // non-null ONLY when a credential was issued;
                                   // null for an existing person with a linked profile
}
```

**Authorization**: owner of `p_restaurant_id` (`42501`).

**Validation** (`P0001`, nothing created):

| Rule | Message intent |
|------|----------------|
| Email non-empty and syntactically plausible (single `@`, non-empty local part and domain) | "A valid email address is required." |
| Display name non-empty after trim | "A display name is required." |
| `owner` role ⇒ `p_branch_id` is null; `branch_manager`/`cashier`/`kitchen` ⇒ `p_branch_id` required and a branch **of this restaurant** | "Owners are restaurant-wide and must not have a branch." / "Select a branch of this restaurant for this role." |
| No exact duplicate membership (existing `unique nulls not distinct` constraint backstop) | "This person already holds this exact membership." |

**Linking rules (FR-014)**: by email — an existing person is linked, never
duplicated; their profile's `display_name` is not overwritten; an identity
without a linked profile (an unclaimed stub) gets one and a re-issued
temporary credential; a linked person's credential is never touched. A person
may hold memberships in several restaurants or several roles (feature 002's
multi-membership rule).

**Audit**: `staff.added` (branch scope for branch-scoped roles).
**Returns**: the structure above. The temporary credential is returned exactly
once, is stored in no recoverable form, and the person may rotate it through
the platform's password-recovery flow.

### `update_staff_membership`

```sql
update_staff_membership(
  p_membership_id uuid,
  p_role          public.staff_role,
  p_branch_id     uuid default null
) returns public.staff_memberships
```

**Semantics**: changes a membership's role and/or branch (FR-015). Effective
access follows the new membership on the person's next access — policies read
live rows (feature 003 FR-006 continuity). The person's identity and profile
are untouched.

**Authorization**: owner of the membership's restaurant (`42501`). The
restaurant row is locked (`for update`) so concurrent owner changes serialize.

**Validation** (`P0001`, membership unchanged): role/branch consistency as in
`add_staff_member`; branch must belong to the same restaurant; no exact
duplicate of another membership; **the last-owner safeguard (FR-016)** — a
change that removes `owner` from the restaurant's only owner is rejected
("A restaurant always keeps at least one owner.").

**Audit**: `staff.updated` (branch scope for branch-scoped roles).
**Returns**: the updated membership row.

### `remove_staff_membership`

```sql
remove_staff_membership(p_membership_id uuid) returns void
```

**Semantics**: removes the membership (FR-015). Access to that restaurant ends
immediately; the person's profile and sign-in identity persist, so they can be
re-added without recreating the person (FR-014).

**Authorization**: owner of the membership's restaurant (`42501`). Restaurant
row locked as above.

**Validation**: removing the restaurant's last owner is rejected (`P0001`,
FR-016).

**Audit**: `staff.removed` (branch scope for branch-scoped roles; recorded
before the row is deleted, in the same transaction).
**Returns**: nothing.

---

## `private.provision_staff_identity` (internal, not a client API)

```sql
provision_staff_identity(p_email text, p_display_name text) returns table (
  auth_user_id       uuid,
  profile_id         uuid,
  temporary_password text,
  person_created     boolean
)
-- language plpgsql, volatile, security definer, set search_path = ''
-- execute: revoked from every client role (public, anon, authenticated); no
-- grant — callable only from its SECURITY DEFINER caller, add_staff_member
```

**Semantics**: the Phase 3 runtime provisioning path, using the insert
contract feature 003 verified live (part B of
[supabase-auth-surface.md](../../003-auth-and-rbac/contracts/supabase-auth-surface.md)):
one `auth.users` row (runtime `id`, `email_confirmed_at = now()`, the five
token columns as empty strings, `raw_app_meta_data` email provider) and one
`auth.identities` row (`provider_id = user id`, `identity_data` with
`sub`/`email`/`email_verified`), plus the linked `profiles` row. The temporary
credential is `encode(gen_random_bytes(12), 'hex')` hashed with
`crypt(…, gen_salt('bf', 10))` (pgcrypto; same cost as the platform's own
default and the seed).

**Callers**: `add_staff_member` only. **Feasibility**: the function owner is
the migration role (postgres), which holds the privileges the seed already
exercises against `auth.users`/`auth.identities`.

**Non-goals**: no email is sent, ever; no password parameter (callers can
never choose a credential); no super-admin flag is settable; no deletion of
identities or profiles (nothing in this phase deletes people).

---

## Stability commitments for Phase 4+

1. **Feature 002's and feature 003's commitments remain in force** — the
   scope-helper family remains the single source of scope resolution;
   `record_audit` remains the only audit write path; the grants posture
   (grants decide operations) is untouched.
2. **Signatures are additive-only.** Breaking changes require a spec that
   supersedes this contract.
3. **Owner-only is the phase's boundary, not the schema's ceiling.** Widening
   management to branch managers is a later phase's decision; it is delivered
   by editing these functions' authorization arm, not by adding client write
   grants.
4. **The management RPCs remain the only write paths to configuration data.**
   Any future direct grant of table write privileges must arrive with the
   policies that make it safe and must preserve FR-020's audit guarantee —
   which today only these functions provide.
5. **`private.provision_staff_identity` remains the only production writer to
   `auth.*`** (besides the development seed). The insert contract it
   implements is the feature-003-verified shape; any platform-side change to
   that shape must be re-validated and this contract updated.
6. **`replace_branch_working_hours` keeps replace-all semantics.** Finer
   granularity (per-interval edits) would be a contract change, not an
   additive extension.
