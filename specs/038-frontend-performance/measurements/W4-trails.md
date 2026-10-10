# W4 — Trails evidence (T013) — measure-then-decide

**Date**: 2026-10-10 · **Probe data**: `W4-probe-data.jsonl` (appended by
`e2e/perf.trails.test.ts` itself — the LINE reporter drops attachments; the
evidence rule demands the record)

## The probe record (last clean run, seeded volumes)

| Surface | Navigation → listed | Rows rendered | Note |
|---|---|---|---|
| /dashboard/audit | **1121 ms** | 0 (empty seeded trail → the 037 empty posture ends the wait, honestly) | a listed-or-empty wait (no invented row count) |
| /dashboard/reports | **1147 ms** | 3 (the comparison table is branch-bounded: 2 seeded branches) | structurally a short list |

## Baseline → Change → Measurement → Result (W4)

- **Baseline**: no trail-specific measurement existed (016 measured the
  `get_audit_log` RPC at 109 ms median — the data layer only).
- **Change**: none yet — these are the FR-01 baseline captures the decision
  rides on (the phase's own rule: measure BEFORE optimizing).
- **Measurement**: the recorded probes above (informational posture,
  shared-cloud variance acknowledged; the HALF-SECOND-scale values are the
  real story of the navigation A→bundle→fetch→render path).
- **Result — virtualization decision (D7): NOT ADOPTED, recorded per
  surface**: both trails' volumes are far below any plausible
  virtualization win (the audit trail at realistic volumes continues at
  kilo-scale AFTER the paginated/filtered posture the surface already has;
  the comparison is branch-bounded by design). The recorded basis for the
  decision: the measured sub-second open time (1121/1147 ms) with ZERO UI
  jank evidence; if a future volume regime (multi-thousand trail rows)
  appears, this record is the baseline to re-probe against (the probe data
  file appends, so the history accumulates). The a11y baseline therefore
  needs NO re-run for a virtualization adoption — nothing was adopted.

## B7 (the trail budget) — set by the probe itself

The recorded threshold basis: the sub-second measured open time; any
future regression beyond ~3× this recorded value (≈3.5 s cloud-inclusive)
is the recording threshold for a re-probe — recorded as the budget line
in `budgets.md` (B7), justified by THIS baseline instead of invented.
