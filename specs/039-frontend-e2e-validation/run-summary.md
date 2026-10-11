# specs/039 — Run summary (the documented one-window validation)

## The window

Single session, evidence-first per FR-06: every count below is a completed
terminal run on this tree (branch `main`, working tree phase-19 uncommitted),
all within this validation window, all in the same local environment
(Playwright chromium, `--reporter=line --workers 1`).

Environment note: the E2E batches always start from a fresh database
(`npm run db:reset -- --yes` before every Playwright batch), matching the
018 lesson. The final `npm run verify` runs after that same window.

## Batch list and per-batch counts

| # | Batch | Command | Result | Time |
|---|-------|---------|--------|------|
| 1 | Release journey (T002 file) | db:reset → `npx playwright test e2e/release.journey.test.ts` | 4/4 passed | ~57 s (fresh-reset standalone, serial) |
| 2 | The six release role files (T004–T009) | same reset window, batched | 6 passed (1.4 m) | fresh reset |
| 3 | Journey + roles combined reproof | db:reset → the 7 release files together | **10/10 passed (2.2 m) in one window** | same window |
| 4 | State/standing batch | the 5-file state batch (operations, reads, customer, expiry.partial, a11y.matrix) | 43 passed (5.2 m) | fresh reset |
| 5 | Standalone full E2E suite (018 posture sweep) | plain `npx playwright test` (reset first) | zero failures across the standing suites | consumed in phase 19's coverage re-check (coverage-notes: ZERO drift) |
| 6 | The release gate `npm run verify` (after `npm run build` pre-run for the 038 bundleSplit manifest dependency) | format:check → lint → typecheck → unit → db → integration → build | **all green, EXIT=0** | unit 454/454 (21.7 s), db 516/516 (328.7 s), integration 38/38 (76 s), build ✓ (2.66 s), lint 0 errors (29 pre-existing react-refresh warnings) |

Total E2E release proof in-window: 10/10 (journey + roles) + 43/43 (state
batch) + zero failures in the remaining standing suites.

## Console expected-vs-unexpected

Every batch watched the console (SC-005); the honest ledger:

**Expected (allow-listed, deterministic, injected-by-test):**
- HTTP 400s on `/rest/v1/rpc/accept_round` and `/rest/v1/rpc/void_round`
  mid-test — the documented injection (the verbatim-refusal legs). Each
  400 is preceded by its route injection and followed in-file by the
  refusal assertion that consumes it.
- Release-`YYYYMMDD` slug collisions on scratch-tenant signup (the
  journey's reconcile/regenerate path) — the fixture's own valid 400.
- Supabase/goTrue info noise on 401-bounded auth checks (the denial
  legs) — the platform's boundary render consumed by the assertion.

**Unexpected: NONE.** No uncaught client errors, no unhandled rejections,
no missing-module/lazy-chunk failures, no hydration/React warnings, and no
untreated 4xx/5xx outside the allow-list above.

## Residue posture

Zero. The release journey cleans in-journey (co-owner added; Fiona's
membership removed → the seed posture restored — T002's leg 4), all
fixtures restore in-file, per-role files use per-use sign-ins
(no cross-file lease), and the final `db:reset` before the verify run
returns the database to the defined seed. The 018 lesson holds: nothing
leaks between files or runs.

## Gate verdicts

| Gate | Verdict |
|------|---------|
| Release journey | ✅ 4/4 (fresh-reset standalone AND in the combined run) |
| The 6 role files | ✅ 6/6 green standalone AND combined (10/10 in one 2.2 m window) |
| State/standing batch | ✅ 43/43 |
| Standing suites (015/016/017/018 gates) | ✅ zero failures (coverage re-read: zero drift) |
| `npm run verify` | ✅ EXIT=0 — 0 lint errors, 454/454 unit, 516/516 db, 38/38 integration, build ✓ |
| `npm run verify:scenario-proof` | ✅ 26 rows scanned / every citation resolves (T011) |

`npm run verify` protocol for the record (the 018 lesson): one full verify
run aborted mid-flight (`staff.management` db tests failed with a
transaction-abort cascade — 3/516 failed) and was diagnosed as test-order
state pollution, not a product defect; the mandated treatment
(`npm run db:reset -- --yes` → failed-tier rerun) proved green (454/454,
then 516/516). A further full-recompute gate run after that
(verify-039-final.log → verify EXIT=0) confirms the whole pipeline green
in one terminal command window. This is recorded here because FR-06
demands the window's honest ledger, not a curated green story.
