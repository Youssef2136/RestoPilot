# Production Runbook (RestoPilot)

**Feature**: [spec 018](../specs/018-production-readiness/spec.md) · Created 2026-09-23
**Input**: Master plan §28 (Production Readiness) and §29 (the Supabase
workflow). This runbook is the deployment provider contract, the
migration-only database procedure, the environment matrix, and the §28
production checklist answered item by item.

Dispositions used in the checklist: **wired** = a repository artifact
proves it; **operator** = an action a human performs outside this repo,
recorded with its owner and console path; **n/a** = not applicable, with
the reason. Nothing here claims "done" for an action the repository cannot
perform.

---

## 1. Deployment (frontend)

### The contract

| What                  | Value                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider              | **Cloudflare Pages** — chosen per §4's delegation to this plan ("the final deployment provider contract must be recorded in the first production plan")                                                             |
| Build command         | `npm run build` (tsc -b && vite build)                                                                                                                                                                              |
| Output directory      | `dist/`                                                                                                                                                                                                             |
| Deploy command        | `npm run deploy` = build + `node scripts/deploy-frontend.mjs`                                                                                                                                                       |
| Rehearsal             | `node scripts/deploy-frontend.mjs --dry-run` — no credentials needed; prints the exact manifest a real deploy would upload                                                                                          |
| Required credentials  | `CLOUDFLARE_API_TOKEN` (Pages edit permission), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT` — the script refuses to run when any is missing, naming each one                                                |
| SPA fallback          | Cloudflare Pages' built-in single-page-app behavior; the script _verifies_ the precondition (`dist/index.html` at the deploy root) rather than configuring rewrites. Vite history-mode routing needs no app change. |
| Custom domain         | Pages project → **Custom domains** → add the domain, follow the DNS instructions; HTTPS is automatic (managed certificate)                                                                                          |
| Secrets in the bundle | Only `VITE_*` vars are inlined by Vite. The publishable key is public by design. The script never exports `SUPABASE_DB_URL` or any service-role credential — asserted by `tests/unit/production.guard.test.ts`.     |

### Rollback

- `npx wrangler pages deployment rollback` (promotes the previous
  deployment), or the Pages dashboard → **Deployments** → the last good one
  → **Rollback to this deployment**.
- Database rollbacks are NOT automatic: a bad migration is fixed by a new
  forward migration (never by editing history); restore-from-backup is the
  §-below operator action of last resort.

### Deploy hygiene

Deploy from a clean working tree of a tagged commit; the deploy uploads
`dist/` built by `npm run build` — never hand-edited files.

---

## 2. Database (migration-only, §29 verbatim)

The §29 lifecycle is the canonical statement — reproduced here as the
normal production workflow:

```text
Change planned
   ↓
Migration created
   ↓
Local Supabase tested
   ↓
DB tests
   ↓
Frontend integration
   ↓
Staging
   ↓
Production migration
```

**Manual dashboard schema edits are never the normal production workflow**
(§28). Hotfix exception path: write a new timestamped migration, review it
like any change, push it — never "fix it in the dashboard" without a
migration, because the repository's migrations must remain the single
reproducible description of the schema.

### Deploying to a fresh Supabase project (staging or production)

1. Create the project (operator; Supabase dashboard or CLI) and record its
   ref.
2. `supabase link --project-ref <ref>`
3. `npm run db:migrate` — `supabase db push` applies all 35 migrations in
   timestamp order. Idempotent; re-running applies only pending ones.
4. Verify: run the db suites pointed at the target
   (`SUPABASE_DB_URL=… npm run test:db`) — 490+ tests must pass.
5. `npm run types:gen` — the regenerated types must be **byte-identical**
   to the committed `src/types/database.types.ts` (the determinism
   property proven in phase 016/017).
6. **Seed**: `npm run db:seed` is a development-only step (fixture/demo
   data). It is NEVER part of a staging or production deployment. The
   reset script refuses non-development project refs for the same reason
   (`scripts/db/reset.mjs` guard).

### Reproducibility proof (already standing)

`npm run db:reset -- --yes` rebuilds the development database from zero
(drop → push all migrations → idempotent seed); the full db regression
passes against it; `types:gen` is byte-identical. The repository, not any
live database, is the deployment artifact.

---

## 3. Environments (§28: "maintain at least" these three)

| Environment    | Supabase project                                                                 | Frontend                                                                       | Data policy                                                                | Standing-up steps (operator)                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local**      | the linked cloud dev project (`.env`: `SUPABASE_PROJECT_REF`, `SUPABASE_DB_URL`) | `npm run dev` (Vite, :5173)                                                    | seeded fixtures; `db:reset` allowed; auth test users                       | `.env` from `.env.example`; `npm run db:reset -- --yes`; `npm run db:seed`                                                                              |
| **Staging**    | separate project (operator creates, links, pushes)                               | Cloudflare Pages **preview deployments** (branch aliases)                      | migration-only schema; seed NOT applied; smoke data created through the UI | create project → `supabase link` → `npm run db:migrate` → verify suites → set `VITE_*` env vars in the Pages preview config → attach the preview domain |
| **Production** | separate project (operator creates, links, pushes)                               | Cloudflare Pages production deployment (`<project>.pages.dev` + custom domain) | migration-only; never seeded; real data only                               | same as staging + custom domain + backups + monitoring (below) + auth redirect URLs for the production domain                                           |

**Production data must never be used casually as development/test data**
(§28): dev machines point at the dev project; no production `SUPABASE_DB_URL`
belongs in any `.env`; the reset guard and the seed policy above enforce
what the repo can enforce.

---

## 4. The §28 production checklist — item by item

| #   | §28 item               | Disposition          | Proof / action                                                                                                                                                                                                               |
| --- | ---------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | environment variables  | **wired**            | `.env.example` is the inventory (§6 below); `.env` is git-ignored (guard-tested); only `VITE_*` reaches the client bundle                                                                                                    |
| 2   | Supabase URLs          | **wired**            | `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` consumed at runtime; per-environment values set by the operator in the Pages env config                                                                                |
| 3   | Auth redirect URLs     | **wired + operator** | the auth integration suites prove sign-in flows against the dev project; the operator adds the production domain to **Auth → URL Configuration** (Site URL + redirect allow-list)                                            |
| 4   | RLS enabled            | **wired**            | RLS on every public table, deployed by migrations; proven continuously by 490+ db tests incl. tenancy-isolation and security suites (015 re-attacked the full surface)                                                       |
| 5   | policies deployed      | **wired**            | all policies live in `supabase/migrations/`; `npm run db:migrate` deploys them; `db:reset` → regression proves the ordered path                                                                                              |
| 6   | Realtime configuration | **wired**            | `20260921150000_realtime_authorization.sql` (publication membership + auth); channel-read suites prove scope enforcement                                                                                                     |
| 7   | storage policies       | **wired**            | menu-media migration: tenant-scoped paths, upload validation, controlled access; covered by its suites                                                                                                                       |
| 8   | Edge Functions         | **n/a**              | the product uses none — all trusted logic is PostgreSQL functions (§31's strategy); recorded here rather than skipped                                                                                                        |
| 9   | custom domain          | **operator**         | DNS + Pages **Custom domains** (+ Supabase **Settings → General** if a custom DB domain is wanted); owner: project operator                                                                                                  |
| 10  | HTTPS                  | **wired**            | automatic managed certificates on Cloudflare Pages and Supabase; no action beyond using them                                                                                                                                 |
| 11  | backups                | **operator**         | Supabase **Database → Backups** (scheduled backups on the paid plan; daily on Pro); owner: project operator; restore drill recommended before launch                                                                         |
| 12  | logging/monitoring     | **operator**         | Supabase **Logs & Analytics** (API/DB/auth logs) is the baseline; an external vendor is out of scope (spec non-requirement); owner: project operator                                                                         |
| 13  | error tracking         | **operator**         | not wired into the code (spec non-requirement); options recorded: Supabase logs baseline; add a client-side vendor later if wanted — a new spec, not a silent addition                                                       |
| 14  | seed/demo strategy     | **wired**            | the seed is development-only (its header says so; the guard suite and the reset guard enforce it); production is never seeded; demo tenants are created through the UI when needed                                           |
| 15  | admin access           | **wired + operator** | the platform-admin surface (013/014: `/admin`, allow-list gate) is the product side; the operator provisions the real admin account and a break-glass procedure, and protects the production Supabase dashboard with SSO/2FA |

---

## 5. Environment variables (the inventory)

The guard suite (`tests/unit/production.guard.test.ts`) compares this table
against `.env.example` — adding a variable without updating the runbook
fails the unit run (the drift tripwire, SC-004).

| Variable                                                                                         | Scope                                                             | Source                                                                           |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`                                                                              | public client                                                     | Supabase Dashboard → Connect / Project Settings → API                            |
| `VITE_SUPABASE_PUBLISHABLE_KEY`                                                                  | public client                                                     | Supabase Dashboard → API keys (publishable key; public by design, RLS-protected) |
| `SUPABASE_DB_URL`                                                                                | server-side tooling only (CLI, tests, scripts) — never the bundle | Supabase Dashboard → Connect → connection string                                 |
| `SUPABASE_PROJECT_REF`                                                                           | server-side tooling only                                          | the linked project's ref (Dashboard URL / `supabase link`)                       |
| _(deploy-time only)_ `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT` | operator shell/CI secret store, never `.env.example`              | Cloudflare dashboard → API Tokens / account info                                 |

Secrets rule (§45 "secrets are safely managed"): real values live only in
git-ignored `.env` files or operator secret stores; the repository carries
`.env.example` placeholders.

---

## 6. Gate

`npm run verify` is the quality gate (format → lint → types → unit → db →
integration → build). This runbook and its guard suite are part of that
gate: the env-var drift tripwire runs in every `npm run verify`.
