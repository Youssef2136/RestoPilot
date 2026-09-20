# Implementation Plan: Cart and Rounds (Phase 7)

**Branch**: `008-cart-and-rounds` | **Spec**: [spec.md](spec.md) | **Created**: 2026-09-20

## Summary

The core ordering engine: a client-side cart (localStorage, session-scoped, advisory)
and the atomic round-submission transaction — validate session/availability/extras,
capture prices, calculate taxes through the feature 006 engine, create the round +
items + extras + exactly one kitchen ticket, commit — plus the server-side round
history for reload recovery. No realtime, no state transitions, no staff surfaces
(Phases 8/012).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Vite 7 (existing app; `npm run verify` is the gate)
**Data layer**: Supabase-hosted Postgres — migrations via `supabase migration new`, applied with `npm run db:migrate`; seed via `npm run db:seed`; types via `npm run types:gen` (the single canonical workflow)
**New dependencies**: none (Constitution VIII)
**Storage**: browser `localStorage` for the cart (client-only, advisory); Postgres for everything server-side
**Testing**: vitest (schema/RPC matrices, unit, integration), Playwright (e2e), walkthrough scripts

## Constitution Check (pre-design)

- **I (no payment/accounting)**: rounds capture prices and taxes only — no bill settlement, no discounts, no tips. PASS.
- **II (deterministic money math)**: tax capture delegates to `calculate_branch_taxes` (the audited 006 engine — half-up, line-boundary rounding); captured prices are `numeric(12,2)` strings end to end. PASS.
- **III (composite tenancy)**: every new table carries `(restaurant_id, …)` composite foreign keys per the established schema. PASS.
- **IV (zero client grants, RPC-only writes)**: five new tables with `revoke all … from anon, authenticated` and NO grants; the two RPCs (`submit_round`, `get_session_rounds`) are the only paths, security definer with `set search_path = ''`. PASS.
- **V (DB as truth)**: the cart is advisory; the server re-validates everything and owns the round record; recovery reads the server. PASS.
- **VI (closed shapes)**: `state` columns born with single-value checks (`'new'`), quantities bounds-checked, the ticket's 1-per-round uniqueness is a partial unique index. PASS.
- **VII (audited staff actions)**: submissions are customer actions by unauthenticated identities — no audit rows (the 007 posture); Phase 8's staff actions will audit. PASS.
- **VIII (minimal surface)**: 5 tables, 2 RPCs, 0 dependencies, 1 client module. PASS.

## Research & Decisions

See [research.md](research.md) for the resolved questions:

1. **Reuse of the 006 engine inside the submission** — `calculate_branch_taxes(p_branch_id, p_selections)` is `security invoker` but resolves to the definer's effective role when called from the submission function; its tables are readable by the owner role. It validates selection shape strictly and fails closed — the submission validates availability/branch-membership first, then delegates the money math.
2. **Extras have no retirement state** — `menu_item_extras` rows are never deleted (restrict FK); validation is a scope check (the extra must belong to the submitted item), which also refuses stale client copies. The spec's "retired extra" edge case resolves to this scope refusal.
3. **Ticket items are the round's items** — a separate `kitchen_ticket_items` copy of the same rows could drift (the Risk 6 anti-pattern). The ticket is a header row (one per round, own state column); its items ARE the round's items by construction, proven by tests. Phase 8 denormalizes only if its surfaces require it.
4. **Cart scoping** — the cart payload stores the session token it was built under; a cart whose stored token no longer matches the device's session token renders empty (a re-entry at another table never inherits a foreign cart), and session-clear paths clear the cart key.

## Data Model (new tables)

See [data-model.md](data-model.md): `rounds`, `round_items`, `round_item_extras`, `kitchen_tickets` (4 tables; the ticket's items are the round's), zero grants, composite FKs, closed checks.

## API Surface (2 functions)

See [contracts/database-functions.md](contracts/database-functions.md): `submit_round(p_token text, p_items jsonb) → jsonb` and `get_session_rounds(p_token text) → jsonb`, both `security definer, set search_path = ''`, token-authorized with the established indistinguishable refusal.

## Client Surface

See [contracts/order-client.md](contracts/order-client.md): the cart state module (localStorage key `restopilot.cart`, token-scoped), the two RPC wrappers reusing 007's token/error machinery, the cart UI on the customer menu route, and the rounds history section.

## Phases

1. **Foundation**: fixture constants; the schema migration (4 tables, constraints, indexes, zero grants); the RPCs migration; types regeneration.
2. **US1 — the cart**: cart state module + unit tests; the cart UI on the customer menu (add/configure/adjust/remove/total); reload persistence; no-session posture.
3. **US2 — submission**: the client wrapper + mutation; the submission UI (submit button, refusals verbatim, cart-clear-on-success); the database atomicity suite (every refusal class leaves zero rows; the engine cross-check).
4. **US3 — rounds history**: `get_session_rounds` reads; the history section on the customer menu; the integration journey (two rounds, reload recovery).
5. **US4 — ticket integrity**: the database proofs (one ticket per round, mirrors items, no direct writes).
6. **Polish**: docs, determinism, full gate, walkthroughs, final commit + push.

## Risks

- **Risk 6 (price/tax drift)**: prices captured in-transaction from the menu tables; taxes captured from the engine's output; SC-004's automated recompute cross-check.
- **Risk 7 (concurrency)**: single-statement-entry transaction semantics; row-level integrity via FKs/unique indexes; double-submit is two independent atomic rounds (no partial state); the race suite exercises concurrent submissions.
- **Scope creep**: realtime, state transitions, and staff surfaces are cited deferrals (Out of Scope) — the converge step checks the diff against them.
