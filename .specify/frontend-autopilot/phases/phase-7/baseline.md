# Phase 07 — Baseline (INSPECT)

- Date: 2026-09-30 · Baseline commit: `8b3a0eb` (feat(026), pushed to origin/main) · Branch `main`, tree clean (by-design untracked: `.agents/`, `.freebuff/`, `.zcode/`, `.specify/frontend-autopilot/`, `RestoPilot-Frontend-Master-Plan.md`, `DESIGN.md`).
- Feature dir: `specs/027-menu-management-ux` (per Master Plan §Frontend Phase 07, lines 1391–1445). Mode: Operate. Depends on Phase 06 (management layout + data-table/editor patterns) and Phase 02 primitives.

## Master Plan phase-7 contract (condensed)
- **Purpose**: menu maintenance fast & safe — categories, items, prices, images, structured extras, ordering, per-branch availability incl. realtime toggles mid-service.
- **Scope**: `/dashboard/menu` (structure editing, item editor, availability controls, image flow) + `/dashboard/branches/:branchId/menu` (branch-facing read-only menu with its availability controls); empty/loading/error states; first storage-backed image field UX.
- **Out of scope**: price policy, availability rules (two layers unchanged), RPC validation, image path grammar, Storage policy, catalog import/export.
- **Contracts**: full menu RPC set + `get_branch_menu`, private `menu-images` bucket (5 MiB JPEG/PNG/WebP), `branch_unavailable_items` realtime table.
- **Key FRs**: FR-01 categories CRUD+reorder w/ consequence messaging; FR-02 item list w/ search/filter, price, availability, thumbnail; FR-03 item editor (validation, extras ≤20, image upload/replace); FR-04/05 two availability layers with blast-radius clarity; FR-06 branch preview mirroring customer payload; FR-07 keyboard-accessible reorder; FR-08 verbatim refusals; FR-09 realtime availability without manual refresh.
- **Responsive**: desktop list+editor side-by-side; tablet drawer; mobile read + toggles + simple edits, heavy editing (image upload) deferred — documented boundary.
- **Exit criteria**: owner builds category/item w/ extras+image end-to-end; manager toggles branch availability → customer-visible branch menu changes without refresh; every existing menu E2E assertion preserved or migrated with recorded reason; unit/db green.
- **Gates**: `npm run verify`; `npm run test:e2e` (menu.surfaces + realtime availability spec); axe/responsive; impeccable.

## Frontend state at baseline
- Routes: `src/routes/MenuPage.tsx`, `src/routes/BranchMenuPage.tsx` (to re-skin; paths unchanged).
- Feature: `src/features/menu/` — `menuClient.ts` (497 ln), `menuImages.ts` (289 ln: uploadMenuImage/getSignedImageUrl/resetSignedUrlCacheForTests; path grammar `restaurant/<rid>/item/<iid>/<uuid>.<ext>`), `money.ts`, `useMenu.ts`, `components/` (MenuStructurePanel, MenuItemEditor, ExtrasEditor, ItemImageField, AvailabilityControls, BranchMenuPreview).
- Unit tests pinned: `tests/unit/menu.client.test.ts` (52 tests) — must stay green UNCHANGED.
- E2E: `e2e/menu.surfaces.test.ts` (13 frozen tests: owner nav, h1 'Menu', role denials, branch view hides unoffered items w/ staff explanation, branch-override still-offered-elsewhere, manager availability controls, extras seeded, cross-restaurant isolation). Helpers: entryLock/marinaT1Lock/fionaLock, dev-alice-2026 etc.
- Phase-06 layout language available for reuse: `src/components/management/{ManagementLayout,SectionCard,ScopeBadge,StatusPill,BranchHeader}.tsx` + `management.module.css`.
- Money primitives: `src/components/money/{MoneyText,TotalsPanel}` (phase 5).
- Seed fixtures: categories 6001–6004 (+6101 Cedar), items 6011–6022 (Sea Bass 6015 `is_available=false`), extras; `menu_items.image_path` exists but seed sets none.

## Prior-phase lessons applied
- verify = format:check + lint + typecheck + unit 369 + db 516 + integration 38 + build; db gate fails on E2E residue → `npm run db:reset -- --yes` before verify after E2E runs.
- Playwright 161 tests, 3 chromium projects; full run ~9.6 min `--reporter=line`; dev server on 5173 must be running (restart after Freebuff restarts).
- Frozen-contract discipline: never edit pinned assertions; fix presentation. One `role="status"` per customer page; `role="note"` for notices.
- Design gate: `tests/unit/design.literals.test.ts` — colors only via tokens; `npx impeccable detect src` exit 0.
- Evidence scripts under `scripts/e2e/` are run then DELETED; Prettier on all new/edited files before verify.
- write_file needs {path, instructions, content}; multi-line `node -e` unreliable.
