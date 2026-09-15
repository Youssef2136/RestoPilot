# Quickstart: Auth and RBAC (Phase 2)

**Feature**: 003-auth-and-rbac | **Date**: 2026-09-15

Validation guide proving the authenticated staff layer end-to-end. Expected
outcomes map to the spec's success criteria (SC-001 … SC-007). Design
rationale lives in [plan.md](./plan.md) and [research.md](./research.md);
schema and policy details in [data-model.md](./data-model.md); interfaces
in [contracts/](./contracts/). The critical mechanisms (seeded identity
provisioning, sign-in, generic rejection, real-API deny-by-default) were
verified live against the cloud project during research.

---

## Prerequisites

Same as feature 001/002 (Node 22 LTS+, npm, Git, Supabase CLI, the one
configured Supabase Cloud development project with a working `.env` — four
variables). No new tools, no new secrets, no local database.

**Platform configuration (one-time, this feature — FR-023):** in the
project dashboard, (1) disable **Allow new users to sign up**, and (2) add
`http://localhost:5173/**` to the Auth URL allow-list (recovery redirect).
Both steps are recorded in `docs/development.md` → Data-layer workflow
(platform configuration) — verify them before running the recovery
validation below.

## Apply the authenticated layer

```bash
npm run db:migrate    # applies the three Phase 2 migrations (linkage → rbac policies → context RPC)
npm run db:seed       # provisions the six auth identities + re-links profiles (idempotent)
npm run types:gen     # regenerates src/types/database.types.ts (now includes current_auth_context)
```

**Expected outcome**: `db:migrate` reports the three new migrations applied
on top of the existing five (the linkage migration clears feature 002's
synthetic ids before adding the FK — this is expected); `db:seed` reports
the tenancy fixture plus six seeded auth identities
(`alice@restopilot.dev` … `platform-admin@restopilot.dev` — credentials
table in [data-model.md](./data-model.md)); `types:gen` produces a
committed, diff-stable types file.

## Run the security suites (SC-001, SC-002, SC-003)

```bash
npm run test:db             # database suite: Phase 2 visibility matrix + all Phase 1 categories
npm run test:integration    # integration suite: real authenticated sign-ins
```

**Expected outcome** — exit code 0:

| Suite | Proves |
|-------|--------|
| `tenancy.rls.test.ts` (updated) | The four Phase 1 isolation categories (cross-restaurant, cross-branch, scope bypass, direct access) re-proven — now against the **real seeded identity ids**; within-scope reads per the Phase 2 matrix (SC-002) |
| `auth.rbac.test.ts` (new) | Staff-list visibility: owner ✓, branch manager ✓ (own restaurant), cashier ✗, kitchen ✗, cross-restaurant ✗ (FR-007); profiles read rules; membership removed ⇒ access ends on next statement (FR-006); forged JWT claims (`app_role` injected) grant nothing (FR-009, SC-003); super admin reads no restaurant data (FR-012) |
| `auth.signin.test.ts` (new, integration) | Every seeded identity signs in through the real Auth API (SC-007); the effective context from `current_auth_context` matches the seeded membership matrix exactly — including Eve's dual scope and the super admin's empty scope (SC-001); data reads through the real data API respect the in-scope/out-of-scope matrix per role (SC-002); wrong password and unknown account are indistinguishable (FR-002); password-change round-trip on a scratch identity: new password signs in, old password rejected, memberships unchanged (FR-018 post-conditions) |

The database suite runs in rolled-back transactions (no residue). The
integration suite performs ~15 real sign-ins (the platform allows 30 per
5 minutes per IP) and **sends no emails** (recovery emails are rate-limited
to 2/hour — research.md §12).

## Full quality pipeline

```bash
npm run verify        # format:check → lint → typecheck → test:unit → test:db → test:integration → build
npm run test:e2e      # route smoke + the auth route matrix
```

**Expected outcome**: exit code 0. The `verify` pipeline gains the
integration step (its cloud precondition is the same as `test:db`'s).
`tests/unit/auth.guards.test.ts` covers
the guard/route-permission decision matrix; `e2e/auth.routes.test.ts` walks:
unauthenticated `/dashboard` and `/admin` redirect to `/signin` with
return-to and land back after sign-in (FR-013); `/dashboard/staff` as
cashier renders NotAuthorized — rejected, not hidden (FR-014); sign-out
re-protects both areas (FR-017, SC-006).

## Manual validation walkthroughs

### Sign-in and role mapping (SC-001, SC-007)

```bash
npm run dev           # http://localhost:5173
```

Sign in with each credential from the seed table
([data-model.md](./data-model.md)):

| Identity | Expected staff-area experience |
|----------|-------------------------------|
| Alice (owner, Blue Olive) | Dashboard shows Blue Olive with **both branches** (Downtown, Marina) in the context selector; staff list view available |
| Bob (branch manager, Downtown) | Context selector shows **Downtown only**; staff list view available |
| Carla (cashier, Downtown) / Dan (kitchen, Marina) | Own branch only; staff list view **unavailable** — deep link to `/dashboard/staff` shows NotAuthorized |
| Eve (owner of Cedar Grill + cashier of Downtown) | **Unified staff area**: both restaurants in the context selector — Cedar Grill (all branches, staff list available) and Blue Olive (Downtown slice only, staff list denied) — no forced chooser at sign-in (FR-015) |
| Platform Admin | Signed in, lands on `/admin` (platform admin area); no restaurant data anywhere (FR-012) |

Also verify: wrong password and unknown email show the **same** generic
message (FR-002).

### Session persistence and sign-out (SC-004)

Sign in, reload the page, close and reopen the browser — still signed in
with the same identity and scope (FR-016). Sign out — protected areas
redirect to sign-in and staff data is unreachable until re-authentication
(FR-017). Sessions on a second device survive a sign-out on the first
(current-device scope).

### Password recovery (SC-005) — rate-limit aware, at most 2 emails/hour

1. From `/signin`, request recovery for `carla@restopilot.dev` — generic
   confirmation, also for a non-existent address (no enumeration).
2. Retrieve the recovery email (development retrieval paths: the Supabase
   dashboard's Authentication → Emails log on hosted projects, or any inbox
   the project's SMTP delivers to) and follow the link — it redirects to
   `/reset-password` with a session.
3. Set a new password → sign in with it succeeds; the old password is
   rejected; profile, memberships, roles, and scope are unchanged
   (FR-018/FR-019).
4. Reuse the already-used link → rejected (single-use); wait past the
   validity window → rejected (time-limited).

Restore the fixture credential afterwards with
`npm run db:reset -- --yes --purge-auth` (drops the seeded auth users and
rebuilds everything from repository artifacts).

### Sign-up posture (FR-022)

Attempt a self-service sign-up (e.g. via the API or a crafted form): it is
rejected — public sign-ups are disabled by the platform configuration.

## Reset-and-rebuild determinism (SC-007)

```bash
npm run db:reset                  # identities survive (auth schema untouched) and re-link
npm run db:reset -- --yes --purge-auth   # full restore incl. fixture credentials
npm run types:gen                 # diff against the committed file — must be unchanged
npm run test:db                   # full suite passes on the rebuilt database
```

**Expected outcome**: both reset variants yield an equivalent known-good
database rebuilt purely from repository artifacts; `types:gen` output is
byte-identical (feature 002 FR-016 posture extended). Run only against the
development project.

## Failure-mode checks (spec Edge Cases)

- **Authenticated identity with no linked profile** — signs in, sees
  NotAuthorized in every staff area, reads no staff data (deny-by-default;
  asserted by the integration and database suites — US1 scenario 3).
- **Credentials carrying forged role/scope claims** — no effect; no policy
  reads claims beyond the identity id (SC-003; asserted with injected
  `request.jwt.claims`).
- **Membership removed mid-session** — that restaurant's data disappears on
  the next access (FR-006; asserted inside a rolled-back transaction).
- **Customer attempts staff sign-in** — no customer identity exists in this
  phase; guest ordering identity arrives with Phase 7 (FR-022).
- **Recovery requested for an unknown email** — generic response, no
  account enumeration (asserted by the integration suite).
- **Seed fails with a unique-email violation** — a stray user holds a
  seeded email; remove it (runbook in `docs/development.md`), re-run
  `npm run db:seed`.
- **Partially migrated or manually modified database** — `npm run db:reset`
  restores the known-good state first ([docs/development.md](../../docs/development.md)).
- **Cloud project unreachable / auth rate-limited (HTTP 429)** — see
  `docs/development.md` connectivity guidance; for rate limits, wait out
  the window (the suites are designed to stay under it).

---

## Validation record (T038, 2026-09-15)

The walkthroughs above were executed with every automatable check run
programmatically; the genuinely human-only steps are recorded below as
**requires manual confirmation** — no manual result is claimed without a
human performing it.

| Walkthrough | Result | Evidence |
|-------------|--------|----------|
| Per-identity sign-in + resolved scope (all six identities) | ✓ verified (automated) | `test:integration` 22/22 (T035/T036 runs): every identity signs in through the real Auth API; `current_auth_context` matches the seeded matrix exactly — Alice both branches, Bob Downtown, Carla/Dan own branch, Eve the dual union, Platform Admin empty scope |
| Wrong password / unknown email → same generic message | ✓ verified (automated) | `test:integration`: both rejected with identical `invalid_credentials` 400 |
| Guard matrix incl. cashier `/dashboard/staff` deep link → NotAuthorized | ✓ verified (automated) | `test:unit` 52/52 (guard decision matrix) + `test:e2e` 16/16 (deep-link denial in a real browser) |
| Session persistence across a page **reload** | ✓ verified (automated) | `test:e2e`: signed-in member stays signed in with the same identity and scope after reload |
| Sign-out re-protects `/dashboard` and `/admin` | ✓ verified (automated) | `test:e2e`: post-sign-out both redirect to `/signin` until re-authentication |
| Recovery request for unknown email → generic response | ✓ verified (automated) | `test:integration`: no error, no enumeration (no email sent) |
| Password change round-trip (new password works, old dead, account unchanged) | ✓ verified (automated) | `test:integration` scratch-identity round-trip (FR-018/FR-019) |
| Self-service sign-up rejected (FR-022) | ✓ verified (automated) | Live probe 2026-09-15: `POST /auth/v1/signup` with the publishable key → **HTTP 422 `signup_disabled`**; `supabase config diff` confirms remote `auth.enable_signup: false` |
| Recovery redirect origin allow-listed (FR-018 precondition) | ✓ verified (automated) | `supabase config diff` confirms remote `auth.additional_redirect_urls` includes `http://localhost:5173/**` |
| Fixture-credential restore (`db:reset -- --yes --purge-auth`) | ✓ verified (automated) | T035 determinism run: full purge-rebuild, then `test:db` 55/55 and `test:integration` 22/22 green |
| **Browser-restart persistence** (close/reopen the browser) | **requires manual confirmation** | Reload persistence is e2e-proven; a real browser restart is not automatable in this suite |
| **Second-device survival of a local sign-out** | **requires manual confirmation** | Local-scope sign-out is the coded behavior (`signOut({ scope: 'local' })`); two-device verification needs a human |
| **Real recovery-email link walkthrough** (delivery, link click → `/reset-password` → new password; expired-link and already-used-link rejection) | **requires manual confirmation** | Automated suites never send recovery emails (rate limit); the link-click path, expiry, and single-use rejection need the real email flow (at most 2/hour) |
| **Per-identity visual walkthrough** of the staff-area experience (context-selector presentation, Eve's in-dashboard switching) | **requires manual confirmation** | The underlying context resolution per identity is integration-proven (above); the visual walkthrough against `npm run dev` remains a human step |
