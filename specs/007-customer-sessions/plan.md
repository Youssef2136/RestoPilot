# Implementation Plan: Customer Access and Sessions (Phase 6)

**Branch**: `007-customer-sessions` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-customer-sessions/spec.md`, including the Clarifications of 2026-09-19 (no working-hours gating — hours informational; cashier joins owner/manager in closing sessions; participant PII retained indefinitely; minimal persistent session indicator after entry). The feature builds directly on feature 002 (tenancy schema, the append-only audit foundation, `private.record_audit`), feature 003 (the staff role/scope model and the private helper family), feature 004 (branches and dining tables with their activation state), feature 005 (the branch menu and its read function), and feature 006 (the tax engine — untouched here, structurally respected). Backend remains **Supabase Cloud** (Phase 0 owner directive: no local stack, no Docker).

## Summary

Deliver the Phase 6 customer entry and session model on the established foundation. A customer opens a restaurant's public route (resolved by its existing `slug`), selects a branch when needed, selects an active dine-in table, submits a display name and phone, and receives a **session context plus an unguessable access token**. The first valid entry at a table without an open session opens exactly one OPEN session (data-layer uniqueness makes simultaneous entries produce one session); later entries at that table join it as participants, each entry issuing its own token. Session-scoped customer operations (recover context, read the branch menu) verify the token server-side against its stored SHA-256 hash; staff read their branch's open sessions and close them (owner/branch manager/cashier, own branch only) through the established definer-RPC pattern, with the close audited. There is no timeout; a closed session is terminal; the tables are invisible to every client role — the RPCs are the entire surface.

## Technical Context

**Language/Version**: TypeScript (React 19, Vite) for the application; SQL (PostgreSQL 17.6 on the configured Supabase Cloud project) for schema, policies, and functions — the same split as features 004–006.

**Primary Dependencies**: **No new runtime dependency.** Tokens are generated server-side with `pgcrypto.gen_random_bytes` (in place since feature 002) and stored as SHA-256 hashes (`digest()`); the client persists only the issued token string in `localStorage` under a documented key. `@supabase/supabase-js`, `@tanstack/react-query`, `react-router`, Supabase CLI, `pg`, Vitest, Playwright are all in place.

**Storage**: Supabase Cloud PostgreSQL: the existing `public`/`private` schemas plus three new tables (`sessions`, `session_participants`, `session_tokens`). **No grants on any of the three tables to any client role** — `anon` and `authenticated` get zero table access; every read and write flows through `security definer` RPCs (PII posture: names and phones are never directly row-readable). No new schemas, no columns on existing tables, no changes to any existing policy or grant, no storage buckets, Supabase Realtime stays off.

**Testing**: The established four tiers, extended not replaced: database (`tests/database/` — the session RPC matrix including the concurrency and abuse suites, in rolled-back transactions); unit (`tests/unit/` — client token storage, payload parsing, error mapping); integration (`tests/integration/` — the real-API customer journey: enter → recover → menu → staff close → recovery refusal); e2e (`e2e/` — the browser entry flow on public routes, staff oversight denials). `npm run verify` remains the gate (unchanged scripts).

**Target Platform**: Supabase Cloud (region eu-west-1) + browser SPA (Vite dev server at `http://localhost:5173`); tests run from developer machines (Windows primary).

**Performance Goals**: Engineering guidance, not spec gates: token verification is one indexed lookup on a unique hash; entry is one RPC round trip; the customer menu read reuses feature 005's menu payload assembly inside a definer wrapper — one round trip; the staff list is one RPC. No new index on any existing table.

**Constraints**: Supabase Cloud only (no local stack, no Docker); every schema change through the single canonical migration workflow; **no new environment variables**; **no service-role or secret keys anywhere**; **no new npm dependency**; **zero client grants on the session tables**; guards and predicates presentation-only (Constitution IV); no payment, accounting, customer accounts, notifications, or dynamic QR anywhere (Constitution I; spec Out of Scope); no anonymous sign-ins — the hosted project has the provider disabled and the token mechanism deliberately avoids needing it (research.md §1).

**Scale/Scope**: Two migrations (`<ts>_session_schema.sql`, `<ts>_session_rpcs.sql`); three tables; seven RPCs (four customer/public, two staff, one shared internal helper — exact split in contracts/database-functions.md); one new frontend feature module (`src/features/session/`: client + hooks + 3 components) and three route files plus small edits (router, dashboard); fixture and seed extensions. No carts, rounds, kitchen tickets, notifications, payment, or account surfaces (spec Out of Scope).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Business Scope Integrity | **PASS** | Sessions are the order-collection layer's own container (master plan §17, §6.5, §7.3). No payment, accounting, invoice, inventory, notification, or customer-account concept: participants carry display-only identity, no credential (FR-015; spec Out of Scope). |
| II | Specifications Are the Source of Business Truth | **PASS** | Every element traces to a spec FR (FR-001…FR-023) or a 2026-09-19 clarification. The bounds the spec deferred to the plan (name length, phone shape, token form, RPC names, the exact uniqueness rule) are fixed in research.md within the spec's stated requirements. |
| III | Multi-Tenant Isolation | **PASS** | All three tables carry the composite tenant FKs per the feature 002 pattern; every RPC authorizes restaurant/branch scope explicitly inside the function; staff surfaces use the existing private helper family; customer surfaces authorize by token → session → (restaurant, branch, table) binding. No existing policy or grant changes. |
| IV | Server-Enforced Authorization | **PASS** | The three session tables receive **zero client grants** — `anon` and `authenticated` alike; every operation is a `security definer` RPC that authorizes as its first act (token check or staff scope check) and `42501`/`P0001`s otherwise. Guards and pages are presentation-only. Customer PII is never directly row-readable. |
| V | Database as the Source of Truth | **PASS** | Session state, participants, and tokens live only in the database; the client's `localStorage` holds only the access token for recovery (the spec's device-persisted reference) and never authoritative session state — every render reads through the RPCs. |
| VI | Explicit State and Data Integrity | **PASS** | Declarative first: `status` check constraint (`open`/`closed`), the partial unique index enforcing at most one open session per table, composite FKs to `(restaurant, branch, table)`. Lifecycle rules (open/join/close, no timeout, closed-is-terminal) are enforced in serialized definer RPCs; each operation is one transaction; closing a closed session is an explicit no-op error path. |
| VII | Auditability of Sensitive Operations | **PASS** | The staff close produces exactly one append-only record through `private.record_audit` with actor, action, resource, change, and tenant/branch scope (FR-018). Customer open/join events are traceable through the timestamped session/participant rows themselves (FR-018's clarified posture — the actor is not an authenticated identity). No client-readable audit path is added. |
| VIII | Minimal and Intentional Complexity | **PASS** | Three tables, seven functions, **zero new dependencies**, no triggers, no views, no realtime, no storage, no new columns on existing tables. Rejected for being larger than the requirement: Supabase anonymous sign-ins (a real auth.users row per customer device), a per-device session-identity table, token rotation/refresh machinery, and separate dine-in/takeaway/delivery flows (research.md §1, §4). |

**Post-design re-check (after research.md / data-model.md / contracts / quickstart)**: all eight principles still PASS. No gate violations; Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-customer-sessions/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── database-functions.md    # The 7 RPCs (customer, public, staff) + grant posture
│   └── session-client.md        # App module, routes, token storage rules, guard rules
├── checklists/
│   └── requirements.md  # Spec quality checklist (all [x]; re-validated post-clarify)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

Contracts: this project exposes external interfaces on the data-API surface (the seven functions, consumed by the SPA's customer and staff sides and by any direct data-API call) — contracted, matching features 002–006. No Storage surface exists (no files), so there is no storage contract.

### Source Code (repository root — changes for this feature)

```text
/
├── src/
│   ├── app/
│   │   └── router.tsx                     # CHANGED: public /r/:slug customer routes +
│   │                                      #          /dashboard/sessions (staff oversight)
│   ├── features/
│   │   ├── auth/
│   │   │   └── useAuthContext.ts          # CHANGED: adds canViewSessions(branchId) and
│   │   │                                  #          canCloseSession(branchId) predicates (presentation-only)
│   │   └── session/                       # NEW feature module (contracts/session-client.md)
│   │       ├── sessionClient.ts           # typed wrappers over the 7 RPCs; 42501/P0001 mapping;
│   │       │                              # token storage (localStorage key), payload parsing
│   │       ├── useSession.ts              # react-query hooks: public restaurant read, entry,
│   │       │                              # recovery, session menu, staff list/close + invalidation
│   │       └── components/
│   │           ├── RestaurantEntry.tsx    # public page: branch → table → name/phone form
│   │           ├── SessionIndicator.tsx   # the minimal persistent indicator (restaurant/branch/table)
│   │           └── BranchSessionsPanel.tsx# staff oversight: open sessions + close action
│   ├── routes/
│   │   ├── RestaurantPublicPage.tsx       # NEW: /r/:slug — entry flow (customer, no auth)
│   │   ├── CustomerMenuPage.tsx           # NEW: /r/:slug/menu — menu browse + session indicator
│   │   ├── StaffSessionsPage.tsx          # NEW: /dashboard/sessions — branch oversight + close
│   │   ├── DashboardPage.tsx              # EXTENDED: staff "Sessions" navigation entry
│   │   └── BranchDetailPage.tsx           # EXTENDED: link to the branch's sessions view
│   └── types/
│       └── database.types.ts              # REGENERATED (npm run types:gen) — 3 tables, 7 functions
├── supabase/
│   ├── migrations/
│   │   ├── … (twenty-three existing migrations unchanged)
│   │   ├── <ts>_session_schema.sql        # NEW: 3 tables, constraints, indexes, RLS enable, revokes
│   │   └── <ts>_session_rpcs.sql          # NEW: 7 RPCs + grants (anon + authenticated execute)
│   └── seed.sql                           # EXTENDED: demo open sessions + participants + documented dev tokens
├── scripts/
│   └── db/
│       └── seed.mjs                       # EXTENDED: session counts in the summary
├── tests/
│   ├── database/
│   │   ├── helpers/fixtures.ts            # EXTENDED: session ids, table bindings, dev tokens
│   │   ├── session.schema.test.ts         # NEW: declared shapes, constraints, the open-per-table
│   │   │                                  #      partial unique index, zero-grant posture
│   │   └── session.rpc.test.ts            # NEW: the 7-function matrix — entry validation,
│   │                                      #      open/join concurrency, token abuse, staff scoping,
│   │                                      #      close audit, no-timeout, terminal-closed
│   ├── integration/
│   │   └── session.journey.test.ts        # NEW: real-API journey — enter → recover → menu →
│   │                                      #      staff close → recovery refused
│   └── unit/
│       └── session.client.test.ts         # NEW: token storage rules, payload parsing, error mapping
├── e2e/
│   └── session.surfaces.test.ts           # NEW: public entry flow in the browser, session indicator,
│                                          #      staff oversight denials (read-and-reject)
└── docs/
    └── development.md                     # EXTENDED: the Phase 6 suites
```

**Structure Decision**: No new top-level directories. Database work extends the `supabase/migrations/` + `seed.sql` layout; the frontend lands in the feature-module convention (`src/features/session/`) with pages in `src/routes/`; the customer routes live under the public `/r/:slug` path (no dashboard chrome); tests extend the established four tiers. No storage surface exists in this phase.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None. No Constitution violations were identified; no complexity requires justification. The additions that carry machinery — the token-hash table with its unique index, the open-per-table partial unique index, and the zero-grant/RPC-only posture — are each the minimal documented mechanism for FR-011/FR-012 (an unguessable, server-verified, session-bound access mechanism), FR-005/FR-007 (one open session per table under concurrency), and FR-020 (every protected operation validated at the trusted data layer), with alternatives evaluated and rejected in [research.md](./research.md) §1, §4, §5.
