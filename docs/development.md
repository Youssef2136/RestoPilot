# RestoPilot — Development Guide

How to set up, run, and work on RestoPilot. The backend is a configured
**Supabase Cloud** project — there is no local Supabase or PostgreSQL
instance and no Docker requirement. The Supabase CLI is used only for
source-controlled migrations, database type generation, and
deployment/synchronization against the cloud project.

Project conventions — where code goes, naming, and the feature workflow —
live in [conventions.md](./conventions.md).

## Prerequisites

| Tool                   | Version                            | Install / check                                                                                 |
| ---------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| Node.js                | 22 LTS+ (pinned by `.nvmrc`)       | <https://nodejs.org> — `node --version`                                                         |
| npm                    | bundled with Node                  | `npm --version`                                                                                 |
| Git                    | current stable                     | <https://git-scm.com> — `git --version`                                                         |
| Supabase CLI           | current stable                     | <https://supabase.com/docs/guides/local-development/cli/getting-started> — `supabase --version` |
| Supabase Cloud project | one configured development project | you need its URL, publishable key, project ref, and database connection string — see Setup step 5 |

Verify versions before starting. Missing or wrong-version prerequisites are
expected to fail with actionable messages rather than obscure downstream
errors.

## Setup (acceptance gate)

Follow these steps in order on a clean machine — every step must succeed as
written, with no undocumented manual fixes:

1. **Clone** the repository from its GitHub remote:
   `git clone <repository-url> && cd restopilot`
2. **Install dependencies**: `npm install`
3. **Authenticate the Supabase CLI**: `supabase login`
4. **Link the cloud project**:
   `supabase link --project-ref $SUPABASE_PROJECT_REF`
   (the Reference ID is in Project Settings → General)
5. **Configure the environment**: `cp .env.example .env`, then fill in the
   four values — `.env.example` documents exactly where to find each one
6. **Apply migrations**: `npm run db:migrate`
7. **Load seed data**: `npm run db:seed`
8. **Start the frontend**: `npm run dev` → <http://localhost:5173> —
   the application shell must load without errors
9. **Run tests**: `npm run verify` and then `npm run test:e2e`

Step 9's `verify` runs the full local pipeline: format check → lint → type
check → unit tests → database tests → auth integration tests → production
build. `test:e2e` starts its own dev server and exercises the route shell.
Both must pass.

The complete gate is expected to complete in **30 minutes or less** from a
clean machine using only this documentation (spec SC-001/SC-002).

## Daily commands

| Command                                   | What it does                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                             | start the frontend dev server                                                                                   |
| `npm run build`                           | type-check and build for production                                                                             |
| `npm run preview`                         | serve the production build locally                                                                              |
| `npm run lint`                            | run ESLint                                                                                                      |
| `npm run format` / `npm run format:check` | format the code / check formatting (Prettier)                                                                   |
| `npm run typecheck`                       | run the TypeScript compiler check                                                                               |
| `npm run test:unit`                       | run unit tests (Vitest)                                                                                         |
| `npm run test:db`                         | run database tests (precondition: reachable cloud project)                                                      |
| `npm run test:integration`                | run auth integration tests — real Auth API sign-ins against the cloud project (same precondition)               |
| `npm run test:e2e`                        | run end-to-end tests (Playwright; starts its own server)                                                        |
| `npm run verify`                          | full local pipeline: format:check → lint → typecheck → test:unit → test:db → test:integration → build           |
| `npm run db:migrate`                      | apply pending migrations to the cloud development database                                                      |
| `npm run db:seed`                         | apply `supabase/seed.sql` (idempotent)                                                                          |
| `npm run db:reset`                        | ⚠️ destructive: rebuild the cloud development database from zero (migrations + seed) — development project only |
| `npm run types:gen`                       | regenerate `src/types/database.types.ts` from the cloud schema                                                  |

## Database security tests

`npm run test:db` runs five suites against the cloud development database:

- `app_meta.test.ts` — Phase 0 baseline still intact.
- `tenancy.schema.test.ts` — the tenancy tables match the declared shapes;
  invalid data (cross-tenant references, duplicate identifiers, role/branch
  mismatches) is rejected by constraints.
- `tenancy.rls.test.ts` — the tenant-isolation matrix: cross-restaurant,
  cross-branch, bypass, and direct-access denial for every seeded actor, plus
  the positive within-scope paths (spec 002 FR-011) — re-proven since Phase 2
  against the real seeded identity ids under the narrowed visibility matrix
  (spec 003 FR-020).
- `auth.rbac.test.ts` — the Phase 2 role-aware matrix: staff-list visibility
  per role (owners and branch managers only), `profiles` read rules,
  membership-removal immediacy, forged-credential-claims immunity, and the
  super admin reading no restaurant tenant data (spec 003 FR-006/FR-007/
  FR-009/FR-012).
- `audit.test.ts` — the audit writer's contract and the append-only posture.

The security suites simulate acting identities by setting the Postgres role
and JWT claims exactly as the data API does for real requests, inside
transactions that are **always rolled back** — the shared development database
keeps no test residue. Precondition: a migrated and seeded database
(`npm run db:migrate && npm run db:seed`). Details and expected outcomes:
`specs/002-database-and-tenancy/quickstart.md`.

A failing isolation test is a security boundary failure, not a flaky test —
fix it before anything else.

## Auth test suites (Phase 2)

Phase 2 (auth and RBAC) added the authenticated layer to every test tier. All
three share the same cloud precondition as `test:db`: a migrated and seeded
development project (`npm run db:migrate && npm run db:seed`). What each
covers:

| Suite                                                                       | Command                                  | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/database/auth.rbac.test.ts` (plus the updated `tenancy.rls.test.ts`) | `npm run test:db`                        | The Phase 2 visibility matrix at the data layer: staff-list visibility per role, `profiles` read rules (own + managed), membership-removal immediacy, forged-claims immunity, super-admin denial; the four Phase 1 isolation categories re-run against the real seeded identity ids. Runs in rolled-back transactions — no residue.                                                                                                                                                                                                              |
| `tests/integration/auth.signin.test.ts`                                     | `npm run test:integration`               | Real Auth API sign-ins for every seeded identity (session subject = the deterministic UUID); the effective context from `current_auth_context` matches the seeded membership matrix exactly; generic, non-enumerating rejection of wrong-password and unknown-account attempts; the in-scope/out-of-scope data matrix per role through the real data API; deny-by-default for an unlinked scratch identity; the automatable password-recovery properties (generic response for unknown addresses, post-change round-trip on a scratch identity). |
| `e2e/auth.routes.test.ts` (plus `tests/unit/auth.guards.test.tsx`)          | `npm run test:e2e` / `npm run test:unit` | The route matrix in a real browser: unauthenticated `/dashboard` and `/admin` redirect to `/signin` with return-to and land back after a seeded sign-in; each role lands on its correct area; a deep link to an unauthorized view (`/dashboard/staff` as cashier) renders NotAuthorized — rejected, not hidden; the super admin reaches `/admin`; session persistence across reload and sign-out re-protection. The full per-role guard decision matrix is unit-tested.                                                                          |

**Rate-limit notes** (the suites are designed to stay under the platform
limits — research.md §12):

- **No automated test sends recovery emails** (hosted inbuilt SMTP allows
  2/hour). The integration suite makes exactly one recovery request per run,
  for a non-existent address, which sends no email. The full email-link path
  (delivery, expiry, single-use) is a manual walkthrough.
- **Sign-in rate limit**: 30 per 5 minutes per IP. The integration suite
  performs ~15 sign-ins per run and the e2e suite ~10 — each suite stays
  under the limit on its own; avoid running both (or repeated runs) in rapid
  succession within one 5-minute window.
- **Recovery endpoint window**: the platform enforces a 60-second window
  between recovery requests — leave at least 60 seconds between consecutive
  `test:integration` runs or the single recovery probe may be rate-limited
  (HTTP 429).

Expected outcomes per walkthrough, including the manual validation scripts
(per-identity sign-in experience, session persistence, rate-limit-aware
password recovery, sign-up posture):
[specs/003-auth-and-rbac/quickstart.md](../specs/003-auth-and-rbac/quickstart.md).

## Troubleshooting

### Missing environment variables

Any tool that needs configuration exits with a message naming the missing
variable(s) and points to `.env.example` (see Setup step 5). The system never
continues silently misconfigured.

### Cloud project unreachable

Symptoms: connection timeouts or DNS errors in `db:migrate`, `db:seed`,
`test:db`, or `types:gen`.

- Check the Supabase Dashboard: the project must be active (not paused).
- Verify `VITE_SUPABASE_URL` / `SUPABASE_DB_URL` point at the right project.
- Verify network access to `*.supabase.co` — corporate proxies and VPNs are a
  common cause.
- Copy connection strings and pooler hosts from the Dashboard → Connect
  dialog — the pooler host's cluster index cannot be derived from the region.
- Authentication failures (rather than timeouts) when connecting usually mean
  special characters in the database password need percent-encoding inside
  `SUPABASE_DB_URL`.
- Database tests have the reachable cloud project as a documented
  precondition; on connectivity failure they exit with clear guidance rather
  than ambiguous connection errors.

### Database in a partially migrated or unknown state

`npm run db:reset` rebuilds the database from zero using only repository
artifacts (migrations + seed), restoring a known-good state. It is
destructive and intended for the development project only.

### Wrong Node version

The project requires Node 22 LTS or newer (`.nvmrc`). Use `nvm use` or
install the LTS release; `engines.node` in `package.json` documents the same
constraint.

## Data-layer workflow (canonical)

There is exactly **one** way to change the database (spec FR-010). Do not
edit the schema through the Supabase Dashboard, ad-hoc SQL, or any other
path — every schema change flows through version-controlled migrations:

1. Create a migration: `supabase migration new <name>`
   (creates `supabase/migrations/<timestamp>_<name>.sql`)
2. Write the SQL in the new migration file.
3. Apply it to the cloud development database: `npm run db:migrate`
4. Regenerate types: `npm run types:gen`
   (updates `src/types/database.types.ts`)
5. Commit the migration file **and** the regenerated types together.

To rebuild the development database from zero at any time, run
`npm run db:reset` — destructive, development project only, asks for
confirmation, and runs drop → migrate → seed using only repository
artifacts. Higher environments receive the same migration files through the
Supabase CLI, never manual dashboard edits.

### Seeded auth credentials (reset runbook)

The six seeded staff identities (`alice@restopilot.dev` …
`platform-admin@restopilot.dev` — the credentials table is in
[specs/003-auth-and-rbac/data-model.md](../specs/003-auth-and-rbac/data-model.md))
live in the platform-managed `auth` schema, which `db:reset` does not touch:
**auth identities survive ordinary resets** and the seed's profiles upsert
re-links them. A manually changed fixture password (for example after the
manual password-recovery validation) is therefore never restored by
`npm run db:reset` or `npm run db:seed` alone. Restore it with:

```bash
npm run db:reset -- --yes --purge-auth
```

`--purge-auth` additionally deletes every `@restopilot.dev` user from
`auth.users` after the schema drop and before migrate + seed, so the seed
re-provisions the identities with the documented dev passwords. Development
project only — never point it at a production database.

**Failure mode — seed aborts with a unique-email violation**: a stray user
already holds one of the seeded emails (a leftover from a manual experiment —
the seed's `on conflict (id) do nothing` cannot absorb a _different_ user id
with the same email). Fix: run `npm run db:reset -- --yes --purge-auth` (the
purge deletes every `@restopilot.dev` user whatever its id), which rebuilds
and re-seeds in one step.

### Platform configuration (auth)

Hosted auth settings are not migration-controlled. The two settings this
project requires are part of this same canonical workflow (spec 003 FR-023):
recorded here as explicit, verifiable steps — never applied ad hoc.

| #   | Setting                                            | Why                                                                                                                                                                                                               | Dashboard path                                                                                                              |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Allow new users to sign up** — off               | Public self-service sign-up is disabled (spec 003 FR-022): staff identities exist only through provisioning (the development seed now; the Phase 3 invitation flows later), and customers never receive accounts. | Dashboard → **Authentication** → **Sign In / Up** → _Email_ provider → toggle **Allow new users to sign up** off → **Save** |
| 2   | **Redirect URLs** — add `http://localhost:5173/**` | The dev origin that password-recovery links may redirect to (prerequisite of spec 003 FR-018 — `resetPasswordForEmail` targets `/reset-password` on this origin).                                                 | Dashboard → **Authentication** → **URL Configuration** → **Redirect URLs** → add `http://localhost:5173/**` → **Save**      |

Both settings are applied and verified on the development project
(2026-09-15). Re-verify at any time from the repository root:

```bash
npx supabase config diff
# remote auth.enable_signup must be false            (setting 1)
# remote auth.additional_redirect_urls must include
#   http://localhost:5173/**                        (setting 2)
```

A self-service sign-up attempt against the Auth API (`POST /auth/v1/signup`
with the publishable key) is rejected with `signup_disabled` — "Signups not
allowed for this instance". Security does not rest on the toggle: an
authenticated identity with no linked profile reads no staff data
(deny-by-default, spec 003 FR-005).

Changing any other hosted auth setting (SMTP, confirmations, rate limits, flow
type) is a platform-configuration change under this same workflow and must be
re-validated against
`specs/003-auth-and-rbac/contracts/supabase-auth-surface.md`.
