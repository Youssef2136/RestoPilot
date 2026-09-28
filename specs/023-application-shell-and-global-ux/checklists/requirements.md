# Specification Quality Checklist: Application Shell & Global UX (Phase 03)

**Feature:** `specs/023-application-shell-and-global-ux` · **Reviewed:** 2026-09-27 (CHECKLIST,
pre-TASKS) · **Reviewer:** Buffy (frontend-autopilot)

## Content Quality

- [x] Check 1: Purpose concrete — two shells + nav model + context switcher + global UX
  infrastructure, per Master Plan §8 Phase 03 scope.
- [x] Check 2: Four user stories address distinct concerns (right chrome; context switching;
  dashboard home; global infrastructure) with independent tests.
- [x] Check 3: Measurable success (persona nav matrix exhaustive; one main landmark;
  persisted context; banner states; confirm names preserved).
- [x] Check 4: No implementation design in the spec (files/APIs live in plan/research).

## Ambiguities

- [x] Check 5: Q1 nav order fixed (canonical order, visibility-filtered).
- [x] Check 6: Q2 page selects vs shell switcher (distinct labels; page contracts preserved).
- [x] Check 7: Q3 toasts accompany, never replace inline text.
- [x] Check 8: Q4 confirm dialog adoption with verbatim button names (migration list required).
- [x] Check 9: Q5 offline banner source (channel status + navigator.onLine).
- [x] Check 10: Q6 membership-less bootstrap stays on /dashboard.

## Dependencies & Assumptions

- [x] Check 11: Phase 02 primitives named; no new primitives needed for the shell itself.
- [x] Check 12: FA-15 shell bounds quoted and enforced in plan (no business logic in shells).
- [x] Check 13: E2E contract inventory done (R2/R4/R7) before design; migration list required
  by the gate.

## Traceability

- [x] Check 14: FR-01…FR-12 map 1:1 to the Master Plan phase FRs.
- [x] Check 15: Edge cases cover mid-session membership removal, stale persisted context,
  offline switch, deep-link denials, toast/dialog interplay.

## Unresolved Issues

None. Q1–Q6 resolved from repository contracts (E2E assertions are the authority) and recorded
in the spec.

**Verdict:** READY — proceed to TASKS.
