# Phase 07 Validation — specs/027-menu-management-ux

**Date: 2026-09-30 · Baseline `8b3a0eb` → Checkpoint `e851b22` (pushed to origin/main)**

## Targeted validation (during IMPLEMENT)

| Check | Result |
| --- | --- |
| `e2e/menu.management.test.ts` (new, serial, chromium) | **6/6 PASS** |
| `e2e/menu.surfaces.test.ts` (13 frozen anchors) | **13/13 PASS — UNEDITED** (re-verified twice after the re-skin) |
| `tests/unit/menu.client.test.ts` (52) + design.literals | PASSED — UNCHANGED |
| Prettier + tsc on all new/edited files | CLEAN |

## Final validation (T010 — after `npm run db:reset -- --yes`)

| Gate | Result |
| --- | --- |
| `npm run verify` (format:check → lint → typecheck → unit 369 → db 516 → integration 38 → build) | **EXIT 0 — ALL GREEN** |
| `npx playwright test --reporter=line` (full, 3 projects) | **167/167 PASS (9.3 min)** |
| `npx impeccable detect src` | **0 findings (exit 0)** |
| Convergence regressions found by the full run | 2 found → both fixed at the root (see findings F2–F4) → re-run green |

## Convergence notes

- Convergence round effectively 2: the first full run exposed the strict-mode label collision
  (F3) and the Fiona fixture race (F2); the second exposed the empty-category contrast failure
  (F4) plus the design-literal comment catch (F5). All resolved; third full run 167/167.
- Frozen-anchor discipline held: menu.surfaces 13/13 unedited, full-journey unedited (after the
  section-label rename on OUR side), menu.client 52 unedited.

## Evidence

- `specs/027-menu-management-ux/evidence/`: menu-structure.png, item-editor.png,
  branch-menu.png (Marina), branch-menu-downtown.png, mobile-editor-390.png.
- Ledger entry: `docs/frontend-presentation-contracts.md` §Phase 027 (before/after table +
  new contracts + the replica-identity schema note).
