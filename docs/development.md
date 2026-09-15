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
| Supabase Cloud project | one configured development project | you need its URL, anon key, project ref, and database connection string — see Setup step 5      |

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
check → unit tests → database tests → production build. `test:e2e` starts
its own dev server and exercises the route shell. Both must pass.

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
| `npm run test:e2e`                        | run end-to-end tests (Playwright; starts its own server)                                                        |
| `npm run verify`                          | full local pipeline: format:check → lint → typecheck → test:unit → test:db → build                              |
| `npm run db:migrate`                      | apply pending migrations to the cloud development database                                                      |
| `npm run db:seed`                         | apply `supabase/seed.sql` (idempotent)                                                                          |
| `npm run db:reset`                        | ⚠️ destructive: rebuild the cloud development database from zero (migrations + seed) — development project only |
| `npm run types:gen`                       | regenerate `src/types/database.types.ts` from the cloud schema                                                  |

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
