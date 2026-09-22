# Feature Specification: Branch Reports (Phase 12)

**Feature Branch**: `013-branch-reports`

**Created**: 2026-09-22

**Status**: Draft

**Input**: Master plan §23 (Phase 12 — Reports): basic operational reporting
that never becomes a financial/accounting system. Owners get daily, weekly,
and monthly aggregates, best-selling items, branch comparison, channel
breakdown, void log, and audit log access; branch managers get the same
reporting domain limited to their branch; cashiers and kitchen get no
reporting dashboard. Reports are generated from normalized persisted data —
no independent "report totals" that can drift from source records, and
materialized strategies only when justified by measured performance need.

## User Scenarios & Testing *(mandatory)*

### US1 — The owner sees the operation in aggregates (P1, FR-001–FR-004)

The owner opens Reports. They pick a branch and a period (daily, weekly, or
monthly), and see for that scope: rounds submitted, rounds voided, net
submitted money after voids, best-selling items with quantities, and the
channel breakdown (dine-in / delivery / takeaway). Figures derive at read
time from the captured, already-valid data — the bill engine's totals, the
rounds' captured lines, the void overlay — never from a parallel total.

**Why**: an owner must steer the operation; captured data already encodes
every fact (Phase 6/7 capture discipline + Phase 10's void overlay make the
numbers trustworthy without new engines).

**Priority rationale**: the owner's view is the phase's reason to exist.

### US2 — The branch manager sees their branch, only their branch (P1, FR-005)

The same reports, permanently scoped to a branch the manager runs. No branch
picker; comparisons across branches are not part of their domain. A manager
requesting another branch's figures gets the generic refusal.

**Why**: same operational need, narrower authority — one permission surface,
one code path, two reaches.

**Priority rationale**: parity with US1 makes the reach boundary the only
difference; it ships with the owner view.

### US3 — The owner investigates the void log (P2, FR-006)

From Reports, the owner opens the void log: who voided what, when, and why —
read from the audit trail (Phase 10's inspectability), not a new ledger.

**Why**: voids are the phase's most consequential staff action; the trail
already exists, so the report is a filtered view of history.

### US4 — Nobody else gets a reporting surface (P2, FR-007–FR-009)

Cashiers and kitchen have no reporting dashboard, no report RPC reachable
through their role, and no route. Unauthenticated visitors get nothing.

**Why**: negative requirements prevent accidental expansion of the surface.

### Edge Cases

- An empty period (no rounds) renders zero-valued aggregates, not an error,
  for any reachable branch/period combination.
- A branch with no voids shows an empty void log, not an error.
- A manager cannot pass another branch's id: the RPC refuses with the
  generic staff refusal (indistinguishable from any other denial — 009's
  posture).
- A date range that crosses months/years aggregates by period boundaries,
  not by submission order.
- Extremely wide ranges (e.g., a full year of daily rows) return complete
  data; the contract caps granularity, not honesty.

### Assumptions

- Branch-scoped reports are per-branch; "branch comparison" (US1) is the
  owner-only view that places branches side by side over one period.
- Weekly periods start Monday; monthly periods are calendar months; "daily"
  means one calendar day. The client offers period selection, not arbitrary
  date math.
- Best-selling items rank by quantity sold (net of voids) within the period.
- The tax engine's VAT-inclusive capture means "money" figures are the
  captured totals the bill already shows (tax lines reported as captured,
  not recomputed).
- No exports (CSV/PDF), no scheduled emails, no custom date ranges: the
  phase's mandate is "basic operational reporting" and explicitly not a
  financial system.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system provides owner reports per branch per period
  (daily, weekly, monthly) containing: rounds submitted, rounds voided, net
  submitted money after voids, and the channel breakdown (dine-in, delivery,
  takeaway) — derived at read time from normalized persisted data.
- **FR-002**: The system ranks best-selling items by net quantity per branch
  per period.
- **FR-003**: The system provides a branch-comparison view for owners: the
  same aggregates placed side by side across all of the restaurant's
  branches for one period.
- **FR-004**: All money figures in reports come from the captured money
  columns/rows (Phase 6/7 discipline) with the Phase 10 void overlay
  applied; the system never maintains separate report totals that can drift
  from source records.
- **FR-005**: The system limits managers to the same reports for branches
  they manage; a manager passing a branch outside their reach receives the
  generic staff refusal, indistinguishable from any other denial.
- **FR-006**: The system exposes the void log (who, what, when, reason) as a
  report view sourced from the audit trail (Phase 10), reachable for the
  same roles as the aggregates.
- **FR-007**: The system provides no reporting surface to cashier or kitchen
  roles: no report RPC accepts their role, no route renders for them, and
  report views are absent from their navigation.
- **FR-008**: The system refuses unauthenticated report requests with the
  generic refusal (no existence leaks).
- **FR-009**: The system renders reports in the staff dashboard shell with
  owner/manager-gated routes; absent authorization, the route denies (the
  audit page's posture).
- **FR-010**: Report periods are calendar-aligned (day / ISO week starting
  Monday / calendar month); the client submits period parameters, never
  client-computed totals.

### Key Entities

- **Report period** — a calendar-aligned window (day/week/month) plus branch
  scope; the aggregate query's only parameters.
- **Report aggregate** — the per-period per-branch numbers: rounds submitted,
  rounds voided, net money after voids, per-channel split, best-selling
  items; all derived from `rounds` (captured lines, void overlay) and
  `sessions` (channel).
- **Void log entry** — an audit-trail projection (Phase 10's
  `get_audit_log`), filtered to `round.void` actions, for the same reach
  rules as the aggregates.

### Clarifications

*(none — constraints from the master plan, Phases 6–10 artifacts, and the
established architecture resolve every question this spec raised; see
plan.md's Constitution checks for the derivation)*

## Review & Acceptance Checklist

*GATE: Quality gates for the implement phase — the reviewer (not the
implementation) owns these.*

- [ ] All user scenarios implemented and demonstrated in walkthroughs
- [ ] All functional requirements covered by database/UI/e2e tests
- [ ] Money figures in every report reconcile to a hand-computed derivation
      from source rows (the anti-drift proof)
- [ ] Manager reach boundary proven (own branch OK, foreign branch refused)
- [ ] Cashier/kitchen absence proven (no route, no RPC, no nav)
- [ ] Empty-period and empty-void-log rendering verified

---

*Phase 12 of RestoPilot-Master-Plan.md (§23). Build on 006–011: the captured
money, the void overlay, the audit trail, and the session/round substrate
are the only inputs; no new accounting semantics are introduced.*
