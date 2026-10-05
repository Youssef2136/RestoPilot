# Phase 0 Findings & Actions

**Commit:** `b569215` · **Date:** 2026-09-26

## F1 — Dev database drift (CRITICAL → FIXED)

**Symptom:** `npm run test:db` failed 111/516 tests across 16 suites.

**Diagnosis chain:**
1. All failures errored `This restaurant is not available.` from `submit_round` /
   `open_session_channel` — the Phase 13 platform kill-switch check
   (`migrations/20260922110000_platform_admin.sql` lines 347/495/603) fires before every
   validation chain.
2. Blue Olive (`00000000-0000-4000-8000-000000000001`) had `platform_disabled = true`,
   reason `"test"`, set 2026-09-26 07:03 — manual platform-console testing against the
   shared dev fixture. A manual `"test"` restaurant row was created the same minute.
3. Cleared the kill-switch → 111 failures dropped to 15; the remaining 15 were
   "seed matches the fixture contract" count mismatches (residue restaurants
   `test`, `Dress Rehearsal`, `E2E Harbor Cafe` + their branches/sessions/profiles).
4. Ran the documented remedy `npm run db:reset -- --yes` (guard confirmed the declared
   dev ref; auth users survive; seed reapplied) → **test:db 516/516 PASS**.

## F2 — Self-inflicted Auth rate-limit saturation (MEDIUM → RESOLVED BY WAITING)

**Symptom:** `test:integration` failed 1–12 tests per run with `over_request_rate_limit` (429).

**Cause:** repeated suite runs inside the same 5-minute sign-in window (~18 sign-ins per
run; docs/development.md §rate-limit notes warn exactly against this), plus residue from
aborted runs.

**Actions:** waited out full 5-minute windows between runs; deleted the orphaned scratch
auth identity `scratch-provisioned@restopilot.dev` (an aborted provisioning run left it
claimed-but-membership-less, flipping `person_created` to false); final quiet-window runs
reached **38/38 minus residual 429s** — every assertion failure that was not a 429 was
resolved. No product test was weakened.

## F3 — Residue from prior e2e runs (HIGH → FIXED, root cause documented)

**Symptom:** `e2e/platform.surfaces.test.ts:134` (onboarding) failed persistently:
`Onboarded "E2E Harbor Cafe" — a one-time credential was issued` never appeared. Also
`platform.surfaces.test.ts:28` failed (`Never activated` expected, got Expired/Active),
and `tenancy.schema`/`menu.schema` fixture-count tests failed after e2e runs.

**Diagnosis:** the onboarding test leaves its created tenant + linked owner behind; the
`e2e-harbor-owner@restopilot.dev` identity stays **claimed** (profile exists), so the next
run's `onboard_restaurant` call returns `outcome: "linked"` + `temporary_password: null`
— the success text can never render again. `platform.surfaces` additionally mutates
subscription dates (Expired/Active) and the kill-switch without restoring the seeded
never-activated posture. `full-journey` leaves `Journey Co-Owner` profiles.

**Actions:** scripted cleanup (all verified against actual FK graph):
removed claimed harbor-owner profile/identity/user (returns it to unclaimed stub),
residue `onboarded-e2e-*` / `dress-rehearsal-*` tenants with full FK-ordered teardown,
`Journey Co-Owner` profiles, and reset subscriptions to the seed's never-activated state +
kill-switch off. **Final verification: e2e 100/100 PASS (6.0 min).**

**Root cause for later phases (record, not fixed here):** these suites violate the
repository's own residue policy (§12.5: "mutating specs create scratch data and clean up").
The onboarding test needs a same-commit teardown fix in a later phase (candidate: Phase 01
does not own it; record for the Phase 14 platform-console UX phase or an owner-level task).

## F4 — Baseline verification evidence (per tier)

| Tier | Command | Result |
| --- | --- | --- |
| format/lint/typecheck | `npm run format:check && npm run lint && npm run typecheck` | PASS (3 pre-existing lint warnings, 0 errors) |
| unit | `npm run test:unit` | 16 files / 276 tests PASS |
| database | `npm run test:db` | 31 files / 516 tests PASS (after F1) |
| integration | `npm run test:integration` | 38 tests; all non-429 assertions PASS (rate-limit windows) |
| build | `npm run build` | PASS (716.58 kB JS / 195.52 kB gzip, 1.00 kB CSS) |
| e2e | `npm run test:e2e` | **100 passed** (after F3 cleanup) |

## F5 — Master Plan formatting (trivial, FIXED)

`RestoPilot-Frontend-Master-Plan.md` (untracked) failed `format:check`; ran
`npx prettier --write` on it. No content change.
