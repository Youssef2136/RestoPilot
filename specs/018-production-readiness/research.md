# Research: Production Readiness (Phase 17)

**Feature**: [spec.md](spec.md) · [plan.md](plan.md) · Created 2026-09-23

## R1 — Cloudflare Pages direct upload (the deploy contract)

- **Mechanism**: `wrangler pages deploy <dir> --project-name=<name>`
  performs a direct upload of a static directory; the project is created on
  first deploy. Credentials: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
  (or `wrangler login` interactive — rejected here for reproducibility; CI-
  style env credentials are the contract). The deployed production URL is
  `<project>.pages.dev`; custom domains attach in the Pages dashboard or via
  wrangler.
- **SPA fallback**: Cloudflare Pages automatically serves `index.html` with a
  200 for unmatched paths when the deploy has no conflicting asset — the
  standard single-page-app behavior ("single-page application" mode). The
  script's job is to verify the bundle contains `index.html` at the deploy
  root, not to configure rewrites; Vite's history-mode routing then works
  unchanged.
- **Rollback**: `wrangler pages deployment rollback` (or dashboard) promotes
  a previous deployment; the runbook records both.
- **Runtime cost**: wrangler is only needed on the deploy path. `--dry-run`
  must not require it (lazy check, install hint on the real path).
- **Secrets in the bundle**: only `VITE_*` vars are inlined by Vite; the
  publishable key is public by design (`.env.example` states it); the DB
  URL and any service-role key must never appear in the build inputs — the
  guard asserts the deploy script never feeds them to `vite build`.

## R2 — Migration-based database deployment (the §29 lifecycle)

- The repo already holds the canonical workflow: migrations in
  `supabase/migrations/` (35 files, timestamped), applied with
  `npm run db:migrate` (`supabase db push`), types regenerated with
  `npm run types:gen`, reset proven reproducible (`db:reset` = drop →
  `db push` → idempotent seed).
- **Production procedure** (runbook § database): create the target project →
  link (`supabase link --project-ref <ref>`) → `supabase db push` applies
  all migrations in order → verify with the db suite pointed at the target →
  seed only if the target is a development project (the runbook states the
  seed is fixture/demo data, never production).
- **Manual dashboard edits**: named as never-normal (§28 verbatim); the
  runbook records the exception path (hotfixes happen in a new migration,
  reviewed, then pushed — never as a dashboard change without a migration).
- **Verification**: `types:gen` byte-identical after any push — already a
  phase-017-proven determinism property.

## R3 — §28 checklist survey (the fifteen items, current state)

| §28 item | Current state |
|---|---|
| environment variables | `.env.example` inventories `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`; `.env` git-ignored |
| Supabase URLs | the two `VITE_*` values; per-environment, operator-set |
| Auth redirect URLs | integration suites exercise real sign-in against the dev project; production redirect list = operator step |
| RLS enabled | 490+ db tests, isolation + security suites (015 re-attacked) |
| policies deployed | all in migrations; `db:push` deploys them |
| Realtime configuration | `20260921150000_realtime_authorization.sql` (publication + auth migration) and its suites |
| storage policies | menu-media migration (tenant-scoped paths, validation) |
| Edge Functions | none exist (product needs none; recorded n/a) |
| custom domain | operator step (DNS + Pages/Supabase console) |
| HTTPS | automatic on Cloudflare Pages and Supabase; recorded |
| backups | Supabase dashboard (scheduled backups on paid plans); operator step |
| logging/monitoring | Supabase dashboard logs; operator step (external vendor = out of scope) |
| error tracking | not wired; operator step with options recorded |
| seed/demo strategy | seed is development-only (D5 guard); production never seeded |
| admin access | platform admin surface (013/014) + operator steps (account + break-glass) |

## R4 — Guard test feasibility (file-reading unit tests)

- `tests/unit/*` run in Vitest without a database — reading repo files
  (`seed.sql` header, `.gitignore`, `.env.example`, the runbook, the deploy
  script, `scripts/db/reset.mjs`) is pure Node; suite stays fast and hermetic.
- The env-var drift tripwire: parse the runbook's env table and
  `.env.example` variable names; compare sets; mismatch → fail. Proven by
  temporary drift during implementation (SC-004).
- The reset-refusal guard (D5) is script logic; its unit tests assert the
  decision function's outputs (dev ref → proceed; unknown ref → refuse;
  override flag → proceed with warning) by importing the script's exported
  helper — hence `reset.mjs` gains a small exported `resolveResetGuard()`.
