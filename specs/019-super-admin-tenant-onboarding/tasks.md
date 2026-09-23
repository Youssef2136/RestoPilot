# Tasks: Super-Admin Tenant Onboarding

**Feature**: [spec.md](spec.md) · [plan.md](plan.md) · Created 2026-09-23

**Prerequisites**: plan.md, research.md, data-model.md, contracts/database-functions.md, quickstart.md — all complete.

## 1. Trusted layer (migration — the indivisible action)

- [ ] T001 Migration `supabase/migrations/20260923XXXXXX_platform_onboarding.sql`
      — §1 the extracted `private.validate_tenant_inputs` helper (verbatim
      rules/messages from `create_restaurant`) + `create_restaurant`
      rewritten to call it, behavior-identical otherwise (FR-005, FR-008)
- [ ] T002 §2 `public.onboard_restaurant` per
      [contracts/database-functions.md](contracts/database-functions.md):
      super-admin guard → shared validation → insert restaurant →
      `private.provision_staff_identity` → owner membership → subscription
      row (`never_activated`) → audit row (`platform.restaurant_onboarded`,
      outcome in reason); constraint-name-caught refusals verbatim;
      grants `authenticated` only, revoked from public/anon (FR-001…FR-007,
      FR-008a, FR-010)
- [ ] T003 §3 the idempotent subscription backfill (`insert … select … on
      conflict do nothing`) so pre-existing bootstrap tenants appear in
      the console join (FR-008a/R3)

## 2. Database proofs (tests/database/platform.onboarding.test.ts)

- [ ] T004 Reach matrix: super admin onboards successfully; owner
      (alice), branch manager (bob), cashier (carla), kitchen (dan),
      plain member (eve), membership-free creation bootstrap (fiona),
      and anon each refused with the console 42501 denial (FR-010)
- [ ] T005 The three provisioning cases: new person (credential issued,
      person_created), unclaimed stub (credential re-issued, profile
      created), known person (linked, `temporary_password` null); plus
      the dual-role edge case — the first-owner email belonging to the
      super admin themselves links that identity as owner (spec edge
      case); each onboarding lands the owner membership + subscription
      row + audit row with the right outcome reason (FR-002, FR-003,
      FR-007, FR-008a, FR-006)
- [ ] T006 All-or-nothing: slug conflict, malformed identifier, unknown
      timezone, and duplicate-email race each refuse verbatim AND leave
      zero restaurants/memberships/subscriptions/audit rows behind
      (FR-004); the audit entry carries the acting super admin as actor
- [ ] T007 Post-onboarding reach: the new owner passes the standing
      owner-reach queries for their restaurant only (staff list, audit
      read, subscription read); the platform admin is refused the tenant
      audit read and every tenant operational surface; ordering from the
      onboarded tenant succeeds while `never_activated` (FR-008b, SC-005)

## 3. Client surface (console)

- [ ] T008 `src/features/platform/platformClient.ts` —
      `onboardRestaurant()` + the `OnboardedTenant` payload type, using
      the module's error mapping (verbatim P0001 messages, 42501 denial);
      `usePlatform.ts` — `useOnboardRestaurant()` invalidating
      `platformOverviewKey()` (FR-009, US3)
- [ ] T009 `src/features/platform/components/OnboardingPanel.tsx` — the
      form (tenant fields + first owner email/display name), server
      messages verbatim, form state preserved on refusal, and the
      one-time credential display with copy affordance + outcome note,
      cleared on the next action (the `IssuedCredential` pattern);
      mounted above the overview table in `PlatformConsolePage.tsx`
      (US1, FR-003)
- [ ] T010 Unit suite extensions in `tests/unit/platform.test.ts` — the
      client mapping: payload passthrough, verbatim refusals, denial
      shape (contract §5)

## 4. E2E + gates (FR-006, SC-001…SC-005)

- [ ] T011 E2E extension in `e2e/platform.surfaces.test.ts` — the
      walkthrough: onboard (credential shown once) → owner's first
      sign-in reaches their restaurant → console shows the tenant with
      `never_activated` and staff_count 1 (SC-001, SC-004, US3)
- [ ] T012 Docs: `docs/development.md` platform section extension (the
      onboarding RPC + the composition rulebook); contract/quickstart
      cross-check; then the full gates — `npm run db:reset -- --yes`,
      `npm run verify` (db suite includes T004–T007), full e2e
      single-worker, `types:gen` byte-identical
- [ ] T013 Post-implement analyze record + final commit

## Notes

- Composition rule (FR-008b): no new standing reads for the super-admin
  flag; the only new capability is the RPC itself. T007's matrix is its
  proof.
- One rulebook (FR-005): T001's extraction is protected by the standing
  management + security suites — they must pass unchanged after the
  refactor.
- Credential discipline (FR-003): the RPC returns the credential once;
  T009's display follows `StaffManagementPanel`'s pattern (never logged,
  never persisted); T005 asserts the three cases' contract exactly.
- The backfill (T003) is what makes the console's join honest for the
  journey-created tenants ('fiona', 'test') — verified live in research R3.
- Reviewer-owned custom checklist arrives with `$speckit-checklist`.
