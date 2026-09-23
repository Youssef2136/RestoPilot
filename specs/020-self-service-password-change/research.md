# Research: Self-Service Password Change (020)

**Feature**: [spec.md](spec.md) · [plan.md](plan.md) · Created 2026-09-23

## R1 — Platform credential-update semantics (the ground truth)

- **Decision**: adopt the platform's observed semantics verbatim; the feature layers
  UX, never overrides them.
- **Verified live** (two-probe session against the linked dev project):
  - `updateUser({ password })` with the session alone **succeeds** — the platform
    requires no current-password proof of its own.
  - The initiating session **stays valid unchanged** — no token rotation observed
    (tokens identical before/after), no forced re-authentication.
  - **Every independently established session** of the account is invalidated (its
    refresh token is revoked; the next authenticated action is denied: "Auth session
    missing!").
  - **Same-profile tabs are NOT independent sessions**: a tab sharing the device's
    stored session survives (even a stale in-memory token copy keeps working; its
    refresh token is NOT revoked). Invalidation is per platform session record, not
    per tab.
  - Old password: dead immediately for fresh sign-ins; new password accepted.
- **Rationale**: the spec (FR-007, clarify session) encodes exactly this; the client
  must perform no token surgery and claim no rotation.
- **Alternatives**: client-side "sign out other devices" emulation (rejected —
  invents parallel behavior, contradicts FR-009's spirit); post-change forced
  sign-out of the initiating device (rejected — contradicts verified semantics and
  would surprise users mid-work).

## R2 — Current-password verification without a parallel mechanism

- **Decision**: `changePassword` verifies the current password by performing a
  **sign-in attempt** with it (the platform's own verifier) before calling
  `updateUser` on the page's session.
- **Rationale**: spec Assumptions require reusing the platform's sign-in operation as
  the verifier — no new verification mechanism; the platform natively enforces
  sign-in rate limiting, which the flow inherits (recorded in the spec). The sign-in
  attempt is made on a **throwaway client instance** so it never disturbs the page's
  live session or the app's single `AuthProvider` subscription (a sign-in on the
  shared client would fire SIGNED_IN and churn the whole app's session state).
- **Alternatives**: `reauthenticate()`-style challenge (not offered by the platform's
  API here — would be an invented parallel mechanism); accepting the risk with no
  verification (rejected — violates FR-004); server RPC verifying via service role
  (rejected — new trusted-layer surface for what the platform already does; violates
  VIII).

## R3 — Wrong-current-password message precision (user decision)

- **Decision**: one **distinct** message for an incorrect current password; **one
  generic** message for every other failure (policy rejection, expired session,
  network).
- **Rationale**: user's clarify answer ("A"); FR-006 rewritten accordingly. The
  sign-in attempt (R2) is the discriminator: its failure yields the distinct message;
  the update step's failures yield the generic one. The generic message reuses the
  existing `PASSWORD_RESET_FAILURE_MESSAGE` discipline ("Password update failed.
  Please try again.") — consistent with the module's house style; the distinct
  message is a new constant.
- **Alternatives**: fully generic (rejected in clarify — worse UX for the legitimate
  account holder, no security loss since the actor is session-proven).

## R4 — Route and guard posture

- **Decision**: new route `/account/password`, rendered **without** `RequireStaff` /
  `RequireProfile` — a session-bearing auth page exactly like `/reset-password`. The
  page itself requires a signed-in session to show the form (signed-out visitors get
  sign-in guidance), but no staff/membership gate exists.
- **Rationale**: FR-002 requires reachability for every signed-in identity. The
  existing `/dashboard/profile` is `RequireStaff`-gated and by definition excludes
  Fiona (membership-free owner bootstrap), the membership-free super admin, and
  unlinked identities — mounting the flow there would violate FR-002 and conflate
  credential management with staff-area authorization. The `/reset-password`
  precedent (deliberately unguarded, documented in router comments) is the house
  pattern for credential surfaces.
- **Alternatives**: `/dashboard/profile` section (rejected — wrong audience, wrong
  guard); `/admin`-only (rejected — self-service is universal per FR-014).

## R5 — Navigation entry point

- **Decision**: a **signed-in-only** link in the AppShell actions area — rendered
  when `status === 'signed-in'`, adjacent to the existing sign-out button (same
  conditional discipline).
- **Rationale**: the shell already renders role-neutral, session-conditional controls
  (sign-out, FR-017). The link appears for every signed-in identity regardless of
  profile/membership (FR-002) and never for anonymous visitors. No new conditional
  logic is invented.
- **Alternatives**: always-visible link (rejected — dead link for anonymous users on
  public pages); embedding inside `/dashboard/profile` (rejected — gated, R4).

## R6 — Supabase email invite-link nuance (the unlinked-identity trap, verified)

- **Decision**: handle the platform's `email_not_confirmed` failure via the generic
  message; no special-casing.
- **Verified live**: the platform's **admin invite link** (used by the onboarding
  flow) marks the invited email confirmed, so onboarded first owners can sign in and
  change passwords normally. A **manual admin user creation without email_confirm**
  would produce an unconfirmed identity whose sign-in — and therefore the
  current-password verification — fails; the flow reports the generic message and
  the recovery path remains the honest remedy.
- **Rationale**: consistency (FR-006 — generic for everything but wrong current
  password); no invented "confirm your email" surface (VIII).
- **Alternatives**: distinct unconfirmed-email message (rejected in clarify — would
  distinguish causes beyond the approved policy).

## R7 — Test strategy against the existing auth suites

- **Decision**: extend the three existing layers without disturbing standing
  semantics:
  1. **Unit** (`tests/unit/auth.change-password.test.ts`, new): mock `authClient`'s
     underlying calls (the unit suites mock the wrapper's internals — same style as
     `auth.guards.test.tsx`); prove the distinct-vs-generic message mapping, the
     verify-before-update ordering, the self-targeted shape (no user-id parameter
     exists in the API), and confirmation-mismatch refusal before any call.
  2. **Integration** (`tests/integration/auth.password-change.test.ts`, new, live
     DB): the session matrix — old password dead, new works, initiating session
     alive, an independently signed-in second client denied, memberships/roles
     byte-identical around the change (SC-003), and the wrong-current-password
     refusal; alice's password restored in `finally` (house discipline, matches the
     fixtures' documented `purge-auth` reset).
  3. **E2E** (`e2e/auth.routes.test.ts` extension): signed-in navigation → account
     password page → successful change → confirmation text states both session
     facts → old password rejected at fresh sign-in (single-worker ordering).
- **Rationale**: SC-005 (every edge case proven), SC-004 (standing suites must pass
  unchanged — the recovery flow's tests are untouched), and the fixtures' password
  discipline.
- **Alternatives**: database-suite tests (rejected — the change is a platform auth
  operation, not schema/RPC behavior; integration layer is the right altitude).

## R8 — Credential hygiene mechanics (FR-010)

- **Decision**: the page keeps all three inputs uncontrolled-ish (controlled, but
  never rendered, never logged), uses `type="password"` with `autoComplete`
  attributes (`current-password` for the current field, `new-password` for both new
  fields — prevents the browser from offering the old password for the new one and
  suppresses the "save this password" prompt pointing at the wrong form), and no
  value ever reaches an error message, URL, or storage. The module contract (contract
  file) forbids logging password parameters — matching the existing rule that
  `authClient` never inspects or forwards error bodies.
- **Rationale**: house style already matches (SignInPage/ResetPasswordPage use the
  same attributes); FR-010/SC-003a are provable by code inspection + the e2e
  storage/URL check.
- **Alternatives**: none worth recording.
