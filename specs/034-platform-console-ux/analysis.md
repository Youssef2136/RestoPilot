# Analysis — 034-platform-console-ux

> Normalized 2026-10-06: extracted verbatim from the single-file `spec.md` (committed in `9dba5d3`) into this standalone file, the 031/032 pipeline layout. Content unchanged; the convergence round (C001) is recorded in `tasks.md`.

No contradictions: D1 reuses the committed P12 artifact (dependency narrowed exactly as
the Master Plan documents); D3 is client-side over the existing payload (FR-10 intact);
Backend NOT_REQUIRED.

**Correction during implementation (kept for the record):** the earlier claim that the
frozen suite's asserted texts are byte-identical under D1 missed two pins —
`e2e/platform.surfaces.test.ts` asserts the console renders 'Never activated' twice
(the overview list test and the onboarding coherence step). D1 unifies the vocabulary
on `subscriptionCopy`, whose never-activated label is 'Not activated yet', so those
pins necessarily move. Migration executed per the change discipline: documented here
and in the §Phase 034 ledger record, paired pin updates in the same commit, unit
coverage locking the new label (`stateLabel`), and both suites validated green. The
suite's remaining texts ('Active'/'Expired'/'Disabled', banner states, denial) are
byte-identical under D1.
