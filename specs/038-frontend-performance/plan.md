# specs/038 — Implementation Plan (Performance & Perceived Speed)

## plan.md

### Constitution check (I–VIII)

| Principle | Verdict | Note |
|---|---|---|
| I. Design-system-first | PASS | No new visual vocabulary — skeletons come from the 037 family; aspect boxes reuse the 02 token rules; any perceived-speed treatment is invisible at rest. |
| II. Verbatim backend contracts | PASS | Zero RPC/backend changes; cache keys keep carrying identity/scope; no new caching of tenant data across identities. |
| III. Server-enforced authorization | PASS | Prefetch only for surfaces the identity may already read (clarified); no prefetch for token-scoped customer reads. |
| IV. No invented data | PASS | No speculative optimization: every change is recorded Baseline → Change → Measurement → Result; a measured "no change needed" is a valid Result. |
| V. Determinism | PASS | Bundle-class assertions are deterministic build-output facts; timing measurements are recorded informational (clarified — no hard timing assertions on the shared cloud DB). |
| VI. Presentation-contract ledger | PASS | No pinned name/copy moves expected; any incidental move is Category-A recorded. |
| VII. Token discipline | PASS | No new colors/fonts; placeholder treatments reuse the 037 vocabulary. |
| VIII. Gates | PASS | verify + full Playwright batched per protocol + the standing 015/016/017 suites UNMODIFIED and green. |

### Decisions (D1–D8)

- **D1 — Measurement harness = Playwright CDP + Performance API, tool recorded.**
  Route navigation timings on the throttled profile (Slow 3G + CPU×4, clarified)
  recorded via CDP emulation inside Playwright specs; verdicts on the shared
  cloud DB stay informational. Bundle facts come from `vite build` outputs
  (deterministic). Lighthouse is a MANUAL, recorded capture (clarified) — no
  CI automation this phase.
- **D2 — Route-level code splitting via `React.lazy` per shell group.**
  Customer routes (public + in-session) and staff/admin routes become separate
  chunk classes by splitting at the router's existing shell-group boundaries
  (`CustomerShell` vs `StaffShell`): the customer page bundle must not contain
  staff/admin module ids and vice versa (hard build assertion). Loading
  states = the 037 Skeleton in a shell-level Suspense fallback. RouteTitles /
  routes.ts stay static (E2E imports them without Vite defines — preserved).
- **D3 — Budgets: all informational EXCEPT the deterministic bundle-class
  rule.** `menu_loading` 1500 ms and `round_submission` 800 ms remain the 016
  budgets (re-measured, not re-litigated); the customer journey re-measures
  them on the throttled profile and records the result; FR-09 regression
  checks re-run the 016 measurement script on the final tree.
- **D4 — Cache-policy table lives in the phase artifacts.** One table covers
  every live query family (public restaurant 60 s staleTime; customer session
  reads retry:false poll 10 s; staff realtime-invalidated reads retry:3;
  auth context; reports keys incl. anchorDate) — the client matches the
  table (queryClient defaults + documented per-hook deviations). Prefetch
  only where measured to help, staff-side only (hover/intent), and recorded
  otherwise.
- **D5 — Images follow FR-03 with a measured inventory.** Menu items expose
  `image_path` (signed reads; the e2e order surface currently renders NO
  `<img>` — ItemCard's image slot is a designed absence Q4, which is itself
  a re-render/loading win to record); the staff image editor (ItemImageField)
  gains lazy/aspect-box loading through ONE shared `SmartImage`-style helper
  only if the measurement shows a real problem; a "no change needed" Result
  is acceptable and recorded.
- **D6 — Re-render discipline: measure with scoped render counters first.**
  A burst probe counts renders of the list container vs rows on cashier/kds
  boards during a burst; `memo` boundaries applied only where counters
  prove cross-list re-renders; stable keys verified (no service remount on
  refresh).
- **D7 — Long lists: recorded probe per surface, virtualization allowed but
  not defaulted.** The audit trail / reports comparison / kitchen backlog
  probes decide per surface (clarified); where used, the 035 a11y baseline
  must hold.
- **D8 — Realtime cost review = measurement, then removal decisions.**
  Channel count, notification coalescing, and redundant invalidations are
  measured (existing 012/realtime suites stay green); removals happen only
  with a recorded measurement showing redundancy (e.g. poll + realtime
  overlapping refetch on the same key), never by guesswork.

### Architecture notes

- The splitting boundary is the EXISTING router declaration: route modules
  inside the two shell groups are lazily imported; the shell components
  themselves stay eager (their layout/landmarks are the first paint).
- The measurement harness is a small recorded script set under
  `specs/038-frontend-performance/measurements/` (per evidence entries), and
  the build-output assertion lives in an e2e/unit-consistent spec reading
  the actual `dist/` manifest, not hardcoded numbers.
- The customer perceived-speed checks ride the EXISTING customer suites
  (entry.mobile, customer.menu, full-journey) — a NEW throttled journey spec
  holds the recorded budget posture; no behavioral change to any pin.

### Verification approach

- Unit: bundle-class fixture assertions + cache-policy table helper
  (if code needed) + image helper behavior (if adopted).
- E2E: the throttled customer journey (informational thresholds,
  variance-acknowledged), burst render-counter probes (deterministic at the
  component level), the deterministic chunk-split assertions, the
  FR-09 re-measure artifact.
- Standing suites: 015 a11y + 016 responsive + 017 state suites re-run
  UNMODIFIED and green (SC-006).
