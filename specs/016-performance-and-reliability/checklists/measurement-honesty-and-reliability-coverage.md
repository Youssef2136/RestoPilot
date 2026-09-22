# Checklist: Measurement Honesty and Reliability Coverage (Phase 15)

**Feature**: [spec.md](spec.md) | [Plan](plan.md) · Created 2026-09-22

Reviewer-owned (per the 005–015 convention).

## Baseline integrity

- [ ] The artifact records environment metadata (project, fixture scale,
      timestamp) alongside every timing
- [ ] Medians are of 5 runs with a discarded warm-up; no cherry-picked
      best-of numbers
- [ ] Every one of the nine §26 areas has a measured entry in the artifact
- [ ] The two customer-path budgets (menu ≤ 1500 ms, submission ≤ 800 ms)
      are stated in the spec and checked against the artifact
- [ ] No standing gate asserts on remote timing (budgets are checked in
      this phase against the artifact, not flaked in CI)

## Reliability coverage

- [ ] All eight §26 scenarios are either cited to an existing test or
      covered by a new deterministic test
- [ ] The three cited scenarios name their proving test files precisely
- [ ] The new journeys assert end states, not implementation details
- [ ] The concurrent-cashier journey is deterministic (guarded-update
      semantics), not a racy race reproduction

## Fix discipline

- [ ] Any fix is minimal and targeted (index/query-shape/cache), with the
      re-measurement committed next to the fix
- [ ] No caching layer, denormalization, or re-architecture was introduced
- [ ] The one-read-path and anti-drift rules still hold after any fix

## Launch-gate record

- [ ] `baselines.json` is committed with the phase's results
- [ ] The reliability results are visible in the standing gates (verify
      green includes the new journeys)
