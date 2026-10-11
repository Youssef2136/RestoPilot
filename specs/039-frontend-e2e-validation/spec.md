# specs/039 — Frontend End-to-End Validation (Master Plan §Frontend Phase 19)

## spec.md

### Purpose
The frontend's **dress rehearsal**, mirroring spec 017 for the UI: one
connected multi-role journey plus a per-role proof table covering realtime,
notifications, responsive, accessibility, performance, and the state matrix —
with every scenario either cited to a standing suite or newly covered. This
is a **validate** phase: no new product features, no redesign (friction found
is recorded, not fixed here — fixes go to the owning phase or a convergence
task with a justification), no new backend coverage (the existing db/
integration suites are cited as the backend half), and no production
deployment (Phase 20 owns release).

### User Stories (prioritized)

#### US1 — One connected story (P1)
The product owner can watch ONE long, deterministic browser journey prove
the frontend works end to end: fresh scratch tenant onboarding (owner) →
customer entry → rounds → cashier/kitchen handling → status → bill/void →
session close → reports/audit → platform console — driven at the interface
level the way a human would (no DOM shortcuts to bypass UI), with document
injections only where a state cannot be reached honestly (the existing
poisoned-cart precedent is the named exception).

**Why this priority**: the connected journey IS the phase's deliverable to
reviewers — everything else cites or supports it.

**Independent test**: one new serial journey spec (`e2e/release.journey.test.ts`)
passing on a freshly reset seeded database within one documented run window
(the sign-in rate limit respected — one sign-in per persona, storage-state
reuse where the journey legitimately revisits).

#### US2 — Per-role proof journeys (P1)
Each persona proves its PRIMARY task independently and rerunnable alone:
owner (restaurant setup, menu/tax/branches ownership), branch manager
(Downtown oversight, staff ops), cashier (round flow, void, bill), kitchen
(Marina ticket board, hand-offs), super admin (console ownership + reach
honesty), public guest (entry → menu → orders at 390 px). Each journey is
its own file/serial block so a reviewer can run one role's journey without
the rest.

**Why this priority**: per-role rerunnability is the maintainability promise
(a future maintainer trusts a result they can reproduce in isolation).

**Independent test**: per-role files (`e2e/release.role-*.test.ts`) passing
standalone after a fresh db:reset.

#### US3 — The scenario→proof table (P1)
A reviewer can find the proof for ANY validation scenario in ONE table:
realtime arrival, reconnect recovery, notification/cue, cutoff, void, audit
visibility, subscription states, responsive completion at
mobile/tablet/desktop, accessibility assertions, console cleanliness
(expected-vs-unexpected per F-G14), and the state matrix spot-checks. Every
row cites file + test name, or names its NEW coverage — no silent gaps.

**Why this priority**: the table is how the phase is audited; a scenario
without a proof is a gap, and a proof with a weakened assertion is worse.

**Independent test**: `specs/039-frontend-e2e-validation/scenario-proof.md`
committed with every row's status resolvable by grep (the cited test exists
in the named file).

#### US4 — The release candidate's standing passes (P2)
The release candidate runs the standing gates in one documented window:
`npm run verify`; the full `npm run test:e2e` batched per the committing
protocol; a11y/responsive/console suites green; a recorded run summary +
the screenshots of required viewports committed as the visual record
(§6.6).

**Why this priority**: this is the closing ceremony — the recorded evidence
that the candidate is what the previous phases promised.

**Independent test**: the run summary artifact + a green single-window run.

### Functional Requirements

- **FR-01 The committed journey** — one connected journey from setup through
  reporting, using a freshly created scratch tenant, cleaned up (the
  existing full-journey cleanup posture) or explicitly left as documented
  residue in the record.
- **FR-02 The per-role journey suite** — the six personas, each proving its
  primary task, each independently runnable; denial behavior included
  (out-of-scope deep links, role denials, cross-tenant isolation at the UI
  level — NOT happy paths only).
- **FR-03 The scenario→proof table** — the enumerated coverage rows; every
  scenario cited (file + test name) or newly covered.
- **FR-04 No silent gaps** — the table resolves a status for every claimed
  coverage (no cited-but-missing, no newly-claimed-but-unwritten).
- **FR-05 No weakened assertions** — failures are fixed or the intended
  behavior asserted; a proof whose assertion was weakened to pass is worse
  than no proof.
- **FR-06 The full gate with a recorded summary** — `npm run verify` + the
  full batched e2e in one documented run window (respecting the sign-in
  rate limit, §12.5), with a committed run summary artifact.

### Out of Scope
New product features; redesign (friction recorded, not fixed — fixes belong
to the owning phase or a convergence task); new backend coverage (cite the
existing db/integration suites); production deployment (Phase 20); new RPCs
or schema changes.

### Success Criteria
- **SC-001** The journey and all role suites pass in ONE run on a freshly
  reset seeded database.
- **SC-002** The scenario→proof table has zero unresolved rows (every
  scenario: cited or newly covered, resolvable on disk).
- **SC-003** The a11y/responsive/console cleanliness suites pass on the
  release candidate; console proof is expected-vs-unexpected (F-G14), never
  a blanket "zero errors" claim.
- **SC-004** Screenshots at the required viewports committed per surface
  (the visual record).
- **SC-005** `npm run verify` green with a committed run summary.

### State Matrix spot-check rows (per role, at least one each, in a real browser)
Loading (a skeleton seen), empty (a zero-result posture), error (an honest
posture line), offline/reconnect (the banner lifecycle), and refusal (a
verbatim refusal) — covered by the journeys or named as standing-suite
citations where the injection is already deterministic.

### Assumptions
- The seeded fixture personas cover the six roles as-is (no new seed).
- The rate-limit discipline: one sign-in per persona per journey with the
  existing helper's bounded retry; storage-state reuse only where the
  persona legitimately revisits within one journey.
- Screenshots ride Playwright's screenshot API on the SAME runs (no extra
  headed runs needed).

## Clarifications (session 2026-10-11)

- Q: Which scenarios get NEW coverage vs citation? → A: THE connected
  journey is new + the state-matrix spot-checks ride the journeys; every
  other scenario CITES a standing suite (no duplicate coverage of what the
  standing suites already prove).
- Q: Does the connected journey create a scratch tenant or run on the
  seed? → A: A SCRATCH TENANT, created and cleaned up inside the journey
  (the full-journey posture) — the strongest setup-through-reporting proof.
- Q: How much residue is acceptable? → A: ZERO residue — the scratch
  tenant is cleaned up inside the journeys; the seeded personas remain
  exactly the fixture; the residue posture is recorded in the run summary.
- Q: Does WebKit join the validation run? → A: NO — Chromium only (the
  standing protocol; WebKit is not part of the recording gate).
