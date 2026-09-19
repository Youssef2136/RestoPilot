---

description: "Task list for feature 006-tax-engine (Phase 5)"
---

# Tasks: Tax Engine (Phase 5)

**Input**: Design documents from `/specs/006-tax-engine/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/database-functions.md, contracts/tax-client.md, quickstart.md, checklists/calculation-and-integrity.md (reviewer-owned)

**Tests**: Test tasks ARE included — the spec mandates them (FR-022 requires the automated matrix: the authorization denials, the validation rules, the §16 calculation matrix, determinism, snapshot immutability, and the audit records). They are deliverables of this feature, not TDD-gated feature tests; each suite lands with the layer it verifies.

**Organization**: Tasks are grouped by user story (spec.md US1–US4) so each story is independently implementable and testable. The shared data layer — six tables and the nine functions — is a blocking prerequisite (Phase 2) because every story's surface reads or writes it; each story's phase then delivers its own surfaces and its own semantic proofs.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

Single project at repository root: `src/`, `tests/`, `e2e/`, `supabase/`, `scripts/db/`, `docs/` — per plan.md Project Structure. No new top-level directories, no new dependency, no new environment variable. Database work extends the feature 002–005 layout: migrations under `supabase/migrations/` (created only via `supabase migration new <name>`, applied only via `npm run db:migrate`), seed in `supabase/seed.sql` (applied via `npm run db:seed`), types regenerated via `npm run types:gen`. The frontend lands in the new `src/features/tax/` module with pages in `src/routes/`. No storage surface exists in this phase.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean, green baseline before any Phase 5 work

- [X] T001 Verify the starting baseline before any Phase 5 work: `git status --short` shows only the feature 005 history (no uncommitted Phase 5 files); `npm run verify` exits 0 on the feature-005 state; `supabase migration list` shows all eighteen existing migrations under `supabase/migrations/` applied remotely with no drift. If any check fails, stop and restore the known-good state — guards FR-024 (single canonical migration workflow). No dependency is added this phase (plan.md Technical Context)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The three migrations that constitute the tax data layer, the seeded fixture source, and the schema/authorization proofs every user story consumes

**CRITICAL**: No user story work can begin until this phase is complete

**Why the whole data layer lands here**: the plan's migrations create the shared tables and the nine functions that every story's surface calls — there is no story whose work can precede its own table or function. The story phases that follow own the *surfaces* and the *semantic proofs* (calculation matrix, override semantics, snapshot rules) that the shared matrix deliberately does not duplicate.

- [X] T002 [P] Extend `tests/database/helpers/fixtures.ts` with the Phase 5 fixture constants as new exports (existing exports keep their shapes): the Blue Olive tax configuration — the five seeded rule ids/names/rates/scopes/orders (`VAT` total 8.25% order 1; `City tax` total 1.5% order 2 compound source `VAT`; `Alcohol duty` categories→Drinks 10% order 3; `Imported sweets tax` items→one Desserts item 5% order 4; `Downtown surcharge` branch-only at Downtown 2% order 5), the Marina replacement-rate override on `VAT` (8.75%), Cedar Grill's single unoverridden total rule, and the expected effective configurations per branch — the single fixture source shared by the seed task (T006), the schema suite, and every story's suites — FR-023, SC-007, data-model.md seed fixture section
- [X] T003 Create `supabase/migrations/<timestamp>_tax_schema.sql` via `supabase migration new tax_schema` (data-model.md; research.md §1, §5–§7): the six tables with every constraint, index, RLS enable, and `revoke all … from anon, authenticated` exactly as declared — `tax_rules` (`name` non-blank ≤ 80, `rate numeric(5,4) not null default 0 check (rate >= 0 and rate <= 100)`, `scope text not null check (scope in ('total','items','categories'))`, `sort_order integer not null default 0 check (sort_order >= 0)`, `is_active boolean not null default true`, nullable `branch_id` with the composite FK to `branches(restaurant_id, branch_id)` — a branch-only rule's branch MUST belong to the rule's restaurant, the composite FK to `restaurants(restaurant_id, id)`, the case-insensitive `unique index on (restaurant_id, lower(btrim(name)))` across restaurant-level and branch-only rules, the `(restaurant_id, is_active, sort_order)` index); `tax_rule_items` / `tax_rule_categories` (PK `(rule_id, target_id)`, composite FKs to `tax_rules(restaurant_id, rule_id)` and `menu_items`/`menu_categories(restaurant_id, target_id)`, `on delete cascade`); `tax_rule_compounds` (PK `(rule_id, source_rule_id)`, `check (rule_id <> source_rule_id)`, composite FKs to `tax_rules(restaurant_id, …)`); `branch_tax_overrides` (PK `(branch_id, rule_id)`, `rate numeric(5,4) not null check (rate >= 0 and rate <= 100)`, composite FKs to `branches(restaurant_id, branch_id)` and `tax_rules(restaurant_id, rule_id)`); `tax_snapshots` (`fingerprint text not null`, `recorded_at timestamptz null`, `payload jsonb not null`, **no FK to any table**, the **partial** `unique index on (restaurant_id, branch_id, fingerprint) where recorded_at is not null`). Apply with `npm run db:migrate` — FR-005…FR-010, FR-016, FR-017
- [X] T004 Create `supabase/migrations/<timestamp>_tax_policies.sql` via `supabase migration new tax_policies` (data-model.md policy matrix): `grant select` to `authenticated` on the six new tables and the six select policies in the wrapped `(select …)` initPlan form — all use `restaurant_id in (select private.staff_restaurant_ids((select auth.uid())))`. No existing policy or grant is modified; no write grant is added anywhere. Apply with `npm run db:migrate` — FR-004, FR-019, FR-021; Constitution III/IV
- [X] T005 Create `supabase/migrations/<timestamp>_tax_rpcs.sql` via `supabase migration new tax_rpcs` (contracts/database-functions.md §1–§5; research.md §1–§4): the nine `public` functions with their execute grants to `authenticated` only — the six write RPCs (`create_tax_rule`, `update_tax_rule`, `reorder_tax_rules`, `retire_tax_rule`, `delete_unused_tax_rule`, `set_branch_tax_override`) and the two `security invoker` reads (`get_branch_tax_config`, `calculate_branch_taxes`) plus `record_tax_snapshot` (`security definer`, granted, called by no surface this phase — clarification 3). Each write function: `security definer`, `set search_path = ''`, authorization as its first act (`42501`), `P0001` validation messages per contract (rate between 0 and 100 with at most four decimals; name unique case-insensitively; scope/target-shape rules; "A tax cannot compound on itself."; "A compound source must be an active rule of this restaurant."; the reorder exact-coverage message; the delete carve-out message "This tax rule has been applied in recorded results and cannot be deleted."), constraint violations caught **by constraint name**, `private.record_audit` with the `tax.*` action vocabulary and change strings of contracts/database-functions.md, and the no-op rule (unchanged values write nothing and return the stored state). The reads: `security invoker`, stable, explicit owner-or-branch-member scope check, effective configuration computed server-side (research §4), the engine's exact per-line half-up rounding and compound-base resolution (research §1–§2, §5). Apply with `npm run db:migrate` — FR-002, FR-003, FR-005…FR-018, FR-021
- [X] T006 Extend `supabase/seed.sql` (converging, idempotent, deterministic — the T002 constants) and `scripts/db/seed.mjs`'s summary query with the Phase 5 fixture: Blue Olive's five rules with their targets and the compound pair, the Marina replacement-rate override, the branch-only `Downtown surcharge`, and Cedar Grill's single rule — FR-023, SC-007, data-model.md seed fixture section
- [X] T007 Regenerate the data-access types: `npm run types:gen` → `src/types/database.types.ts` gains the six tables and the nine function signatures; the file is committed and never hand-edited — FR-024
- [X] T008 Create `tests/database/tax.schema.test.ts` — the declaration-shape suite (features 002/004/005 precedent): the six tables' column names, types and nullability in ordinal order exactly per data-model.md; the constraints by name (`tax_rules_restaurant_name_key` case-insensitive uniqueness, the rate/scope/sort_order checks, `tax_rule_compounds_rule_id_source_rule_id_key` with the self-reference check, `branch_tax_overrides_pkey`, the **partial** `tax_snapshots_fingerprint_once_key`) exercised by attempting violations in rolled-back transactions; the six policies present with their commands; the snapshot table's no-FK posture. `npm run test:db` exits 0 — FR-005…FR-010, FR-016, FR-017
- [X] T009 Create `tests/database/tax.rpc.test.ts` — the shared matrix: authorization for **every** one of the nine functions across the role/scope combinations (alice owner Blue Olive, bob branch manager Downtown, carla cashier, dan kitchen, eve owner Cedar Grill, the platform admin, an unlinked identity — denials `42501`; `set_branch_tax_override` admits bob for Downtown and denies him for Marina; branch-only rule management admits bob for Downtown only; the reads admit owners for any branch of their restaurant and branch-scoped members for their own branch only), the generic validation messages and bounds (blank/duplicate/over-long rule names, rate `108`, rate `-1`, rate `8.25123`, rate `8.251` accepted→canonical `8.2510`, scope-with-empty-targets, cross-restaurant target ids rejected, self-compounding rejected), and the audit basics (one record per accepted change with actor, action, resource, tenant scope; a no-op call writing nothing). Everything in rolled-back transactions; `npm run test:db` exits 0 — FR-002…FR-010, FR-021, FR-027→FR-022

**Checkpoint**: Foundation ready — the tax data layer and the seeded fixture exist; the schema and authorization matrices are green; user story implementation can begin

---

## Phase 3: User Story 1 — Tax Rule Configuration (Priority: P1) — MVP

**Goal**: The owner configures the restaurant's tax rules — name, exact rate, scope (total/items/categories), explicit order, compound sources — with retire/reactivate and the unreferenced-delete carve-out, deterministic ordering, and the validation surfaced in the UI.

**Independent Test**: As alice, open `/dashboard/tax`; the seeded rules render in `(sort_order, name)` order with scope badges and rates; create a rule at each scope, set an explicit order, reorder, edit a rate, retire and reactivate, delete an unused rule and fail to delete `VAT`; blank/duplicate names, `108`, `-1`, `8.25123`, and a scopeless-targets category rule are each rejected with their message and change nothing; a branch manager, cashier, kitchen member, another restaurant's owner, and the super admin cannot reach or change any of it (spec US1 Independent Test).

### Implementation for User Story 1

- [X] T010 [P] [US1] Create `src/features/tax/taxMoney.ts` — `RATE_PATTERN` (`^\d{1,2}(\.\d{1,4})?$` plus the `100` special case), `isValidRateInput`, `canonicalizeRate` (trim, reject, pad to exactly four decimals — `"8.25"` → `"8.2500"`), `formatRate` (display only) — **no arithmetic on rates or amounts anywhere** (research.md §1; contracts/tax-client.md §1)
- [X] T011 [US1] Create `src/features/tax/taxClient.ts` — the typed wrappers over the US1 write functions (`create/update/reorder/retire/delete_unused` tax rules) with the `42501` → `AuthorizationError` and `P0001` → `ValidationError` mapping that surfaces the server message verbatim; rates are sent as canonical four-decimal strings (contracts/tax-client.md §1; contracts/database-functions.md §1). Later stories extend this module
- [X] T012 [US1] Create `src/features/tax/useTax.ts` — `useRestaurantTaxRules(restaurantId)` reading the tax tables under policies, the mutation wrappers, and the invalidation rules (every tax mutation invalidates `['tax', restaurantId]` including branch configurations and previews; no optimistic values for rates or order) — contracts/tax-client.md §1, §4
- [X] T013 [US1] Create `src/features/tax/components/TaxRulesPanel.tsx` — the rule list in `(sort_order, name)` order with scope badges, effective rates, active/retired state, and compound-source labels; create/edit forms validating against `RATE_PATTERN` before submit; reorder by submitting the complete ordered list; retire with confirmation naming the rule; delete offered only for rules the read marks unreferenced; server messages surface next to the control; empty states per contracts/tax-client.md §3 flow 1, §4
- [X] T014 [US1] Create `src/routes/TaxPage.tsx` and register `/dashboard/tax` in `src/app/router.tsx` under the existing `/dashboard` guard chain with the in-page `canManageRestaurant` gate (non-owners render `NotAuthorized`, not a hidden control); add the owner's "Tax" entry to `src/routes/DashboardPage.tsx` — contracts/tax-client.md §2
- [X] T015 [US1] Create `tests/unit/tax.client.test.ts` — the rate rules (valid/invalid inputs, the boundary cases `0`, `0.0001`, `100`, `100.0001` rejected, `8.251` → `8.2510`, three-decimal acceptance, >100 rejected, negatives rejected, `' 8.25 '` canonicalised) and the US1 client wrappers' error mapping and result shaping; `npm run test:unit` exits 0 — FR-007, contracts/tax-client.md §1
- [X] T016 [US1] Extend `tests/database/tax.rpc.test.ts` with the US1 semantics block: rule-name uniqueness case-insensitively and after trimming across restaurant-level and branch-only rules; scope/target-shape enforcement (a `total` rule with targets and an `items` rule without are each rejected; target ids must belong to the restaurant); compound-source validation (self-compounding, inactive source, cross-restaurant source); reorder exact-coverage rejection on a partial or duplicated list and the resulting `sort_order` sequence with the deterministic `(sort_order, name)` tiebreak; retire → absent from the effective configuration, reactivate → restored; the delete carve-out (`delete_unused_tax_rule` succeeds for an unreferenced rule and refuses `VAT` with the contract message); each accepted change producing its audit action. `npm run test:db` exits 0 — FR-005, FR-006, FR-007, FR-008, FR-010, FR-021
- [X] T017 [US1] Create `e2e/tax.surfaces.test.ts` — the browser presentation matrix (read-and-reject only, no tenant writes): the owner's `/dashboard/tax` renders the seeded rules in the stored order with scope badges and rates, the owner's "Tax" navigation entry is present, and a branch manager, cashier, kitchen member, other-restaurant owner, and the platform admin reach `NotAuthorized` on the deep link (rejected, not hidden); `npm run test:e2e` exits 0 — FR-001, FR-003, FR-008, SC-002, contracts/tax-client.md §2

**Checkpoint**: User Story 1 is complete — the owner can build and maintain the tax configuration, and the surface denies everything outside owner scope

---

## Phase 4: User Story 2 — Branch Tax Overrides (Priority: P2)

**Goal**: Branch-level replacement rates and branch-only rules — maintained by owners anywhere and by branch managers for their own branch only — with the effective configuration computed server-side and visible with origin labels.

**Independent Test**: As alice, override `VAT`'s rate at Marina, verify the restaurant default still applies at Downtown; as bob set a replacement rate at Downtown (succeeds), attempt Marina (denied) and restaurant-level edits (denied); clear an override and verify the branch returns to the default; as carla view the branch tax surface with no controls; verify the effective configuration reflects each saved change on the next read (spec US2 Independent Test).

### Implementation for User Story 2

- [X] T018 [US2] Extend `src/features/auth/useAuthContext.ts` with two presentation-only predicates: `canViewBranchTax(branchId)` (owner of the branch's restaurant, or any branch-scoped membership on that branch) and `canManageBranchTax(branchId)` (owner, or a `branch_manager` membership on that branch) — contracts/tax-client.md §2
- [X] T019 [US2] Extend `src/features/tax/taxClient.ts` with `setBranchTaxOverride` (returning whether a change was applied) and `parseTaxConfig(payload)` validating the `get_branch_tax_config` jsonb into typed structures — rejecting a malformed payload loudly rather than rendering half a configuration (contracts/database-functions.md §2–§3; contracts/tax-client.md §1)
- [X] T020 [US2] Create `src/features/tax/components/BranchTaxPanel.tsx` — the branch's effective configuration with origin labels (`restaurant` / `branch-only` / `override`), the replacement-rate editor per restaurant-level rule showing the restaurant default when cleared, branch-only rule management, and controls visible only within `canManageBranchTax` — contracts/tax-client.md §3 flow 2
- [X] T021 [US2] Create `src/routes/BranchTaxPage.tsx` and register `/dashboard/branches/:branchId/tax` in `src/app/router.tsx` (in-page gates: `canViewBranchTax` for the route, `canManageBranchTax` for the controls); link it from `src/routes/BranchDetailPage.tsx` — contracts/tax-client.md §2
- [X] T022 [US2] Extend `tests/unit/tax.client.test.ts` with the config parser block: valid payloads typed and ordered, malformed payloads rejected (missing rule fields, wrong types, an unknown origin label), and the override-applied/restaurant-default distinction — contracts/tax-client.md §1
- [X] T023 [US2] Extend `tests/database/tax.rpc.test.ts` with the override semantics block: set/change/clear/no-op behaviour of `set_branch_tax_override` (upsert replaces the rate, clear deletes the row, a repeat call writes nothing and returns changed:false); a replacement rate on a branch-only rule refused ("Only a restaurant-level rule can be overridden at a branch."); bob succeeds for Downtown and is denied for Marina and for restaurant-level rules; cross-branch non-interference (Marina's override leaves Downtown untouched); clearing returns the branch to the restaurant default; the `get_branch_tax_config` payload shape — ordering, effective rates, origin labels, and the FR-020 diff summary; audit records carrying branch scope. `npm run test:db` exits 0 — FR-003, FR-009, FR-020, FR-021
- [X] T024 [US2] Extend `e2e/tax.surfaces.test.ts` with the branch view matrix: alice sees Marina's effective configuration with the `override` origin label at 8.7500% and Downtown's with the branch-only surcharge; bob sees Downtown's controls and reaches `NotAuthorized` for Marina's branch tax view and for `/dashboard/tax`; carla sees Downtown's tax view with no controls; `npm run test:e2e` exits 0 — FR-003, FR-009, FR-020, SC-002, contracts/tax-client.md §2

**Checkpoint**: User Stories 1 and 2 are complete — the effective configuration of every branch is truthful, maintained by the right roles, and visible with its origins

---

## Phase 5: User Story 3 — Deterministic Calculation and Customer-Visible Tax Lines (Priority: P3)

**Goal**: One canonical calculation through `calculate_branch_taxes` — the §16 matrix (all scopes, compounding, ordering), exact half-up amounts, byte-identical determinism — presented as the staff preview that shows exactly what a customer will see.

**Independent Test**: Configure known rules at multiple scopes with explicit ordering (including the compound pair), present a known basket, and verify the computed lines match hand-calculated exact amounts in the configured order; repeat the identical request and verify a byte-identical result; change an item's selection or a rule and verify only the affected lines change; verify another restaurant's staff member is denied (spec US3 Independent Test).

### Implementation for User Story 3

- [X] T025 [US3] Extend `src/features/tax/useTax.ts` with `useTaxPreview(branchId)` over `calculate_branch_taxes` (computed per submitted selection, not on keystroke) and the preview's invalidation alongside every configuration mutation — contracts/tax-client.md §1, §4
- [X] T026 [US3] Create `src/features/tax/components/TaxPreview.tsx` — pick items (with extras) into a basket, submit, and render the exact lines (name, rate, scope, amount) in the configured order plus subtotal and total; identical submissions render identical lines — contracts/tax-client.md §3 flow 3
- [X] T027 [US3] Extend `src/features/tax/taxClient.ts` with `calculateBranchTaxes` and `parseCalculation(payload)` validating the calculation jsonb (lines ordered, exact two-decimal amounts as strings, subtotal/total consistency) — contracts/database-functions.md §3; contracts/tax-client.md §1
- [X] T028 [US3] Extend `tests/unit/tax.client.test.ts` with the calculation parser block: valid payloads typed and ordered, malformed payloads rejected (a non-two-decimal amount string, an out-of-order line set, a missing subtotal) — contracts/tax-client.md §1
- [X] T029 [US3] Extend `tests/database/tax.rpc.test.ts` with the calculation matrix block (the phase's core): the full §16 matrix — no taxes, one subtotal tax, multiple taxes, the compound pair (base includes the earlier tax's amount), item-level, category-level, mixed scopes, branch overrides, and an ordering change (reordering `City tax` before `VAT` changes its base and the amounts exactly as the order dictates) — each producing exactly the hand-calculated lines in the configured order; determinism (an identical repeat is byte-identical and writes nothing); the empty basket (zero lines, subtotal = total); half-up rounding at the line boundary (a `2.295` base → `2.30`); extras included in the item base (base price + selected extras adjustments); malformed selections rejected with the contract message. `npm run test:db` exits 0 — FR-001, FR-011, FR-012, FR-013, FR-014, FR-015, FR-022
- [X] T030 [US3] Create `tests/integration/tax.calculation.test.ts` — the real-API journey with real sessions: alice creates a compound pair and a branch override through the real RPCs; bob sets his own branch's replacement rate; the preview computes exact known amounts through the real function; an identical repeat is byte-identical; eve is denied Blue Olive's calculation and configuration; scratch rules/overrides are removed in teardown. `npm run test:integration` exits 0 — FR-002, FR-011, FR-012, FR-019; research.md §9
- [X] T031 [US3] Extend `e2e/tax.surfaces.test.ts` with the preview presentation check: the owner's and bob's branch tax views render the preview lines with rates and exact amounts in the configured order (read-only, no writes) — FR-014, SC-004

**Checkpoint**: User Stories 1–3 are complete — the engine computes deterministically from truthful per-branch configuration, and staff see exactly what customers will be shown

---

## Phase 6: User Story 4 — Historical Correctness (Priority: P4)

**Goal**: The snapshot mechanism — once-only recording, immutability, tenant scoping — delivered and test-proven at the data layer, with no surface writing snapshots in this phase (clarification 3).

**Independent Test**: Record a produced calculation through `record_tax_snapshot`, record it again (nothing written), attempt to alter it (no path exists), change the underlying configuration and verify the snapshot is untouched; verify eve cannot record or read Blue Olive's snapshots (spec US4 Independent Test).

### Implementation for User Story 4

- [X] T032 [US4] Extend `tests/database/tax.rpc.test.ts` with the snapshot block: `record_tax_snapshot` records a produced result once (the fingerprint's once-only partial unique index proven declaratively in T008 and behaviourally here — an identical re-record writes nothing and reports not-recorded); the recorded payload carries the applied configuration, lines, and total exactly as produced and is immutable (no update path exists — attempted updates fail with no grant); a non-restaurant member is denied recording and reading; and no surface of this feature calls the function (a grep-level audit note in the task's completion, matching clarification 3). `npm run test:db` exits 0 — FR-016, FR-017, FR-021

**Checkpoint**: All four stories are complete — the historical-correctness guarantee exists where later billing will consume it, without a single premature snapshot

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, determinism proof, boundary audit, and documentation of everything the stories built

- [X] T033 [P] Extend `docs/development.md`: the Phase 5 suites (what the tax schema and RPC matrices, the calculation matrix, the integration journey, the unit suites, and the e2e presentation matrix cover), the tax data-layer posture (policy-only reads, RPC-only writes, the partial unique fingerprint index), and the snapshot mechanism's defer-until-ordering status — plan.md Project Structure, research.md §3, §9
- [X] T034 Reset-and-rebuild determinism (quickstart.md; feature 002 FR-016 posture): `npm run db:reset` (destructive, development project only) → `npm run db:seed` → `npm run test:db` green, and `npm run types:gen` output byte-identical to the committed `src/types/database.types.ts` — SC-007
- [X] T035 Full quality gate from a clean state: `npm run verify` (format:check → lint → typecheck → test:unit → test:db → test:integration → build) **and** `npm run test:e2e` both exit 0 with the extended suites; `package.json` unchanged (no new dependency, no new script) — SC-001…SC-008 evidence (depends on T034)
- [X] T036 [P] Constraint & boundary audit across the Phase 5 diff (`supabase/migrations/`, `supabase/seed.sql`, `scripts/db/seed.mjs`, `src/features/tax/`, `src/features/auth/`, `src/routes/`, `src/app/router.tsx`, the test suites, `docs/development.md`): no service-role or secret keys anywhere; no new environment variables; no new dependency; no client write grants on any table; guards and predicates presentation-only (Constitution IV); no payment, accounting, invoice, bill-splitting, discount, tip, or service-charge concept anywhere (Constitution I); no snapshot written by any surface (clarification 3); no scope creep (no session, cart, round, bill, kitchen, cashier, delivery, reporting, realtime, or super-admin work); every spec FR-001–FR-024 and SC-001–SC-008 maps to at least one task — audit record in the Notes section below
- [X] T037 Run the quickstart.md walkthroughs and record the results: Walkthrough A — the owner builds the tax configuration in one session (SC-001); Walkthrough B — the branch journey: overrides, the preview's hand-calculated exact lines, and the override lifecycle; Walkthrough C — isolation, the calculation matrix spot-checks, the snapshot once-only proof, and the audit records; then restore the development project with `npm run db:reset && npm run db:seed` and append the validation record to `specs/006-tax-engine/quickstart.md`
- [ ] T038 Final commit and push of all Phase 5 artifacts (the three migrations under `supabase/migrations/`, `supabase/seed.sql` + `scripts/db/seed.mjs`, the `src/features/tax/` module, the route and auth-module edits, regenerated `src/types/database.types.ts`, the test suites, `docs/development.md`, and the spec artifacts) to GitHub `main` — mirrors feature 005 T048 (depends on T035–T037)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 is a gate: if the baseline is not green, stop.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories. T002 (fixtures) may proceed alongside the migration batch T003 → T004 → T005 (each migration is applied through the canonical workflow before the next is created); T006 (seed) needs T003–T005 applied; T007 (types) needs T003–T005; T008 needs T003–T004; T009 needs T003–T006.
- **US1 (Phase 3)**: Depends on Foundational — T010 ∥ T011 → T012 → T013 → T014; T015 after T010/T011; T016 after T009 (it extends that file); T017 after T014.
- **US2 (Phase 4)**: Depends on Foundational and, for the surfaces, on US1's module and route (T012/T014) — T018 ∥ T019 → T020 → T021; T022 after T019; T023 after T019 (it exercises the config read); T024 after T021.
- **US3 (Phase 5)**: Depends on US1/US2's module (T012, T019) — T025 ∥ T026 ∥ T027; T028 after T027; T029 after T009 (it extends that file); T030 after T029; T031 after T026.
- **US4 (Phase 6)**: Depends on Foundational (T005's `record_tax_snapshot`) — T032.
- **Polish (Phase 7)**: Depends on all user stories — T033 ∥ T034 → T035 → T036 ∥ T037 → T038.

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories (MVP).
- **US2 (P2)**: After US1 — its branch surface lives in US1's feature module and router edit; the override rules it surfaces are already enforced in the data layer.
- **US3 (P3)**: After US1 and US2 — the calculation consumes the effective configuration US2 makes truthful; the preview surface belongs to US1's feature module.
- **US4 (P4)**: After Foundational — the mechanism is data-layer; independent of the other stories' surfaces.

### Within Each User Story

- Migrations only via `supabase migration new <name>` and `npm run db:migrate`; seed only via `npm run db:seed`; types only via `npm run types:gen` (FR-024). Never edit an applied migration; add a new one
- Client module before pages; pages before the suites that exercise them; each story's suites green before its checkpoint
- No storage configuration exists in this phase; no dashboard edits of any kind

### Parallel Opportunities

- **Foundational**: T002 (fixtures) may proceed alongside T003–T005; T008 and T009 are two different files.
- **US1**: T010 ∥ T011 (different files, no dependency).
- **US2**: T018 ∥ T019 (different files).
- **US3**: T025 ∥ T026 ∥ T027 (three different files).
- **Polish**: T033 ∥ T034; T036 ∥ T037.
- Cross-story: after US1, a second implementer can take US2 while the first completes US3 → US4.

---

## Parallel Example: User Story 3

```bash
# The preview hook, component, and client parser are independent files:
Task: "Extend src/features/tax/useTax.ts with useTaxPreview"                       # T025
Task: "Create src/features/tax/components/TaxPreview.tsx"                          # T026
Task: "Extend src/features/tax/taxClient.ts with calculateBranchTaxes + parser"    # T027
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T009) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T010–T017)
4. **STOP and VALIDATE**: `npm run test:db`, `npm run test:unit`, and `npm run test:e2e` green; walk the owner's tax-configuration journey as alice
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → the tax data layer and the seeded fixture exist
2. US1 → the owner maintains the tax configuration (MVP)
3. US2 → per-branch overrides and the truthful effective configuration
4. US3 → the deterministic engine surfaced as the staff preview (**the phase's exit condition is now demonstrable**)
5. US4 → the snapshot mechanism proven at the data layer
6. Polish → determinism proof, full gate, boundary audit, quickstart walkthroughs, commit

### Single-Implementer Order

T001 → T002 ∥ (T003 → T004 → T005) → T006 → T007 → T008 ∥ T009 → T010 ∥ T011 → T012 → T013 → T014 → T015 ∥ T016 ∥ T017 → T018 ∥ T019 → T020 → T021 → T022 ∥ T023 ∥ T024 → T025 ∥ T026 ∥ T027 → T028 ∥ T029 → T030 ∥ T031 → T032 → T033 ∥ T034 → T035 → T036 ∥ T037 → T038

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Migrations are created only via `supabase migration new <name>` and applied only via `npm run db:migrate`; the seed only via `npm run db:seed`; types only via `npm run types:gen` — the single canonical workflow (FR-024)
- No client write grants exist anywhere: the six `security definer` RPCs are the only write paths and the authorization boundary — guards, predicates, and pages are presentation only (Constitution IV)
- Client-readable surfaces never compute business-critical values: the effective configuration and every amount are computed once, server-side, in `get_branch_tax_config` / `calculate_branch_taxes` (research.md §4); rates and amounts cross the wire as exact strings with no client arithmetic (research.md §1)
- The e2e suite is read-and-reject only: it creates no tenant data. The real-session journey is proven by the integration suite (T030), not in the browser (research.md §9)
- Audit records are produced by `private.record_audit` inside the RPCs and are write-only for clients this phase (FR-021); the suites assert their existence and shape through the database tier
- The snapshot function is granted and test-exercised but called by no surface in this phase (clarification 3 of the spec) — the audit of T036 re-proves that boundary

### T036 constraint & boundary audit record (2026-09-19)

Probes run against the full Phase 5 diff (`supabase/migrations/*tax*.sql`, `supabase/seed.sql`, `scripts/db/seed.mjs`, `src/features/tax/`, `src/features/auth/`, `src/routes/TaxPage.tsx` + `BranchTaxPage.tsx` + router/dashboard edits, all tax test suites, `docs/development.md`):

- **Secrets / service keys**: no service-role key, secret, or privileged token anywhere in the diff (grep over all touched files: zero matches). No new environment variable is read by any tax surface (zero `process.env` / `import.meta.env` references outside the existing patterns).
- **Dependencies / scripts**: `package.json` and `package-lock.json` untouched — no new dependency, no new script.
- **Write grants**: the only table grants in the tax migrations are `SELECT` for `authenticated` on the six client-readable tables; INSERT/UPDATE/DELETE exist nowhere. Writes flow exclusively through the six `security definer` RPCs, each authorizing via the private helper family as its first act (Constitution IV — guards and predicates are presentation-only).
- **Constitution I**: no payment, accounting, invoice, bill-splitting, discount, tip, or service-charge concept appears in any tax surface, migration, or seed change (grep: zero matches).
- **Snapshot boundary (clarification 3)**: `record_tax_snapshot` appears in `src/` only inside the generated type definitions — no route, hook, client wrapper, or component calls it; the database suite proves the owner-only grant and once-only semantics.
- **Scope creep**: no session, cart, round, bill, kitchen, cashier, delivery, reporting, realtime, or super-admin concept in the Phase 5 surfaces (grep: zero matches).
- **FR/SC coverage**: FR-001–FR-024 each map to ≥1 task. SC-001, SC-002, SC-004, SC-007, SC-008 are named in tasks; the SC-003 / SC-005 / SC-006 evidence is carried inside the existing tasks that prove it rather than by id — SC-003 by the T009 validation matrix (blank/duplicate names, malformed/out-of-bound rates, cross-restaurant targets — all verbatim-message denials with no partial state), SC-005 by the T032 snapshot immutability tests (record → mutate config → re-read unchanged; no surface renders a snapshot as current state), and SC-006 by the T009/T023 audit assertions (rule and override lifecycle actions recorded with actor, action, resource, change, scope).

**Result: no violations. The Phase 5 diff satisfies every audited boundary.**
