# Feature Specification: Delivery and Takeaway (Phase 9)

**Feature Branch**: `010-delivery-and-takeaway`

**Created**: 2026-09-20

**Status**: Draft

**Input**: Master plan §20 (Phase 9 — Delivery and Takeaway): reuse the same ordering/session infrastructure for non-dine-in channels. Delivery: customer supplies name, phone, delivery address; the session starts with the first order; the session locks for additional orders at the delivery cutoff. Takeaway: the same architecture with the pickup cutoff. **Principle**: do not create a separate order engine — sessions, rounds, pricing, tax, kitchen, cashier, and audit are reused; only channel-specific behavior varies.

## Clarifications

### 2026-09-20 (resolved from the master plan's own definitions)

- **Q1: What happens to the round state machine for delivery?** §8.3: delivery rounds extend the Phase 8 machine with two terminal-approach states — `new → accepted → preparing → ready → out_for_delivery → completed`. Takeaway rounds use the existing Phase 8 machine ending at `ready` (the pickup cutoff is tied to the item being ready). The `lock` state remains the Phase 8 served/terminal state for dine-in and is NOT used as a delivery terminal; `completed` is delivery's terminal.
- **Q2: When exactly is the cutoff?** The cutoff is a per-branch, channel-specific setting: after the cutoff fires, the session refuses ADDITIONAL rounds but existing rounds keep moving through their machine. For takeaway the cutoff is tied to an item being ready (once any round of the session reaches `ready`, no further orders are accepted). For delivery the cutoff is tied to the round leaving `ready` (`out_for_delivery`) — after the first round goes out, no further orders. This is conservative, deterministic, and test-provable without wall-clock scheduling.
- **Q3: Who creates a delivery/takeaway session and where does the address live?** The customer self-serves through the same public entry flow with a channel choice: delivery asks for name + phone + delivery address; takeaway asks for name + phone only. The address lives on the SESSION (one delivery address per session), captured at entry, never edited afterward (a wrong address = close the session and start over, mirroring the dine-in join model). Takeaway sessions carry no address.
- **Q4: Do staff dashboards change?** Only channel-awareness: the rounds/tickets surfaces display the channel (dine-in/delivery/takeaway) and, for delivery, expose the two new transitions (out for delivery, completed) to the cashier. The kitchen never sees addresses or money (unchanged); the cashier sees the address on delivery sessions in the bill/rounds view.

## User Scenarios & Testing

### US1: The customer entry flow gains channels

**Given** a customer opens the public restaurant page **when** they choose the delivery or takeaway channel instead of a dine-in table **then** the form adapts (delivery: name, phone, address; takeaway: name, phone), the session is created with the chosen channel type, and they land on the same customer menu surface with their cart and history — identical to dine-in from this point on.

**Acceptance**: the entry payload exposes the channel choice; a dine-in entry still requires a table; a delivery entry without an address refuses with the client-side bounds feedback; a takeaway entry never asks for a table or an address.

### US2: Ordering works identically through the reused engine

**Given** a delivery or takeaway session **when** the customer submits rounds **then** the submission path, captured prices, tax engine, kitchen tickets, and audit rows are exactly the Phase 7/8 machinery — no channel-specific forks in the money or kitchen path.

**Acceptance**: a delivery round and a dine-in round for the same item produce identical captured money and ticket structure; only session type (and address) differ.

### US3: The channel lifecycles move through the extended machine

**Given** accepted delivery rounds **when** staff act **then** `out_for_delivery` and `completed` transitions exist for the cashier role only, in order, refusal-verbatim, zero-change on every illegal move (the Phase 8 posture). Takeaway rounds terminate at `ready` — `out_for_delivery`/`completed` are impossible for them.

**Acceptance**: the full delivery chain works as each allowed role; backward/skip/terminal moves refuse; audit rows carry the extended actions; the ticket machine does NOT extend (tickets end at `ready` for every channel).

### US4: The cutoff refuses additional orders at the right moment

**Given** a delivery session whose first round went `out_for_delivery`, or a takeaway session with a `ready` round **when** the customer tries to submit another round **then** the submission refuses with a channel-specific, customer-facing message, the cart is preserved, and existing rounds continue their lifecycle untouched.

**Acceptance**: pre-cutoff submissions succeed; the cutoff message is verbatim-testable; a dine-in session of the same age is unaffected; staff modification of existing rounds still works after the cutoff.

## Functional Requirements

- **FR-001** The session type check widens from `('dine-in')` to `('dine-in', 'delivery', 'takeaway')`; every existing dine-in behavior is unchanged.
- **FR-002** The public entry flow offers the channel choice; delivery requires name, phone, and a non-empty delivery address (client-side bounds + server re-check); takeaway requires name and phone only; dine-in requires name, phone, and an active table as today.
- **FR-003** A delivery session stores its delivery address once at entry (bounded non-empty text); it is never editable after creation.
- **FR-004** The round state check widens to include `out_for_delivery` and `completed`; the ticket state check does NOT widen.
- **FR-005** Two new cashier transitions exist: `ready → out_for_delivery` and `out_for_delivery → completed`, guarded-update, refusal-verbatim, audited (`round.out_for_delivery`, `round.completed`), kitchen-denied.
- **FR-006** The new transitions apply ONLY to delivery sessions' rounds; a dine-in or takeaway round refuses them.
- **FR-007** The delivery cutoff: a submission to a delivery session is refused once any of its rounds is `out_for_delivery` or `completed`. The takeaway cutoff: a submission is refused once any of its rounds is `ready` (or beyond). Dine-in submissions are never cutoff-refused (session close governs, as today).
- **FR-008** A cutoff refusal is a customer-facing, channel-specific message; the device token is NOT cleared (the session remains recoverable and readable — the customer can still watch their rounds complete).
- **FR-009** Staff reads (`get_branch_rounds`, `get_kitchen_queue`, `get_session_bill`) include the channel and, for delivery sessions, the address on the cashier/bill surfaces only; the kitchen queue never carries addresses or money (FR-010 of Phase 8 unchanged).
- **FR-010** Session context (`get_session_context`/menu payload) exposes the channel to the customer surface; the customer menu renders the channel label and, for delivery, the address read-only.
- **FR-011** The entry close/audit machinery treats channels uniformly: closing, session reads, and audit attribution work identically for all three types.

## Success Criteria

- **SC-001** A delivery order placed end-to-end (entry → cart → submit → accept → prepare → ready → out for delivery → completed) leaves the same money/ticket/audit structure as the equivalent dine-in order, plus the channel fields.
- **SC-002** A takeaway session reaching a `ready` round refuses further submissions with the takeaway cutoff message; a delivery session reaching `out_for_delivery` refuses further submissions with the delivery cutoff message; the messages are distinct and verbatim-tested.
- **SC-003** Every illegal transition (backward, skip, repeat, terminal, wrong channel, wrong role) refuses with zero state change — the Phase 8 zero-change posture, now covering the two new states.
- **SC-004** The kitchen queue for a delivery session shows items/quantities only (no address, no money) — identical shape to dine-in.
- **SC-005** After the cutoff, existing rounds still complete their lifecycle and staff modification still works on mutable states.

## Requirements Checklist

See [checklists/requirements.md](checklists/requirements.md).
