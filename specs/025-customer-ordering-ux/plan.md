# Implementation Plan: Customer Menu, Cart, Rounds & Order Status UX (Phase 05)

**Spec**: `specs/025-customer-ordering-ux/spec.md` (clarified) · Work lands on `main` per repo convention.

## Routes

- `/r/:slug/menu` → `CustomerMenuPage` (exists; re-composed this phase). No new routes; no registry churn beyond description polish if needed.

## Architecture & components (new files under `src/features/order/components/` unless noted)

- **Menu composition** (replaces the current single-column CartPanel-first layout):
  - `CategoryNav.tsx` — sticky horizontal category bar (Q2); tap → in-page scroll to the section; per-category counts; a category with zero offered items renders visibly empty/disabled.
  - `ItemCard.tsx` — item row: name, advisory price (`MoneyText`), description, availability state (unavailable = visibly unavailable, not hidden), image slot (designed absence placeholder Q4).
  - `ItemDetailSheet.tsx` — opens from an available item: description, `ExtrasFieldset`, `QuantityInput`, add-to-cart (merge via `cartState`; result announced; focus returns). Never navigates away.
  - `ExtrasFieldset.tsx`, `QuantityInput.tsx` — leaf primitives (real checkboxes; labelled spinbutton, 1–99 clamp with feedback).
  - `CartSheet.tsx` — sticky bottom bar with the live line count → bottom sheet on mobile / side panel on desktop (Q1); renders `CartLine`s + `TotalsPanel` + `SubmitBar`; the `region` named `Cart` is preserved as the assertion scope.
  - `CartLine.tsx` — adjust (spinbutton) / remove via existing cartState actions.
  - `TotalsPanel.tsx` + `MoneyText.tsx` (`src/components/money/`) — THE money presentation pair: `MoneyText` is the single amount renderer; `TotalsPanel` lays out captured subtotal/tax/total rows and a clearly advisory cart row. One component, two semantic modes (advisory vs captured), never recomputing server money.
  - `CutoffNotice.tsx` — cutoff presented as a state before submit attempts (FR-08); preserved-cart-above-cutoff rule intact.
  - `RefreshAffordance.tsx` — "Updated Xs ago" + manual refresh button (Q3) above the history.
  - `RoundCard.tsx` (customer variant) — state chip via `ROUND_STATE_LABEL`, items with extras, captured money via `TotalsPanel`; `RoundsHistory` keeps its newest-first contract.
  - `SessionIndicator` re-skinned as the session bar (FR-07 semantics preserved).
- `CustomerMenuPage` composes: SessionIndicator → h1 branch name → CategoryNav → menu sections (+ItemDetailSheet host) → CartSheet → RoundsHistory(+RefreshAffordance) → CutoffNotice (channel-scoped).

## State & data flow

- No new RPCs and no client changes to `sessionClient`/`orderClient`/`cartState` (frozen; unit tests must stay green UNCHANGED). `useSessionMenu`/`useSessionRounds`/submit wiring as today; the 10 s poll cadence untouched; realtime still NOT subscribed for customers.
- Cutoff derivation stays from the session/menu payload; presented before submit (CutoffNotice), not just as a submit-time surprise.
- FR-11 empty states at every level: no categories / empty category / empty cart / no rounds.

## Backend contracts used

**NOT_REQUIRED** (evidence: baseline.md — `get_session_menu`, `get_session_rounds`, `submit_round`, session context, `image_path` column all exist; seed has no images).

## Responsive behavior

390 px target: single column under tablet; sticky category bar; bottom sheet <1024 px, side panel ≥1024 px; the whole journey completable at 320–430 px with no horizontal scrolling (responsive smoke extended to the menu route).

## Accessibility

Preserved asserted roles: `region` Cart; `status` submit region; `alert` refusals; spinbutton quantity; fieldset/checkbox extras; live announcement on add-to-cart; `alt` from item name; focus management on sheet open/close and after add/remove; contrast on price/availability text.

## Loading / empty / error states

Menu skeleton / partial category / error with retry / session refusal → entry (frozen); history loading/empty/stale/refresh-failure; cart empty; cutoff closed — exactly the state matrix.

## Testing strategy

- **Unit:** new `MoneyText`/totals-mapping tests (captured money only, advisory labeled); state-label mapping for the customer vocabulary. `order.cart.test.ts` untouched and green.
- **E2E preserved:** every `session.surfaces.test.ts` cart/submission/history pin re-anchored only where markup moves (recorded); the Cart region stays.
- **E2E new:** `e2e/customer.menu.test.ts` — category nav + counts, item detail extras/quantity, add feedback without navigation, empty states, cutoff state before submit, freshness/refresh affordance; mobile-viewport full journey (390); axe on `/r/blue-olive/menu` (a11y baseline extension); expected refusals named per F-G14.
- Shared join helper extracted to `e2e/helpers/` if reused (joinT3 pattern; existing entryLock discipline applies).

## Design strategy

022 tokens only; the restaurant's taste (branch h1, its content); money hierarchy with advisory explicitly labeled; designed-absence imagery. Impeccable: `detect` after build + manual critique of the 390 flow; `harden`-style pass on cutoff/stale states; polish last.

## Migration notes (ledger)

- Any moved assertion anchor (markup changes in CartPanel/RoundsHistory/CustomerMenuPage) is recorded in `docs/frontend-presentation-contracts.md` §Phase 025; the Cart region must NOT move.
- No new `data-testid` unless unavoidable (Category C discipline).

## Milestones → tasks

- M1 MoneyText/TotalsPanel + category nav + item list (T001–T003)
- M2 detail/add flow + CartSheet + submit/refusal UX (T004–T006)
- M3 history freshness + cutoff state + empty states (T007–T009)
- M4 new E2E + a11y + mobile journey + ledger (T010–T012)
- M5 verify + full E2E + impeccable + convergence (T013)
