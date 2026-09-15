# Implementation Plan: Auth and RBAC (Phase 2)

**Branch**: `003-auth-and-rbac` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-auth-and-rbac/spec.md`, including the Clarifications of 2026-09-15 (staff list limited to owners and branch managers; minimal super-admin scope — platform admin area only, no cross-tenant restaurant data; unified multi-membership staff area with in-dashboard context selection). Backend remains **Supabase Cloud** (the Phase 0 owner directive: no local stack, no Docker; the CLI is used only for migrations, type generation, and sync). The phase builds directly on the Phase 1 data layer of `specs/002-database-and-tenancy` (tenancy schema, `private` scope-resolution helpers, RLS policies, audit foundation, seeded fixtures) and the Phase 0 routing shell.

## Summary

Complete the identity linkage feature 002 deferred (FR-003): link each seeded staff profile to a real Supabase Auth identity, enforced by a data-layer foreign key `profiles.auth_user_id → auth.users(id)`. Provisioning uses deterministic SQL inserts into `auth.users`/`auth.identities` from the existing seed (bcrypt via pgcrypto, fixed UUIDs matching `fixtures.ts`) — a mechanism **verified live against the cloud project during research** (sign-in returns a JWT whose `sub` is the deterministic UUID, so every Phase 1 policy and helper resolves real identities unchanged). On top of that linkage, add the role dimension to the data-layer boundaries (FR-007): `staff_memberships` visibility narrows from "any staff of the restaurant" to *own rows* plus *owners and branch managers* (the staff list), and `profiles` becomes client-readable for the first time with the same own/managed split — `restaurants`, `branches`, and `dining_tables` policies already match master plan §30 exactly and stay unchanged. Three new `security definer` helpers in the `private` schema (`staff_profile_ids`, `managed_restaurant_ids`, `managed_staff_profile_ids`) extend the Phase 1 helper family, and one public RPC — `public.current_auth_context()`, security invoker, reading only what the caller's own policies allow — becomes the single resolution path (FR-010) for both route guards (presentation) and the staff area's unified multi-membership context selection (FR-015).

The frontend gains the staff sign-in experience: a sign-in page (the platform's generic, non-enumerating rejection — live-verified — surfaced as one message, FR-002), a session provider on `onAuthStateChange` (SDK-localStorage persistence satisfies FR-016; sign-out uses `{ scope: 'local' }` per the spec's current-device assumption), password recovery via `resetPasswordForEmail` → `PASSWORD_RECOVERY` → `updateUser` (FR-018), and presentation-only route guards that redirect unauthenticated visitors with return-to (FR-013) and reject deep links to unauthorized views rather than hiding them (FR-014) — never the security boundary (Constitution IV). Security is proven by an extended automated matrix: the database suite re-runs the Phase 1 isolation categories plus the role dimension (staff-list denial, membership-removal, forged-claims, super-admin posture) with the real seeded identity ids, a new integration suite signs in as every seeded role through the real Auth API and reads data through the real data API (FR-020, SC-001–SC-003), and Playwright walks the route matrix (SC-006). Public sign-ups are disabled through a documented platform-configuration step (FR-022/FR-023) — the deny-by-default data layer (live-verified: an authenticated identity with no linked profile reads nothing) remains the enforcement boundary regardless.

No staff account management (Phase 3), no super-admin platform capabilities (Phase 13), no customer identity (Phase 7), no custom claims/access-token hooks (unjustified — Constitution VIII), and no authentication events in the tenant audit store (spec Assumptions) are included.

## Technical Context

**Language/Version**: TypeScript (React 19, Vite) for the application; SQL (PostgreSQL 17.6 on the configured Supabase Cloud project — live-confirmed 17.6.1) for migrations, policies, and functions. No new runtime dependencies: `@supabase/supabase-js` ^2.116 already ships the full auth client surface used here.

**Primary Dependencies**: Existing stack only — `@supabase/supabase-js` (password grant, session, recovery), `react-router` (guards/redirects), `@tanstack/react-query` (effective-context server state), Supabase CLI (migrations, `gen types`), `pg` (database tests + seed provisioning), Vitest, Playwright. pgcrypto (pre-installed on the project — live-verified) for seed bcrypt hashes.

**Storage**: Supabase Cloud PostgreSQL plus **Supabase Auth (GoTrue)** — staff identities live in the platform-managed `auth.users`/`auth.identities` tables (referenced, never duplicated); sessions persist in browser localStorage via the SDK default; business/tenant state stays in the Phase 1 `public`/`private` schemas. No new schemas, no realtime, no storage buckets.

**Testing**: Vitest unit tests (guard/route-permission matrix), the extended database suite (`tests/database/` — simulated identities with the *real* seeded auth ids inside rolled-back transactions), a **new integration suite** (`tests/integration/` — real `signInWithPassword` against the cloud Auth API, data reads through the typed client, scratch identities provisioned via SQL for password-change assertions), and Playwright e2e (`e2e/` — redirect, sign-in, sign-out, guard-denial routes). Email-rate-limit-aware: no automated test sends real recovery emails (hosted inbuilt SMTP allows 2/hour — live-confirmed).

**Target Platform**: Supabase Cloud (region eu-west-1) + browser SPA (Vite dev server at `http://localhost:5173`); tests run from developer machines (Windows primary).

**Project Type**: Web application (SPA + managed data/auth layer).

**Performance Goals**: Engineering guidance, not spec gates: policy predicates keep the wrapped `(select …)` initPlan form (per-statement evaluation); `current_auth_context()` resolves the whole effective context in one RPC round-trip; the extended database + integration suites complete within the existing test-suite budgets (a few minutes against the cloud project).

**Constraints**: Supabase Cloud only (no local stack, no Docker); every schema/policy change through the single canonical migration workflow, with the two dashboard-level **platform-configuration** steps of this phase (disable public sign-ups; allow the reset-password redirect URL) recorded in that same documented workflow (FR-023, research.md §14); no service-role/secret keys anywhere (seed provisioning uses the existing `SUPABASE_DB_URL` postgres role — live-verified writable); no new environment variables; no custom claims or access-token hooks (FR-009 posture, research.md §7); route guards are presentation-only (Constitution IV); authentication activity is not written to the tenant audit store (spec Assumptions); customers receive no accounts (FR-022); seed stays idempotent and deterministic.

**Scale/Scope**: Three migrations (identity linkage, RBAC policies, context RPC); three new private helpers + one public RPC; two policies replaced/added plus one new table grant; seed extension with six auth identities; ~5 new frontend modules/routes plus guards; three test-suite additions/updates (~50–60 new automated cases). Two platform-configuration steps. Six seeded sign-in identities covering every role.

All technical unknowns were resolved through the research phase, most of them **verified live against the configured cloud project** (deterministic auth-user provisioning, sign-in, generic rejection, real-API deny-by-default, grants denial) — see [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Business Scope Integrity | **PASS** | Authentication and role-based access are the approved platform's own concerns (master plan §6.1, §13). No payments, accounting, printing, or inventory. |
| II | Specifications Are the Source of Business Truth | **PASS** | Every design element traces to a spec FR or a 2026-09-15 clarification (staff-list visibility, minimal super-admin scope, unified staff area). The one mechanism choice the spec left open — whether credential-carried role information is used at all — is resolved as "not used" within master plan §13's fixed direction (research.md §7); no business rule is invented. |
| III | Multi-Tenant Isolation | **PASS** | Isolation gains a role dimension on top of Phase 1's tenant boundaries, all enforced in the database: narrowed `staff_memberships` policy, new `profiles` policy, unchanged tenant/branch policies, and an automated matrix that re-proves the Phase 1 categories with real authenticated sign-ins plus the new role cases (FR-020). |
| IV | Server-Enforced Authorization | **PASS** | Every access decision stays in grants + RLS policies + `private` helpers at the data layer, reached identically through the application, the data API, and direct database sessions (live-verified through the real API path). Route guards are declared presentation-only (Constitution IV; FR-008); forged credential claims are proven to grant nothing (FR-009, SC-003). |
| V | Database as the Source of Truth | **PASS** | Roles and scope resolve from `staff_memberships`/`profiles` through the helper family and one RPC — never from client state; the session token carries no authorization information (no custom claims). Client caches (react-query) are caches. |
| VI | Explicit State and Data Integrity | **PASS** | The one-to-one identity↔profile linkage becomes a declared foreign key plus the existing unique constraint (FR-003); the migration clears the synthetic orphan ids before enforcing it; access ends immediately when a membership is deleted (no derived state to drift). |
| VII | Auditability of Sensitive Operations | **PASS** | No new sensitive business operations exist in this phase; authentication events are deliberately not written to the tenant audit store (spec Assumptions — platform-level events lack a tenant scope; the platform retains its own records). The Phase 1 append-only audit posture is untouched. |
| VIII | Minimal and Intentional Complexity | **PASS** | No custom claims/access-token hook (nothing justifies one — research.md §7), no second authorization path (one helper family + one RPC), no new packages, no new schemas, no service-role credentials, three migrations, and exactly two dashboard settings. Platform-managed identity is consumed, not re-implemented. Every addition maps to a spec FR (see Complexity Tracking — no violations to justify). |

**Post-design re-check (after research.md / data-model.md / contracts / quickstart)**: all eight principles still PASS. No gate violations; Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-auth-and-rbac/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output ($speckit-plan command)
├── data-model.md        # Phase 1 output ($speckit-plan command)
├── quickstart.md        # Phase 1 output ($speckit-plan command)
├── contracts/
│   ├── supabase-auth-surface.md   # The platform Auth API surface this feature uses
│   ├── auth-client.md             # The application's auth client module operations
│   └── database-functions.md      # Authorization helpers + context RPC (extends feature 002's contract)
├── checklists/          # Spec quality checklists ($speckit-checklist inputs — unchanged by this command)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

Contracts: this project exposes three durable interfaces worth contracting — the Supabase Auth surface (how identities behave, including the seeded-identity provisioning contract), the auth client SDK operations the application builds on, and the database authorization helper functions that Phases 3+ will compose (master plan §34).

### Source Code (repository root — changes for this feature)

```text
/
├── src/
│   ├── app/
│   │   ├── App.tsx                        # CHANGED: AuthProvider wraps the router
│   │   └── router.tsx                     # CHANGED: /signin, /reset-password, guarded /dashboard/*, guarded /admin
│   ├── features/
│   │   └── auth/                          # NEW: the feature module (spec Key Entities: session, guards, context)
│   │       ├── authClient.ts              # NEW: typed wrapper over supabase.auth (contracts/auth-client.md)
│   │       ├── AuthProvider.tsx           # NEW: session state via onAuthStateChange; sign-in/sign-out actions
│   │       ├── useAuthContext.ts          # NEW: effective roles/scope via public.current_auth_context RPC (react-query)
│   │       └── guards.tsx                 # NEW: RequireAuth (redirect+return-to), RequireStaff, RequireSuperAdmin, NotAuthorized
│   ├── routes/
│   │   ├── SignInPage.tsx                 # NEW: staff sign-in (generic failure message — FR-002)
│   │   ├── ResetPasswordPage.tsx          # NEW: completes PASSWORD_RECOVERY with updateUser (FR-018)
│   │   ├── DashboardPage.tsx              # EXTENDED: unified staff area + in-dashboard context selector (FR-015)
│   │   ├── ProfilePage.tsx                # NEW: own profile + effective roles and scope (FR-011)
│   │   ├── StaffListPage.tsx              # NEW: restaurant staff list (owners + branch managers — FR-007)
│   │   └── AdminPage.tsx                  # EXTENDED: platform admin area shell (super admin only — FR-012)
│   └── types/
│       └── database.types.ts              # REGENERATED (npm run types:gen) — now includes current_auth_context
├── supabase/
│   ├── migrations/
│   │   ├── … (five existing migrations unchanged)
│   │   ├── <timestamp>_staff_identity_linkage.sql   # NEW: FK profiles.auth_user_id → auth.users(id) (+ orphan-id pre-step)
│   │   ├── <timestamp>_rbac_policies.sql            # NEW: 3 private helpers; staff_memberships policy; profiles policy + grant
│   │   └── <timestamp>_auth_context_rpc.sql         # NEW: public.current_auth_context() + execute grants
│   └── seed.sql                           # EXTENDED: six deterministic auth.users/auth.identities + profile re-link upsert
├── scripts/
│   └── db/
│       ├── seed.mjs                       # EXTENDED: report seeded auth identities
│       └── reset.mjs                      # EXTENDED: optional --purge-auth flag (restore fixture credentials)
├── tests/
│   ├── database/
│   │   ├── tenancy.rls.test.ts            # UPDATED: Phase 2 visibility matrix (role dimension added)
│   │   ├── auth.rbac.test.ts              # NEW: staff-list denial, profiles rules, membership removal, forged claims, super admin
│   │   └── helpers/fixtures.ts            # EXTENDED: seeded emails + documented dev passwords
│   ├── integration/
│   │   └── auth.signin.test.ts            # NEW: real sign-ins for every seeded role; RPC context; API-path data matrix
│   ├── unit/
│   │   └── auth.guards.test.tsx           # NEW: guard/route-permission decision matrix
│   └── setup-env.ts                       # unchanged
├── e2e/
│   ├── routes.test.ts                     # unchanged (public routes)
│   ├── smoke.test.ts                      # unchanged
│   └── auth.routes.test.ts                # NEW: redirect / sign-in / sign-out / guard-denial route matrix
├── docs/
│   └── development.md                     # EXTENDED: platform-configuration steps + auth test suites + credential reset runbook
└── package.json                           # CHANGED: one new script — "test:integration" (vitest run tests/integration), included in verify; no new dependencies
```

**Structure Decision**: No new top-level directories. Frontend work lands in the Phase 0 layout — the auth feature module under `src/features/auth/` (first consumer of the reserved `features/` directory), pages under `src/routes/`. Database work extends the Phase 1 layout (`supabase/migrations/`, `seed.sql`); test work extends `tests/database/` and activates the reserved `tests/integration/`. The `auth` schema is a platform-managed construct (not a repository directory): the seed writes the two documented tables (`auth.users`, `auth.identities`) and nothing else there.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None. No Constitution violations were identified; no complexity requires justification. The additions that touch platform-managed territory — the seed's direct inserts into `auth.users`/`auth.identities` and the FK from `profiles` — are each the minimal documented mechanism for the requirements (FR-021 deterministic login-capable identities without service-role keys; FR-003 declared and enforced linkage, referencing only the primary key as official guidance requires), with alternatives evaluated and rejected in [research.md](./research.md) and the exact write contract fixed in [contracts/supabase-auth-surface.md](./contracts/supabase-auth-surface.md).
