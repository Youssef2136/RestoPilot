# Checklist: Measurement Honesty & No-Behavioral-Change (specs/038)

**Intent defaults used**: Depth Standard · Audience Reviewer · Focus:
measurement honesty (no unmeasured claims) + no behavioral change.

## Measurement honesty
- [x] CHK001 — Does every performance requirement demand a recorded
  Baseline → Change → Measurement → Result entry, with "a claim without a
  measurement" explicitly rejected? [Spec §FR-01, §Evidence structure]
- [x] CHK002 — Is the distinction between hard (deterministic) and
  informational (cloud-variance) assertions stated per budget, not left to
  implementer judgment? [Spec §FR-08, Clarifications]
- [x] CHK003 — Are the 016 oracle numbers named as re-measure-not-relitigate,
  with the re-measurement method pinned to the recorded method? [Spec §FR-09,
  Research R2]
- [x] CHK004 — Is "measured no change needed" defined as a valid recorded
  Result (so absence of optimization is honest, not a failure)? [Spec §US3,
  §FR-06]
- [x] CHK005 — Is the throttling profile named concretely (Slow 3G + CPU×4)
  and is the tool choice recorded rather than assumed? [Clarifications, R3]
- [x] CHK006 — Is the manual Lighthouse capture's status (recorded values,
  never CI assertions) explicit? [Clarifications, R9]
- [x] CHK007 — Are reverted/worse results covered — does the evidence rule
  require recording a measurement that got WORSE and the revert? [Spec §
  Evidence structure]

## No behavioral change
- [x] CHK008 — Does the spec pin the standing suites (015 a11y, 016
  responsive, 017 state) as UNMODIFIED gates, with any requires-clause
  naming its reason? [Spec §SC-006]
- [x] CHK009 — Is prefetch constrained (identity-readable only, never
  customer token reads, measured benefit) so it cannot change observable
  behavior? [Spec §FR-05, Security]
- [x] CHK010 — Are cache-key identity/scope invariants named so the cache
  policy work cannot leak tenant data? [Spec §Security, data-model
  Invariants]
- [x] CHK011 — Is virtualization conditional on measurement AND required to
  preserve the a11y baseline where adopted? [Spec §FR-07, Clarifications]
- [x] CHK012 — Is the image work scoped so the customer tree's designed
  image-slot absence is not overturned without a measurement? [Research R6,
  Spec §FR-03]
- [x] CHK013 — Are loading states for lazy chunks required to come from the
  037 vocabulary (no new spinner primitives)? [Spec §State Matrix, plan D2]

## Budgets & scope discipline
- [x] CHK014 — Does FR-08 pin the per-budget record format (threshold +
  justification + result) so a budget cannot appear without a baseline? [
  Spec §FR-08, Evidence structure]
- [x] CHK015 — Is the split-boundary assertion required to be
  deterministic (build-output based), not a timing claim? [Spec §FR-02,
  Clarifications]
- [x] CHK016 — Is the out-of-scope list enforced as gates (no backend work,
  no SSR, no dismissible caching layer) rather than prose? [Spec §Out of
  Scope]
- [x] CHK017 — Is realtime-removal constrained to recorded-redundancy
  evidence (never guesswork), with behavior contracts untouched? [Spec §
  plan D8, Research R8]
- [x] CHK018 — Is the phase's success computable at convergence: SC-001..
  006 each mappable to an artifact or suite result, with zero unverifiable
  criteria? [Spec §SC]
