# Tasks: Production Readiness (Phase 17)

**Feature**: [spec.md](spec.md) · [plan.md](plan.md) · Created 2026-09-23

## 1. Deployment path (US1, FR-001/FR-002)

- [x] T001 `scripts/deploy-frontend.mjs` — build validation (dist exists,
      `index.html` at root), credential check (refuses naming each missing
      var), `--dry-run` mode printing the would-be manifest, real mode
      invoking `wrangler pages deploy` with the SPA fallback verified and
      the deployed URL printed; never exports DB credentials to the build
- [x] T002 `package.json` — `wrangler` devDependency (deploy-time only),
      `"deploy": "npm run build && node scripts/deploy-frontend.mjs"`;
      `npm run verify` unchanged
- [x] T003 `docs/production-runbook.md` § deployment — the contract: build
      command, output dir, SPA fallback rule, env vars + sources,
      custom-domain/HTTPS steps, rollback (wrangler + dashboard),
      deploy-from-clean hygiene

## 2. Database deployment + environments (US2, FR-003)

- [x] T004 runbook § database — the §29 lifecycle formalized: fresh-project
      link → ordered `db push` → suite verification → `types:gen`
      byte-identical; seed declared development-only; "manual dashboard
      schema edits are never the workflow" verbatim with the migration
      hotfix exception path
- [x] T005 runbook § environments — Local / Staging / Production matrix:
      what each holds, the operator steps to stand up the Supabase
      projects (link, push, verify) and the Pages project; production
      data never casually used as dev/test data

## 3. The §28 checklist (US3, FR-004)

- [x] T006 runbook § production checklist — all fifteen §28 items, one row
      each, dispositioned wired (artifact cited) / operator (action +
      owner + console path) / n/a-with-reason (Edge Functions); nothing
      asserted done that the repo cannot do

## 4. The guard suite + reset guard (US4, FR-005)

- [x] T007 `tests/unit/production.guard.test.ts` — seed header declares
      development-only scope; `db:seed`/`db:reset` absent from build/
      deploy paths; `.env` git-ignored; runbook env-var table matches
      `.env.example` (the drift tripwire); deploy script references no
      DB secret
- [x] T008 `scripts/db/reset.mjs` — export `resolveResetGuard()` (dev ref →
      proceed; unknown ref → refuse with runbook pointer; explicit
      override → proceed with warning); wire the refusal into the script
      entry; unit-test the decision function in T007's suite

## 5. Docs + gates (FR-006, SC-002/SC-004/SC-005)

- [x] T009 `docs/development.md` — Production section (one paragraph +
      runbook pointer); then the gates: the drift tripwire proven once by
      temporary `.env.example` drift (revert immediately); `npm run
      verify` exit 0; `db:reset` → full db regression → `types:gen`
      byte-identical; `deploy --dry-run` green with zero credentials
- [x] T010 post-implement analyze record + final commit (launch-readiness
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

## Pre-implement analysis (2026-09-23)

- Coverage: every FR-001…FR-006 maps to ≥1 task; every SC-001…SC-005 has a
  gate task (SC-003 → T006's fifteen-row contract). All four user stories
  have deliverables. No orphans, no contradictions.
- Constitution: VIII (minimal complexity) — one script, one runbook, one
  guard suite, one decision function; wrangler is deploy-time-only with a
  lazy check. No MUST principle touched.
- Refinement (non-blocking): D5's "declared development ref" resolves to the
  EXISTING `SUPABASE_PROJECT_REF` in `.env` — the dev project ref is
  already declared there, and the target ref is parsed from
  `SUPABASE_DB_URL`'s host (`db.<ref>.supabase.co`). No new env var, no
  `.env.example` change, no new drift surface. `resolveResetGuard()`
  compares the two and refuses on mismatch without the override.
- Scope check: T008 edits `scripts/db/reset.mjs` — tooling, not product
  code; consistent with the spec's non-requirement ("only where a guard
  requires it").
- Verdict: no CRITICAL findings → proceed to implement.

## Post-implement analysis (2026-09-23)

Verified against the deployed state, artifact by artifact:

- **FR-001** verified: `scripts/deploy-frontend.mjs` gates on the three
  Cloudflare credentials (missingCredentials proven per-var in the guard
  suite), validates the bundle + SPA fallback (dist/index.html at root),
  and `--dry-run` exits 0 with zero credentials printing the exact
  4-file manifest (SC-001). The guard proves no DB secret can reach the
  build (code-section scan, doc-comment exempted).
- **FR-002** verified: runbook §1 records build command, output dir, SPA
  fallback rule, credentials, custom domain/HTTPS, rollback (wrangler +
  dashboard), and clean-tree hygiene.
- **FR-003** verified: runbook §2 reproduces §29 verbatim as canonical,
  gives the fresh-project push procedure with suite + types verification,
  declares the seed development-only, and states the manual-edit rule
  with the hotfix exception path.
- **FR-004** verified: runbook §4 holds fifteen rows — one per §28 item —
  each dispositioned wired (artifact cited) / operator (action + owner +
  console path) / n-a-with-reason (Edge Functions) (SC-003).
- **FR-005** verified: `tests/unit/production.guard.test.ts` 13/13 —
  seed-isolation (SC-005), secret-scan, credential gate, bundle
  validation, `.gitignore` covers `.env`, runbook↔`.env.example` drift
  tripwire (proven to trip once via temporary DRIFT_TEST_VAR, then
  reverted — SC-004), and the reset-guard decision table (5 cases).
- **FR-006** verified: `docs/development.md` Production section — one
  paragraph + runbook pointer; daily-commands table untouched.
- **T008** verified: `resolveResetGuard()` exported and wired before the
  confirmation prompt; dev flow unchanged (real reset ran green through
  the guard); pooler and direct URL shapes both parse (SC-002: reset →
  492/492 → `types:gen` byte-identical).
- **Gates**: `npm run verify` exit 0 (unit 262, db 492, integration 36,
  build included).
- Constitution: no product code touched; scope walls respected (no CI, no
  monitoring vendor, no cloud provisioning).
- Verdict: no unresolved findings. T010's final commit completes the phase.

## Convergence (2026-09-23)

Gapped check across all artifacts: 10/10 tasks `[X]`; FR-001…FR-006 each
verified against the deployed state in the post-implement analysis; SC-001
(dry-run, zero credentials), SC-002 (reset → 492/492 → byte-identical
types), SC-004 (drift tripwire proven), SC-005 (seed isolation) all hold;
SC-003 holds (fifteen §28 rows in the runbook). Reviewer-owned checklist
boxes remain with the user per the 005–018 convention. No Phase 2
convergence tasks needed — **converged on the first round**.
