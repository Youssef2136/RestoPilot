# Tasks: Production Readiness (Phase 17)

**Feature**: [spec.md](spec.md) · [plan.md](plan.md) · Created 2026-09-23

## 1. Deployment path (US1, FR-001/FR-002)

- [ ] T001 `scripts/deploy-frontend.mjs` — build validation (dist exists,
      `index.html` at root), credential check (refuses naming each missing
      var), `--dry-run` mode printing the would-be manifest, real mode
      invoking `wrangler pages deploy` with the SPA fallback verified and
      the deployed URL printed; never exports DB credentials to the build
- [ ] T002 `package.json` — `wrangler` devDependency (deploy-time only),
      `"deploy": "npm run build && node scripts/deploy-frontend.mjs"`;
      `npm run verify` unchanged
- [ ] T003 `docs/production-runbook.md` § deployment — the contract: build
      command, output dir, SPA fallback rule, env vars + sources,
      custom-domain/HTTPS steps, rollback (wrangler + dashboard),
      deploy-from-clean hygiene

## 2. Database deployment + environments (US2, FR-003)

- [ ] T004 runbook § database — the §29 lifecycle formalized: fresh-project
      link → ordered `db push` → suite verification → `types:gen`
      byte-identical; seed declared development-only; "manual dashboard
      schema edits are never the workflow" verbatim with the migration
      hotfix exception path
- [ ] T005 runbook § environments — Local / Staging / Production matrix:
      what each holds, the operator steps to stand up the Supabase
      projects (link, push, verify) and the Pages project; production
      data never casually used as dev/test data

## 3. The §28 checklist (US3, FR-004)

- [ ] T006 runbook § production checklist — all fifteen §28 items, one row
      each, dispositioned wired (artifact cited) / operator (action +
      owner + console path) / n/a-with-reason (Edge Functions); nothing
      asserted done that the repo cannot do

## 4. The guard suite + reset guard (US4, FR-005)

- [ ] T007 `tests/unit/production.guard.test.ts` — seed header declares
      development-only scope; `db:seed`/`db:reset` absent from build/
      deploy paths; `.env` git-ignored; runbook env-var table matches
      `.env.example` (the drift tripwire); deploy script references no
      DB secret
- [ ] T008 `scripts/db/reset.mjs` — export `resolveResetGuard()` (dev ref →
      proceed; unknown ref → refuse with runbook pointer; explicit
      override → proceed with warning); wire the refusal into the script
      entry; unit-test the decision function in T007's suite

## 5. Docs + gates (FR-006, SC-002/SC-004/SC-005)

- [ ] T009 `docs/development.md` — Production section (one paragraph +
      runbook pointer); then the gates: the drift tripwire proven once by
      temporary `.env.example` drift (revert immediately); `npm run
      verify` exit 0; `db:reset` → full db regression → `types:gen`
      byte-identical; `deploy --dry-run` green with zero credentials
- [ ] T010 post-implement analyze record + final commit (launch-readiness
      record, §45 Operations alignment)

## Notes

- §28 items (the fifteen, T006's contract): environment variables; Supabase
  URLs; Auth redirect URLs; RLS enabled; policies deployed; Realtime
  configuration; storage policies; Edge Functions; custom domain; HTTPS;
  backups; logging/monitoring; error tracking; seed/demo strategy; admin
  access.
- Reuse: RLS/realtime/storage/auth proofs are cited (015, 012, menu-media,
  integration suites) — nothing is re-tested; the only new executable
  surface is the guard suite + deploy script + reset guard.
- Reviewer-owned checklist (`deploy-honesty-and-boundary-proof.md`) stays
  with the user at the implement gate.
