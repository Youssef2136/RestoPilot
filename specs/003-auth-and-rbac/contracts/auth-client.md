# Contracts: Auth Client Module (Phase 2)

**Feature**: 003-auth-and-rbac | **Date**: 2026-09-15

The application-side interface of `src/features/auth/` — the single module
the rest of the app uses for authentication, session state, and effective
authorization context. It wraps the platform surface
([supabase-auth-surface.md](./supabase-auth-surface.md)) and resolves
roles/scope exclusively through the database RPC
([database-functions.md](./database-functions.md) →
`current_auth_context`). Route guards built on it are **presentation only**
— the enforced boundaries live in the data layer (Constitution IV; spec
FR-008; master plan §38: "navigation visibility is a UX concern;
authorization remains a backend concern").

---

## `authClient.ts` — platform operations (thin, typed wrapper)

### `signIn(email: string, password: string): Promise<SignInResult>`

`supabase.auth.signInWithPassword`. On failure returns a result carrying
**one** generic, user-presentable message — it MUST NOT distinguish wrong
password from unknown account (FR-002; the platform already returns
identical errors — the wrapper preserves that property and never dissects
`error.message` into per-field causes).

### `signOut(): Promise<void>`

`supabase.auth.signOut({ scope: 'local' })` — **local scope is part of this
contract** (the SDK default `global` would end every device's session,
contradicting the approved current-device assumption; spec FR-017).

### `requestPasswordReset(email: string): Promise<void>`

`supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`.
Always reports the generic outcome — never whether the account exists
(US5 scenario 5). Does not run in automated tests against real seeded
addresses (email rate limits — see the platform contract).

### `completePasswordReset(newPassword: string): Promise<Result>`

`supabase.auth.updateUser({ password })` — valid only with the
recovery-established session (see `ResetPasswordPage`, below). Success ⇒
the previous password is dead and nothing else changed (FR-018/FR-019).

### `getSession() / onAuthStateChange(cb)`

Delegated to the SDK; session persistence (localStorage, auto-refresh) is
the platform default (FR-016). The provider re-subscribes on mount and
cleans up on unmount (no leaked subscriptions).

## `AuthProvider.tsx` — session state

Context value: `{ session, status }` with `status ∈ 'loading' | 'signed-in'
| 'signed-out'`. Updates come from `onAuthStateChange`
(`SIGNED_IN`, `SIGNED_OUT`, `PASSWORD_RECOVERY`, token-refresh events).
**Session ≠ staff context**: an authenticated identity with no linked
profile is `signed-in` with an empty context — that case is handled by the
guards, not by the provider.

## `useAuthContext.ts` — effective roles and scope

React-query hook over `supabase.rpc('current_auth_context')`, enabled only
when signed in; invalidated on auth events. Returns
`AuthContext = { profile | null, memberships[…] }`
(shape: [database-functions.md](./database-functions.md)). Derived, memoized
predicates used by guards and navigation:

- `isStaff` — `profile ≠ null ∧ memberships.length > 0` (staff-area entry)
- `isSuperAdmin` — `profile?.is_super_admin === true` (platform admin area)
- `canReadStaffList(restaurantId)` — a membership with role `owner` or
  `branch_manager` for that restaurant (FR-007)

The hook **caches; it never decides** — every predicate is advisory for
presentation, and the underlying data reads happen under the caller's own
RLS policies (Constitution IV/V; spec FR-009: nothing
credential-carried participates).

## `guards.tsx` — route guards (presentation layer)

| Guard | Behavior |
|-------|----------|
| `RequireAuth` | Unauthenticated ⇒ redirect to `/signin` with the requested location in `location.state.from` (return-to after sign-in, FR-013). |
| `RequireStaff` (wraps `RequireAuth`) | Signed-in but not `isStaff` ⇒ renders `NotAuthorized` — **rejected, not hidden** (FR-014; covers the unlinked-identity case, FR-005/US1 scenario 3). |
| `RequireSuperAdmin` (wraps `RequireAuth`) | Signed-in but not super admin ⇒ `NotAuthorized`. |
| `NotAuthorized` | The explicit denial view (deep links land here rather than being redirected into silence). |

Guard decisions consume `useAuthContext` only (never raw table state), so
navigation and enforcement share the single resolution path (FR-010). The
full route-permission matrix is unit-tested in
`tests/unit/auth.guards.test.ts` and proven end-to-end by the server-side
suites through real data reads (spec FR-020).

## Route surface (consumers of the module)

| Route | Guard | Content |
|-------|-------|---------|
| `/signin` | public | Sign-in form; on success navigates to `state.from` or the default landing (super admin without memberships → `/admin`; staff → `/dashboard`) |
| `/reset-password` | public page, session-bearing | Listens for `PASSWORD_RECOVERY`; collects the new password; calls `completePasswordReset` |
| `/dashboard` | `RequireStaff` | Unified staff area across all memberships; in-dashboard restaurant/branch context selection (FR-015 — never a forced chooser at sign-in) |
| `/dashboard/profile` | `RequireStaff` | Own basic profile + effective roles and scope (FR-011) |
| `/dashboard/staff` | `RequireStaff` + `canReadStaffList(selected restaurant)` | Staff list: memberships + linked profiles (FR-007) |
| `/admin` | `RequireSuperAdmin` | Platform admin area shell; fetches **no** restaurant tenant data (FR-012) |
| `/`, `/r/:restaurantSlug`, `/order/:branchId` | public | Unchanged Phase 0 customer-facing placeholders |

## Stability commitments

1. The module is the **only** import path for `supabase.auth.*` in
   application code (pages import `authClient`/providers, never the raw
   client) — one place to audit for the FR-002/FR-017 properties.
2. `AuthContext` mirrors the RPC shape; if the RPC shape evolves
   (additively), this contract and the RPC contract change together.
3. Guards may gain predicates; they never gain authorization power. Any
   attempt to make a guard the enforcement point for a data operation is a
   Constitution IV violation and fails review.
