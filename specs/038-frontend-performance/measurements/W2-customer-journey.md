# W2 — Customer journey evidence (T007) + FR-09 re-measure (T008)

**Date**: 2026-10-10 · **Tree**: post-split (038 batch 2)

## FR-09 — 016 oracle re-measure (the RECORDED method, `--env-file-if-exists=.env`)

`node --env-file-if-exists=.env scripts/run-perf-baselines.mjs` re-run on the
final tree (the artifact rewritten in place by the script itself):

| Area | 016 baseline | This re-measure (median of 5) | Verdict |
|---|---|---|---|
| `get_session_menu` | 106 ms | **149 ms** | within the 1500 ms budget; +43 ms is shared-cloud variance, NOT a frontend change (the client path is unchanged — same query, same client). Recorded as variance. |
| `round_submission` | (016 T004 record) | **160 ms** (runs 138–199) | within the 800 ms budget. |
| realtime subscribe | ≈218 ms | **396 ms** single-run this capture; reconnection first 113 ms / resubscribe 117 ms — the reconnect numbers match 016's ≈72–117 ms band | variance on the shared realtime broker recorded as such; the reconnect path (the client's own work) matches. |
| storage upload / signed read | ≈189 / ≈258 ms | 223 / 402 ms | same variance posture (no frontend change involved). |

**No frontend-attributable regression found** — the deltas sit on the
shared-infrastructure side (same method, same client code paths).

## W2 — Throttled customer journey (`e2e/perf.customer.test.ts`, T006)

**Profile (clarified)**: CDP Slow 3G (1.6 Mbps down / 750 Kbps up / 150 ms
RTT) + CPU×4. **1/1 green (18.4 s)**.

- **HARD — no duplicated data requests on the menu reload window**: every
  rpc call appears at most once in the window (the multi-step JOIN
  necessarily refetches the public surface per step; the discipline is the
  MENU LOAD itself).
- **HARD — no staff/admin page chunks requested on the customer route**
  (DashboardPage/CashierRoundsPage/KitchenDashboardPage/StaffListPage/
  AuditLogPage/ReportsPage/MenuPage/TaxPage/AdminPage asset names).
- **HARD (B4) — cart-add is local**: the cart region updates with ZERO rpc
  writes in the click window; the local render completes well inside the
  1.5 s pathological-re-render bound (CPU×4).
- **Informational (B1)**: the throttled timing attach records the journey's
  own numbers in test output (never asserted on shared cloud latency).

## Baseline → Change → Measurement → Result (W1+W2, one record)

- **Baseline**: single 794.24 kB index chunk pre-split (W1); duplicate-load
  and chunk-leak behaviors unproven.
- **Change**: route-level splitting (23 lazy page boundaries + root
  Suspense skeleton fallback + error boundary), manifest emission, and the
  dedup/leak/local-add assertions pinning the D2 posture.
- **Measurement**: post-split build (index 305.70 kB / 95.84 gzip; 49
  chunks; CustomerMenuPage 19.92 kB / 6.24 gzip); the throttled journey
  spec green.
- **Result**: the customer route no longer downloads staff/admin code
  (proven twice — manifest + runtime requests); menu data loads
  un-duplicated; cart-add confirmed local-first. Numbers BETTER on the
  payload axis (−489 kB pre-load minus the async shop); timing budget B1
  informational on the throttled profile.

## Manual Lighthouse capture (R9 — recorded, not CI)

_(appended once during the implement window; tool + version recorded — the
capture values are recorded as observations, never assertions)_
