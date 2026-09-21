# Tasks: Delivery and Takeaway (Phase 9)

**Input**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

Tests are the gate: foundation suites first, then the client feature, then surfaces, then polish (the 008/009 order).

## Phase 9.1 — Setup

- [X] T001 Baseline: `git status` clean of Phase 9 work; `npm run test:db` green before any change
- [X] T002 Fixture facts: the seeded session/token/address UUID blocks in `tests/database/helpers/fixtures.ts`; add `deliverySessionIds`/`takeawaySessionIds` + the two new dev tokens + `channelTokenSession` (seed additions of data-model.md)

## Phase 9.2 — Foundation: the channel migration and its suites

- [X] T003 Create `supabase/migrations/<timestamp>_channel_schema.sql` (data-model.md; research.md §1–§4): widen `sessions_type_check` (drop-and-add); add `delivery_address` + the two checks; widen `rounds_state_check`; the `open_session_channel` RPC (contracts/database-functions.md §1 — the 007 validation texts, channel/address rules, token issuance, the 007 entry payload shape); the cutoff in `submit_round` (§2 — the two verbatim messages, dine-in untouched); `mark_out_for_delivery` + `mark_completed` (§3–§4 — 009 posture, delivery-only, cashier reach, kitchen 42501, audited `round.out_for_delivery`/`round.completed`); the read additions (§5 — `session_type` everywhere, `delivery_address` on branch rounds + bill only); grants per §6. Apply with `npm run db:migrate`
- [X] T004 Seed additions (data-model.md): the delivery + takeaway fixture sessions with dev tokens; apply with `npm run db:seed`
- [X] T005 Run `npm run types:gen` — the new RPC signatures land; committed, never hand-edited
- [X] T006 Create `tests/database/channel.schema.test.ts`: the widened checks' exact definitions; the address presence/immutability rules; the seven-state round check; the ticket check UNwidened
- [X] T007 Create `tests/database/channel.rpc.test.ts` — the channel matrix: entry validation (unknown restaurant/branch/inactive, wrong channel, missing address, takeaway address ignored) with the 007 texts; the delivery journey with ticket-stays-ready + audit rows; wrong-channel/wrong-role/illegal-order transitions refusing with ZERO change (dan 42501, dine-in/takeaway generic); the cutoff proofs (delivery at out_for_delivery, takeaway at ready, dine-in never, post-cutoff staff actions still work, token NOT cleared); the read shapes (session_type everywhere, address on bill/branch-rounds only, kitchen queue channel-blind); the one-customer-per-channel-session rule
- [X] T008 Mark the foundation complete: migration applied, seed deterministic, T006/T007 green

## Phase 9.3 — US1+US2: the client channel layer

- [X] T009 [US1] Extend `src/features/session/sessionClient.ts` (contracts/session-client.md §1, §3): `SessionChannel`, `enterSessionChannel` wrapping the new RPC with the 007 result discipline, the payload type extensions (`session_type`, `delivery_address`), the two cutoff messages mapped in the order client's error path
- [X] T010 [US1] Extend `src/features/order/orderClient.ts`: the cutoff refusals surface as `validation` with the verbatim text, cart preserved, token untouched (contracts/session-client.md §2)
- [X] T011 [US2] Extend `src/features/session/components/RestaurantEntry.tsx` (FR-002): the channel picker (dine-in default), the delivery address textarea with client bounds + live count, submit routing to the right RPC; extend `src/routes/CustomerMenuPage.tsx` + the indicator: the channel chip, the read-only delivery address (FR-010)

## Phase 9.4 — US3+US4: staff surfaces and e2e

- [X] T012 [US3] Extend `src/features/staffOps/staffOpsClient.ts` + `useStaffOps.ts`: `markOutForDelivery`/`markCompleted` wrappers + `useDeliveryTransition`, the extended `BranchRound`/`SessionBill` types (contracts/session-client.md §3)
- [X] T013 [US3] Extend `src/features/staffOps/components/RoundCard.tsx` + `src/routes/CashierRoundsPage.tsx` (FR-005, FR-009): the channel chip per card; "Send out for delivery" on delivery rounds in `ready`, "Mark completed" in `out_for_delivery`; the bill renders the delivery address when present; nothing changes for dine-in/takeaway cards
- [X] T014 [US4] Extend `e2e/session.surfaces.test.ts` with the channel block (serial file): the customer delivery entry through the browser (address validation + success), the cutoff refusal rendered above the preserved cart, the cashier's two new buttons on a real delivery round
- [X] T015 Create `tests/unit/channel.entry.test.ts`: the entry wrapper's validation mapping, the cutoff message identity, the token/cart preservation rules (no network)

## Phase 9.5 — Polish

- [X] T016 [P] Extend `docs/development.md` with the Phase 9 suite table (the channel matrix, the e2e block), the state-driven cutoff rationale, and the channel-blindness note (kitchen sees neither money nor addresses)
- [X] T017 Reset-and-rebuild determinism: `npm run db:reset -- --yes` → `npm run db:seed` → `npm run test:db` green; `npm run types:gen` byte-identical
- [X] T018 Full quality gate: `npm run verify` and `npm run test:e2e` both exit 0; `package.json` unchanged
- [X] T019 Run the quickstart walkthroughs (`scripts/run-channel-walkthroughs.mjs`) and append the validation record to `quickstart.md`; restore the project afterwards
- [X] T020 Final commit and push of all Phase 9 artifacts to GitHub `main` (the migration, seed additions, the client/surface extensions, regenerated types, the suites, `docs/development.md`, the spec artifacts)

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- The cutoff is STATE-driven, not clock-driven (research §2) — no scheduling, no per-branch config this phase
- `open_session_channel` never joins: one customer per channel session (research §1)
- The kitchen stays channel-blind: no address, no money, no new states (SC-004)
- `lock` stays dine-in-only; `completed` is delivery's terminal
- T010 (2026-09-21): verified no code change needed — `mapSessionError` maps `P0001` → `validation` with the server's verbatim message, and `submitRound` clears token/cart only on the unavailable-session refusal, so the cutoff messages ("…on its way…" / "…ready for pickup…") surface as validation with cart and token intact, exactly as the contract §2 requires
