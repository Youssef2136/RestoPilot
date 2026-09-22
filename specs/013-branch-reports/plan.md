# Implementation Plan: Branch Reports (Phase 12)

**Branch**: `013-branch-reports` | **Spec**: [spec.md](spec.md) | **Created**: 2026-09-22

## Summary

Read-only operational reporting over the Phase 6–11 substrate: two security
definer RPCs (`get_branch_sales_report`, `get_branch_void_report`) derive
every figure at read time from `rounds` (captured `subtotal`/`tax_total`,
the `voided` overlay) joined to `sessions` (channel `type`), with calendar-
aligned buckets computed in SQL and the reach boundary reusing
`private.has_branch_role` verbatim (owner = restaurant-wide, manager = their
branch union, cashier/kitchen/anon = `42501`). The audit trail needs NO new
RPC — Phase 10's `get_audit_log` already returns void history for the same
roles via `p_action = 'round.void'`; the UI filters. The client adds one
`src/features/reports/` module (client + hook + four route surfaces under
the staff shell) and renders the server's aggregates verbatim — zero client
money math, zero new write paths, zero new tables.

## Technical Context (from the codebase)

- Rounds carry captured money: `rounds.subtotal`, `rounds.tax_total`, `rounds.tax_lines` (Phase 7 capture discipline) + the Phase 10 void overlay (`voided`, `voided_at`, `voided_by_profile_id`, `void_reason`)
- Sessions carry the channel: `sessions.type` (dine_in / delivery / takeaway), `status`, `opened_at` — confirmed live
- Phase 10 read precedent: `get_audit_log(actor, p_restaurant_id, p_branch_id?, p_action?, p_limit)` — owner restaurant-wide, manager = union of managed branches, cashier/kitchen/anon = `42501`; the void log view needs only a filter value
- `private.has_branch_role(p_actor uuid, p_restaurant_id uuid, p_branch_id uuid)` is the verbatim reach helper every staff RPC reuses (009–012)
- Refusal vocabulary: generic `42501`/`P0001` indistinguishable refusals (009 posture); report inputs are validated but never leak existence
- React Query owns all reads; `src/features/reports/` follows the established `*Client.ts` + `use*.ts` + `components/` module shape
- Staff shell routing: owner/manager-gated routes with a denial state, as `/dashboard/audit` (Phase 10); cashiers/kitchen have no nav entry

## Constitution Alignment

- **I (client displays the server's captured truth)**: the client renders RPC aggregates verbatim; periods are the only client input
- **II (money math is server-only)**: every sum, bucket, and rank is computed in SQL from captured columns; the client formats, never computes (FR-004)
- **III (engines live in the database)**: the report engine is two SQL functions; no materialized view, no parallel totals table (§23's anti-drift rule, D1)
- **IV (data layer is the boundary)**: reach via `has_branch_role` verbatim; cashier/kitchen refuse identically (FR-007/FR-008)
- **V (privacy)**: reports expose aggregates and staff audit rows only; no customer PII beyond what the audit trail already returns (void actor names are staff)

## Design Decisions

### D1 — Pure read-time SQL, no materialized views (§23's explicit rule)

"Reports should be generated from normalized persisted data. Avoid
maintaining multiple independent report totals that can drift. Use
materialized strategies only when justified by MEASURED performance need."
The implementation is a parameterized aggregate query (bucket by
`opened_at`-aligned window over the branch's rounds); no summary table, no
MV, no trigger-maintained counters. A measured need can justify an MV later
without changing the contract — the RPC shape already isolates callers.

### D2 — Period buckets computed in SQL, in the database's timezone

The RPC takes `p_branch_id`, `p_period` (`'day' | 'week' | 'month'`), and a
representative `p_anchor_date` (a date inside the wanted bucket — one day,
one week, or the 1st of a month). SQL computes the bucket boundaries with
`date_trunc` in the database's timezone; the client submits an ISO date
string and renders whatever window the server says the bucket covers.
Weekly buckets start Monday (`date_trunc('week', ...)` in a Monday-first
`lc_time`/`SET DateStyle`-independent implementation: `(extract(doy) - ...)`
is fragile — instead `date_trunc('week', d)` with the session's
`DateStyle` is ISO/Monday in Postgres by default). The comparison view is
the SAME function: the client calls it once per branch (the owner's branches
are already known from the staff context) — no second SQL shape to keep in
step.

### D3 — The void log reuses `get_audit_log` (no new RPC)

US3's void log = audit rows where `action = 'round.void'` (written by
Phase 10's `void_round`). `get_audit_log` already: authorizes exactly the
roles this spec names (FR-006), scopes owner restaurant-wide / manager to
their managed-branch union, filters by action and branch, and caps at 200.
A second RPC would duplicate its authorization with drift risk. The client
`void report` page calls `get_audit_log` with `p_action='round.void'` and
renders `actor_name`/`resource_id`/`reason`/`created_at`.

### D4 — Net-of-void is a WHERE, best-sellers are a JOIN

Rounds contributed to a period when their session's `opened_at` falls in the
bucket (the session is the receipt's anchor — matches the bill's session
framing). "Rounds submitted" counts all rows; "rounds voided" counts
`voided`; "net money" sums `subtotal + tax_total` over `where not voided`;
the channel breakdown groups by `sessions.type` with the same net predicate;
best-sellers aggregate `round_items.quantity` joined through non-voided
rounds, ranked `order by quantity desc, name asc` limited to 10. Tax lines
are reported as captured per period only as part of net money (the
`tax_lines` jsonb already reconciles; no re-derivation).

### D5 — Empty periods are zero rows, not errors

The function left-joins the bucket against rounds and returns zero-valued
aggregates with an empty best-seller array; the UI renders the zero state.
A branch outside the actor's reach refuses with the generic staff refusal
BEFORE any data access (the 009 ordering: identity → reach → read), so an
out-of-reach branch is indistinguishable from any other denial.

## Risks / Trade-offs

- **Read cost grows with history** — accepted per §23; the anchor+bucket
  shape keeps each query bounded to one window; an index on
  `sessions(branch_id, opened_at)` already serves the join.
- **Per-branch N-calls comparison** (D2) — trivially parallel for a handful
  of branches; avoids a second SQL shape and a second authorization variant.
- **`round_items` captured prices** (not current menu prices) rank
  best-sellers — correct: reports describe what WAS sold.

## Verification

- `test:db`: reach matrix (owner/manager-own/manager-foreign/cashier/kitchen/anon), bucket math (day/week/month incl. year boundary + empty bucket), anti-drift proof (report total reconciles to a hand-summed derivation from `rounds`+`sessions`+`round_items` in the test), channel split, best-seller ranking, void overlay effects
- unit: reports client refusal mapping + hook parameter shaping
- e2e: owner sees aggregates + comparison; manager limited to own branch (no picker, foreign refused); cashier/kitchen no route/nav; void log page lists the Phase 10 walkthrough void; empty-period zero state
- quickstart walkthroughs: real sign-ins computing a seeded period and reconciling against SQL hand-derivation
