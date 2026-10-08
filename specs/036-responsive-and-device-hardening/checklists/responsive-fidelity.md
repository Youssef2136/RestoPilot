# Responsive & Device Fidelity Checklist (specs/036)

**Purpose**: Reviewer-facing verification that the phase's requirements hold as
stated — with the Master Plan's named focus: device-contract honesty (unsupported
stated, not implied).
**Created**: 2026-10-07
**Feature**: [spec.md](../spec.md)
**Defaults used** (documented speckit-checklist defaults): Depth Standard ·
Audience Reviewer · Focus top-2 clusters (device-contract honesty; overflow +
fallback correctness).

## Device-contract honesty (FR-01, SC-001, Master Plan checklist focus)

- [x] CHK001 — Does every registered route (25 + catch-all) appear in
  device-contracts.md with primary, secondary, AND an explicit unsupported
  statement — and is any route whose correctness is NOT claimed on a class
  recorded as such rather than omitted? [Spec §FR-01, §Device classes]
- [x] CHK002 — Do the management routes each name their clarified mobile-editing
  boundary (view-first + safe quick actions; heavy configuration
  desktop/tablet-primary) with the specific safe actions enumerated? [Spec
  §Clarifications Q4, §FR-01]
- [x] CHK003 — Is the explicitly-unsupported list (below 320 px, watch, TV,
  foldables' inner displays) stated as a claim about correctness, not a promise
  of breakage — and consistent between spec, device-contracts.md, and the
  conventions rules? [Spec §Device classes, §Clarifications Q2]
- [x] CHK004 — Are error/empty/loading/long-content states covered by the
  device contract (or explicitly out of its claims) rather than only the
  default state? [Spec §State Matrix note, §Edge Cases]

## Breakpoint discipline (FR-02)

- [x] CHK005 — Does every media query added or touched by this phase use exactly
  the documented scale (640/1024/1440), with any pre-existing drift normalized
  or recorded with a reason? [Spec §FR-02, Research R2]
- [x] CHK006 — If a new breakpoint value was introduced, is it recorded as a
  design-system amendment with its reason (not a per-surface magic number)?
  [Spec §Out of scope, Research R2]

## Overflow + fallback correctness (FR-03, FR-06, SC-002, SC-004)

- [x] CHK007 — Does the overflow sweep cover ALL routes × 320/390/430 in
  authorized states, including the catch-all 404 and long-content variants on
  content routes? [Spec §FR-03, Research R3]
- [x] CHK008 — Is the overflow assertion the honest measure (scrollWidth ≤
  clientWidth + clipped-element sweep), not a screenshot heuristic? [Research R3]
- [x] CHK009 — Does each of the six production tables have a DEFINED
  narrow-width behavior in device-contracts.md, and does the implemented
  behavior match the definition (card fallback vs documented scroll region)?
  [Spec §FR-06, Research R4]
- [x] CHK010 — Is the same-disclosure rule verified for at least one
  lower-privileged role (card shows exactly what the table showed for that
  role — no column lost, no field gained)? [Spec §Security, §FR-06]

## Sticky actions + orientation + keyboard (FR-05/07/08/09)

- [x] CHK011 — Are sticky/anchored actions applied only where the device
  contract demands them, and proven not to cover focusable content or clip the
  focus ring? [Spec §FR-07, §Accessibility, Research R5]
- [x] CHK012 — Does the orientation proof assert state preservation (scroll,
  open surfaces, in-flight input) AND the no-remount/no-duplicate-announcement
  property? [Spec §FR-08, Research R6]
- [x] CHK013 — Is the virtual-keyboard proof's technique (viewport-shrink
  emulation) documented with its limit, and does it cover the focused field AND
  the flow's primary action? [Spec §FR-09, Research R7]

## Carry-forward gates (FR-10, SC-005, SC-006)

- [x] CHK014 — Do the Phase 15 a11y suites run UNMODIFIED (or with only
  ledger-recorded Category-A migrations paired in the same commit) after all
  layout work? [Spec §Accessibility, §SC-005]
- [x] CHK015 — Is every presentation-contract move (order-sensitive locators,
  `data-*` hooks, accessible names) recorded in the ledger with its paired test
  change — zero silent weakenings? [Spec §SC-006, §Existing Contracts]
- [x] CHK016 — Are the responsive rules landed in `docs/conventions.md` and the
  device contracts referenced from the tasks/report (docs follow the code,
  FA-14)? [Spec §SC-005, Research R8]
