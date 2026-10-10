# specs/038 — Performance & Perceived Speed (Master Plan §Frontend Phase 18)

## spec.md

### Purpose
The customer menu and order submission are the product's most latency-sensitive
paths (master plan §26), and the staff boards you stare at for a whole shift
must not stutter while rounds arrive. This phase makes the frontend fast in
ways that are **measured, not asserted** — reusing the 016 baselines and adding
frontend-side budgets. It is an **operate** phase: no new product features, no
backend/RPC/database optimization (016 owns backend baselines), no CDN or
caching-layer changes, no dependency-driven rearchitecture (SSR, a new data
client), and no speculative micro-optimization — **only measured bottlenecks
are optimized**, and every optimization is recorded as
**Baseline → Change → Measurement → Result** in the feature directory. A
performance claim "looks better" is not evidence; a recorded measurement is.
Behavior and tests do not change: the Phase 15 a11y suites, Phase 16
responsive suites, and Phase 17 state suites stay green unmodified.

### User Stories (prioritized)

#### US1 — A guest sees the menu quickly on a mediocre phone connection (P1)
On a throttled mobile profile (the recorded slow-3G/CPU×4 profile), the
customer menu reaches **interactive in under two seconds of perceived load**
(the 016 `menu_loading` budget) and **adding an item to the cart feels
instant** (local-first cart state; no network round-trip on the add path).
The route's JavaScript payload is what the customer route needs — staff/admin
code is not downloaded on customer routes (route-level code splitting,
FR-02), and menu images do not shift the layout when they land (FR-03).

**Why this priority**: the guest is the revenue path; a slow first paint or a
janky cart is the most user-visible performance failure in the product.

**Independent test**: a throttled journey spec measuring the recorded budget
on the customer menu (informational thresholds where network variance
dominates over shared cloud infrastructure, hard assertions only where
deterministic — e.g. chunk boundaries, no duplicated requests), plus a unit
pinned image-helper contract and a bundle-assertion artifact.

#### US2 — A cashier's board never stutters while rounds arrive (P1)
The cashier round queue and session oversight update under a real burst
(the walkthrough's seeded burst cadence) without a measurable stutter: list
re-renders are scoped per event (no list-wide re-render per arrival,
FR-06), keys are stable so services never remount (no visual "pop" when
realtime refreshes replace lists), and the poll/invalidation cost is
profiled and recorded — redundant invalidations and overlapping channels
are measured before removal, never guessed.

**Why co-priority with US1**: an operator staring at a frozen or flickering
board during service loses as much trust as a guest staring at a white
screen.

**Independent test**: a profiled burst on the live board with the render
counter scoped to the list container (a deterministic unit-level render
count, not an eyeballed "smooth"), plus the standing realtime suites green.

#### US3 — Kitchen sees prompt updates without flicker (P2)
The KDS board updates promptly on hand-off events without visible flicker:
stable keys, memo boundaries where measurements show cross-list re-renders,
and the refetch/realtime policy per the recorded cache policy table (FR-04)
— promptness measured against the realtime baseline (≈218 ms subscribe,
≈72 ms reconnect), not asserted.

**Why this priority**: the kitchen backlog is real money too, but the board
is a single-column surface — smaller render surface than the cashier queue.

**Independent test**: burst profiling on the kitchen board mirroring US2's
harness (the recorded finding decides whether memoization is needed at all —
a measured "no change needed" is a valid recorded Result).

#### US4 — An owner's reports open quickly without freezing the laptop (P2)
The reports comparison and void/audit trails open within the recorded
perceived-latency budget on realistic data volumes: the page-level skeleton
(product 037) covers the wait; long trails render within an interaction
budget that is measured first — and virtualization is used ONLY where the
measurement demands it (a documented decision, never a default; FR-07).

**Why this priority**: reports are occasional-use; correctness already
shipped; the risk is idle-laptop jank on long trails, resolved by
measurement-then-decide.

**Independent test**: navigation timing on /dashboard/reports and
/dashboard/audit against the seeded volumes; a long-trail render probe
informs the virtualization decision, recorded either way.

### Functional Requirements

- **FR-01 Measured baseline capture** — frontend paths are measured and
  recorded in the feature directory BEFORE any optimization: route navigation
  timings (customer menu, staff dashboard, reports), interaction latencies
  (cart add, board transitions), and bundle sizes per route class (customer
  vs staff). Every Baseline names its measurement harness (Playwright CDP /
  Performance API / vite output stats) and its throttling profile.
- **FR-02 Route-level code splitting** — customer routes do not download
  staff/admin-only code and vice versa (route-level chunks with loading
  states from the Phase 17 vocabulary). The split boundary is a hard,
  deterministic assertion (chunk class membership of route modules), not a
  network-timing claim.
- **FR-03 Image strategy** — menu images ship correct sizes, lazy loading
  below the fold, and stable aspect boxes: no layout shift when images land
  (the 02 aspect-box rules are the vocabulary; the placeholder → loading →
  loaded → failed image states must not shift the layout and must not hide
  focusable content from keyboard/AT).
- **FR-04 Cache policy per query family** — each query family records its
  freshness expectation (fresh / poll 10 s / realtime invalidation /
  staleTime pause) in one written table; the client policies match the table
  (queryClient defaults + the documented per-hook deviations), and cache keys
  continue to carry identity/scope — no new cross-identity caching, no
  prefetch of data the identity cannot read.
- **FR-05 Prefetch where it improves navigation** — staff-side prefetch on
  hover/intent ONLY where a measurement shows real navigation-cost savings,
  only for surfaces the identity may already read, and never for customer
  token-scoped reads. A measured "prefetch is not worth it" is a recorded
  decision; the bandwidth intent is honored either way.
- **FR-06 Re-render discipline on live boards** — measure first: scoped
  render counters prove whether round arrivals re-render whole lists; memo
  boundaries are added only where the measurement shows a cross-surface
  re-render, and stable keys are verified so services never remount on
  refresh.
- **FR-07 Long-list rendering** — for long trails/queues (audit, reports,
  kitchen backlog), the measurement decides: a recorded probe decides
  virtualization yes/no per surface; where used, virtualization preserves
  the 035 a11y baseline (focus, labels, live regions) and the 016 narrow
  contracts.
- **FR-08 Budgets with measured results** — recorded budgets with
  thresholds and results: (a) the customer menu interactive latency budget
  (016: 1500 ms `menu_loading`, asserted on the recorded throttled profile —
  informational, network-variance-acknowledged), (b) route chunk sizes per
  route class (deterministic build-output assertion), (c) interaction
  responsiveness (cart add ≤ a recorded threshold measured with the
  Performance API; round submission per the 016 800 ms budget for the
  network part). Every budget threshold is justified by its baseline
  context; none is invented without support from existing measurements.
- **FR-09 No frontend-attributable 016 regression** — the 016 budgets
  (`menu_loading` 1500 ms, `round_submission` 800 ms, realtime ≈218 ms
  subscribe / ≈72 ms reconnect, storage upload ≈189 ms / signed read
  ≈258 ms) are re-measured on the final tree; any regression attributable to
  a frontend change is either repaired or recorded with its cause
  (infrastructure variance is acknowledged, not hidden).

### Out of Scope
Backend/RPC/database optimization; CDN/provider changes; any caching layer
that could serve stale business state; SSR or a new data client; speculative
micro-optimizations without a measurement; new product features; visual
redesign (any layout-stability change — aspect boxes, reserved space — must
be invisible at rest).

### Success Criteria
- **SC-001** Every optimization in the diff carries a recorded
  Baseline → Change → Measurement → Result entry; zero unmeasured claims.
- **SC-002** The throttled-profile customer journey meets the recorded
  menu budget on the recorded profile (informational threshold recorded
  with its variance profile).
- **SC-003** A burst on the live boards shows no measurable list-wide
  re-render per event (the render counter proves scoping).
- **SC-004** Route chunks satisfy the recorded class boundaries
  (customer pages ship no staff/admin module ids and vice versa —
  deterministic).
- **SC-005** The cache-policy table covers every live query family with its
  freshness expectation; the client matches the table.
- **SC-006** Phase 15/16/17 suites re-run UNMODIFIED and green (zero
  Category-A migrations; any requires-clause behavior must name its reason).

### State Matrix (new rows only)
Cache: fresh / stale / refetching / offline (per the FR-04 table — the
product 037 vocabulary renders every row). Images: placeholder / loading /
loaded / failed — never shifting layout, never hiding focusables. Chunks:
loaded / slow (a Phase 17 skeleton renders) / failed (the error boundary
path). Lists: short / long / virtualized-if-demanded (recorded decision
per surface).

### Assumptions
- The measurement harness is Playwright's CDP session (Network.emulateNetworkConditions
  + CPU throttling where supported) recording the Performance API timings —
  the tool choice is recorded; values from shared cloud DB infrastructure are
  NOT frozen as hard assertions (016's honesty rule).
- React Compiler / build-transformation flags are NOT adopted (dependency-
  adjacent behavior changes); memoization is hand-applied only where measured
  demands.
- The 016 recorded baselines remain the shared oracle; this phase re-measures
  them on the final tree (FR-09) — it does not re-litigate them.

## Clarifications (session 2026-10-10)

- Q: Which budgets become hard assertions in CI (vs informational on shared
  cloud infra)? → A: ALL informational/recorded — zero hard timing assertions
  on timings over the shared cloud DB; only deterministic build-output facts
  (chunk class membership) are hard.
- Q: Which choices use the documented defaults? → A: The documented defaults
  apply (harness honesty rule; existing 016 budgets as the oracle; no
  re-litigation) — the spec's Assumptions section is confirmed as-is.
- Q: How are image payloads handled? → A: Measure first, no invented size
  caps — image handling follows FR-03 (correct sizes, lazy below fold,
  aspect boxes) with recorded measurements; no speculative budget.
- Q: Is list virtualization allowed (and where)? → A: Measurement decides
  per surface — each surface (audit, reports, KDS) gets a recorded probe;
  the decision (use or not) is recorded either way; no default adoption.
- Q: What bundle-size thresholds are adopted? → A: Chunk-class boundaries
  only — hard deterministic assertions are the SPLIT BOUNDARIES (customer
  pages contain no staff/admin modules and vice versa); no numeric KB
  thresholds are added in this phase.
- Q: Which throttling profile is used for measured journeys? → A: The
  recorded 316/coastal profile: Slow 3G network + CPU×4 (via CDP emulation)
  for customer-journey measurements; the operational tablet profile for
  board bursts per the spec's Responsive section.
- Q: Is Lighthouse automated or manual? → A: Manual, recorded — a manual
  Lighthouse-style capture is recorded in the feature directory during
  implementation (tool + values recorded); no CI automation this phase.
