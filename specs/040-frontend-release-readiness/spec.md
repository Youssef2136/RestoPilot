# specs/040 — Frontend Production Readiness & Release (Master Plan §Frontend Phase 20)

## spec.md

### Purpose
Ship it. The release phase takes the validated frontend (phase 019's dress
rehearsal) to a reproducible production deploy: a production build that
carries no secret and meets its budget record, environment configuration
per environment, a deploy rehearsal plus the real deploy path through the
existing Cloudflare Pages contract, SPA fallback verified in the BUILT
artifact (deep links), caching headers recorded, auth redirect URLs for
the production domain recorded as an operator step, the error-tracking
decision recorded, a final regression record on the release commit, the
frontend production-readiness checklist answered item by item, release
notes in user terms, and the rollback procedure. Everything the repository
can prove is proven; everything an operator must do is recorded with its
owner and path — deploy honesty is the phase's discipline.

### User Stories (prioritized)

#### US1 — The reproducible deploy (P1)
The operator deploys the release candidate with ONE command and can roll
back with one command: `npm run build` from a clean tree succeeds with a
recorded warning ledger, `node scripts/deploy-frontend.mjs --dry-run`
prints the manifest a real deploy would upload, the real deploy path
(existing Cloudflare Pages contract) is verified to require exactly the
three named credentials and nothing more, and the rollback procedure
(Pages deployment rollback + what cannot roll back) is written down.

**Why this priority**: without a trustworthy deploy path nothing else in
the phase ships.

**Independent test**: on the release commit, a clean-tree `npm run build`
plus `--dry-run` succeed; the rundown of the real-deploy script's
preconditions matches the contract verbatim; the rollback section of the
runbook is updated for the frontend's release reality.

#### US2 — The deep-reachable built app (P1)
A guest reaches a QR deep link in a fresh browser and the app loads: the
SPA fallback is proven in the BUILT artifact for
`/r/:slug`, `/r/:slug/menu`, `/signin`, a `/dashboard/*` staff deep link,
and an `/admin/*` deep link — with no dev server involved — and the
caching posture (hashed assets immutable vs `index.html`) is recorded.

**Why this priority**: deep links are how customers arrive; a broken
fallback is a launch-day incident.

**Independent test**: `vite preview` (the built artifact served locally)
loads each deep-link route; the caching/headers record names what the
host provides by default and what the operator configures.

#### US3 — The honest release operations record (P2)
The owner knows what happens when something breaks and who is told: the
error-tracking disposition is recorded (vendor-free by default with
rationale, or a wired vendor as operator steps), monitoring/error
ownership is named, the environment matrix gets its exact variable names
per environment, auth redirect URLs for the production domain are
recorded as an operator step with its dashboard path, and the release
notes tell users what shipped across Phases 01–19.

**Why this priority**: launch is also an operations contract; ambiguity
here costs incident time.

**Independent test**: the updated
`docs/production-runbook.md` + `specs/040-frontend-release-readiness/release-notes.md`
answer each disposition with wired/operator/n-a-with-reason; release
notes committed.

#### US4 — The release regression record (P2)
The built artifact, not the dev server, passes the standing checks: the
production build smoke suite (deep-link cold loads, a real ordering round
with realtime movement, a refusal, the offline banner) runs against the
built artifact; the a11y floor re-runs on the built artifact (preview
URL or deploy); the release commits sit green on `npm run verify` and the
Phase 19 release suites.

**Why this priority**: the release candidate is what ships; dev-only
proofs don't count.

**Independent test**: the production smoke spec green against
`vite preview`; `npm run verify` green on the release commit with the
run summary referencing it.

### Functional Requirements
- **FR-01** The production build succeeds from a clean tree; every build
  warning is fixed or recorded with a reason (the warning ledger).
- **FR-02** The bundle budget check is recorded per route chunk (budgets
  re-read: the 038 hard chunk-class rule still holds; sizes recorded).
- **FR-03** No secret in the bundle: the guard test still passes AND a
  manual inspection of the built assets is named in the checklist (the
  publishable key is public by design; nothing else inlined).
- **FR-04** Environment values documented per environment (Local/Staging/
  Production) with the exact variable names, in the environment matrix.
- **FR-05** SPA fallback proven by deep-link loads in the built artifact
  for: `/r/:slug`, `/r/:slug/menu`, `/signin`, `/dashboard/*`,
  `/admin/*`.
- **FR-06** Auth redirect URLs for the production domain recorded as an
  operator step with its dashboard path.
- **FR-07** Caching policy for hashed assets vs `index.html` recorded.
- **FR-08** Error tracking decision recorded (vendor-free by default:
  what the error boundary exposes, what the operator wires; or a wired
  vendor with credentials as operator steps).
- **FR-09** Rollback procedure recorded (Pages rollback + what cannot be
  rolled back).
- **FR-10** The frontend production-readiness checklist with dispositions
  `wired` / `operator` / `n/a`-with-reason (the runbook's honesty
  posture).
- **FR-11** Cross-browser/device regression record (chromium primary;
  additional engines per the standing clarified posture).
- **FR-12** Release notes in user terms (what shipped across Phases
  01–19).

### Out of Scope
New product features; database migrations or Supabase project creation
(operator actions, already documented); CI pipeline (recorded as a
decision, not introduced); analytics/marketing tooling; service
worker/PWA; redirection of the deploy script's contract beyond what this
phase specifies; new RPCs or schema changes.

### Success Criteria
- **SC-001** `npm run build` from a clean tree + `--dry-run` rehearsal
  succeed on the release commit.
- **SC-002** Every checked FR carries its disposition and proof in the
  completed checklist.
- **SC-003** Deep links verified in the built artifact (all five route
  classes of FR-05).
- **SC-004** No secret in the bundle (guard + the named manual
  inspection).
- **SC-005** `npm run verify` green on the release commit; regression
  suites green on the built artifact where the phase proves them.
- **SC-006** Release notes + rollback documented; runbook updated.

### Assumptions
- The existing contracts hold: `npm run build`, `npm run deploy`,
  `--dry-run` rehearsal, the three Cloudflare credentials, SPA fallback
  precondition, `tests/unit/production.guard.test.ts`, the runbook's
  environment matrix.
- Chromium stays the E2E engine (the 016/019 clarified posture); the
  cross-browser record is a record, not a new engine bring-up.
- Deploying, tagging, and pushing are owner actions; the phase proves and
  documents, it does not ship by itself.

## Clarifications (session 2026-10-11)

- Q: Is the error-tracking vendor wired now or deferred? → A: DEFERRED —
  vendor-free with the explicit disposition: the error boundary exposes
  the recovery view (never the raw message), the operator watches
  Supabase logs + the host's dashboard; wiring a client-side vendor is a
  future spec if wanted.
- Q: Is a release-check script added? → A: YES — one narrow script
  (`npm run release:check`) wiring the deterministic release assertions
  (guard + budget re-read + checklists' verbatim gates), registered in
  package.json and documented (§12.3's register-in-docs rule).
- Q: Is CI introduced? → A: NO — recorded as an explicit decision (the
  repo has none today; the owner did not ask; the gates run locally).
- Q: Who owns each operator step? → A: The project operator (the owner)
  owns every operator disposition; each step is recorded with its console
  path exactly as the runbook already does.
