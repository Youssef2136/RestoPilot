# Tasks: Customer Menu, Cart, Rounds & Order Status UX (Phase 05)

**Spec**: `specs/025-customer-ordering-ux/spec.md` · **Plan**: `plan.md` · **Checklist**: `checklists/money-fidelity.md`

| ID | Task | Spec | Done |
| --- | --- | --- | --- |
| T001 | Money primitives: `MoneyText` + `TotalsPanel` (`src/components/money/`) with unit tests (captured money only; advisory labeled; customer vocabulary mapping) | FR-06, Visual | [x] |
| T002 | Menu composition: `CategoryNav` (sticky horizontal bar, counts, tap-scroll) + item sections + `ItemCard` (price/description/availability/designed-absence image slot) + empty/partial/error states | FR-01, FR-02, FR-11 | [x] |
| T003 | Item detail/add flow: `ItemDetailSheet` + `ExtrasFieldset` + `QuantityInput` (spinbutton, 1–99 clamp), merge-on-add via cartState, announced feedback, focus return; no navigation away | FR-03, A11y | [x] |
| T004 | `CartSheet`: sticky bar with live line count → bottom sheet (mobile) / side panel (desktop); `CartLine` adjust/remove; `region` named `Cart` preserved; advisory `TotalsPanel` row | FR-04 | [x] |
| T005 | Submit UX: `SubmitBar` busy/disabled states, success `status` region naming the round/ticket, cart clears, no layout jump; verbatim refusal in `alert` region with cart preserved | FR-05, Checklist | [x] |
| T006 | Rounds history re-skin: `RoundCard` customer variant (state chips via `ROUND_STATE_LABEL`, items+extras, captured money via TotalsPanel), newest-first preserved | FR-06 | [x] |
| T007 | Freshness affordance: `RefreshAffordance` ("Updated Xs ago" + manual refresh) on the history; poll cadence untouched | FR-09 | [x] |
| T008 | `CutoffNotice`: cutoff as a pre-submit state (delivery/takeaway scoped); preserved-cart-above-cutoff rule intact | FR-08 | [x] |
| T009 | Session bar re-skin of `SessionIndicator` (channel/table/address echo preserved) + recovery rule untouched (FR-10 regression-checked) | FR-07, FR-10 | [x] |
| T010 | New E2E `e2e/customer.menu.test.ts`: category nav+counts, detail extras/quantity, add feedback, empty states, cutoff state, freshness/refresh; expected refusals named (F-G14) | Gates, FR-01/03/08/09/11 | [x] |
| T011 | Mobile journey + a11y: 390px full-journey E2E completion; axe on `/r/blue-olive/menu` added to the a11y baseline; responsive smoke extended | Exit criteria | [x] |
| T012 | Evidence screenshots (390 menu flow, cart sheet, detail sheet, history) + ledger update (`docs/frontend-presentation-contracts.md` §Phase 025) | FINISH | [x] |
| T013 | Validation: `npm run verify` + full `test:e2e` green; `impeccable detect src` 0; convergence fixes | Gates | [x] |
| T014 | Checkpoint `feat(025)` + push (auto-push rule); report + state DONE | CHECKPOINT/REPORT | [x] |
