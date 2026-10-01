# Feature Specification: Cashier Operations UX (Frontend Phase 09)

**Feature Branch**: `029-cashier-operations-ux`

**Created**: 2026-10-01

**Status**: Draft — clarified (2026-10-01, decisions D1–D5)

**Input**: Frontend Master Plan §"Frontend Phase 09" — "The operational console a cashier uses for a whole shift: live round queues, reliable transitions, order modifications, voids with reasons, session oversight and closure, and a readable bill — with realtime updates that never lie about state."

**Authorities**: RestoPilot-Frontend-Master-Plan.md §"Frontend Phase 09" (FR-01…FR-10); frozen contracts — the staff-ops RPC set (`get_branch_rounds`, `get_kitchen_queue` [money-free], `accept_round`, `start_preparation`, `mark_round_ready`, `lock_round`, `mark_out_for_delivery`, `mark_completed`, `modify_round_line`, `void_round` [reason required ≤ 500; channel boundaries dine-in@lock / delivery@out_for_delivery+ / takeaway@ready; one generic refusal], `get_session_bill` [non-voided grand total], `get_branch_open_sessions`, `close_session`), realtime tables `rounds`/`kitchen_tickets` with the 200 ms coalescing + `SUBSCRIBED` recovery pattern, `useNewRoundCue`; Constitution IV (RPC = boundary, refusals verbatim), §5.4 (no optimistic state anywhere — the refetch is the state); §12.5 sign-in budget.

**Existing implementation (INSPECT, baseline `1c832f2`)**: the journeys are complete and pinned — `CashierRoundsPage` (role gate; branch options; `?branch=` deep link; realtime invalidation on `rounds`; six plain-div state groups with `Nothing here.` empties; `refusalFor` routing over eight mutations; `selectedSessionId` + `BillPanel`) → `RoundCard` (`article[data-round-id][data-round-state][data-voided]`, per-line inline `Reduce one`/`Remove line`, captured 'Subtotal · tax', two-step void through ConfirmDialog, `Show bill` checkbox) and `BillPanel` (`session-bill`, per-line detail, tax lines, `bill-voided-section`, `bill-grand-total`); `StaffSessionsPage` → `BranchSessionsPanel` (h2 'Open sessions — {branch}', participant rows, two-step close with strict-safe inline `role="status"` notice). This phase is a RE-SKIN into the 022 token system with an operable board: labelled region groups with counts, `StateChip` state vocabulary, transition actions with busy/disabled discipline, a bill that reads like a printed check on the money primitives, freshness (`Updated Xs ago` + pulse), a reconnecting banner wired to the binding's unused `onStatus`, the cue gaining a clear path to the round — with every pinned assertion passing unedited.

## Clarifications (session 2026-10-01 — decisions D1–D5)

- **D1 — Bill placement: INLINE on the rounds page (kept), never a drawer/route** (the Master Plan's expected clarify question; contract-anchored). The E2E pair (`Show bill` checkbox → `session-bill` visible in place) pins the inline posture; a drawer would cover the queue a cashier keeps working, and a route would break the board/bill linkage. The checkbox stays the bill selection affordance.
- **D2 — Freshness affordance: a ticking 'Updated Xs ago' badge + a polite announcement, plus a reconnecting banner** (the Master Plan's expected form question). The badge ticks each second from the reads' `dataUpdatedAt` and pulses while a refetch is in flight; ONE polite live region announces coalesced refreshes (count-derived, never event payloads); the realtime binding's `onStatus` (unused at baseline) drives a 'Reconnecting…' banner on CHANNEL_ERROR/TIMED_OUT/CLOSED and clears on SUBSCRIBED; a fetch error WITH data keeps the stale board readable with a retry affordance (stale honesty), while an error WITHOUT data renders the error state.
- **D3 — Cue persistence: unchanged event-derived lifecycle, gaining a clear path to the round** (the Master Plan's expected persistence question). The cue still clears on the round's first advance; the dashboard cue gains a link to `/dashboard/rounds?branch=`, and on the rounds page the exact round is marked (`data-round-cue`) and scrolled into view — the announcement never renders payload data beyond the id the refetched list already shows (FR-08).
- **D4 — No undo/re-open; keyboard shortcuts OUT** (the Master Plan's expected questions). Void is irreversible by contract — the confirm dialog states it; recovery is the audit trail. Keyboard operability comes from native buttons/dialogs (focus trapped + restored by the primitive); no shortcut layer ships this phase.
- **D5 — Line modification stays INLINE per line ('Reduce one' / 'Remove line'), no ModifyLineDialog** (E2E-pinned one-tap controls; the plan's component suggestion yields to the frozen anchors). Consequence messaging rides helper copy near the controls (what a reduce/remove does; captured prices re-derive server-side); refusals land on the originating card verbatim (FR-09).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A cashier works a shift from one board (P1)

Carla opens `/dashboard/rounds`: the queue answers "what needs me now?" — new orders grouped first with counts, each round a card with its channel, table, items and captured money. She accepts a fresh order the moment it appears (no refresh), walks it accept → start → ready → lock with one deliberate tap per state, modifies a line when a guest changes their mind, and voids a round with a reason when it must come off the bill — the voided card visibly distinct, the refusal, if any, rendered verbatim on the originating card.

**Why this priority**: the live board IS the phase — realtime that never lies, transitions that never double-submit, refusals that never hide.

**Independent Test**: a real customer submission appears without refresh; the chain runs on the tablet viewport; a void with a reason flips the card to its voided display and reduces the session bill exactly.

**Acceptance Scenarios**:

1. **Given** the board open, **When** a customer submits a round, **Then** the card arrives via the coalesced invalidation, the freshness badge pulses, and the polite region announces the refresh.
2. **Given** a round in a transitionable state, **When** the cashier acts, **Then** exactly the state-legal controls render, busy/disabled during flight, and the card re-renders from the refetched read (no optimistic state).
3. **Given** a boundary-voidable round, **When** the cashier voids it with a reason, **Then** the confirm requires the reason, states the irreversibility, and the voided card + bill's voided section render with the grand total reduced.

### User Story 2 — A cashier reads the bill like a check (P1)

Selecting 'Show bill' on any round of a session renders the session's bill inline: participants, each round's lines with captured unit prices and extras, its tax lines by name, the voided section with reasons, and the server's non-voided grand total — tabular money alignment, print-check reading order, delivery address echoed when present.

**Why this priority**: the bill is the external-POS handoff; money fidelity (§7) is the product's trust spine.

**Independent Test**: the bill's figures equal the payload's exactly; the voided section carries exactly the voided rounds' reasons and figures; the grand total line carries exactly one number.

**Acceptance Scenarios**:

1. **Given** a session with active and voided rounds, **When** the bill opens, **Then** active rounds render their lines/tax lines, voided rounds render in the voided section, and the grand total is the server's non-voided sum verbatim.
2. **Given** a delivery session, **When** the bill opens, **Then** the delivery address echoes (bill-surface only).

### User Story 3 — Staff oversee and close sessions with confidence (P2)

A manager/owner opens `/dashboard/sessions`, reads the open sessions with participants and opened time, and closes a session through the confirmed two-step dialog — the closure notice announced inline, the list refetching as the state.

**Why this priority**: closure is the contract's session end; the confirmation and strict-safe status are pinned behavior this phase makes presentable.

**Independent Test**: the close journey runs exactly as pinned (dialog names, inline status), with the re-skinned presentation carrying no new strict-mode collisions.

**Acceptance Scenarios**:

1. **Given** an open session, **When** the permitted staff member confirms the close, **Then** the inline notice carries the closure text and the session leaves the refetched list.
2. **Given** a staff member without close rights, **When** they read the panel, **Then** the list renders read-only (no close controls).

### Edge Cases

- A round moves states in ANOTHER browser: the card visibly leaves its old group via the refetched read — never a stale double-render (realtime proof, pinned).
- A mutation is refused (unknown/already-void/below-boundary): ONE generic refusal rendered verbatim on the originating card; no state changes.
- The empty-reason void prompt: confirm stays disabled (client feedback); the server re-validates regardless.
- Offline/reconnect: the binding reports the drop → 'Reconnecting…' banner; recovery on SUBSCRIBED refetches authoritative state; a failed refetch WITH data keeps the last-known board + retry; without data → the error state.
- Session closed while its bill is open: the next read renders the payload the server returns (closed sessions' bills remain readable captured history); no client guess.
- Long queues: grouped virtualization-free rendering with per-group counts; pressure measured before any pagination (FR-10 — record if raised).
- Kitchen-blind honesty: the kitchen queue stays money-free (parser rejects money keys); this phase adds no money to any kitchen surface.

## Requirements

- **FR-01** The queue groups rounds by state (`new`, in progress, ready, out for delivery, delivered, served) as labelled regions/lists with per-group counts and per-group empty states.
- **FR-02** Per-round actions render exactly as the state machine allows (accept on new; start on accepted; ready on preparing; lock on ready for dine-in/takeaway; dispatch/complete for delivery; nothing on lock), with busy/disabled during flight and no double-submit path.
- **FR-03** Line modification (remove / reduce one) inline per line with consequence messaging and verbatim refusals routed to the originating card.
- **FR-04** The void flow: boundary-aware availability, mandatory reason (confirm disabled until non-empty), boundary + irreversibility stated, and the voided display state visibly distinct from lock.
- **FR-05** The bill panel: participants, per-round line detail (captured prices, extras), tax lines by name, the voided section with reasons, the delivery address echo, and the grand total exactly as returned by `get_session_bill`.
- **FR-06** The session oversight list: participants, scoping (server-refused branch = denial), confirmed two-step closure with the inline status notice.
- **FR-07** Realtime freshness: a visible 'Updated Xs ago' badge pulsing during refetch, ONE polite live region announcing coalesced refreshes, and a reconnecting banner driven by the binding status with recovery on SUBSCRIBED.
- **FR-08** The new-round cue as an announcement with a clear path to the new round (dashboard link / on-board card marking), no fabricated data.
- **FR-09** Refusal routing: whichever mutation failed for a round renders its verbatim message on that round's card.
- **FR-10** Long queues stay performant; virtualization/pagination only if measured necessary (recorded boundary).

### UX Requirements

- The queue answers "what needs me now?" first: the incoming group leads, counts are glanceable.
- Actions are one deliberate tap; destructive/irreversible actions confirm; a busy queue never blocks on one card's pending action.
- A round that moved states elsewhere visibly leaves its old group (the refetch is the state).
- Money never appears on kitchen-blind surfaces; captured money only on cashier surfaces.

### Visual Requirements

- Card/board language with strong state vocabulary (StateChip color + label, never color alone); compact staff density (`data-density='compact'`); tabular-numeral money alignment; distinct voided styling; the bill reads like a printed check; 022 tokens only (design-literals gate).

### Responsive Requirements

- Primary: tablet landscape + desktop — the board renders as state columns side-by-side; below the tablet breakpoint columns collapse to stacked groups (same DOM, `@media` only); mobile is read/alert-capable with key transitions operable (documented secondary).

### Accessibility

- Real buttons with the pinned accessible names; groups as labelled regions/lists (`<section aria-label>` + headings); polite live regions (never assertive spam); `data-round-state`/`data-round-id`/`data-voided` preserved; focus never stolen by a refetch; the confirm dialogs trap and restore focus (native `<dialog>`); axe floor clean on both routes.

### State Matrix

Board: loading / empty overall / populated / stale-while-refetching (pulse) / realtime update arriving / reconnecting (banner) / error with retry (no data) / stale-data error (board stays + retry). Round: each state + voided overlay + busy transition + refusal. Modification: idle / busy / refused. Void: available / below-boundary (not offered) / reason empty / busy / refused / succeeded. Bill: loading / empty / populated / voided section / closed mid-view. Sessions: loading / none open / list / closing / close refused / closed. Cue: idle / arrived / dismissed / superseded (cleared on advance).

## Success Criteria

- SC-01 A real customer round flows entry → board → accept → modify → ready → lock → bill on a tablet viewport with realtime updates and zero optimistic state.
- SC-02 Void with reason → voided card + bill voided section + exact grand-total reduction (the pinned math).
- SC-03 Session close → confirmed, announced inline, list refetched.
- SC-04 Offline → reconnecting banner; recovery → SUBSCRIBED refetch reconciles.
- SC-05 Every frozen E2E assertion passes unedited; the new operations suite passes.
