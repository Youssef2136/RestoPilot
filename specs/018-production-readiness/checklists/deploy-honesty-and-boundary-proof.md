# Checklist: Deploy Honesty and Boundary Proof (Phase 17)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) · Created 2026-09-23

Reviewer-owned (per the 005–017 convention: checked by a human reviewer,
not by the implementing agent).

## Deployment contract fidelity

- [ ] The deploy script refuses to run when any of the three Cloudflare
      credentials is missing, naming each missing variable in its message
- [ ] `--dry-run` completes with zero credentials set and prints exactly
      the manifest that a real deploy would upload (SC-001)
- [ ] The SPA fallback is verified by the script (bundle contains
      `index.html` at the deploy root), not assumed
- [ ] The runbook's rollback procedure names a real mechanism (wrangler
      deployment rollback or dashboard promotion), not a placeholder
- [ ] No `SUPABASE_DB_URL` or service-role secret can reach `vite build`
      through the deploy script (the script never exports DB credentials)

## §28 checklist honesty

- [ ] The runbook contains one row per §28 item — all fifteen present,
      each with a proof citation (wired), an operator action + owner +
      console path (operator), or an explicit n/a-with-reason
- [ ] No item claims "done" for a cloud-side action that the repo cannot
      perform (backups, custom domain, error tracking, monitoring)
- [ ] The environment matrix names all three environments with the
      operator steps to stand up staging and production
- [ ] "Manual dashboard schema edits are never the workflow" appears
      verbatim as a rule with the hotfix exception path

## Dev/production boundary proof

- [ ] The guard suite proves the seed header declares development-only
      scope and that `db:seed`/`db:reset` appear in no build/deploy path
- [ ] The env-var drift tripwire fails when `.env.example` and the
      runbook table diverge (proven once by temporary drift, then
      reverted — SC-004)
- [ ] `.env` remains git-ignored and the guard asserts it
- [ ] The reset guard refuses a non-development project ref without the
      explicit override, and its decision logic is unit-tested
- [ ] Reproducibility holds: `db:reset` → full db regression →
      `types:gen` byte-identical (SC-002)

## Scope walls respected

- [ ] No CI pipeline introduced; `npm run verify` remains the gate
- [ ] No monitoring/error-tracking vendor wired into app code
- [ ] No cloud project created or migrated by this repo's automation
- [ ] No product feature code changed (only reset.mjs guard + docs +
      new deploy tooling + guard suite)
- [ ] `docs/development.md` Production section is one paragraph + the
      runbook pointer; the daily-commands table is untouched
