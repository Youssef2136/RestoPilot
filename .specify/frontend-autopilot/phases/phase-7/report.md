# Phase 07 Report — Menu Management UX

**Status: DONE · CONVERGED (3 validation rounds) · 2026-09-30**
**Spec:** `specs/027-menu-management-ux` · **Baseline:** `8b3a0eb` (phase 06) · **Checkpoint:** `e851b22` (pushed to origin/main)

## Objective

Turn the menu maintenance surfaces into a fast, safe management experience — categories, items,
prices, images, structured extras, ordering, and per-branch availability with realtime
mid-service toggles — without moving any frozen menu anchor.

## Requirements → implementation → validation

| Requirement | Implementation | Validation |
| --- | --- | --- |
| FR-01 categories CRUD + reorder + delete consequence | SectionCards #structure/#add-category; move buttons (D1); non-empty refusal verbatim | menu.management (delete-refusal), full-journey unedited |
| FR-02 item list w/ filter, price, availability, thumbnail | dense rows: ItemThumb (signed URL / 'No image', alt=""), price, pills (Available/Stopped, 'N branch overrides', extras preview); MenuFilter + per-category 'No items match your filter.' | menu.management (FR-02), menu.surfaces pins |
| FR-03 item editor (validation, extras ≤20, image flow) | section-wrapped editor (D5) on Field/Input primitives; limits-before-attempt (D4); upload/remove via menu-images storage | menu.management owner journey end-to-end |
| FR-04/05 two availability layers + blast radius | toggle copy preserved; restaurant-wide warning line; branch override pills | menu.surfaces + menu.management realtime |
| FR-06 branch preview mirrors customers | BranchMenuPreview in a SectionCard; 'Customer view' toggle frozen | menu.surfaces 13/13 unedited |
| FR-07 keyboard-accessible reorder | Move up/down buttons submitting the full list (D1) | pinned names unedited |
| FR-08 verbatim refusals | server messages surfaced as-is; forms keep input on failure | delete-refusal + duplicate-name tests |
| FR-09 realtime without manual refresh | dual-key invalidation (`invalidateMenuForRealtime` clears the `['menu']` root) + REPLICA IDENTITY FULL schema fix (D7/F1) | menu.management exit criterion 6/6 |
| Responsive (Q3) | <768px card fallback; upload affordance → boundary note, same DOM | menu.management 390px test |
| States (FR-08/matrix) | empty category / filtered-empty / empty menu / 'Nothing is offered at this branch yet.' / loading / denial / retry — all named surfaces, byte-preserved where pinned | full run + frozen pins |

## Files changed (checkpoint e851b22 — 27 files, +1735/−245)

**New:** `menu.surfaces.module.css`, `MenuFilter.tsx`, `useItemImage.ts`,
`e2e/menu.management.test.ts` (+helpers/fixture-image.png), `specs/027-menu-management-ux/*`
(spec/plan/checklist/tasks/evidence ×5), `supabase/migrations/20260930090000_menu_override_replica_identity.sql`.
**Modified:** `MenuPage.tsx`, `BranchMenuPage.tsx`, `MenuStructurePanel.tsx`,
`MenuItemEditor.tsx`, `ExtrasEditor.tsx`, `ItemImageField.tsx`, `useMenu.ts`,
`order.surfaces.module.css` (contrast fix), `management.surfaces.test.ts` + `shell.test.ts`
(Fiona-lock hardening), `docs/frontend-presentation-contracts.md` (§Phase 027), `.specify/feature.json`.

## Backend changes

One surgical migration (D7): REPLICA IDENTITY FULL on `branch_unavailable_items` so DELETE
(restore) payloads carry `branch_id` and reach the branch-scoped realtime subscribers. No RPC,
policy, grant, or seed changes. The frontend RPC set was consumed as-is.

## Validation results

- `npm run verify`: **EXIT 0** (format:check, lint, typecheck, unit 369, db 516, integration 38, build).
- Full Playwright: **167/167** (chromium + mobile + tablet; 9.3 min).
- `npx impeccable detect src`: **0 findings**.
- menu.surfaces frozen 13/13 **unedited**; menu.client 52 **unchanged**; full-journey **unedited**.

## Warnings / notes

- The realtime restore bug (F1) predates this phase and was invisible until the exit-criterion
  E2E exercised the restore leg live; any future DELETE-event subscription on a surrogate-key
  table needs the same identity check.
- Full-suite procedure stands: `db:reset` before verify AND before the full Playwright run
  (serial customer journeys accumulate open sessions; F6).

## State

`state.json` → DONE, checkpoint `e851b22`, next phase 8.
