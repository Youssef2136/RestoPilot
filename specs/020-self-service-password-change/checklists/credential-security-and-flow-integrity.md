# Checklist: Credential-Security Semantics and Flow Integrity (020)

**Feature**: [spec.md](../spec.md) · **Plan**: [plan.md](../plan.md) · Created 2026-09-23

Reviewer-owned (house convention since 005): a human reviewer answers these
against the implementation. Defaults used: Depth Standard · Audience Reviewer ·
Focus: the two top relevance clusters — credential-security semantics (CHK001–008)
and flow integrity / non-happy paths (CHK009–014).

## Cluster 1 — credential-security semantics

- [ ] CHK001 — Is the separation between change-password and recovery absolute in the
      implementation: does `changePassword` share zero flow logic with
      `completePasswordReset`/`requestPasswordReset` (only platform primitives and
      constants), and are recovery entry points byte-untouched? [Spec §FR-009]
- [ ] CHK002 — Is the current-password verification performed via the platform's own
      sign-in operation on a throwaway client — never a parallel mechanism, never the
      shared app client? [Spec §FR-004, §Assumptions; Contract execution order]
- [ ] CHK003 — Does the operation carry no account-selector input of any kind (no
      user id, no email) — self-targeted by construction? [Spec §FR-003]
- [ ] CHK004 — Is the failure-message policy exactly as clarified: one distinct
      wrong-current-password message, one generic message for every other cause, and
      no message that echoes password material or dissects platform error bodies?
      [Spec §FR-006; Clarifications 2026-09-23]
- [ ] CHK005 — Does the flow perform no token operations and no client-side session
      state surgery (no setSession/refresh/storage writes), leaving the verified
      platform semantics intact? [Spec §FR-007; Contract session neutrality]
- [ ] CHK006 — Is zero password material observable in logs, console output, URLs,
      browser storage, or error messages across the whole flow? [Spec §FR-010,
      §SC-003a]
- [ ] CHK007 — Is the route reachable by every signed-in identity (unlinked, Fiona,
      membership-free super admin) — i.e. genuinely not staff-gated — while remaining
      unavailable to anonymous visitors? [Spec §FR-002, §FR-014]
- [ ] CHK008 — Is there no admin-driven password surface and no platform-specific
      path for the super admin's own change? [Spec §FR-014]

## Cluster 2 — flow integrity and non-happy paths

- [ ] CHK009 — Are all non-happy paths (wrong current, weak new, mismatch, duplicate
      submit, session expiry, network failure, refresh mid-operation, old-password
      reuse) covered by at least one automated proof each? [Spec §SC-005,
      §Edge Cases]
- [ ] CHK010 — Does the session matrix proof cover: initiating session survives,
      independently established session denied, same-profile tab survives (the
      clarify-corrected semantics), old password dead / new accepted? [Spec §SC-002,
      §FR-013; Clarifications]
- [ ] CHK011 — Is zero authorization drift proven by direct before/after comparison
      of profile + memberships in the live-DB suite? [Spec §FR-008, §SC-003]
- [ ] CHK012 — Is the form's in-flight discipline enforced (disabled during
      submission, immediate re-usability after any outcome)? [Spec §FR-011]
- [ ] CHK013 — Does the success confirmation state both session facts (this device
      stays signed in; other signed-in devices were signed out)? [Spec §FR-007,
      §US3 scenario 2]
- [ ] CHK014 — Do the standing recovery/sign-in/session suites pass unchanged, and is
      the fixture-password restore discipline honored by the new live-DB tests?
      [Spec §SC-004; §Assumptions]

## Notes

- Items are reviewer-owned; autopilot never checks them. Unchecked items are
  surfaced at the implement gate as a user decision.
