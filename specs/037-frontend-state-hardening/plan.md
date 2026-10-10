# specs/037 — Implementation Plan (State, Error, Loading & Offline Hardening)

## plan.md

### Constitution check (I–VIII)
| Principle | Verdict | Note |
|---|---|---|
| I. Design-system-first | PASS | The state family (Skeleton/EmptyState/ErrorState/RetryButton/PartialFailureNotice/OfflineSurface/RefusalAlert) is built from tokens; no new raw hex. |
| II. Verbatim backend contracts | PASS | Refusal messages rendered verbatim (pinned presentation contracts); nothing paraphrased, nothing invented. |
| III. Server-enforced authorization | PASS | Forbidden states render what the server enforces; denial surfaces disclose nothing about other tenants; zero RPC/RLS changes. |
| IV. No invented data | PASS | No offline write queue, no optimistic mutation states, no phantom success — the contract supports no deferred writes. |
| V. Determinism | PASS | Failure injection via Playwright routing only; every injected failure reproduces identically every run. |
| VI. Presentation-contract ledger | PASS | Any selector/accessible-name moved by state work is recorded per the Category-A discipline. |
| VII. Token discipline | PASS | Status colors come from the token palette; state components are system patterns documented in conventions, not per-surface bespoke styles. |
| VIII. Gates | PASS | verify + the standing E2E suites + the new failure-injection suite; Phase 15/16 suites must pass unchanged. |

### Decisions (D1–D8)
- **D1 — Component family, not per-page states.** The seven components are built
  once in `src/components/state/` and consumed everywhere; route work composes
  them, never reinvents them.
- **D2 — Refusal split (clarified).** Mutations → inline `RefusalAlert` at the
  action site; reads → page-level `ErrorState` with retry. A toast is never the
  sole carrier.
- **D3 — Read retry (clarified).** One automatic retry on reads only (the
  query-client read-side review), then manual `RetryButton`. Mutations: manual
  only, guarded against duplicates.
- **D4 — Offline behavior (clarified).** Last-known data readable + staleness
  obvious; actions disabled with reason; no queue, no hidden buttons.
- **D5 — Skeleton threshold (clarified).** ~300 ms expected reads render
  skeletons sized to their content (no layout shift on swap).
- **D6 — Failure injection engine.** Playwright `page.route`/`route.fulfill` /
  `route.abort` + controlled realtime harness reuse from the existing realtime
  tests; no Wi-Fi tricks, no timing races.
- **D7 — State matrix lives in the phase artifacts.** `state-matrix.md` records
  all twelve rows per route, each mapped to its component and its test; the
  `docs/conventions.md` entry documents the vocabulary for future phases.
- **D8 — Session expiry composes with the in-flight guard.** The expiry fallback
  intercepts 401-class responses once (shell-level), preserves the return-to
  target per the Phase 04 guard behavior, and never double-handles a mutation
  that expired mid-flight.

### Architecture notes
- The state family is presentational only — it reads props, never RPCs; the
  existing query-client policy and the customer 10 s poll remain the data layer.
- The route-level error boundary extends the existing `RouteErrorView` (Phase 15
  made it a labelled section) — the fallback becomes the designed
  `ErrorState`+recovery path instead of a bare labelled section.
- `OfflineSurface` hooks the existing Phase 03 offline/toast infrastructure;
  kitchen/cashier/session-oversight wrap their boards with it (last-known data
  stays mounted; only the action layer disables).
- Announcement policy: loading → `role="status"` polite (only when it matters),
  refusal/error → `role="alert"` once per event (the Phase 15 burst policy).

### Verification approach
- Unit: state-selection helpers + component behavior (Skeleton sizing contract,
  EmptyState vs ErrorState distinctness).
- E2E (deterministic injection): refusal/delay/empty/timeout/offline/reconnect
  classes per the spec's testing section; duplicate-click burst on the named
  high-risk actions; partial comparison failure; expiry; boundary recovery.
- Standing suites: Phase 15 (44 rows) + Phase 16 (responsive) unchanged.
