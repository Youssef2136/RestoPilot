---

description: "Task list for feature 003-auth-and-rbac (Phase 2)"
---

# Tasks: Auth and RBAC (Phase 2)

**Input**: Design documents from `/specs/003-auth-and-rbac/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/supabase-auth-surface.md, contracts/auth-client.md, contracts/database-functions.md, quickstart.md

**Tests**: Test tasks ARE included — the spec explicitly requires them (FR-020 mandates the extended automated security matrix with real authenticated sign-ins; SC-001–SC-007 are test-verifiable outcomes). They are deliverables of this feature, not TDD-gated feature tests; each suite lands with the layer it verifies.

**Organization**: Tasks are grouped by user story (spec.md US1–US5) so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

## Path Conventions

Single project at repository root: `src/`, `tests/`, `e2e/`, `supabase/`, `scripts/db/`, `docs/` — per plan.md Project Structure. All new work lands in the existing Phase 0–1 layout; the auth feature module under `src/features/auth/` is the first consumer of the reserved `features/` directory; no new top-level directories. The `auth` schema is platform-managed (not a repository directory): only `supabase/seed.sql` (and the documented scratch-identity test pattern) writes to `auth.users`/`auth.identities`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean, green baseline before identity work begins

- [X] T001 Verify the starting baseline: `git status` clean (on `main` synced with `origin/main`, or on the `003-auth-and-rbac` feature branch created from it); `npm run verify` exits 0; `supabase migration list` shows all five Phase 0–1 migrations applied remotely (local = remote, no drift). If any check fails, stop and restore the known-good state before any Phase 2 work — guards FR-023 (single canonical workflow)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared fixture source every user story's seed and test task depends on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Extend `tests/database/helpers/fixtures.ts` with the six seeded sign-in credentials per the data-model.md seed table — the emails `alice@restopilot.dev`, `bob@restopilot.dev`, `carla@restopilot.dev`, `dan@restopilot.dev`, `eve@restopilot.dev`, `platform-admin@restopilot.dev` mapped to the existing `authUserIds` (…2001–…2006) plus the documented dev passwords (`dev-alice-2026` … `dev-platform-admin-2026`) — the single credential source shared by the seed task (T004) and every Phase 2 test suite — FR-021, SC-007

**Checkpoint**: Fixture source ready — user story implementation can begin

---

## Phase 3: User Story 1 — Staff Sign-In and Role Mapping (Priority: P1) — MVP

**Goal**: Every seeded staff identity is a real, login-capable platform identity linked one-to-one (and data-layer-enforced) to its Phase 1 profile; sign-in, credential rejection, and role/scope resolution are proven through the real Auth API.

**Independent Test**: `npm run test:integration` is green: all six fixture identities sign in; each resolved scope matches the seeded membership matrix exactly; wrong-password and unknown-account attempts are rejected indistinguishably; an unlinked identity authenticates but reads nothing (spec US1 Independent Test).

### Implementation for User Story 1

- [X] T003 [US1] Create `supabase/migrations/<timestamp>_staff_identity_linkage.sql` via `supabase migration new staff_identity_linkage` (research.md §5): first the orphan-clearing pre-step — `update public.profiles set auth_user_id = null where auth_user_id is not null and not exists (select 1 from auth.users u where u.id = public.profiles.auth_user_id)` (nulls feature 002's synthetic ids so the FK validates on the existing database and `db:migrate` stays a valid path) — then add the foreign key `profiles_auth_user_id_fkey`: `foreign key (auth_user_id) references auth.users(id)` with the default `no action` (no cascade — deleting an identity a profile still links to fails loudly; only the platform table's primary key is referenced). Apply with `npm run db:migrate` — FR-003, Constitution VI
- [X] T004 [US1] Extend `supabase/seed.sql` with the six deterministic auth identities per contracts/supabase-auth-surface.md, every load-bearing column verbatim: `auth.users` rows with `id` = the existing deterministic UUIDs (identical to `tests/database/helpers/fixtures.ts` `authUserIds`), `instance_id = '00000000-0000-0000-0000-000000000000'`, `aud`/`role` = `'authenticated'`, `email = '<name>@restopilot.dev'`, `encrypted_password = crypt('<documented dev password>', gen_salt('bf', 10))` (pgcrypto bcrypt, cost 10), `email_confirmed_at` set, the five token columns (`confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`, `email_change_token_current`) as empty strings `''` — never NULL, `raw_app_meta_data = {"provider":"email","providers":["email"]}`, `on conflict (id) do nothing`; one `auth.identities` row per identity (`provider = 'email'`, `provider_id = user_id`, `identity_data = {"sub","email","email_verified":true}`, deterministic `id = user_id`, `on conflict (id) do nothing`); identities inserted BEFORE the profiles block (the FK requires the identity to exist); the profiles upsert gains `on conflict (id) do update set auth_user_id = excluded.auth_user_id` to re-establish linkage on re-runs. Idempotent; identities survive `db:reset` (the auth schema is untouched). Apply with `npm run db:seed` — FR-021, research.md §1–§4
- [X] T005 [P] [US1] Extend `scripts/db/seed.mjs` to report the seeded auth identities alongside the existing tenancy-fixture summary (count + emails of the `@restopilot.dev` users in `auth.users`) — FR-021 (depends on T004)
- [X] T006 [P] [US1] Extend `scripts/db/reset.mjs` with the optional `--purge-auth` flag: after the schema drop and before migrate+seed, delete the six `@restopilot.dev` users from `auth.users` — the scripted credential-restore runbook (auth data survives ordinary resets, so a manually changed password is otherwise never restored); document the flag in the script header — FR-021, research.md §4 (depends on T004)
- [X] T007 [P] [US1] Apply and record the two platform-configuration steps on the development project dashboard (quickstart.md Prerequisites; research.md §13): (1) disable "Allow new users to sign up" (email-provider signups) — FR-022; (2) add `http://localhost:5173/**` to the Auth URL allow-list (the recovery redirect target for the dev origin — prerequisite for FR-018 in US5); record both as explicit, verifiable steps in the Data-layer workflow (platform configuration) section of `docs/development.md` — FR-023 (one canonical documented workflow, no parallel change practice)
- [X] T008 [P] [US1] Add the `"test:integration": "vitest run tests/integration"` script to `package.json` and include it in `verify` between `test:db` and `build` — no new dependencies (plan.md Project Structure; quickstart.md "Full quality pipeline")
- [X] T009 [US1] Create `tests/integration/auth.signin.test.ts` (the new integration suite against the cloud project via the publishable key; `tests/setup-env.ts` unchanged): every seeded identity signs in through the real Auth API (`signInWithPassword`) and the session's `sub` equals the deterministic UUID — FR-001, FR-003 proven live, SC-007; a wrong password for an existing account and a well-formed unknown account are rejected with the same generic error through the SDK — FR-002; a scratch unlinked identity (provisioned via the verified seed SQL pattern of contracts/supabase-auth-surface.md, deleted afterwards) authenticates but reads zero rows through the real data API and has writes denied by grants — FR-005 deny-by-default; the platform super admin signs in and reads no restaurant tenant data — FR-012 posture; each identity's readable scope through the typed client (restaurants, branches, dining_tables) matches the seeded membership matrix exactly — Alice: Blue Olive + both branches; Bob: Downtown; Carla: Downtown; Dan: Marina; Eve: Cedar Grill (all branches) + Downtown; Platform Admin: nothing — FR-004. Sends no recovery emails (rate limits — research.md §12); ~15 sign-ins, under the 30/5-min limit. `npm run test:integration` exits 0

**Checkpoint**: MVP delivered — real authenticated sign-ins work and are proven; every role resolves its seeded scope

---

## Phase 4: User Story 2 — Role-Aware, Server-Enforced Access Boundaries (Priority: P2)

**Goal**: The data layer enforces the role dimension on top of Phase 1's tenant/branch boundaries — narrowed staff-list visibility, first client access to profiles, membership-removal immediacy, and claim-immunity — all proven through every access path.

**Independent Test**: `npm run test:db` and `npm run test:integration` are green: every in-scope access succeeds; every out-of-scope access (other restaurants, other branches, above-role data such as the staff list for cashier and kitchen roles) is denied; the four Phase 1 isolation categories pass against real logins; forged credential claims grant nothing (spec US2 Independent Test).

### Implementation for User Story 2

- [X] T010 [US2] Create `supabase/migrations/<timestamp>_rbac_policies.sql` via `supabase migration new rbac_policies` (research.md §8–§9; data-model.md policy matrix): the three new `private` helpers with signatures verbatim from contracts/database-functions.md — `private.staff_profile_ids(p_user uuid) returns setof uuid` (profiles linked to the identity), `private.managed_restaurant_ids(p_user uuid) returns setof uuid` (role in (`owner`, `branch_manager`) — the staff-list visibility set), `private.managed_staff_profile_ids(p_user uuid) returns setof uuid` (profiles holding memberships in the managed restaurants) — each `language sql, stable, security definer, set search_path = ''` with schema-qualified bodies, `grant execute … to authenticated` and execute revoked from `public`/`anon`; replace the `staff_memberships_staff_select` policy (drop + recreate) so visible rows are `profile_id in (select private.staff_profile_ids(auth.uid())) or restaurant_id in (select private.managed_restaurant_ids(auth.uid()))` — Phase 1's any-staff-of-the-restaurant arm withdrawn exactly as feature 002 FR-009 deferred; add the first-ever `profiles` select policy — `id in (select private.staff_profile_ids(auth.uid())) or id in (select private.managed_staff_profile_ids(auth.uid()))` (erratum 2026-09-15: the own arm was originally misquoted as `auth_user_id in (select private.staff_profile_ids(…))`; `staff_profile_ids` returns profile ids, so the predicate compares `id` — exactly as the applied migration does, proven by T012's tests) — plus `grant select on public.profiles to authenticated`; every predicate in the wrapped `(select …)` initPlan form; `restaurants`, `branches`, `dining_tables`, `audit_log`, `app_meta` untouched (no policy or grant anywhere reads `is_super_admin` — FR-012). Apply with `npm run db:migrate` — FR-005/FR-006/FR-007/FR-011
- [X] T011 [P] [US2] Update `tests/database/tenancy.rls.test.ts` to the Phase 2 visibility matrix (data-model.md "Consequences the test matrix asserts"): `staff_memberships` no longer visible to arbitrary staff of the restaurant (own rows + managed restaurants only — the Phase 1 expectations are narrowed by design, research.md §14); the four Phase 1 isolation categories (cross-restaurant, cross-branch, scope bypass, direct access) re-run unchanged against the real seeded identity ids (equal to the existing deterministic UUIDs — the simulation helpers are unchanged). `npm run test:db` exits 0 — FR-020(a), SC-002 (depends on T010)
- [X] T012 [P] [US2] Create `tests/database/auth.rbac.test.ts` using the existing helpers (`runAs`/`asUser` in `tests/database/helpers/db.ts`, everything inside rolled-back transactions): staff-list visibility — owner ✓ and branch manager ✓ for their restaurant, cashier ✗, kitchen ✗, cross-restaurant ✗ (Eve: Cedar Grill ✓, Blue Olive ✗) — FR-007; `profiles` read rules — own profile plus managed-members' profiles only — FR-007/FR-011; a membership removed inside the transaction ⇒ that restaurant's data is invisible on the next statement (policies read live rows, no cache) — FR-006; forged credential claims (`app_role: "owner"`, `resto_scope` injected via `request.jwt.claims`) grant nothing — no policy reads claims beyond `auth.uid()` — FR-009, SC-003; the super admin (`is_super_admin = true`, no memberships) reads zero restaurant tenant data — FR-012; every staff member still reads their restaurant's own record and their own membership rows — FR-007 baseline, FR-011. `npm run test:db` exits 0 — FR-020(b) (depends on T010)
- [X] T013 [P] [US2] Extend `tests/integration/auth.signin.test.ts` with the role-aware data matrix through the real data API under the new policies (SC-001/SC-002): owner and branch manager read their restaurant's staff list (memberships + linked profiles); cashier and kitchen are denied it — FR-007; Eve reads Cedar Grill's staff list but not Blue Olive's; every staff member reads their own restaurant's record; cross-restaurant and cross-branch reads are denied for every role — the Phase 1 categories re-proven with real logins (US2 scenarios 1–4, 8). `npm run test:integration` exits 0 (depends on T010)

**Checkpoint**: The RBAC core is enforced at the data layer and proven through every access path — application, data API, and direct database session

---

## Phase 5: User Story 3 — Protected Staff Areas and Route Guards (Priority: P3)

**Goal**: The signed-in frontend: sign-in page, session provider, effective-context hook, presentation-only guards, the unified multi-membership staff area with in-dashboard context selection, and the role-aware route surface — with the guard decision matrix unit-tested and the route matrix walked by e2e.

**Independent Test**: `npm run test:unit` and `npm run test:e2e` are green plus the quickstart route-matrix walkthrough: every protected route denies unauthenticated entry (redirect + return-to); each role reaches exactly its intended views and no others; deep links to unauthorized views are rejected, not hidden; the super admin reaches the platform admin area (spec US3 Independent Test).

### Implementation for User Story 3

- [X] T014 [US3] Create `supabase/migrations/<timestamp>_auth_context_rpc.sql` via `supabase migration new auth_context_rpc` (research.md §8; contracts/database-functions.md): `public.current_auth_context() returns jsonb` — `language sql, stable, security invoker, set search_path = ''` — returning `{ profile: { id, display_name, is_super_admin } | null, memberships: [{ restaurant_id, restaurant_slug, restaurant_name, role, branch_id, branch_name }] }` by reading `profiles`, `staff_memberships`, `restaurants`, and `branches` under the caller's own RLS policies (security invoker by design — it can never disclose anything the policies do not allow and can never drift from them); execute revoked from `public`/`anon`, granted to `authenticated`. Apply with `npm run db:migrate` — FR-004/FR-010
- [X] T015 [US3] Regenerate and commit types: `npm run types:gen` → `src/types/database.types.ts` — the `Functions` section now includes `current_auth_context`; table and enum types unchanged; `private` functions intentionally absent (the file must stay reproducible after a full reset/rebuild — feature 002 FR-016 posture)
- [X] T016 [P] [US3] Create `src/features/auth/authClient.ts` per contracts/auth-client.md — the typed wrapper that is the only import path for `supabase.auth.*` in application code: `signIn` returning one generic, user-presentable failure message (never dissects wrong-password vs unknown-account — FR-002), `signOut` calling `signOut({ scope: 'local' })` (current device only — FR-017; the SDK's `global` default is explicitly rejected), `requestPasswordReset` via `resetPasswordForEmail(email, { redirectTo: '/reset-password' })` always reporting the generic outcome, `completePasswordReset` via `updateUser({ password })`, plus `getSession`/`onAuthStateChange` delegation (FR-016)
- [X] T017 [P] [US3] Create `src/features/auth/AuthProvider.tsx` — context value `{ session, status }` with `status ∈ 'loading' | 'signed-in' | 'signed-out'`, driven by `onAuthStateChange` (`SIGNED_IN`, `SIGNED_OUT`, `PASSWORD_RECOVERY`, token-refresh events); re-subscribes on mount and cleans up on unmount (no leaked subscriptions); session ≠ staff context (an authenticated unlinked identity is `signed-in` with an empty context — handled by the guards, not the provider) — and wrap the router with the provider in `src/app/App.tsx`
- [X] T018 [US3] Create `src/features/auth/useAuthContext.ts` — react-query hook over `supabase.rpc('current_auth_context')`, enabled only when signed in, invalidated on auth events; returns the RPC-shaped `AuthContext` plus the memoized advisory predicates `isStaff` (profile ≠ null ∧ memberships.length > 0), `isSuperAdmin` (`profile?.is_super_admin === true`), `canReadStaffList(restaurantId)` (a membership with role `owner` or `branch_manager` for that restaurant — FR-007). The hook caches; it never decides (Constitution IV/V; FR-009: nothing credential-carried participates) (depends on T015)
- [X] T019 [US3] Create `src/features/auth/guards.tsx` per contracts/auth-client.md — presentation-only guards consuming `useAuthContext` exclusively, never raw table state: `RequireAuth` (unauthenticated ⇒ redirect to `/signin` with the requested location in `location.state.from` — return-to after sign-in, FR-013), `RequireStaff` (wraps `RequireAuth`; signed-in but not `isStaff` — including the unlinked-identity case — ⇒ renders `NotAuthorized`, FR-014/FR-005), `RequireSuperAdmin` (wraps `RequireAuth`; signed-in but not super admin ⇒ `NotAuthorized`), and the `NotAuthorized` denial view — deep links are rejected, never merely hidden (depends on T018)
- [X] T020 [P] [US3] Create `src/routes/SignInPage.tsx` — staff sign-in form calling `authClient.signIn`; every failed attempt shows the single generic message (FR-002); on success navigates to `location.state.from` when present, else the default landing (super admin without memberships → `/admin`; staff → `/dashboard`) — no forced restaurant or role chooser before entering the staff area (FR-015) (depends on T016–T018)
- [X] T021 [P] [US3] Extend `src/routes/DashboardPage.tsx` into the unified staff area across all memberships (FR-015): an in-dashboard restaurant/branch context selector built from the `useAuthContext` memberships (e.g. Eve: Cedar Grill with all branches + the Blue Olive Downtown slice); navigation shows only the entries the effective roles and scope permit — presentation only (master plan §38) (depends on T018)
- [X] T022 [P] [US3] Create `src/routes/ProfilePage.tsx` — the signed-in member's own basic profile information (display name) together with their effective roles and scope from `useAuthContext` — FR-011 (the data-layer arm was proven in T010/T012) (depends on T018)
- [X] T023 [P] [US3] Create `src/routes/StaffListPage.tsx` — the selected restaurant's staff list (its `staff_memberships` plus the linked profiles' basic information) read through the table policies with the typed client; gated by `canReadStaffList(selectedRestaurantId)` — owners and branch managers only — FR-007 (depends on T018 and US2's policies)
- [X] T024 [P] [US3] Extend `src/routes/AdminPage.tsx` into the platform admin area shell — reachable only via `RequireSuperAdmin`; fetches no restaurant tenant data (FR-012 — platform-wide capabilities arrive with Phase 13) (depends on T018)
- [X] T025 [US3] Rewire `src/app/router.tsx` to the route surface of contracts/auth-client.md: public `/`, `/r/:restaurantSlug`, `/order/:branchId`, `/signin`; `RequireStaff`-guarded `/dashboard`, `/dashboard/profile`, `/dashboard/staff`; `RequireSuperAdmin`-guarded `/admin` — unauthenticated entry redirects with return-to (FR-013) and deep links to unauthorized views hit the guards' `NotAuthorized` (FR-014) (depends on T019–T024)
- [X] T026 [P] [US3] Create `tests/unit/auth.guards.test.ts` — the guard/route-permission decision matrix (plan.md Testing; research.md §10): unauthenticated ⇒ redirect to `/signin` carrying the requested location; signed-in unlinked identity ⇒ `NotAuthorized` on every staff route; per-role reachability — owner (all staff views incl. the staff list), branch manager (own-branch scope + the staff list), cashier/kitchen (own-branch scope, staff list denied), multi-membership member (union of scopes), super admin (`/admin` only); `canReadStaffList` predicate truth table. `npm run test:unit` exits 0 — FR-013/FR-014/FR-015 (depends on T018–T019; parallel with T020–T025)
- [X] T027 [US3] Create `e2e/auth.routes.test.ts` (research.md §14; representative paths per master plan §41 priority order): unauthenticated `/dashboard` and `/admin` redirect to `/signin` with return-to and land back after a valid seeded sign-in — FR-013; a seeded staff sign-in lands on the correct area per role; a deep link to `/dashboard/staff` as cashier renders `NotAuthorized` — rejected, not hidden — FR-014; the platform super admin reaches `/admin` — FR-012. `npm run test:e2e` exits 0 — SC-006 (depends on T025)

**Checkpoint**: The signed-in staff experience exists and the route matrix is proven — the phase's exit condition is demonstrable on the surface

---

## Phase 6: User Story 4 — Session Persistence and Sign-Out (Priority: P4)

**Goal**: A signed-in member stays authenticated across page reloads and browser restarts until sign-out; sign-out ends the current device's session and re-protects everything.

**Independent Test**: e2e plus the quickstart walkthrough: reload and browser restart keep the same identity and scope; sign-out redirects protected areas to sign-in and denies staff data until re-authentication; a second device survives a local sign-out (spec US4 Independent Test).

### Implementation for User Story 4

- [X] T028 [P] [US4] Verify and complete session persistence in `src/features/auth/AuthProvider.tsx`: `status` stays `'loading'` until the SDK restores the session on mount (no signed-out flash), token-refresh events keep the member signed in, and the SDK defaults (localStorage persistence, `autoRefreshToken`) are left on — the member remains authenticated across page reloads and browser restarts with the same identity — FR-016
- [X] T029 [P] [US4] Add the sign-out affordance to the staff-area shell (`src/components/AppShell.tsx` as consumed by `src/routes/DashboardPage.tsx` and `src/routes/AdminPage.tsx`): a sign-out control wired to `authClient.signOut()` — local scope, ends only the current device's session; concurrent sessions on other devices survive (FR-017, spec Assumptions)
- [X] T030 [US4] Extend `e2e/auth.routes.test.ts` with persistence and sign-out coverage: after a seeded sign-in, a page reload keeps the member signed in with the same identity and scope — FR-016; sign-out ends the session — `/dashboard` and `/admin` redirect to `/signin` and staff data requires re-authentication — FR-017. `npm run test:e2e` exits 0 — SC-004 (depends on T028–T029)

**Checkpoint**: The authenticated experience is operational across whole shifts

---

## Phase 7: User Story 5 — Self-Service Password Recovery (Priority: P5)

**Goal**: A staff member regains access without operator help: a recovery request by account email, a time-limited single-use recovery path, a new password set — the previous password dead, nothing else about the account changed.

**Independent Test**: The integration suite's automatable recovery properties (generic responses, post-change round-trip on a scratch identity) plus the quickstart's rate-limit-aware manual walkthrough of the full email-link path (spec US5 Independent Test).

### Implementation for User Story 5

- [X] T031 [P] [US5] Create `src/routes/ResetPasswordPage.tsx` and add the public, session-bearing `/reset-password` route to `src/app/router.tsx`: listens for the `PASSWORD_RECOVERY` auth event (following the recovery link establishes a session), collects the new password, and calls `completePasswordReset` — FR-018 (requires the redirect-URL platform configuration from T007)
- [X] T032 [P] [US5] Add the recovery request affordance to `src/routes/SignInPage.tsx` (the "forgot password" flow): collects the account email and calls `requestPasswordReset`; shows the same generic confirmation for existing and non-existent addresses — no account enumeration (FR-018, US5 scenario 5)
- [X] T033 [US5] Extend `tests/integration/auth.signin.test.ts` with the automatable recovery properties (research.md §12 — no test sends recovery emails): a recovery request for a non-existent email returns the same generic response as the valid case (US5 scenario 5); the password-change round-trip on a scratch identity provisioned via the verified SQL pattern (contracts/supabase-auth-surface.md): set a new password via `updateUser`, then the new password signs in, the previous password is rejected, and the identity's profile, memberships, roles, and scope are unchanged — FR-018/FR-019; delete the scratch identity afterwards. `npm run test:integration` exits 0 — SC-005

**Checkpoint**: All five stories complete — the full Phase 2 outcome set is delivered

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final integration validation, determinism proof, audits, and documentation of everything the stories built

- [X] T034 [P] Extend `docs/development.md`: the auth test suites section (what `npm run test:db`'s Phase 2 matrix, `npm run test:integration`, and the auth e2e routes cover; the cloud precondition; the rate-limit notes — no automated recovery emails, ~15 sign-ins per run under the 30/5-min limit); the seeded-credential reset runbook (`npm run db:reset -- --yes --purge-auth`, plus the stray-user unique-email failure mode); a pointer to `specs/003-auth-and-rbac/quickstart.md`
- [X] T035 Reset-and-rebuild determinism (quickstart.md "Reset-and-rebuild determinism"; SC-007): `npm run db:reset` (auth identities survive, profiles re-link via the upsert) → `npm run test:db` green; `npm run db:reset -- --yes --purge-auth` (full restore including fixture credentials) → suites green; `npm run types:gen` output byte-identical to the committed `src/types/database.types.ts` — feature 002 FR-016 reproducibility posture extended to Phase 2
- [X] T036 Full quality gate from a clean state: `npm run verify` (now format:check → lint → typecheck → test:unit → test:db → test:integration → build) AND `npm run test:e2e` both exit 0 — SC-001–SC-006 evidence (depends on T034–T035)
- [X] T037 [P] Constraint & boundary audit: no service-role/secret keys anywhere (seed provisioning uses only `SUPABASE_DB_URL`); no new environment variables or npm dependencies; no custom claims or access-token hooks (FR-009 posture, research.md §7); `auth.*` tables written only by `supabase/seed.sql` and the documented scratch-identity test pattern; guards remain presentation-only (Constitution IV; FR-008); every spec FR-001–FR-023 maps to at least one completed task (traceability check) — audit record in the Notes section below
- [X] T038 [P] Run the quickstart.md manual validation walkthroughs and record the results: per-identity sign-in experience (Alice: both branches + staff list; Bob: Downtown + staff list; Carla/Dan: own branch, staff-list deep link → NotAuthorized; Eve: unified area with in-dashboard context selection across both restaurants; Platform Admin: lands on `/admin`, no restaurant data anywhere); session persistence across reload/restart and second-device survival of a local sign-out; the rate-limit-aware password recovery incl. expired- and already-used-link rejection, then restore with `npm run db:reset -- --yes --purge-auth`; a self-service sign-up attempt rejected (FR-022) — SC-004/SC-005/SC-006/SC-007 manual evidence — validation record (automated evidence + explicit manual-confirmation residue) appended to quickstart.md
- [ ] T039 Final commit and push of all Phase 2 artifacts (three migrations, seed, scripts, the `src/features/auth/` module + routes, test suites, regenerated types, docs, spec artifacts) to GitHub `main` — mirrors feature 002 T018 (depends on T036–T038)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (T002's credential source feeds the seed and every suite)
- **US1 (Phase 3)**: Depends on Foundational — internal order T003 → T004 → (T005 ∥ T006) with T007 ∥ T008 anywhere in the phase, then T009
- **US2 (Phase 4)**: Depends on US1 (the narrowed policies and every suite need the real seeded login-capable identities) — T010, then T011 ∥ T012 ∥ T013
- **US3 (Phase 5)**: Depends on US2 (guards and views present the enforced boundaries; the staff-list read path exists) — T014 → T015; T016 ∥ T017 run independently of that chain; T018 → T019 → (T020–T024 ∥ T026) → T025 → T027
- **US4 (Phase 6)**: Depends on US3 (session provider, routes, and authClient exist) — T028 ∥ T029 → T030
- **US5 (Phase 7)**: Depends on US3 (authClient recovery operations, SignInPage, router) and on T007 (the redirect-URL platform configuration); T033 reuses US1's integration suite file — T031 ∥ T032 → T033
- **Polish (Phase 8)**: Depends on all user stories — T034 ∥ T035 → T036 → T037 ∥ T038 → T039

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories (MVP)
- **US2 (P2)**: After US1 (needs real authenticated identities to enforce and prove against)
- **US3 (P3)**: After US2 (route guards are presentation over the enforced boundaries; the staff-list view consumes the narrowed policies)
- **US4 (P4)**: After US3 (refines the session experience US3 establishes)
- **US5 (P5)**: After US3 (the recovery UI rides the auth module); also needs US1's integration suite (T033) and T007's platform configuration

### Within Each User Story

- Migrations first — created only via `supabase migration new <name>`, applied only via `npm run db:migrate` (FR-023) — then seed/types, then the code that consumes them, then the suite that proves them
- The story's suites are green before the story's checkpoint

### Parallel Opportunities

- US1: T005 ∥ T006 ∥ T007 ∥ T008 (different files; T005/T006 after T004, T007/T008 independent)
- US2: T011 ∥ T012 ∥ T013 (three different test files, all after T010)
- US3: T016 ∥ T017 (independent of T014/T015); T020 ∥ T021 ∥ T022 ∥ T023 ∥ T024 ∥ T026 (five views + the unit suite, all after T018/T019)
- US4: T028 ∥ T029 (different files)
- US5: T031 ∥ T032 (different files)
- Polish: T034 ∥ T035; T037 ∥ T038

---

## Parallel Example: User Story 3

```bash
# After T019 (guards exist and useAuthContext resolves), the view work fans out:

Implementer A (public entry):
Task: "Create SignInPage.tsx (generic failure message, return-to + default landing)"   # T020

Implementer B (staff area):
Task: "Extend DashboardPage.tsx (unified area + context selector)"                     # T021
Task: "Create ProfilePage.tsx (own profile + roles/scope)"                             # T022

Implementer C (role-gated views + tests):
Task: "Create StaffListPage.tsx (staff list, canReadStaffList-gated)"                  # T023
Task: "Extend AdminPage.tsx (platform admin shell)"                                    # T024
Task: "Create tests/unit/auth.guards.test.ts (guard decision matrix)"                  # T026

# Merge, then T025 wires the router and T027 walks the e2e route matrix.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: User Story 1 (T003–T009)
4. **STOP and VALIDATE**: `npm run test:integration` green — every seeded role signs in through the real Auth API and resolves exactly its seeded scope (the first half of the §13 exit condition)

### Incremental Delivery

1. Setup + Foundational → shared credential source ready
2. US1 → real authenticated sign-ins (MVP — the identity linkage and proof)
3. US2 → role-aware boundaries enforced at the data layer and proven through every path (the security core)
4. US3 → protected staff areas + route guards (the demonstrable surface)
5. US4 → session persistence + sign-out (operational continuity)
6. US5 → self-service password recovery (access restoration)
7. Polish → determinism proof, full gate, audits, docs, commit/push

### Single-Implementer Order

T001 → T002 → T003 → T004 → T005 ∥ T006 ∥ T007 ∥ T008 → T009 → T010 → T011 ∥ T012 ∥ T013 → T014 → T015 → T016 ∥ T017 → T018 → T019 → T020–T024 ∥ T026 → T025 → T027 → T028 ∥ T029 → T030 → T031 ∥ T032 → T033 → T034 ∥ T035 → T036 → T037 ∥ T038 → T039

---

## Notes

- **T037 audit record (2026-09-15) — all checks PASS**: no service-role/secret keys anywhere (the only `service_role` occurrence is the SQL role name in `scripts/db/reset.mjs`'s default-grant recreation; provisioning uses only `SUPABASE_DB_URL`); no new environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL` only) and no new npm dependencies (`package.json` diff = the `test:integration` script + `verify` step only); no custom claims or access-token hooks (no policy reads anything but `auth.uid()`; `app_role`/`resto_scope` appear only in tests as the denied forged-claim injection); `auth.*` written only by `supabase/seed.sql` and the documented scratch-identity pattern in `tests/integration/auth.signin.test.ts` (plus the documented `--purge-auth` deletion runbook in `scripts/db/reset.mjs`); guards presentation-only (guards.tsx consumes `useAuthSession`/`useAuthContext` exclusively, renders redirect/denial, performs no data operations); FR-001–FR-023 each map to ≥1 completed task (FR-008, the cross-cutting Constitution IV principle, is realized by T010 + T012 + T013 — enforcement proven through application, data API, and direct database session — and by T019's presentation-only guards; every other FR carries an explicit completed-task tag).
- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Migrations are created only via `supabase migration new <name>` and applied only via `npm run db:migrate`; the two dashboard settings are platform-configuration steps recorded in `docs/development.md` — never ad-hoc changes (FR-023)
- `supabase/seed.sql` (and the documented scratch-identity test pattern) is the only writer to `auth.users`/`auth.identities`; nothing else may touch `auth.*` (contracts/supabase-auth-surface.md)
- Automated tests never send recovery emails (hosted inbuilt SMTP allows 2/hour — research.md §12); the full email-link path is the quickstart's manual validation
- Route guards are presentation-only; the data layer is the security boundary (Constitution IV; FR-008) — any guard that becomes an enforcement point for a data operation fails review
- Never print or commit `SUPABASE_DB_URL` or any secret; no service-role keys exist in this project
- Commit after each task or logical group; stop at any checkpoint to validate the story independently
