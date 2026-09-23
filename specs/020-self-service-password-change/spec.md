# Feature Specification: Self-Service Password Change

**Feature Branch**: `020-self-service-password-change`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "An authenticated user should be able to change their own account password from inside the application. Treated as a change to authentication credentials, not a settings-form feature: strict separation from recovery, self-only targeting, deliberate re-authentication policy, verified session semantics, credential hygiene, and no authorization drift."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Change my own password while signed in (Priority: P1)

An authenticated user — owner, staff member, or platform super admin, any signed-in
identity — opens the in-app account surface, provides their current password and a new
password (entered twice), and their sign-in credential changes. The change takes effect
immediately: their current session stays alive, and the old password stops working for
future sign-ins.

**Why this priority**: The core user value and the entire reason the feature exists. It
must be a distinct, authenticated credential flow — not a reuse of the recovery flow
(the recovery flow keeps its own semantics and entry points).

**Independent Test**: Sign in, change the password through the in-app form, verify the
change took effect, restore the password. Delivers standalone value: users can rotate
their own credential without an email round-trip.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the account page, **When** they enter their current
   password and a matching new-password pair and submit, **Then** the change succeeds,
   the user sees a clear success confirmation, and the account's sign-in password is the
   new password (the old one no longer authenticates).
2. **Given** a signed-in user, **When** they submit with a current password that does
   not match, **Then** the change is refused with the flow's distinct
   current-password message (clarity for the legitimate user — the session already
   proves the actor), and the password is unchanged.
3. **Given** a signed-in user, **When** they submit a new-password pair that does not
   match its confirmation, **Then** the submission is refused before any credential
   operation with a local "the two passwords do not match" message (confirmation is
   presentational validation, not a security control).
4. **Given** a signed-in user, **When** they submit a new password that the platform's
   password rules reject, **Then** the change is refused with one generic failure
   message and the current password remains active.
5. **Given** a signed-in user who submits the form twice (double-click or impatient
   second submit), **When** the first submission is in flight, **Then** the second
   submission is prevented (the form is disabled while submitting) and the password
   changes exactly once.
6. **Given** a signed-in user, **When** the change request reaches the platform but the
   response never arrives (network failure after send), **Then** the user sees the one
   generic failure message; the actual credential state is whatever the platform
   recorded, and the UI does not claim success it cannot verify.

### User Story 2 — Verified session semantics after the change (Priority: P1)

The session behavior after a password change is the platform's documented and observed
behavior, made explicit to the user — not an assumed behavior invented by this feature:

- **The initiating session survives**: the user stays signed in on the device where they
  made the change (the session remains valid unchanged — no token rotation observed,
  no re-authentication forced).
- **Every other independently established session of the same account is
  invalidated**: a session signed in separately (another device, another browser
  profile) that existed before the change loses its access and is treated as signed
  out. Tabs sharing the same device session are that one session — they survive with
  it (verified during specification: invalidation is per platform session record,
  not per tab; a same-profile tab even keeps its pre-change token copy working).
- **Recovery keeps its own semantics**: the recovery flow (email link → set new
  password) is unchanged by this feature and is not reused as the in-app change path.

**Why this priority**: These are the security properties of the feature. Getting them
wrong silently breaks multi-device users or falsely logs people out. Because the
platform's own semantics are adopted (verified during specification), the feature stays
consistent with the existing auth model instead of introducing parallel behavior.

**Independent Test**: With two live sessions of one account, change the password from
one; verify the initiating session remains authenticated and the other session is
subsequently denied. Then verify the recovery flow still behaves as before.

**Acceptance Scenarios**:

1. **Given** one account signed in independently on two devices, **When** the password
   is changed from device A, **Then** device A remains signed in (the user continues
   working without re-authenticating) and device B, on its next authenticated action
   or session check, is treated as signed out.
2. **Given** a user who just changed their password in-app, **When** they open a fresh
   sign-in, **Then** the old password is rejected and the new password is accepted.
3. **Given** the in-app change succeeded, **When** the account's profile, roles,
   memberships, and permissions are inspected, **Then** they are byte-identical to
   before the change (authentication credentials and application authorization are
   separate concerns; a credential change must not touch authorization).
4. **Given** a user with a recovery session, **When** they use the recovery page,
   **Then** its behavior is exactly as documented before this feature.

### User Story 3 — Safe placement and honest behavior of the account surface (Priority: P2)

The change-password surface is reachable from the app's persistent navigation for any
signed-in identity, is a session-bearing authentication page rather than a
staff-area-gated view, and communicates the session consequences honestly: after a
successful change, the user is told their current session continues and that other
signed-in devices have been signed out. Password material never appears in logs,
console output, URLs, browser storage beyond the platform's own session handling, or
error messages.

**Why this priority**: Placement and honesty determine whether the feature is
trustworthy and discoverable, but the flow is valuable through US1/US2 alone.

**Independent Test**: Sign in as any role, find the entry point in the navigation, use
it, and observe the messaging. Separately, inspect client persistence and telemetry for
absence of password material.

**Acceptance Scenarios**:

1. **Given** any signed-in identity (owner, staff, platform super admin, or an
   authenticated identity whose profile is not linked), **When** they look at the
   persistent navigation, **Then** they find the account/password affordance and can
   reach the change form without any role gate.
2. **Given** a successful in-app password change, **When** the confirmation is shown,
   **Then** it states that this device stays signed in and other devices were signed
   out.
3. **Given** any interaction with the change form, **When** network traffic, browser
   storage, logs, or error messages are inspected, **Then** no password value appears
   beyond the platform's own credential transport, and no client-provided value ever
   determines *whose* password changes (the operation always targets the session's own
   account).

### Edge Cases

- Current password left empty or wrong → refused with the distinct current-password
  message, no change.
- New password failing the platform's password policy (too short, etc.) → generic
  refusal, current password stays active.
- Confirmation mismatch → caught locally before any platform call.
- Duplicate/rapid submissions → form disabled while in flight; one change.
- Session expires while the form is open → submission fails with the generic message;
  the app's existing signed-out handling takes over; no partial state.
- Network failure after the request is sent → generic failure message; the user's next
  sign-in attempt with the intended new password is the source of truth for what
  actually happened.
- User refreshes the page mid-operation → no client-side persistence of the operation;
  the form returns to its neutral state; session state is restored by the existing
  provider.
- Multiple open tabs of the same account on one device: tabs share the device's
  single stored session, and that session is the one that performed (or shares
  identity with) the change — after the platform's cross-tab sync they all remain
  authenticated (verified: even a tab holding the pre-change token copy keeps working;
  the refresh token is not revoked for the surviving session). Only sessions
  established independently (other devices/profiles) are signed out.
- Old-password attempt after a successful change → rejected at sign-in; the temporary
  credential created by the onboarding invitation behaves the same way once replaced.
- An authenticated identity whose profile is not linked (no restaurant membership) can
  still change their own password — the flow is authentication-scoped, not
  membership-scoped.
- Re-authentication posture (deliberate, recorded): the platform's credential-update
  operation does not require re-entering recent proof of identity beyond the session
  itself; this feature adopts that platform semantic as-is and requires the current
  password as the identity proof at the form level. A future inactivity-based
  re-authentication gate is out of scope for this feature.
- The platform super admin changes their own password exactly like anyone else — no
  special path, and no elevation of the flow into anything admin-driven.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** — The system SHALL provide an in-application change-password flow for any
  authenticated identity, entered with the account's current password and a new
  password (entered twice for confirmation).
- **FR-002** — The flow SHALL be reachable from the application's persistent navigation
  for every signed-in identity, without role or membership gating.
- **FR-003** — The operation SHALL change only the signing-in account's own password.
  No client-supplied value may ever select a different target account; there is no
  user-id parameter in the flow.
- **FR-004** — The flow SHALL require the current password as submitted proof of
  control over the account, verified against the platform before the change is applied.
- **FR-005** — A mismatched new-password/confirmation pair SHALL be refused locally
  (presentational validation) before any credential operation; the platform-side
  password policy remains the security boundary for password strength.
- **FR-006** — Failure messages SHALL be: one distinct, user-presentable message for
  an incorrect current password (the only cause the flow distinguishes — the actor is
  the authenticated account holder verifying their own credential), and one generic,
  user-presentable failure message for every other cause (policy-violating new
  password, expired session, network failure), consistent with the auth module's
  single-message discipline; no message may distinguish those other causes or echo
  any password material.
- **FR-007** — After a successful change, the initiating session SHALL remain valid
  exactly as it was (no forced re-authentication, no client-side token surgery), and
  every other independently established session of the account SHALL be invalidated,
  per the platform's verified semantics; the success confirmation SHALL state that
  this device stays signed in and other signed-in devices were signed out.
- **FR-008** — The change SHALL leave all authorization state untouched: profile,
  roles, restaurant membership, branch membership, permissions, and tenant access.
- **FR-009** — The in-app change flow SHALL be a distinct code path from the recovery
  flow; the recovery flow's entry points, page, and semantics remain unchanged. Reuse
  is permitted only at the level of shared, already-generic primitives (the
  credential-update platform operation and shared constants), never at the level of
  flow semantics.
- **FR-010** — No password value SHALL be written to console output, application logs,
  URLs or query parameters, browser local/session storage, analytics, error telemetry,
  or user-facing error messages. Password inputs use the password input discipline
  (autocomplete attributes preventing inappropriate autofill of the new credential).
- **FR-011** — While a change submission is in flight, further submissions SHALL be
  prevented (the form is disabled), and the flow SHALL be re-usable immediately after
  any outcome (success, or failure with retry).
- **FR-012** — The flow SHALL be exhaustible by session loss exactly like other
  authenticated actions: if the session expires during the operation, the attempt
  fails with the generic message and the application's existing signed-out handling
  proceeds.
- **FR-013** — After a successful change, subsequent authentication attempts with the
  old password SHALL be rejected and attempts with the new password SHALL succeed.
- **FR-014** — The flow SHALL be available to the platform super admin for their own
  account under exactly the same rules as every other identity (self-service only;
  no administrator-driven password management is introduced by this feature).

### Assumptions

- The platform's credential-update operation (verified during specification against the
  linked development project): succeeds with the session alone, requires no separate
  current-password proof at the platform level, refreshes the initiating session's
  tokens in place, invalidates every other existing session of the account, and makes
  the old password unusable for future sign-ins immediately. This feature adopts those
  semantics verbatim and layers the current-password requirement at the application
  level (FR-004) as the identity proof for the in-app flow.
- Because the platform does not verify the current password itself, the
  current-password check is performed by an authentication attempt against the platform
  before applying the change (the platform's own sign-in operation is the verifier —
  no parallel verification mechanism is created).
- The current-password verification reuses the platform's sign-in operation, so
  repeated wrong-current-password attempts inherit the platform's sign-in rate
  limiting — the feature adds no separate throttle and no separate limit of its own.
- Session identity is the platform's session record, not a browser tab: one device
  profile holds one stored session shared by its tabs; sessions created by separate
  sign-ins (other devices, other browser profiles) are distinct records. The change
  invalidates every distinct record except the one that performed the change
  (verified during specification).
- The application previously had no in-app self-service password change; users rotated
  credentials through recovery only. That recovery flow remains the recovery path and
  is untouched.
- Test-environment discipline (as documented for the existing fixtures): development
  fixture passwords are restored by the standard database reset with auth purge;
  tests that change a fixture's password restore it (or rely on that documented
  reset).

### Success Criteria *(mandatory)*

- **SC-001** — A signed-in user can complete a self-service password change in under
  30 seconds, and the change is effective immediately (old password dead, new password
  works on the next fresh sign-in).
- **SC-002** — In a two-session verification, the initiating session remains
  authenticated after the change and every pre-existing independently established
  session is denied on its next authenticated action — 100% of probed independent
  sessions (same-profile tab sharing is not an independent session and is excluded).
- **SC-003** — Zero authorization drift: for every account that changes its password,
  the profile, role(s), memberships, and permissions are identical before and after
  (asserted by direct comparison in the verification suite).
- **SC-003a** — Zero credential leakage: no password value is observable in any
  client-side persistence layer, URL, log sink, or error message touched by the flow.
- **SC-004** — The recovery flow's existing automated coverage passes unchanged after
  this feature ships (no regression in recovery, sign-in, or session-restoration
  behavior).
- **SC-005** — Every non-happy-path in the Edge Cases section has at least one
  automated proof (unit, database, or end-to-end), so refusal behavior is pinned, not
  incidental.

## Key Entities

- **Account (authentication identity)** — the sign-in subject; owns exactly one
  current password. Attribute relevant here: current password (never exposed, only
  verified/replaced).
- **Session** — a sign-in-scoped grant of authentication (one record per independent
  sign-in; a device profile's tabs share its stored record). After a self-service
  change: the initiating session persists unchanged; all other records are
  invalidated. Unchanged: session persistence discipline, restore-on-mount behavior.
- **Password change (operation)** — a self-service, self-targeted credential
  replacement: {current password proof, new password}. Produces: new active password,
  surviving initiating session, invalidated other sessions, untouched authorization
  state.
- **Recovery flow** — the pre-existing email-link recovery path. Untouched by this
  feature; not a dependency of the in-app change flow beyond shared platform
  primitives.

## Clarifications

### Session 2026-09-23

- Q: Which accounts can use the in-app change flow? → A: Every authenticated identity
  (staff-linked or not, including the platform super admin), from the persistent
  navigation; the operation always targets the session's own account (FR-002, FR-003,
  FR-014).
- Q: Does changing the password require re-authentication beyond the session? → A: The
  platform's credential-update operation requires only the session; the in-app flow
  adds the current-password proof (FR-004) verified via the platform's own sign-in
  operation — no parallel re-authentication mechanism is created.
- Q: What happens to other sessions and refresh tokens after the change? → A: The
  platform invalidates every other independently established session (their refresh
  tokens stop working; the next authenticated action from those sessions is denied)
  while the initiating session remains valid as-is — verified live during
  specification and adopted verbatim (FR-007).
- Q: Do other tabs on the same device survive the change? → A: Yes — tabs share the
  device's one stored session, which is the surviving session; even a tab holding the
  pre-change token copy keeps working (access token accepted, refresh token not
  revoked). Invalidation is per platform session record, not per tab — the spec's
  earlier per-tab claim was corrected against this verified behavior.
- Q: Does the platform rotate the initiating session's tokens on password change? → A:
  No rotation was observed — the session stays valid unchanged; the feature makes no
  token-rotation claim and performs no client-side token handling.
- Q: How precise should the failure message be when the change fails? → A: A distinct
  message only for an incorrect current password; every other failure (policy,
  session, network) shares the one generic message (FR-006) — user decision, recorded.
