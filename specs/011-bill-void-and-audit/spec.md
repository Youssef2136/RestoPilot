# Feature Specification: Bill, Void, and Audit (Phase 10)

**Feature Branch**: `011-bill-void-and-audit`

**Created**: 2026-09-21

**Status**: Draft

**Input**: Master plan §21 (Phase 10 — Bill, Void, and Audit): finish the operational accounting-display boundary without becoming a POS. The bill shows subtotal, item totals, extras, taxes, and the final total (with optional per-person visibility); the system never processes payment — the POS remains responsible for payment and printing. Cashier edits follow the approved rule (no mandatory reason, still audited). A post-billing void requires authorized cashier-level permission, a mandatory reason, and a separate void record. Audit captures actor, timestamp, operation, target record, and reason at minimum.

## Clarifications

*(All decisions resolved from the master plan's own definitions and the existing 005–010 contracts; none required user input.)*

- **Q: What does "post-billing void" mean in a system that never bills?** A: The master plan's bill is a display artifact (§21: "the POS remains responsible for actual payment and printing"), so "post-billing" maps onto the existing state machine: a void is permitted on any round that has reached a terminal-or-beyond state in its channel — `lock` for dine-in and `out_for_delivery`/`completed` for delivery — plus `ready`+ rounds for takeaway (whose cutoff means "no more orders"). Voiding an in-flight (`new`/`accepted`/`preparing`) round is NOT a void — that is the existing `modify_round_line` removal path. A voided round keeps its rows and is marked voided (no destructive deletes; Constitution IV's auditability), the void is audited with the mandatory reason, and the voided round's money is excluded from the session bill's totals with an explicit voided section shown.
- **Q: What is the void's effect on the kitchen ticket?** A: None retroactively beyond what already exists — the ticket keeps its final state (the kitchen already did or did not do the work; the void record documents the business outcome, it does not rewrite kitchen history). A voided round's ticket is displayed as voided alongside the round.
- **Q: Who may void?** A: "Authorized cashier-level permission" (§21) = the same cashier/branch_manager reach as the 009 transitions (owner reach included, kitchen denied, fiona denied). No new permission tier this phase.
- **Q: What does "optional per-person visibility" mean for the bill?** A: The bill shows the session's participants alongside their rounds (the join data already exists in `session_participants`). This phase renders the participant list on the staff bill; no per-person splitting or per-person totals computation (no bill splitting anywhere — 009's boundary holds).
- **Q: Does Phase 10 include "manual round entry"?** A: 009's spec named manual round entry as Phase 10 scope "alongside bill/void", but master plan §21 defines Phase 10's scope as bill display, edit per the approved rule, void, and audit — no manual entry. The approved edit rule already shipped in 009 (`modify_round_line`). This phase delivers §21's scope and defers manual entry (it remains unbuilt by any phase; noted as an open master-plan item, not silently dropped).

## User Stories & Acceptance Scenarios

### US1 — The bill as the operational accounting display (Priority: P1)

**Actor**: Cashier (or branch manager)

The cashier opens a session's bill and sees the complete accounting display: every round's subtotal, the item totals with their extras and captured prices, the captured tax lines, and the session's final total — plus who was at the table (participants). Nothing on the bill computes, discounts, or processes payment; it is the authoritative display of captured money for the POS to act on.

**Acceptance scenarios**:
1. **Given** a dine-in session with two rounds (items with extras), **when** the cashier views the bill, **then** each round shows its lines (name × quantity, unit price, extras with adjustments), the round subtotal, the tax lines by name/amount, and the session grand total — all values byte-identical to the captured values (SC-001).
2. **Given** the same session, **when** the bill renders, **then** the participants (name, joined time) are listed ("per-person visibility"), with no per-person totals computed (FR-004).
3. **Given** any bill, **when** inspected, **then** no payment, discount, splitting, or printing concept appears anywhere in the surface or the payloads (Constitution I boundary restated).

### US2 — Void with reason (Priority: P2)

**Actor**: Cashier (or branch manager; kitchen and non-staff denied)

A round past its terminal boundary (`lock` dine-in / `ready`+ takeaway / `out_for_delivery`+ delivery) can be voided by an authorized cashier with a MANDATORY reason. The void is a separate, auditable record: the round keeps its rows and money, is marked `voided` (a displayed flag, not a state-machine position — voiding does not rewind or rewrite the lifecycle), the kitchen ticket is shown as voided alongside, and the session bill excludes the voided round's money from the totals while listing the void explicitly.

**Acceptance scenarios**:
1. **Given** a locked dine-in round, **when** the cashier voids it with reason "Guest left — order cancelled", **then** the round is marked voided, the money is excluded from the bill totals with the void shown in its own section, and an audit row records actor/timestamp/`round.void`/target round/reason (SC-002, SC-003).
2. **Given** the same void attempt with an empty (whitespace) reason, **when** submitted, **then** the refusal "A void reason is required." renders verbatim and nothing changes (FR-006).
3. **Given** an in-flight round (`new`/`accepted`/`preparing`), **when** the void RPC is called, **then** the generic refusal renders and the state is unchanged — void is not the edit path (FR-005).
4. **Given** dan (kitchen) or fiona (no role), **when** calling the void RPC, **then** the denial (`42501`) renders; zero rows change (FR-007).
5. **Given** a delivery round in `out_for_delivery` or `completed`, **when** voided, **then** the same rules apply (channel-agnostic void boundary per clarification 1).

### US3 — The audit trail is inspectable (Priority: P3)

**Actor**: Owner / branch manager

The operational audit trail (which 005–010 have been writing all along) becomes inspectable: the owner/branch-manager surface lists audit entries — actor, timestamp, operation, target, and reason where present — for their scope, newest first, filterable by operation and branch. Cashiers see nothing (the audit trail is management-level), and the kitchen never sees it.

**Acceptance scenarios**:
1. **Given** the owner, **when** opening the audit page, **then** the entries render actor name, action, resource type/id, branch, timestamp, and the void reason where present, newest first (FR-009).
2. **Given** a branch manager of one branch, **when** opening the audit page, **then** only their branch's entries render (silent `[]` filtering — the 009 read posture, SC-004).
3. **Given** carla (cashier), **when** navigating to the audit route, **then** access is refused (role-gated route + server-side reach check, FR-010).

## Functional Requirements

- **FR-001**: The session bill payload extends with: per-round line detail (item name, quantity, captured unit price, extras with captured adjustments), captured tax lines, and the session's participant list. All money figures are the captured values exactly as stored — the payload computes nothing.
- **FR-002**: The bill renders the participants (per-person visibility) with no per-person totals, splitting, or per-person payment concept.
- **FR-003**: The bill's grand total is the sum of the NON-voided rounds' captured totals; voided rounds render in an explicit voided section (round id, captured totals, void reason) excluded from the grand total.
- **FR-004**: A void is available only on rounds at-or-past their channel's terminal boundary (`lock` for dine-in, `ready`+ for takeaway, `out_for_delivery`+ for delivery), enforced server-side; the client enables the control on exactly those states.
- **FR-005**: The void RPC refuses (generic refusal, zero change) any round not at its void boundary — void is not a substitute for the edit path.
- **FR-006**: The void reason is mandatory: empty/whitespace or >500 characters refuses with a verbatim validation message; the reason is stored on the void record (audit `reason` + the round's void marker) verbatim.
- **FR-007**: Void permission = cashier/branch_manager/owner reach on the round's branch (the 009 posture); kitchen, anon, and cross-branch identities are denied with the generic denial; every refusal leaves zero rows changed.
- **FR-008**: A void marks the round voided (flag + `voided_at`/`voided_by`), keeps all rows and captured money intact (no destructive writes), shows the kitchen ticket as voided alongside, and audits as `round.void` with the reason.
- **FR-009**: An audit read RPC (owner: restaurant-wide; branch_manager: their branch; cashier/kitchen: denied) returns entries newest-first with actor display name, action, resource type/id, branch label, timestamp, and reason where present; filtered by operation and branch.
- **FR-010**: The audit surface is role-gated (route + payload); voids, edits, transitions, session closures, and entry actions all appear in the trail with the vocabulary already established (`round.accepted` … `round.completed`, `round.void`, `session.closed`).
- **FR-011**: Voiding a delivery round does not resurrect the cutoff — the cutoff's refusal persists regardless of the voided flag (the round's lifecycle states are unchanged by voiding).

## Success Criteria

- **SC-001**: A bill's every figure is byte-identical to the captured values (spot-checkable against the rounds history and the tax lines); the payload computes nothing.
- **SC-002**: A voided round's money is excluded from the bill's grand total and listed in the voided section with its reason — provable by comparing the bill before/after a void.
- **SC-003**: Every void produces exactly one `round.void` audit row carrying actor, timestamp, target round, and the verbatim reason.
- **SC-004**: A branch manager sees only their branch's audit entries; a cross-branch probe returns zero rows without error.
- **SC-005**: All void refusals (state, reason, permission) leave zero rows changed — provable by before/after row reads.

## Boundaries (what this phase does NOT do)

- No payment processing, printing, receipt generation, or POS integration anywhere.
- No bill splitting, per-person totals, or discounts.
- No void of in-flight rounds (that is the edit path), no "un-void", no void reason editing.
- No audit retention policy changes, no audit editing/deletion (the log is append-only, as built).
- No manual round entry (see clarification 5 — an open master-plan item).

## Review & Acceptance Checklist (gate)

*Gate: gate — reviewer-owned; see checklists/.*
