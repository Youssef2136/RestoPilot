# Quickstart: Project Foundation (Phase 0)

**Feature**: 001-project-foundation | **Date**: 2026-09-15

Validation guide for the Phase 0 acceptance gate. Every command below is
runnable from a clean checkout; expected outcomes map to the spec's success
criteria (SC-001 … SC-006). Implementation details live in
[plan.md](./plan.md), [research.md](./research.md), and
[data-model.md](./data-model.md).

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22 LTS+ | Pinned via `.nvmrc` / `engines` |
| npm | Bundled with Node | No other package manager required |
| Git | Current stable | |
| Supabase CLI | Current stable | Used ONLY for migrations, type generation, and sync against the cloud project |
| Supabase Cloud project | One configured development project | You need the project URL, anon key, project ref, and database connection string |

No local PostgreSQL/Supabase instance and no Docker are required — the
backend is the configured Supabase Cloud project.

## One-time setup

```bash
git clone <github-url> && cd restopilot   # from the GitHub remote
npm install                                # install dependencies
supabase login                             # Supabase CLI authentication
supabase link --project-ref $SUPABASE_PROJECT_REF
cp .env.example .env                       # then fill in the four values
```

**Expected outcome**: dependencies install cleanly; the CLI reports the
project as linked; `.env` contains `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`
(secrets stay out of version control — SC-006).

## Database setup (migrate + seed)

```bash
npm run db:migrate    # supabase db push → applies migrations to the cloud dev DB
npm run db:seed       # applies supabase/seed.sql (idempotent)
npm run types:gen     # regenerates src/types/database.types.ts from the cloud schema
```

**Expected outcome**: `db:migrate` reports the `app_meta` migration applied;
`db:seed` reports success; `types:gen` produces a committed, diff-stable
`database.types.ts` containing the `app_meta` definition (data-model.md).

## Start the frontend

```bash
npm run dev
```

**Expected outcome**: the dev server starts; the root shell renders; the
baseline routes each render their own placeholder area:

- `/` — application shell landing
- `/r/:restaurantSlug` — customer restaurant placeholder
- `/order/:branchId` — ordering placeholder
- `/dashboard` — staff dashboard placeholder
- `/admin` — super admin placeholder

## Run the quality pipeline

```bash
npm run verify      # format:check → lint → typecheck → test:unit → test:db → build
npm run test:e2e    # Playwright (auto-starts its own dev server)
```

**Expected outcome**: `verify` and `test:e2e` pass with exit code 0 —
this is the "run tests" step of the acceptance gate (SC-004). The
database test proves cloud connectivity and asserts the `app_meta` shape,
seed row, and RLS-enabled state (research.md §12). The production build
artifact is produced by the `build` step (SC-005).

## Reset-and-rebuild verification (SC-003)

```bash
npm run db:reset     # drops public + migration history → db push → db:seed (asks for confirmation)
npm run types:gen
```

**Expected outcome**: running the reset twice in a row each time yields an
equivalent known-good database rebuilt purely from repository artifacts.
Run this only against the development project — it is destructive.

## Failure-mode checks (edge cases)

- **Missing `.env` values** → the app/scripts exit with a message naming the
  missing variable (never silent misconfiguration — FR-016).
- **Cloud project unreachable** (network/paused project) → database tests and
  scripts fail with a clear connectivity message; guidance lives in
  `docs/development.md`.

## Acceptance-gate verification (manual, per spec clarification)

Perform the full sequence above on a **genuinely clean environment** (fresh
machine, VM, or fresh user account), following only the repository
documentation, recording pass/fail per step and total elapsed time.

**Passing**: every documented step succeeds as written with zero undocumented
fixes (SC-002) and total onboarding time is within the SC-001 target
(≤ 30 minutes).
