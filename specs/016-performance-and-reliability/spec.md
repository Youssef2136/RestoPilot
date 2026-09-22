# Specification: Performance and Reliability (Phase 15)

**Feature dir**: `specs/016-performance-and-reliability` | **Created**: 2026-09-22
**Input**: Master plan §26 — make the system operationally stable before
launch. Two halves: **baselines first** (measure the nine areas before
touching anything — "do not optimize prematurely" is the phase's own rule),
then **targeted fixes** only where a baseline or reliability test proves a
real problem, with the customer path (menu loading, order submission) at
higher priority than analytics.

## Clarifications resolved at specify time

The house conventions resolve the draft's open terms: "performance baseline"
= a committed, re-runnable measurement script producing a JSON artifact per
area (not CI-flaky assertions); "reliability test" = deterministic e2e/db
journeys for the eight §26 scenarios, existing ones reused where they
already cover a scenario (refresh-during-session, duplicate submit, and
concurrent double-click are already proven by FR-013 reload tests, the
008 cart idempotence review, and the entry RPC's race-safe open-or-join);
"real problem" = a measured baseline that violates the stated budget or a
reliability journey that fails. No premature re-architecture is authorized:
fixes are index additions, query shaping, and client cache tuning only.

## User stories

### US1 — Baselines exist for every area (P1)

A developer runs one script and gets a machine-readable baseline covering
all nine §26 areas: menu loading, dashboard queries, realtime fan-out,
session retrieval, round submission, kitchen ticket updates, report query
performance, image handling, and reconnection. Each measurement records the
query/surface, the wall time, and the environment. The artifact is
committed so later phases can detect drift.

**Why**: §26's own rule — no optimization before baselines exist.

### US2 — The customer path meets its budget (P1)

The prioritized surfaces — customer menu load and round submission — have
stated budgets and are measured against them: menu payload under 1.5 s
and a submission round trip under 800 ms on the dev project. A breach
triggers a targeted fix (index or query shaping), never a speculative one.

**Why**: §26's explicit priority ordering.

### US3 — Reliability journeys hold for all eight scenarios (P1)

The eight §26 scenarios pass deterministically: refresh during an active
session (token survives, state reconciles), network interruption and
realtime disconnect (client recovers or refuses closed), duplicate submit
and double-click (exactly one round per confirmed cart action), stale tab
(reload reconciles), concurrent cashiers (two staff acting on one round
resolve to one deterministic state), simultaneous customer actions
(two participants, one session — the open-or-join guarantee).

**Why**: §26's reliability list; each is either already proven (cited) or
gets a new deterministic journey.

### US4 — The launch gate is recorded (P2)

The phase ends with the baseline artifact, the reliability results, and any
fixes committed — the operational stability claim is reproducible, not
narrative.

**Why**: §26's exit condition.

## Requirements

- **FR-001**: A committed baseline script measures all nine areas and
  writes a JSON artifact with per-area timings and environment metadata.
- **FR-002**: Customer-path budgets are stated in this spec (menu ≤ 1.5 s,
  submission ≤ 800 ms) and measured by the baseline script; a breach
  produces a targeted fix and a re-measurement in the same phase.
- **FR-003**: Each of the eight reliability scenarios is either cited to
  the existing test that proves it or covered by a new deterministic test
  added in this phase.
- **FR-004**: Any performance fix is minimal and targeted (indexes, query
  shaping, cache settings); no caching layer, no schema denormalization,
  no premature re-architecture (anti-drift and one-read-path rules hold).
- **FR-005**: The baseline artifact and reliability results are committed
  as the phase's launch-gate record.
- **FR-006**: Realtime disconnect recovery is measured for the
  reconnection area: the client's recovery refetch (FR-004 of spec 012)
  is exercised by a deterministic test, not assumed.

## Non-goals (this phase)

- No CDN/edge work, no load testing of the hosted Supabase project beyond
  the dev fixture's scale, no horizontal scaling design.
- No new features, no UX changes; reliability tests document existing
  behavior unless a journey proves a real defect (then minimal fix).
- No premature optimization: untouched areas stay untouched unless their
  baseline breaches a budget.
