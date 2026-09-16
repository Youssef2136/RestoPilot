---

description: "Task list for feature 004-restaurant-and-branch-management (Phase 3)"
---

# Tasks: Restaurant and Branch Management (Phase 3)

**Input**: Design documents from `/specs/004-restaurant-and-branch-management/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/database-functions.md, contracts/management-client.md, contracts/qr-entry-point.md, quickstart.md

**Tests**: Test tasks ARE included — the spec explicitly requires them (FR-022 mandates the automated matrix: the authorization denials, the validation rules, a newly added staff member's effective scope, and the audit records; SC-001–SC-007 are test-verifiable outcomes). They are deliverables of this feature, not TDD-gated feature tests; each suite lands with the layer it verifies.

**Organization**: Tasks are grouped by user story (spec.md US1–US5) so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

## Path Conventions

Single project at repository root: `src/`, `tests/`, `e2e/`, `supabase/`, `scripts/db/`, `docs/` — per plan.md Project Structure. No new top-level directories. Database work extends the feature 002/003 layout: migrations under `supabase/migrations/` (created only via `supabase migration new <name>`, applied only via `npm run db:migrate`), seed in `supabase/seed.sql` (applied via `npm run db:seed`), types regenerated via `npm run types:gen`. The frontend lands in the `src/features/management/` module (the first business feature module) with pages in `src/routes/`. The `weekday` enum, the new table, the extension, and the RPCs are database constructs — no repository directories.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean, green baseline and install the phase's one new dependency

- [X] T001 Verify the starting baseline before any Phase 3 work: `git status --short` clean; `npm run verify` exits 0 on the feature-003 state; `supabase migration list` shows all eight existing migrations under `supabase/migrations/` applied remotely with no drift. If any check fails, stop and restore the known-good state — guards FR-024 (single canonical migration workflow)
- [X] T002 Add the QR artifact dependency to `package.json`: `qrcode` in `dependencies`, `@types/qrcode` in `devDependencies` (npm install; no new scripts — `verify` stays unchanged; this is the phase's only new dependency) — FR-018, research.md §9, plan.md Technical Context

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared schema extension and the fixture source every user story consumes

**CRITICAL**: No user story work can begin until this phase is complete

**Why the schema lands here**: the plan's first three migrations extend the shared data model, and the configuration-RPC migration (T008) creates `replace_branch_working_hours` with the signature `returns setof public.branch_working_hours` — a creation-time type dependency on T006. Hoisting the three schema migrations into Foundational is what keeps User Story 1 implementable before User Story 2.

- [X] T003 [P] Extend `tests/database/helpers/fixtures.ts` with the Phase 3 fixture constants as new exports (the existing exports keep the shapes the feature 002/003 suites assert): the Blue Olive / Cedar Grill profile-settings expectations (brand description, contact email/phone, `Europe/Lisbon` / `Europe/Madrid`), the deterministic `branch_working_hours` ids and values for Downtown (Mon–Fri 11:00–15:00 + 18:00–02:00, Sat 12:00–02:00, Sun closed), Marina (Wed 12:00–18:00 + 18:00–23:00 — the boundary-touching pair; Thu–Sun 12:00–23:00) and Airport (daily 06:00–22:00) — including the split day, the post-midnight interval, and the boundary-touching pair — and the dining-table activation expectations (Marina `T1` inactive, all others active). This is the single fixture source shared by the seed tasks (T010, T021, T030) and every Phase 3 suite — FR-023, SC-007, data-model.md seed fixture table. (Fiona's constants land with her seed in T010 — `tests/integration/auth.signin.test.ts` iterates `seedCredentials`, so her fixture and her seeded identity must land together)
- [X] T004 Create `supabase/migrations/<timestamp>_restaurant_settings.sql` via `supabase migration new restaurant_settings` (research.md §14; data-model.md): `restaurants` gains `brand_description text` (nullable), `contact_email text` (nullable), `contact_phone text` (nullable), and `timezone text not null default 'UTC'`; add the blank checks `check (length(btrim(name)) > 0)` and `check (length(btrim(timezone)) > 0)` on `restaurants`, and `check (length(btrim(name)) > 0)` on `branches.name` (consumed by User Story 2's create/rename). Apply with `npm run db:migrate` — FR-002, FR-003, FR-007
- [X] T005 Create `supabase/migrations/<timestamp>_dining_table_activation.sql` via `supabase migration new dining_table_activation`: `dining_tables.is_active boolean not null default true` — the explicit persisted `active | inactive` state (no deletion path) — FR-011, FR-012, research.md §11. Apply with `npm run db:migrate`
- [X] T006 Create `supabase/migrations/<timestamp>_branch_working_hours.sql` via `supabase migration new branch_working_hours` (research.md §2–§3, §12; data-model.md): the `public.weekday` enum (`'monday' … 'sunday'`, declaration order = display and `order by` order); `create extension if not exists btree_gist with schema extensions`; the `public.branch_working_hours` table (`id uuid default gen_random_uuid()`, `restaurant_id uuid not null`, `branch_id uuid not null`, `weekday public.weekday not null`, `open_time time not null`, `close_time time not null`, the generated stored `start_minute`/`end_minute` integer offsets with the post-midnight `+1440` normalization, `created_at timestamptz not null default now()`) with the composite tenant FK `(restaurant_id, branch_id) references branches (restaurant_id, id)`, `check (open_time <> close_time)`, the minute-precision check, the `branch_working_hours_no_overlap` exclusion constraint (`branch_id with =`, `weekday with =`, `int4range(start_minute, end_minute) with &&`, schema-qualified `extensions.gist_uuid_ops` / `extensions.gist_enum_ops`), and indexes on `(restaurant_id)` / `(branch_id)`; RLS enabled, `select` granted to `authenticated`, and the one new `branch_working_hours_staff_select` policy in the wrapped `(select …)` initPlan form per the data-model.md policy matrix. Apply with `npm run db:migrate` — FR-008, FR-009, FR-025
- [X] T007 Update the declared column shapes in `tests/database/tenancy.schema.test.ts`: `restaurants` gains the four columns in ordinal order (`brand_description` text YES, `contact_email` text YES, `contact_phone` text YES, `timezone` text NO) and `dining_tables` gains `is_active` boolean NO — exactly per data-model.md (the only deliberate revision this schema extension causes to an existing suite — research.md §15). `npm run test:db` exits 0

**Checkpoint**: Foundation ready — the extended schema is migrated and the existing data-layer suites are green; user story implementation can begin

---

## Phase 3: User Story 1 — Restaurant Creation and Profile (Priority: P1) — MVP

**Goal**: A linked-profile staff member creates a restaurant and becomes its owner; owners maintain the restaurant profile (display name, customer-facing public identifier with the FR-004 warning flow, brand description, contact information) and the restaurant's timezone setting; every management action is owner-only at the data layer.

**Independent Test**: Using seeded Fiona (`fiona@restopilot.dev` — a linked profile with no memberships), create a restaurant from `/dashboard` and verify the creator holds the owner role and the restaurant appears in the dashboard as the selected context; profile/brand/settings edits persist; a public-identifier change is confirmed only after the warning that the old identifier no longer addresses this restaurant and is not retained, and cancelling leaves it unchanged; invalid or duplicate identifiers are rejected with no partial record; a non-owner or another restaurant's staff member cannot read or change anything (spec US1 Independent Test).

### Implementation for User Story 1

- [X] T008 [US1] Create `supabase/migrations/<timestamp>_management_rpcs.sql` via `supabase migration new management_rpcs` (research.md §1, §6–§10; contracts/database-functions.md): the nine configuration RPCs — `create_restaurant`, `update_restaurant_profile`, `update_restaurant_settings`, `create_branch`, `rename_branch`, `replace_branch_working_hours`, `create_dining_table`, `rename_dining_table`, `set_dining_table_active` — each `security definer`, `language plpgsql`, `set search_path = ''`, schema-qualified, authorized as its first act through `private.owned_restaurant_ids` (owner-only per FR-006; branch/table targets resolve their restaurant first — cross-tenant targets denied `42501`), validating exactly the contract's rules with the contract's `P0001` messages (slug shape/uniqueness, blank names, `pg_timezone_names`, zero-length/overlap working hours, per-branch label duplicates, idempotent activation transitions), writing exactly one `private.record_audit` record per accepted change in the same transaction (the data-model.md action vocabulary; `table.activated`/`table.deactivated` only on actual change), returning the stored rows, and granting `execute` to `authenticated` (revoked from `public`/`anon`). The plan groups the whole configuration surface in this one migration; the branch and table functions are consumed by US2/US3 (delivered in the earliest consuming story, the 002/003 convention). Apply with `npm run db:migrate` — FR-001–FR-012, FR-020
- [X] T009 [US1] Regenerate and commit types: `npm run types:gen` → `src/types/database.types.ts` now carries the added restaurant columns, the `weekday` enum, the `branch_working_hours` table, and the nine function signatures (`private` functions intentionally absent; the output must be reproducible after a full reset/rebuild) — data-model.md "Migrations and generated types" (depends on T004–T008)
- [X] T010 [US1] Extend `supabase/seed.sql` (idempotent; ids identical to `tests/database/helpers/fixtures.ts`): the restaurant profile/settings values for Blue Olive (brand description, contact email/phone, `Europe/Lisbon`) and Cedar Grill (brand description, contact email/phone, `Europe/Madrid`) applied with `on conflict (id) do update` for the new columns only (`name`/`slug` keep their `do nothing` semantics), and **Fiona** (`fiona@restopilot.dev` / `dev-fiona-2026`) — the identity per the feature-003 insert contract plus a linked profile with **no memberships** (the creation-bootstrap fixture, distinct from the modeled-only super admin). Update `tests/database/helpers/fixtures.ts` in the same task so `seedProfiles` and `seedCredentials` gain Fiona. Apply with `npm run db:seed` — FR-023, SC-007, research.md §15
- [X] T011 [US1] Create `src/features/management/managementClient.ts` — the single client module for the management RPCs (pages import it, never `supabase.rpc` directly): typed wrappers for the nine configuration operations returning `{ ok: true, data }` / `{ ok: false, message }`, with error mapping (`42501` ⇒ the module's generic denial message; `P0001` ⇒ the server message verbatim; anything else ⇒ a generic retry message) and no authorization logic, no retries, no optimistic writes — contracts/management-client.md §1/§5 (the three staff wrappers land with T036) — FR-002, FR-004, FR-005
- [X] T012 [P] [US1] Extend `src/features/auth/useAuthContext.ts` with the `canManageRestaurant(restaurantId)` predicate (true for an `owner` membership of that restaurant) — the presentation gate for management controls and pages; it grants nothing (Constitution IV) — contracts/management-client.md §3, FR-017
- [X] T013 [P] [US1] Extend `src/features/auth/guards.tsx` with `RequireProfile`: wraps `RequireAuth`; while the context resolves renders nothing; on a failed context query or with `profile === null` renders `NotAuthorized` — the unlinked-identity denial stays exactly as feature 003 defined it — contracts/management-client.md §2/§3, FR-017
- [X] T014 [US1] Extend `src/routes/DashboardPage.tsx`: with a linked profile and no memberships, render the create-restaurant panel (display name, public identifier, optional brand description/contact, timezone pre-filled from the browser via `Intl.supportedValuesOf('timeZone')`); on success refresh the auth context so the new restaurant appears as the selected context; with memberships, add owner management navigation and branch links per scope (presentation only) — FR-001, FR-017, contracts/management-client.md §4.6
- [X] T015 [US1] Create `src/routes/ManageRestaurantPage.tsx` — the selected restaurant's profile form (display name, brand description, contact email/phone, and the public identifier with the FR-004 flow: when the submitted identifier differs from the stored one, show the warning that the old identifier no longer addresses this restaurant and is not retained (no alias/redirect/history) and continue only after explicit confirmation; cancelling leaves the identifier unchanged; after a confirmed change show the new public entry URL) and the settings form (timezone); non-owners render `NotAuthorized` (in-page owner gate) — FR-002, FR-003, FR-004, contracts/management-client.md §2/§4.1 (the QR panel mounts here with T043)
- [X] T016 [US1] Rewire the route surface in `src/app/router.tsx`: the `/dashboard` guard is revised from `RequireStaff` to `RequireProfile` (the only revision to feature 003's route contract — required by FR-001's bootstrap) and `/dashboard/restaurant` is added behind `RequireStaff` with the in-page owner gate; `/dashboard/profile` and `/dashboard/staff` unchanged; unlinked identities still land on `NotAuthorized` — contracts/management-client.md §2 (the branch routes land with T027)
- [X] T017 [US1] Create `tests/unit/management.client.test.ts` — the wrapper's error mapping and result shaping: `42501` ⇒ the generic denial message, `P0001` ⇒ the server's message verbatim, unexpected errors ⇒ the retry message, success ⇒ `{ ok: true, data }`; no raw database error ever reaches the caller — FR-022, contracts/management-client.md §1/§5; `npm run test:unit` exits 0 (depends on T011)
- [X] T018 [US1] Update `tests/unit/auth.guards.test.tsx` with the Phase 3 cases: `RequireProfile` admits a linked profile with no memberships and denies an unlinked identity; the `canManageRestaurant` truth table (owner true; branch manager, cashier, kitchen, other restaurant, and super admin false); the `/dashboard` bootstrap-panel case for a membership-less profile — the existing guard cases must keep passing (the revised route is the only feature-003 route change) — FR-017, research.md §13; `npm run test:unit` exits 0 (depends on T012–T014)
- [X] T019 [US1] Create `tests/database/management.rpc.test.ts` with the restaurant section (the suite is extended by US2's and US3's tasks), using the identity-simulation helpers in `tests/database/helpers/db.ts` inside rolled-back transactions: the creation bootstrap (any caller with a linked profile; an identity without one denied) and the creator's owner membership; the owner-only authorization matrix for `update_restaurant_profile` / `update_restaurant_settings` (branch manager, cashier, kitchen, other restaurant, anon, and the super admin all denied `42501`, no state change); the validation rules (blank name, malformed slug, duplicate slug, unknown timezone, empty optional fields ⇒ `NULL`) with nothing created on rejection; the FR-004 identifier-change semantics (accepted; no alias or history; uniqueness backstop); and the audit records `restaurant.created` / `restaurant.profile_updated` / `restaurant.settings_updated` with actor, action, resource, and tenant scope — FR-001, FR-004, FR-005, FR-020, FR-022, SC-002/SC-003/SC-006; `npm run test:db` exits 0 (depends on T008, T010)
- [X] T020 [US1] Create `e2e/management.surfaces.test.ts` (research.md §16; read-and-reject only — this suite creates no tenant data): Fiona's `/dashboard` renders the creation panel with no other tenant's data; the owner (Alice) reaches the management navigation and `/dashboard/restaurant`; the FR-004 warning appears before confirming an identifier change and cancelling leaves the identifier unchanged; a non-owner (branch manager or cashier) and the super admin are rejected on management deep links (`NotAuthorized` — rejected, not hidden, FR-021: the capability grants no tenant access) — FR-004, FR-005, FR-006, FR-017, FR-021; `npm run test:e2e` exits 0 (depends on T014–T016, T010)

**Checkpoint**: MVP delivered — a membership-less profile creates a restaurant and becomes its owner; the owner manages the profile and settings with the identifier warning flow; the route revision is proven in unit and browser tests

---

## Phase 4: User Story 2 — Branch Management and Working Hours (Priority: P2)

**Goal**: Under the restaurant, the owner creates and renames branches and maintains each branch's weekly working hours — zero or more intervals per day, split days, post-midnight intervals, closed days — with declarative same-day overlap rejection; branch-scoped members see exactly their branch.

**Independent Test**: With a seeded owner, create a branch, rename it, and define a weekly schedule including a split day, an 18:00–02:00 interval, and a closed day; verify persistence, that zero-length and same-day-overlapping schedules are rejected with the stored schedule unchanged while a boundary-touching pair saves, and that a branch-scoped member of another branch cannot reach or change the branch (spec US2 Independent Test).

### Implementation for User Story 2

- [X] T021 [US2] Extend `supabase/seed.sql` with the branch working-hours fixture (deterministic UUIDs matching `tests/database/helpers/fixtures.ts`; idempotent): Downtown Mon–Fri 11:00–15:00 + 18:00–02:00 (split day + post-midnight), Sat 12:00–02:00, Sun closed; Marina Wed 12:00–18:00 + 18:00–23:00 (the boundary-touching pair — accepted, not an overlap), Thu–Sun 12:00–23:00; Airport daily 06:00–22:00. Apply with `npm run db:seed` — FR-023, SC-007, research.md §15, data-model.md
- [X] T022 [US2] Extend `scripts/db/seed.mjs`: the fixture summary gains the working-hours count alongside the existing tenancy and auth-identity lines — plan.md Project Structure (`scripts/db/reset.mjs` needs no change: `db:reset` reapplies migrations + seed, and its `--purge-auth` purge is pattern-based) (depends on T021)
- [X] T023 [P] [US2] Create `src/features/management/workingHours.ts` — the pure helpers shared by the editor and the branch view: weekday order/labels from the `weekday` enum, `HH:MM` normalization (the database returns `time` as `HH:MM:SS`), `closesNextDay(open, close)` (`close < open`), and the `{weekday, open_time, close_time}[]` ⇄ editor-state conversions. No validation rules — zero-length/overlap rejection is the server's (`replace_branch_working_hours`); the editor surfaces the returned message — contracts/management-client.md §1, FR-008
- [X] T024 [US2] Create `src/features/management/components/WorkingHoursEditor.tsx` — the weekly schedule editor (per-weekday interval rows; save submits the whole schedule through `managementClient`; a server rejection surfaces the returned clear message and leaves the editor state and the stored schedule intact — the page re-reads) — FR-008, FR-009, contracts/management-client.md §1/§4.2
- [X] T025 [P] [US2] Create `src/routes/BranchesPage.tsx` — the selected restaurant's policy-scoped branch list (branch-scoped members see their assigned branch only); owner-only create and rename affordances gated by `canManageRestaurant`; non-owner deep links are rejected, not hidden; duplicate display names remain allowed — FR-007, FR-017, contracts/management-client.md §2/§4.5
- [X] T026 [US2] Create `src/routes/BranchDetailPage.tsx` — the branch view: the branch name and its working hours (schedule display via `workingHours.ts`; owner-only `WorkingHoursEditor`; a day with no intervals reads as closed, a branch with no rows as "no hours configured"); a branch id outside the caller's scope renders the empty denial state without echoing the requested identity — FR-008, FR-009, FR-017, contracts/management-client.md §2 (the tables section lands with T031)
- [X] T027 [US2] Extend `src/app/router.tsx` with `/dashboard/branches` and `/dashboard/branches/:branchId`, both behind `RequireStaff` with policy-scoped reads — contracts/management-client.md §2
- [X] T028 [US2] Extend `tests/database/management.rpc.test.ts` with the branch section: the authorization matrix for `create_branch` / `rename_branch` / `replace_branch_working_hours` (non-owner, other restaurant, other branch, anon, super admin ⇒ `42501`); blank-name rejection; duplicate branch display names remain allowed; the working-hours semantics — the split day persists, an 18:00–02:00 interval stores under its start day with `end_minute >= 1440`, a boundary-touching pair (10:00–14:00 + 14:00–18:00) is accepted, a zero-length interval and a same-day overlap are rejected with the stored schedule unchanged (all-or-nothing), an empty array clears the schedule, and rows under different weekdays are not rejected (research.md §3); the exclusion constraint as backstop for a direct insert; the audit records `branch.created` / `branch.renamed` / `branch.working_hours_updated` with branch scope; and the new read surface's scope (the owner sees every branch's hours, a branch-scoped member their own branch only, other tenants nothing) — FR-007, FR-008, FR-009, FR-020, FR-025, SC-002/SC-003/SC-006; `npm run test:db` exits 0 (depends on T008, T021)
- [X] T029 [US2] Extend `e2e/management.surfaces.test.ts`: Bob (branch manager, Downtown) sees his own branch's working hours and no management affordances; a working-hours save the server rejects surfaces the clear message with the stored schedule unchanged; branch management deep links by non-owners render `NotAuthorized` — FR-006, FR-008, FR-017; `npm run test:e2e` exits 0 (depends on T024, T026, T027, T021)

**Checkpoint**: User Stories 1 and 2 both work independently — the restaurant and its branches with working hours are owner-manageable and scope-proven

---

## Phase 5: User Story 3 — Table Management (Priority: P3)

**Goal**: The owner maintains each branch's physical tables — create in a chosen branch, rename/renumber (including while inactive), deactivate/reactivate — explicit persisted state, never deleted, with labels unique within a branch and the same label allowed in another branch.

**Independent Test**: With a seeded owner and branch, create tables, exercise renaming and the activation transitions, and verify per-branch label uniqueness, cross-branch independence, and denial for unauthorized actors and other branches (spec US3 Independent Test).

### Implementation for User Story 3

- [X] T030 [US3] Extend `supabase/seed.sql`: Marina `T1` inactive (converge the seeded table rows with `on conflict (id) do update set is_active = excluded.is_active`, so an existing database converges without a reset), all other seeded tables active. Apply with `npm run db:seed` — FR-023, SC-007, research.md §15
- [X] T031 [P] [US3] Extend `src/routes/BranchDetailPage.tsx` with the tables section: the branch's tables list (label plus explicit state; inactive tables stay visible with their state and are never deleted) and the owner-only create/rename/activate/deactivate affordances through `managementClient`, gated by `canManageRestaurant` — FR-010, FR-011, FR-012, FR-017, contracts/management-client.md §2/§4.4
- [X] T032 [US3] Extend `tests/database/management.rpc.test.ts` with the table section: the authorization matrix for `create_dining_table` / `rename_dining_table` / `set_dining_table_active` (non-owner, other branch, anon, super admin ⇒ `42501`); blank-label rejection; per-branch label uniqueness (duplicate rejected; the same label in another branch accepted); rename accepted while inactive with the state unchanged; repeated transitions are no-ops that leave consistent state and write no audit record (change-detected); `is_active` defaults true on creation and no delete path exists; the audit records `table.created` / `table.renamed` / `table.activated` / `table.deactivated` with branch scope; and the seeded inactive table reads as inactive through the policies — FR-010, FR-011, FR-012, FR-020, SC-003/SC-006; `npm run test:db` exits 0 (depends on T008, T030)
- [X] T033 [US3] Extend `e2e/management.surfaces.test.ts`: the owner sees the branch's tables including the seeded inactive table with its state and the management affordances; non-owners see the list only where the policy grants it and no manage affordances — FR-011, FR-017; `npm run test:e2e` exits 0 (depends on T031, T030)

**Checkpoint**: User Stories 1–3 all work independently — restaurant, branches/hours, and tables are owner-manageable and scope-proven

---

## Phase 6: User Story 4 — Staff Assignment (Priority: P4)

**Goal**: The owner builds the team — adds a person by email and display name with exactly one role (owner, branch manager, cashier, kitchen) and, for branch-scoped roles, exactly one branch; changes role/branch; removes a membership; the restaurant always keeps at least one owner; every access-control change is audited; the added person signs in and lands in exactly their scoped dashboard.

**Independent Test**: As an owner, add a person for each role; sign in as each added person and verify the scoped dashboard; change a role or branch and verify effective access changes on the next access; remove a membership and verify access ends while the person persists; attempt to remove or demote the last owner and verify rejection; verify the audit records (spec US4 Independent Test).

### Implementation for User Story 4

- [X] T034 [US4] Create `supabase/migrations/<timestamp>_staff_management_rpcs.sql` via `supabase migration new staff_management_rpcs` (research.md §4–§6; contracts/database-functions.md; data-model.md staff provisioning entity): first `private.provision_staff_identity(p_email, p_display_name)` — `language plpgsql, volatile, security definer, set search_path = ''`, execute granted to the owner role only — inserting the `auth.users` + `auth.identities` row shape feature 003 verified live (runtime `gen_random_uuid()` id, `email_confirmed_at = now()`, the five token columns as empty strings, `raw_app_meta_data` email provider) plus the linked `profiles` row in the same transaction, with the server-generated one-time temporary credential `encode(gen_random_bytes(12), 'hex')` hashed via `crypt(…, gen_salt('bf', 10))`; then `add_staff_member`, `update_staff_membership`, `remove_staff_membership` — owner-only via `private.owned_restaurant_ids`, the role/branch consistency rules (owner ⇒ no branch; branch-scoped roles ⇒ a branch of this restaurant), the exact-duplicate rejection, the FR-016 last-owner safeguard serialized by a restaurant row lock (`for update`), the FR-014 linking rules (existing person linked by email, no duplicate, no display-name overwrite; an unclaimed stub gains a profile and a re-issued credential; a linked person's credential never touched), `private.record_audit` in the same transaction (`staff.added` / `staff.updated` / `staff.removed`, branch scope where applicable), the contract's return shapes (`{ membership, profile_id, person_created, temporary_password }`, credential `null` unless issued), and `grant execute … to authenticated` (revoked from `public`/`anon`). Apply with `npm run db:migrate` — FR-013–FR-016, FR-020
- [X] T035 [US4] Regenerate and commit types: `npm run types:gen` → `src/types/database.types.ts` now carries the twelve public function signatures (the `private.provision_staff_identity` helper intentionally absent) — data-model.md "Migrations and generated types" (depends on T034)
- [X] T036 [US4] Extend `src/features/management/managementClient.ts` with the three staff wrappers — `add_staff_member` (returns the membership, `profile_id`, `person_created`, and `temporary_password | null`), `update_staff_membership`, `remove_staff_membership` — the same result shape and error mapping as the configuration wrappers; the credential is never logged or persisted — contracts/management-client.md §1/§4.3, FR-013/FR-014/FR-015 (depends on T035)
- [X] T037 [US4] Create `src/features/management/components/StaffManagementPanel.tsx` — the owner-only controls rendered by the staff page: add member (email, display name, role, branch — required for the three branch-scoped roles), change role/branch, remove membership, and the one-time temporary-credential display with a copy affordance and the plain-language note (share it with the person; it is not shown again and can be rotated through the platform's password-recovery flow); the outcome message keys off the return shape — `temporary_password === null` ⇒ existing person linked, no credential issued; non-null `temporary_password` with `person_created === false` ⇒ the existing person's account was completed and a new temporary credential was issued — FR-013, FR-014, FR-015, contracts/management-client.md §1/§4.3
- [X] T038 [US4] Extend `src/routes/StaffListPage.tsx`: mount the owner-only `StaffManagementPanel` (gated by `canManageRestaurant`) on the existing policy-scoped read surface; branch managers keep read access but see no management controls (FR-025 preserved) — FR-017, FR-025, contracts/management-client.md §2
- [X] T039 [US4] Create `tests/database/staff.management.test.ts`, using the identity-simulation helpers inside rolled-back transactions: provisioning and linking — a new email creates identity + profile + membership and returns a one-time credential (stored only as a bcrypt hash), an existing linked person is linked with no credential and no `display_name` overwrite, an unclaimed stub gains a profile and a re-issued credential; the role/branch rules (owner with a branch rejected; a branch-scoped role without a branch, or with another restaurant's branch, rejected; exact duplicate rejected; a distinct role or branch remains valid; multi-membership in several restaurants allowed); the last-owner safeguard for both removal and demotion with the restaurant still holding its owner after rejection; removal ends access while the person (identity and profile) persists; the authorization matrix (non-owner, other restaurant, anon, super admin ⇒ `42501`); and the audit records with actor, action, resource, tenant scope, and branch scope where applicable — FR-013–FR-016, FR-020, FR-022, SC-002/SC-003/SC-006; `npm run test:db` exits 0 (depends on T034)
- [X] T040 [US4] Create `tests/integration/management.provisioning.test.ts` — the exit-condition round trip over the real APIs: Alice (owner) provisions a person through `add_staff_member` via the real data API; the returned temporary credential signs in through the real Auth API; `current_auth_context` resolves exactly the assigned scope; out-of-scope reads are denied through the real client; scratch teardown in `afterAll` removes the membership, profile, identity, and scratch audit rows through the owner connection (the existing scratch-identity pattern — no residue; note the added Auth sign-in per run — leave ≥ 60 s between consecutive `test:integration` runs per quickstart.md §2) — FR-013, FR-014, FR-017, SC-004; `npm run test:integration` exits 0 (depends on T034)

**Checkpoint**: User Stories 1–4 all work independently — the team is manageable end to end and a newly added person lands in exactly their scoped dashboard

---

## Phase 7: User Story 5 — Restaurant-Level QR Entry Point (Priority: P5)

**Goal**: The owner obtains the restaurant's V1 customer entry point — one restaurant-level QR encoding the public entry URL (`{origin}/r/{slug}`), viewable and downloadable (SVG and PNG), encoding no branch or table information, always derived from the current public identifier.

**Independent Test**: As an owner, obtain the QR; verify the payload resolves to the restaurant's public entry URL and carries no branch or table information; verify a non-owner cannot obtain it; verify the artifact is stable across downloads while the identifier is unchanged, and that after an identifier change a newly obtained QR encodes the new URL (spec US5 Independent Test).

### Implementation for User Story 5

- [X] T041 [P] [US5] Create `src/features/management/qrEntry.ts` — `buildRestaurantEntryUrl(origin, slug)` returning exactly `` `${origin}/r/${slug}` `` (feature 001's public route; the origin is `window.location.origin` at render time — no configuration value, no new environment variable), SVG generation (`qrcode` `toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })`) and PNG data-URL generation (`toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 1024 })`); the payload builder is exported separately so tests and the UI assert the exact string; nothing caches or stores the payload — contracts/qr-entry-point.md §1–§2, FR-018, FR-019
- [X] T042 [US5] Create `src/features/management/components/RestaurantQrPanel.tsx` — the owner-only panel: renders the payload as visible text next to the code (so the target is verifiable without decoding), the in-page code, and the SVG + PNG download affordances, all re-derived from the restaurant's current slug on every render (no caching, no server-side artifact, no Storage) — contracts/qr-entry-point.md §2–§3, FR-018
- [X] T043 [US5] Extend `src/routes/ManageRestaurantPage.tsx` to mount `RestaurantQrPanel` inside the owner gate; after a confirmed identifier change the page shows the new public entry URL and the panel re-derives from the new slug (re-download available) — the FR-004 consequence exactly as specified, with no redirect or alias — FR-004, FR-018, contracts/management-client.md §4.1 (depends on T042)
- [X] T044 [US5] Create `tests/unit/management.qr.test.ts` — the payload builder pinned for representative slugs/origins (the exact `origin/r/<slug>` string; no branch or table segment possible), generation smoke-tested to return a non-empty SVG and PNG data URL for the same payload, stability while the slug is unchanged, and currency after an identifier change (a re-derived payload encodes the new slug) — FR-018, SC-005, contracts/qr-entry-point.md §4–§5; `npm run test:unit` exits 0 (depends on T041)
- [X] T045 [US5] Extend `e2e/management.surfaces.test.ts`: the QR panel renders for the owner with the payload text visible (encoding the seeded `blue-olive` public entry URL) and is absent for non-owners and the super admin (the restaurant row is not readable to them) — FR-018, FR-019, SC-005; `npm run test:e2e` exits 0 (depends on T043)

**Checkpoint**: All five stories complete — the owner's full setup journey (restaurant, branch, hours, tables, staff, QR) is delivered and the QR targets the current public entry URL

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, determinism proof, boundary audit, and documentation of everything the stories built

- [X] T046 [P] Extend `docs/development.md`: the Phase 3 management suites (what `npm run test:db`'s management and staff matrices, `npm run test:integration`'s provisioning round trip, the unit suites, and the e2e presentation matrix cover), the provisioning + one-time-credential runbook step (including the post-reset re-add/re-issue note in quickstart.md §6), and the no-write e2e rule — plan.md Project Structure
- [X] T047 Reset-and-rebuild determinism (quickstart.md §6; feature 002 FR-016 posture, FR-023/FR-024): `npm run db:reset` (destructive, development project only) → `npm run test:db` green; `npm run types:gen` output byte-identical to the committed `src/types/database.types.ts` — SC-007
- [X] T048 Full quality gate from a clean state: `npm run verify` (format:check → lint → typecheck → test:unit → test:db → test:integration → build) **and** `npm run test:e2e` both exit 0 with the extended suites (`package.json` unchanged apart from T002's `qrcode` dependencies) — SC-001–SC-007 evidence (depends on T047)
- [X] T049 [P] Constraint & boundary audit across the Phase 3 diff (`package.json`, `supabase/migrations/`, `supabase/seed.sql`, `src/features/management/`, `src/app/router.tsx`, `src/features/auth/`): no service-role or secret keys anywhere (the provisioning path uses none; tests and the seed use only `SUPABASE_DB_URL`); no new environment variables; no client write grants added (the grants posture is unchanged — the management RPCs are the only write paths); guards and in-page gates presentation-only (Constitution IV); `auth.*` written only by `supabase/seed.sql` and the one private provisioning helper; no scope creep (no menu/tax/session/ordering/kitchen/cashier/delivery/billing/reporting/realtime/super-admin work); every spec FR-001–FR-025 maps to at least one task — audit record in the Notes section below
- [X] T050 Run the quickstart.md walkthroughs and record the results: Walkthrough A — the owner's full journey as Fiona in one session, well under 15 minutes (SC-001, the exit condition); Walkthrough B — the scope/denial matrix for Bob, Carla, Dan, Eve, the Platform Admin, and Fiona; Walkthrough C — working state authoritative, audit records exist and stay unreadable, nothing new is public; plus the QR decode with a phone camera or scanner including the post-identifier-change round — SC-005/SC-007 manual evidence; restore the development project with `npm run db:reset`; append the validation record to `specs/004-restaurant-and-branch-management/quickstart.md`
- [ ] T051 Final commit and push of all Phase 3 artifacts (the five migrations under `supabase/migrations/`, `supabase/seed.sql` + `scripts/db/seed.mjs`, the `src/features/management/` module, the route files, the auth-module edits, regenerated `src/types/database.types.ts`, the test suites, `docs/development.md`, and the spec artifacts) to GitHub `main` — mirrors feature 002 T018 / 003 T039 (depends on T048–T050)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 is a gate: if the baseline is not green, stop.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (the schema extension and the fixture source every story's tasks consume). The three migrations are applied sequentially through the one canonical workflow, then T007 restores the data-layer suite to green.
- **US1 (Phase 3)**: Depends on Foundational — T008 → T009; T010 may proceed alongside T011/T012/T013 (different files); T014 and T015 after T011–T013; T016 after T014/T015; T017/T018/T019 after the code and seed they exercise; T020 last (its Fiona creation-panel check needs T010's seed).
- **US2 (Phase 4)**: Depends on US1 (the configuration RPCs and client from T008/T011; the dashboard/route surface from T014–T016) — T021 → T022; T023 → T024 → T026; T025 → T027; T028 after T021; T029 after T027 and T021 (the seeded working hours it asserts).
- **US3 (Phase 5)**: Depends on US2 (branches and the branch view T026) — T030 → T032; T031 → T033 (the seeded inactive table comes from T030).
- **US4 (Phase 6)**: Depends on US2 (branch-scoped roles need branches); proceeds after US3 in priority order — T034 → T035 → T036 → T037 → T038; T039 and T040 after T034.
- **US5 (Phase 7)**: Depends on US1 only (the public identifier and the restaurant page T015) — T041 → T042 → T043 → T045 (and T044 after T041). Blocks nothing else; prioritized last by the spec.
- **Polish (Phase 8)**: Depends on all user stories — T046 ∥ T047 → T048 → T049 and T050 in either order → T051.

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories (MVP).
- **US2 (P2)**: After US1 — creates branches under the restaurant US1 delivers; requires T008's branch RPCs.
- **US3 (P3)**: After US2 — tables belong to US2's branches; the branch view is US2's page.
- **US4 (P4)**: After US2 — branch-scoped roles need branches to assign; also rides the US1 dashboard and route surface.
- **US5 (P5)**: After US1 — needs the restaurant's public identifier; blocks nothing else.

### Within Each User Story

- Migrations only via `supabase migration new <name>` and `npm run db:migrate`; seed only via `npm run db:seed`; types only via `npm run types:gen` (FR-024)
- Schema/migrations before RPCs; RPCs before the client module; the client before pages; pages before the suites that exercise them
- Each story's suites are green before the story's checkpoint

### Parallel Opportunities

- **Foundational**: T003 (the fixture source) may proceed alongside the migration batch.
- **US1**: T012 ∥ T013 (different files, no dependencies); T017/T018/T019 are three different suites.
- **US2**: T023 ∥ T025 (different files).
- **US3**: T031 may start immediately in the phase.
- **US5**: T041 starts the phase.
- **Polish**: T046 ∥ T049.
- Once US1 is complete, US5 can proceed in parallel with US2 → US3 → US4 by a second implementer; after US2, US3 and US4 are independent of each other.

---

## Parallel Example: User Story 2

```bash
# The working-hours helpers and the branch list page are independent files:
Task: "Create src/features/management/workingHours.ts (weekday labels, HH:MM normalization, closesNextDay, conversions)"   # T023
Task: "Create src/routes/BranchesPage.tsx (policy-scoped list; owner-only create/rename)"                                 # T025

# US1's two independent auth-module edits:
Task: "Extend src/features/auth/useAuthContext.ts with canManageRestaurant"   # T012
Task: "Extend src/features/auth/guards.tsx with RequireProfile"               # T013
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T007) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T008–T020)
4. **STOP and VALIDATE**: `npm run test:db`, `npm run test:unit`, and `npm run test:e2e` green; walk the dashboard journey as Fiona (create → profile → settings → identifier warning)
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → the extended schema and fixture source are ready
2. US1 → restaurant creation + profile/settings (MVP — the exit condition's first half)
3. US2 → branches + working hours (the operational boundary)
4. US3 → tables (the customer-entry anchor)
5. US4 → staff assignment (a person signs in to exactly their scope — the exit condition's "correct scoped dashboard")
6. US5 → the restaurant-level QR entry point
7. Polish → determinism proof, full gate, boundary audit, quickstart walkthroughs, commit

### Single-Implementer Order

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 ∥ T011 → T012 ∥ T013 → T014 → T015 → T016 → T017 ∥ T018 ∥ T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028 ∥ T029 → T030 → T031 → T032 → T033 → T034 → T035 → T036 → T037 → T038 → T039 ∥ T040 → T041 → T042 → T043 → T044 ∥ T045 → T046 ∥ T047 → T048 → T049 ∥ T050 → T051

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Migrations are created only via `supabase migration new <name>` and applied only via `npm run db:migrate`; the seed only via `npm run db:seed`; types only via `npm run types:gen` — the single canonical workflow (FR-024). Never edit an applied migration; add a new one
- No client write grants exist anywhere; the twelve `security definer` management RPCs are the only write paths, and they are the authorization boundary — guards, predicates, and pages are presentation only (Constitution IV)
- The e2e suite is read-and-reject only: it creates no tenant data (deletes are not part of this phase, and audit records deliberately anchor created rows) — research.md §16. Creation journeys are proven by the database and integration suites plus quickstart Walkthrough A
- Audit records are produced by `private.record_audit` inside the RPCs and are write-only for clients this phase (FR-020); suites assert them through the database connection, never through a client path
- The one new runtime dependency is `qrcode` (+ `@types/qrcode`); no new environment variables; no service-role or secret keys anywhere (the provisioning path deliberately avoids them — research.md §4/§9); no email is sent by the application
- `scripts/db/reset.mjs` needs no change: `db:reset` reapplies migrations + seed, and its `--purge-auth` purge is pattern-based (`%@restopilot.dev`), covering the new seeded identity automatically
- Commit after each task or logical group; stop at any checkpoint to validate the story independently
- **T049 audit record (2026-09-16)** — the constraint & boundary audit over the Phase 3 diff (`package.json`, `supabase/migrations/`, `supabase/seed.sql`, `scripts/db/seed.mjs`, `src/features/management/`, `src/app/router.tsx`, `src/features/auth/`, the route files, the test suites, `docs/development.md`):
  - **No service-role or secret keys anywhere.** The only `service_role` occurrences in the repository are the pre-existing schema-usage grant in `scripts/db/reset.mjs` and a comment in `supabase/config.toml`; the provisioning path uses none. Tests and the seed use `SUPABASE_DB_URL` only.
  - **No new environment variables.** The application references exactly the four keys in `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`); the two other `SUPABASE_AUTH_*` names found live only inside `supabase/config.toml` (the CLI's local template, untouched).
  - **No client write grants added.** No `grant insert/update/delete/all` on any table exists in the migrations; the only grants added are `grant execute` on the three staff RPCs. The twelve `security definer` management RPCs remain the only write paths.
  - **Exactly one new RLS policy** (`branch_working_hours_staff_select`); no policy or grant reads `is_super_admin`.
  - **`auth.*` is written only by `supabase/seed.sql` and `private.provision_staff_identity`** — machine-checked across every migration (the only other `auth.*` statements in the repository are those two).
  - **Guards and in-page gates are presentation-only** — the RPCs authorize as their first act; the denial paths are proven at the data layer by the db suites and through the real APIs by the integration suite, not by the UI.
  - **No scope creep.** The change set contains no menu, tax, session, ordering, cart, round, kitchen, delivery, bill, reporting, realtime, subscription, or super-admin work.
  - **Requirement coverage**: all 25 FRs (FR-001–FR-025) and all 7 SCs are referenced by at least one task.
  - **Observed during the audit (recorded, not a Phase 3 gap)**: one intermittent failure of the pre-existing `tenancy.rls.test.ts` / `auth.rbac.test.ts` matrices was seen once in five `test:db` runs (signature: an RLS-filtered read returning every row, i.e. the session's role/claims not applying). Four subsequent runs — including a full `db:reset`-then-suite run — were green (134/134), and no session-scoped role leak exists in the test helpers. It is a shared-database test-infrastructure flake affecting feature 002/003 suites, not this feature's code; it deserves its own investigation.
