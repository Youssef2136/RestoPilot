# specs/040 — Quickstart (Frontend Production Readiness & Release)

## quickstart.md

The release-commit gate, in order (all runnable in this repo without
credentials):

```bash
# 0. The clean-tree release commit (git status must be clean first)
npm run build                 # FR-01 — zero warnings that matter (ledger)
npm run verify                # the full gate on the release commit

# 1. The deploy rehearsal (no credentials needed)
node scripts/deploy-frontend.mjs --dry-run   # prints the upload manifest

# 2. The deterministic release assertions
npm run release:check         # guard + budget re-read + checklist gates

# 3. The built-artifact proof (serves dist/ locally)
npx vite preview --port 4173  # then: npx playwright test e2e/production.smoke.test.ts
```

What is NOT runnable here (the operator's actions, recorded in the
checklist): the real `npm run deploy` (needs the three Cloudflare
credentials), tagging, the production Supabase auth redirect URLs,
custom domain, backups/monitoring. The checklist separates them with
owner and path.
