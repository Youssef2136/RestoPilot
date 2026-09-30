# Feature Checklist: Menu Management UX (Phase 07)

Focus: **frozen menu anchors preserved**, **two-layer availability honesty**, and **storage
safety**, per the Master Plan's testing/security directives.

## Frozen anchors (re-skin discipline)

- [ ] All 13 menu.surfaces tests pass WITHOUT assertion edits (h1 'Menu', 'Not authorized',
  'Add a category' h3, seeded order, descriptions/prices, region names 'Mains'/'Starters'/'Grill',
  '(stopped restaurant-wide)'/'(unavailable at this branch)' reasons, 'Customer view
  (hide what customers will not see)' label, 'Edit Hummus', 'Extras for Hummus', extra text
  lines, branch h1s 'Marina menu'/'Downtown menu').
- [ ] full-journey's menu hop passes unedited ('Category name', 'Item name', 'Price', 'Add
  category', 'Add item', region-by-heading lookup).
- [ ] menu.client (52 unit) + menu.images (integration) suites pass UNCHANGED — client layer
  untouched.

## Two-layer availability honesty

- [ ] Restaurant-wide toggle carries the verbatim blast-radius statement (every branch; no
  override reverses it).
- [ ] Branch toggle shows the no-effect note when the item is stopped restaurant-wide (verbatim).
- [ ] Effective state is text-bearing (pill text + reasons), never color-only.
- [ ] The branch page's customer-visible projection comes only from `get_branch_menu` — nothing
  client-derived (Constitution V).
- [ ] Realtime: a branch availability toggle updates the customer-visible branch view WITHOUT
  manual refresh (E2E-proven exit criterion).

## Storage safety (first image-surface phase)

- [ ] Limits shown BEFORE the attempt (type set + 5 MB copy, frozen).
- [ ] Rejections name the bound (type or size) — client pre-check messages frozen.
- [ ] Only signed URLs render — a stale path shows the placeholder/empty state, never a broken
  `<img>`.
- [ ] Object paths never constructed outside `menuImages.ts`; cleanup via Storage API only.
- [ ] Upload → record → delete-old ordering untouched (integration suite green).

## UX / a11y / responsive

- [ ] Reorder is keyboard-operable buttons (no drag-only); complete-list submission preserved.
- [ ] Search/filter with per-category filtered-empty messaging; read-only concern.
- [ ] Non-empty category delete refusal renders verbatim with nothing lost.
- [ ] Section navs keyboard-operable with distinct labels; fragments work.
- [ ] Forms preserve input on refusal; busy states on every write; extras ceiling refusal
  verbatim.
- [ ] <768px: card-fallback rows (same DOM); upload affordance hidden WITH its documented
  boundary note (Q3); toggles + simple edits reachable.
- [ ] `th scope` table semantics wherever tables render; image alt="" decorative.

## Discipline

- [ ] Backend impact stays NOT_REQUIRED; menu client/data layer untouched (unit suites green
  UNCHANGED).
- [ ] New E2E self-cleans by the legal-operation design (extras retired, image removed, item
  stopped; scratch names outside all pins).
- [ ] Prettier on every new/edited file before verify; `impeccable detect src` → 0.
- [ ] db:reset before verify claims (E2E-residue lesson).
