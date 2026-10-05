# Phase 08 Validation — specs/028-tax-configuration-ux

**Date: 2026-10-01 · Baseline `e851b22` → Checkpoint `1c832f2` (pushed to origin/main)**

## Targeted validation (during IMPLEMENT)

| Check | Result |
| --- | --- |
| `e2e/tax.management.test.ts` (new, serial, chromium) | **7/7 PASS** |
| `e2e/tax.surfaces.test.ts` (14 frozen anchors) | **14/14 PASS — UNEDITED** |
| `tests/unit/tax.client.test.ts` (28) + design.literals | PASSED — UNCHANGED (mapping additive only) |
| Prettier + tsc on all new/edited files | CLEAN |

## Final validation (T011 — after `npm run db:reset -- --yes`)

| Gate | Result |
| --- | --- |
| `npm run verify` (format:check → lint → typecheck → unit 369 → db 516 → integration 38 → build) | **EXIT 0 — ALL GREEN** |
| `npx playwright test` (full, 3 projects) | chromium + mobile **green**; tablet crashed transiently in the combined run (worker exit 0xC0000002 — infrastructure) and passed **9/9 isolated** → effective **174/174** |
| `npx impeccable detect src` | **0 findings (exit 0)** |
| Convergence regressions | 1 full-suite round: the bill.void locked-card selection hardened (F6); T2 race closed (F5) — re-run green per project |

## Convergence notes

- One formal convergence round (documented in tasks.md §Convergence): five REAL fixes riding
  the phase (reorder contexts, delete parity, clearing affordance, busy-through-refetch,
  T2 mutex + 390px scoping) + the D1 guard supersession. tax-fidelity checklist 100% checked.
- Frozen-anchor discipline held: tax.surfaces 14/14 unedited; tax.client 28 unedited; customer
  cart/session anchors untouched (the T2 work is helper/locator-level).

## Evidence

- `specs/028-tax-configuration-ux/evidence/`: tax-rules.png, tax-rule-editor.png,
  branch-tax-preview.png, tax-390-boundary.png.
- Ledger entry: `docs/frontend-presentation-contracts.md` §Phase 028 (before/after table +
  new contracts + the real-defect fixes).
