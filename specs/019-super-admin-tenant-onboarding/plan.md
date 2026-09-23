# Implementation Plan: Super-Admin Tenant Onboarding

**Branch**: `019-super-admin-tenant-onboarding` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-super-admin-tenant-onboarding/spec.md`

## Summary

The platform super admin provisions a new restaurant and its first owner in
one indivisible action from the platform console. The implementation
composes existing server-side primitives under one new guarded RPC — the
tenant-creation validation (one rulebook, extracted so both creation
surfaces share it), the staff-identity provisioning helper (new person /
stub completion / linkage, verbatim), the owner membership, the
subscription row (`never_activated`), and the platform audit entry. The
super-admin flag gains no standing reads (FR-008b); the client adds an
onboarding form + one-time credential display to the console, reusing the
staff panel's issued-credential pattern.

## Technical Context

**Language/Version**: TypeScript 6.0 (React 19, Vite 8) for the client; PL/pgSQL (Supabase Postgres, migrations only) for the trusted layer

**Primary Dependencies**: @supabase/supabase-js 2.116, @tanstack/react-query 5, react-router 7; wrangler (deploy-time only, Phase 17)

**Storage**: Supabase Postgres — existing tables only (`restaurants`, `staff_memberships`, `subscriptions`, `profiles`, `auth.users`, `audit_log`); **no schema changes**

**Testing**: Vitest (unit + database, rolled-back transactions via `runAs`/`asUser`), Playwright (e2e); `npm run verify` gate

**Target Platform**: Web (Cloudflare Pages per Phase 17 contract) + Supabase cloud project

**Project Type**: SPA + database-authoritative backend (RLS + security definer RPCs)

**Performance Goals**: None beyond standing gates — onboarding is a rare, operator-initiated action

**Constraints**: generic refusals with verbatim messages (009 posture); all-or-nothing (VI); no privileged credentials beyond the one-time owner credential pattern (004 §assumptions); audit on every action (VII)

**Scale/Scope**: one new RPC + one extracted private validation helper + console form section; ~3 test suites

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Business Scope Integrity** — a platform-administration capability requested by the owner; no new product scope for tenants. ✅
- **II. Specifications Are the Source of Business Truth** — every behavior maps to FR-001…FR-010; clarifications recorded in the spec. ✅
- **III. Multi-Tenant Isolation** — the first owner is scoped to the new restaurant exactly as any owner; the standing isolation suites re-prove against onboarded tenants (SC-005). ✅
- **IV. Server-Enforced Authorization** — the new RPC re-verifies `private.is_super_admin_profile` on every call; the console form is presentation only. ✅
- **V. Database as the Source of Truth** — restaurant + membership + subscription + audit rows land in one transaction; no client-side state. ✅
- **VI. Explicit State and Data Integrity** — `never_activated` default; all-or-nothing refusal (FR-004); constraint-name-caught races re-raised verbatim. ✅
- **VII. Auditability** — one audit row per onboarding, actor = the acting super admin (FR-006). ✅
- **VIII. Minimal and Intentional Complexity** — one RPC, one extracted helper (removes duplication rather than adding), one console section; no new tables, no new roles. ✅

**Post-design re-check**: the Phase 1 contracts below add no schema and no
new reach — the gate holds. The only code touched outside the new RPC is
`create_restaurant`'s validation, which is *extracted into* the shared
helper (a refactor the standing management + security suites protect).

## Project Structure

### Documentation (this feature)

```text
specs/019-super-admin-tenant-onboarding/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions & rationale
├── data-model.md        # Phase 1 output — entities touched (no schema changes)
├── quickstart.md        # Phase 1 output — validation guide
├── contracts/
│   └── database-functions.md   # Phase 1 output — the new RPC + helper contract
└── tasks.md             # Phase 2 output ($speckit-tasks; NOT created here)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20260923XXXXXX_platform_onboarding.sql   # new RPC + extracted validation helper
                                             # + create_restaurant refactor + idempotent
                                             # subscription backfill (FR-008a)

src/features/platform/
├── platformClient.ts    # onboardRestaurant() — RPC call + error mapping
├── usePlatform.ts       # useOnboardRestaurant() — invalidates the overview key
└── components/
    └── OnboardingPanel.tsx  # form + one-time credential display (IssuedCredential pattern)

src/routes/
└── PlatformConsolePage.tsx  # mounts OnboardingPanel above the overview table

tests/database/
└── platform.onboarding.test.ts   # reach matrix, all-or-nothing, audit, post-reach

tests/unit/
└── platform.test.ts              # client-module mapping extensions

e2e/
└── platform.surfaces.test.ts     # onboarding walkthrough extension
```

**Structure Decision**: the feature lands in the existing platform module
(`src/features/platform/`, the 014 home) and its route
(`PlatformConsolePage.tsx`), with one migration and one db test file. No
new modules, routes, or directories.

## Complexity Tracking

> No violations — the table stays empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
