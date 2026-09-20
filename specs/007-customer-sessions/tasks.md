---
description: "Task list for feature 007-customer-sessions (Phase 6)"
---

# Tasks: Customer Access and Sessions (Phase 6)

**Input**: Design documents from `/specs/007-customer-sessions/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/database-functions.md, contracts/session-client.md, quickstart.md, checklists/access-security-and-lifecycle.md (reviewer-owned)

**Tests**: Test tasks ARE included — the spec mandates them (SC-002 requires the dedicated abuse suite; SC-003 the concurrency proof; SC-005 the authorization matrix and audit records; SC-004 the recovery matrix). They are deliverables of this feature, not TDD-gated feature tests; each suite lands with the layer it verifies.

**Organization**: Tasks are grouped by user story (spec.md US1–US4) so each story is independently implementable and testable. The shared data layer — three tables and the seven functions — is a blocking prerequisite (Phase 2) because every story's surface reads or writes it; the public/customer/staff story phases then own their surfaces and their semantic proofs.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

Single project at repository root: `src/`, `tests/`, `e2e/`, `supabase/`, `scripts/db/`, `docs/` — per plan.md Project Structure. No new top-level directories, no new dependency, no new environment variable. Database work extends the feature 002–006 layout: migrations under `supabase/migrations/` (created only via `supabase migration new <name>`, applied only via `npm run db:migrate`), seed in `supabase/seed.sql` (applied via `npm run db:seed`), types regenerated via `npm run types:gen`. The frontend lands in the new `src/features/session/` module with pages in `src/routes/`; customer routes live under the public `/r/:slug` path. No storage surface exists in this phase.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean, green baseline before any Phase 6 work

- [ ] T001 Verify the starting baseline before any Phase 6 work: `git status --short` shows only the feature 006 history (no uncommitted Phase 6 files); `npm run verify` exits 0 on the feature-006 state; `supabase migration list` shows all twenty-three existing migrations applied remotely with no drift. If any check fails, stop and restore the known-good state — guards FR-022 (single canonical workflow). No dependency is added this phase (plan.md Technical Context)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The two migrations that constitute the session data layer, the seeded fixture source, and the schema/authorization proofs every user story consumes

**CRITICAL**: No user story work can begin until this phase is complete

**Why the whole data layer lands here**: the plan's migrations create the three shared tables and the seven functions that every story's surface calls — there is no story whose work can precede its own table or function. The story phases that follow own the *surfaces* and the *semantic proofs* (entry validation, concurrency, token abuse, staff scoping, recovery rules) that the shared matrix deliberately does not duplicate.

- [ ] T002 [P] Extend `tests/database/helpers/fixtures.ts` with the Phase 6 fixture constants as new exports (existing exports keep their shapes): the two seeded open sessions (Downtown T1 and T2) with their ids, restaurant/branch/table bindings, opened-at invariants, and participants; the **deterministic dev tokens** (documented plaintext constants in the file, their SHA-256 hashes computed by the seed) and the expectation that each resolves to its session; Downtown's table-label map — the single fixture source shared by the seed task (T005), the schema suite, and every story's suites — FR-022, SC-007, data-model.md
- [ ] T003 Create `supabase/migrations/<timestamp>_session_schema.sql` via `supabase migration new session_schema` (data-model.md; research.md §3, §5, §6): the three tables with every constraint, index, RLS enable, and `revoke all … from anon, authenticated` exactly as declared — `sessions` (`type text not null default 'dine-in' check (type in ('dine-in'))`, `status text not null default 'open' check (status in ('open','closed'))`, `opened_at timestamptz not null default now()`, nullable `closed_at`/`closed_by_profile_id` with the composite FK to `profiles(restaurant_id, id)`, composite FKs to `restaurants(restaurant_id, id)` / `branches(restaurant_id, id)` / `dining_tables(restaurant_id, branch_id, id)`, the **partial unique index** `sessions_one_open_per_table on (restaurant_id, branch_id, table_id) where status = 'open'`, the `sessions_closed_shape` check `((status = 'open' and closed_at is null and closed_by_profile_id is null) or (status = 'closed' and closed_at is not null and closed_by_profile_id is not null))`); `session_participants` (`session_id` FK, `display_name text not null check (btrim(length) between 1 and 60)`, `phone text not null`, `joined_at timestamptz not null default now()`, the `(session_id)` index); `session_tokens` (`session_id` FK, `token_hash text not null` with the **unique** index — the verification lookup, the `(session_id)` index); **no grant of any kind follows on any of the three tables** — research §5's zero-grant posture. Apply with `npm run db:migrate` — FR-005, FR-007, FR-011, FR-016, FR-020; Constitution IV/V
- [X] T004 Create `supabase/migrations/<timestamp>_session_rpcs.sql` via `supabase migration new session_rpcs` (contracts/database-functions.md §1–§5; research.md §1, §3, §4, §6): the seven `public` functions, each `security definer`, `set search_path = ''`, schema-qualified, authorization/validation as its first act — `get_public_restaurant(p_slug)` (restaurant by slug + active branches; "Restaurant not found."), `open_session_at_table(p_restaurant_id, p_branch_id, p_table_id, p_display_name, p_phone)` (the validation chain and exact messages per contract; open-or-join behavior where the join path appends a participant and issues a new token; the open path's unique-violation caught **by constraint name** `sessions_one_open_per_table` → "A session is already open at this table. Join it instead."; token = base64url of `encode(gen_random_bytes(32), 'escapes')` semantics per research §1 with only `digest(token,'sha256')` stored; returns session + token + participant), `get_session_context(p_token)` and `get_session_menu(p_token)` (hash verification, unknown-or-closed → the single indistinguishable "This session is no longer available."; menu reuses feature 005's payload assembly for the session's branch), `get_branch_open_sessions(p_branch_id)` (owner any branch of own restaurant / manager or cashier own branch only; kitchen denied; returns table, label, opened_at, participants ordered by opened_at), `close_session(p_session_id)` (same role matrix; already-closed → "This session is already closed."; sets `status='closed'`, `closed_at`, `closed_by_profile_id`; exactly one `private.record_audit` record — action `session.closed`, change `session=<id>; table=<label>`, tenant + branch scope); execute grants to `anon, authenticated` on the five customer/public functions and to `authenticated` on the two staff functions. Apply with `npm run db:migrate` — FR-001…FR-014, FR-017…FR-021
- [X] T005 Extend `supabase/seed.sql` (converging, idempotent, deterministic — the T002 constants) and `scripts/db/seed.mjs`'s summary query with the Phase 6 fixture: two open dine-in sessions at Downtown T1 and T2 with their participants and the dev tokens' SHA-256 hashes computed in SQL — FR-022, SC-007
- [X] T006 Regenerate the data-access types: `npm run types:gen` → `src/types/database.types.ts` gains the three tables and the seven function signatures; the file is committed and never hand-edited — FR-022
- [X] T007 Create `tests/database/session.schema.test.ts` — the declaration-shape suite (features 002/004–006 precedent): the three tables' column names, types and nullability in ordinal order exactly per data-model.md; the constraints by name (`sessions_one_open_per_table` partial unique exercised by attempting a second open session for one table in a rolled-back transaction, `sessions_closed_shape`, the status/type checks, the participant bounds, the unique `token_hash`) exercised by attempting violations; the **zero-grant posture** proven — `has_table_privilege('anon', …)` and `('authenticated', …)` are false for select/insert/update/delete on all three tables. `npm run test:db` exits 0 — FR-005, FR-007, FR-011, FR-020; Constitution IV
- [X] T008 Create `tests/database/session.rpc.test.ts` — the shared matrix: authorization for **every** one of the seven functions across the identity matrix (unauthenticated token-less calls; the valid dev tokens; alice owner, bob branch manager Downtown, carla cashier Downtown, dan kitchen, eve owner Cedar Grill + Downtown cashier, fiona no membership, the platform admin — denials `42501`); the generic validation messages and bounds (unknown slug, inactive branch, stopped/foreign table, blank/60+-char name, lettered phone, the exact contract messages); the audit basics for `close_session` (one record per accepted close with actor, action, resource, tenant + branch scope), and the no-account posture (a token never links to a staff identity or credential — FR-015). Everything in rolled-back transactions; `npm run test:db` exits 0 — FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-020, FR-021, FR-022

**Checkpoint**: Foundation ready — the session data layer and the seeded fixture exist; the schema and authorization matrices are green; user story implementation can begin

---

## Phase 3: User Story 1 — Customer Entry (Priority: P1) — MVP

**Goal**: A customer completes the public entry flow — restaurant page → branch → table → name/phone → session context + token — with every step validated and nothing created on invalid input.

**Independent Test**: From a seeded database, resolve `/r/blue-olive` through the public RPC, complete entry for an active table, and receive a working token; attempt each invalid input class and receive the contract's message with nothing stored.

### Implementation

- [X] T009 [US1] Create `src/features/session/sessionClient.ts` — the typed wrapper over the seven RPCs and the only import path for them (contracts/session-client.md §1, §2): `getPublicRestaurant(slug)`, `enterSession({restaurantId, branchId, tableId, displayName, phone})`, `getSessionContext()`, `getSessionMenu()`, `getBranchOpenSessions(branchId)`, `closeSession(sessionId)`; `42501` → `AuthorizationError`, `P0001` → `SessionError` with the server message verbatim; `SessionPayloadError` on malformed jsonb; the token storage rules — `localStorage` key `restopilot.session-token`, written only on entry success, read for customer reads, **cleared on a refused recovery**; no optimistic writes
- [X] T010 [P] [US1] Create `src/features/session/useSession.ts` — react-query hooks per contracts/session-client.md §1: `usePublicRestaurant(slug)`, `useEnterSession()` mutation (stores the token through the client on success), `useSessionContext()` (disabled without a stored token; clears it on the no-longer-available error), `useSessionMenu()`; query keys token-scoped so a close/clear invalidates customer reads
- [X] T011 [US1] Create `src/features/session/components/RestaurantEntry.tsx` — the public entry flow (contracts/session-client.md §1): branch selection rendered only when the restaurant has more than one active branch (FR-002), table selection from the branch's active tables (FR-003), the name/phone form with the validation bounds surfaced client-side as feedback only (the server re-validates — FR-004), submit → entry → navigate to `/r/:slug/menu`; clear error states for every refusal message
- [X] T012 [US1] Create `src/routes/RestaurantPublicPage.tsx` (the `/r/:slug` route — FR-001) and `src/routes/CustomerMenuPage.tsx` (the `/r/:slug/menu` route mounting feature 005's menu payload for the session's branch with `SessionIndicator`); register both in `src/app/router.tsx` under the public path with no dashboard chrome; unknown slug renders the not-found state — FR-001, FR-021
- [X] T013 [US1] Create `tests/unit/session.client.test.ts` — the client suite: error mapping for every wrapper, token storage rules (write-on-entry, clear-on-refusal, no staff-side reads), payload parsing into typed structures, and the malformed-payload rejection — contracts/session-client.md §1–§2, FR-004, FR-011
- [X] T014 [US1] Extend `tests/database/session.rpc.test.ts` with the US1 semantics block: the full entry validation matrix through the real RPC (each invalid class → the exact message, nothing stored — FR-004, FR-016), branch-selection behavior (single-branch restaurants conceptually skip: the RPC accepts the only branch; multi-branch requires the chosen branch to belong to the restaurant — FR-002), and the entry→browse path (`get_session_menu` returns the branch menu for the token's session — FR-021)
- [X] T015 [US1] Create `e2e/session.surfaces.test.ts` — the US1 browser block: the public entry flow end to end (public page → branch → table → form → menu route with the indicator), the unknown-slug not-found state, and the invalid-input refusals rendered — SC-001, FR-001…FR-005

**Checkpoint**: US1 complete — a real customer can enter securely and reach the menu without an account

---

## Phase 4: User Story 2 — The Dine-In Session Model (Priority: P1)

**Goal**: First entry opens; later entries join; no timeout; authorized staff close — one open session per table under concurrency, closed-is-terminal, audited.

**Independent Test**: Enter twice at one table → one session, two participants; concurrent entries → one session; staff close → terminal, audited; kitchen/other-branch/other-restaurant/token attempts denied `42501` at the data layer.

### Implementation

- [X] T016 [US2] Extend `tests/database/session.rpc.test.ts` with the US2 semantics block: the open/join lifecycle through the RPCs (first entry opens exactly one; second entry joins as a participant with name/phone recorded — FR-005/FR-006/FR-016; the partial unique index proven under a real race — two concurrent `open_session_at_table` calls produce one session and two participants — FR-007, SC-003), the no-timeout posture (an open session's state and usability are independent of elapsed time — no expiry predicate exists to trip — FR-008, SC-006), close authorization (owner any branch of own restaurant; bob Downtown-only; carla included; dan kitchen denied; eve denied for Blue Olive — FR-009/FR-019/FR-020), already-closed refusal, terminality (no reopen path; the table becomes eligible for a new session while the closed row persists — FR-010), and the close audit record (FR-018)
- [X] T017 [US2] Create `src/features/session/components/BranchSessionsPanel.tsx` and `src/routes/StaffSessionsPage.tsx` (the `/dashboard/sessions` route) — the staff oversight surface: the branch's open sessions with table label, opened time, and participants (FR-017), the close action with confirmation, error states for the denial messages; register the route in `src/app/router.tsx`; extend `src/features/auth/useAuthContext.ts` with the presentation-only `canViewSessions(branchId)` / `canCloseSession(branchId)` predicates (owner any branch of own restaurant; manager/cashier own branch; kitchen and everyone else false) — Constitution IV
- [X] T018 [US2] Extend `src/routes/DashboardPage.tsx` with the staff "Sessions" navigation entry and `src/routes/BranchDetailPage.tsx` with a link to the branch's sessions view — FR-017
- [X] T019 [US2] Extend `e2e/session.surfaces.test.ts` with the US2 browser block: the second-window join (one session, two participants in the indicator and staff view), the staff oversight view scoped to the signed-in branch, the close action's effect, and the role denials rendered (kitchen sees no sessions surface; other-branch staff denied) — SC-003, SC-005, FR-009, FR-017

**Checkpoint**: US2 complete — the session model behaves exactly as §17 specifies under concurrency and closure

---

## Phase 5: User Story 3 — Session Recovery and Access Security (Priority: P2)

**Goal**: Device recovery without re-entry; the token verified server-side everywhere; cross-session access impossible; stale devices redirected to entry.

**Independent Test**: Recover on the same device after reload; tamper the token → refusal; use one session's token against another session's context → refusal everywhere; close-and-reseat → recovery refused and the device returned to entry.

### Implementation

- [X] T020 [US3] Extend `tests/database/session.rpc.test.ts` with the US3 abuse block — the dedicated suite SC-002 demands: every customer operation (`get_session_context`, `get_session_menu`) without a token, with a tampered token, with an unknown hash, and against a closed session → the single indistinguishable "This session is no longer available." with no history leakage (FR-011, FR-014, FR-020); cross-session attempts (session A's token against session B's context through every argument path — the token's stored binding decides, arguments cannot redirect it) → refusal (FR-012); the token never grants staff operations (`get_branch_open_sessions`/`close_session` unauthenticated → `42501`) (FR-020)
- [X] T021 [US3] Extend `src/features/session/components/SessionIndicator.tsx` and `CustomerMenuPage.tsx` — the recovery behavior: a customer route mount attempts `useSessionContext()` from the stored token; a refused recovery clears the token and redirects to `/r/:slug` (the reassociation rule surfaced — FR-013, FR-014); the minimal indicator renders restaurant · branch · table from the context (clarification 4)
- [X] T022 [US3] Extend `tests/unit/session.client.test.ts` with the recovery rules and `tests/integration/session.journey.test.ts` (NEW) — the real-API journey: enter → recover after reload-equivalent (fresh client, stored token) → read the menu → staff close through a real cashier session → customer recovery refused → re-enter (joins the new session) — SC-004, SC-002, FR-013/FR-014
- [X] T023 [US3] Extend `e2e/session.surfaces.test.ts` with the US3 browser block: reload recovery (no re-entry), the tampered-token refusal returning to entry, and the closed-and-reseated recovery refusal — SC-002, SC-004

**Checkpoint**: US3 complete — recovery and the access boundary behave per Risk 5's dedicated-abuse-test posture

---

## Phase 6: User Story 4 — Staff Session Oversight (Priority: P3)

**Goal**: The oversight view is complete and scoped; the close action is fully wired; staff-side denials are proven at the data layer and reflected in the UI.

**Independent Test**: As carla, see Downtown's open sessions only; close one; as dan, the view is empty-of-controls and the RPCs deny; as eve, nothing of Blue Olive is reachable.

### Implementation

- [X] T024 [US4] Extend `tests/database/session.rpc.test.ts` with the US4 scoping block: `get_branch_open_sessions` returns exactly the branch's open sessions ordered by `opened_at` with table labels and participants (FR-017); the cross-scope matrix (bob Downtown-only, eve Blue Olive-only, fiona everything denied — FR-019); the participant payload carries display name and joined-at only (no phone to the staff list — data-model PII posture)
- [X] T025 [US4] Extend `src/features/session/components/BranchSessionsPanel.tsx` — the complete oversight surface: empty state, participant display, the close action wired to the mutation with invalidation of the staff list and customer reads, and the audit-backed confirmation — FR-017, FR-009
- [X] T026 [US4] Extend `e2e/session.surfaces.test.ts` with the US4 browser block: carla's scoped view, the close journey's staff-side rendering, dan's and eve's denials — SC-005, FR-019

**Checkpoint**: US4 complete — staff oversight and close are operational and scoped

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, determinism proof, the full quality gate, the constraint audit, and the walkthrough validation record

- [X] T027 [P] Extend `docs/development.md`: the Phase 6 suites (what the session schema and RPC matrices, the abuse suite, the integration journey, the unit suites, and the e2e presentation matrix cover), the session data-layer posture (zero client grants, RPC-only surface, the partial unique index, the hashed-token storage), and the dev-token fixture discipline — plan.md Project Structure, research.md §1, §5, §7
- [X] T028 Reset-and-rebuild determinism (quickstart.md; SC-007): `npm run db:reset -- --yes` → `npm run db:seed` → `npm run test:db` green, and `npm run types:gen` output byte-identical to the committed `src/types/database.types.ts`
- [X] T029 Full quality gate from a clean state: `npm run verify` **and** `npm run test:e2e` both exit 0 with the extended suites; `package.json` unchanged (no new dependency, no new script) — SC-001…SC-008 evidence (depends on T028)
- [X] T030 [P] Constraint & boundary audit across the Phase 6 diff (`supabase/migrations/`, `supabase/seed.sql`, `scripts/db/seed.mjs`, `src/features/session/`, `src/features/auth/`, `src/routes/`, `src/app/router.tsx`, the test suites, `docs/development.md`): no service-role or secret keys anywhere; no new environment variables; no new dependency; **zero client grants on any session table**; guards and predicates presentation-only (Constitution IV); no payment, accounting, invoice, bill-splitting, discount, tip, service-charge, customer-account, notification, or dynamic-QR concept anywhere (Constitution I); no cart, round, kitchen-ticket, or realtime work (spec Out of Scope); every spec FR-001–FR-023 and SC-001–SC-008 maps to at least one task — audit record in the Notes section below
- [X] T031 Run the quickstart.md walkthroughs and record the results (Walkthrough A — the customer enters; Walkthrough B — join, no timeout, staff close; Walkthrough C — recovery and abuse; then restore the development project with `npm run db:reset -- --yes && npm run db:seed`) and append the validation record to `specs/007-customer-sessions/quickstart.md`
- [ ] T032 Final commit and push of all Phase 6 artifacts (the two migrations under `supabase/migrations/`, `supabase/seed.sql` + `scripts/db/seed.mjs`, the `src/features/session/` module, the route and auth-module edits, regenerated `src/types/database.types.ts`, the test suites, `docs/development.md`, and the spec artifacts) to GitHub `main` — mirrors feature 006's final task (depends on T029–T031)

---

## Dependencies

**Story completion order**: US1 and US2 both depend only on Phase 2; US3 depends on US1 (entry issues the token) and US2 (close exists for the reassociation proof); US4 depends on US2 (the close action) — the spec's P1/P1/P2/P3 priorities encode this.

- **Critical path**: T001 → T002–T008 → T009–T015 (US1) → T016–T019 (US2) → T020–T023 (US3) → T024–T026 (US4) → T027–T032
- US1's frontend (T009–T012) and US2's database semantics (T016) are independent once Phase 2 lands — the [P] markers reflect file-level independence, not story ordering.
- Polish: T027 ∥ T028 → T029 → T030 ∥ T031 → T032.

## Parallel Execution Examples

- **Phase 2**: T002 ∥ T003 → T004 → T005 → T006 → T007 ∥ T008
- **US1**: T009 ∥ T010 → T011 → T012 → T013 ∥ T014 ∥ T015
- **US2/US3/US4**: mostly sequential within the shared suites; T017 ∥ T018

## Implementation Strategy

- **MVP first**: Phase 2 + US1 alone deliver the master plan's exit condition ("a real customer can enter securely … without creating a normal account") — demoable after Phase 3.
- **Incremental delivery**: each story's checkpoint leaves the system in a working state; the shared matrix (T008) grows by blocks rather than rewrites.
- **The abuse suite is a deliverable**: SC-002's 100%-denial proofs (T020) land as code, not narrative — Risk 5's mitigation is enforced by the task structure.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Migrations are created only via `supabase migration new <name>` and applied only via `npm run db:migrate`; the seed only via `npm run db:seed`; types only via `npm run types:gen` — the single canonical workflow (FR-022)
- **Zero client grants** on `sessions`, `session_participants`, `session_tokens` — the seven RPCs are the only surface; participant PII and token hashes are never directly row-readable (research §5; Constitution IV/V)
- The dev tokens are deterministic development-only constants (documented in `tests/database/helpers/fixtures.ts`, mirrored by `supabase/seed.sql`) — never secrets
- Customer open/join events produce no audit records (the actor is not an authenticated identity); the staff close is the one audited event (FR-018)
- No timeout mechanism of any kind exists — no cron, no `expires_at`, no lazy-expiry predicate (FR-008; SC-006)
- The audit of T030 re-proves the zero-grant and no-account boundaries after implementation

### Constraint & boundary audit (T030, recorded after implementation)

- **No secrets**: no service-role or secret keys anywhere in the Phase 6 diff (`src/features/session/`, the routes, migrations, seed, tests) — the only "secret" mentions are the documented development-only dev-token constants and their "never secrets" caveat.
- **No new environment variables**: `.env.example` and `package.json` untouched (empty diffs); the suites reuse `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_DB_URL`.
- **No new dependency**: `package.json` unchanged; the unit suite's `localStorage` shim stands in for jsdom (the zero-dependency choice, Constitution VIII).
- **Zero client grants**: the schema migration contains no `GRANT` on any of the three session tables (grep-verified); the RPC migration grants `EXECUTE` on the five customer functions to `anon, authenticated` and the two staff functions to `authenticated` — the RPCs are the only surface.
- **Presentation-only predicates**: `canViewSessions`/`canCloseSession` follow the established coarse-owner posture (a bare branch id cannot resolve restaurant ownership) with the RPC scope checks as the boundary — documented in code and proven by the `42501` matrix.
- **Constitution I**: no payment, accounting, invoice, bill-splitting, discount, tip, service-charge, customer-account, notification, or dynamic-QR *concept* appears in the diff. Reviewed and cleared: the entry page's not-found copy mentions "the QR code" as the source of the customer's link — user-facing copy about the static entry link (the master plan's Phase 6 IS QR entry), not a dynamic-QR feature.
- **Out of Scope held**: no cart, round, kitchen-ticket, or realtime work anywhere in the diff.
- **Coverage**: FR-001–FR-023 and SC-001–SC-008 each map to at least one implemented task (the pre-implement analysis' C1 fix included); every story's suites execute green (T028–T029 evidence: 343/343 database, verify exit 0, e2e 64/64).
