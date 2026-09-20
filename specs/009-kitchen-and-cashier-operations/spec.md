# Feature Specification: Kitchen and Cashier Operations (Phase 8)

**Feature Branch**: `009-kitchen-and-cashier-operations`

**Created**: 2026-09-20

**Status**: Draft

**Input**: Master plan §19 (Phase 8 — Kitchen and Cashier Operations): operational dashboards. The cashier sees live incoming rounds, accepts them, modifies orders within the approved rule, and views aggregated bill information; the kitchen sees its tickets and moves them through preparation. The round state machine (§8.2) is defined here: `new → accepted → preparing → ready → lock`.

## Clarifications

### Session 2026-09-20

- Q: When does a round become visible to kitchen — at submission (`new`) or only after the cashier accepts it? A: At submission. Kitchen sees `new` tickets immediately; cashier acceptance (`accepted`) confirms the order to the customer but is not a gate for kitchen visibility. (§19 exit condition: "a new customer round appears to the cashier and kitchen in realtime".)
- Q: Which modifications may a cashier perform on a submitted round? A: Remove an item line entirely, or reduce a line's quantity (never below 1; removal is the 1→0 path). No price editing, no item substitution, no adding items to an existing round (new items arrive as new rounds from Phase 7's flow; manual round entry is Phase 10 scope alongside bill/void). Modifications are allowed only while the round has not reached `lock`, and only before or during preparation — once the round is `ready`, the line list is frozen.
- Q: Who may lock a round, and when? A: The cashier (and owner/branch manager within scope) may lock a round once it is `ready` — lock is the operational "served" act that freezes the round against further modification and signals the aggregation boundary. Kitchen cannot lock.

## User Scenarios & Testing *(mandatory)*

### US1 — The round state machine (the core)

As a **staff member** I need submitted rounds to move through an explicit, permission-checked state flow (`new → accepted → preparing → ready → lock`) so that every surface agrees on where an order is and who may act next.

**Acceptance**:

- **Given** a submitted round (`new`), **when** the cashier accepts it, **then** state = `accepted`, recorded with actor and timestamp, audited.
- **Given** `accepted`, **when** kitchen starts preparation, **then** state = `preparing` (kitchen-actor; audited).
- **Given** `preparing`, **when** kitchen marks ready, **then** state = `ready` (kitchen-actor; audited).
- **Given** `ready`, **when** the cashier locks it, **then** state = `lock` — frozen: no further state change, no line modification (audited).
- Every illegal transition (skip, repeat, backward, kitchen acting past its authority, terminality from `lock`) is refused with a generic message and zero state change.
- Kitchen sees `new` tickets immediately (clarified posture); acceptance is the cashier's confirmation, not a kitchen gate.

### US2 — The cashier dashboard

As a **cashier** I need a live view of my branch's rounds — incoming (`new`), in progress (`accepted`/`preparing`), ready to serve (`ready`), and served (`lock`) — with accept and modify controls on the ones I may act on.

**Acceptance**:

- The dashboard is branch-scoped: a cashier sees only their branch's rounds; owner/branch manager can select within their scope (the 007 `?branch=` pattern).
- Each round card shows: session/table identity, the line items with quantities and captured prices, the round's state, and its running total (captured money, never recomputed).
- Accept is enabled on `new`; modify (remove line / reduce quantity) on `new`–`preparing`; lock on `ready`; nothing on `lock`.
- A modification recalculates nothing: the round's subtotal/tax columns are updated by the SERVER through the 006 tax engine's core on the reduced line set — the client never edits money (Risk 6).
- Refusals render verbatim; the card state reflects the server's truth after every action.

### US3 — The kitchen dashboard

As a **kitchen staff** I need my branch's ticket queue — what just arrived, what is being prepared, what is ready for pickup — so that the kitchen works the right orders in order.

**Acceptance**:

- Kitchen sees their branch's tickets in three columns (new / preparing / ready) with the items, quantities, and extras (no prices — the kitchen has no money concern).
- The only actions are "start preparation" (on `new`... on `accepted`) and "mark ready" (on `preparing`); everything else is read-only for kitchen.
- A just-submitted round appears in the queue without a manual reload (realtime delivery per §5.4; reconnect/reload recovers state from the database).
- Kitchen cannot access cashier operations (modify, lock, accept) — server-refused as well as hidden.

### US4 — Aggregated bill information & the audit trail

As a **cashier** I need the session's aggregated bill view (all rounds of a session with the captured totals) and, as **owner/manager**, every operational action to be traceable in the audit log.

**Acceptance**:

- The bill panel groups the session's rounds by state with the captured subtotal, tax lines, and total — display only; no payment concept (Constitution I).
- Accept/prepare/ready/lock transitions and every line modification write audit rows (`round.*`, `ticket.*` actions) with actor, resource, and scope — the §37 posture.
- The customer's own reads stay unaudited (the 007/008 posture); only staff operational actions audit.

## Edge Cases

- A round already `lock` receives an accept/prepare/ready/modify/lock attempt → refused, zero state change.
- A kitchen actor attempts accept, lock, or modify → refused (42501 posture) even if the UI hid the control.
- A staff member of another restaurant (or another branch, for branch-scoped staff) attempts any round action → denied like any other tenant resource.
- Concurrent actions on one round (cashier accepts while kitchen marks ready) → the first transition wins; the second is refused as an illegal transition from the new state. No partial state.
- A line quantity reduction to the count of 1 then further attempt → refused; removal is the only path to zero.
- Modifying a `ready`/`lock` round → refused (frozen).
- A round whose modification would empty the round entirely → allowed only by removing the last line while state permits; the round itself remains (an emptied round is a legitimate operational outcome — all items voided by the guest before preparation).
- A session closed (staff close) with rounds still `new`/`preparing` → the rounds remain readable; no new submissions can arrive (Phase 7's refusal); the state flow can still complete for record-keeping.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system enforces the round state machine `new → accepted → preparing → ready → lock` with exactly these legal transitions and no others; `lock` is terminal.
- **FR-002**: Accept (`new → accepted`) is restricted to the round's branch's cashier, branch manager, and the restaurant's owner; audited as `round.accepted`.
- **FR-003**: Start preparation (`accepted → preparing`) and mark ready (`preparing → ready`) are restricted to the round's branch's kitchen, cashier, branch manager, and owner; audited as `ticket.preparing` / `ticket.ready` (the ticket IS the kitchen's projection).
- **FR-004**: Lock (`ready → lock`) is restricted to cashier, branch manager, owner — never kitchen; audited as `round.locked`.
- **FR-005**: Staff reads of rounds/tickets are branch-scoped: kitchen, cashier, branch manager see only their branch; owner sees their restaurants'. Every read path derives scope from the authenticated identity (no client-supplied scope).
- **FR-006**: The cashier may remove a line from, or reduce a line's quantity (≥ 1) on, a round in state `new`/`accepted`/`preparing`; `ready`/`lock` rounds are frozen. Audited as `round.item_removed` / `round.item_quantity_reduced` with the change captured (before → after).
- **FR-007**: Every line modification re-derives the round's money through the shared tax engine core (`private.calculate_tax_totals`) over the surviving line set — captured values never drift from the menu-engine path (Risk 6).
- **FR-008**: Every state transition and modification returns the post-action round/ticket payload (state, lines, captured money) so the dashboards render the server's truth without a second read.
- **FR-009**: The bill aggregation is a read: the session's rounds grouped by state with captured subtotals, tax lines, totals, and the session's grand total. No payment, no invoice, no discount concept (Constitution I).
- **FR-010**: Kitchen's reads and actions never touch money: the ticket payload carries items, quantities, extras — no prices, no totals.
- **FR-011**: All new RPCs are `security definer`, token/identity-authorized as their first act, with the tenant refusals of the established vocabulary; the four order tables keep zero client grants — the RPCs remain the only write paths.
- **FR-012**: Every staff action that mutates state writes an audit row through `private.record_audit` with the actor derived from the JWT (never a client-supplied actor).
- **FR-013**: Realtime delivery of new/changed rounds to the dashboards is a transport over the database truth; a missed event is recovered by refetch (§5.4). The state machine and permissions live in the database, never in the transport.

### Constraints (from the constitution and master plan)

- The round/ticket tables keep **zero grants** — every new capability arrives as an RPC (Constitution IV).
- Realtime is Phase 12's transport concern; this phase ships the database truth + refetch (polling or invalidation) and the spec notes where the transport plugs in (§5.4, FR-013).
- No bill splitting, payment, void-after-bill, or discount anywhere (Constitution I; Phase 10 owns void/bill editing).
- Money math only through the engine core (Constitution II).
- Composite tenancy FKs everywhere (Constitution III).

### Key Entities

- **Round** (`rounds`, Phase 7): gains its full state lifecycle; its lines may be modified by the cashier within the rule.
- **Kitchen ticket** (`kitchen_tickets`, Phase 7): state opens from `'new'` to `accepted|preparing|ready`; it is the kitchen's projection of the round.
- **Audit log** (Phase 2 foundation): gains `round.*`/`ticket.*` actions with operational actor identity.

## Review & Acceptance Checklist

- [ ] Epic has clear user value
- [ ] All mandatory sections completed
- [ ] User stories are independently testable
- [ ] Each story has explicit acceptance criteria
- [ ] Edge cases enumerated with expected behavior
- [ ] Dependencies and assumptions documented
- [ ] No implementation detail in the spec (frameworks, APIs)
- [ ] Measurable success criteria present

### Dependency notes

- Phase 7's schema and RPCs are the substrate (rounds, tickets, tokens).
- Phase 3's RBAC supplies the identity/role resolution; Phase 2's audit foundation supplies `private.record_audit`.
- Phase 12 (realtime transport) consumes the read contracts unchanged.

## Success Criteria *(mandatory)*

- **SC-001**: Every legal transition succeeds and every illegal transition (skip/backward/repeat/terminal/wrong-actor) is refused with zero state change — proven by a full transition matrix in the database suite.
- **SC-002**: The concurrency case (two actors racing transitions) leaves exactly one winner and a consistent state.
- **SC-003**: A line modification changes the round's captured money exactly as a fresh engine calculation over the surviving lines would (no drift), audited with before/after.
- **SC-004**: The cashier and kitchen dashboards render branch-correct data for every seeded role, with cross-branch and cross-restaurant denials holding (the RBAC matrix extended to rounds).
- **SC-005**: The bill aggregation for a multi-round session sums the captured totals exactly (display-only arithmetic on captured values).
- **SC-006**: `npm run verify` and `npm run test:e2e` pass with the new suites; no new dependency; `package.json` unchanged.
