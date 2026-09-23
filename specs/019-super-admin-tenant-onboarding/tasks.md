# Tasks: Super-Admin Tenant Onboarding

**Feature**: [spec.md](spec.md) · [plan.md](plan.md) · Created 2026-09-23

**Prerequisites**: plan.md, research.md, data-model.md, contracts/database-functions.md, quickstart.md — all complete.

## 1. Trusted layer (migration — the indivisible action)

- [x] T001 Migration `supabase/migrations/20260923XXXXXX_platform_onboarding.sql`
      — §1 the extracted `private.validate_tenant_inputs` helper (verbatim
      rules/messages from `create_restaurant`) + `create_restaurant`
      rewritten to call it, behavior-identical otherwise (FR-005, FR-008)
- [x] T002 §2 `public.onboard_restaurant` per
      [contracts/database-functions.md](contracts/database-functions.md):
      super-admin guard → shared validation → insert restaurant →
      `private.provision_staff_identity` → owner membership → subscription
      row (`never_activated`) → audit row (`platform.restaurant_onboarded`,
      outcome in reason); constraint-name-caught refusals verbatim;
      grants `authenticated` only, revoked from public/anon (FR-001…FR-007,
      FR-008a, FR-010)
- [x] T003 §3 the idempotent subscription backfill (`insert … select … on
      conflict do nothing`) so pre-existing bootstrap tenants appear in
      the console join (FR-008a/R3)

## 2. Database proofs (tests/database/platform.onboarding.test.ts)

- [x] T004 Reach matrix: super admin onboards successfully; owner
      (alice), branch manager (bob), cashier (carla), kitchen (dan),
      plain member (eve), membership-free creation bootstrap (fiona),
      and anon each refused with the console 42501 denial (FR-010)
- [x] T005 The three provisioning cases: new person (credential issued,
      person_created), unclaimed stub (credential re-issued, profile
      created), known person (linked, `temporary_password` null); plus
      the dual-role edge case — the first-owner email belonging to the
      super admin themselves links that identity as owner (spec edge
      case); each onboarding lands the owner membership + subscription
      row + audit row with the right outcome reason (FR-002, FR-003,
      FR-007, FR-008a, FR-006)
- [x] T006 All-or-nothing: slug conflict, malformed identifier, unknown
      timezone, and duplicate-email race each refuse verbatim AND leave
      zero restaurants/memberships/subscriptions/audit rows behind
      (FR-004); the audit entry carries the acting super admin as actor
- [x] T007 Post-onboarding reach: the new owner passes the standing
      owner-reach queries for their restaurant only (staff list, audit
      read, subscription read); the platform admin is refused the tenant
      audit read and every tenant operational surface; ordering from the
      onboarded tenant succeeds while `never_activated` (FR-008b, SC-005)

## 3. Client surface (console)

- [x] T008 `src/features/platform/platformClient.ts` —
      `onboardRestaurant()` + the `OnboardedTenant` payload type, using
      the module's error mapping (verbatim P0001 messages, 42501 denial);
      `usePlatform.ts` — `useOnboardRestaurant()` invalidating
      `platformOverviewKey()` (FR-009, US3)
- [x] T009 `src/features/platform/components/OnboardingPanel.tsx` — the
      form (tenant fields + first owner email/display name), server
      messages verbatim, form state preserved on refusal, and the
      one-time credential display with copy affordance + outcome note,
      cleared on the next action (the `IssuedCredential` pattern);
      mounted above the overview table in `PlatformConsolePage.tsx`
      (US1, FR-003)
- [x] T010 Unit suite extensions in `tests/unit/platform.test.ts` — the
      client mapping: payload passthrough, verbatim refusals, denial
      shape (contract §5)

## 4. E2E + gates (FR-006, SC-001…SC-005)

- [x] T011 E2E extension in `e2e/platform.surfaces.test.ts` — the
      walkthrough: onboard (credential shown once) → owner's first
      sign-in reaches their restaurant → console shows the tenant with
      `never_activated` and staff_count 1 (SC-001, SC-004, US3)
- [x] T012 Docs: `docs/development.md` platform section extension (the
      onboarding RPC + the composition rulebook); contract/quickstart
      cross-check; then the full gates — `npm run db:reset -- --yes`,
      `npm run verify` (db suite includes T004–T007), full e2e
      single-worker, `types:gen` byte-identical
- [x] T013 Post-implement analyze record + final commit

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

## Post-implement analysis (2026-09-23)

Verified against the deployed state, artifact by artifact:

- **FR-001** verified: `public.onboard_restaurant` (migration
  20260923090000) is callable by the super admin and returns the jsonb
  payload with `restaurant_id`, `name`, `slug`, and the owner outcome —
  proven live by `platform.onboarding.test.ts` (reach-matrix admission +
  T005's three cases) and by the browser walkthrough (e2e platform suite,
  7/7).
- **FR-002/003/007** verified: the three provisioning cases compose
  `private.provision_staff_identity` unchanged — new person → 24-hex
  one-time credential; unclaimed stub → completion + re-issue (auth_user_id
  preserved); known email → linkage with `temporary_password` null. All
  asserted in T005; the credential surfaces exactly once in the UI
  (T011 e2e asserts the block, the copy affordance, and its clearing on
  the next action).
- **FR-004** verified: all six refusal paths (slug conflict, malformed
  identifier, unknown timezone, empty name, invalid owner email, empty
  display name) return the verbatim messages with the footprint probe
  unchanged before/after (T006).
- **FR-005/008** verified: `private.validate_tenant_inputs` extracted
  verbatim; `create_restaurant` rewritten to call it; the standing
  management + security suites pass unchanged (`npm run verify` — unit
  268, db 516, integration 36, build).
- **FR-008a** verified: the onboarding inserts the subscription row
  (`never_activated`), and the idempotent backfill covered the four
  pre-019 journey restaurants (probed 4/4 at deploy time) — the console
  overview join no longer hides any tenant.
- **FR-008b** verified: the reach matrix refuses alice/bob/carla/dan/eve/
  fiona/anon with the console denial and admits only the flag (T004); the
  onboarded tenant then lives under the standing rulebook — owner-only
  audit read, the 014 refusal for the platform admin, ordering not blocked
  while never_activated (T007).
- **FR-006** verified: `platform.restaurant_onboarded` audit row with the
  acting super admin as actor and the outcome-derived reason
  (provisioned/linked) — T005 + the owner's `get_audit_log` read in T007.
- **FR-009** verified: the console overview shows the onboarded tenant
  immediately (`state: never_activated`, `staff_count: 1`) in the db probe
  and in the browser; `useOnboardRestaurant` invalidates
  `platformOverviewKey` on success.
- **FR-010** verified: guard-first RPC (42501 before any validation);
  grants `authenticated`-only, revoked from public/anon.
- **SC-001–SC-005** verified: walkthrough in the e2e suite; all-or-nothing
  (T006); credential discipline (T005/T011); the standing suites green
  after the extraction (verify exit 0); composition-only reach (T004/T007).
- **Gates**: `npm run db:reset -- --yes` → `npm run verify` exit 0 (unit
  268, db 516 — 24 new onboarding probes, integration 36, production
  build); full e2e single-worker **96/96**; `types:gen` byte-identical
  (sha1 1390ca45…, the +13 lines are the new RPC signature).
- **Residue discipline**: the db suite's committed T007 tenant is removed
  in afterAll (FK-safe order, idempotent, and re-run at beforeAll as
  crash recovery — a prior failed run cannot poison the next); the e2e
  walkthrough's tenants persist by house convention (named
  `onboarded-e2e-*`; `db:reset` restores determinism).
