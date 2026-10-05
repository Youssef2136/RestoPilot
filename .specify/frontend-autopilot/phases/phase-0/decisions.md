# Phase 0 Decisions

**Date:** 2026-09-26 · **Commit:** `b569215`

## D1 — "start phase 0" = First Run + begin Phase 01

The Master Plan has no Phase 0. The autopilot SKILL.md First Run procedure governs: inspect →
baseline → prerequisites → begin Phase 01's workflow (SpecKit pipeline for
`specs/021-frontend-foundation`). No product code is written in phase 0.

## D2 — `db:reset` used to repair the shared dev database

The database was drifted (platform kill-switch on + manual residue rows). The documented
remedy (docs/development.md "Database in a partially migrated or unknown state") is
`npm run db:reset`. Guard checks passed (declared dev ref in `.env`), `--yes` used per
non-interactive run, auth users survive by design. Tree was clean (no work lost) and the
target was verifiably the development project. Alternative (surgical UPDATE only) was
insufficient because fixture-count tests also failed on residue rows.

## D3 — Residue cleanup via direct SQL, not another reset

After the reset, later e2e/integration runs re-deposited residue. Recurring full resets are
expensive (~4 min) and reset ≠ cleanup (residue was post-seed). Used FK-ordered scripted
deletes for the specific residue families instead, verified by the final 100/100 e2e run.
The cleanup scripts were temporary (`tmp/`), run once, then deleted; no repo artifact added.

## D4 — Rate-limit discipline for the rest of the roadmap

Future phases must: never run `test:integration` twice within one 5-minute window; treat a
429 `over_request_rate_limit` as an environment retry (wait ≥ 5 min, re-run once), not a
product failure; and prefer the e2e suites' own storage-state discipline once Phase 01
tooling lands.

## D5 — SpecKit artifacts for phase 0 kept minimal

Phase 0 is the First Run, not a Master Plan phase: no spec/plan/tasks of its own. The
SpecKit pipeline starts at Phase 01 (`specs/021-frontend-foundation`). Phase 0 persists
state + baseline/findings/decisions/validation/report under
`.specify/frontend-autopilot/phases/phase-0/` per SKILL.md.

## D6 — E2E residue defect is recorded, not fixed in phase 0

The mutating e2e suites (platform onboarding, platform console, full journey) violate the
residue policy (Master Plan §12.5) and poison subsequent runs. Fixing suite teardown is a
test-infra change that belongs to a phase owning those suites; recorded as a carry-forward
task for Phase 01's tooling work (it already touches Playwright) or Phase 14. Not silently
patched here (phase isolation).
