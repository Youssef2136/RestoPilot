# Checklist: State Fidelity (specs/037)

**Intent defaults used**: Depth Standard · Audience Reviewer · Focus: honesty
(never stale-as-fresh, never fake success) + refusal/in-flight discipline.

## Honesty of states
- [x] CHK001 — Does the spec define how "nothing yet" is distinguished from
  "couldn't load" and "you can't access this" everywhere the three can appear?
  [Spec §FR-03, §UX]
- [x] CHK002 — Is "never a phantom success" testable — i.e. is the observable
  behavior of a timed-out mutation defined (unknown-result honesty), not just
  "handle timeout"? [Spec §US3, Edge Cases]
- [x] CHK003 — Are stale-while-realtime and reconnected states defined well
  enough to prove staleness clears only when data is actually fresh? [Spec
  §Edge Cases, FR-07]
- [x] CHK004 — Is the zero-vs-empty distinction (round closed with zero total
  vs no rounds yet vs access denied) pinned as three renderings? [Spec §Edge
  Cases]

## Refusal & in-flight discipline
- [x] CHK005 — Is the refusal split (inline for mutations, page-level for
  reads) quantified per surface class, with "toast never sole carrier" stated?
  [Spec §FR-05, Clarifications]
- [x] CHK006 — Is the duplicate-submit protection scoped to the named
  high-risk actions AND audited across every other action? [Spec §FR-06,
  §Testing]
- [x] CHK007 — Is the burst edge case (rapid clicks before disable lands)
  covered with an observable single-refusal/single-write outcome? [Spec §Edge
  Cases]
- [x] CHK008 — Is mutation retry manual-only stated so no retry policy can
  duplicate a write? [Spec §Out of scope, Security, Clarifications]

## Offline & partial
- [x] CHK009 — Is the offline behavior (last-known readable, staleness obvious,
  actions disabled-with-reason) specified for all three named operational
  surfaces, not just cashier? [Spec §FR-07, Clarifications]
- [x] CHK010 — Is partial failure defined per-part (named branch, per-part
  retry, never-zero) rather than as one generic "handle errors"? [Spec §FR-09,
  §US5]
- [x] CHK011 — Is the read-error-on-live-surface case (board never blanks on a
  failed poll) explicitly required? [Spec §Edge Cases]
- [x] CHK012 — Is the offline banner placement constrained against covering
  primary actions and the kitchen board? [Spec §Responsive]

## Expiry, boundaries & carry-forward
- [x] CHK013 — Is session-expiry composition with in-flight mutations defined
  (no double-handling, no orphaned spinner)? [Spec §Edge Cases, D8]
- [x] CHK014 — Is "no white screen" proven by two classes (thrown error +
  expiry), each with a recovery path? [Spec §FR-08, §US4]
- [x] CHK015 — Are the Phase 15/16 suites unchanged and the security
  no-leak rules (no internals, no cross-tenant disclosure) carried as gates?
  [Spec §Security, §Accessibility]
- [x] CHK016 — Is the state matrix (twelve rows × every route) the phase's
  measurable deliverable with component+test per row? [Spec §SC-001, FR-01]
