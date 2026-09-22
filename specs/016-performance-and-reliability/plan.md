# Implementation Plan: Performance and Reliability (Phase 15)

**Feature**: `016-performance-and-reliability` | [Spec](spec.md) | Created 2026-09-22

## Summary

Two halves, in the phase's own order: (1) a committed baseline script that
measures all nine §26 areas against the dev project and writes
`specs/016-performance-and-reliability/baselines.json`; (2) deterministic
reliability journeys for the eight §26 scenarios — three already proven by
existing tests and cited, five added here. Fixes only where a budget
breaches or a journey fails.

## Architecture decisions

- **D1 — Baselines are a script + a committed artifact, not CI assertions.**
  `scripts/run-perf-baselines.mjs` (the 013/014 walkthrough pattern: real
  sign-ins, real data API) times each area with `performance.now()` around
  real calls, takes the median of 5 runs per area, and writes JSON with
  environment metadata (project ref, fixture scale, timestamp). Timing
  assertions live in this phase's verification, not the standing gates —
  remote-cloud latencies are too environment-dependent to gate on.
- **D2 — Each §26 area maps to a concrete measured call:**

  | Area | Measured surface |
  |---|---|
  | menu loading | `get_session_menu` (token) + `get_branch_menu` |
  | dashboard queries | `get_branch_rounds` + `get_branch_open_sessions` + `get_audit_log` |
  | realtime fan-out | existing e2e latency note (spec 012 journeys) — script measures subscribe→SUBSCRIBED handshake |
  | session retrieval | `get_session_context` |
  | round submission | `submit_round` (single line, seeded item) |
  | kitchen ticket updates | `start_preparation` → `mark_round_ready` on a driven round |
  | report query performance | `get_branch_sales_report` day/week/month |
  | image handling | Storage upload + signed read of a small fixture object |
  | reconnection | channel subscribe→SUBSCRIBED→unsubscribe→resubscribe cycle |

- **D3 — Budgets (spec FR-002): menu ≤ 1500 ms, submission ≤ 800 ms
  median.** Other areas are recorded without budgets this phase (§26 says
  baselines first; budgets for analytics surfaces are a later decision with
  the artifact in hand).
- **D4 — Reliability scenario → test mapping:**

  | Scenario | Coverage |
  |---|---|
  | refresh during active session | EXISTS: `e2e/session.surfaces.test.ts` FR-013 reload reconciliation |
  | duplicate submit | EXISTS: e2e cart double-submit guard (`session.surfaces`) |
  | double-click | EXISTS: e2e entry + submit buttons' disabled-until-settled behavior |
  | network interruption | NEW: db journey — an aborted mid-round submission leaves zero partial rows (the one-body-one-transaction proof) |
  | realtime disconnect | NEW: unit + e2e — recovery refetch fires on resubscribe (spec 012 FR-004 exercised) |
  | stale tab | NEW: db journey — a token from a session closed elsewhere refuses closed; UI reload reconciles (cited FR-013 + new refusal assertion) |
  | concurrent cashiers | NEW: db journey — two cashiers transition the same round; the guarded-update CASE yields exactly one winner, one final state |
  | simultaneous customer actions | EXISTS: 007's race-safe open-or-join partial unique index + its db suite |

- **D5 — Fixes follow the minimal targeted set** (indexes, query shaping,
  cache `staleTime` tuning). Any index lands as a migration + the full
  determinism chain.

## Testing strategy

Baselines run manually via the script (and once for the committed
artifact). New reliability journeys join the standing gates
(`test:db`/`test:unit`/e2e) so `npm run verify` proves them persistently.

## Risks

- **R1**: Remote-cloud timing noise → medians of 5, warm-up run discarded,
  and no standing timing gates (D1).
- **R2**: The realtime handshake measurement needs a real websocket — the
  script reuses the 012 walkthrough's channel discipline (await SUBSCRIBED
  before acting).
- **R3**: The concurrent-cashier journey could deadlock on a locked row —
  it uses two sequential guarded updates on separate connections inside a
  controlled state, then asserts single-winner semantics via row state,
  not via racing real transactions (determinism over spectacle).
