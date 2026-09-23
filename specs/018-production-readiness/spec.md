# Specification: Production Readiness (Phase 17)

**Feature dir**: `specs/018-production-readiness` | **Created**: 2026-09-23
**Input**: Master plan §28 — Production Readiness. The final phase: make the
shipped product deployable and operable. Three halves: the **deployment
contract** for the frontend (§4 named the provider decision as this plan's to
make: Cloudflare Pages), the **migration-based Supabase deployment path**
(§29 — the house workflow, formalized to production), and the **§28
production checklist** answered item by item against the actual repository —
each item either wired and proven, or explicitly recorded as a documented
operator decision with its owner.

## Clarifications resolved (recorded 2026-09-23)

- **Q: Which static host?** Asked and answered: **Cloudflare Pages** — the
  master plan's first choice ("Cloudflare Pages or equivalent static
  hosting", §4). The provider contract (build command, output dir, SPA
  fallback, env vars, wrangler deploy) is written against it; swapping
  providers later touches only the contract document and the deploy script.
- **Q: Do we stand up real staging/production projects now?** The repo has
  exactly one linked Supabase project (the cloud development database). §28
  says "maintain at least" the three environments; standing up real cloud
  projects cannot be done from this repository and is an operator action.
  Resolution: the **environment contract** is documented and enforced where
  the repo can enforce it (dev-only seed guard, no `.env` commits, env var
  inventory), and the checklist records the operator steps (create projects,
  set branch protection) with explicit owners. Nothing pretends a staging
  environment exists.
- **Q: What is provable from the repo?** Everything with a repository
  artifact: `npm run build` production bundle, the 35-migration reproducible
  path (`db:reset` already proves migrations+seed rebuild from zero), the
  deploy script, the checklist document, the guard test. Cloud-side items
  (backups, custom domain, error tracking) are recorded as operator actions,
  not asserted as done.

## User stories

### US1 — The frontend deploys reproducibly (P1)

`npm run build` produces the production bundle; a single script deploys it
to Cloudflare Pages with the SPA fallback (client routing needs every path
to serve `index.html`); the deployment contract (build command, output dir,
env vars, custom-domain and HTTPS posture, rollback) is recorded in the
production runbook. The build's warnings are triaged: nothing in the bundle
ships a secret, and the bundle builds clean from a fresh clone.

**Why**: §28 "Build and deploy the production web application" — today there
is no deploy path at all; the product is only runnable from a dev machine.

### US2 — The database deploys by migration only (P1)

The production database path is the §29 lifecycle formalized: migrations are
the only schema change mechanism, applied with `supabase db push` (or the
CI equivalent) against the target project; manual dashboard edits are named
as never-normal. The repo's reproducibility is proven again: reset rebuilds
from zero (35 migrations + idempotent seed), and `types:gen` output is
byte-identical after the rebuild — the deployment artifact is the
repository, not any live database.

**Why**: §28 names "migration-based deployment" and "never treat manual
dashboard schema edits as the normal production workflow" — the workflow
exists and is tested, but the production-facing procedure (targeting a
fresh project ref, in order, idempotent) is not written down.

### US3 — The §28 production checklist is answered item by item (P1)

All fifteen §28 items get a repository-side answer in
`docs/production-runbook.md`: wired-and-proven items cite their proof
(RLS enabled and tested → the 490+ db tests; auth redirects → the
integration suites; realtime authorization → the 012 migration + its
tests); operator-owned items (custom domain, backups, error tracking,
monitoring) are recorded as explicit actions with their owner and the
Supabase-dashboard path to do them — never asserted as done.

**Why**: §28's checklist is the phase's core; an unexamined checkbox is
exactly the dishonesty this pipeline exists to prevent.

### US4 — The dev/production boundary is guarded by tests (P2)

A permanent guard test proves the boundary from the repo side: the seed
cannot leak into any production deploy path (the deploy script and frontend
build never reference `db:seed`; the seed file's own header states it is
development-only and `db:reset` refuses to run against a non-development
project ref); `.env` remains git-ignored; the env var inventory in the
runbook matches `.env.example` exactly (a drift fails the test).

**Why**: §28 "Production data must never be used casually as development/
test data" and §45's "secrets are safely managed" — the boundary is a real
risk with today's scripts and deserves a standing proof, not a doc claim.

## Requirements

- **FR-001** — A deploy script (`scripts/deploy-frontend.mjs`) deploys the
  production build to Cloudflare Pages via the wrangler CLI, refusing to run
  when `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_PAGES_PROJECT`
  are unset (with a message naming each missing var), never embedding
  `SUPABASE_DB_URL` or any secret in the bundle, and printing the deployed
  URL. The SPA fallback is configured as part of the deploy.
- **FR-002** — `docs/production-runbook.md` records the deployment contract:
  build command, output dir, SPA fallback rule, required env vars and their
  sources, custom-domain + HTTPS steps, rollback procedure, and the
  environment matrix (Local / Staging / Production) with the operator steps
  to stand up staging and production Supabase projects and the frontend
  previews.
- **FR-003** — The runbook's database section records the migration-only
  deployment procedure: ordered `supabase db push` against a fresh project,
  idempotent seed as a development-only step, `types:gen` verification, and
  the explicit "manual dashboard edits are never the workflow" rule. The
  §29 lifecycle diagram is preserved as the canonical statement.
- **FR-004** — Every §28 checklist item appears in the runbook with one of
  three dispositions: **wired** (repository artifact cited as proof),
  **operator** (action + owner + console path), or **n/a-with-reason**
  (e.g. Edge Functions: the product uses none — recorded, not skipped).
- **FR-005** — A permanent guard suite (`tests/unit/production.guard.test.ts`)
  proves: the seed header declares development-only scope and
  `db:reset`/`db:seed` are absent from the deploy script and build path;
  `.gitignore` covers `.env`; the runbook's env-var table matches
  `.env.example` (no drift); the deploy script references no secret in the
  bundle path.
- **FR-006** — `docs/development.md` gains a Production section pointing at
  the runbook and stating the dev/staging/prod boundary in one paragraph;
  the existing daily commands remain untouched.

## Non-requirements (scope walls)

- No real cloud project is created or migrated from this repo; standing up
  staging/production Supabase projects, DNS, and dashboard-side settings
  are operator actions recorded in the runbook.
- No CI pipeline is introduced (the repo has none today and §28 does not
  require one; `npm run verify` remains the gate). Adding CI later builds on
  the runbook.
- No monitoring/error-tracking vendor is wired into the code; the runbook
  records the options and the operator step.
- No new product features; the app code is untouched except where a guard
  requires it.

## Success criteria

- **SC-001** — From a clean checkout, `npm run build` succeeds and
  `node scripts/deploy-frontend.mjs --dry-run` succeeds without any
  Cloudflare credential set, printing exactly what it would deploy.
- **SC-002** — `npm run db:reset -- --yes` followed by full db regression
  (all suites) and `types:gen` produces byte-identical types — reproducible
  from repository artifacts alone.
- **SC-003** — `docs/production-runbook.md` contains a row for each of the
  fifteen §28 items, each carrying a proof citation or an explicit operator
  action; no item is silently missing.
- **SC-004** — `npm run verify` passes with the new guard suite included;
  the guard fails when the env-var table drifts from `.env.example` (proven
  once by temporary drift during implementation, then reverted).
- **SC-005** — The seed cannot reach a production deploy path: the guard
  test proves `db:seed` appears in no build/deploy script, and the reset
  script's non-development-ref refusal is covered by a test.
