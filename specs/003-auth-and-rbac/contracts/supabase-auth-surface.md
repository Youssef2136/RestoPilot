# Contracts: Supabase Auth Surface (Phase 2)

**Feature**: 003-auth-and-rbac | **Date**: 2026-09-15

The platform authentication surface this feature depends on and the exact
way the project uses it. Two halves: (A) the runtime Auth API behaviors the
application and tests rely on, and (B) the **seeded-identity provisioning
contract** — the only place in the system that writes to platform-managed
auth tables. Behaviors marked *live-verified* were proven against the
configured cloud project during research (research.md §1–§6, §12–§13). The
application-facing wrapper is [auth-client.md](./auth-client.md); the
database side is [database-functions.md](./database-functions.md).

---

## A. Runtime Auth API surface (consumed, not owned)

### Sign-in — password grant

```text
POST /auth/v1/token?grant_type=password        (supabase.auth.signInWithPassword)
```

| Property | Contract |
|----------|----------|
| Success | HTTP 200; session with access token (`sub` = auth user id, `role: authenticated`, `email`; expiry ~3600 s) — *live-verified* |
| Wrong password | HTTP 400, `error_code: invalid_credentials`, message `Invalid login credentials` — *live-verified* |
| Unknown account | HTTP 400, **byte-identical** response to wrong-password — *live-verified* (FR-002: the platform provides non-enumerating rejection; the UI shows one generic message and never dissects the error) |
| Rate limit | 30 sign-in/sign-up attempts / 5 min / IP (documented limit; suites stay well under) |
| Email validation | Addresses are validated beyond syntax: reserved domains (`…@restopilot.example`, `…@example.com`) are rejected with `email_address_invalid` — *live-verified*; seeded identities use `@restopilot.dev` for this reason |

### Session lifecycle

| Property | Contract |
|----------|----------|
| Persistence | SDK default: session in browser localStorage, `autoRefreshToken` on — survives reload and browser restart until sign-out (FR-016) |
| Token refresh | SDK-managed; the application never handles raw tokens |
| Multi-device | Concurrent sessions permitted (spec Assumptions) |

### Sign-out

| Property | Contract |
|----------|----------|
| Scope | The application **must** call `signOut({ scope: 'local' })` — the JavaScript SDK's default scope is `global` (terminates every device), which contradicts the spec's current-device assumption (FR-017; research.md §11) |
| Effect | Current session destroyed, local storage cleared; access tokens of revoked sessions remain valid only until expiry (documented platform behavior — irrelevant at Phase 2's 1-hour expiry) |

### Password recovery

```text
POST /auth/v1/recover   (supabase.auth.resetPasswordForEmail, redirectTo '/reset-password')
```

| Property | Contract |
|----------|----------|
| Response | Generic for existing and non-existing emails (no enumeration; US5 scenario 5) |
| Instrument | Time-limited (default 3600 s), single-use recovery link delivered to the account email; following it establishes a session and fires the `PASSWORD_RECOVERY` auth event; the client then calls `updateUser({ password })` |
| Effect | New password signs in; previous password rejected; profile/memberships untouched (FR-018/FR-019) |
| Rate limits | 2 auth emails / hour (inbuilt SMTP — *live-verified* `over_email_send_rate_limit`); 60 s window between recover requests. **Automated tests must not send recovery emails** (research.md §12); the full email-link path is a manual quickstart validation |
| Redirect | `redirectTo` must be an allowed URL — platform configuration (below) |

### Sign-up

| Property | Contract |
|----------|----------|
| Public sign-up | **Disabled** by this feature's platform configuration — staff provisioning is Phase 3; customers never receive accounts (FR-022). Current project state at research time: enabled (*live-probed*) |
| Safety net | Even if a self-registered identity existed, it has no linked profile → no staff data access and no staff-area entry (deny-by-default, *live-verified* through the real data API: empty reads, writes denied 42501 by grants). The data layer, not the toggle, is the security boundary |

### Platform configuration (this feature — applied and verified via the documented workflow, FR-023)

1. Disable "Allow new users to sign up" (email-provider signups).
2. Add `http://localhost:5173/**` to the Auth URL allow-list (recovery
   redirect target for the dev origin).

---

## B. Seeded-identity provisioning contract (development seed only)

The **only** writer to `auth.users`/`auth.identities` in Phase 2 is
`supabase/seed.sql`, running as the postgres role via `SUPABASE_DB_URL`.
Every element below is load-bearing (*live-verified*; the failure modes are
real behaviors observed during research — research.md §1–§2).

### `auth.users` row (per seeded staff identity)

| Column | Required value | Why |
|--------|----------------|-----|
| `id` | the deterministic UUID (`profiles.auth_user_id`) | JWT `sub` must equal the linkage value; keeps fixture ids and tests stable |
| `instance_id` | `'00000000-0000-0000-0000-000000000000'` | NULL ⇒ GoTrue cannot find the user ⇒ valid credentials rejected as `Invalid login credentials` |
| `aud`, `role` | `'authenticated'` | standard values |
| `email` | `<name>@restopilot.dev` | passes platform email validation |
| `encrypted_password` | `crypt(p_password, gen_salt('bf', 10))` | pgcrypto bcrypt; cost 10 matches the platform's own default |
| `email_confirmed_at` | `now()` | hosted projects require confirmed email to sign in |
| `confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`, `email_change_token_current` | `''` (empty string) | NULL ⇒ 500 `sql: Scan error … converting NULL to string is unsupported` on sign-in |
| `raw_app_meta_data` | `{"provider":"email","providers":["email"]}` | standard email-identity metadata |
| `raw_user_meta_data` | `'{}'` | none needed |

Insert with `on conflict (id) do nothing` (idempotent; identities survive
`db:reset`, which drops only `public`/`private`).

### `auth.identities` row (one per identity)

| Column | Value |
|--------|-------|
| `id` | the same deterministic UUID (unique per user; makes the seed fully deterministic) |
| `user_id` | the same deterministic UUID |
| `provider` / `provider_id` | `'email'` / the user id |
| `identity_data` | `{"sub":"<uuid>","email":"<name>@restopilot.dev","email_verified":true}` |

Insert with `on conflict (id) do nothing`.

### Ordering and convergence rules

1. Auth identities are inserted **before** `public.profiles` (the Phase 2
   FK requires the identity to exist).
2. `profiles` upsert re-establishes linkage:
   `on conflict (id) do update set auth_user_id = excluded.auth_user_id`.
3. Deleting an auth user that a profile links to fails (FK `no action`) —
   deliberate; `scripts/db/reset.mjs --purge-auth` deletes the six
   `@restopilot.dev` users **after** the schema drop and before
   migrate+seed to restore fixture credentials.
4. A stray user holding a seeded email with a different id makes the seed
   fail loudly (unique email) — remove the stray user; documented in
   `docs/development.md`.

### Stability commitments

1. The runtime behaviors above (generic rejection, session persistence,
   recovery flow) are platform properties the application **relies on**;
   any project-level auth configuration change (SMTP, confirmations, rate
   limits, flow type) is a platform-configuration change under the FR-023
   workflow and must be re-validated against this contract.
2. The provisioning contract may be used by test suites to create scratch
   identities (the integration suite does — research.md §12); it is
   superseded by the Phase 3 admin flows, which become the only production
   provisioning path.
3. Nothing else in the system may write to `auth.*` tables.
