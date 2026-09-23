# Plan: Production Readiness (Phase 17)

**Feature**: [spec.md](spec.md) · Created 2026-09-23

## 1. The shape of the phase

Three deliverables, all repository-side, no product code changes:

- **US1 — the deploy path** (`scripts/deploy-frontend.mjs` +
  `docs/production-runbook.md` § deployment): a wrangler-based deploy of the
  `npm run build` bundle to Cloudflare Pages, with `--dry-run` proving the
  pipeline without credentials. The runbook records the contract: build
  command, output dir (`dist`), SPA fallback (every path → `index.html`),
  env vars, custom domain/HTTPS, rollback (previous deployment promoted or
  `wrangler pages deployment rollback`).
- **US2 — the migration-only database path** (runbook § database): §29's
  lifecycle formalized against a *fresh* project — ordered `supabase db
  push`, seed as a dev-only step, `types:gen` as the verification, and the
  "manual dashboard edits are never the workflow" rule verbatim. Proven
  again on the dev project: reset → regression → byte-identical types.
- **US3/US4 — the §28 checklist + the guard suite**: every checklist item
  answered line by line in the runbook; a permanent unit guard proving the
  dev/production boundary from the repo side.

## 2. Design decisions

- **D1 — Deploy via wrangler direct upload, not a Git integration.** The
  repo has no CI (a documented non-requirement); the reproducible unit is
  `npm run build && node scripts/deploy-frontend.mjs`. Direct upload works
  from any machine with `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/
  `CLOUDFLARE_PAGES_PROJECT` set; the script refuses to run when any is
  missing, naming each one. `--dry-run` performs the build check, the SPA
  fallback verification, and the manifest print without credentials.
- **D2 — SPA fallback belongs to the deploy, not the router.** Cloudflare
  Pages serves SPA fallback via the deployed asset manifest (a 200 rewrite
  for unknown paths → `index.html`); the script verifies the built bundle
  contains `index.html` and passes `--commit-dirty=false`-style hygiene
  (deploy only from a clean build dir; no ad-hoc files). The Vite config
  needs no change — history routing already works behind a 200-rewrite.
- **D3 — The checklist's three dispositions** (spec FR-004): **wired**
  (cite the artifact: e.g. RLS → 490+ db tests; auth redirects → the
  integration suites; realtime → the 012 authorization migration and its
  tests; storage policies → the menu-media migration), **operator** (action
  + owner + console path: backups, custom domain, error tracking, logging/
  monitoring, admin access), **n/a-with-reason** (Edge Functions: the
  product uses none — recorded rather than skipped). The runbook table is
  the SC-003 deliverable; every §28 item appears exactly once.
- **D4 — The guard suite is a unit suite, not db.** It proves repository
  facts by reading files: the seed header's development-only declaration,
  `db:seed`'s absence from build/deploy paths, `.env` in `.gitignore`, the
  runbook env-var table matching `.env.example` (the drift tripwire),
  the deploy script referencing no DB secret, and the reset script's
  non-development-ref refusal (read + assert the guard logic; the refusal
  itself is exercised by scripts against the live dev project only).
- **D5 — The seed boundary is enforced where it is real**: `scripts/db/reset.mjs`
  gains a guard — when the linked project ref does not look like the
  development project (env-declared `SUPABASE_DEV_PROJECT_REF` or an
  explicit `--i-know-this-is-destructive` override), it refuses with the
  runbook pointer. The e2e/db suites never exercise production; nothing
  else changes in app code.
- **D6 — `docs/development.md` gets a Production section** (FR-006) of one
  paragraph + a pointer: the boundary (dev-only seed, operator-run
  migrations, no production data on dev machines) and the runbook link.
  The daily-commands table is untouched.

## 3. Artifacts

| Deliverable | File |
|---|---|
| Deploy script | `scripts/deploy-frontend.mjs` (new) |
| Runbook (deployment + database + §28 checklist + environments) | `docs/production-runbook.md` (new) |
| Guard suite | `tests/unit/production.guard.test.ts` (new) |
| Reset guard | `scripts/db/reset.mjs` (edit: dev-ref refusal) |
| Dev-docs pointer | `docs/development.md` (edit: Production section) |
| Dependency note | `package.json` (wrangler as a devDependency — deploy-time only; `npm run deploy` script) |

## 4. Verification

- `npm run verify` exit 0 with the guard suite in `test:unit`.
- `node scripts/deploy-frontend.mjs --dry-run` succeeds with zero Cloudflare
  credentials (SC-001).
- `npm run db:reset -- --yes` → full db regression → `types:gen`
  byte-identical (SC-002).
- The runbook contains one row per §28 item, fifteen rows, each with a
  citation or an operator action (SC-003) — verified by grep count.
- The drift tripwire is proven once by temporarily editing `.env.example`,
  watching the guard fail, and reverting (SC-004).

## 5. Constitution check

- **I (Business Scope Integrity)** — no new product scope; operations docs
  and deployment tooling only. ✅
- **II (Specifications Are the Source of Business Truth)** — behavior comes
  from §28/§29 and the user's provider choice, recorded in the spec. ✅
- **III/IV/V/VI/VII (isolation, server-enforced auth, DB truth, integrity,
  audit)** — no runtime behavior changes; the guard *strengthens* the
  dev/production boundary. ✅
- **VIII (Minimal and Intentional Complexity)** — one script, one runbook,
  one guard suite, one reset guard; no CI, no monitoring vendor, no
  abstractions beyond the deliverables. ✅

## 6. Risks

- **Wrangler is a heavy devDependency** → deploy-time only; `--dry-run` and
  the guard suite never require it (the script checks for wrangler lazily
  and fails with an install hint when the real deploy path is taken).
- **Runbook drift** (env vars added to `.env.example` later without the
  table) → the guard suite's drift tripwire fails the unit run.
- **The reset guard could block legitimate dev resets** → it refuses only
  when the project ref does not match the declared development ref and no
  explicit destructive-override flag is passed; the existing documented
  invocation (`npm run db:reset -- --yes` against the dev project, ref in
  `.env`) is unchanged.
