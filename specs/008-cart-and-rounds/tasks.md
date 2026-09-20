---
description: "Task list for feature 008-cart-and-rounds (Phase 7)"
---

# Tasks: Cart and Rounds (Phase 7)

**Input**: Design documents from `/specs/008-cart-and-rounds/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/database-functions.md, contracts/order-client.md, quickstart.md, checklists/atomicity-and-snapshot-fidelity.md (reviewer-owned)

**Tests**: Test tasks ARE included — the database suites (schema + RPC/atomicity), the client unit suite, the integration journey, and the e2e presentation matrix follow the established per-phase tier pattern.

**Gate**: the custom checklist's 20 items are reviewer-owned; approval happens at the implement gate.

## Dependencies

- T001 → T002–T004 (baseline before anything)
- T002 → T005 → T006 (schema → RPCs → types)
- T006 → T007–T008 (suites need the deployed schema/RPCs)
- T009–T012 (US1) and T013–T017 (US2) stand on the foundation; T018–T020 (US3) on US2's submission; T021 (US4) on T008's proofs
- T022–T027 (polish) last, in order

## Tasks

- [X] T001 Verify the starting baseline before any Phase 7 work: `git status --short` shows no uncommitted Phase 7 files; `npm run verify` exits 0 on the feature-007 state; the remote migration list shows no drift. If any check fails, stop and restore the known-good state — guards FR-018 (the canonical workflow). No dependency is added this phase (plan.md Technical Context)
- [X] T002 [P] Extend `tests/database/helpers/fixtures.ts` with the Phase 7 fixture constants as new exports (existing exports keep their shapes): an item selection matrix for the submission suites (a priced item with ≥ 2 extras, a plain priced item, the foreign-restaurant item, the unavailable item) with their ids — the single fixture source shared by the suites, the walkthrough script, and the seed — FR-018, SC-007, research §10
- [X] T003 Create `supabase/migrations/<timestamp>_order_schema.sql` via `supabase migration new order_schema` (data-model.md; research.md §3, §4): the four tables with every constraint, index, RLS enable (no policies), and `revoke all … from anon, authenticated` exactly as declared — `rounds` (`state text not null default 'new' check (state in ('new'))`, `subtotal`/`tax_total numeric(14,2)` with `>= 0` checks, `tax_lines jsonb not null default '[]'`, composite FKs to `restaurants`/`branches(restaurant_id, id)`/`sessions(restaurant_id, id)`, index on `session_id`); `round_items` (`quantity integer not null check (quantity between 1 and 99)`, `unit_price numeric(12,2)` `>= 0`, composite FK to `rounds(restaurant_id, id)` and `menu_items(restaurant_id, id)`, unique `(round_id, item_id)`, index on `round_id`); `round_item_extras` (`price_adjustment numeric(12,2)` `>= 0`, composite FKs to `round_items(restaurant_id, id)` and `menu_item_extras(restaurant_id, id)`, unique `(round_item_id, extra_id)`); `kitchen_tickets` (`state` closed as `'new'`, composite FKs to `branches`/`rounds`, the partial unique index `kitchen_tickets_one_per_round on (round_id)`, index on `branch_id`); **no grant of any kind follows** — the zero-grant posture. Apply with `npm run db:migrate` — FR-005, FR-006, FR-015, FR-018; Constitution III/IV/VI
- [X] T004 [P] Create `supabase/migrations/<timestamp>_order_rpcs.sql` via `supabase migration new order_rpcs` (contracts/database-functions.md §1–§4; research.md §1): the two `public` functions, each `security definer`, `set search_path = ''`, token-authorized as the first act with the byte-identical session refusal — `submit_round(p_token text, p_items jsonb)` (the validation chain in contract order: shape/bounds/availability/scope, each refusal verbatim; then `calculate_branch_taxes(session.branch_id, selections)`; then the four-table insert set in one body — round, items with captured `unit_price`, extras with captured `price_adjustment`, exactly one `kitchen_tickets` row) and `get_session_rounds(p_token text)` (the history read joining display names at read time, captured money from the round's own columns). `revoke` then `grant execute … to anon, authenticated` on both. Apply with `npm run db:migrate` — FR-005, FR-006, FR-007, FR-008, FR-011, FR-015; Constitution IV
- [X] T005 Run `npm run types:gen` → `src/types/database.types.ts` gains the four tables and the two function signatures; the file is committed and never hand-edited — FR-018
- [X] T006 Create `tests/database/order.schema.test.ts` — the declaration-shape suite (features 002/004–007 precedent): the four tables' column names, types and nullability in ordinal order exactly per data-model.md; the constraints by name (the closed `state` checks — FR-012's no-transitions posture — the quantity bounds, the `unique (round_id, item_id)` and `(round_item_id, extra_id)` uniques, `kitchen_tickets_one_per_round` exercised by attempting a second ticket in a rolled-back transaction — FR-007's SC-003 foundation); the **zero-grant posture** proven — `has_table_privilege('anon', …)` and `('authenticated', …)` are false for select/insert/update/delete on all four tables. `npm run test:db` exits 0 — FR-015, FR-018; Constitution IV
- [X] T007 Create `tests/database/order.rpc.test.ts` — the shared RPC matrix: token authorization for both functions (valid dev token resolves; unknown/tampered token → the byte-identical session refusal; no staff-only matrix exists — the functions are anon-granted by contract); the generic validation messages verbatim (malformed line, empty cart, quantity bounds, foreign item, unavailable item, foreign extra); the audit-basics absence (a submission writes NO audit rows — FR-014) verified by direct admin query; the no-account posture (the token links to no staff identity). Everything in rolled-back transactions; `npm run test:db` exits 0 — FR-008, FR-014
- [X] T008 Mark the foundation complete

### US1: The Customer Cart (FR-001–FR-004)

- [X] T009 [US1] Create `src/features/order/cartState.ts` — the cart module (contracts/order-client.md §2): the `restopilot.cart` key, `{ token, lines }` shape, `loadCart`/`saveCart`/`clearCart`, token mismatch ⇒ empty, line bounds (1–99) enforced as feedback, the merge rule (adding an existing item+extras pair increments quantity), and the in-module change notification the UI subscribes to — FR-002, FR-003, FR-004
- [X] T010 [US1] Create `tests/unit/order.cart.test.ts` — the cart module suite: save/load round-trip, token mismatch empties, merge-on-add, bounds feedback, clear-on-forget wiring (the 007 forget path clears the cart key too) — FR-002, FR-003
- [X] T011 [US1] Create `src/features/order/components/CartPanel.tsx` and extend `src/routes/CustomerMenuPage.tsx` — the cart surface on the customer menu: add-to-cart affordances on menu items (extras selection + quantity), the line list with adjust/remove, the advisory running total from the menu payload's prices (decimal-string arithmetic through the shared money module), reload persistence (SC-005's local half), and the no-session posture (no cart surface without a resolving context, FR-003) — FR-001, FR-002, FR-004
- [X] T012 [US1] Extend `e2e/session.surfaces.test.ts` with the US1 block: add with extras → the line and total render; adjust quantity → the total updates; remove → the line disappears; reload → the cart is restored exactly (SC-005's local half); no cart surface on the entry route (FR-003) — SC-001
- [X] T013 [US1] Extend `tests/database/order.rpc.test.ts` with the US1-adjacent server proofs: the malformed/empty/bounds refusals verbatim (each leaving zero rows — the first atomicity proofs) — FR-008

### US2: Round Submission (FR-005–FR-010)

- [X] T014 [US2] Create `src/features/order/orderClient.ts` — the two wrappers (contracts/order-client.md §1): `submitRound` (one RPC; clears the cart through `cartState` only on success) and `getSessionRounds`; error mapping reuses 007's `mapSessionError` and `SessionResult` verbatim (FR-017); payload parsing with `SessionPayloadError` on malformed shapes — FR-005 (client half), FR-010, FR-017
- [X] T015 [US2] Create `src/features/order/useOrder.ts` — the hooks: `useSubmitRound` (mutation; on success clears the cart and invalidates the history key), `useSessionRounds` (token-scoped key; no optimistic writes) — FR-010, FR-011
- [X] T016 [US2] Create `src/features/order/components/SubmitControl.tsx` and wire it into `CartPanel` — the submit control (disabled while empty or in flight — the double-submit client guard, FR-009), refusals rendered verbatim (`role="alert"`, FR-010), and the success feedback (the round number; the cart clears) — FR-009, FR-010
- [X] T017 [US2] Extend `tests/database/order.rpc.test.ts` with the US2 atomicity block — the critical-transaction proofs (SC-002): the full refusal matrix through the real RPC (unavailable item, branch override, foreign item, foreign extra, malformed line, bounds — each refused verbatim with ZERO rows in all four tables, proven by direct admin counts); the happy path (one round, items with captured `unit_price`, extras with captured `price_adjustment`, exactly one ticket — SC-002); the tax cross-check (the captured `tax_lines` equal a fresh `calculate_branch_taxes` run over the same selections — SC-004); the double-submit posture (two sequential submissions → two independent complete rounds); the race proof (two concurrent submissions → two complete rounds, neither partial — Risk 7) — FR-005, FR-006, FR-007, FR-008, FR-009, SC-002, SC-004; FR-016's no-drift check IS the tax cross-check
- [X] T018 [US2] Extend `e2e/session.surfaces.test.ts` with the US2 block: submit a valid cart → the success feedback and the emptied cart; submit a refused cart (an item made unavailable through the admin connection) → the verbatim message and the cart preserved (FR-010) — SC-001

### US3: Multiple Rounds and Recovery (FR-011, FR-010 lineage)

- [X] T019 [US3] Extend `src/routes/CustomerMenuPage.tsx` with the rounds history section (contracts/order-client.md §4): the session's rounds with items, extras, captured prices, and tax lines; recovered on mount from the server (the reload proof); invalidated by a new submission — FR-011
- [X] T020 [US3] Create `tests/integration/order.journey.test.ts` — the real-API journey (feature 007's journey pattern): cart built client-side → submit → history shows the round → reload-equivalent (fresh client, stored token) → history recovered → second submission → two rounds, two tickets, no item overlap (SC-003) — SC-003, SC-005, FR-011
- [X] T021 [US3] Extend `e2e/session.surfaces.test.ts` with the US3 block: two submissions in one browser session → the history renders both rounds with their distinct lines; reload → the history persists (the server half of SC-005) — SC-003, SC-005

### US4: Kitchen Ticket Readiness (FR-007, FR-013)

- [X] T022 [US4] Extend `tests/database/order.rpc.test.ts` with the US4 ticket-integrity block: for every accepted round exactly one ticket exists (`kitchen_tickets_one_per_round` proven); the ticket's items ARE the round's items (the join proof — no copy, no drift); no staff or anon path creates or alters tickets (the zero-grant posture re-proven for the ticket table); the ticket starts in `'new'` with the round — FR-007, FR-013, SC-003

### Polish

- [X] T023 [P] Extend `docs/development.md`: the Phase 7 suites (what the order schema and RPC/atomicity matrices, the cart unit suite, the integration journey, and the e2e blocks cover), the ordering data-layer posture (zero client grants, RPC-only writes, the one-per-round partial unique index, the tax capture delegation), and the cart's client-only advisory status — plan.md Project Structure, research.md §1, §5, §9
- [X] T024 Reset-and-rebuild determinism (quickstart.md; SC-007): `npm run db:reset -- --yes` → `npm run db:seed` → `npm run test:db` green, and `npm run types:gen` output byte-identical to the committed `src/types/database.types.ts`
- [X] T025 Full quality gate from a clean state: `npm run verify` **and** `npm run test:e2e` both exit 0 with the extended suites; `package.json` unchanged — SC-006 evidence (depends on T024)
- [X] T026 [P] Constraint & boundary audit across the Phase 7 diff (`supabase/migrations/`, the `src/features/order/` module, the test suites, `docs/development.md`): no service-role or secret keys anywhere; no new environment variables; no new dependency; **zero client grants on any of the four tables**; the cart module's client-only advisory status (Constitution V); no payment, accounting, invoice, bill-splitting, discount, tip, service-charge, customer-account, or notification concept anywhere (Constitution I); no round-state transitions, no kitchen surfaces, no realtime work (spec Out of Scope); every spec FR-001–FR-018 and SC-001–SC-007 maps to at least one task — audit record in the Notes section below
- [X] T027 Run the quickstart.md walkthroughs and record the results (Walkthrough A — the customer builds a cart; Walkthrough B — submission, refusal, atomicity; Walkthrough C — multiple rounds, recovery, ticket integrity; then restore the development project with `npm run db:reset -- --yes && npm run db:seed`) and append the validation record to `specs/008-cart-and-rounds/quickstart.md` — SC-001…SC-005
- [X] T028 Final commit and push of all Phase 7 artifacts (the two migrations under `supabase/migrations/`, the `src/features/order/` module, the route edit, regenerated `src/types/database.types.ts`, the test suites, `docs/development.md`, and the spec artifacts) to GitHub `main` — mirrors feature 007's final task (depends on T025–T027)

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Migrations are created only via `supabase migration new <name>` and applied only via `npm run db:migrate`; types only via `npm run types:gen` — the single canonical workflow (FR-018)
- **Zero client grants** on `rounds`, `round_items`, `round_item_extras`, `kitchen_tickets` — the two RPCs are the only surface (Constitution IV/V)
- The kitchen ticket's items are the round's items by construction (research §4) — no denormalized copy exists in this phase; Phase 8 denormalizes only if its surface requires it
- Round submission produces no audit rows (the 007 posture — customer actions are unaudited; FR-014)
- The tax cross-check (SC-004) runs the 006 engine inside the suite's transaction — captured vs recomputed must be byte-equal (Risk 6)
- No realtime, no state transitions, no staff surfaces — the Out of Scope list is the converge checklist
- **T026 audit record (post-implementation)**: no service-role keys or `SUPABASE_DB_URL` in any Phase 7 source; no new dependency (`package.json` untouched); zero grants in the order schema migration; no payment/bill/invoice/discount/tip/service-charge/notification concept in the module, migrations, or suites (Constitution I); no round-state transitions, kitchen surfaces, or realtime (Out of Scope); the cart module is client-only advisory (Constitution V); every FR-001–FR-018 and SC-001–SC-007 maps to at least one task in this file. One planned deviation documented: the tax capture calls `private.calculate_tax_totals` (the extracted owner-only core) instead of the public staff function — the split is recorded in research.md §1 (revised) and migration `20260920103000_tax_core_split.sql`

## Execution strategy

Sequential within each story; the foundation (T001–T008) gates everything; polish last. All work happens on `main` per the repository's established convention, committed at the final task.
