# Tasks: Self-Service Password Change (020)

**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Contract**:
[contracts/auth-client.md](contracts/auth-client.md) · **Quickstart**:
[quickstart.md](quickstart.md)

Every task line follows the strict house format
`- [ ] T### [P?] [US?] <description with file path>`. Phases: Setup,
Foundational (client module), US1 (the flow surface), US2 (session-matrix
proofs), US3 (placement + hygiene), Polish. No [P] markers — every task
touches shared files in sequence.

## Dependencies

- T002–T004 (module) precede T005+ (page, tests) — everything imports
  `changePassword`.
- T005 (page) precedes T006 (nav) and T007 (route); T008–T011 (tests) come
  last but T009/T010 may proceed in parallel with T011 once T005 lands.
- T012 (gates) runs after all code; T013 (record) closes the phase.

## Setup

- [x] T001 Verify the auth-module test landscape is understood before writing
      code: read `tests/unit/auth.guards.test.tsx` (mock discipline),
      `tests/integration/auth.signin.test.ts` (live-DB discipline), and
      `e2e/auth.routes.test.ts` (navigation conventions); record in the task
      notes which mocking/restoration pattern each new test file will follow.
      [Spec §Assumptions]

## Foundational — the client module (US1/US2 shared)

- [x] T002 Add `changePassword` to `src/features/auth/authClient.ts` with
      result type `ChangePasswordResult`, the new
      `CURRENT_PASSWORD_FAILURE_MESSAGE` constant, the throwaway-client
      verify step (sign-in attempt), the shared-client update step, and the
      contract's normative properties (no account selector, no token
      operations, no logging of inputs). [US1] [Spec §FR-001, §FR-003, §FR-004, §FR-006, §FR-009]
- [x] T003 Prove the client contract in `tests/unit/auth.change-password.test.ts`:
      verify-before-update ordering (update never called when verification
      fails), distinct-vs-generic message mapping, mismatch handling lives in
      the page not the client, call shape carries exactly
      {currentPassword, newPassword}, and no input value reaches any
      logger/console sink. [US1] [Spec §FR-003, §FR-004, §FR-006, §FR-010]

## User Story 1 — the flow surface

- [x] T004 Create `src/routes/ChangePasswordPage.tsx` per the contract:
      three password inputs with correct autocomplete attributes, local
      confirmation-mismatch refusal (no platform call), in-flight disabled
      state with immediate re-usability, `role="alert"` failure rendering,
      `role="status"` success confirmation stating both session facts,
      signed-out presentation matching the recovery page's guidance pattern.
      [US1] [Spec §FR-001, §FR-005, §FR-006, §FR-007, §FR-011, §FR-012]
- [x] T005 Mount the route `/account/password` in `src/app/router.tsx`
      inside `AppShell` WITHOUT staff guards, with the router comment
      recording the `/reset-password` precedent rationale (unlinked
      identities, Fiona, membership-free super admin). [US1] [Spec §FR-002]
- [x] T006 Add the signed-in-only "Account password" link to
      `src/components/AppShell.tsx`'s actions area (same conditional
      discipline as the sign-out button). [US3] [Spec §FR-002, §US3 scenario 1]

## User Story 2 — session-matrix proofs (live DB)

- [x] T007 Write `tests/integration/auth.password-change.test.ts`:
      (a) old password rejected / new accepted on fresh sign-ins; (b)
      initiating session remains valid after the change; (c) an
      independently signed-in second client is denied on its next
      authenticated action; (d) profile + full membership set byte-identical
      around the change (SC-003); (e) wrong current password refused with
      the distinct message and no change; fixture password restored in
      `finally`. [US2] [Spec §FR-007, §FR-013, §SC-002, §SC-003]

## User Story 3 — placement, hygiene, walkthrough

- [x] T008 Extend `e2e/auth.routes.test.ts` with the walkthrough: signed-in
      nav link visible (and absent signed-out) → page opens → wrong-current
      refusal shows the distinct message → mismatch refusal shows the local
      message → successful change shows the both-facts confirmation → fresh
      sign-in with the old password rejected and the new accepted; restore
      the used account's password via the same flow at the end; assert
      hygiene at the browser level — the page URL carries no query params and
      localStorage/sessionStorage contain no password substring after the
      flow (SC-003a); separately prove FR-014's availability: the platform
      super admin sees the same nav link, reaches the same page, and gets the
      same distinct wrong-current refusal (no password change performed). [US3] [Spec §FR-002, §FR-010, §FR-013, §FR-014, §SC-003a, §US3 scenario 2]
- [x] T009 Prove the hygiene edge cases in the unit file (extend T003's):
      duplicate submit prevented (in-flight disabled), refresh returns the
      form to neutral (no persisted operation state), session-expiry surfaces
      the generic message. [US1] [Spec §FR-011, §FR-012, §Edge Cases]

## Polish

- [x] T010 Update `docs/development.md` (or the auth section of the docs the
      repo maintains) with the flow's contract summary: verify-then-update,
      message policy, session semantics, and the recovery-flow separation.
      [Spec §FR-006, §FR-007, §FR-009]
- [x] T011 Run the full gates in order and record results:
      `npm run verify` (unit + database + integration + build), the full e2e
      single-worker run, and `npx tsc -b`; standing suites must be unchanged
      and green. [Spec §SC-004, §SC-005]
- [x] T012 Mark every task [x], append the post-implement verification record
      to this file (FR/SC → evidence), and commit the phase. [Spec §Done When]

## Independent test criteria per story

- US1 alone: change a password in-app; old dead, new works, messages correct.
- US2 alone: two live sessions; the matrix (T007) proves the semantics.
- US3 alone: navigation reachability per identity + hygiene proofs + the e2e
  walkthrough.

## Post-implement verification record (2026-09-23)

All 12 tasks complete. Evidence per requirement (verified on disk and by the
gates below — `npm run verify` exit 0: unit **276**, database **516**,
integration **38**, production build; full e2e single-worker **100/100**;
`npx tsc -b` clean):

- **FR-001/FR-002** — `src/routes/ChangePasswordPage.tsx` at `/account/password`
  (`src/app/router.tsx`, rendered without staff guards, rationale recorded);
  the signed-in-only header link (`src/components/AppShell.tsx`). Proven by
  e2e: link absent for anonymous visitors, present and navigable for fiona
  (membership-free) and the platform super admin.
- **FR-003** — `authClient.changePassword` carries exactly
  `{currentPassword, newPassword}`; the verify step's email is derived from
  the live session's subject. Unit-pinned (call-shape assertions).
- **FR-004** — verify-then-update with the platform's own sign-in operation
  on an ephemeral in-memory client (`createEphemeralSupabaseClient`,
  `src/lib/supabase.ts`). Unit: ordering + refusal stops the update;
  integration: wrong-current refusal leaves the credential intact.
- **FR-005** — local mismatch refusal before any platform call (page +
  e2e: "The two passwords do not match.").
- **FR-006** — distinct `CURRENT_PASSWORD_FAILURE_MESSAGE` for the wrong
  current password; existing generic message for policy/session/network.
  Unit: message mapping + no platform-error echo; e2e: both messages
  rendered exactly.
- **FR-007/FR-013** — integration suite
  (`tests/integration/auth.password-change.test.ts`): initiating session
  valid after the change; independently established session denied; old
  password `invalid_credentials`; new password signs in. E2e confirmation
  states both session facts.
- **FR-008/SC-003** — zero authorization drift: `current_auth_context` +
  full readable-scope snapshots identical around the change (integration).
- **FR-009/SC-004** — recovery flow byte-untouched (no edits to
  `requestPasswordReset`/`completePasswordReset`/`ResetPasswordPage`);
  all standing auth suites green unchanged.
- **FR-010/SC-003a** — unit console-sink assertions; e2e: no query params on
  the flow page, no password substring in localStorage/sessionStorage after
  the flow; password-typed inputs with correct autocomplete attributes.
- **FR-011/FR-012** — in-flight disabled + second submit absorbed (e2e,
  held-response route probe); refresh returns the form neutral; signed-out
  presentation takes precedence over any stale success state (page fix
  caught by the e2e walkthrough).
- **FR-014** — the super admin gets the same link, page, and rules (e2e,
  refusal-only probe — no password changed).
- **SC-001** — the change completes in two platform round trips (verify +
  update), far under the 30-second bound; SC-002/SC-005 — every edge case in
  the spec has an automated proof (unit 8, integration 2, e2e 4 new tests).

**Convergence check**: 12/12 tasks `[x]`, every FR/SC mapped to evidence, no
gaps found on post-implement review — no convergence round required.

**Reviewer note**: the 14 reviewer-owned items in
`checklists/credential-security-and-flow-integrity.md` await human review
(house convention — the implementing agent never checks them).
