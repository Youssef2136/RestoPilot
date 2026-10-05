# Phase 05 Baseline (specs/025-customer-ordering-ux) — 2026-09-29

**Git:** `main` @ `9a41734` (phase 04 checkpoint, pushed). Working tree clean of tracked changes; untracked-by-design dirs untouched.

**Baseline validation (from phase-04 final):** unit 362/362 · db 516/516 · integration 38/38 · e2e 150/150 · build 743.05 kB (gzip 204.10 kB) · impeccable detect src: 0 · axe baseline 4 routes.

## What exists today (customer ordering surfaces)

- **Route:** `/r/:slug/menu` → `src/routes/CustomerMenuPage.tsx` (recovery rule implemented: no-token → entry; `SESSION_UNAVAILABLE_MESSAGE` refusal → `forgetSession` + entry). Renders `SessionIndicator` → h1 `menu.branch.name` → `CartPanel` → `RoundsHistory`, all in one `<section>`. Route registry entry exists (`Menu` title).
- **Cart:** `src/features/order/` — `cartState.ts` (160 ln; storage under `restopilot.cart`, token-scoped; merge-on-add for same item+extras pair; 1–99 clamp; subscribers; malformed-payload-safe) with unit coverage in `tests/unit/order.cart.test.ts` (save/load round-trip, token scoping, merge rule, bounds feedback, subscriptions, clear paths, malformed). `CartPanel.tsx` (235 ln) + `SubmitControl.tsx` (50 ln) + `useOrder.ts` (submit wiring). `RoundsHistory.tsx` (94 ln).
- **Contracts consumed:** `get_session_menu` (branch menu payload: categories/items/extras/availability/is_offered), `get_session_rounds` (captured prices + tax lines, newest-first), `submit_round` (all-or-nothing, verbatim refusals), session context/indicator reads. Realtime NOT subscribed for customers — 10 s poll is the contract.
- **Seeded data:** Blue Olive Downtown `T3` open session; menu with extras (unit fixtures + db seed carry `item_extras`); `menu_items.image_path` exists in schema (`20260917072202_menu_schema.sql`, path-structured check constraint) but the seed sets **no images** — designed absence is the real state.
- **E2E floor:** `e2e/session.surfaces.test.ts` carries the full existing cart/submission/history assertions (region `Cart`, advisory totals '21.50'/'34.50'/'56.00'/'43.00', adjust/remove, reload persistence, no cart on entry, submit clears + names ticket, poisoned-cart refusal preserves cart verbatim, two rounds, cutoff refusal above preserved cart). a11y baseline has 4 routes (no menu route yet).

## Master Plan authorities for this phase

RestoPilot-Frontend-Master-Plan.md §"Frontend Phase 05 — Customer Menu, Cart, Rounds & Order Status UX" (lines ~1209–1330): purpose/scope/out-of-scope/deps/FR-01…FR-11/UX/visual/responsive/a11y/state matrix/security/components/`MoneyText`+`TotalsPanel` single money component/routes (menu route only)/testing/impeccable workflow/expected clarify questions/exit criteria/validation gates/`feat(025)`.

## Phase-04 assets this phase builds on

`CustomerShellHeader`, `entry.module.css`, the frozen entry labels, the two-shell architecture, toasts/ConfirmDialog/offline banner (023), the token system (022).

## Risks carried into the phase

- The money-fidelity bar (captured money only, one canonical component) meets an existing cart whose advisory totals are client-computed — the phase must keep the advisory/cart math clearly advisory and route ALL captured money through the one component.
- The 150-test E2E floor includes strict cart pins; presentation changes must be re-anchoring, not weakening.
- Cross-file E2E coordination (entryLock etc.) is load-bearing; new specs must not introduce new shared-fixture hazards.
