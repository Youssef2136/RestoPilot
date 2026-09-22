# Checklist: Journey Honesty and Scenario Coverage (Phase 16)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) · Created 2026-09-22

Reviewer-owned (per the 005–016 convention: checked by a human reviewer,
not by the implementing agent).

## Journey fidelity (§27 verbatim)

- [ ] The journey creates the restaurant, branch, tables, and menu through
      the owner UI forms — no seeded data stands in for a §27 step
- [ ] The customer enters through the public route exactly as a scan would
      (slug → branch → table → name + phone), on a fresh browser context
- [ ] Every §27 happy-path hop is asserted in the journey: entry, round 1,
      cashier accept, kitchen prepare + ready, the customer's updated
      state, round 2, the second ticket, the bill, the close
- [ ] Money is asserted against captured prices, not current menu prices
      (the SC-005 rule) in the journey's bill step
- [ ] The journey is rerunnable: it never mutates the seeded fixture and
      tolerates its own previous runs (date-suffixed slug)

## Scenario coverage honesty (the twelve)

- [ ] Each scenario in the spec's table is either cited with file + test
      name that exist verbatim, or covered by a new test in this phase
- [ ] The cited proofs actually assert the §27 behavior (not merely a
      neighboring feature)
- [ ] The two price-change timings are proven separately: new session vs.
      old session with captured-price preservation
- [ ] Closed session → new session is proven in the browser (a freed table
      re-enters), not only at the RPC layer

## Launch-gate integrity

- [ ] `npm run verify` exit 0 with the new suites included
- [ ] Full e2e passes single-worker (the documented deterministic gate)
- [ ] The phase's convergence record names any journey-exposed friction
      without redesigning it (the non-goals rule)
