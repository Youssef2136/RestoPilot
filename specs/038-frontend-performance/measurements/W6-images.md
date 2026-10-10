# W6 — Images evidence (T014) — measure-then-decide

**Date**: 2026-10-10 · **Tree**: post-split

## Baseline (measured, R6)

- **The customer tree ships ZERO `<img>` elements on the guest path today**:
  the order surface deliberately renders no images (the images feature's
  designed absence Q4 — ItemCard's image slot renders metadata-only cards).
  Verified by a grep sweep over `src/features/order/**`,
  `src/routes/CustomerMenuPage.tsx`, `src/routes/OrderPage.tsx`.
- **The staff side** resolves signed reads when the OWNER uploads an item
  image (`ItemImageField` via `getSignedImageUrl`); the management menu
  structure panel is the only rendering surface with an `<img>` today.
- 016 recorded the transport layer: upload ≈189 ms / signed read ≈258 ms
  (s.maLL object); this re-measure: 223 / 402 ms (shared-cloud variance,
  recorded in W2's FR-09 table).

## Change

**NONE** — the measurement does not demand one:
- The guest path has no image payload at all (the strongest possible
  image-strategy posture); inventing images for it would ADD weight, not
  save it.
- The staff editor's image usage is owner-facing, single-item-at-a-time
  (one `<img>` at a time on a form), where lazy loading and aspect boxes
  buy nothing measurable and the 02 aspect-box token classes already
  constrain layout in the editor.

## Measurement

The grep sweep + the zero-image runtime behavior (the e2e customer suites
exercise the menu/cart paths and never reference an image element; 
`menu.surfaces`/`customer.menu` green across the 037 sweep).

## Result (recorded)

**No SmartImage helper adopted this phase.** The FR-03 strategy for the
CURRENT product shape is satisfied by the designed zero-image guest path
+ the editor's constrained use; the helper is a FUTURE gesture only when
the product renders images at guest scale (this file is the baseline that
would justify it). The image state matrix rows (placeholder/loading/
loaded/failed) transfer to any future helper via the 037 vocabulary.
Budget B8: zero image payload on the guest path (measured); no invented
cap.
