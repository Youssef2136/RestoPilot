# Phase 09 Decisions (specs/029-cashier-operations-ux)

## D1 — Bill placement: INLINE, never a drawer/route (user decision, clarify)
The `Show bill` checkbox → inline `session-bill` panel is the pinned posture; a drawer would
cover the queue a cashier keeps working, and a route would break the board/bill linkage. Kept.

## D2 — Freshness: ticking badge + polite announcement + reconnecting banner (user decision)
'Updated Xs ago' ticks from the reads' `dataUpdatedAt` (the data truth — not a fabricated
clock); the dot pulses while `isFetching`. ONE polite `aria-live` region announces coalesced
refreshes count-derived ('The rounds board refreshed — N rounds on the board.') — never event
payloads. The binding's previously-unused `onStatus` drives the banner (CHANNEL_ERROR/
TIMED_OUT/CLOSED → 'Reconnecting…', SUBSCRIBED → clear + the binding's own recovery refetch);
a fetch error WITH data keeps the last-known board + 'Retry now' (stale honesty), without data
→ the pinned error paragraph. The banner is `aria-live="polite"` without role=status so the
sessions page's strict role=status pin stays single (and the banner only renders on rounds).

## D3 — Cue: unchanged lifecycle, gained path (user decision)
Event-derived, cleared on the round's first advance (no persistence — the contract's posture).
The dashboard banner gains 'Show the new order' → `/dashboard/rounds?branch={id}`; on the board
the cued round renders a 'New order' badge + brand-tinted card (`data-round-cue`) and
scrollIntoView({block:'nearest'}) — presentation only, never a focus steal.

## D4 — No undo/re-open; keyboard shortcuts OUT (user decision)
Void is irreversible by contract — the dialog states it and the audit trail is the recovery
record. Keyboard operability comes from native buttons/dialogs (focus trap/restore); a
shortcut layer would need discoverability guarantees the phase didn't earn. The E2E proves
the keyboard-only transition path works through native focus + Enter.

## D5 — Line modification stays INLINE per line (user decision)
'ModifyLineDialog' from the plan's component list yields to the frozen one-tap controls
('Reduce one'/'Remove line' inside each line — kitchen.cashier pins). Consequence copy rides
above the card's money line; refusals route verbatim via the extracted `pickRefusal`.

## D6 — Board groups as regions with named empties
`<section aria-label={group label}>` + h2 + count pill + 'Nothing waiting here right now.' —
the axe floor and the tablet pass both assert the regions. Group order: New orders → In
progress → Ready → Out for delivery → Delivered → Served ("what needs me now?" first).

## D7 — The new suite operates Marina T1, not Downtown
All the frozen cashier files anchor `.first()` on `[data-round-state="new"]` at Downtown T3 —
extra incoming Hummus cards would race their serial journeys. The new suite reuses the
realtime precedent: `withMarinaT1Lock` (activate → operate → deactivate, state-agnostic flip)
+ `withEntryLock` for the customer entry. Zero new cross-file mutexes invented.

## D8 — Session rows stay listitems with participant TEXT where asserted
session.surfaces pins `listitem` CONTAINS participant names ('Sara', 'Join First') — the
re-skin renders participant chips INSIDE the row's text flow so the contains-matches hold;
the structure stays `ul > li` (no table).
