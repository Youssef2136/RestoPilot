# Phase 18 — Report (specs/038 · Performance & Perceived Speed)

## Final status

**DONE — converged (first round)** — T001–T018 complete, `npm run verify`
green on the final tree, the batched Playwright sweep closed with ZERO
failures (including the 015/016/017 carry-forward suites UNMODIFIED), every
optimization/decision carrying a recorded **Baseline → Change → Measurement
→ Result** entry, nothing committed (commit convention: `perf(038): …`, at
the user's word).

## Objective

Make the frontend fast in ways that are **measured, not asserted** (master
plan §Frontend Phase 18, operate mode): the customer route stops carrying
the whole application (route-level code splitting, hard deterministic
assertions only), cache policy is one written table, boards are burst-safe
by construction (keys + DOM identity, no speculative memo), trails are
measured before any optimization is allowed, and the 016 oracle is
re-measured without re-litigating it. Clarified discipline: ALL timing
measurements informational (shared cloud DB variance acknowledged); only
deterministic facts (chunk-class membership, client-side marks, DOM
identity) are hard; Lighthouse manual-recorded.

## Deliverables

- **Route-level code splitting (FR-02, D2)**: `src/app/lazyPages.tsx` (the
  23 `React.lazy` page boundaries, declared OUTSIDE the E2E-imported
  `routes.ts` — its define-free/statically-analyzable contract preserved)
  + the router splitting at the existing shell-group declarations with a
  root `Suspense` fallback (`PageSuspenseFallback` = the 037 Skeleton —
  the matrix chunk-slow state) and the `ErrorBoundary` wrap (chunk
  failures fall to RouteErrorView, never a white screen).
- **The deterministic split gate (T004)**: `tests/unit/bundleSplit.test.ts`
  4/4 reading `dist/.vite/manifest.json` (`build.manifest: true` added to
  `vite.config.ts`): every page is its own chunk; customer chunks reach no
  staff-only markers; staff/admin chunks reach no customer-tenant markers.
  Shared-vocabulary exclusions recorded (sessionClient is legitimately
  shared by the session surface vocabulary).
- **The evidence chain (FR-01/SC-001)**: `measurements/W1-baseline.md` (the
  794.24 kB single-chunk baseline verbatim from vite), W2 (journey + the
  bundle axis −489 kB pre-loaded: index 305.70 kB/95.84 gzip, 49 chunks,
  CustomerMenuPage 19.92 kB), W3 (boards), W4 (+ self-recording probe data
  `W4-probe-data.jsonl`), W6 (images), W7 (prefetch) — every record with
  the harness + profile named.
- **The budget ledger (FR-08, budgets.md)** B1–B8, each with kind
  (hard/informational), 016 justification, and measured result: B3/B4/B5
  hard PASS; B1/B2 informational PASS; B6 variance recorded (subscribe
  396 ms this capture vs ≈218 ms 016 — broker variance; reconnect 113/117
  ms in the 016 band); B7/B8 measured baselines.
- **FR-09 no-regression record**: the 016 script re-run
  (`node --env-file-if-exists=.env scripts/run-perf-baselines.mjs`):
  menu 149/1500, submission 160/800 — in-budget; deltas recorded as
  shared-cloud variance; **zero frontend-attributable regressions**.
- **Cache policy (FR-04)**: `cache-policy.md` — 8 query families, ALL
  client-matching today (zero diffs to align); keys keep identity/scope;
  mutation retry manual-only recorded as the table's standing row.
- **Decisions recorded as measured Results (D6/D7/D5/D4)**: NO memo
  boundaries (W3 — pure grouping + key-stable rows + whole-payload
  refetches), NO virtualization (W4 — sub-second trail opens: audit
  1121 ms / reports 1147 ms), NO SmartImage (W6 — the guest path ships
  zero `<img>`: the designed-absence image slot is the recorded posture),
  NO prefetch (W7 — post-split first-navigation cost is tens-of-kB chunk
  fetches inside cloud-fetch noise).
- **Docs**: `docs/conventions.md` §Performance budgets (spec 038) — the
  four standing rules for future phases.

## New specs (all deterministic)

- `e2e/perf.customer.test.ts` (1/1) — CDP Slow 3G + CPU×4: dedup menu-load
  window, zero staff-chunk leak on customer routes (runtime), zero-write
  local cart-add; informational timing attach.
- `e2e/perf.boards.test.ts` (2/2) — the stamped-node DOM identity probe:
  a real burst arrival remounts NOTHING (existing card nodes are the same
  nodes); kitchen leg recorded.
- `e2e/perf.trails.test.ts` (2/2) — measure-then-decide trail probes,
  self-recording to `W4-probe-data.jsonl` (the LINE reporter drops
  attachments; the evidence rule demands the record).
- `tests/unit/boardRenderProfile.test.ts` (3/3) — the key/order purity
  preconditions (node env; the live half moved to the DOM-identity probe).
- `tests/unit/bundleSplit.test.ts` (4/4) — the hard manifest gate.

## Debug ledger (honesty notes)

- The perf.customer dedup assertion initially counted the JOIN's
  multi-step refetches as duplicates — corrected to the RELOAD window
  (the discipline is the menu load, not the necessarily-refetching join).
- The boards probe initially captured an EMPTY board (0 rounds after
  db:reset) — corrected to seed the pre-existing round BEFORE the board
  opens, then assert a real second arrival.
- The trails probe initially measured sign-in-inclusive timing and
  dropped attachments to the void (LINE reporter) — corrected to
  post-sign-in windows + direct `W4-probe-data.jsonl` writes.
- `react-refresh/only-export-components` warnings: pre-existing pattern
  warnings untouched (0 errors).

## Validation results (final gate, T018)

| Gate | Result |
| --- | --- |
| format:check | clean |
| lint | 0 errors (29 pre-existing warnings) |
| typecheck | clean |
| test:unit | 454/454 (42 files) |
| test:db | 516/516 (after db:reset) |
| test:integration | 38/38 |
| build | PASS 2.9 s, manifest emitted |
| Playwright (batched, db:reset first, chromium) | perf.* 5/5; full-journey+state.* 15/15; session/management/reports-suites/bill 34/34; kitchen+realtime+customer+entry 14/14; menu/tax/platform readability 41/41; ops suites 28/28; live/titles/routes/shell/smoke/gallery/design 32/32; display/a11y-baseline/responsive-smoke/keyboard/touch/motion 20/20; a11y.matrix+responsive 48/48 — **ZERO failures** |

SC-006 carry-forward: the 015/016/017 suites ran UNMODIFIED and green in
the same sweep — zero Category-A migrations.

## Convergence

One round, converged — SC-001..006 each mapped to an artifact or suite
result (manager review, the reader discipline applied): no gaps, no
convergence tasks appended, tasks.md byte-unchanged by the converge pass.

## Git checkpoint

None created — the working tree holds the phase; commit as `perf(038): …`
at the user's word.
