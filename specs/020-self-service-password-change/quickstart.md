# Quickstart: Self-Service Password Change (020)

**Feature**: [spec.md](spec.md) · [plan.md](plan.md)

## What this phase delivers

1. Sign in as any identity → "Account password" appears in the header → open it →
   change your password with current + new + confirmation → confirmation states both
   session facts → your other devices' sessions are dead; this one is not.
2. `authClient.changePassword` — verify-then-update with the clarify-approved message
   policy; `completePasswordReset` and the recovery flow untouched.
3. Proofs: unit (mapping/ordering/policy), integration (session matrix + zero
   authorization drift, live DB), e2e (the signed-in walkthrough end to end).

## Prerequisites

- Linked dev environment: `.env` with `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_PUBLISHABLE_KEY`; `npm run db:reset -- --yes` for the deterministic
  fixture state (fixture passwords documented in
  `tests/database/helpers/fixtures.ts`).
- Dev server (`npm run dev`) for manual walkthroughs; Playwright config boots its own
  server for e2e.

## Walkthrough 1 — the happy path (owner, then any role)

1. Sign in as `fiona@restopilot.dev` (membership-free owner bootstrap — proves FR-002
   reachability for a non-staff identity) → header shows "Account password".
2. Open it; wrong current password + valid new pair → the **distinct**
   current-password message; password unchanged.
3. Correct current password + mismatched new pair → the local mismatch message, no
   network change call.
4. Correct current password + valid pair → success confirmation naming both session
   facts.
5. Fresh sign-in with the OLD password → rejected; with the NEW → accepted.
6. Restore Fiona's password (`db:reset -- --purge-auth`, or repeat 2–4 in reverse).

## Walkthrough 2 — the session matrix (two independent sessions)

1. Sign in as alice on two independent browser profiles (or profile + incognito).
2. Change the password from profile A → A stays signed in; B, on its next
   authenticated action, is treated as signed out.
3. A second tab in profile A keeps working (same session record — the clarify-corrected
   semantics).
4. Authorization drift check: profile and memberships visible to alice are identical
   before and after.

## Walkthrough 3 — the super admin

Sign in as the platform admin → same entry point, same flow, same rules (FR-014); no
platform-specific path exists anywhere in the surface.

## Automated gates

```sh
npm run verify        # unit + database + integration + production build
npx playwright test e2e/auth.routes.test.ts --workers=1   # the walkthrough
npx tsc -b            # types clean
```

- **Unit** (`tests/unit/auth.change-password.test.ts`): verify-before-update ordering;
  distinct vs generic message mapping; mismatch refused before any platform call;
  no account-selector field exists in the call shape; no logging of inputs.
- **Integration** (`tests/integration/auth.password-change.test.ts`, live DB): old
  password dead / new accepted; initiating session valid; independent second client
  denied; memberships + profile identical around the change (SC-003); wrong current
  password refused with the distinct message. Fixture password restored in
  `finally` (and `db:reset -- --purge-auth` documented as the deterministic fallback).
- **E2E** (`e2e/auth.routes.test.ts` extension): signed-in nav link → page → distinct
  refusal → successful change → confirmation text → fresh sign-in with new password;
  standing recovery tests still green in the same run (SC-004).

## Standing-suite discipline

`npm run verify` must show the existing auth suites unchanged and green — this
feature adds files and one method; it modifies no standing auth behavior. If any
recovery/sign-in/session test fails after this feature, the feature is wrong, not
the test (SC-004).
