# specs/038 — Quickstart (walkthroughs)

## W1 — Bundle baseline + split + budget re-measure (US1 foundations)

1. `npm run build` — record the chunk list (name/raw/gzip) from the vite
   output into `measurements/W1-baseline.md` (the FR-01 bundle record).
2. Apply the router split (D2). Rebuild. Assert the class rule
   (customer chunks contain no staff/admin module ids and vice versa) — the
   deterministic e2e/unit assertion. Record Baseline/Change/Measurement/Result.
3. Re-run the 016 measurement approach for `get_session_menu` and the
   submission path on the final tree (FR-09, information, corrected method
   identical to 016's).

## W2 — Throttled customer journey (US1)

1. Start the dev servers (the standing webServer config covers this).
2. `npm run db:reset -- --yes`, then run the throttled journey spec (CDP
   Slow 3G + CPU×4 per R3). Record navigation timings
   (menu interactive) and the cart-add interaction latency (Performance
   API in-page marks). Values recorded as informational with the profile
   named; the deterministic assertions in the same spec are: no duplicated
   network requests on the menu load, no staff/admin chunk requested
   (hard), cart-add renders local state within the in-page mark (hard
   client-side only, no network).
3. Record Baseline → Change → Measurement → Result in
   `measurements/W2-customer-journey.md`. Manual Lighthouse capture (R9)
   appended once during implementation.

## W3 — Board burst render profiling (US2/US3)

1. Unit harness: a Profiler-based render-counter vitest spec over the
   cashier list and kitchen board with a synthetic burst stream (per R7).
2. If list-container re-renders dominate: add memo boundaries (D6); re-run
   the counter. Record per-surface Result (including "no change needed").
3. E2E: the DOM-identity probe (stable keys — service row nodes are the
   SAME nodes across a burst arrival) on the live board.

## W4 — Reports/audit probe + virtualization decision (US4)

1. Navigation timing probes on /dashboard/reports and /dashboard/audit at
   realistic volumes (the seeded volumes + the burst-written volumes).
2. If a long trail exceeds its recorded interaction budget: adopt the
   virtualization primitive for THAT surface only (D7), re-run the 035
   a11y suites for that surface, record everything; otherwise record the
   "below budget" Result.

## W5 — Realtime cost review (D8) + cache-policy table (FR-04)

1. Count open channels/intervals per surface in a vitest harness; measure
   duplicate invalidations per event; check poll/realtime overlap on the
   same keys.
2. Write the cache-policy table into `specs/038-frontend-performance/cache-policy.md`;
   align any client-vs-table diff (recorded first, changed second).
3. Removal decisions only with a recorded redundancy measurement; all
   standing suites must remain green unmodified.
