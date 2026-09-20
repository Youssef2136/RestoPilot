---
description: "Task list for feature 009-kitchen-and-cashier-operations (Phase 8)"
---

# Tasks: Kitchen and Cashier Operations (Phase 8)

**Input**: Design documents from `/specs/009-kitchen-and-cashier-operations/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/database-functions.md, contracts/staff-ops-client.md, quickstart.md, checklists/round-lifecycle-and-modification.md (reviewer-owned)

**Tests**: Test tasks ARE included — the established 005–008 convention (the pipeline's Constitution): the transition matrix and modification atomicity are proven in the database suite, the client wrapper rules in the unit suite, the dashboards in e2e.

## Legend

- [P] = different files, no dependency on incomplete tasks
- [Story] = maps to a user story (US1–US4)

## Phase 8.1 — Setup

- [X] T001 Verify the starting baseline before any Phase 8 work: `git status --short` shows no uncommitted Phase 8 files; `npm run verify` exits 0 on the feature-008 state; the remote migration list shows no drift — the canonical workflow guard (FR-018 posture). No dependency is added this phase
- [X] T002 [P] Confirm the fixture facts in `tests/database/helpers/fixtures.ts` (new exports only if missing): the role matrix (alice owner BlueOlive; bob manager Downtown; carla cashier Downtown; dan kitchen Marina; eve cashier Downtown + owner CedarGrill; fiona no memberships), `staffRole` union, the dev tokens, and the tax-rule ids the modification suite re-derives with — research.md §10

## Phase 8.2 — Foundation (the state machine substrate)

- [X] T003 Create `supabase/migrations/<timestamp>_round_lifecycle.sql` (data-model.md; research.md §1–§3): widen `rounds_state_check` to `('new','accepted','preparing','ready','lock')` and `kitchen_tickets_state_check` to `('new','accepted','preparing','ready')` via drop-and-add; then the seven staff RPCs of contracts/database-functions.md §1–§6 — each `public`, `security definer`, `set search_path = ''`, identity-authorized as the first act (`private.staff_profile_ids((select auth.uid()))`), the guarded-update transitions (research §1) with the generic `P0001` `'This round is not available for that action.'`, the tenant `42501` messages per action, round↔ticket sync in one body, `modify_round_line`'s captured-price re-derivation through `private.calculate_tax_totals` (research §4), every mutation audited through `private.record_audit` with the JWT-derived actor (research §8); `revoke all … from public, anon` + `grant execute … to authenticated` on all seven. Apply with `npm run db:migrate` — FR-001…FR-004, FR-006, FR-007, FR-011, FR-012; Constitution IV/VI
- [X] T004 [P] Create `supabase/migrations/<timestamp>_round_reads.sql` (contracts/database-functions.md §6–§9): `get_branch_rounds`, `get_kitchen_queue` (money-free payload), `get_session_bill` — reads with the `list_open_sessions` scope predicate (research §6), names joined at read time, newest-first ordering; grants per §9. Apply with `npm run db:migrate` — FR-005, FR-008, FR-009, FR-010; Constitution IV
- [X] T005 Run `npm run types:gen` → the seven function signatures land in `src/types/database.types.ts`; committed, never hand-edited
- [X] T006 Create `tests/database/round.lifecycle.test.ts` — the transition matrix suite: every legal transition (as each allowed role, inside the caller's JWT scope via the session-journey identity pattern) succeeds with the exact state pairs; every illegal class (skip/backward/repeat/terminal/unknown id/wrong role/cross-branch/cross-restaurant/fiona) refuses with zero state change; the round↔ticket sync asserted after each; the audit rows asserted per transition (action, actor, resource, scope, none for reads); the RACE proof (two interleaved transitions through two pooled connections — exactly one winner, SC-002) — FR-001…FR-005, FR-011, FR-012; SC-001, SC-002
- [X] T007 Create `tests/database/round.modify.test.ts` — the modification suite: remove/reduce on each mutable state; reduce-to-0 and below-1 refusals; frozen-state refusals; kitchen denial; the money re-derivation byte-equal to a fresh `private.calculate_tax_totals` over the surviving captured rows (SC-003); CAPTURED-price semantics (a menu price change between submit and modify does not leak); atomicity (a forced failure after the line change leaves the line, money and audit untouched); the audit reasons verbatim (`quantity 2 → 1`, `removed 1 × Hummus`); the zero-rows guarantee on every refusal — FR-006, FR-007, FR-011; SC-003
- [X] T008 Mark the foundation complete: both migrations applied remotely, types regenerated, T006/T007 green — the US blocks' precondition

## Phase 8.3 — US1: the state machine (proven above, surfaced below)

- [X] T009 [US1] Create `src/features/staffOps/staffOpsClient.ts` (contracts/staff-ops-client.md §1, §3): the seven wrappers over the RPCs with `mapSessionError` reused verbatim; payload parsers fail-closed — `RoundPayload` (captured money as strings), `TicketQueuePayload` (REJECTS money keys — FR-010's client half), `BillPayload`; a malformed payload ⇒ retry, never a crash — FR-008, FR-010, FR-011 (client half)
- [X] T010 [US1] Create `src/features/staffOps/useStaffOps.ts` (contracts/staff-ops-client.md §2): `useBranchRounds`, `useKitchenQueue`, `useSessionBill` (the three key families, refetch-on-focus on — the §5.4 recovery), and the transition/modification mutations that write the returned payload into the cache and invalidate both dashboard keys — FR-008, FR-013

## Phase 8.4 — US2: the cashier dashboard

- [X] T011 [US2] Create `src/features/staffOps/components/RoundCard.tsx` and `src/routes/CashierRoundsPage.tsx` (contracts/staff-ops-client.md §4): the branch picker when the identity holds several branches (the 007 `?branch=` deep-link pattern), round cards grouped by state (incoming/in progress/ready/served) with table+session labels, lines with captured prices, and controls enabled exactly per state (accept on `new`; modify on `new`–`preparing`; lock on `ready`; nothing on `lock`); refusals rendered verbatim, the card state re-derived from the invalidated read — no optimistic state (§5.4) — FR-002, FR-004, FR-005, FR-006, FR-008
- [X] T012 [US2] Create `src/features/staffOps/components/BillPanel.tsx` wired under the rounds list (FR-009): the selected session's rounds grouped by state with captured subtotals, tax lines, totals, and the grand total — display-only arithmetic; a payment/invoice/discount word appears NOWHERE — FR-009; SC-005; Constitution I
- [X] T013 [US2] Register `/dashboard/rounds` in the router with the role-derived gate (cashier/manager/owner), the dashboard nav entry, and the branch deep link from the sessions page — the sessions page's registration pattern

## Phase 8.5 — US3: the kitchen dashboard

- [X] T014 [US3] Create `src/features/staffOps/components/TicketCard.tsx` and `src/routes/KitchenDashboardPage.tsx`: the three-column queue (new / preparing / ready) with items, quantities, extras — no money text anywhere (the parser already rejects it); start/ready buttons per state; the branch picker for multi-branch kitchen identities — FR-003, FR-005, FR-010
- [X] T015 [US3] Register `/dashboard/kitchen` in the router with the role-derived gate (kitchen/cashier/manager/owner) and the nav entry — dan reaches Marina; carla may help Downtown
- [X] T016 [US3] Extend `e2e/kitchen.cashier.test.ts` (new file) with the US3 block: dan signs in → the kitchen queue renders Marina's tickets (or its empty state) and no cashier route access; the start/ready journey on a scratch Marina session (opened via the table-activation precedent) — FR-003, FR-005; SC-004

## Phase 8.6 — US4: cashier journey, bill, audit in the browser

- [X] T017 [US4] Extend `e2e/kitchen.cashier.test.ts` with the US2/US4 block (same file, serial): carla signs in → Downtown rounds render → the accept journey → a line modify → the lock journey → the bill panel totals equal the captured sum; the real-API submission feeding the dashboard comes from the customer path (the dev-token RPC through the page's own session) — SC-004, SC-005
- [X] T018 [P] Create `tests/unit/staffops.client.test.ts` — the wrapper/payload suite (no network, the Supabase client stubbed): error mapping for all three kinds, the money-free queue parser rejecting a payload with any money key, the round/bill parsers' fail-closed shapes — FR-010, FR-011 (client half)

## Phase 8.7 — Polish

- [X] T019 [P] Extend `docs/development.md` with the Phase 8 suite table (what the lifecycle/modify suites, the unit suite, the integration journey, and the e2e file cover), the guarded-update concurrency posture, and the state-machine authority note (DB owns transitions; transport is Phase 12) — plan.md, research.md §1, §9
- [X] T020 Reset-and-rebuild determinism: `npm run db:reset -- --yes` → `npm run db:seed` → `npm run test:db` green; `npm run types:gen` byte-identical to the committed file — SC-006
- [X] T021 Full quality gate: `npm run verify` and `npm run test:e2e` both exit 0 with the extended suites; `package.json` unchanged — SC-006
- [X] T022 [P] Constraint & boundary audit across the Phase 8 diff: no secrets; no new env vars; no new dependency; zero grants on the order tables still; no void/bill-edit/discount/payment/stock concept (Constitution I; Phase 10 owns void); no realtime transport (Phase 12); audit rows only from staff actions — record in the Notes section
- [X] T023 Run the quickstart walkthroughs (`scripts/run-staffops-walkthroughs.mjs`) and append the validation record to `quickstart.md`; restore the project afterwards (`npm run db:reset -- --yes && npm run db:seed`)
- [X] T024 Final commit and push of all Phase 8 artifacts to GitHub `main` (the two migrations, `src/features/staffOps/`, the routes, regenerated types, the suites, `docs/development.md`, the spec artifacts) — mirrors feature 008's final task

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Migrations only via `supabase migration new <name>` + `npm run db:migrate`; types only via `npm run types:gen` — the single canonical workflow
- **Zero client grants** on `rounds`, `round_items`, `round_item_extras`, `kitchen_tickets` — the RPCs are the only surface (Constitution IV)
- The guarded-update pattern IS the concurrency control — no advisory locks, no retries (research §1)
- Realtime transport is Phase 12; this phase's recovery path is refetch/invalidation (research §9)
- The kitchen payload's money-free rule is asserted at BOTH layers (parser and database shape)
- **T022 constraint & boundary audit (2026-09-20)** — across the full Phase 8 diff: no secrets committed (`.env` untouched; the walkthrough script reads env vars only); no new env vars (`.env.example` unchanged); no new dependency (`package.json` byte-identical — the suites use the existing pg/@supabase-js/react-query/playwright); zero grants on the order tables re-verified after the widening migrations (only the eight RPCs are granted, `authenticated` only, reads included); no void/bill-edit/discount/payment/stock concept anywhere in the surface or payloads (Constitution I — Phase 10 owns void); no realtime transport (Phase 12; recovery is refetch/invalidation); audit rows originate only from staff actions through `private.record_audit` (the submission path writes none — re-proven by the 008 suite)

## Execution strategy

Foundation first (T001–T008: the migration pair + the two matrix suites prove the machine), then the client feature (T009–T010), then the dashboards per story (T011–T018), then polish (T019–T024). The database suites are the gate for everything else.
