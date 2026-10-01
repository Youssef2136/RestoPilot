# Checklist: Phase 09 — Requirements (specs/029-cashier-operations-ux)

Mark each item when the implementation satisfies it. Sources: spec.md FR-01…FR-10 + UX/visual/responsive/a11y/state-matrix sections.

## FR-01 Queue grouping
- [ ] Six groups (new / in progress / ready / out for delivery / delivered / served) render as `<section aria-label>` regions with h2 headings and counts.
- [ ] Per-group empty states name the group's posture (never a bare 'Nothing here.' without a group context is fine only if still understandable — prefer named empties).
- [ ] Grouping comes from `groupRoundsByState` (one mapping, unit-tested).

## FR-02 Transition actions
- [ ] Exactly the state-legal controls per card (accept/start/ready/lock/dispatch/complete per channel), pinned names preserved.
- [ ] Busy/disabled during flight; no double-submit path (buttons disabled while pending).
- [ ] The card re-renders only from the refetched read (no optimistic state).

## FR-03 Line modification
- [ ] Inline 'Reduce one' (qty > 1) and 'Remove line' per line, MODIFIABLE states only (new/accepted/preparing).
- [ ] Consequence helper copy near the controls (what a reduce/remove does; prices re-derive server-side).
- [ ] Refusals render verbatim on the originating card (`RefusalText`, `data-refusal`).

## FR-04 Void flow
- [ ] Boundary-aware: VOIDABLE per channel (dine-in@lock, delivery@out_for_delivery+, takeaway@ready); below-boundary rounds offer no void control.
- [ ] Mandatory reason: 'Confirm void' disabled until non-empty; ≤ 500 chars; boundary + irreversibility stated in the dialog.
- [ ] Voided display state visibly distinct from lock (text + styling, never color alone); reason preserved on card and bill.

## FR-05 Bill panel
- [ ] Inline (D1) on 'Show bill'; participants, per-line detail with captured prices/extras, tax lines by name, voided section with reasons, delivery address echo, grand total = payload verbatim.
- [ ] Numeric pins hold: voided line = exactly two decimal figures; `bill-grand-total` = exactly one.
- [ ] Print-check reading order, tabular money alignment.

## FR-06 Session oversight
- [ ] Open sessions with participants + opened time; scoped (server denial state preserved); two-step close with pinned dialog names; ONE inline role=status closure notice (strict-safe).

## FR-07 Realtime freshness
- [ ] 'Updated Xs ago' badge ticks from `dataUpdatedAt` and pulses while refetching.
- [ ] ONE polite live region announces coalesced refreshes (count-derived only).
- [ ] Reconnecting banner from binding `onStatus` (CHANNEL_ERROR/TIMED_OUT/CLOSED → banner; SUBSCRIBED → clear + recovery refetch); stale-data error keeps the board + retry.

## FR-08 Cue
- [ ] Cue announces 'A new order arrived.' with Dismiss (dashboard pin kept) and gains a path: board link on the dashboard; on the rounds page the cued card carries `data-round-cue` + visible marker, scrolled into view without focus steal.

## FR-09/FR-10
- [ ] `pickRefusal` routes verbatim messages to the originating card (unit-tested).
- [ ] Long queues render grouped without pagination; boundary recorded (no measured pressure → no virtualization).

## UX / Visual / Responsive / A11y
- [ ] Incoming group leads; counts glanceable; one deliberate tap per action; destructive confirms.
- [ ] `data-density='compact'`; 022 tokens only (design-literals gate clean, comments included); StateChip vocabulary; voided styling distinct.
- [ ] ≥1024 board columns; <1024 collapse; <768 stacked (same DOM, @media only); 390px keeps key transitions operable.
- [ ] Polite live regions only; axe floor clean on both routes; focus never stolen by refetch; dialogs trap/restore.
