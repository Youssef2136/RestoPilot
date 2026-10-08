# Exceptions record — specs/035 (spec FR-11; the reviewed list)

Every finding NOT fixed in this phase lives here with a reason and a named owner —
no silent gaps. Findings fixed this phase are closed in `report.md` (F-002…F-006)
and are NOT exceptions.

| ID | Severity | Finding | Reason it is not fixed here | Owner |
| --- | --- | --- | --- | --- |
| EXC-001 | moderate | The manual screen-reader EXECUTION of the five walkthrough scripts (W1–W5, `specs/035-accessibility-hardening/quickstart.md`) — the scripts and their expected outcomes are delivered and frozen; a human run with a real screen-reader environment (NVDA/VoiceOver) is not performable by the build agents | Requires a human operator with an SR environment; the clarify decision scoped the phase deliverable as the recorded expected-outcome scripts, which are done | Project owner (run the scripts; log results into `report.md`'s W-table) |
| EXC-002 | moderate | Forced-colors: surfaces render on the UA's forced palette and the axe floor holds (T013), but brand-colored surfaces (primary buttons, status tints) swap to system colors under the emulation — the token system does not yet define forced-colors-specific mappings | Clarify decision: audit-and-record; new token-system work is out of scope this phase ("no redesign"; the system is amended, not forked, when the product decides to invest) | Design-system owner (a future design-system amendment, not a phase-035 fix) |
| EXC-003 | minor | The touch-target sweep prototype's stricter-than-axe standard (bare bounding boxes without the 2.5.8 (d) UA-default exception) mis-flags author-untouched native controls; the committed axe rule is the authority and the prototype's findings were re-run through it | Not a product gap — a tooling lesson recorded for future sweeps (use the axe rule, not raw geometry) | Spec 035 maintainer (the lesson is embedded in `e2e/touch.targets.test.ts`'s docstring) |

Zero serious-plus findings are outstanding: every critical/serious finding the
audits surfaced (F-001 pre-fixed by 031, F-002, F-003, F-005, F-006) is FIXED with
evidence in `report.md`.
