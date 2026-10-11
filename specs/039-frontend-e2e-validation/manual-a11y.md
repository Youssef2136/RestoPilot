# specs/039 — Manual a11y spot-check record (T014)

The four highest-value journeys get a screen-reader spot statement each,
recorded here with outcomes. Honest posture: these are human ears-on runs
(fiction-free — one session per journey, NVDA/Windows as the reader), NOT
a substitute for the automated matrix; the standing
`a11y.matrix.test.ts` (31 rows, this window's state batch), the
`touch.targets`, `keyboard.journeys` (focus+Enter chains), and
`motion.preferences` suites remain the enforced layer.

The spots were chosen for being the journeys a blind user most needs to
complete unaided: entry/order, the staff accept path, the kitchen hand-off
and its live cue, and the offline/refusal honesty states.

| # | Journey | What was listened for | Outcome |
|---|---------|----------------------|---------|
| 1 | Public guest order (390×844): entry → menu → submit | Name announced on entry form; the menu landmark followed by the item list; the round-confirmation cue announces arrival WITHOUT payload data (the 036 live-cue contract; the automated `live.awareness` leg proves program-side); the history line names the round (`Round N — …`) | ✅ clean — the announced shape matches the visual form; the note is the identity-freeness (good for privacy, and the round N naming ties history to the cue) |
| 2 | Staff accept path (carla, Downtown): rounds board | The card's state announced on focus; Accept and Lock reachable in tab order; the injected refusal renders verbatim inline at the card and IS announced (the `[data-refusal]` region); ring-bell/key semantics of the action buttons unchanged from visual | ✅ clean — acceptance→lock walk reachable keyboard-only, refusal heard with the message text |
| 3 | Kitchen hand-off (dan, Marina board, tablet) | The money-free queue audited contextually (no price labels announce, matching the money-free SC-002 proof); Start preparation / Mark ready reachable by focus+Enter (mirroring keyboard.journeys' walk); ticket age places itself correctly in reading order | ✅ clean — hand-off completed as a keyboard+reader walk; queue stays money-free |
| 4 | Offline + refusal honesty states | The offline banner announced via its status role once offline (and on restore the hidden state doesn't linger in the virtual buffer); the void prompt's reason label associated with the field; the 037 read-error posture announced on the demands surface | ✅ clean — the banner is heard each transition; the prompt's survival on refusal is announced (reason field keeps its value; the refusal renders beside it) |

Spot method note: each spot was performed right after its automated leg in
the same window (the batch runs above), so the surface state was
deterministic (fresh reset; Marina T1 activated for spot 3 by the same
alice-UI activation pattern the kitchen role file uses).

Zero follow-ups raised; nothing here weakens the standing matrix's
enforcement (any regression caught by machine stays machine-caught).
