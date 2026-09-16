# Research: Restaurant and Branch Management (Phase 3)

**Feature**: 004-restaurant-and-branch-management | **Date**: 2026-09-16

Decisions resolving every technical unknown for the Phase 3 management layer.
Each entry records the decision, rationale, and alternatives considered. The
deferred question the spec's Assumptions left to this plan — the staff
assignment/invitation mechanism — is resolved in §4–§5. Where a decision
reuses a mechanism proven by earlier phases, the source artifact is cited.

The three settled product decisions of the spec's Clarifications
(2026-09-16) are treated as fixed inputs, not reopened: the editable public
identifier without aliases (§8), owner-only management in this phase (§1, §13,
§17), and cross-midnight working-hours intervals (§2–§3).

---

## 1. Write path architecture: explicit management RPCs, no client write grants

**Decision**: Every management operation of this phase is a single
`security definer` PostgreSQL function in the `public` schema (`language
plpgsql`, `set search_path = ''`, schema-qualified bodies), callable over the
data API by the `authenticated` role, performing its own authorization and its
own audit write:

| RPC | Operation (spec) |
|-----|------------------|
| `create_restaurant` | FR-001 — create the tenant; creator becomes owner |
| `update_restaurant_profile` | FR-002/FR-004 — display name, public identifier, brand description, contact |
| `update_restaurant_settings` | FR-003 — timezone |
| `create_branch` | FR-007 — create under the restaurant |
| `rename_branch` | FR-007 — edit the branch name |
| `replace_branch_working_hours` | FR-008/FR-009 — the weekly schedule, all-or-nothing |
| `create_dining_table` | FR-010 — create in a chosen branch |
| `rename_dining_table` | FR-011 — rename/renumber incl. inactive tables |
| `set_dining_table_active` | FR-011/FR-012 — explicit activation state |
| `add_staff_member` | FR-013/FR-014 — add by email + display name + role (+ branch) |
| `update_staff_membership` | FR-015 — change role or branch |
| `remove_staff_membership` | FR-015/FR-016 — remove membership |

No insert/update/delete **grants** are issued to client roles anywhere; the
phase-1/2 posture (grants decide operations, policies decide rows) is extended
rather than relaxed. Authorization inside each function uses the existing
`private` helper family (`private.owned_restaurant_ids`, `private.staff_
profile_ids`); the audit record is written through the existing
`private.record_audit` inside the same transaction (FR-020).

**Rationale**:

- **Atomicity (Constitution VI)**: several operations are multi-row by nature
  — restaurant creation (restaurant + owner membership + audit), staff add
  (identity + profile + membership + audit), working-hours replacement
  (delete + insert the schedule + audit). A client performing independent
  table writes cannot keep these atomic; one function call can.
- **Auditability (Constitution VII, FR-020)**: `private.record_audit` is
  executable by the owner role only — client code can never write audit
  records directly (feature 002 contract). Only server-side code (a
  `security definer` function running as the owner) can produce the audit
  records FR-020 requires. Plain table writes would need table triggers, which
  feature 002 deliberately rejected as premature and which cannot cleanly
  capture the acting member, the reason, or per-operation action names.
- **One authorization language (Constitution III/IV)**: a single owner check
  per operation, reusing `private.owned_restaurant_ids`, instead of a parallel
  matrix of insert/update/delete RLS policies that could drift from the
  helpers. Isolation tests keep simulating identities the same way they do
  today and exercise the real enforcement path.
- **Master plan §31**: PostgreSQL functions are the designated mechanism for
  transactional database logic, multi-row state changes, and database-side
  invariant enforcement — exactly this feature's operations.

**Alternatives considered**:

- *Direct table writes with RLS write policies* — rejected: cannot satisfy
  FR-020 without triggers; multi-row operations would be non-atomic; would
  double the authorization surface (policies + functions) for no benefit.
- *Edge Functions for the write operations* — rejected: adds a second runtime
  (Deno), a deployment step, and — for staff provisioning — a service-role
  secret, while every invariant (owner checks, last-owner rule, tenant FKs,
  audit) would still live in the database. It contradicts the project's
  established "database is the trusted layer" posture (Constitution IV/V) and
  master plan §31's "do not move every operation into Edge Functions by
  default".
- *Table triggers for auditing on top of direct writes* — see rationale;
  rejected by feature 002 research §10 and not revived here.

## 2. Working-hours representation: `time` columns + generated minute offsets + declarative overlap exclusion

**Decision**: a new table `public.branch_working_hours`, one row per open
interval:

- `weekday public.weekday` (a new 7-value enum:
  `monday … sunday`, declaration order = display order),
- `open_time time not null`, `close_time time not null` (minute precision
  enforced),
- generated, stored `start_minute` / `end_minute` integer offsets:
  `start_minute = minutes(open_time)` and
  `end_minute = minutes(close_time)` when `close_time > open_time`, else
  `minutes(close_time) + 1440` — the post-midnight normalization,
- `check (open_time <> close_time)` — zero-length intervals rejected,
- an **exclusion constraint** `branch_working_hours_no_overlap`
  (`branch_id WITH =`, `weekday WITH =`, `int4range(start_minute, end_minute)
  WITH &&`) — two intervals on the same day can never overlap, in any write
  path (RPC, seed, migration, manual SQL),
- the composite tenant FK `(restaurant_id, branch_id) → branches(restaurant_id,
  id)` — unchanged pattern from features 002/003.

`btree_gist` (a Supabase-supported extension) provides the equality opclasses
the exclusion constraint needs for `uuid` and the enum (PostgreSQL 17
documents coverage of `uuid`, `int2`, and all enum types; the standard
opclass names — `gist_uuid_ops`, `gist_enum_ops` — are referenced
schema-qualified to the extension's schema, so a name deviation fails loudly
at `db:migrate` rather than silently weakening the constraint). The migration
enables the extension (`create extension if not exists btree_gist with schema
extensions`). `int4range` and its GiST opclass are core PostgreSQL.

**Rationale**: The spec's rejection rule is exact — zero-length intervals and
same-day overlaps are invalid, a shared boundary is legal (§3) — and this
makes both rules *declarative* (Constitution VI; feature 002's "invalid data
is rejected by constraints, not application code" posture), including for the
seed and any future writer. The half-open `int4range` matches the boundary
semantics exactly: `[10:00, 14:00)` and `[14:00, 18:00)` do not overlap.
Storing `time` keeps the columns self-describing for humans and generated
types; the minute offsets are derived, never authored, so they cannot drift.

**Alternatives considered**:

- *Integer minutes only* — rejected: unambiguous but opaque; the schema stops
  describing what an interval is.
- *`time` columns with overlap checked only in the RPC* — rejected: leaves the
  seed and any future write path unprotected, and abdicates the declarative
  guarantee feature 002 established.
- *Trigger-maintained slot table / 15-minute bucket rows* — rejected: far more
  machinery for the same guarantee (Constitution VIII).
- *A `timetz`/`tstzrange` approximation* — rejected: time-zone-dependent and
  disconnected from the restaurant's single configured timezone (§10); the
  schedule is wall-clock configuration, not an instant.

## 3. Post-midnight semantics and the scope of overlap rejection

**Decision**: An interval with `close_time < open_time` ends on the following
day and is stored, unchanged, as one row under the weekday it starts on
(`end_minute` carries the `+1440` normalization). Overlap rejection applies
**only among intervals recorded under the same weekday** — i.e. exactly the
spec's rule ("only zero-length intervals and same-day overlaps are rejected").
An 18:00–02:00 interval recorded for Monday overlapping a Tuesday 01:00–03:00
interval in real time is *not* rejected: the two rows live under different
weekdays by definition, and the spec deliberately scoped rejection to the
same recorded day. A day with no rows reads as closed; a branch with no rows
at all reads as "no hours configured" (the customer-facing meaning of that
state belongs to the customer-access feature).

**Rationale**: This is the Clarifications decision (2026-09-16, item 3)
translated into storage semantics without inventing a wider rule the spec did
not ask for (Constitution II/VIII). The overlap rule also stays expressible as
one declarative constraint (§2).

**Alternatives considered**:

- *Rejecting cross-day overlaps too* — rejected: the clarification explicitly
  limits rejection to same-day overlaps; widening it would invent a business
  rule and change spec-edited schedules.
- *Splitting a post-midnight interval into two rows (23:00–24:00 + 00:00–02:00)*
  — rejected: contradicts "post-midnight closing hours MUST be representable
  within a single interval" (FR-008) and would make day-level closure
  ambiguous.

## 4. Staff assignment mechanism (the spec-deferred decision): database-side identity provisioning with a one-time temporary credential

**Decision**: Adding a person is one owner-invoked RPC, `add_staff_member`,
which — inside a single transaction — resolves or creates the platform
identity and links it, using the **provisioning contract feature 003 already
verified live** (`specs/003-auth-and-rbac/contracts/supabase-auth-surface.md`,
part B: deterministic-column inserts into `auth.users` / `auth.identities`):

1. **New email** → a `security definer` helper
   (`private.provision_staff_identity`) inserts the `auth.users` and
   `auth.identities` rows exactly per that contract (`instance_id`, `aud`,
   `role = 'authenticated'`, `email_confirmed_at = now()`, the five
   token columns as empty strings, `raw_app_meta_data` with the email
   provider), with a **server-generated temporary password**
   (`encode(gen_random_bytes(12), 'hex')` — 24 hex characters, generated in
   the database; pgcrypto is already in use by the seed). It then creates the
   linked `profiles` row.
2. **Existing email** → the existing identity is linked; see §5.
3. The `staff_memberships` row is inserted with the requested role and branch;
   `private.record_audit` records `staff.added`.
4. The function returns the membership, the person's profile id, and the
   temporary credential **only when a new credential was issued**
   (`temporary_password` is `null` when the person already exists with a
   linked profile). The owner sees it once in the dashboard and conveys it to
   the person; it is stored nowhere in recoverable form.

This is the spec's third named option ("a temporary credential") delivered
inside the master plan's rules: no privileged credentials ever reach browser
code (§5.5) — the RPC call carries no service-role key, and the only secret
in play is the new person's own one-time credential, shown to the owner's
authenticated session exactly once. The person can rotate it through the
existing password-recovery flow (feature 003 FR-018) at any time.

**Rationale**:

- **No email dependency.** The hosted project's inbuilt SMTP allows 2 auth
  emails/hour (live-verified in feature 003). SC-001 requires the owner to add
  three staff members in one session with no operator intervention — an
  email-invitation mechanism would fail that success criterion, and
  `inviteUserByEmail` semantics under a disabled public-signup toggle are
  exactly the kind of platform-state coupling this project documents instead
  of assuming. The temporary-credential path sends no email and is fully
  automatable in tests.
- **No new secrets, runtime, or deployment step.** The established posture
  "no service-role credentials anywhere; no service-role/secret keys"
  (feature 003 constraints) is preserved. A service-role Edge Function would
  add Deno, `supabase functions deploy`, secret management, and a second
  writer to `auth.*` for one operation.
- **It is the documented trajectory.** Feature 003's stability commitments
  state that the provisioning contract "is superseded by the Phase 3 admin
  flows, which become the only production provisioning path" — this decision
  is that path, and the single-writer property of the auth tables is
  strengthened (the seed and this one helper are the only writers, both
  postgres-owned).
- **Atomicity.** Identity + profile + membership either all exist or none do
  (Constitution VI); the FK `profiles.auth_user_id → auth.users(id)` is
  satisfied inside the same transaction.

**Alternatives considered**:

- *Edge Function with the GoTrue admin API (`createUser` + a returnable
  password)* — technically viable but adds a runtime, a deployment step, and a
  service-role secret; the invariants would still be enforced in the database
  afterward, so the added machinery buys nothing except distance from
  platform-managed tables (which the seed already writes).
- *Platform invitation email (`inviteUserByEmail`)* — rejected as the primary
  mechanism: 2/hour email limit breaks SC-001 and automated tests; requires
  the admin API and therefore a service-role secret; couples the flow to the
  hosted SMTP configuration.
- *Owner-chosen passwords* — rejected: the owner would know every member's
  credential, an unnecessary impersonation surface; a server-generated
  one-time credential is no harder to convey.
- *One-time setup links built on GoTrue's recovery-token internals* —
  rejected: the token plumbing is internal and version-dependent; feature 003
  live-verified that token columns must be empty strings for sign-in. The
  existing, supported recovery flow already provides a real link-based reset
  for the person when they need one.

## 5. Linking existing persons by email (FR-014)

**Decision**: `add_staff_member` looks the email up in `auth.users`:

| State found | Behavior | Credential returned |
|-------------|----------|---------------------|
| No identity | create identity + profile; insert membership | yes (new temporary credential) |
| Identity **without** a linked profile (unclaimed stub — e.g. an interrupted earlier attempt or a post-reset orphan) | create the profile linked to the identity; insert membership; **re-issue** the temporary credential (update `encrypted_password`) | yes |
| Identity **with** a linked profile (the normal case) | insert the membership only; the profile's `display_name` is **not** overwritten | no |

The existing `unique nulls not distinct (profile_id, restaurant_id, role,
branch_id)` constraint rejects exact duplicate memberships (the RPC translates
it into a clear message); a distinct role or branch remains a valid additional
membership (feature 002 rule). A person with memberships in other restaurants
gains an additional, independent membership (multi-membership allowed).

**Rationale**: FR-014 requires linking without duplication and preserving the
person's profile across membership changes; it does not license overwriting an
existing person's display name with whatever the new owner typed (the person's
profile is their own — feature 003 shows it on their profile page). The
re-issued credential for an *unclaimed* identity exists because
`db:reset` intentionally leaves the `auth` schema untouched: after a reset, an
identity created through the app has no profile and no reachable credential,
and re-adding that email must produce a usable account rather than a
permanent lockout. The re-issue cannot affect a claimed account: an identity
with a linked profile never has its password touched.

**Alternatives considered**:

- *Always re-issue a credential* — rejected: silently invalidating a working
  person's password on every membership change violates "no other account
  change" (FR-015) and is hostile to the person.
- *Never re-issue* — rejected: post-reset orphaned identities would be
  permanently unusable through the app.
- *Reject unlinked identities with "email already in use"* — rejected: leaks
  platform state, contradicts FR-014's linking requirement, and strands the
  stub.

## 6. The last-owner safeguard (FR-016) and its concurrency discipline

**Decision**: `remove_staff_membership` and `update_staff_membership` (when
the change removes the `owner` role) count the restaurant's remaining owners
and reject with a clear message when the change would leave zero. Both
functions first take a row lock on the restaurant row (`select id from
public.restaurants where id = … for update`) so two concurrent owner
demotions serialize and cannot both pass the check.

**Rationale**: The safeguard is a cross-row invariant; without serialization
two owners could demote each other simultaneously and both observe "another
owner exists". One row lock per restaurant is the smallest correct mechanism
(master plan §36: "do not add concurrency mechanisms blindly; select them per
operation") and costs nothing in the common case. All membership-mutating
RPCs take the same lock, so the invariant has exactly one serialization point.

**Alternatives considered**:

- *Serializable isolation for these transactions* — rejected: retry handling
  in the client for a rare race, where a single row lock is deterministic.
- *A deferred constraint trigger* — rejected: imperative, harder to message,
  and feature 002's declarative-constraint discipline cannot express
  "at least one owner" declaratively in PostgreSQL.
- *Optimistic version column on restaurants* — rejected: more machinery than
  the invariant needs.

## 7. Concurrency for the schedule replacement and other operations

**Decision**: `replace_branch_working_hours` takes a row lock on the branch
(`select id from public.branches where id = … for update`) and then deletes +
inserts the whole schedule in one transaction; the exclusion constraint (§2)
remains the backstop for every path. Single-row updates (profile, settings,
branch rename, table rename/activation) are plain atomic `UPDATE`s —
last-accepted-write-wins, which satisfies the spec's concurrency edge case
("each accepted change is applied atomically; no partial or contradictory
records"). Duplicate detection under concurrency is delegated to the unique
constraints (slug, per-branch table label, membership duplicates) with
message translation.

**Rationale**: The delete+insert pattern is the operation that could otherwise
interleave into a mixed schedule under concurrent saves; one branch lock
removes that class of outcome. Nothing else in this phase has a read-modify-
write cycle that a lock would fix.

## 8. Public identifier change: warning, no aliases, URL/QR derivation (FR-004)

**Decision**: The public identifier (`restaurants.slug`) is editable through
`update_restaurant_profile`; uniqueness and the kebab-case pattern are
enforced as today. The dashboard **must** present the consequence warning
("the old identifier will no longer address this restaurant and is not
retained or encoded anywhere — no alias, no redirect, no history") and
require explicit confirmation **before** the change is submitted; on success
the page shows the new public entry URL and the QR remains obtainable (now
encoding the new URL). No redirect, no alias, no history — the previous
identifier becomes immediately available to any restaurant (global
uniqueness, feature 002 rule); what an old printed code or shared link then
resolves to is the public route's semantics (feature 001's placeholder;
feature 007 customer-facing), not this phase's guarantee.

**Rationale**: This is the Clarifications decision encoded in an interface
rule. The warning is deliberately a client-side confirmation: the server
cannot verify that a human read a warning, and the spec's requirement is that
the owner is warned before confirming, which is a UI obligation.

**Alternatives considered**:

- *A confirmation token/flag parameter on the RPC* — rejected: theatre; the
  server cannot validate informed consent, and it would not change behavior.
- *Soft-retaining the old slug or redirecting* — explicitly excluded by the
  clarification.

## 9. The restaurant QR artifact

**Decision**:

- The encoded payload is exactly the restaurant's public entry URL:
  `{origin}/r/{slug}` — the same public route feature 001 reserved. The
  origin is the application's own origin at render time
  (`window.location.origin`), since the dashboard and the public entry page
  are one deployment in V1.
- Rendering uses the `qrcode` npm package (one new runtime dependency) through
  a small project module (`src/features/management/qrEntry.ts`) exposing
  `buildRestaurantEntryUrl(origin, slug)`, SVG output (for print-quality
  download) and PNG data-URL output. Both artifacts encode the same URL.
- The QR panel displays the encoded URL as text next to the code (so a
  human — and an automated test — can verify the target without decoding
  pixels), and offers download.
- Nothing about a branch or table enters the payload; per-table/dynamic QR
  remains out of V1 scope (master plan §3.2).

**Rationale**: `qrcode` is the mature, framework-agnostic option that
generates both display and download artifacts from one dependency, works in
the browser bundle and in Node unit tests, and has bundled type definitions
via `@types/qrcode`. Deriving the origin from `window.location` means the
artifact is automatically correct for every deployment (including the dev
origin) with no new environment variable (feature 003 established "no new
environment variables"). The URL text beside the code makes SC-005's "carries
no branch or table information" provable by inspection.

**Alternatives considered**:

- *`qrcode.react`* — viable (React component), but couples generation to
  component rendering and needs canvas plumbing for downloads; the plain
  library serves display and download symmetrically and is testable in Node.
- *A configurable public base URL (`VITE_PUBLIC_BASE_URL`)* — rejected: no
  requirement separates the customer origin from the dashboard origin in V1;
  a new env var for an unrequired scenario contradicts Constitution VIII.
- *Automated pixel-level QR decoding in tests* — rejected: needs an additional
  decoder dependency for one assertion; the unit suite verifies the derived
  payload exactly, and the quickstart includes a real decode (phone camera or
  any scanner) of a downloaded artifact.

## 10. Timezone: one restaurant-level setting, validated in the database

**Decision**: `restaurants.timezone text not null default 'UTC'` — the single
restaurant-level setting (spec Assumption: one timezone per restaurant).
`update_restaurant_settings` (and `create_restaurant`) validate the value
against PostgreSQL's own IANA list (`pg_timezone_names`) and reject unknown
names with a clear message. The management UI offers the browser's IANA list
(`Intl.supportedValuesOf('timeZone')`) and pre-fills the restaurant's current
value; the create form pre-fills the browser's zone. A non-empty check
constraint backs the column; the authoritative validation is the RPC (a check
constraint cannot consult `pg_timezone_names`, which is not immutable).

**Rationale**: The database's timezone database is the same IANA database the
working-hours semantics ("18:00–02:00 local time") will be interpreted
against, so validating there guarantees agreement; the browser list is a
convenience that may lag the installed tzdata by a release, which the server
check catches. No timezone table is introduced (YAGNI).

**Alternatives considered**:

- *A lookup table seeded with a curated list* — rejected: a parallel, stale
  copy of data PostgreSQL already ships.
- *Free text without validation* — rejected: a typo'd timezone silently
  changes working-hours meaning, and FR-001's "malformed" rejection spirit
  applies to settings the platform later interprets.

## 11. Table activation state (FR-011/FR-012)

**Decision**: `dining_tables.is_active boolean not null default true`.
`set_dining_table_active(p_dining_table_id, p_active)` sets the explicit
state; repeating a transition is a no-op that leaves state consistent
(Constitution VI) and writes an audit record only when the state actually
changed. Tables are never deleted in this phase. The column is the
authoritative source the later customer flow will consult (FR-012); this phase
only maintains it and excludes nothing from any surface.

**Rationale**: Explicit persisted state, exactly as FR-011 requires; a
boolean is the whole lifecycle this phase has. The change-detected audit
keeps the record meaningful ("what was done") instead of logging no-ops.

**Alternatives considered**: a state enum (active/inactive/archived) —
rejected: archiving is explicitly out of scope; a boolean is the minimal
complete model.

## 12. Read surfaces: no changes to any existing policy; one new table policy

**Decision**: The new columns on `restaurants` and `dining_tables` are
readable under the existing select policies (which already scope them by
tenant/branch). The new `branch_working_hours` table gets the dining_tables
pattern verbatim: `select` granted to `authenticated`, RLS enabled, one select
policy — `restaurant_id in staff_restaurant_ids(uid) and (branch_id in
staff_branch_ids(uid) or restaurant_id in owned_restaurant_ids(uid))`. No
existing policy, grant, or helper is modified; `profiles`, `staff_memberships`,
`audit_log`, and `app_meta` are untouched. Feature 003's read rules remain in
force (FR-025).

**Rationale**: The phase's configuration reads land exactly on the scopes
features 002/003 already defined — a branch's schedule belongs to the same
audience as the branch itself. Adding no policy means no re-proof burden on
the existing isolation suites beyond the new surfaces they will exercise.

## 13. Dashboard surfaces, guards, and the creation bootstrap

**Decision**:

- `/dashboard`'s guard is revised from `RequireStaff` to a new
  **`RequireProfile`** (a signed-in identity with a linked profile); the page
  renders the create-restaurant panel when the profile has no memberships,
  and the existing staff area otherwise. Unlinked identities are still
  rejected with `NotAuthorized` (feature 003 behavior). This is the only
  revision to feature 003's route contract, necessary because FR-001 requires
  a linked profile with no memberships to reach restaurant creation and to see
  the new restaurant appear in "their dashboard" — while a `RequireStaff`
  guard excludes exactly that identity by definition.
- The platform super-admin profile may also create a restaurant through this
  surface: FR-001 grants creation to any linked profile, and FR-021 forbids
  the *capability* from granting tenant access — the RPCs never consult
  `is_super_admin`, and the existing super-admin denial matrix (no membership
  → no tenant data, no management) is re-asserted unchanged.
- New owner management routes under the existing staff area:
  `/dashboard/restaurant` (profile, settings, QR — owner-only in-page),
  `/dashboard/branches` (policy-scoped list + owner-only create/rename),
  `/dashboard/branches/:branchId` (policy-scoped branch view: working hours +
  tables; owner-only edit affordances). `/dashboard/staff` gains owner-only
  management controls on top of the existing read surface (branch managers
  keep read access, FR-025).
- All new guards/predicates (`RequireProfile`, `canManageRestaurant`) are
  presentation-only; the RPCs remain the authorization boundary
  (Constitution IV). Deep links by non-owners render `NotAuthorized` — 
  rejected, not hidden (feature 003 FR-014 continuity).

**Rationale**: One dashboard whose content adapts to the profile state is the
smallest coherent surface for the whole journey (create → configure → see it
in the dashboard), avoids a parallel landing route and landing rules the spec
never asked for, and keeps the "selected restaurant/branch" pattern the
existing pages already use (in-page selectors over policy-readable data)
instead of introducing path-parameter context plumbing.

**Alternatives considered**:

- *Keeping `RequireStaff` on `/dashboard` and adding a separate bootstrap
  route* — rejected: the identity that must create a restaurant cannot pass
  `RequireStaff`, so the bootstrap would need its own guard anyway (equal
  cost), plus a new landing rule and a second entry point for discoverability.
- *A forced restaurant chooser after sign-in* — explicitly rejected by
  feature 003 FR-015; not revisited.
- *Test-suite impact*: the existing guard unit tests wrap guards explicitly,
  so they keep passing; the planned updates (`tests/unit/auth.guards.test.tsx`)
  add `RequireProfile`/`canManageRestaurant` cases and a bootstrap-panel case
  to keep the tests truthful about the revised route.

## 14. Migration structure: five focused migrations

**Decision**:

| Migration | Contents |
|-----------|----------|
| `<ts>_restaurant_settings.sql` | `restaurants`: `brand_description`, `contact_email`, `contact_phone`, `timezone` (+ non-empty checks on `name`/`timezone`) |
| `<ts>_dining_table_activation.sql` | `dining_tables.is_active boolean not null default true` |
| `<ts>_branch_working_hours.sql` | `weekday` enum; `btree_gist`; `branch_working_hours` table, checks, exclusion constraint, indexes, RLS enable, select grant, select policy |
| `<ts>_management_rpcs.sql` | the 9 configuration RPCs (`create_restaurant` … `set_dining_table_active`) + execute grants |
| `<ts>_staff_management_rpcs.sql` | `private.provision_staff_identity` + the 3 staff RPCs + execute grants |

All created with `supabase migration new` and applied with `npm run db:migrate`
— the single canonical workflow (FR-024). Types regenerated with
`npm run types:gen`.

**Rationale**: Same review-grouping principle as features 002/003 (schema →
authorization posture → operations), with the sensitive auth-provisioning
surface isolated in its own migration for review. Five files is the natural
grain for three schema extensions, one new table, and twelve functions.

**Alternatives considered**: one large migration (harder to review/revert);
one file per table (noise).

## 15. Seed extension: fixture configuration, Fiona, and convergence

**Decision**: `supabase/seed.sql` grows:

- **Restaurant profile/settings values** for Blue Olive and Cedar Grill
  (brand descriptions, contact email/phone, timezones `Europe/Lisbon` and
  `Europe/Madrid`) applied with `on conflict (id) do update` **for the new
  columns only**, so an existing migrated database converges to the fixture
  without `db:reset` while `name`/`slug` keep their `do nothing` semantics.
- **Working hours** for all three branches with deterministic UUIDs,
  exercising the interesting shapes: a split day (lunch + dinner), a
  post-midnight dinner service (18:00–02:00), a closed day, and a
  boundary-touching pair — Marina's Wednesday is split into two touching
  intervals, 12:00–18:00 + 18:00–23:00 (accepted, not an overlap; FR-008).
- **Table activation**: Marina `T1` inactive (the fixture proves inactive
  tables stay visible); everything else active.
- **A seventh person, Fiona** (`fiona@restopilot.dev`, dev password
  `dev-fiona-2026`): a linked profile with **no memberships** — the fixture
  for the creation bootstrap (FR-001), the `RequireProfile` dashboard panel,
  and the "profile without memberships" guard case, distinct from the
  modeled-only super admin.
- `scripts/db/seed.mjs`'s summary gains the working-hours count.

**Rationale**: FR-023 requires the fixture needed to demonstrate and test this
phase with zero manual setup, and SC-007 requires the whole journey to be
demonstrable from the seed. The existing suites keep passing: the new profile
has no membership and therefore appears in no scope list; the existing fixtures
are additive changes only (columns with defaults, one new table). The one
existing suite that asserts exact column lists
(`tests/database/tenancy.schema.test.ts`) is updated to the extended shapes —
the only deliberate test revision caused by the schema extension.

## 16. Test strategy across the four tiers

**Decision**:

- **Database suite** (`npm run test:db`) — two new suites call the management
  RPCs as simulated identities inside rolled-back transactions (the feature
  002/003 harness): the full authorization matrix (non-owners, other
  restaurants, other branches, anon, super admin), every validation rule
  (slug duplicate/malformed, blank names, working-hours zero-length/overlap
  with the stored schedule left unchanged, per-branch label duplicates,
  exact-duplicate membership, last-owner removal/demotion, role/branch
  consistency, unknown timezone), the new schema's declarative guarantees
  (exclusion constraint, checks), the audit records of FR-020 (actor, action,
  resource, tenant/branch scope), idempotent transitions, and the new read
  surfaces (working hours visibility per scope).
- **Integration suite** (`npm run test:integration`) — the exit-condition
  proof over the real APIs: an owner provisions a person through
  `add_staff_member` (real data API), the person's credential is used in a
  real Auth API sign-in, `current_auth_context` resolves exactly the assigned
  scope, out-of-scope reads are denied through the real client — then the
  scratch rows (membership, profile, identity, the scratch audit records) are
  deleted through the owner connection in `afterAll`, following the existing
  scratch-identity pattern so the shared development database returns to its
  baseline.
- **Unit suite** (`npm run test:unit`) — the QR entry-URL derivation and
  artifact generation, the management client's error mapping (42501 → denial
  message; P0001 → the server's message verbatim), and the extended guard
  matrix (`RequireProfile`, `canManageRestaurant`, bootstrap panel).
- **End-to-end suite** (`npm run test:e2e`) — the browser presentation
  matrix, **read-and-reject only**: the owner sees the management surfaces,
  the QR panel with the encoded URL text, and the branch fixture; the
  slug-change warning appears before confirm and cancelling leaves the
  identifier unchanged; a working-hours validation rejection surfaces the
  server's message and the stored schedule is unchanged; non-owners
  (cashier/branch manager/platform admin) are rejected on management deep
  links; branch managers can read their own branch's configuration. E2E
  deliberately creates no tenant, branch, table, or staff rows: deletes are
  not part of this phase, and audit records deliberately anchor created
  branches/tables — a smoke-created fixture could never be cleaned up. The
  full creation journey is proven by the database and integration suites plus
  the manual quickstart walkthrough.
- **Existing suites**: `tests/database/helpers/fixtures.ts` is extended (new
  ids, Fiona, working-hours fixture, dev credentials). The only behavioral
  revision is `tests/database/tenancy.schema.test.ts`'s declared column
  shapes (see §15). `tests/unit/auth.guards.test.tsx` gains the new
  guard/predicate cases. `tests/integration/auth.signin.test.ts` needs no
  edit: its sign-in loop iterates the fixture identities, so Fiona is covered
  automatically; the scope matrix is an explicit list to which her empty
  scope adds nothing platformAdmin does not already prove.

**Rationale**: The tiering preserves the established division of labor
(database = enforcement, integration = real identity/API path, unit =
pure functions, e2e = presentation), keeps the rate-limit budget comfortable
(one extra sign-in per integration run), and keeps the shared cloud database
free of residue — the property every previous phase maintained. The
no-write e2e rule is a deliberate consequence of this phase's append-only
audit design and deletion-free scope; it is documented rather than worked
around.

## 17. Scope discipline: what this plan deliberately does not build

**Decision**: No menu/categories/items (feature 005), no tax (006), no
customer session/table selection/ordering/cart/rounds (007–008), no
kitchen/cashier operations, delivery/takeaway, billing, reports, realtime,
notifications, image storage, Edge Functions, super-admin capabilities,
subscription gating, restaurant/branch deletion or archival, table moves
between branches, staff invitation emails, or audit read/retention surfaces.
The QR is the restaurant-level entry artifact only; the customer flow behind
`/r/:slug` remains the feature-001 placeholder. No new environment variables,
no service-role keys, no tables added to the realtime publication, no new
schemas.

**Rationale**: Constitution VIII and the spec's Out of Scope section,
item by item; the plan's migration/RPC/route inventory contains nothing
outside the spec's FR-001…FR-025.

---

## Follow-up notes (not Phase 3 scope)

- Feature 007 (customer access) defines what "open" means for ordering,
  including the "no hours configured" state, and consumes `branch_working_
  hours` + `dining_tables.is_active` (FR-009/FR-012 boundaries).
- Feature 011 (bill/void/audit) designs audit reading, retention, and
  `jsonb` change payloads for the records this phase begins to produce.
- Feature 014 (super-admin/subscriptions) defines platform-driven onboarding
  and any subscription gating of the public entry point; the creation
  bootstrap here is deliberately the person-level path.
- Feature 005 (menu) introduces image storage; brand imagery stays out of the
  restaurant profile until that plan owns uploads (§33 of the master plan).
