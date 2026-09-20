# Implementation Plan: Kitchen and Cashier Operations (Phase 8)

**Branch**: `009-kitchen-and-cashier-operations` | **Spec**: [spec.md](spec.md) | **Created**: 2026-09-20

## Summary

The operational dashboards over Phase 7's substrate: the round state machine
(`new → accepted → preparing → ready → lock`, terminal, permission-checked,
audited) lives in the DATABASE as five staff RPCs plus two branch-scoped read
RPCs (cashier rounds view, kitchen ticket view — no prices there), a
session-bill aggregation read, and a line-modification RPC that re-derives the
round's money through `private.calculate_tax_totals`. The client gains one
`staffOps` feature (hooks + two dashboard routes + the bill panel) consuming
those RPCs with the established error machinery. Realtime transport is
explicitly out of scope (Phase 12); dashboards recover state through
refetch/invalidation (§5.4).

## Technical Context

**Language/Runtime**: TypeScript (React 19 + Vite), PostgreSQL 15+ (Supabase)
**Styling**: existing CSS conventions only — no new dependency
**Testing**: vitest (unit + database + integration), Playwright (e2e)
**Concurrency control**: row-level state transitions guarded by `where state = <expected>` guards inside `security definer` RPCs — the update's row count decides the winner (Risk 7)
**State machine authority**: the database's transition guards; the transport never carries state (§5.4)

## Constitution check (all eight, pass/fail)

| # | Principle | Status |
|---|-----------|--------|
| I | No payment/bill/accounting concepts | PASS — the bill panel is display-only aggregation of captured values; void remains Phase 10 |
| II | Single canonical money math | PASS — modifications re-derive through `private.calculate_tax_totals` (FR-007) |
| III | Composite tenancy FKs | PASS — new tables/FKs composite; existing shapes reused |
| IV | Zero grants, RPC-only writes | PASS — all four order tables keep zero grants; seven new RPCs join the surface |
| V | DB is the source of truth; clients advisory | PASS — realtime is transport-only (FR-013, Phase 12); dashboards refetch |
| VI | Closed state shapes | PASS — `rounds.state` widens with a named check; `kitchen_tickets.state` likewise; `lock` terminal |
| VII | Customer actions unaudited | PASS — only staff operational actions audit (FR-012) |
| VIII | Minimal schema surface | PASS — 0 new tables, 0 new columns, 2 check-constraint replacements, 7 functions, 0 dependencies |

## Design decisions (research.md holds the full reasoning)

1. **State machine in guarded UPDATEs, not a procedure.** Each transition RPC
   runs `update … where id = $1 and state = '<expected-from>'` (+ tenant
   guards) and raises the generic refusal when `row_count = 0`. The guard is
   the concurrency arbiter (two racers: one update matches, the other doesn't)
   — no advisory locks, no retry loops.
2. **`kitchen_tickets.state` carries the kitchen lifecycle; `rounds.state`
   mirrors the operational one.** Accept/lock write `rounds`; preparing/ready
   write `kitchen_tickets`; the round's state is kept in sync with the ticket's
   (the round IS the aggregate; the ticket the projection). Both columns'
   checks widen via drop-and-re-add in this phase's migration.
3. **Reads derive scope from the JWT** (`private.staff_branch_ids` /
   `owned_restaurant_ids` / the `staff_memberships` join) — no client-supplied
   scope, the 007 `list_open_sessions` pattern.
4. **Modification = line surgery + engine re-derivation.** Remove/reduce runs
   in one body: apply the line change, re-run `private.calculate_tax_totals`
   over the surviving lines, update the round's captured columns, audit with
   before→after. Any failure aborts all (one transaction).
5. **Audit through `private.record_audit`** with the actor from
   `private.staff_profile_ids((select auth.uid()))` — never a client value.

## Data Model (delta)

No new tables, no new columns. Two check constraints widen:

- `rounds_state_check`: `state in ('new','accepted','preparing','ready','lock')`
- `kitchen_tickets_state_check`: `state in ('new','accepted','preparing','ready')`
  (the ticket never enters `lock` — the round carries it)

## RPC surface (contracts/database-functions.md)

| Function | Authorization | State effect | Audit |
|---|---|---|---|
| `accept_round(p_round_id)` | cashier/manager of the branch, owner of the restaurant | `rounds: new → accepted` | `round.accepted` |
| `start_preparation(p_round_id)` | kitchen/cashier/manager of the branch, owner | `tickets: → preparing` (round follows) | `ticket.preparing` |
| `mark_round_ready(p_round_id)` | same set | `tickets: → ready` (round follows) | `ticket.ready` |
| `lock_round(p_round_id)` | cashier/manager, owner — never kitchen | `rounds: ready → lock` (terminal) | `round.locked` |
| `modify_round_line(p_round_id, p_item_id, p_action, p_quantity?)` | cashier/manager, owner | line removed/quantity reduced; money re-derived | `round.item_removed` / `round.item_quantity_reduced` |
| `get_branch_rounds(p_branch_id, p_states?)` | branch-scoped staff read (cashier dashboard) | — | — |
| `get_kitchen_queue(p_branch_id)` | kitchen/cashier/manager read — no money in payload | — | — |
| `get_session_bill(p_session_id)` | staff read of the session's captured totals | — | — |

## Client surface (contracts/staff-ops-client.md)

- `src/features/staffOps/staffOpsClient.ts` — the typed wrappers + payload parsers (007 machinery).
- `src/features/staffOps/useStaffOps.ts` — `useBranchRounds`, `useKitchenQueue`, the transition/modification mutations (each invalidates both dashboards' keys).
- `src/routes/KitchenDashboardPage.tsx` (three-column queue), `src/routes/CashierRoundsPage.tsx` (branch-scoped round cards + bill panel), router + dashboard nav entries with role-derived gates.

## Project Structure

```
supabase/migrations/<ts>_round_lifecycle.sql     (checks widen + 8 RPCs)
src/features/staffOps/{staffOpsClient.ts, useStaffOps.ts}
src/features/staffOps/components/{RoundCard.tsx, TicketCard.tsx, BillPanel.tsx}
src/routes/{KitchenDashboardPage.tsx, CashierRoundsPage.tsx}
tests/database/round.lifecycle.test.ts           (transition matrix, RBAC, audit)
tests/database/round.modify.test.ts              (surgery, engine re-derivation, atomicity)
tests/unit/staffops.client.test.ts
tests/integration/round.journey.test.ts
e2e/kitchen.cashier.test.ts
```

## Risks & mitigations

- **Risk 7 (concurrency)** — guarded updates decide the winner; race proven in the database suite with two interleaved transitions.
- **Risk 6 (money drift)** — modification re-derives through the engine core; cross-checked against a fresh calculation in the suite.
- **Scope creep (Risk 8)** — no void, no bill editing, no stock, no realtime transport; each named in spec's Constraints.
