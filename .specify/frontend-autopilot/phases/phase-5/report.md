# Phase 05 Report — Customer Menu, Cart, Rounds & Order Status UX

**Status: DONE · CONVERGED (2 convergence rounds) · 2026-09-29**
**Spec:** `specs/025-customer-ordering-ux` · **Baseline:** `9a41734` (phase 024)

## Objective

Rebuild the customer's core revenue path — menu browsing, cart with structured extras, round
submission, order status — as a mobile-first (390px) experience on the 022 token system, without
moving any frozen cart/submission/history contract.

## Requirements → implementation → validation

| Requirement | Implementation | Validation |
| --- | --- | --- |
| FR-01 category navigation | `CategoryNav` sticky horizontal bar, offered-counts, tap-scroll | customer.menu (counts incl. Mains (2), scroll) |
| FR-02 item list + visible unavailability | `ItemCard` ordered fields; unavailable = struck price + reason + dashed card (never hidden) | customer.menu; menu.surfaces green |
| FR-03 detail/add flow | extras fieldset + spinbutton (1–99 clamp) in the ordered card; merge-on-add via untouched `cartState`; announced feedback, no navigation | session.surfaces US1; customer.menu |
| FR-04 cart | `CartRegion` — `region` Cart preserved; same-DOM side panel (≥1024) / bottom sheet (<1024); adjust/remove; advisory `TotalsPanel` row | session.surfaces (all pins pass unedited) |
| FR-05 submit UX | `SubmitBar` busy/disabled; success `status` names the ticket; verbatim `alert` refusal, cart preserved | session.surfaces poisoned-cart + submit tests |
| FR-06 rounds history | `RoundCard` customer variant; state chips via extracted `roundStateLabels`; captured money ONLY via `TotalsPanel`/`MoneyText` | session.surfaces history tests; unit pins |
| FR-07/FR-10 session + recovery | `SessionIndicator` unchanged (echo preserved); recovery rule untouched | session.surfaces green (regression) |
| FR-08 cutoff state | `CutoffNotice` pre-submit (`role="note"`); refusal pin intact | session.surfaces cutoff test |
| FR-09 freshness | "Updated Xs ago" ticker + manual refresh, `data-stale` while fetching | customer.menu (tick + reset) |
| FR-11 empty states | no categories / empty category / empty cart / no rounds | customer.menu |
| FR-12 no customer cancel | no affordance built; recorded refusal | spec Q5 |
| A11y/responsive | 390px full journey no-h-scroll; axe session-gated menu scan; spinbutton/fieldset/announcement | customer.menu; axe green after contrast fix |

## Files changed

**New:** `src/components/money/{MoneyText,TotalsPanel}.tsx` + css, `src/features/order/roundStateLabels.ts`, `src/features/order/components/{ItemCard,CategoryNav,MenuSections,CartRegion,SubmitBar,CutoffNotice,order.surfaces.module.css}`, `src/routes/CustomerMenuPage.module.css`, `e2e/customer.menu.test.ts`, `tests/unit/money.display.test.tsx`, evidence ×4 PNGs.
**Modified:** `CustomerMenuPage.tsx`, `RoundsHistory.tsx`, `docs/frontend-presentation-contracts.md`, spec artifacts.
**Removed:** `src/features/order/components/CartPanel.tsx` (responsibilities split — D3).

## Backend contracts used

NOT_REQUIRED — `get_session_menu`, `get_session_rounds`, `submit_round`, session context consumed
as-is; `orderClient`/`sessionClient`/`cartState` untouched (unit 369 incl. the unchanged cart suite).

## Design / Impeccable

`impeccable detect src`: **0 anti-patterns**. Visual evidence: `specs/025-customer-ordering-ux/evidence/`
(390px categories / cart sheet / history + desktop side panel). Design decisions: Q1 sheet/panel
same-DOM, Q2 sticky bar, Q3 refresh+ago, Q4 designed-absence imagery (seed has no images), Q5 no
cancel affordance.

## Validation results

`npm run verify` **PASS** (prettier, eslint, tsc, **unit 369/369**, **db 516/516** on clean reset,
**integration 38/38**, build 749.82 kB / gzip 206.33 kB) + `npm run test:e2e` **156/156 — 0 failed**
(9.3 min) + impeccable 0. `session.surfaces` 18/18 and `full-journey` 3/3 passed on the re-skinned
surfaces WITHOUT assertion edits — the frozen-contract bar held.

## Fixes & convergence

2 rounds. R1: role/name collisions with frozen pins (aside→section F1, bare +/− F2, one-status F3)
— discovered by the pinned suites themselves, fixed, 21/21. R2: axe color-contrast on the
unavailable card (opacity → border/surface treatment, F4) + exact-match 'Total' pin in the new
suite — 6/6. Incident: verify db gate needed a clean reset after heavy E2E (F5).

## Git checkpoint

`feat(025)` on `main` (baseline `9a41734`), pushed to origin per the standing auto-push rule.
Untracked-by-design leftovers unchanged (`.agents/`, `.freebuff/`, `.zcode/`, `.specify/frontend-autopilot/`, Master Plan, `DESIGN.md`).

## Remaining warnings

- R2 (carried): Impeccable launcher detect-only.
- The cart `+`/`−` accessible names are pinned bare glyphs — an a11y trade-off in the ledger;
  migration requires a same-commit session.surfaces update (findings F2/ledger row).
- Verify's db gate requires a fresh reset after heavy E2E (residue is bidirectional — F5).

## Traceability

Spec FR-01…FR-12 → files above → customer.menu (new) + session.surfaces/full-journey (frozen pins,
unedited) + money.display unit pins; presentation migrations recorded in
`docs/frontend-presentation-contracts.md` §"Phase 025 presentation record".
