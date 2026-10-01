# Feature Specification: Kitchen Display UX (Frontend Phase 10)

**Feature Branch**: `030-kitchen-display-ux`

**Created**: 2026-10-01

**Status**: Draft — clarified (2026-10-01, decisions D1–D4)

**Input**: Frontend Master Plan §"Frontend Phase 10" — "A kitchen display readable from two metres away, on a screen nobody touches with clean hands, that shows incoming tickets, drives exactly two actions (`start preparation`, `mark ready`), and survives a dropped connection or a reload mid-service."

**Authorities**: RestoPilot-Frontend-Master-Plan.md §"Frontend Phase 10" (FR-01…FR-09); frozen contracts — `get_kitchen_queue` (money-free, channel-blind: no address, no money, no `new`-states-after-accept semantics beyond the ticket mirror), `start_preparation`, `mark_round_ready`, ticket states `new → accepted → preparing → ready`, one-ticket-per-round, realtime tables `kitchen_tickets` + `rounds`, role reach (kitchen/cashier/manager/owner), `data-kitchen-column`/`data-ticket-id`/`data-ticket-state` hooks; Constitution IV (RPC = boundary), §5.4 (no optimistic state); the 029 foundations (LiveBadge, ReconnectingBanner, board css conventions) reused as-is.

**Existing implementation (INSPECT, baseline `d5223dc`)**: `/dashboard/kitchen` is complete and pinned-but-plain — `KitchenDashboardPage` (role gate, branch selector, two realtime bindings, three plain-div columns with `data-kitchen-column`, 'Nothing here.' empties, refusal loop over start/ready) → `TicketCard` (`article[data-ticket-id][data-ticket-state]`, h3 'Table {label}', state text, item lines, `data-refusal`, the two pinned buttons). This phase is a RE-SKIN for glanceability: three real columns with counts and real headings, ticket cards at KDS scale, elapsed-time staleness (D2), freshness + reconnect/offline honesty (reusing the 029 components), reload recovery (already the reads' posture, now asserted), channel-neutral wording — with every frozen assertion passing unedited.

## Clarifications (session 2026-10-01 — decisions D1–D4)

- **D1 — Alerting: VISUAL ONLY** (the Master Plan's expected clarify question). No sound and no outbound notification contract exists (§3.8 C4 out-of-scope: no printing, no outbound alerts); the board's alarm is composition — the incoming column leads, its count pill is prominent, and a NEW ticket arrives pre-highlighted briefly (a one-shot brand-tinted entry treatment that fades; reduced-motion collapses it). No audio, no notifications, ever, this phase.
- **D2 — Age thresholds: three named bands, honest granularity** (the Master Plan's expected thresholds question). The board shows elapsed minutes for the first hour ('3 min'), switching to hours-and-minutes after ('1 h 05 min') — no seconds ticking (a clock the UI would fabricate precision about, and motion a cook can't parse). Bands: fresh (muted ink, 0–4 min), working (normal ink, 5–14 min), late (warning-tinted text + border treatment, ≥15 min) — escalation WITHOUT alarm fatigue: no flashing, no sound; the late treatment is static and text-bearing ('late'). The age derives from the payload's `created_at` — a display derivation, not authoritative data.
- **D3 — The cashier's `new` column is VISIBLE to kitchen** (the Master Plan's expected visibility question). The contract's queue already carries `new` tickets (the one-ticket-per-round mirror at submission) and the pinned E2E + full-journey read the `accepted` column live; hiding `new` would hide the honest pipeline. The column renders labelled 'Incoming (awaiting cashier)' — kitchen sees the order coming and is never asked to act on it (no accept button exists; the RPC refuses).
- **D4 — Wall-screen: the landscape tablet target IS ≥1024 px and scales fluidly** (the Master Plan's expected resolution question). No separate wall-screen breakpoint ships: the KDS grid fills the viewport width (columns grow, type stays at the KDS scale), portrait tablets stack columns (same DOM), and phone is explicitly out of scope with a readable stacked fallback (documented boundary — the responsive section's rule, not a separate surface).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A cook works the board from two metres (P1)

Dan opens `/dashboard/kitchen` at Marina: three columns — incoming (awaiting cashier), preparing, ready — with counts and real headings. A ticket submitted by a real customer appears LIVE (no refresh, no touch); each ticket card shows its items, quantities and extras in channel-neutral wording with an elapsed-time indicator; exactly two actions exist ('Start preparation' on accepted, 'Mark ready' on preparing) as large targets with busy protection. A ticket that changed state elsewhere visibly moves columns through the refetched read.

**Why this priority**: the glanceable, hands-busy working board IS the phase.

**Independent Test**: a real Marina T1 submission appears live; the two actions walk the ticket accepted → preparing → ready at the landscape tablet viewport with a keyboard-only leg; the ticket's column movement is visible without touching anything.

**Acceptance Scenarios**:

1. **Given** the board open, **When** a customer submits a round, **Then** the ticket arrives via the coalesced invalidation with a brief pre-highlight, its column count increments, and the polite region announces the refresh.
2. **Given** an accepted ticket, **When** the cook presses the large 'Start preparation' control, **Then** the card moves to the preparing column from the refetched read (no optimistic state), busy during flight.
3. **Given** a preparing ticket, **When** 'Mark ready' fires, **Then** the card lands in the ready column with the ready treatment.

### User Story 2 — The board survives a dropped connection and a reload (P1)

The tablet's wi-fi drops: the board shows a reconnecting banner, keeps the last-known tickets readable (never blank, never a modal interrupt), and the freshness badge stops claiming freshness. On recovery the binding's SUBSCRIBED refetch reconciles anything missed. A mid-service reload re-reads the authoritative queue through the normal load path — state from the server, never client memory.

**Why this priority**: the flaky-tablet survival is the phase's honesty contract.

**Independent Test**: `context.setOffline(true)` shows the banner with the last board; `setOffline(false)` clears it; a reload mid-service renders the authoritative columns.

**Acceptance Scenarios**:

1. **Given** the transport drops, **When** the binding reports CHANNEL_ERROR/TIMED_OUT/CLOSED, **Then** the polite banner appears and the last-known board stays readable.
2. **Given** the transport recovers, **When** SUBSCRIBED fires, **Then** the banner clears and the recovery refetch lands.
3. **Given** a reload mid-service, **When** the page mounts, **Then** the columns render from `get_kitchen_queue` exactly as the server holds them.

### User Story 3 — A manager reads the board and it stays blind to channel and money (P2)

Any permitted reader sees items, quantities, extras and ages — never money, never delivery addresses, never channel logistics (the queue payload carries none; the board must not invent any). A multi-branch identity picks their branch; a single-branch identity sees no picker.

**Why this priority**: the blindness rules are the product's trust spine; the board must provably never leak.

**Independent Test**: the money-free absence re-asserts over the LIVE board (`section` innerText matches no /subtotal|tax|total|price/i, and no 'Deliver to' address text); the seeded channel sessions' address never renders on the kitchen route.

**Acceptance Scenarios**:

1. **Given** a populated board, **When** its text is read, **Then** no money word and no delivery address appears anywhere.
2. **Given** a multi-branch identity, **When** the board renders, **Then** the branch selector appears; a single-branch identity sees none.

### Edge Cases

- A ticket advances in another browser: it visibly leaves its column via the refetched read — no stale double-render.
- A mutation refused (illegal transition, out-of-scope): the ONE generic refusal renders verbatim on the originating ticket, no state change.
- Empty kitchen: per-column named empties; overall empty state still names the columns.
- Reload mid-service: the reads own the state (FR-06).
- The seeded channel demo sessions (delivery/takeaway) submit rounds: tickets render channel-blind — table_label null → the card heads 'Counter order' with NO address (D3 keeps the payload's absence honest; the board never fabricates a label).
- Long service: ages escalate through the three bands; a `lock`ed round's ticket leaves the board (the read's `state <> 'lock'` rule) — the ready column drains honestly.

## Requirements

- **FR-01** Three columns (`new` labelled 'Incoming (awaiting cashier)', preparing merging accepted+preparing as the contract's queue does, ready) with per-column counts, real headings, and per-column empty states.
- **FR-02** Ticket cards: item lines with quantities and extras (presentation only), channel-neutral wording, the pinned `data-ticket-id`/`data-ticket-state` hooks, no money and no address under any condition.
- **FR-03** Elapsed time since submission with the three-band staleness treatment (D2) — honest granularity, no fabricated precision.
- **FR-04** Exactly the contract's actions — 'Start preparation' on accepted, 'Mark ready' on preparing (pinned names) — large targets, busy/disabled protection, no double-submit.
- **FR-05** Live updates via the existing realtime invalidation with a visible connection state (reconnecting banner + freshness badge, the 029 components).
- **FR-06** Reload recovery: state read from the server on every mount.
- **FR-07** Branch selector for multi-branch identities (frozen label/id 'kitchen-branch'); none for single-branch.
- **FR-08** Refusal text on the originating card, verbatim (`data-refusal`).
- **FR-09** No money and no delivery address rendered under any condition (payload + presentation double-blind).

### UX Requirements

- Readability over density: KDS scale type, high contrast, generous tap targets; cards survive an angled glance.
- A ticket that changed state elsewhere moves columns visibly; no modal interrupts service; offline is obvious and non-blocking (last-known board readable).

### Visual Requirements

- Kitchen-specific scale within the same token system: larger radii, heavier borders, stronger state colors on the state chips; three-column board language; age indicators escalating without alarm fatigue; a distinct offline treatment; the brief NEW-ticket highlight (D1) collapsing under reduced motion.

### Responsive Requirements

- Primary: landscape tablet / wall ≥1024 px touch (fluid fill, D4); portrait tablets stack columns (same DOM, `@media` only); phone: readable stacked fallback, explicitly a documented boundary, not a working surface.

### Accessibility

- Pinned button names; large targets (`--touch-target`+); column headings as real headings (h2) for screen-reader navigation; polite coalesced live regions (never a stream of assertions); color never the only state signal (labels + chips + text bands); reduced-motion honored for the entry highlight; the axe floor stays clean.

### State Matrix

Board: loading (skeleton columns) / empty kitchen (named) / populated / realtime arrival (brief highlight) / reconnecting (banner) / offline last-known / error with retry. Ticket: new (awaiting cashier, no action) / accepted (Start preparation) / preparing (Mark ready) / ready (no action — the cashier takes it) / voided mirror gone (the read drops it) / busy action / refusal. Branch: single (no picker) / multiple (picker) / denied (route refusal). Connection: connected / reconnecting / recovered.

## Success Criteria

- SC-01 A real customer round appears live on dan's board and walks accepted → preparing → ready with the two actions at the tablet viewport (keyboard-capable).
- SC-02 Offline → banner + last-known board; recovery → refetch reconciles; reload mid-service → authoritative columns.
- SC-03 The board stays money-free and address-free under the live-text assertion.
- SC-04 Every frozen E2E assertion passes unedited; the new display suite passes.
