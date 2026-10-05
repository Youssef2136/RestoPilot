# specs/032 — Realtime fidelity checklist (F1–F6)

- **F1** The event payload is NEVER rendered — the cue's text is the fixed 'A new order arrived.'; the new E2E asserts the customer's name/amounts never appear in the cue region.
- **F2** Invalidation-only stands: no binding edit, no poll change, no coalescing change (diff shows useRealtimeInvalidation untouched).
- **F3** Copy parity: every string moved into the policy module is byte-identical to the pinned ones ('A new order arrived.', 'The live connection dropped — reconnecting. Showing the last known board.', 'Reconnecting to live updates…', 'Back online — live updates restored.', 'Retry now', 'Dismiss', 'Show the new order').
- **F4** One event ⇒ one announcement: the dedupe guard suppresses same-class repeats inside the window; unit-pinned.
- **F5** Expiry honesty: the detail states ordering is NOT affected by expiry and the PLATFORM owner is the actor — for every non-silent state.
- **F6** No invented infrastructure: no table, RPC, permission, or outbound channel appears in the diff.
