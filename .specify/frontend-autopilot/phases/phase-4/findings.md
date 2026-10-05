# Phase 04 Findings (specs/024-auth-and-customer-entry-ux)

## F1 — `<option>` visibility contract (carried, formalized)
`locator.waitFor` with the default `state:'visible'` can NEVER resolve for an `<option>` inside a closed `<select>` — Playwright visibility requires a non-zero box, which options only have while the dropdown is open. When the contract is option EXISTENCE (the public payload loaded), wait `state:'attached'`. Verified by a manual chromium probe (waitFor 'T3' option timed out with count:1). Baked into `submitCustomerRound` (e2e/realtime.test.ts) with a branch-aware diagnostic (options + branch value in the thrown message).

## F2 — marinaT1Lock flip: hydration race + swallowed toggle click (HIGH → fixed)
Symptom: kitchen-queue test failed at teardown — row still "T1 Active" after the deactivate step ran "successfully". Root causes, both fixed in e2e/realtime.test.ts:
1. The pre-click probe was a bare `await reactivate.isVisible().catch(()=>false)` racing React hydration — on a loss the click was silently SKIPPED, T1 stayed inactive, and the customer entry saw only "Choose a table…". Fix: wait for the T1 row first (`marinaRow.waitFor visible 10s`), THEN probe — the same wait the teardown already used.
2. The teardown's own `deactivate.click()` can be SWALLOWED mid-React-re-render (the old-node click registers before the tree swaps; 16 resolvers all showed "Active"). Fix: wrap deactivate+assert in `expect(...).toPass({timeout:20_000})` — the retry re-clicks after the re-render settles. A bare toPass on the ASSERTION alone is NOT enough: the assertion's failure must re-enter the click branch, so the click belongs inside the retried body.
Pattern recorded: any "click the state oracle then assert the flip" sequence under React re-renders wants (row wait) → (click) → (flip assert), with click+assert retried together via toPass when a swallowed click is possible.

## F3 — entry lock contention: file-spanning hold starves the suite (HIGH → fixed)
Full-run failure: realtime SC-001 30s-timeout while platform.surfaces held the entry lock from beforeAll to afterAll — its 7 serial tests (~4 min with onboarding) queued every other file's customer entry past the default test timeout. Fix in e2e/platform.surfaces.test.ts: hold the lock ONLY across the disable→re-enable kill-switch window (withEntryLock inside the two tests, each budgeted 120s), NOT the whole file; added an afterAll safety net that re-enables the tenant if a failure inside the window skips the re-enable test (serial mode). realtime SC-001 got `test.setTimeout(120_000)` for queueing. Result: platform+realtime pair 11/11, full run 150/150.

## F4 — interrupted db:reset leaves a partial database (MEDIUM, operator note)
The first `db:reset` was killed mid-run (schemas dropped, migration push killed) leaving NO `memberships` table and 14 residue restaurants — any subsequent suite would fail confusingly. `npm run db:reset -- --yes` re-run to completion restored the clean base (2 restaurants, 6 memberships) and verify was re-proven on it. Note for the runbook: an interrupted reset is NOT a safe state; always finish the reset before diagnosing test failures.

## F5 — impeccable: one-sided thick border anti-pattern (LOW → fixed)
`impeccable detect src` flagged RootPage.module.css `.deepLinkNote` `border-left: 3px solid …` (the one-sided-accent tell). Removed the border; kept the muted color + padding-left indent. Re-run: clean.

## Carried warnings
- E2E leaves tenant residue by plan design — run verify on a fresh reset before full E2E (R1 from 023, re-confirmed this phase).
- Impeccable launcher remains detect-only (R2 from 022).
