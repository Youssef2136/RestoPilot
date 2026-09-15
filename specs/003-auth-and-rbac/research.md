# Research: Auth and RBAC (Phase 2)

**Feature**: 003-auth-and-rbac | **Date**: 2026-09-15

Decisions resolving every technical unknown for the authenticated staff layer.
Each entry records the decision, rationale, and alternatives considered.
Supabase guidance was re-verified against the official documentation (auth
guides, database functions, rate limits, sign-out scopes) during this research.
The critical unknowns — deterministic seeded identities, credential-rejection
genericity, and the real-API deny-by-default path — were **verified live against
the configured cloud project** (`yyghtaimzjsclolcwzrg`, PostgreSQL 17.6.1), the
same research posture as feature 002. All probe artifacts were removed; the
database was returned to its pre-research state (0 auth users).

---

## 1. Seeded staff identities: deterministic SQL inserts into `auth.users` + `auth.identities` (spec FR-021, SC-007)

**Decision**: `supabase/seed.sql` provisions six login-capable auth identities
by direct SQL insert (the seed already runs as the postgres role via
`SUPABASE_DB_URL`), with fixed UUIDs equal to the existing synthetic
`profiles.auth_user_id` values (`…2001`–`…2006` — unchanged, so
`tests/database/helpers/fixtures.ts` and every Phase 1 policy keep working
against real identities):

```sql
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current, created_at, updated_at
) values (
  '<deterministic uuid>', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', '<name>@restopilot.dev',
  crypt('<documented dev password>', gen_salt('bf', 10)),
  now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', '', '', now(), now()
) on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at)
values (
  '<same deterministic uuid>', '<same deterministic uuid>', 'email', '<same deterministic uuid>',
  '{"sub":"<uuid>","email":"<name>@restopilot.dev","email_verified":true}'::jsonb, now(), now()
) on conflict (id) do nothing;
```

**Verification (2026-09-15, live against the cloud project)**: a probe user
inserted exactly this way **signed in successfully through the real Auth API**
(`POST /auth/v1/token?grant_type=password`) with HTTP 200; the returned JWT
carries `sub` = the deterministic UUID, `role` = `authenticated`, ~3600 s
expiry. Every column in the insert above is load-bearing — see decision 2.
Idempotency: `on conflict (id) do nothing` keeps re-runs and `db:reset`
cycles convergent (the reset drops `public`/`private` but not `auth`, so
identities survive and the re-created profiles re-link to them).

**Alternatives considered**:
- Auth admin API (`auth.admin.createUser` — supports a custom `id` and even
  `password_hash`) — rejected: requires a secret key (`sb_secret_…`/legacy
  service-role); the project has a standing no-secret-keys constraint
  (Phase 0/1; Constitution VIII; master plan §5.5).
- Client `signUp` with the publishable key — rejected: creates users with
  random ids (breaking the deterministic fixture), sends confirmation emails
  (hosted projects enable confirmations by default — and this project's
  request passed validation and hit the email rate limiter during the probe),
  and depends on public sign-ups being enabled, which this phase disables
  (decision 14).
- Keeping synthetic ids and simulating forever — rejected by the spec: Phase 2
  must prove its behaviors with real authenticated sign-ins (FR-020, SC-002).

## 2. The exact auth-user insert contract (spec FR-021; live-verified failure modes)

**Decision**: The seed's insert shape is part of the contract
([contracts/supabase-auth-surface.md](./contracts/supabase-auth-surface.md)).
Three fields are non-obvious and each was proven necessary live:

- `instance_id = '00000000-0000-0000-0000-000000000000'` — the column
  defaults to NULL, but GoTrue scopes user lookups by instance id. With NULL,
  a valid email+password is rejected as `Invalid login credentials` (the
  ~90 ms response time is GoTrue's dummy-hash compare — the user was never
  found).
- The four token columns (`confirmation_token`, `recovery_token`,
  `email_change`, `email_change_token_new`/`_current`) must be **empty
  strings, not NULL** — NULL makes GoTrue's row scan fail with a 500
  (`sql: Scan error … converting NULL to string is unsupported`), read from
  the project's auth logs during the probe.
- `email_confirmed_at` must be set — hosted projects enable email
  confirmations by default (official docs), and unconfirmed users cannot
  sign in.

**Rationale**: these are exactly the fields GoTrue reads on the password
grant; the seed is the only place in the system that creates identities this
way (Phase 3 moves provisioning into the admin flows), so the knowledge is
encoded once, in the contract.

**Alternatives considered**: deriving the shape by copying a GoTrue-created
user — rejected: creating one requires sign-up (disabled after this phase)
or admin API (secret key); the probe-verified shape is cheaper and stays in
the seed.

## 3. Seeded email domain: `<name>@restopilot.dev` (spec FR-021, Assumptions)

**Decision**: Seeded identities use `alice@restopilot.dev` …
`platform-admin@restopilot.dev`.

**Verification (live)**: current GoTrue validates email addresses beyond
syntax: `research-probe@restopilot.example` and `…@example.com` are both
rejected (`email_address_invalid`), while `…@restopilot.dev` passes. The
reserved documentation domains (`.example`, `example.com`, `.test`) cannot be
used for seed identities.

**Rationale**: the domain passes platform validation, is clearly
project-identifiable, and is documented as development-only. Password
recovery emails to it will not deliver to a real inbox — the recovery-link
retrieval path for development is the quickstart's manual validation
(decision 13).

**Alternatives considered**:
- `example.com` / `.test` — rejected (live-verified rejected by GoTrue).
- A public provider domain (e.g. gmail) — rejected: recovery mails to real
  third-party inboxes would leak dev links.

## 4. Seeded passwords and hashing: documented dev values, bcrypt cost 10 via pgcrypto (spec FR-021, Assumptions)

**Decision**: Each fixture identity gets a documented, development-only
password (scheme: `dev-<name>-2026`, tabulated in
[data-model.md](./data-model.md)), hashed at seed time with
`crypt(password, gen_salt('bf', 10))`. pgcrypto is pre-installed on the
project (live-verified). Cost 10 matches GoTrue's own default for new users.

**Rationale**: no new npm dependency (Node has no built-in bcrypt), no
pre-computed hash constants to maintain, and dev credentials stay visible in
one place. `db:reset` never restores a manually changed password (the auth
schema survives resets), so `scripts/db/reset.mjs` gains an optional
`--purge-auth` step (delete the six `@restopilot.dev` users after the schema
drop, before migrate+seed) as the scripted credential-restore runbook.

**Alternatives considered**:
- bcrypt npm package in the seed script — rejected: new dependency for
  nothing (pgcrypto already there).
- Fixed pre-computed hash literals — rejected: opaque constants that must be
  regenerated by external tooling when a password changes.

## 5. Identity↔profile linkage: FK to `auth.users(id)`, no cascade, with an orphan-clearing pre-step (spec FR-003)

**Decision**: Migration 1 (`staff_identity_linkage`) first clears linkage
rows that point at non-existent auth users
(`update public.profiles set auth_user_id = null where … not exists (select 1
from auth.users u where u.id = profiles.auth_user_id)` — on the current
development database this nulls the synthetic ids feature 002 seeded), then
adds `foreign key (auth_user_id) references auth.users(id)` with the default
`no action`. Combined with the existing `unique` on `auth_user_id`
(feature 002), the one-to-one linkage is declared and enforced by the data
layer in both directions (each identity at most one profile; each linkage
must reference a real identity). Official guidance is satisfied in that only
the primary key of `auth.users` is referenced.

**Rationale**: deleting an auth user that a profile still links to fails
loudly instead of silently cascading — the Phase 1 no-cascade posture
(research 002 §15) extended to the identity edge, and Constitution VI's
explicit-transitions rule. The pre-step keeps `npm run db:migrate` a valid
path on the existing database (otherwise the FK validation would fail on the
synthetic ids); the seed then re-establishes the real linkage (profiles
upsert gains `on conflict (id) do update set auth_user_id =
excluded.auth_user_id`).

**Alternatives considered**:
- `on delete cascade` (the shape shown in official docs) — rejected: silent
  destruction of person records is the exact behavior Phase 1 rejected;
  membership rows would restrict anyway, producing half-deleted states.
- Adding the FK without the pre-step and requiring `db:reset` for rollout —
  rejected: the canonical workflow (`db:migrate`) must stay valid (FR-023).

## 6. Credential-rejection genericity: provided by the platform (spec FR-001/FR-002, US1 scenario 2)

**Decision**: Use the platform's rejection as-is. The sign-in UI shows one
generic message for every failed attempt and never dissects the error.

**Verification (live)**: wrong password for an existing account, and a
correct-format request for a non-existent account, both return
`400 {"error_code":"invalid_credentials","msg":"Invalid login credentials"}`
— byte-identical responses. No account enumeration, no "which part was
wrong".

**Alternatives considered**: mapping/normalizing errors client-side —
rejected: unnecessary (the platform already unifies) and it would risk
introducing distinguishing behavior.

## 7. No custom claims, no access-token hook in Phase 2 (spec FR-009, SC-003; master plan §13)

**Decision**: No `auth.hook.custom_access_token`, no role/scope claims in the
JWT. The access token carries only what the platform puts there (`sub`,
`role: authenticated`, `email`, expiry). Roles and scope are resolved from
the database at read time by the helper family (decision 8).

**Rationale**: master plan §13 allows custom claims "where justified" and
demands they "support, never replace, database authorization". Nothing in
Phase 2 justifies them: every enforcement point already reads memberships in
the database; the client needs the effective context exactly once per
session/load (one RPC, cached by react-query). Omitting claims makes FR-009
provable in its strongest form — there is no credential-carried role
information to misuse — while the test matrix still forges claims (via
`request.jwt.claims` simulation) and proves they grant nothing (SC-003).
Revisit only if a later phase demonstrates a concrete need (e.g. external
systems consuming tokens); that phase owns the justification.

**Alternatives considered**:
- Custom claims (roles/scope in the JWT via access-token hook) — rejected as
  unjustified complexity (Constitution VIII) plus a staleness surface
  (claims lag membership removal, contradicting FR-006's immediacy).
- Claims as an authorization source — never (Constitution IV; spec FR-009).

## 8. Authorization helpers: extend the `private` family + one public context RPC (spec FR-004, FR-010)

**Decision**: Three new `security definer` functions in `private` (same
discipline as feature 002: `stable`, `set search_path = ''`, schema-qualified
bodies, execute granted to `authenticated`, revoked from `public`/`anon`):

- `private.staff_profile_ids(p_user uuid) → setof uuid` — profile(s) linked
  to the auth identity (at most one by uniqueness).
- `private.managed_restaurant_ids(p_user uuid) → setof uuid` — restaurants
  where the identity holds an `owner` **or** `branch_manager` membership
  (the staff-list visibility set, FR-007).
- `private.managed_staff_profile_ids(p_user uuid) → setof uuid` — profile
  ids holding any membership in those managed restaurants (the
  linked-profiles arm of the staff list).

Plus one **public** RPC — `public.current_auth_context() returns jsonb`,
`language sql`, `stable`, **security invoker**, `set search_path = ''` —
returning the caller's own resolved context
(`{ profile: {id, display_name, is_super_admin} | null, memberships:
[{restaurant_id, restaurant_slug, restaurant_name, role, branch_id,
branch_name}] }`) by reading `profiles`, `staff_memberships`, `restaurants`,
and `branches` **under the caller's own RLS**. Execute revoked from
`public`/`anon`, granted to `authenticated`. It appears in the regenerated
types (`Functions` section already exists in `database.types.ts`).

**Rationale**: FR-010 demands one consistent resolution path used by all
authorization checks. The policies use the `private` helpers (definer —
recursion-safe, per-statement initPlan form, feature 002's proven pattern);
the route guards and the staff area get the same resolution through the RPC.
Making the RPC an *invoker* means it can never disclose anything the
policies don't already allow — the policies stay the single source of the
rules, and the RPC is their read-through projection. `jsonb` shape (rather
than a table type) lets one call carry the profile even when memberships are
empty — required so a super admin (profile, no memberships) is
distinguishable from an unlinked identity (no profile) for guard decisions.

**Alternatives considered**:
- Client derives context from raw table selects — rejected: re-implements
  role mapping in the client (no single path; Constitution V smell).
- Security-definer RPC returning own rows directly — rejected: a second,
  policy-bypassing source of the visibility rules; the invoker form cannot
  drift from the policies.
- Extending `staff_restaurant_ids` et al. to return roles (breaking shape
  change) — rejected: feature 002's contract is additive-only
  (contracts/database-functions.md, stability commitments).

## 9. Phase 2 policy matrix: narrow memberships, add profiles, leave the rest (spec FR-007; master plan §30)

**Decision** (full matrix in [data-model.md](./data-model.md)):

- `staff_memberships` **select policy replaced**: visible rows =
  own-profile rows **or** rows of restaurants in
  `managed_restaurant_ids(auth.uid())` (Phase 1 granted them to *any* staff
  of the restaurant; feature 002 FR-009 explicitly deferred this narrowing to
  Phase 2). Reading your own membership rows is self-knowledge (FR-011), not
  the staff list.
- `profiles` **select policy created** (its first client access ever; grant
  `select` to `authenticated` alongside): own profile
  (`auth_user_id in staff_profile_ids(auth.uid())`) or a profile in
  `managed_staff_profile_ids(auth.uid())` — the "linked profiles' basic
  information" half of the staff list (FR-007, Clarifications 2026-09-15).
- `restaurants`, `branches`, `dining_tables` **unchanged**: the Phase 1
  policies already encode §30 exactly (owners see every branch of their
  restaurant; branch-scoped roles see only their assigned branch; every
  staff member can read their restaurant's own record — the FR-007 baseline).
- `audit_log`, `app_meta` **unchanged** (deny-by-default / Phase 0 posture).
- Super admin: **no** policy or grant anywhere reads `is_super_admin` — the
  capability grants no restaurant data access (FR-012); it is only readable
  by the holder via the own-profile arm of the context RPC.

**Rationale**: this is exactly the spec's FR-007 matrix, layered on the
untouched tenant/branch boundaries. Example consequences the tests assert:
Eve (owner of Cedar Grill, cashier of Downtown) can read Cedar Grill's staff
list but not Blue Olive's; cashiers and kitchen staff cannot read any staff
list; every staff member still reads their restaurant's own record.

**Alternatives considered**:
- A `staff_list` view instead of two policy arms — rejected: views bypass
  RLS by default (feature 002 research §4 already rejected views).
- Restricting `staff_memberships` to managers only (no own-rows arm) —
  rejected: breaks FR-011 (own roles/scope) and the context RPC's read path.

## 10. Frontend auth architecture: one feature module, presentation-only guards (spec US3, FR-013–FR-015; master plan §38)

**Decision**: `src/features/auth/` owns the auth client wrapper
(`authClient.ts`), the session provider (`AuthProvider` on
`onAuthStateChange`), the context hook (react-query over the RPC), and the
guards. Route layout:

- `/signin` (public) — after success, navigate to the remembered
  destination (`location.state.from`), else the default landing
  (super admin without memberships → `/admin`; staff → `/dashboard`).
- `/dashboard` (requires authentication **and** ≥1 staff membership) — the
  unified staff area across all memberships with an in-dashboard
  restaurant/branch context selector (FR-015); sub-views `/dashboard/profile`
  (own roles/scope, FR-011) and `/dashboard/staff` (staff list; requires
  owner/branch-manager scope for the selected restaurant, FR-007).
- `/admin` (requires `is_super_admin`) — the platform admin area shell; no
  restaurant data is fetched there (FR-012).
- `/reset-password` (public page, session-bearing) — completes recovery by
  listening for the `PASSWORD_RECOVERY` event and calling
  `updateUser({ password })`.
- Guard behavior: **unauthenticated** → redirect to `/signin` carrying the
  requested location (FR-013); **authenticated but unauthorized** → an
  explicit NotAuthorized view — deep links are rejected, not hidden
  (FR-014). Navigation lists only permitted entries (UX only, master plan
  §38; Constitution IV — the data layer remains the boundary).

**Rationale**: extends the Phase 0 shell without restructuring; the first
`src/features/` module follows the reserved layout. Guards consume the RPC
context — never raw table state — so presentation and enforcement read the
same resolution path (FR-010).

**Alternatives considered**:
- A forced restaurant/role chooser at sign-in — rejected by the spec
  (FR-015, Clarifications 2026-09-15).
- Guard logic inside each page — rejected: one guard module keeps the
  route-permission matrix unit-testable (tests/unit/auth.guards.test.ts).

## 11. Session persistence and sign-out: SDK defaults + explicit local scope (spec US4, FR-016/FR-017)

**Decision**: `supabase-js` defaults provide persistence (session in
localStorage, `autoRefreshToken` on — reloads and browser restarts keep the
member signed in; live-verified token expiry ~3600 s with refresh handled by
the SDK). Sign-out calls `supabase.auth.signOut({ scope: 'local' })` —
**explicitly**, because the JavaScript SDK's default scope is `global`
(terminates every device's session), which contradicts the spec's assumption
("sign-out ends the session on the current device; concurrent sessions on
other devices are permitted"). The SPA is client-rendered; no SSR/cookie
machinery is introduced.

**Rationale**: official docs state the JS default is `global` and recommend
`local` for "the behavior most other auth libraries default to" — the spec's
assumption matches `local`.

**Alternatives considered**: accepting the `global` default — rejected:
silently ends other devices' sessions, contradicting the approved
assumption; custom storage/SSR — rejected: unrequested complexity
(Constitution VIII).

## 12. Password recovery: the platform's reset flow, rate-limit-aware testing (spec US5, FR-018/FR-019, SC-005)

**Decision**: The flow is the official one — `resetPasswordForEmail(email,
{ redirectTo: '<app>/reset-password' })` sends a time-limited, single-use
recovery link (default OTP/recovery expiry 3600 s); the link establishes a
session and fires `PASSWORD_RECOVERY`; the reset page collects a new
password and calls `updateUser({ password })`; the previous password stops
working; profile/memberships are untouched (FR-019 — only the credential
changes).

**Operational constraints (live-verified + documented)**: hosted projects
using the inbuilt SMTP may send **2 auth emails per hour** (the probe hit
`over_email_send_rate_limit`), and `/auth/v1/recover` enforces a 60-second
window between requests. Therefore: **automated tests never send recovery
emails**. The automated coverage is (a) the recovery request for a
*non-existent* email returns the same generic response as the valid case
(no enumeration; no email is sent for unknown addresses), and (b) the
post-change properties (new password signs in, old password rejected,
memberships unchanged) are proven with a **scratch identity** the
integration suite provisions via the verified SQL pattern and deletes
afterwards. The full email-link path (delivery, expiry, single-use) is a
**manual quickstart validation**, rate-limit aware.

**Alternatives considered**:
- Automated full-flow recovery — rejected: needs real email access (custom
  SMTP = new secrets; the dashboard email log is a human read) and would
  exhaust the 2/hour budget on the second suite run.
- Skipping recovery automation entirely — rejected: the generic-response
  and post-change properties are automatable without emails and prove most
  of US5's scenarios.

## 13. Platform configuration: two dashboard settings, recorded in the canonical workflow (spec FR-022, FR-023)

**Decision**: Phase 2 requires exactly two platform (dashboard) settings on
the development project, applied and verified through the documented
workflow (recorded in `docs/development.md` alongside the migration
workflow — one canonical place, no parallel practice):

1. **Disable public sign-ups** ("Allow new users to sign up" off /
   email-provider signups disabled). Live probe shows sign-ups are
   currently enabled (the request passed validation and attempted to send
   the confirmation email). Staff provisioning arrives with Phase 3; there
   is no self-service account path in this phase.
2. **Allow the recovery redirect URL** — add `http://localhost:5173/**`
   (the dev origin) to the Auth URL configuration so recovery links may
   redirect to the SPA.

**Rationale**: hosted auth settings are not migration-controlled; the
honest, minimal mechanism is to record them as explicit, verifiable steps
in the same documented workflow (FR-023's intent: no ad-hoc, no parallel
practice). Security does not depend on the signup toggle: an authenticated
identity with no linked profile reads nothing (live-verified through the
real API path — empty results everywhere, writes denied 42501 by grants);
deny-by-default is the boundary (Constitution IV).

**Alternatives considered**:
- Management-API scripting of auth config — rejected: requires a personal
  access token (new secret; more machinery than two documented toggles —
  Constitution VIII).
- `before_user_created` hook rejecting all signups — rejected: the hook's
  *enablement* is itself dashboard configuration, so it adds a function and
  a config step to achieve what one toggle does.

## 14. Test architecture: three complementary suites (spec FR-020, SC-001–SC-006; master plan §40–§41)

**Decision**:

- **Database suite** (`tests/database/`, rolled-back transactions,
  feature 002's mechanism): `auth.rbac.test.ts` adds the role dimension —
  staff-list visibility per role (FR-007), profiles read rules, membership
  removal ending access within the same transaction (FR-006), forged JWT
  claims (`app_role`/`resto_scope` injected via `request.jwt.claims`)
  granting nothing (FR-009, SC-003), super-admin data denial (FR-012).
  `tenancy.rls.test.ts` is **updated** to the Phase 2 visibility matrix —
  its Phase 1 expectations (memberships visible to any staff of the
  restaurant) are narrowed by design; the four isolation categories
  (cross-restaurant, cross-branch, scope bypass, direct access) re-run
  against the real seeded identity ids, which equal the existing
  deterministic UUIDs (decision 1) — the simulation helpers are unchanged.
- **Integration suite** (`tests/integration/auth.signin.test.ts`, NEW
  against the cloud project using the publishable key): every seeded
  identity signs in with `signInWithPassword` (real Auth API); the
  effective context from the RPC must match the seeded membership matrix
  exactly (SC-001, SC-007); data reads through the typed client prove the
  in-scope/out-of-scope matrix through the real data API (SC-002); the
  generic-rejection property re-checked through the SDK (FR-002); the
  password-change round-trip runs on a scratch identity (decision 12).
  Sign-in rate limit: 30 sign-ins per 5 minutes per IP — the suite stays
  well under it (~15).
- **E2E** (`e2e/auth.routes.test.ts`): unauthenticated `/dashboard` and
  `/admin` redirect to `/signin` with return-to (FR-013); seeded sign-in
  lands correctly; guard denial for deep links (`/dashboard/staff` as
  cashier → NotAuthorized, FR-014); sign-out re-protects (FR-017). The full
  per-role route matrix is proven in the unit suite (guard decisions) and
  the two server-side suites; e2e walks the representative paths (master
  plan §41 priority order — security first, dashboard UX last).

**Alternatives considered**:
- Only simulated identities (no real sign-ins) — rejected: FR-020/SC-002
  explicitly require real authenticated sign-ins; feature 002's
  clarifications anticipated exactly this re-run.
- Only real sign-ins (drop the simulation suite) — rejected: forged-claims,
  membership-removal, and grants-denial cases are only expressible in the
  direct-database harness (the "direct access" category).

## 15. Migration structure: three focused migrations (spec FR-023; feature 002 pattern)

**Decision**: `staff_identity_linkage` (FK + orphan pre-step),
`rbac_policies` (three private helpers; staff_memberships policy
replacement; profiles policy + grant), `auth_context_rpc`
(`public.current_auth_context()` + execute grants) — all via
`supabase migration new` + `npm run db:migrate`, types regenerated and
committed with them.

**Rationale**: the three layers have different review audiences and revert
stories (identity integrity vs authorization surface vs the new client API),
mirroring feature 002's structure.

**Alternatives considered**: one migration — rejected (mixes identity,
policy, and API surface in one review); one per object — rejected
(cross-dependent noise).

## 16. Unchanged surfaces (Constitution VIII)

**Decision**: `app_meta`, the audit foundation, realtime (no tables join the
publication), storage, Edge Functions, the customer-facing routes
(`/r/:slug`, `/order/:branchId` remain public placeholders), the four Phase
1 tenant tables' structure, and the existing `private` helper signatures are
all untouched. `types:gen` keeps `--linked --schema public` (the new RPC
appears; `private` functions intentionally do not). No new npm packages, no
new environment variables, no service-role/secret keys.

**Rationale**: minimal blast radius; every unchanged surface is already
covered by its own suite, which must keep passing.

**Alternatives considered**: adding realtime auth-event streams, signup
audit rows, or storage usage — all rejected (spec Out of Scope; master plan
§32/§37 sequencing).

---

## Follow-up notes (not Phase 2 scope)

- Phase 3 (staff management) replaces seed provisioning with the owner/
  invitation admin flows; the seeded-identity insert contract
  (contracts/supabase-auth-surface.md) remains the reference for any
  scripted/test identity creation.
- Phase 13 gives the super admin real platform capabilities; the
  `is_super_admin` flag and its (current lack of) policy integration are the
  extension point.
- Custom claims/access-token hooks remain available if a later phase
  justifies them (decision 7 records the bar).
- `docs/development.md`'s master-plan cross-reference annotation carried
  over from Phase 0 remains an owner-level task.
