# Feature Checklist: Customer Menu, Cart, Rounds & Order Status UX (Phase 05)

Focus: **money fidelity** (captured, never recomputed; advisory clearly advisory) and **preserved verbatim refusals** — per the Master Plan's checklist directive; plus the frozen E2E contracts.

## Money fidelity (the phase's first checklist focus)

- [ ] All captured money (rounds history, bill-like totals) renders through `MoneyText`/`TotalsPanel` — one component, zero client recomputation of server amounts.
- [ ] The cart's advisory total is labeled as advisory and can never be confused with captured money (visual + semantic distinction).
- [ ] Tax lines come from `get_session_rounds` payloads verbatim; no client-side tax math is displayed.
- [ ] No optimistic price math is presented as truth anywhere in the flow.

## Verbatim refusals & guards (the second checklist focus)

- [ ] `submit_round` refusals render the server message verbatim in an `alert` region where the action happened; the cart is untouched on refusal (poisoned-cart pin preserved).
- [ ] Empty-cart and double-submit guards keep their client behavior (submit disabled/busy; server is the backstop).
- [ ] Cutoff refusal above the preserved cart keeps its existing E2E pin; the cutoff is additionally presented as a state before submit attempts.
- [ ] Session recovery refusal (closed/tampered) keeps the frozen return-to-entry rule.

## Frozen contracts & E2E floor

- [ ] The `region` named `Cart` stays (name and role); any moved anchor is re-anchored with a recorded reason in the ledger.
- [ ] `status` submit region and `spinbutton` quantity roles preserved; extras remain a labelled fieldset with real checkboxes.
- [ ] `restopilot.cart` storage contract untouched (key, token scoping, merge/bounds rules; `tests/unit/order.cart.test.ts` green WITHOUT modification).
- [ ] `ROUND_STATE_LABEL` customer vocabulary exact on every state chip.
- [ ] Every existing cart/submission/history assertion in `e2e/session.surfaces.test.ts` passes or migrated with a recorded reason.

## UX / a11y / responsive

- [ ] One-hand reachability at 390 px: sticky cart affordance with live line count; primary actions in the bottom third.
- [ ] No layout jump on submit; add-to-cart feedback immediate, never navigating away, announced.
- [ ] Category bar is the horizontal scroller on mobile; item grid single column under tablet; completable at 320–430 px with no horizontal scrolling.
- [ ] Designed-absence imagery looks intentional; `alt` from item name when present.
- [ ] Focus returns to a sensible place after add/remove and after sheet open/close.
- [ ] Empty states for no categories / empty category / empty cart / no rounds (FR-11), each with a next step.

## Discipline

- [ ] Backend impact stays NOT_REQUIRED (no RPC/schema/RLS change).
- [ ] Impeccable detect clean at the gate; visual review of the 390 flow.
- [ ] New E2E names expected refusals per F-G14 (poisoned cart, cutoff, closed session).
