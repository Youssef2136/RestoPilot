# Coverage inventory notes (T001 — post-018 re-read)

Standing inventory re-verified against the CURRENT tree (the phase-18
sweep's zero-failure run is the baseline):

- `full-journey.test.ts` (3) — green, UNMODIFIED; it predates the 037/038
  states (its assertions target the pre-018 surface and still pass
  unchanged — nothing drifted). The RELEASE journey is the new connected
  proof (D1).
- `state.*` (12), `a11y.matrix` (31), `responsive.*` (12+), `realtime` (6),
  `live.awareness`, `perf.*` (5), `gallery.error`, platform/session/report
  surfaces — ALL green with their 018-file evidence; cited as-is.
- Drift found: NONE (every cited file+test from R1 exists verbatim).
- Note for the proof table: the offline-banner lifecycle citation is
  `state.operations.test.ts` leg 1; the customer poll/isolation citations
  are `state.customer.test.ts` + `security`-adjacent UI legs (the UI-level
  isolation proof is the guest role file's deny leg — NEW coverage).
