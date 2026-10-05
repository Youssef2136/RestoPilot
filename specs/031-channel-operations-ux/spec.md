# Feature Specification: Delivery & Takeaway Channel UX (Frontend Phase 11)

**Feature Branch**: `031-channel-operations-ux`

**Created**: 2026-10-01

**Status**: Draft — clarified (2026-10-01, decisions D1–D6)

**Input**: Frontend Master Plan §"Frontend Phase 11" — channel-aware behavior across the three experiences: delivery and takeaway exist in the contract (address capture, dispatch/completion transitions, state-driven cutoffs, channel-blind kitchen) but the UI presents them as an afterthought. This phase makes channel state legible everywhere it matters.

**Authorities**: RestoPilot-Frontend-Master-Plan.md §"Frontend Phase 11" (FR-01…FR-07); frozen contracts — `open_session_channel` (one customer per channel session; dine-in redirect), `sessions.type` checks, delivery-address rules (null for non-delivery, ≤200 chars, set once at entry — no write path), `submit_round` cutoffs (delivery: any round `out_for_delivery`/`completed`; takeaway: any round `ready`/`lock`; dine-in never), `mark_out_for_delivery`/`mark_completed` (delivery-only, kitchen denied, audited), staff reads carrying `session_type` (+ address on the bill), `get_kitchen_queue` remaining channel-blind, `channel.entry` client mapping with its refusal-preservation rules (unavailable clears token+cart; cutoff preserves both); Constitution IV (RPC = boundary), §5.4 (no optimistic state); the 010/024/025/029 foundations reused as-is.

**Scope rule (Master Plan, binding)**: Phase 11 is a presentation and workflow refinement phase over existing channel contracts. It must NOT introduce new channel behavior that requires backend changes. Any idea that would need a new RPC, a signature change, new states, or new validation is recorded as a contract conflict (§3.8), not implemented. Backend impact classification: **NOT_REQUIRED / ALREADY_SUPPORTED** — every read and RPC this phase presents already exists.

**Existing implementation (INSPECT, baseline `9959364`)**: all three channel experiences work but present channel state thinly — customer: `SessionIndicator` (chip text + address echo), `CutoffNotice` (state text, disables nothing), `RoundsHistory` (state chips, no dispatch/delivered progression); cashier: `RoundCard` channel chip + address line, `TransitionActions` with pinned dispatch/completion names (completion fires with NO confirmation), `BillPanel` channel heading + `bill-address`, no channel filter on `RoundsBoard`; sessions oversight: `BranchSessionsPanel` renders channel sessions with an EMPTY main line (payload lacks `session_type`); kitchen: channel-blind (unchanged, asserted).

## Clarifications (session 2026-10-01 — decisions D1–D6)

- **D1 — Cutoff pre-emption disables the ADD affordance only; the server stays the authority** (the Master Plan's expected clarify question: "cutoff disables the cart entirely or only submission"). When the session's rounds read shows the cutoff crossed (delivery: any round `out_for_delivery`/`completed`; takeaway: any round `ready`/`lock`; dine-in never), the menu's add controls become PROGRAMMATICALLY disabled (`disabled`, not styled) with the explanation tied via `aria-describedby` to the cart's cutoff notice; a polite live region announces the crossing once. The CART itself stays alive — lines remain visible and adjustable, and the submit button STAYS ENABLED so the server refusal remains possible and renders verbatim with the cart preserved (the frozen FR-011 contract). The 10 s poll is the client's knowledge latency; the server covers the race. **E2E migration recorded**: the FR-011 journey's second add moves BEFORE the dispatch transition (below the cutoff), and the test then asserts the disabled affordance after crossing — the four staff transitions, the verbatim refusal, and the preserved cart are preserved end-to-end; only the mechanical order of two steps changes.
- **D2 — Channel filter SHIPS on the rounds board** (the Master Plan's expected "earns its complexity" question). It earns it: mixed service is the norm the board is for, and the dispatch lane is exactly what a cashier scans for. A compact radio-group filter ('All channels' default / Dine-in / Delivery / Takeaway) renders above the board; groups, counts, and empties derive from the FILTERED set honestly (a filtered-empty board says so); one DOM, no persistence beyond the page; default 'All channels' renders byte-identical to today's board so every frozen anchor holds unedited.
- **D3 — Completion is two-step; dispatch stays one-tap** (the Master Plan's expected wording question). `Mark completed` is terminal ("nothing fires after") so it opens a `CompletionConfirmDialog`: title 'Mark completed', body stating the consequence ('Completing this delivery closes it for good — no further transitions or voids are possible.'), confirm 'Complete the delivery', cancel 'Not yet'. Dispatch ('Send out for delivery') keeps its single click — it is significant but recoverable-by-contract (void at `out_for_delivery`/`completed` remains legal), and the frozen four-transition journey clicks it directly. Both actions already render only in their legal states; the delivery-only posture is stated on the card by the channel chip + address line.
- **D4 — Takeaway pickup readiness gets a customer-facing highlight, built from the existing `ready` state** (the Master Plan's expected question). No new state: the StatusTimeline's 'Ready for pickup' milestone takes the emphasis treatment, and the rounds history announces it once via a polite live region ('Your pickup order is ready.'). Delivery gets the parallel 'On its way' progression (FR-07); dine-in keeps the existing chip vocabulary untouched.
- **D5 — The sessions list gets a NEUTRAL marker, not per-channel identity** (contract conflict §3.8, recorded). `get_branch_open_sessions` returns channel sessions but its payload carries no `session_type` — adding the field is a signature change (forbidden this phase). `BranchSessionsPanel` therefore renders `table_label ?? 'Counter session'` for the main line: the row stops being blank and honestly says "a no-table session is open" without inventing a channel claim it cannot verify. Recorded in docs/frontend-presentation-contracts.md as the phase's one contract gap; a later backend-authorizing phase may add the field.
- **D6 — Kitchen stays code-untouched; the blindness is ASSERTED, not assumed** (the Master Plan's kitchen clause). No kitchen component changes. The new channel E2E drives a real delivery round through the kitchen board and positively asserts that no address, no 'Deliver to', and no delivery-logistics wording ever appears there — the existing kitchen.display money/address blindness pin generalized to the delivery channel.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A delivery customer understands the cutoff before it bites (P1)

A delivery customer adds items while the order is in the kitchen; the cart notice explains the rule the whole time. When the cashier dispatches the order, the menu's add controls become disabled with the explanation attached (`aria-describedby`), a polite announcement says ordering is closed, the cart keeps its lines, and a submit attempt still meets the server's verbatim refusal with the cart preserved. Their history shows the round as 'On its way', then 'Delivered'.

**Why this priority**: the cutoff is the phase's highest-stakes moment — money-adjacent, and the one place a presentation lie would cost a real order.

**Independent Test**: the migrated FR-011 journey — four staff transitions cross the cutoff; the customer sees disabled adds + explanation + announcement, then the verbatim refusal with the preserved cart; the timeline shows 'On its way'.

### User Story 2 — A cashier handles dispatch and completion as the distinct acts they are (P2)

On the rounds board a delivery round renders its channel chip and 'Deliver to' line; 'Send out for delivery' appears only at `ready` and fires in one tap; 'Mark completed' appears only at `out_for_delivery` and opens the consequence dialog before the terminal step. A channel filter (default 'All channels') narrows the board to the dispatch lane during mixed service; counts and empties stay honest under any filter.

**Why this priority**: the two terminal-adjacent staff acts are where channel workflow lives.

**Independent Test**: the staff half of the channel E2E — dispatch one-tap visible only at ready; completion two-step with the dialog's exact copy; filter narrows and restores.

### User Story 3 — A cook is never asked to read an address (P2)

The kitchen board during a live delivery round shows exactly what it shows for dine-in: items, quantities, the 'Counter order' head — no address, no 'Deliver to', no delivery logistics, asserted positively.

**Why this priority**: the channel-blind contract is the kitchen's safety property; it must be proven, not presumed.

**Independent Test**: the blindness assertion over the live delivery round on the kitchen board.

### User Story 4 — A takeaway customer knows when adding is closed and when to come pick up (P3)

The takeaway cart notice explains the handover rule; when the round hits `ready` the add controls disable with the explanation, the history announces 'Your pickup order is ready.', and the timeline shows 'Ready for pickup' emphasized.

**Why this priority**: completes the three-channel story with the second cutoff variant.

**Independent Test**: the takeaway leg — cutoff on `ready`, pickup announcement, timeline milestone.

## Functional Requirements

- **FR-01** Channel identity on every relevant surface — session bar (chip + address echo, existing), round cards (channel chip, existing), bill (channel heading + address, existing), session list (D5 neutral marker, new).
- **FR-02** Cutoff state surfaced BEFORE the attempt: disabled add affordance + `aria-describedby` explanation + polite crossing announcement (D1); the server refusal remains possible and renders verbatim with the cart preserved.
- **FR-03** Dispatch and completion on the cashier board only in their legal states (existing gating), with the two-step completion confirmation (D3).
- **FR-04** Address presentation limited to contract-permitted surfaces: the customer's own echo and the staff bill/round reads — nowhere else, positively asserted on the kitchen board (D6).
- **FR-05** Channel filtering on the staff board (D2): radio group, default 'All channels', honest filtered counts/empties.
- **FR-06** Channel-specific refusals render verbatim from the server (existing SubmitBar/RefusalText posture; asserted: 'already on its way').
- **FR-07** Status progression visible to the customer for dispatched/delivered rounds (D4): the StatusTimeline over the existing states — delivery: Sent to kitchen → In the kitchen → On its way → Delivered; takeaway: Sent to kitchen → In the kitchen → Ready for pickup → Picked up; dine-in keeps its chips (no timeline) so its frozen vocabulary is untouched.

## UX Requirements

- Channel is never a surprise: the customer chose it at entry and the UI keeps saying it (indicator, cart notice, history timeline).
- The cutoff is explained proactively with the reason; the disabled affordance explains itself through the linked notice.
- Staff actions are labelled with their consequence (dialog copy names the terminal boundary).
- Nothing on the kitchen surface mentions delivery logistics beyond the channel-neutral 'Counter order' head (asserted).

## Visual Requirements

- One channel chip treatment reused everywhere (extracted `ChannelChip`; `data-channel-chip` + channelLabel text preserved for the pins).
- Cutoff notice treatment stays the honest note; the disabled state adds the dimmed-but-legible affordance treatment.
- Status timeline treatment: compact milestone list, current step `aria-current="step"`, emphasis (not alarm) on the pickup/on-its-way milestone.
- Delivery address typography: readable prose, not decorative — existing address lines keep their treatment.

## Responsive Requirements

- Customer surfaces verified at 390 px: the disabled add row, the notice, and the timeline must not overflow.
- Cashier board tablet-first: the filter survives narrow widths (wraps under the board heading, same DOM); channel chips survive on narrow cards.
- Kitchen unchanged (channel-blind; its 030 responsive contract stands).

## Accessibility

- Channel radio-group semantics preserved from Phase 04 (entry) and mirrored by the new board filter (real radio group with labels).
- Disabled add affordance is programmatically disabled (`disabled`) with the explanation tied via `aria-describedby`.
- Status announcements for cutoff crossing and pickup readiness are polite live regions that appear with the state (no role="status" — the customer page's single role="status" pin belongs to the submit-success region).
- No color-only channel coding (the chip is always text-bearing).

## State Matrix

- Customer: ordering / cutoff reached (dine-in never) / dispatched / completed / session closed mid-flight (existing recovery rule untouched).
- Cashier: delivery round in each state / dispatch busy / completion confirm / refusal (verbatim).
- Kitchen: unchanged, with the positive no-leak assertion.
- Address: present (delivery) / absent (takeaway, dine-in).

## Security

- Address is customer-owned data shown only where the contract permits; no address in kitchen payloads; no new read paths; refusals verbatim; the unavailable-session refusal's token-clearing behavior stays exactly as specified (cutoff refusals preserve token + cart).

## Components

`ChannelChip` (extracted, reused), `ChannelFilter` (D2), `DispatchActions` (stays `TransitionActions` — the pinned names are the contract; D3 adds the dialog), `CompletionConfirmDialog` (new), `StatusTimeline` (new, customer), `CutoffNotice` (extended: linkable id + crossing announcement), `AddressEcho` (stays the existing indicator/bill/round lines — no new variant needed).

## Routes

No new routes; refinements land inside `/r/:slug/menu`, `/dashboard/rounds`, `/dashboard/kitchen` (assertion only), and the sessions oversight panel.

## Data Dependencies

Existing channel RPCs and reads only: `get_session_context`, `get_session_rounds` (customer poll — the cutoff's derivation source), branch rounds read, `get_session_bill`, `get_branch_open_sessions`, `mark_out_for_delivery`, `mark_completed`, `submit_round`.

## Testing

- Unit: cutoff derivation from the rounds payload (delivery/takeaway/dine-in × states) as pure helpers; timeline milestone mapping per channel; channel filter grouping. Existing `channel.entry` tests preserved untouched (refusal mapping, token/cart preservation).
- E2E: existing delivery/takeaway entry assertions and the delivery-cutoff journey in `e2e/session.surfaces.test.ts` preserved end-to-end (the D1-recorded mechanical migration); new `e2e/channel.operations.test.ts`: proactive cutoff affordance at 390 px, channel chip consistency, completion confirmation wording, channel filter narrowing, takeaway pickup announcement, and the explicit kitchen-blind assertion.
- Database suites untouched and green.

## Impeccable Workflow

`$impeccable shape` on the cutoff/dispatch moments (small but high-stakes); build; `critique` on the customer's understanding of the cutoff; `audit` for disabled-state semantics; `polish`.

## SpecKit Workflow

Full pipeline; the four expected clarify questions are settled above (D1–D4) plus the two inspection-forced ones (D5–D6). Checklist focus: refusal-preservation fidelity.

## Exit Criteria

All three channels are legible and correct on every affected surface; the cutoff is explained before it bites; kitchen remains channel-logistics-free (proven); existing channel E2E assertions pass (with the D1-recorded migration); `npm run verify` green; full Playwright green.

## Validation Gates

`npm run verify` (channel db suite included); `npm run test:e2e` (`session.surfaces` channel block, `kitchen.cashier`, `realtime`, new `channel.operations`); axe + 390 px responsive specs.

## Git Checkpoint

Commit after convergence; `feat(031): …`; auto-push to `origin/main` per the standing project rule.
