# Implementation Plan: Restaurant and Branch Management (Phase 3)

**Branch**: `004-restaurant-and-branch-management` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-restaurant-and-branch-management/spec.md`, including the Clarifications of 2026-09-16 (editable public identifier with no aliases; owner-only management in this phase; cross-midnight working-hours intervals with same-day-only overlap rejection). The feature builds directly on feature 002 (tenancy schema, RLS conventions, private scope helpers, audit foundation, migration/seed workflow) and feature 003 (identity linkage, role-aware policies, `current_auth_context`, the live-verified identity provisioning contract). Backend remains **Supabase Cloud** (the Phase 0 owner directive: no local stack, no Docker). The spec's Assumptions defer one mechanism to this plan — staff invitations — resolved in [research.md](./research.md) §4–§5.

## Summary

Deliver the Phase 3 management layer on the existing tenancy foundation. The owner gains the full setup journey — create a restaurant (creator becomes owner; FR-001), maintain its profile and settings including the editable public identifier (FR-002…FR-004), create and rename branches (FR-007), maintain each branch's weekly working hours with post-midnight intervals and declarative overlap rejection (FR-008/FR-009), manage tables with explicit activation state (FR-010…FR-012), manage staff memberships end to end (FR-013…FR-016) — and obtains the restaurant-level QR entry artifact that encodes the public entry URL derived from the primary identifier (FR-018/FR-019). Every management action is owner-only (FR-006, per clarification) and enforced at the data layer (FR-005).

The implementation extends the existing schema rather than restating it: `restaurants` gains profile/settings columns, `dining_tables` gains `is_active`, and one new table `branch_working_hours` (with a `weekday` enum, generated minute offsets, and an exclusion constraint that makes same-day overlap impossible for every writer). All writes flow through **twelve `security definer` management RPCs** in `public` — no client write grants are added anywhere — each performing its own owner check through the existing `private` helper family, calling the existing `private.record_audit` in the same transaction (FR-020's first business records), and translating constraint violations into clear messages. Staff assignment (the spec-deferred mechanism) is one owner-invoked RPC that provisions the platform identity with the insert contract feature 003 verified live and returns a **server-generated one-time temporary credential** — no email, no service-role key, no Edge Function (SC-001's "one session, no operator intervention" holds; research.md §4).

The frontend extends the staff area: `/dashboard` now admits a linked profile with no memberships and offers restaurant creation (FR-001's bootstrap), and owner-only surfaces for the restaurant profile + QR, branches + working hours, and tables are added under `/dashboard`, with the staff page gaining owner-only management. All guards are presentation-only (Constitution IV). Validation is proven in four tiers — the rolled-back database matrix, a real-API integration round trip (provision → sign in → exact scope), unit tests for the QR payload and client error mapping, and a read-only browser matrix — with the full journey also walkable from the seeded fixture in under 15 minutes (quickstart.md).

## Technical Context

**Language/Version**: TypeScript (React 19, Vite) for the application; SQL (PostgreSQL 17.6 on the configured Supabase Cloud project) for schema, policies, and the management functions.

**Primary Dependencies**: Existing stack only, plus **one new runtime dependency**: `qrcode` (+ `@types/qrcode` dev) for the QR artifact (research.md §9). No other additions: `@supabase/supabase-js` (RPC calls), `@tanstack/react-query` (server state), `react-router` (routes), Supabase CLI (migrations, `gen types`), `pg` (tests), Vitest, Playwright, pgcrypto (used by the seed; the provisioning helper hashes with it) and `btree_gist` (enabled by migration for the working-hours exclusion constraint; Supabase-supported extension).

**Storage**: Supabase Cloud PostgreSQL on the configured development project: the existing `public`/`private` schemas plus one new table (`branch_working_hours`), one new enum (`weekday`), and new columns on `restaurants`/`dining_tables`. Supabase Auth is read/written through the verified identity-provisioning shape (runtime creation this phase; the seed remains a writer). No Storage, no Realtime (no table joins the publication), no new schemas.

**Testing**: Four tiers, all extending existing suites/harnesses: database tests (`tests/database/` — management RPCs exercised as simulated identities inside rolled-back transactions, identity-simulation harness unchanged); integration (`tests/integration/` — real Auth API sign-in of a person provisioned through the RPC, real data-API reads, scratch teardown); unit (`tests/unit/` — QR payload builder + client error mapping + guard matrix); e2e (`e2e/` — read-and-reject presentation matrix, no tenant writes; research.md §16). `npm run verify` remains the gate.

**Target Platform**: Supabase Cloud (region eu-west-1) + browser SPA (Vite dev server at `http://localhost:5173`); tests run from developer machines (Windows primary).

**Performance Goals**: Engineering guidance, not spec gates: every management operation is one RPC round trip; policy predicates keep the wrapped `(select …)` initPlan form (the new table's policy included); the working-hours exclusion constraint is the only new index overhead; the extended database and integration suites stay within the existing suite budgets.

**Constraints**: Supabase Cloud only (no local stack, no Docker); every schema change through the single canonical migration workflow (FR-024); **no new environment variables**; **no service-role or secret keys anywhere** (the provisioning path deliberately avoids them — research.md §4); no email is sent by the application; no client write grants (grants posture unchanged); route guards remain presentation-only; no deletion flows (restaurants, branches, tables, identities, profiles all persist); no new exposed schemas; the seed stays idempotent, deterministic, and converging.

**Scale/Scope**: Five migrations; one enum; one new table (+ policy, grant, RLS); five added columns across two tables; twelve public RPCs + one private provisioning helper; one new frontend feature module (3 modules + 3 components) and five route files (3 new, 2 extended) plus the `src/app/router.tsx` edit and two small auth-module edits; one new dependency; six new test files, one existing suite updated (`tenancy.schema.test.ts`) plus the shared fixtures helper and the guard matrix extended. Thirteen audit actions delivered. No menu/tax/session/ordering/kitchen/cashier/reporting/realtime/super-admin surface (spec Out of Scope).

All technical unknowns were resolved through the research phase — see [research.md](./research.md) for decisions, rationale, and rejected alternatives, including the staff-invitation mechanism the spec deferred to this plan.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Business Scope Integrity | **PASS** | Restaurant/branch/table/staff configuration and the restaurant-level QR are the approved ordering platform's own domains (master plan §6.2, §14). No payments, accounting, printing, or inventory — the QR encodes a URL, nothing financial. |
| II | Specifications Are the Source of Business Truth | **PASS** | Every design element traces to a spec FR (FR-001…FR-025) or a 2026-09-16 clarification (editable identifier without aliases; owner-only management; post-midnight intervals). The two choices the spec left open — the invitation mechanism and the QR derivation — are resolved within the spec's stated bounds (its Assumptions name "a temporary credential" as an allowed mechanism; the public entry route was fixed by feature 001) and recorded in research.md §4/§9. No business rule is invented. |
| III | Multi-Tenant Isolation | **PASS** | The pattern is extended, not weakened: the new table carries the composite tenant FK, the new columns inherit the existing scoped policies, no existing policy changes, no client write grants appear, and the management RPCs resolve scope exclusively through the helper family. Every RPC takes its target and derives the tenant from it before authorizing — cross-tenant targets are denials (`42501`). |
| IV | Server-Enforced Authorization | **PASS** | All twelve operations authorize inside `security definer` functions at the data layer (`private.owned_restaurant_ids`); guards, pages, and predicates are declared presentation-only. Direct data-API calls outside a caller's scope are denied the same way regardless of what the UI renders (FR-005 through every access path). |
| V | Database as the Source of Truth | **PASS** | Configuration (profile, settings, hours, table state, memberships) lives only in the database; the client caches are caches; the RPCs return the stored rows; nothing business-critical is computed or enforced client-side (the client's working-hours helpers are formatting only). |
| VI | Explicit State and Data Integrity | **PASS** | Declarative first: composite FKs, unique keys, blank/zero-length/minutes checks, the working-hours exclusion constraint (same-day overlap impossible in any write path), and the identity FK on provisioning. Cross-row invariants (last owner) are enforced in the serialized RPCs; multi-row operations are single transactions (all-or-nothing); repeat transitions are explicit no-ops. |
| VII | Auditability of Sensitive Operations | **PASS** | Every accepted configuration and access-control change produces exactly one append-only record through the existing `private.record_audit` with actor, action, resource, and tenant scope (branch scope where applicable) — FR-020's first business consumers. No client-readable audit path is added; the store remains write-only for clients (feature 002 posture). |
| VIII | Minimal and Intentional Complexity | **PASS** | One new table, one enum, one extension, twelve named operations, one new dependency, no new runtime, no new secrets, no new env vars, no triggers, no views, no realtime, no storage, no generic CRUD layer. Deletion, invitation emails, aliases, per-table QR, and management widening are each explicitly deferred to the features that own them. Every addition maps to a spec FR (Complexity Tracking — nothing to justify). |

**Post-design re-check (after research.md / data-model.md / contracts / quickstart)**: all eight principles still PASS. No gate violations; Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-restaurant-and-branch-management/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output — includes the staff-assignment mechanism decision
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── database-functions.md    # The 12 management RPCs + the private provisioning helper
│   ├── management-client.md     # App module, route surface, guard/predicate rules, required flows
│   └── qr-entry-point.md        # Entry URL derivation + QR artifact contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (unchanged by this command)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

Contracts: this project exposes external interfaces on two sides — the data-API surface (the management RPCs and the one new read policy, consumed by the SPA and by any direct data-API call) and the customer-facing artifact (the QR payload). Both are contracted, matching the shape used by features 002 and 003.

### Source Code (repository root — changes for this feature)

```text
/
├── src/
│   ├── app/
│   │   └── router.tsx                     # CHANGED: /dashboard guard → RequireProfile; new /dashboard/restaurant,
│   │                                      #          /dashboard/branches, /dashboard/branches/:branchId
│   ├── features/
│   │   ├── auth/
│   │   │   ├── guards.tsx                 # CHANGED: adds RequireProfile (linked profile)
│   │   │   └── useAuthContext.ts          # CHANGED: adds canManageRestaurant(restaurantId) (owner predicate)
│   │   └── management/                    # NEW feature module (contracts/management-client.md)
│   │       ├── managementClient.ts        # typed wrappers over the 12 RPCs; error mapping (42501/P0001)
│   │       ├── workingHours.ts            # weekday labels/order, HH:MM normalization, closesNextDay, editor ⇄ row conversions
│   │       ├── qrEntry.ts                 # buildRestaurantEntryUrl + SVG/PNG artifact generation (contracts/qr-entry-point.md)
│   │       └── components/
│   │           ├── RestaurantQrPanel.tsx  # QR display (payload text) + downloads
│   │           ├── WorkingHoursEditor.tsx # weekly schedule editor (server-authoritative validation)
│   │           └── StaffManagementPanel.tsx # owner-only add/change/remove + one-time credential display
│   ├── routes/
│   │   ├── DashboardPage.tsx              # EXTENDED: create-restaurant panel for membership-less profiles (FR-001);
│   │   │                                  #           owner management navigation; branch links per scope
│   │   ├── StaffListPage.tsx              # EXTENDED: owner-only StaffManagementPanel on the existing read surface (FR-025 preserved)
│   │   ├── ManageRestaurantPage.tsx       # NEW: profile (incl. FR-004 warning flow) + settings + QR (owner-only in-page)
│   │   ├── BranchesPage.tsx               # NEW: policy-scoped list; owner-only create/rename
│   │   └── BranchDetailPage.tsx           # NEW: branch view — working hours + tables; owner-only editing
│   └── types/
│       └── database.types.ts              # REGENERATED (npm run types:gen) — added columns, weekday enum, new table, 12 functions
├── supabase/
│   ├── migrations/
│   │   ├── … (eight existing migrations unchanged)
│   │   ├── <ts>_restaurant_settings.sql       # NEW: restaurants profile/settings columns; blank checks (name/timezone/branches.name)
│   │   ├── <ts>_dining_table_activation.sql   # NEW: dining_tables.is_active
│   │   ├── <ts>_branch_working_hours.sql      # NEW: weekday enum; btree_gist; branch_working_hours
│   │   │                                      #      (checks, generated minute offsets, EXCLUDE, indexes);
│   │   │                                      #      RLS enable; select grant; policy branch_working_hours_staff_select
│   │   ├── <ts>_management_rpcs.sql           # NEW: create_restaurant, update_restaurant_profile, update_restaurant_settings,
│   │   │                                      #      create_branch, rename_branch, replace_branch_working_hours,
│   │   │                                      #      create_dining_table, rename_dining_table, set_dining_table_active (+ grants)
│   │   └── <ts>_staff_management_rpcs.sql     # NEW: private.provision_staff_identity; add_staff_member,
│   │                                          #      update_staff_membership, remove_staff_membership (+ grants)
│   └── seed.sql                           # EXTENDED: restaurant profile/settings values (converging do-update for new columns),
│                                          #           working-hours fixture (split day, 18:00–02:00, closed day, boundary pair),
│                                          #           Marina T1 inactive, Fiona (linked profile, no memberships)
├── scripts/
│   └── db/
│       └── seed.mjs                       # EXTENDED: working-hours count in the summary
├── tests/
│   ├── database/
│   │   ├── helpers/fixtures.ts            # EXTENDED: Fiona, working-hours ids/values, new column values, dev credential
│   │   ├── tenancy.schema.test.ts         # UPDATED: declared column shapes (restaurants, dining_tables)
│   │   ├── management.rpc.test.ts         # NEW: configuration RPC matrix — schema/constraint guarantees, authorization,
│   │   │                                  #      validation, audit, working-hours semantics, idempotent transitions, isolation
│   │   └── staff.management.test.ts       # NEW: staff RPC matrix — provisioning/linking, credential issuance, role/branch rules,
│   │                                      #      last-owner safeguard, removal persisting the person, audit, isolation
│   ├── integration/
│   │   └── management.provisioning.test.ts # NEW: real-API round trip — owner provisions via RPC, temporary credential signs in,
│   │                                       #      current_auth_context matches the scope, out-of-scope reads denied; scratch teardown
│   ├── unit/
│   │   ├── management.qr.test.ts          # NEW: entry-URL derivation + artifact generation
│   │   ├── management.client.test.ts      # NEW: RPC wrapper error mapping and result shaping
│   │   └── auth.guards.test.tsx           # UPDATED: RequireProfile cases, canManageRestaurant truth table, bootstrap panel
│   └── setup-env.ts                       # unchanged
├── e2e/
│   └── management.surfaces.test.ts        # NEW: owner surfaces + QR payload text; FR-004 warning before confirm; working-hours
│                                          #      rejection message; branch-manager own-branch view; non-owner/super-admin denials
│                                          #      (read-and-reject only — no tenant writes)
├── docs/
│   └── development.md                     # EXTENDED: management suites, the provisioning + one-time-credential runbook step,
│                                          #           the no-write e2e rule
└── package.json                           # CHANGED: dependencies += qrcode; devDependencies += @types/qrcode (no new scripts;
                                           #          verify unchanged, now covering the extended suites)
```

**Structure Decision**: No new top-level directories. Database work extends the feature 002/003 layout (`supabase/migrations/`, `seed.sql`); the frontend work lands in the feature-module convention (`src/features/management/`, first business feature module) with pages in `src/routes/`; tests extend the established four tiers. The `weekday` enum, the new table, the extension, and the RPCs are database constructs (no repository directories).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None. No Constitution violations were identified; no complexity requires justification. The additions that carry machinery — the exclusion-constraint pattern (one extension, one generated-column pair) and the database-side identity provisioning (one private helper) — are each the minimal documented mechanism for FR-008's declarative overlap rule and FR-013/FR-014's account creation within the spec's constraints (no email dependency, no service-role secret, atomic multi-row writes), with alternatives evaluated and rejected in [research.md](./research.md) §2 and §4.
