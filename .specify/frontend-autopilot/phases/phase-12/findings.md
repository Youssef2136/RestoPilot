# Phase 12 — Findings (CRITIQUE / AUDIT / FIX during IMPLEMENT)

## Fixed during implementation

- **F1 (HIGH → code) — E2E websocket typing failed the real gate only.** The draft
  `waitForCueSubscribed` in `live.awareness.test.ts` registered listeners on
  `page.context().on('websocket', …)` — TS2769 under `tsc -b` (the e2e project), invisible
  to `npx tsc --noEmit` (which does not build the e2e tsconfig — the recorded phase-11
  lesson re-confirmed live). Fixed by adopting the proven page-level pattern from
  `realtime.test.ts` verbatim (`page.on`/`page.off`), which also removed an accidental
  double registration. Gate: `npx prettier --write … && npx tsc -b` clean.
- **F2 (MEDIUM → test) — The console's row action is not always 'Change dates'.** After a
  db:reset the subscription row is `never_activated`, so the row's action is **'Activate'**;
  the nearing journey clicks that, saves start=today/end=+3, and lands
  `nearing_expiration` directly (the 'Change dates' specialization fails by design after a
  reset — proven by a failed attempt before reset in the interrupted session).
- **F3 (LOW → test) — Whole-banner text assertions are whitespace-coupled.**
  `toHaveText` on the cue merged the fixed line and the affordances
  ('arrived.Show…'), so the honest pin asserts by parts: the fixed line via
  `getByText`, the two affordances by role, and `cue.locator('> *')` count 3 —
  structure pinned without whitespace-shape coupling.
- **F4 (test) — A missed phoenix ACK must not wedge the test.** The cue is
  event-derived with no recovery read, so the join ACK is awaited via
  `Promise.race` with a 15 s grace (the SUBSCRIBED refetch reconciles either
  way — the binding's own posture), keeping the suite deterministic under
  degraded cloud latency.

## VALIDATE-cycle findings (verify → full Playwright)

- **B1 (MEDIUM/ENV, no code change) — The shared cloud DB carried residue and live
  writers.** verify round 1: 2 failures — `order.rpc` audit count 3≠2 (a concurrent
  writer committed an audit row between the two count samples) and
  `platform.admin` 'expired' instead of 'never_activated' (subscription dates left by
  an E2E journey interrupted by the Freebuff restart). Round 2 was launched while round
  1's tail (test:integration/build) was still running → 6 failures, all external
  `menu.items_reordered` audit rows + a fixture-match reading concurrent reorders —
  self-inflicted overlap, no phase code involved. A later round also hit 27 transient
  vitest worker-fork spawn failures (exit 0xC0000142 'during starting state'; 4 files
  that did spawn passed 154/154). Clean run after confirming no process overlap +
  `db:reset`: **test:db 31 files 516/516, test:integration 7 files 38/38, build ✓**
  (`tsc -b && vite build`); format/lint/typecheck/test:unit green in both earlier
  rounds on the same tree — every gate has a green run on the final code.
- **B2 (MEDIUM/ENV, no code change) — The documented legacy environmental spec again.**
  Full Playwright (workers=1, timeout=90 s, db:reset before, 24.0 m): **184 passed**,
  1 failed (`reports.surfaces:131` — the phase-11-recorded environment-bound spec,
  timed out waiting for the cashier's 'Void round' button), 2 did not run (its serial
  siblings `:177`/`:193` skipped after the failure). **Isolated rerun: 6/6 passed,
  EXIT:0.** Classification: ENVIRONMENT, exactly per the recorded protocol. Every one
  of the 187 tests has a passing run. `live.awareness` (both tests) and the locked
  `platform.surfaces` date journeys passed inside the full screen. No frozen anchor
  moved in any run.

## State at exit

T001–T005 done; announcementPolicy 9/9, subscriptionCopy 5/5, cue supersede 3/3;
verify green across rounds (unit/db/integration/build all green on the final tree);
full Playwright 184/187 + isolated 6/6 for the legacy environmental spec (protocol
recorded: workers=1/90 s round + isolated rerun). Remaining: checkpoint + push.
