# Checklist: Phase 10 — Requirements (specs/030-kitchen-display-ux)

## FR-01 Columns
- [ ] Three columns as `<section data-kitchen-column aria-label>` with real h2 headings + count pills.
- [ ] Labels: 'Incoming (awaiting cashier)' (new), 'In preparation' (accepted+preparing), 'Ready to serve' (ready).
- [ ] Per-column named empties; overall-empty state names the columns.

## FR-02 Cards
- [ ] `article[data-ticket-id][data-ticket-state]` preserved; items with quantities + extras (presentation only).
- [ ] Channel-neutral wording; 'Table {label}' when a table exists, 'Counter order' when null; NEVER 'Table null'.
- [ ] No money, no address, under any condition.

## FR-03 Age (D2)
- [ ] `formatTicketAge`: '3 min' → '1 h 05 min'; never seconds.
- [ ] Bands fresh/working/late at 4/5/14/15 boundaries; late = warning treatment + text-bearing.
- [ ] '—' when created_at missing.

## FR-04 Actions
- [ ] Exactly 'Start preparation' (accepted) and 'Mark ready' (preparing), pinned names, large targets, busy/disabled.
- [ ] No accept action anywhere; no optimistic state (the refetch is the state).

## FR-05/06/07 Live + reload + branch
- [ ] LiveBadge + ReconnectingBanner wired (onStatus on the kitchen_tickets binding); polite announcement count-derived.
- [ ] Reload renders authoritative columns (asserted by E2E).
- [ ] Branch picker 'kitchen-branch' for multi-branch; none single-branch.

## FR-08/09
- [ ] Refusals verbatim on the originating card (`data-refusal`).
- [ ] Money-free + address-free re-asserted over LIVE board text in the new suite.

## UX / Visual / Responsive / A11y
- [ ] KDS scale: big type/counts/targets; strong borders/radii (tokens only); state never color-only.
- [ ] Brief NEW highlight, cleared by id, reduced-motion collapses; no sound anywhere (D1).
- [ ] ≥1025 fluid columns; <1025 stacked; 390px readable fallback (boundary documented).
- [ ] h2 headings for SR nav; polite regions only; axe clean; focus never stolen.
