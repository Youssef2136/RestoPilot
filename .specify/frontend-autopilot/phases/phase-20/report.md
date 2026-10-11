# Phase 20 — Report (specs/040 · Frontend Production Readiness & Release)

## Final status

**DONE — converged (first round)** — T001–T018 complete, the final
`npm run verify` EXIT=0 on the release tree, `npm run release:check`
GREEN (16 deterministic gates), the deploy rehearsal exit 0 (the 68-file
manifest + the credential refusal named), the built-artifact smoke 3/3
against `vite preview`, the release suites 10/10 and a11y.matrix 31/31 re-
proven, nothing committed (checkpoint convention: `release(040): …` —
tagging, deploying, and pushing are owner actions).

## Objective

Ship it, honestly (master plan §Frontend Phase 20): a production build
that deploys reproducibly, carries no secret, serves every client route
in the built artifact, is monitored enough to be operated, and has a
documented rollback — with the frontend production-readiness checklist
answered item by item in the runbook's wired/operator/n-a honesty model.

## Deliverables

- **The deploy story (US1)**: `build-record.md` (clean-tree build, ZERO
  warnings, FR-01; 25 route chunks with no budget drift vs 038, FR-02);
  `deploy-rehearsal.md` (`--dry-run` exit 0 — exactly what a real deploy
  uploads; the real path demands the three Cloudflare credentials and
  names them, FR-01/SC-001); the runbook's rollback section now names
  the three non-rollbackables (FR-09).
- **The deep-reachable built app (US2/FR-05)**:
  `e2e/production.smoke.test.ts` 3/3 against `vite preview` — the five
  deep-link classes, the state matrix in the built bytes (the honest
  NOT-FOUND refusal, the offline banner lifecycle, a VERBATIM mutated
  refusal + explicit retry), one REAL round with realtime staff
  movement, console clean (F-G14). The caching posture recorded (FR-07).
- **The honest operations record (US3)**: the runbook gains the
  per-environment variable-placement table (FR-04), the production
  auth-redirect operator step (FR-06), and the vendor-free
  error-tracking disposition with what the boundary exposes and what
  the operator watches (FR-08); `release-notes.md` in user terms
  (FR-12).
- **The regression record (US4)**: `regression-record.md` — 10/10
  release suites, 31/31 a11y matrix, 3/3 built smoke, and the FINAL
  gate-verdict table; the FR-03 manual bundle inspection (49 assets,
  zero secret matches, only the publishable key inlined) + the
  cross-browser record (chromium primary; WebKit the recorded
  not-exercised posture).
- **`npm run release:check` (T006/FR-10)**: one command re-running the
  deterministic release facts — guard suite, bundle-class manifest
  gate, budget re-read, the artifacts' structural gates, and the
  dry-run; GREEN (16 gates). Registered in package.json and documented
  (conventions + development.md).
- **The completed checklist (FR-10/SC-002)**:
  `release-checklist.md` — 16 rows, every row carrying its disposition
  and proof; the operator rows carry owner + console path.

## The honest gate ledger

The first full `npm run verify` attempt on the release tree failed its
db tier (14 fixture-drift failures) — the mandated `db:reset` → rerun
proved 516/516. The integration tier then failed 6 files: ONE real
orphan (an auth user the provisioning suite's own interrupted earlier
attempt had left in the dev database — removed, one row) plus the
shared-cloud auth rate-limiter's burst noise (the tier cooled and re-ran
green, 7/7). The FINAL full-gate run landed **EXIT=0**. Recorded here
because deploy honesty includes the path to green, not only the verdict.

## Debug ledger

- `production.smoke`'s three honest lessons: the entry form's
  Branch→Table progressive disclosure (the built app honors it); the
  demo slug renders the built NOT-FOUND refusal rather than the error
  boundary; the offline banner lives on the staff leg (the journey's
  posture). All fixes are assertion-targeting, not loosening.
- `release.role-kitchen` gained `testInfo.setTimeout(180_000)` like its
  sibling suites (its long serial leg hit the config's 30 s default on
  re-run).
- Windows quirk: `npx`/`npx.cmd` spawn EINVAL from node on this host —
  release:check invokes vitest via `node node_modules/vitest/vitest.mjs`.

## Boundary

Nothing committed or pushed; no tag; no real deploy (CHK-03's confirmed
division — the owner's `npm run deploy` performs exactly the rehearsed
upload). No CI (the recorded decision), no analytics, no service worker,
no new product features, no schema change.
