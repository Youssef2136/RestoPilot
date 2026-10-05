# Phase 05 Findings (specs/025-customer-ordering-ux)

## F1 — aside vs section: the role contract is element-shaped (HIGH → fixed)
The cart re-skin used `<aside aria-label="Cart">`; HTML maps aside → role `complementary`, and the
frozen `getByRole('region', { name: 'Cart' })` went dark. The predecessor's `<section>` maps to
`region` when named. Fix: keep the element, not just the attribute. Lesson: a frozen role pin
constrains the ELEMENT choice, not only the aria-label.

## F2 — accessible-name pins are exact, not supplementary (MEDIUM → fixed)
Adding `aria-label="Increase … quantity"` to the `+` button changed its accessible name and broke
`getByRole('button', { name: '+' })` — an a11y nicety that contradicts a frozen pin. The pin wins:
reverted to the bare glyphs (the +/− controls remain adjacent to their line, which is their
context). Recorded in the ledger so nobody re-adds the labels without migrating the pin.

## F3 — one page, one `role="status"` (HIGH → fixed)
`CutoffNotice` launched with `role="status"`; `getByRole('status')` (the submit-success pin) then
hit strict-mode two-element violations. The page-level invariant "exactly one status region — the
submit result" is now explicit: the notice uses `role="note"`. Same class of lesson as 023's
toast-host `region` decision (accompany, never collide with asserted roles).

## F4 — axe color-contrast vs opacity (MEDIUM → fixed)
The unavailable-item card used `opacity: 0.6` for the muted posture; axe (serious,
color-contrast) flagged all its text. Fix: full opacity + dashed border + flat surface token —
the visible-unavailability rule survives WITHOUT dropping contrast. The session-gated menu-route
axe scan (new in customer.menu) is the guard that caught it.

## F5 — verify/E2E residue is bidirectional (MEDIUM, operator note)
Phase 04 recorded "run verify before full E2E or reset first"; this phase proved the mirror case —
AFTER heavy E2E, the db gate fails on residue (this phase's own test rounds moved best-sellers
determinism; full-journey tenants linger). The reset → verify → E2E order is the only safe cycle
for a gate claim.

## Carried warnings
- R2: Impeccable launcher remains detect-only (from 022).
- The cart +/- glyphs' accessible names are pinned bare ('+', '−') — a deliberate a11y trade-off
  recorded in the ledger; migrating them requires a same-commit session.surfaces update.
