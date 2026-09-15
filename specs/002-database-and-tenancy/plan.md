# Implementation Plan: Database and Multi-Tenancy (Phase 1)

**Branch**: `002-database-and-tenancy` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-database-and-tenancy/spec.md`, including the clarifications of 2026-09-15 (multi-membership allowed; super-admin modeled only; security tests use simulated staff identities). Backend environment remains **Supabase Cloud** per the Phase 0 owner directive — no local Supabase/PostgreSQL, no Docker; the Supabase CLI is used only for source-controlled migrations, type generation, and synchronization against the configured cloud project.

## Summary

Build the authoritative tenancy data layer on the configured Supabase Cloud project (spec Stories 1–4): `restaurants`, `branches`, `profiles`, `staff_memberships` (with a `staff_role` enum), and `dining_tables` in the `public` schema, plus an append-only `audit_log` foundation. Every tenant-owned row carries a denormalized `restaurant_id` (and `branch_id` where branch-scoped), with composite foreign keys `(restaurant_id, branch_id) → branches(restaurant_id, id)` making cross-tenant references structurally impossible. Tenant isolation is enforced at the database by the combination of grants and row-level-security policies: all privileges revoked from `anon` and `authenticated`, select-only granted to `authenticated`, and scope-limited select policies built on `security definer` scope-resolution functions in a non-exposed `private` schema. An automated database-level security suite proves the master plan §12 test matrix (cross-restaurant, cross-branch, bypass, direct access) by simulating staff identities inside rolled-back transactions via `set local role authenticated` + `request.jwt.claims` — a pattern verified empirically against the cloud project during research. The development seed grows to a deterministic two-restaurant fixture (three branches, six profiles covering every role, a cross-restaurant multi-membership, and a modeled-only super admin), and the full layer rebuilds from zero through the existing Phase 0 migration/reset workflow.

No authentication flows, role-permission matrix, management UI, business-domain schema (menu/tax/ordering/kitchen), or realtime is included (spec Out of Scope).

## Technical Context

**Language/Version**: SQL (PostgreSQL 17 on Supabase Cloud — confirmed live version 17.6) for schema, policies, and functions; TypeScript for test code. No new runtime dependencies.

**Primary Dependencies**: Existing stack only — Supabase CLI (migrations, `db push`, `gen types`), `pg` (database tests), Vitest. The frontend application is untouched by this feature.

**Storage**: Supabase Cloud PostgreSQL on the configured development project. Two schemas: `public` (tenant tables, exposed via the data API behind RLS) and a new `private` schema (security-definer helper functions — never exposed via the API; per official Supabase guidance a security-definer function must not live in an exposed schema). Supabase Auth/Storage/Realtime are not used in Phase 1; no table is added to the realtime publication.

**Testing**: Vitest + `pg` against the cloud development database (`tests/database/`), extending the Phase 0 pattern. Security tests simulate acting identities inside transactions (`begin` → `set local role authenticated` → `set_config('request.jwt.claims', …)` → assertions → `rollback`), so the shared development database is never left with test residue. Constraint/integrity tests run as the table owner in rolled-back transactions. No pgTAP / `supabase test db` (requires the local stack — rejected by the cloud-only directive).

**Target Platform**: Supabase Cloud PostgreSQL (region eu-west-1); tests run from developer machines (Windows primary).

**Project Type**: Web application (data layer only in this feature).

**Performance Goals**: Engineering guidance, not spec gates: policy scope functions wrapped in scalar subqueries (`(select …)` initPlan form) and indexes on `restaurant_id`/`branch_id`/`profile_id` so policies evaluate per statement, not per row; database test suite completes in under 2 minutes against the cloud project.

**Constraints**: Supabase Cloud only (no local stack, no Docker, no `supabase start`); exactly one canonical migration workflow — every schema change flows through `supabase migration new` + `npm run db:migrate` (spec FR-017, feature 001 FR-010); no UI changes; no new environment variables or secrets; no service-role credentials anywhere; seed must be idempotent and deterministic; the `private` schema must never appear in the project's exposed API schemas.

**Scale/Scope**: Six new tables, one enum, four database functions, three migrations, one seed extension, ~40 database tests. Two seeded restaurants. No frontend work.

All technical unknowns were resolved through the research phase — see [research.md](./research.md) for decisions, rationale, rejected alternatives, and the live verification results.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Business Scope Integrity | **PASS** | Tenancy and audit are the approved ordering platform's own domains (master plan §6.1/§6.7). No payments, accounting, printing, or inventory. |
| II | Specifications Are the Source of Business Truth | **PASS** | Every design element traces to a spec FR or a 2026-09-15 clarification (multi-membership, super-admin modeled-only, simulated test identities). No business rule is invented here. |
| III | Multi-Tenant Isolation | **PASS** | This phase *is* the isolation foundation: RLS enabled on every new table, grants revoked from client roles, scope-limited policies, composite FKs making cross-tenant references structurally impossible, and an automated suite proving the §12 matrix. |
| IV | Server-Enforced Authorization | **PASS** | All enforcement lives in the database (grants + policies + constraints), which — per the Supabase model — is the same boundary the data API enforces. No frontend involvement exists or is assumed. |
| V | Database as the Source of Truth | **PASS** | The database is the sole authoritative store for tenancy state; no client-side state is introduced. |
| VI | Explicit State and Data Integrity | **PASS** | Integrity is declarative: primary/unique keys, check constraints, single-column FKs, and composite tenant FKs. Invalid references and duplicate memberships are rejected by the database, not by application code. No state machines exist yet (static configuration data + append-only audit). |
| VII | Auditability of Sensitive Operations | **PASS** | Append-only `audit_log` with required-context validation (actor, action, resource, scope) enforced inside a security-definer writer; no client-accessible read/modify/delete path exists (no grants, no policies). |
| VIII | Minimal and Intentional Complexity | **PASS** | Select-only grants to client roles (all write paths deferred to the features that own them); one enum; five core tables + audit; helpers in a single `private` schema; no triggers, no views, no realtime, no UI, no new dependencies. Every addition maps to a spec FR (see Complexity Tracking — no violations to justify). |

**Post-design re-check (after research.md / data-model.md / contracts / quickstart)**: all eight principles still PASS. No gate violations; Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-database-and-tenancy/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output ($speckit-plan command)
├── data-model.md        # Phase 1 output ($speckit-plan command)
├── quickstart.md        # Phase 1 output ($speckit-plan command)
├── contracts/
│   └── database-functions.md  # Scope-resolution + audit-writer contracts
├── checklists/          # Spec quality checklist ($speckit-checklist inputs)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

Contracts: limited to the database-function surface — the durable internal interface that Phase 2+ (RBAC policies, management features, audit-writing operations) builds on. No HTTP/API contracts exist in Phase 1 (no Edge Functions, no new client operations).

### Source Code (repository root — changes for this feature)

```text
/
├── src/
│   └── types/
│       └── database.types.ts    # REGENERATED (npm run types:gen) — now includes tenancy tables + staff_role enum
├── supabase/
│   ├── migrations/
│   │   ├── 20260915085516_app_meta.sql                              # unchanged (Phase 0)
│   │   ├── 20260915100723_app_meta_revoke_client_grants.sql         # unchanged (Phase 0)
│   │   ├── <timestamp>_tenancy_core.sql        # NEW: enum + restaurants/branches/profiles/staff_memberships/dining_tables
│   │   ├── <timestamp>_tenancy_rls.sql         # NEW: private schema, scope helpers, grants, RLS policies
│   │   └── <timestamp>_audit_foundation.sql    # NEW: audit_log + private.record_audit + grants
│   └── seed.sql                                # EXTENDED: deterministic two-restaurant tenancy fixture
├── tests/
│   ├── database/
│   │   ├── app_meta.test.ts        # unchanged (Phase 0)
│   │   ├── helpers/
│   │   │   ├── db.ts               # NEW: shared client + transaction-scoped identity simulation
│   │   │   └── fixtures.ts         # NEW: seed fixture IDs (deterministic UUIDs)
│   │   ├── tenancy.schema.test.ts  # NEW: structure, constraints, ownership paths
│   │   ├── tenancy.rls.test.ts     # NEW: isolation matrix (anon/owner/branch-staff/multi-member/super-admin)
│   │   └── audit.test.ts           # NEW: audit writer contract + append-only posture
│   └── unit/                       # unchanged
├── docs/
│   └── development.md              # small addition: database security-test suite section
└── package.json                    # unchanged (no new scripts or dependencies)
```

**Structure Decision**: No new top-level directories. All Phase 1 work lands in the Phase 0 layout: migrations under `supabase/migrations/`, shared test helpers under `tests/database/helpers/`, regenerated types in `src/types/`. The new `private` schema is a database-level construct (not a repository directory) created by the RLS migration.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None. No Constitution violations were identified; no complexity requires justification. The only design choices that add machinery beyond the bare tables — the `private` schema, the security-definer scope functions, and the composite tenant FKs — are each the documented Supabase/Postgres mechanism required by spec FR-006/FR-007/FR-009/FR-010, with simpler alternatives evaluated and rejected in [research.md](./research.md).
