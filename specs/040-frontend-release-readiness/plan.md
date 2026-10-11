# specs/040 — Implementation Plan (Frontend Production Readiness & Release)

## plan.md

### Constitution check (I–VIII)

| Principle | Verdict | Note |
|---|---|---|
| I. Business scope integrity | PASS | No product scope added; operations records and release docs only. |
| II. Specifications are the source of business truth | PASS | Every record traces to the phase spec or the standing contracts (runbook / master plan / 038 budgets). |
| III. Multi-tenant isolation | PASS | No data-layer change; production data policy re-recorded (never casually used as dev/test data). |
| IV. Server-enforced authorization | PASS | No authorization change; the platform allow-list and RLS posture are re-recorded, not reworked. |
| V. Database as the source of truth | PASS | No client-side truth introduced; migration-only DB posture cited unchanged. |
| VI. Explicit state and data integrity | PASS | The production-build state-matrix smoke proves the 037 vocabulary works in the built artifact. |
| VII. Auditability | PASS | The production checklist carries dispositions/proofs per item (the runbook's honesty model). |
| VIII. Minimal and intentional complexity | PASS | One narrow script (release:check), zero new harness beyond it; YAGNI held (CI/out-of-scope recorded as a decision, not built). |

### Decisions (D1–D6)

- **D1 — The deploy contract is the EXISTING one.** `npm run build` +
  `scripts/deploy-frontend.mjs` (`--dry-run` rehearsal; the three
  Cloudflare credentials; SPA fallback verified as the
  `dist/index.html` precondition). The phase verifies and documents;
  it does not redesign the script (the master plan's boundary).
- **D2 — The built artifact is the proof target.** Deep-link smoke and
  the release checks run against `vite preview` (the built artifact
  served locally), never the dev server. WebKit stays out (the standing
  clarified posture — the cross-browser record is a record).
- **D3 — Consistency of dev-run E2E.** A dev-mode checker in tests/e2e
  would break the preview URL tradition; the production smoke suite is
  its OWN spec configured for the preview build (baseURL from a fixture,
  `preview`-served locally), serial, db:reset first. The Task019 release
  suites remain the dev-mode regression record; the smoke suite is the
  built-artifact record.
- **D4 — release:check is deterministic-only.** Guard test re-run +
  budget re-read + checklist gate greps + the dry-run invocation — no
  timing/cloud assertions (the 038 rule: hard facts only).
- **D5 — Operations honesty extends the runbook**: the environment
  matrix gets its per-environment variable names in one table
  (FR-04); the error-tracking disposition is vendor-free with
  rationale (clarified); auth redirect URLs are recorded as the
  operator's Supabase Auth step; caching/h eaders posture recorded
  (what Pages provides by default vs what the operator would add).
- **D6 — Release notes in user terms, phase-indexed**: one committed
  `release-notes.md` covering Phases 01–19 with the user-facing
  headlines (ordering, operations, admin, hardening) — no changelog
  noise, no commit hashes as the primary voice.

### Risks
- The hydrate/save of the built artifact is environment-dependent: the
  smoke suite pins `vite preview` (localhost) so the proof is
  reproducible without credentials; the REAL deploy domain proof is an
  operator step after their first deploy.
- Bundle budget re-read is informational for sizes (038's rule) but the
  chunk-class membership fact is hard (the manifest gate holds).

### Deliverables map

| Deliverable | File(s) |
|---|---|
| The release-commit gate | `npm run verify` (run records), `srv release:check` |
| Deploy rehearsal record | `deploy-rehearsal.md` (dry-run manifest + preconditions rundown) |
| Built-artifact smoke | `e2e/production.smoke.test.ts` |
| The production checklist | `release-checklist.md` (FR-10, item by item) |
| Runbook updates | `docs/production-runbook.md` (environments table, auth redirects, caching, error tracking, rollback) |
| Release notes | `release-notes.md` (FR-12) |
| Regression record | `regression-record.md` (FR-11; suites on the release commit) |
