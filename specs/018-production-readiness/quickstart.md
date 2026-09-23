# Quickstart: Production Readiness (Phase 17)

**Feature**: [spec.md](spec.md) · [plan.md](plan.md)

## What this phase delivers

1. `npm run build` → `node scripts/deploy-frontend.mjs` deploys the app to
   Cloudflare Pages (or `--dry-run` to rehearse without credentials).
2. `docs/production-runbook.md` — the deployment contract, the migration-only
   database procedure, the three-environment matrix, and the §28 production
   checklist answered item by item (wired / operator / n-a-with-reason).
3. A permanent guard suite (`tests/unit/production.guard.test.ts`) keeping
   the dev/production boundary honest from the repo side.
4. `scripts/db/reset.mjs` refuses to run against a project ref that is not
   the declared development ref (unless explicitly overridden).

## Rehearse the deploy (no credentials needed)

```bash
npm run build
node scripts/deploy-frontend.mjs --dry-run
```

Expected: the build is validated, the SPA fallback is verified, and the
script prints the manifest it would deploy — without any Cloudflare token.

## Real deploy (operator, when staging/production hosting is stood up)

```bash
export CLOUDFLARE_API_TOKEN=...      # Pages edit permission
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_PAGES_PROJECT=restopilot
npm run deploy                        # = build + scripts/deploy-frontend.mjs
```

## Database deployment (migration-only, §29)

```bash
supabase link --project-ref <target-ref>
npm run db:migrate                    # supabase db push — ordered, idempotent
npm run types:gen                     # must be byte-identical afterwards
```

The seed is development-only: `npm run db:seed` targets dev projects and is
never part of a production deployment.

## Run the guards

```bash
npm run test:unit -- production.guard
```

Expected: all guard tests pass — seed isolation, `.env` ignored, env-var
table in sync with `.env.example`, no secrets on the deploy path, reset
guard decisions correct.

## Full verification

```bash
npm run verify                        # format, lint, types, unit, db, integration, build
npm run db:reset -- --yes             # then: npm run test:db → 490+ pass
npm run types:gen                     # → git status clean (byte-identical)
```
