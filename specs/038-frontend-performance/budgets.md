# Budgets — FR-08 ledger (specs/038)

**Discipline (clarified)**: every TIMING budget is informational/recorded
(never a hard CI assertion over the shared cloud DB); the only HARD
assertions are deterministic build-output facts (chunk-class membership) and
client-side-deterministic interaction facts (Performance API marks, DOM
identity). Every budget names its 016 justification and its measured result.

| ID | Budget | Threshold | Kind | Justification (baseline context) | Measured result |
|---|---|---|---|---|---|
| B1 | `menu_loading` (guest menu interactive on the throttled profile) | 1500 ms (016 budget) | informational + profile-named | 016 `menu_loading_ms: 1500` (§26 customer-path priority); 016 median `get_session_menu` 106 ms unbottlenecked | **PASS (informational)** — the 016-method re-measure 149 ms; the throttled journey green (W2) |
| B2 | `round_submission` (network part) | 800 ms (016 budget) | informational | 016 `round_submission_ms: 800` | **PASS** — 160 ms median re-measure (W2/FR-09) |
| B3 | Route chunk class membership | customer pages contain NO staff/admin module ids and vice versa | **hard** (build manifest) | R1: today one 794 kB chunk downloads everything on every route — the deterministic fix is the split boundary itself | **PASS (hard)** — bundleSplit.test.ts 4/4 on dist manifest; runtime leak probe also green (W2) |
| B4 | Cart-add interaction | in-page Performance mark: local state visible ≤ one animation frame after the click, NO network request on the add path | hard (client-deterministic) | the cart's local-first design (integer-clamped client state), per plan §Existing contracts | **PASS (hard)** — zero writes in the click window; local render inside the 1.5 s pathological bound (W2) |
| B5 | Board burst render scoping | no list-wide re-render per arrival (row scoping), stable row DOM identity across a refresh | hard (unit/DOM identity) | US2's stuter-by-remount risk; the 032 one-live-region policy unaffected | **PASS (hard)** — key/precondition unit 3/3 + stamped-node identity survives a real arrival (W3) |
| B6 | Realtime handshake re-measure | ≈218 ms subscribe / ≈72 ms reconnect (016 medians) | informational | 016 baselines.json realtime_fanout | recorded — subscribe 396 ms (broker variance), reconnect 113/117 ms in-band (W2 FR-09 table); no frontend-attributable regression |
| B7 | Reports/audit trail interaction (long-trail) | re-probe threshold ≈3.5 s cloud-inclusive (3× the recorded sub-second baseline) | informational | the W4 probe set its own basis: sub-second opens recorded | **PASS (baseline)** — audit 1121 ms / reports 1147 ms recorded; virtualization NOT adopted (W4) |
| B8 | Image payload | none invented (clarified: measure first) | informational | the guest tree renders zero `<img>` today (R6) | **PASS (baseline)** — zero guest-path image payload measured; staff editor constrained (W6) |
