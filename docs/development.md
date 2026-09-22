# RestoPilot — Development Guide

How to set up, run, and work on RestoPilot. The backend is a configured
**Supabase Cloud** project — there is no local Supabase or PostgreSQL
instance and no Docker requirement. The Supabase CLI is used only for
source-controlled migrations, database type generation, and
deployment/synchronization against the cloud project.

Project conventions — where code goes, naming, and the feature workflow —
live in [conventions.md](./conventions.md).

## Prerequisites

| Tool                   | Version                            | Install / check                                                                                   |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Node.js                | 22 LTS+ (pinned by `.nvmrc`)       | <https://nodejs.org> — `node --version`                                                           |
| npm                    | bundled with Node                  | `npm --version`                                                                                   |
| Git                    | current stable                     | <https://git-scm.com> — `git --version`                                                           |
| Supabase CLI           | current stable                     | <https://supabase.com/docs/guides/local-development/cli/getting-started> — `supabase --version`   |
| Supabase Cloud project | one configured development project | you need its URL, publishable key, project ref, and database connection string — see Setup step 5 |

Verify versions before starting. Missing or wrong-version prerequisites are
expected to fail with actionable messages rather than obscure downstream
errors.

## Setup (acceptance gate)

Follow these steps in order on a clean machine — every step must succeed as
written, with no undocumented manual fixes:

1. **Clone** the repository from its GitHub remote:
   `git clone <repository-url> && cd restopilot`
2. **Install dependencies**: `npm install`
3. **Authenticate the Supabase CLI**: `supabase login`
4. **Link the cloud project**:
   `supabase link --project-ref $SUPABASE_PROJECT_REF`
   (the Reference ID is in Project Settings → General)
5. **Configure the environment**: `cp .env.example .env`, then fill in the
   four values — `.env.example` documents exactly where to find each one
6. **Apply migrations**: `npm run db:migrate`
7. **Load seed data**: `npm run db:seed`
8. **Start the frontend**: `npm run dev` → <http://localhost:5173> —
   the application shell must load without errors
9. **Run tests**: `npm run verify` and then `npm run test:e2e`

Step 9's `verify` runs the full local pipeline: format check → lint → type
check → unit tests → database tests → auth integration tests → production
build. `test:e2e` starts its own dev server and exercises the route shell.
Both must pass.

The complete gate is expected to complete in **30 minutes or less** from a
clean machine using only this documentation (spec SC-001/SC-002).

## Daily commands

| Command                                   | What it does                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                             | start the frontend dev server                                                                                   |
| `npm run build`                           | type-check and build for production                                                                             |
| `npm run preview`                         | serve the production build locally                                                                              |
| `npm run lint`                            | run ESLint                                                                                                      |
| `npm run format` / `npm run format:check` | format the code / check formatting (Prettier)                                                                   |
| `npm run typecheck`                       | run the TypeScript compiler check                                                                               |
| `npm run test:unit`                       | run unit tests (Vitest)                                                                                         |
| `npm run test:db`                         | run database tests (precondition: reachable cloud project)                                                      |
| `npm run test:integration`                | run auth integration tests — real Auth API sign-ins against the cloud project (same precondition)               |
| `npm run test:e2e`                        | run end-to-end tests (Playwright; starts its own server)                                                        |
| `npm run verify`                          | full local pipeline: format:check → lint → typecheck → test:unit → test:db → test:integration → build           |
| `npm run db:migrate`                      | apply pending migrations to the cloud development database                                                      |
| `npm run db:seed`                         | apply `supabase/seed.sql` (idempotent)                                                                          |
| `npm run db:reset`                        | ⚠️ destructive: rebuild the cloud development database from zero (migrations + seed) — development project only |
| `npm run types:gen`                       | regenerate `src/types/database.types.ts` from the cloud schema                                                  |

## Database security tests

`npm run test:db` runs five suites against the cloud development database:

- `app_meta.test.ts` — Phase 0 baseline still intact.
- `tenancy.schema.test.ts` — the tenancy tables match the declared shapes;
  invalid data (cross-tenant references, duplicate identifiers, role/branch
  mismatches) is rejected by constraints.
- `tenancy.rls.test.ts` — the tenant-isolation matrix: cross-restaurant,
  cross-branch, bypass, and direct-access denial for every seeded actor, plus
  the positive within-scope paths (spec 002 FR-011) — re-proven since Phase 2
  against the real seeded identity ids under the narrowed visibility matrix
  (spec 003 FR-020).
- `auth.rbac.test.ts` — the Phase 2 role-aware matrix: staff-list visibility
  per role (owners and branch managers only), `profiles` read rules,
  membership-removal immediacy, forged-credential-claims immunity, and the
  super admin reading no restaurant tenant data (spec 003 FR-006/FR-007/
  FR-009/FR-012).
- `audit.test.ts` — the audit writer's contract and the append-only posture.

The security suites simulate acting identities by setting the Postgres role
and JWT claims exactly as the data API does for real requests, inside
transactions that are **always rolled back** — the shared development database
keeps no test residue. Precondition: a migrated and seeded database
(`npm run db:migrate && npm run db:seed`). Details and expected outcomes:
`specs/002-database-and-tenancy/quickstart.md`.

A failing isolation test is a security boundary failure, not a flaky test —
fix it before anything else.

## Auth test suites (Phase 2)

Phase 2 (auth and RBAC) added the authenticated layer to every test tier. All
three share the same cloud precondition as `test:db`: a migrated and seeded
development project (`npm run db:migrate && npm run db:seed`). What each
covers:

| Suite                                                                       | Command                                  | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/database/auth.rbac.test.ts` (plus the updated `tenancy.rls.test.ts`) | `npm run test:db`                        | The Phase 2 visibility matrix at the data layer: staff-list visibility per role, `profiles` read rules (own + managed), membership-removal immediacy, forged-claims immunity, super-admin denial; the four Phase 1 isolation categories re-run against the real seeded identity ids. Runs in rolled-back transactions — no residue.                                                                                                                                                                                                              |
| `tests/integration/auth.signin.test.ts`                                     | `npm run test:integration`               | Real Auth API sign-ins for every seeded identity (session subject = the deterministic UUID); the effective context from `current_auth_context` matches the seeded membership matrix exactly; generic, non-enumerating rejection of wrong-password and unknown-account attempts; the in-scope/out-of-scope data matrix per role through the real data API; deny-by-default for an unlinked scratch identity; the automatable password-recovery properties (generic response for unknown addresses, post-change round-trip on a scratch identity). |
| `e2e/auth.routes.test.ts` (plus `tests/unit/auth.guards.test.tsx`)          | `npm run test:e2e` / `npm run test:unit` | The route matrix in a real browser: unauthenticated `/dashboard` and `/admin` redirect to `/signin` with return-to and land back after a seeded sign-in; each role lands on its correct area; a deep link to an unauthorized view (`/dashboard/staff` as cashier) renders NotAuthorized — rejected, not hidden; the super admin reaches `/admin`; session persistence across reload and sign-out re-protection. The full per-role guard decision matrix is unit-tested.                                                                          |

**Rate-limit notes** (the suites are designed to stay under the platform
limits — research.md §12):

- **No automated test sends recovery emails** (hosted inbuilt SMTP allows
  2/hour). The integration suite makes exactly one recovery request per run,
  for a non-existent address, which sends no email. The full email-link path
  (delivery, expiry, single-use) is a manual walkthrough.
- **Sign-in rate limit**: 30 per 5 minutes per IP. The integration suites
  perform ~18 sign-ins per run (the Phase 2 matrix plus the Phase 3
  provisioning round trip) and the e2e suite ~14 — each suite stays under the
  limit on its own; avoid running both (or repeated runs) in rapid succession
  within one 5-minute window.
- **Recovery endpoint window**: the platform enforces a 60-second window
  between recovery requests — leave at least 60 seconds between consecutive
  `test:integration` runs or the single recovery probe may be rate-limited
  (HTTP 429).

Expected outcomes per walkthrough, including the manual validation scripts
(per-identity sign-in experience, session persistence, rate-limit-aware
password recovery, sign-up posture):
[specs/003-auth-and-rbac/quickstart.md](../specs/003-auth-and-rbac/quickstart.md).

## Management test suites (Phase 3)

Phase 3 (restaurant and branch management) added the management surface to
every tier. All of them share the same cloud precondition as `test:db`: a
migrated and seeded development project (`npm run db:migrate && npm run
db:seed`). What each covers:

| Suite                                                           | Command                    | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/database/management.rpc.test.ts`                         | `npm run test:db`          | The management RPCs at the data layer: the creation bootstrap, the owner-only authorization matrix (branch manager, cashier, kitchen, other restaurant, anon, unlinked identity, super admin — all `42501` with no state change), the validation rules and their `P0001` messages, the FR-004 identifier-change semantics (including that the released identifier is retained nowhere), branch/working-hours semantics (split days, post-18:00 intervals, the boundary-touching pair, all-or-nothing rejection), table label/activation rules, and the audit records. Runs in rolled-back transactions — no residue. |
| `tests/database/staff.management.test.ts`                       | `npm run test:db`          | Staff provisioning and linking: a new email creates identity + profile + membership and returns a one-time credential stored only as a bcrypt hash; an existing linked person is linked with no credential and no display-name overwrite; an unclaimed stub gains a profile and a re-issued credential; the role/branch consistency rules; the FR-016 last-owner safeguard (removal and demotion); removal ends access while the person persists; the same owner-only authorization matrix; the staff audit records. Runs in rolled-back transactions — no residue.                                                  |
| `tests/unit/management.client.test.ts`, `management.qr.test.ts` | `npm run test:unit`        | The client module's error mapping and result shaping for all twelve wrappers, and the QR payload builder (`origin/r/<slug>`, no branch or table segment possible) with SVG/PNG generation smoke tests.                                                                                                                                                                                                                                                                                                                                                                                                               |
| `tests/integration/management.provisioning.test.ts`             | `npm run test:integration` | The User Story 4 exit condition over the real APIs: the owner provisions a person through `add_staff_member`, the returned one-time credential signs in through the real Auth API, `current_auth_context` resolves exactly the assigned scope, and out-of-scope reads and management calls are denied under the caller's own grants. Tears itself down completely (membership, profile, identity, audit rows) in `afterAll`.                                                                                                                                                                                         |
| `e2e/management.surfaces.test.ts`                               | `npm run test:e2e`         | The browser presentation matrix: the FR-001 creation panel, the owner's management navigation and page, the FR-004 warning-before-confirm flow (cancelled, never submitted), the tables and QR surfaces, and the non-owner / super-admin denials that must render NotAuthorized — rejected, not hidden. **Read-and-reject only: this suite creates no tenant, branch, table, or staff data** (creation journeys are proven by the database and integration suites plus the quickstart walkthroughs).                                                                                                                 |

**Provisioning runbook step** (adding a team member): the owner adds a person
from the staff page (email, display name, role, and a branch for the
branch-scoped roles). The database provisions the sign-in identity and shows a
**one-time temporary credential** on screen — share it with the person now; it
is not shown again and is stored only as a hash. The person can rotate it
through the platform's password-recovery flow. Adding someone who already has
an account links their existing identity and issues **no** credential (their
sign-in is untouched); adding a person whose identity exists but was never
claimed issues a fresh credential. After a `db:reset`, re-adding a person
restores their membership against the surviving identity — the identity rows
live in the `auth` schema, which the reset leaves untouched (see the
re-add/re-issue note in
[specs/004-restaurant-and-branch-management/quickstart.md](../specs/004-restaurant-and-branch-management/quickstart.md)).

## Menu test suites (Phase 4)

Phase 4 (menu management) extends every tier again and adds the project's
first Storage surface. The database-tier suites share the `test:db`
precondition (migrated + seeded development project); the storage integration
suite additionally needs the `menu-images` bucket, which the media migration
creates — see the storage posture below.

| Suite                                   | Command                    | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/database/menu.schema.test.ts`    | `npm run test:db`          | The menu schema layer: table and column definitions, the `image_path` shape check (the path grammar as a table constraint), the ordering/unique constraints on categories and items, and the client-grant posture — no INSERT/UPDATE/DELETE grant on any menu table for `authenticated` (the RPCs are the only write paths). Runs in rolled-back transactions.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `tests/database/menu.rpc.test.ts`       | `npm run test:db`          | The menu RPC matrix: category and item CRUD authorization across the identity matrix (owner, manager, cashier, other restaurant, anon — denials are `42501` with no state change), validation messages verbatim, price handling, the visibility rules for the branch-facing read, the extras lifecycle (`add_menu_item_extra` / `update_menu_item_extra` / `remove_menu_item_extra`, including the 20-extras ceiling proven under a real row lock so two concurrent adds cannot exceed it), the image-reference RPC (`set_menu_item_image` — previous-path return, path-grammar and ownership validation, the audit records), and the SQL-level proof of the storage select policy (an object is readable exactly while a visible item references it). Runs in rolled-back transactions. |
| `tests/unit/menu.client.test.ts`        | `npm run test:unit`        | The client module's error mapping, result shaping, and money formatting for all menu wrappers, plus the image orchestration against a stubbed Storage client (path building, the upload → record → delete-old ordering, and failure handling per contracts/menu-images.md §4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `tests/integration/menu.images.test.ts` | `npm run test:integration` | The real-Storage round trip against the live `menu-images` bucket: the bucket's limits reject oversized and disallowed-type uploads; the policies decide insert/read/delete under a real token; and the load-bearing rule — an object is readable exactly while a visible item references it — end to end. Self-cleaning: teardown clears the item's reference and removes every scratch object through the Storage API.                                                                                                                                                                                                                                                                                                                                                                 |
| `e2e/menu.surfaces.test.ts`             | `npm run test:e2e`         | The browser presentation matrix: the owner's menu structure editor, the per-item editor with price, availability, extras, and image fields, the branch-facing read-only view, and the non-owner denials that render NotAuthorized. **Read-and-reject only: no menu data is created** (creation journeys are proven by the database suite and the quickstart walkthroughs).                                                                                                                                                                                                                                                                                                                                                                                                               |

### The `menu-images` bucket and its storage posture

The bucket is **configured by migration**
(`supabase/migrations/*_menu_media.sql`) — never through the dashboard — so
its limits and access rules live in the same canonical workflow as every
other schema change:

- **Private** (`public: false`), `file_size_limit` 5 MiB,
  `allowed_mime_types` JPEG/PNG/WebP. The bucket is the **authoritative
  validation point**: a direct Storage call with a user token is subject to
  exactly the same bounds as the UI's upload (the client's pre-checks are
  feedback only).
- **Policy-only, no grants added**: the Storage service's own migrations
  grant table privileges to `authenticated`; the four policies
  (`menu_images_staff_select`, `menu_images_owner_insert`,
  `menu_images_owner_delete`, and deliberately **no update** — replacement is
  insert + delete) are the entire access decision.
- **Object paths are tenant bindings**: `restaurant/<restaurant_id>/item/
<item_id>/<uuid>.<ext>`, built by `menuImages.ts`, re-validated by the RPC,
  and constrained on the table.
- **Deletion is never done in SQL** — deleting through SQL orphans the file;
  cleanup is always a Storage-API delete by the owner.
- One observed hosted-Storage behavior worth knowing when debugging:
  authorization decisions are **token-bound** — after an image reference
  moves, a session that was previously granted a download may keep receiving
  the old object for a while, while any fresh session is refused
  immediately. `tests/integration/menu.images.test.ts` observes refusals
  with fresh sign-ins for exactly this reason.

## Tax test suites (Phase 5)

Phase 5 (tax engine) follows the same tier pattern and adds the calculation
matrix — the deterministic money-math proofs that make the engine auditable.
All suites share the `test:db` precondition (migrated + seeded development
project); no Storage surface exists in this phase.

| Suite                                       | Command                    | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/database/tax.schema.test.ts`         | `npm run test:db`          | The tax schema layer: `tax_rules` shape and validation constraints (rate bounds, scope/target exclusivity), the branch-override and compound junction tables, the snapshot table, and the client-grant posture — no direct INSERT/UPDATE/DELETE on any tax table for `authenticated`; the nine RPCs are the only write paths. Runs in rolled-back transactions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `tests/database/tax.rpc.test.ts`            | `npm run test:db`          | The tax RPC matrix: the full identity matrix (owner, branch manager, cashier, other restaurant, anon — denials are `42501` with no state change), rule CRUD validation messages verbatim (rate bounds, compound source must be an active restaurant-level rule of the same restaurant), the config-resolution read (`get_branch_tax_config` — branch overrides layered over active restaurant rules, retired rules excluded), the override lifecycle (`set_branch_tax_override` — manager scoped to their own branch), the `calculate_branch_taxes` matrix (subtotal vs compound ordering by `order`, extra line items, empty basket → empty lines, rounding half-up at the line boundary, determinism across repeats and users), snapshot recording (`record_tax_snapshot` — owner-only, once per branch), and the audit trail (`tax.*` actions). Runs in rolled-back transactions. |
| `tests/unit/tax.client.test.ts`             | `npm run test:unit`        | The client module's error mapping and result shaping for every tax wrapper, the `parseTaxConfig` / `parseCalculation` payload validators (malformed or hostile payloads raise `TaxPayloadError`), and the money formatting rules. No network: the Supabase client is stubbed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `tests/integration/tax.calculation.test.ts` | `npm run test:integration` | The real-API calculation journey through the hosted PostgREST endpoint: the same basket produces byte-identical results across sessions and users (FR-011), the cross-restaurant and staff denials hold through the real auth path, and the suite is self-cleaning (its scratch rules are removed at start and teardown).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `e2e/tax.surfaces.test.ts`                  | `npm run test:e2e`         | The browser presentation matrix: the owner's tax rules editor and per-branch override page, the branch manager's scoped controls (own branch only), the cashier's read-only view, the non-owner NotAuthorized denials, and the totals preview that renders the deterministic calculation. **Read-and-reject only: no tax data is created** (creation journeys are proven by the database suite and the quickstart walkthrough).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Session test suites (Phase 6)

Phase 6 (customer access and sessions) follows the same tier pattern. Its
data-layer posture: the three session tables (`sessions`,
`session_participants`, `session_tokens`) carry **zero grants** for `anon` and
`authenticated` — the seven RPCs are the only surface; the access token lives
only on the customer's device (raw value in `localStorage` under
`restopilot.session-token`) while the database stores only its SHA-256 hash;
and the partial unique index `sessions_one_open_per_table` makes open-or-join
race-free. The seeded dev tokens (documented plaintext constants in
`tests/database/helpers/fixtures.ts`, hashed by the seed) are development-only
fixtures shared by the suites and the e2e — never secrets.

| Suite                                       | Command                    | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/database/session.schema.test.ts`     | `npm run test:db`          | The session schema layer: the three tables' shapes, the closed-shape and status/type checks, the participant bounds, the unique `token_hash`, and the zero-grant posture proven for `anon` and `authenticated` on every table. Runs in rolled-back transactions.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `tests/database/session.rpc.test.ts`        | `npm run test:db`          | The session RPC matrix: authorization for all seven functions across the identity matrix (denials are `42501`), the contract's validation messages verbatim, the US1 entry-validation block (each invalid class refused with NOTHING stored), the US2 lifecycle block (open-or-join, the partial unique index under a real race, no-timeout, terminality, the close audit), the US3 abuse block (unknown/tampered/closed all refused with the one indistinguishable message; no argument can redirect a token; tokens grant no staff operations), and the US4 scoping block (branch-scoped lists, the PII posture — no phone to staff lists). Runs in rolled-back transactions. |
| `tests/unit/session.client.test.ts`         | `npm run test:unit`        | The client module's error mapping and payload parsing for every wrapper, and the token storage rules: written only on entry success, read for customer reads, cleared on a refused recovery (the next read then refuses locally without an RPC), never touched by staff calls. No network: the Supabase client is stubbed.                                                                                                                                                                                                                                                                                                                                                      |
| `tests/integration/session.journey.test.ts` | `npm run test:integration` | The real-API journey: enter → recover after a reload-equivalent (fresh client, stored token) → read the menu → staff close through a real owner sign-in → refused recovery with the token cleared → re-enter into the table's new session. Self-cleaning: it leaves no open session behind.                                                                                                                                                                                                                                                                                                                                                                                     |
| `e2e/session.surfaces.test.ts`              | `npm run test:e2e`         | The browser presentation matrix (a serial file — the close tests share Airport T1): the public entry flow with branch/table pickers and validation feedback, the second-window join, the staff oversight view scoped to the signed-in branch, the confirmed close journey, role denials (kitchen sees no surface; other-branch staff never reach Marina), and the recovery rules — reload recovery, the tampered-token refusal, and the closed-session refusal all returning the customer to entry with the device cleared.                                                                                                                                                     |

## Order test suites (Phase 7)

Phase 7 (cart and rounds) follows the same tier pattern. Its data-layer
posture: the four order tables (`rounds`, `round_items`, `round_item_extras`,
`kitchen_tickets`) carry **zero grants** for `anon` and `authenticated` — the
two RPCs (`submit_round`, `get_session_rounds`) are the only surface; the
tax capture delegates to `private.calculate_tax_totals`, the owner-only core
extracted from the Phase 5 engine (one canonical money math, callable from
both the staff JWT authorization model and the token-based submission);
and the partial unique index `kitchen_tickets_one_per_round` plus the
`unique (round_id, item_id)` make the write set structurally safe. The cart
itself is CLIENT-ONLY and advisory (`restopilot.cart` in `localStorage`,
scoped to the session token) — the server's validation and captured money are
the state that matters.

| Suite                                           | Command                    | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/database/order.schema.test.ts`           | `npm run test:db`          | The order schema layer: the four tables' shapes in ordinal order, the closed `state` checks, quantity and money bounds, the structural uniques, `kitchen_tickets_one_per_round` enforced (a second ticket attempt fails in a rolled-back transaction), and the zero-grant posture for both client roles on every table. Runs in rolled-back transactions.                                                                                                                                                                                                                                                                                                                   |
| `tests/database/order.rpc.test.ts`              | `npm run test:db`          | The order RPC matrix: token authorization with the byte-identical session refusal (unknown, tampered, null), the generic validation refusals verbatim — **each proving zero rows left behind in all four tables** (the atomicity proofs), the money path with the tax cross-check against the Phase 5 engine (as the owner identity), the all-or-nothing write set, sequential double-submission independence, the concurrency race proof, the newest-first history read, the no-account posture (no staff identity, no audit rows), and the US4 ticket-integrity block (exactly one ticket per round, born `new`, no client write path). Runs in rolled-back transactions. |
| `tests/unit/order.cart.test.ts`                 | `npm run test:unit`        | The cart module's rules: save/load round-trip under the documented key, token scoping (a foreign token reads as empty), merge-on-add with bounds clamping, subscription notifications, the clear paths, and malformed-payload resilience. No network.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `tests/integration/order.journey.test.ts`       | `npm run test:integration` | The real-API ordering journey through the hosted PostgREST endpoint: enter → build the cart through the real merge rules → submit → the history shows the round with captured prices → the reload-equivalent (fresh client, stored token) → a second submission → two rounds, two tickets. Rerun-safe by id-based assertions; self-cleaning (closes its session through a real staff sign-in).                                                                                                                                                                                                                                                                              |
| `e2e/session.surfaces.test.ts` (Phase 7 blocks) | `npm run test:e2e`         | The browser cart journey on the customer menu: add-with-extras and the advisory total, adjust/remove, reload persistence of the cart, no cart surface on the entry route, the submit flow (success clears and names the round; the verbatim refusal preserves the cart via a poisoned stale line), and the two-round history surviving a reload.                                                                                                                                                                                                                                                                                                                            |

## Staff operations test suites (Phase 8)

Phase 8 (kitchen and cashier operations) adds the staff surface over the
Phase 7 substrate. Its data-layer posture: the round state machine
(`new → accepted → preparing → ready → lock`, terminal; kitchen tickets move
`new → accepted → preparing → ready`, never lock) lives in the DATABASE —
five guarded-update transition RPCs plus `modify_round_line`'s captured-price
re-derivation (through the same owner-only tax core, pinned to each line's
captured unit price and adjustments via a parallel overrides array). Every
transition is `update … where id = $1 and state = '<from>'` with
`row_count = 0 ⇒ P0001` — two racing transitions serialize at row level and
exactly one guard matches (the concurrency arbiter; the pooled session-mode
cloud database cannot interleave connections, so the suites prove the
sequential winner/loser posture instead, as documented in the suites).
Every mutation is audited through `private.record_audit` with the JWT-derived
actor. The DB owns the transitions; the transport (realtime) is Phase 12's.

| Suite                                           | Command             | Coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/database/round.lifecycle.test.ts`        | `npm run test:db`   | The transition matrix: identity/tenant gates (outsider, anon, cross-branch kitchen; the dual-role eve reaching Downtown as cashier), the full happy path per allowed role with round↔ticket↔audit sync, every illegal class (repeat/skip/backward/terminal/unknown id) refusing with ZERO state change, the unknown id indistinguishable from out-of-tenant, and the reads (silent `[]` filtering on branch reads, the bill's 42501, the money-free queue shape). |
| `tests/database/order.schema.test.ts` (widened) | `npm run test:db`   | The order tables' constraints re-asserted against the WIDENED state checks (the 008-era closed checks are superseded by the lifecycle check).                                                                                                                                                                                                                                                                                                                     |
| `tests/unit/staffops.client.test.ts`            | `npm run test:unit` | The client wrappers' payload discipline (rpc error → typed error; null payload → fail closed; clean payload → typed), the money-free queue parser rejecting ANY money key (FR-010 client half), and the verbatim bill shape. No network.                                                                                                                                                                                                                          |
| `e2e/kitchen.cashier.test.ts`                   | `npm run test:e2e`  | The browser journeys (serial): dan's kitchen queue at Marina with no cashier-route access and no money text; carla's full cashier journey on a REAL customer-submitted round — accept → modify → start/ready → lock → the bill panel rendering the captured figures.                                                                                                                                                                                              |

## Channel test suites (Phase 9)

Phase 9 (delivery and takeaway) reuses the Phase 6–8 substrate and adds only
channel-specific behavior: `sessions.type` widens to `dine-in / delivery /
takeaway`, delivery carries an address set once at entry (no write path
after), `open_session_channel` handles non-dine-in entry (no table join
semantics — one customer per channel session), and `submit_round` gains the
STATE-DRIVEN cutoffs (delivery refuses additional rounds once any round is
`out_for_delivery`/`completed`; takeaway once any round is `ready`/`lock`;
dine-in never — session close governs). The cutoffs are evaluated inside the
submission transaction over the same serialization as the transitions, so a
racing transition + submission resolves deterministically. The two cashier
transitions `mark_out_for_delivery` (`ready → out_for_delivery`) and
`mark_completed` (`out_for_delivery → completed`, terminal) are delivery-only,
kitchen-denied, and audited. The staff reads carry `session_type` (+ the
address on the bill) — the kitchen queue stays CHANNEL-BLIND: no address, no
money, no new states (SC-004).

| Suite                                          | Command             | Coverage                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/database/channel.schema.test.ts`        | `npm run test:db`   | The widened schema: `sessions_type_check`, the delivery address checks (null for non-delivery; ≤200 trimmed chars; required for delivery), `table_id` nullable (channel sessions have no table; NULLs distinct keep the one-open-per-table guarantee for dine-in), the extended round states, and the channel-safe reads (branch rounds / bill / kitchen queue over NULL tables; the payload keys `session_type` / `delivery_address`). |
| `tests/database/channel.rpc.test.ts`           | `npm run test:db`   | The channel RPC matrix: entry validation and the dine-in redirect, the delivery and takeaway journeys end-to-end (entry → submit → transitions → cutoff → terminal), both cutoffs refusing verbatim with zero writes, dine-in passing untouched, the two delivery transitions per allowed/denied role, and the audit trail for the extended actions.                                                                                    |
| `tests/unit/channel.entry.test.ts`             | `npm run test:unit` | The entry wrapper's validation mapping (server refusals verbatim), the dine-in redirect identity, the takeaway null-address rule, and the cutoff refusals preserving token and cart while the unavailable-session refusal clears both. No network.                                                                                                                                                                                      |
| `e2e/session.surfaces.test.ts` (channel block) | `npm run test:e2e`  | The browser channel journeys: the delivery entry (address validation + the chip and read-only address echo on the menu), the takeaway entry (neither table nor address), and the cutoff refusal rendered above the preserved cart after the cashier dispatches the round.                                                                                                                                                               |

## Bill, void & audit test suites (Phase 10)

Phase 10 (bill, void, and audit) closes the accounting-display boundary and
adds ONE correction primitive. The governing design decision: **the void is
an OVERLAY, not a state**. The `rounds.state` machine (`new → accepted →
preparing → ready → out_for_delivery/completed / lock`) is terminal-closed
and every 008–010 RPC guards on it — making `voided` a state would have
widened every guard in three migrations' worth of code and invented bogus
transitions. Instead the void is four additive columns on `rounds` plus a
`kitchen_tickets.voided` mirror; the state is NEVER written by a void, so
the 010 channel cutoffs (which read `state`) are not resurrected by one
(FR-011: a voided completed delivery session stays closed).

`void_round` validates in a documented order (reason required ≤500 trimmed →
identity → the GUARDED channel-boundary update: `lock` dine-in,
`out_for_delivery`+ delivery, `ready` takeaway — unknown-id/already-void/below-
boundary all share the ONE generic refusal, the 009 indistinguishable posture)
and everything lands in one transaction: the overlay columns, the ticket
mirror, the `round.void` audit row. `get_audit_log` (owner restaurant-wide
including `branch_id is null` rows; branch managers over their managed
branches; everyone else 42501) reads the durable trail 005–010 already wrote.
`get_session_bill` extends additively (per-line detail, tax lines,
participants, the voided section) and its grand total sums NON-voided rounds
only — the void reduces the bill (FR-003).

| Suite                                    | Command            | Coverage                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/database/bill.void.audit.test.ts` | `npm run test:db`  | The void matrix (boundary per channel, just-below refusals with zero-change proofs, blank/501-char reasons verbatim, repeat-void, the dan/fiona/anon denials), the audit trail (reach rules incl. null-branch rows, the manager union, cross-branch 42501, the filters + clamp + ordering), and the extended bill (line detail byte-equal, participants, voided exclusion). |
| `e2e/bill.void.audit.test.ts`            | `npm run test:e2e` | The browser journeys: carla voids a REAL locked customer round from the dashboard (empty-reason feedback, the voided display state, the bill's voided section and the grand total reduced by exactly the voided round's captured figures), and the audit trail renders the `round.void` entry with its reason for alice (owner) and bob (branch-scoped manager).            |

## Realtime & notifications (Phase 11)

Phase 11 makes the operational surfaces LIVE. The governing design decision
(plan D3): **realtime drives INVALIDATION; the reads stay the only render
path**. A committed database write produces a Postgres change event; the
subscribed client's react-query keys are invalidated (coalesced over a
200 ms window); the next render refetches through the UNCHANGED authorized
RPC reads. No payload data is ever rendered — an event names what changed
(a table), never carries money/PII into the DOM — so "the kitchen queue in
realtime = the kitchen queue in REST" (FR-010) holds by construction.

Recovery (FR-004) is refetch-based, not replay-based: the channel's
SUBSCRIBED moment (first connect AND every reconnect) fires one
invalidation, which re-reads authoritative state and heals anything missed
while offline. The one deliberate exception is the US4 cue
(`useNewRoundCue`): it is event-DERIVED state with no recovery read (a
round committed while nobody watched needs no cue), so any test or
walkthrough that asserts the cue must wait for the channel's SUBSCRIBED
handshake before driving the write.

Authorization (FR-002) is server-side per-row: the `supabase_realtime`
publication carries the five event tables, and staff SELECT policies
(reusing `private.has_branch_role` VERBATIM — zero vocabulary drift) filter
delivery per subscriber; Realtime needs the SELECT grant to deliver even a
policy-filtered read (migration `20260921150000`), so `rounds`,
`kitchen_tickets`, and `sessions` carry a SELECT-only grant for
`authenticated` — writes stay RPC-only everywhere (Constitution IV), and
the zero-grant schema suites encode the narrowed contract. Customers get
NO subscription (research §3): their live-adjacent status is the 10 s poll

- mutation refetch through the unchanged reads.

| Suite                                    | Command             | Coverage                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/database/realtime.schema.test.ts` | `npm run test:db`   | The publication carries exactly the five tables; the policies exist with the exact `has_branch_role` predicates; RLS stays enabled; zero new write grants; the fail-closed direction (an unauthorized identity matches no policy row); dan reads real Marina rows through the policy (the 009 scratch-round chain).                     |
| `tests/unit/realtime.test.ts`            | `npm run test:unit` | The binding contracts with the channel mocked: the event → invalidator mapping per surface, the 200 ms coalescing window (N events → one invalidate), the SUBSCRIBED recovery refetch, the cleanup discipline, and the cue's set/clear cycle.                                                                                           |
| `e2e/realtime.test.ts`                   | `npm run test:e2e`  | Two-browser liveness: a customer submission from a second browser context appears in the open cashier dashboard without refresh; a round advanced in one staff browser moves the groups in another; the kitchen queue updates live and stays money-free; the cue renders after its SUBSCRIBED handshake and the reload path reconciles. |

## Troubleshooting

### Missing environment variables

Any tool that needs configuration exits with a message naming the missing
variable(s) and points to `.env.example` (see Setup step 5). The system never
continues silently misconfigured.

### Cloud project unreachable

Symptoms: connection timeouts or DNS errors in `db:migrate`, `db:seed`,
`test:db`, or `types:gen`.

- Check the Supabase Dashboard: the project must be active (not paused).
- Verify `VITE_SUPABASE_URL` / `SUPABASE_DB_URL` point at the right project.
- Verify network access to `*.supabase.co` — corporate proxies and VPNs are a
  common cause.
- Copy connection strings and pooler hosts from the Dashboard → Connect
  dialog — the pooler host's cluster index cannot be derived from the region.
- Authentication failures (rather than timeouts) when connecting usually mean
  special characters in the database password need percent-encoding inside
  `SUPABASE_DB_URL`.
- Database tests have the reachable cloud project as a documented
  precondition; on connectivity failure they exit with clear guidance rather
  than ambiguous connection errors.

### Database in a partially migrated or unknown state

`npm run db:reset` rebuilds the database from zero using only repository
artifacts (migrations + seed), restoring a known-good state. It is
destructive and intended for the development project only.

### Wrong Node version

The project requires Node 22 LTS or newer (`.nvmrc`). Use `nvm use` or
install the LTS release; `engines.node` in `package.json` documents the same
constraint.

## Data-layer workflow (canonical)

There is exactly **one** way to change the database (spec FR-010). Do not
edit the schema through the Supabase Dashboard, ad-hoc SQL, or any other
path — every schema change flows through version-controlled migrations:

1. Create a migration: `supabase migration new <name>`
   (creates `supabase/migrations/<timestamp>_<name>.sql`)
2. Write the SQL in the new migration file.
3. Apply it to the cloud development database: `npm run db:migrate`
4. Regenerate types: `npm run types:gen`
   (updates `src/types/database.types.ts`)
5. Commit the migration file **and** the regenerated types together.

To rebuild the development database from zero at any time, run
`npm run db:reset` — destructive, development project only, asks for
confirmation, and runs drop → migrate → seed using only repository
artifacts. Higher environments receive the same migration files through the
Supabase CLI, never manual dashboard edits.

### Seeded auth credentials (reset runbook)

The six seeded staff identities (`alice@restopilot.dev` …
`platform-admin@restopilot.dev` — the credentials table is in
[specs/003-auth-and-rbac/data-model.md](../specs/003-auth-and-rbac/data-model.md))
live in the platform-managed `auth` schema, which `db:reset` does not touch:
**auth identities survive ordinary resets** and the seed's profiles upsert
re-links them. A manually changed fixture password (for example after the
manual password-recovery validation) is therefore never restored by
`npm run db:reset` or `npm run db:seed` alone. Restore it with:

```bash
npm run db:reset -- --yes --purge-auth
```

`--purge-auth` additionally deletes every `@restopilot.dev` user from
`auth.users` after the schema drop and before migrate + seed, so the seed
re-provisions the identities with the documented dev passwords. Development
project only — never point it at a production database.

**Failure mode — seed aborts with a unique-email violation**: a stray user
already holds one of the seeded emails (a leftover from a manual experiment —
the seed's `on conflict (id) do nothing` cannot absorb a _different_ user id
with the same email). Fix: run `npm run db:reset -- --yes --purge-auth` (the
purge deletes every `@restopilot.dev` user whatever its id), which rebuilds
and re-seeds in one step.

### Platform configuration (auth)

Hosted auth settings are not migration-controlled. The two settings this
project requires are part of this same canonical workflow (spec 003 FR-023):
recorded here as explicit, verifiable steps — never applied ad hoc.

| #   | Setting                                            | Why                                                                                                                                                                                                               | Dashboard path                                                                                                              |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Allow new users to sign up** — off               | Public self-service sign-up is disabled (spec 003 FR-022): staff identities exist only through provisioning (the development seed now; the Phase 3 invitation flows later), and customers never receive accounts. | Dashboard → **Authentication** → **Sign In / Up** → _Email_ provider → toggle **Allow new users to sign up** off → **Save** |
| 2   | **Redirect URLs** — add `http://localhost:5173/**` | The dev origin that password-recovery links may redirect to (prerequisite of spec 003 FR-018 — `resetPasswordForEmail` targets `/reset-password` on this origin).                                                 | Dashboard → **Authentication** → **URL Configuration** → **Redirect URLs** → add `http://localhost:5173/**` → **Save**      |

Both settings are applied and verified on the development project
(2026-09-15). Re-verify at any time from the repository root:

```bash
npx supabase config diff
# remote auth.enable_signup must be false            (setting 1)
# remote auth.additional_redirect_urls must include
#   http://localhost:5173/**                        (setting 2)
```

A self-service sign-up attempt against the Auth API (`POST /auth/v1/signup`
with the publishable key) is rejected with `signup_disabled` — "Signups not
allowed for this instance". Security does not rest on the toggle: an
authenticated identity with no linked profile reads no staff data
(deny-by-default, spec 003 FR-005).

Changing any other hosted auth setting (SMTP, confirmations, rate limits, flow
type) is a platform-configuration change under this same workflow and must be
re-validated against
`specs/003-auth-and-rbac/contracts/supabase-auth-surface.md`.

## Branch reports (Phase 12)

Phase 12 adds read-only operational reporting (master plan §23) on top of the
captured substrate — no new engines, tables, or write paths:

- Migration `20260922090000_branch_reports.sql` ships two `security definer`
  RPCs: `get_branch_sales_report(restaurant, branch, period, anchor_date)`
  (day/week/month calendar buckets — Monday-start weeks via `date_trunc` —
  with rounds submitted/voided, net money over non-voided rounds, a
  three-channel breakdown with explicit zeros, and top-10 best sellers by
  captured quantity) and `get_branch_void_report(restaurant, branch, limit)`
  (the void ledger with who/when/why and the captured total). Reach is
  `private.has_branch_role` verbatim: owner restaurant-wide, manager their
  branch, cashier/kitchen/anon refused with the generic 42501.
- §23's anti-drift rule holds by construction: figures are derived at read
  time from `rounds` (captured money, void overlay) joined to `sessions`
  (channel). No materialized view, no summary table, no counters. The
  database tests reconcile every report figure against a hand derivation
  from the source rows (`tests/database/reports.calc.test.ts`).
- The void log is a filtered view of Phase 10's void overlay — NOT a second
  ledger. The client renders `get_branch_void_report`; the full action trail
  stays in `get_audit_log`.
- Surfaces: `/dashboard/reports` (owner picker + comparison, manager
  single-branch) and `/dashboard/voids`, gated to owner/manager in the
  navigation and the pages. Cashier/kitchen deep links render the denial
  (US4 absence, tested).
- Suites: `tests/database/reports.access.test.ts` (reach matrix),
  `tests/database/reports.calc.test.ts` (buckets, void overlay,
  reconciliation), `tests/unit/reports.test.ts` (client contract),
  `e2e/reports.surfaces.test.ts` (live journeys).
- Walkthrough: `node --env-file-if-exists=.env
scripts/run-reports-walkthroughs.mjs` — real sign-ins, a submitted round,
  a driven-and-voided round, and the reconciliation checks; restores
  deterministic state afterwards.
