# specs/038 — Research

## R1 — The bundle baseline (measured 2026-10-10)

`vite build` on the phase-17 final tree emits ONE JS chunk:
`dist/assets/index-*.js` = **794 247 B raw** (776 KiB on disk; report line:
`794.06 kB │ gzip: 219.56 kB`) + one CSS chunk (61.67 kB / 10.47 kB gzip).
`src/app/router.tsx` declares both shells with EAGER page imports — zero
`React.lazy`, zero route-level splitting. The dev gallery is already
dead-code-eliminated in production (`routes.ts` header documents the import
contract). **The baseline for FR-02 is: customer routes download ALL 794 kB
of staff/admin/customer code.**

## R2 — 016 baselines are the oracle (no re-litigation)

`specs/016-performance-and-reliability/baselines.json` records (medians over
5 runs, warmup discarded): `get_session_menu` 106 ms (budget 1500 ms),
`get_branch_rounds` 118 ms, `get_branch_open_sessions` 103 ms,
`get_audit_log` 109 ms, `get_session_context` 105 ms, realtime
subscribe→SUBSCRIBED ≈218 ms, budget pair `menu_loading_ms: 1500` /
`round_submission_ms: 800`. FR-09 re-measures these on the final tree using
the RECORDED method (the 016 measurement script patterns), comparing like
for like; frontend-attributable regressions are repaired, infrastructure
variance is recorded as such.

## R3 — Throttling mechanism in Playwright

Chromium/CDP supports `Network.emulateNetworkConditions` (Slow 3G:
≈1.6 Mbps down/750 Kbps up/150 ms RTT — the DevTools preset values) and
`Emulation.setCPUThrottlingRate` (×4). Playwright exposes CDP via
`context.newCDPSession(page)`. The clarified profile: Slow 3G + CPU×4 for
customer-journey measurements; the operational tablet profile
(`responsive.devices.cashier` viewports) for board bursts. Recorded results
never assert absolute cloud-DB latency (clarified: informational).

## R4 — Route-level splitting constraints

- `src/app/router.tsx` + `RouteTitles` import `routes.ts` directly —
  E2E specs transpile `routes.ts` WITHOUT Vite defines (the header's
  stated contract). Splitting must therefore keep `routes.ts` and
  `router.tsx` route DECLARATIONS static (React.lazy inside a lazy-page
  registry that the E2E never imports), or keep module-level import maps
  out of the E2E-owned modules.
- Shell components (`CustomerShell`, `StaffShell`) stay eager: they render
  the skip link/`#main`/nav — first paint depends on them. The Suspense
  fallback renders the 037 Skeleton (the chunk slow state of the matrix).
- Bundle-class assertion: parse `dist/.vite/manifest.json` (or the emitted
  `assets/*` module import graph via `rollup-plugin-visualizer`-free means:
  the manifest lists each chunk's modules) and assert customer-page chunks
  import no staff/admin-only module ids (and vice versa). Deterministic,
  build-output-only.

## R5 — Query/cache families live today (FR-04 inventory)

`src/app/queryClient.ts` already documents the policy: queries `retry: 3`,
`staleTime: 0`, `gcTime` 5 min, focus/reconnect refetch ON; mutations
`retry: false`; documented per-hook deviations: `usePublicRestaurant`
(retry false, staleTime 60 s), `useSessionContext`/`useSessionMenu`
(retry false — token-scoped), `useSessionRounds` (retry false, poll 10 s).
The 037 clarify added "ONE automatic read retry, mutations manual-only" as
the standing.read policy — the table formalizes exactly these families;
client-vs-table diffs (if any) are recorded then aligned.

## R6 — Image inventory (FR-03)

Menu rows expose `image_path`; staff upload resolves signed URLs
(`useItemImage.ts` / `menuImages.ts` -> `getSignedImageUrl`). The customer
tree TODAY renders no `<img>` element on the order surface — ItemCard's
image slot is the designed absence (Q4 of the images feature). So the
customer-side image work is currently a SUCCESS STORY to record ("the
customer menu ships zero image payload" is a recorded Result), while the
STAFF editor is where lazy-loading/aspect boxes apply if the inventory
measurement shows an issue. Aspect-box tokens exist from Phase 02.

## R7 — Render-discipline probe design (FR-06)

Scoped render counting without shipping probe code: a Playwright spec can
wrap the board via `page.evaluate` instrumentation — but house-cleaner is a
UNIT-level render counter (JSX re-render counts via a test harness hook or
Profiling with `react-dom` Profiler) against a synthetic burst stream,
deterministic in vitest. The E2E burst then verifies END behavior (no
flicker: stable keys — a DOM-node identity assertion across a refresh,
`elementHandle.evaluate(el => el === previous)` per service row unit).
Memo boundaries only if the Profiler counts show list-container re-renders.

## R8 — Realtime cost review data points (D8)

016 recorded the realtime handshake; the 012/realtime e2e suites assert
fan-out behavior. The review measures: number of open channels per surface
(session subscribers, staff realtime channel, polling intervals),
duplicate invalidations per event (a debug counter in a vitest harness),
and poll-vs-realtime overlap on the same keys. Removal decisions require a
recorded measurement showing redundancy; behavior contracts (money-free
kitchen payloads etc.) are untouched.

## R9 — Lighthouse (recorded manually, clarified)

A single manual capture per key route (customer menu, staff dashboard,
reports) during implementation, recorded in `measurements/` with the tool
version and values; explicitly NOT frozen as CI assertions (shared cloud
infrastructure variance).
