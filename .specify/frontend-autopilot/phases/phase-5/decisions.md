# Phase 05 Decisions (specs/025-customer-ordering-ux)

## D1 — Same-DOM dual-posture cart (Q1) instead of two shells
The clarified "sheet on mobile / panel on desktop" is ONE DOM: `<section aria-label="Cart">` in a
sticky `max-height:45dvh` bottom-docked container <1024px, and a sticky side-panel column ≥1024px —
pure CSS module media queries. No modal, no portal, no unmount: every frozen pin (region name,
line texts, buttons) is live in BOTH postures, and E2E needs no viewport gymnastics. The
"bottom sheet" is a presentation posture of the region, not a separate overlay component.

## D2 — Ordered-field ItemCard is also the detail surface (T003 shape change, recorded)
The plan's `ItemDetailSheet` was replaced by the ordered-field `ItemCard` (name → price →
description → extras → quantity → Add to cart). Rationale: the frozen E2E contract scopes by
`li` hasText 'Item' and reaches `getByLabel('Extra rice')` + `spinbutton` INSIDE that li —
a sheet that moved the controls out of the li would have required migrating four+ pinned
assertions for zero user gain (the ordered card already removes extras/quantity from the
menu's scannability path). The Master Plan's component list named ItemDetailSheet; the plan
amendment is recorded here and in the ledger. ItemCard remains extractable into a sheet later
without contract change (it is one component).

## D3 — CartPanel replaced, CartRegion added; DeleteGuard was explicit
`CartPanel` (menu+cart monolith) was deleted after its two responsibilities were split:
menu composition → MenuSections/ItemCard/CategoryNav (CustomerMenuPage), cart → CartRegion.
Its advisory-total math, stale-extra degradation, and 1–99 clamp moved VERBATIM into CartRegion
(the pinned totals and poisoned-cart behavior depend on them). `order.cart.test.ts` untouched
and green — the state layer was never touched.

## D4 — Menu route axe lives in customer.menu (session-gated), not the a11y baseline
`/r/blue-olive/menu` requires a session token; the signed-out baseline sweep cannot reach it.
The axe floor runs in-session in customer.menu with the same committed-baseline helper. The
baseline file was NOT extended (nothing signed-out to scan); recorded here against the task's
"a11y baseline extension" wording.

## D5 — customer.menu joins T2, not the pinned T3
The new serial suite joins Downtown T2: zero interaction with the T3 fixtures session.surfaces
and full-journey own, no new mutex needed (T2 has no other consumer; sessions on T2 are
idempotent joins). Serial-in-one-worker like its siblings; phone numbers +1555910001x distinct
per test.

## D6 — verify re-proven on a clean reset (D7 of phase 04, applied twice)
Mid-phase db failures were residue, not regressions; the gate claim stands on reset → verify.
Cost accepted; recorded in findings F5.

## D7 — Money component pair placement
`MoneyText`/`TotalsPanel` live in `src/components/money/` (cross-feature shared shell, as the
Master Plan's "shared money/state components" framing implies) while `formatPrice` stays in
`features/menu/money.ts` — the rendering component composes the existing exact formatter; no
money logic moved.
