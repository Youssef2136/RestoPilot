# Contract: Change-Password Flow (auth-client extension, feature 020)

**Feature**: 020-self-service-password-change | **Date**: 2026-09-23
**Extends**: [003 contracts/auth-client.md](../../../specs/003-auth-and-rbac/contracts/auth-client.md) — all its stability commitments remain in force (notably #1: `authClient` is the only `supabase.auth.*` import path; this contract adds one method, it does not fork the module).

## `authClient.changePassword(input): Promise<ChangePasswordResult>`

```ts
export type ChangePasswordResult = { ok: true } | { ok: false; message: string }

export const CURRENT_PASSWORD_FAILURE_MESSAGE =
  'The current password is incorrect. Check it and try again.'

type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}
```

**Execution order (normative — the unit suite pins it)**:

1. **Verify** — perform a sign-in attempt with `currentPassword` on a **throwaway
   client instance** (`createClient(url, key)` — never the app's shared client, so
   the attempt cannot disturb the page's live session or fire app-visible auth
   events). Failure ⇒ `{ ok: false, message: CURRENT_PASSWORD_FAILURE_MESSAGE }`
   and **stop** — the update step must not run.
2. **Apply** — on the **page's own session** (the shared client),
   `updateUser({ password: newPassword })`. Failure ⇒
   `{ ok: false, message: PASSWORD_RESET_FAILURE_MESSAGE }` (existing constant).
   Success ⇒ `{ ok: true }`.

**Properties (normative)**:

- **Self-targeted by construction**: the input carries exactly two fields — there is
  no user id, email, or any other account selector anywhere in the flow (FR-003).
- **Message policy** (FR-006, clarify "A"): exactly one distinct cause (incorrect
  current password); every other failure shares the existing generic constant. No
  message ever echoes password material or dissects platform error bodies (the
  wrapper never inspects `error.message` — the 003 discipline continues).
- **Session neutrality**: the method performs no token operations and no storage
  writes; the initiating session survives untouched (verified platform semantics —
  research R1) and all other independently established sessions are invalidated by
  the platform, which the UI reports but does not emulate.
- **Rate limiting**: verification reuses the platform's sign-in operation and
  inherits its rate limits; the flow adds no throttle.
- **No logging**: implementations and callers MUST NOT log `input` or any password
  value (FR-010; review checklist item).

## `ChangePasswordPage` (`/account/password`)

- **Route posture**: rendered inside `AppShell` **without** `RequireStaff` /
  `RequireProfile` — the `/reset-password` precedent: a session-bearing auth page.
  The router comment records the rationale (FR-002: unlinked identities, Fiona, and
  the membership-free super admin must reach it).
- **Entry**: `AppShell` renders an "Account password" link in the actions area
  **only when `status === 'signed-in'`** — same conditional discipline as the
  sign-out button; never visible to anonymous visitors.
- **Form**: three password inputs — current (`autoComplete="current-password"`), new
  and confirmation (`autoComplete="new-password"` on both). Confirmation mismatch ⇒
  local refusal, no platform call (FR-005). Submit disabled while in flight
  (FR-011); failure renders the result's message in the existing `role="alert"`
  pattern; success renders `role="status"`:
  > "Your password has been changed. This device stays signed in; other signed-in
  > devices have been signed out."
- **Session expiry during flight** surfaces through the existing provider state
  change (SIGNED_OUT) plus the generic failure message; the page's signed-out
  presentation matches the recovery page's no-session guidance pattern (FR-012).
- **Succeeded state**: no automatic navigation; a "Back to dashboard"-style link is
  acceptable; the confirmation must remain readable until the user leaves (the
  message is the only place the session facts are stated).

## What this contract deliberately does NOT do

- Does not touch `completePasswordReset`, `requestPasswordReset`, or any recovery
  entry point (FR-009) — the recovery flow's code, tests, and semantics are
  byte-unchanged.
- Does not add an admin-driven password surface (FR-014) — a future such flow would
  be its own spec with its own security analysis.
- Does not add audit rows, database objects, or client-side credential storage.
