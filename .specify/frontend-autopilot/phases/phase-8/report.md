# Phase 08 Report — Tax Configuration UX

**Status: DONE · CONVERGED (1 convergence round) · 2026-10-01**
**Spec:** `specs/028-tax-configuration-ux` · **Baseline:** `e851b22` (phase 07) · **Checkpoint:** `1c832f2` (pushed to origin/main)

## Objective

Make the genuinely complex tax configuration understandable — rules with scopes, compound
relationships, ordering, branch overrides, and a preview that shows the resulting money —
without the UI ever doing arithmetic that disagrees with the engine.

## Requirements → implementation → validation

| Requirement | Implementation | Validation |
| --- | --- | --- |
| FR-01 rules list | dense rows (scope/target/rate/order, Active/Retired pills, compound meta) | tax.surfaces 14/14 unedited |
| FR-02 editor + verbatim refusals | grouped fieldsets, aria-describedby, error summary, structural rate gate | tax.management (2) |
| FR-03 compound explain | 'calculated after <source>' rows + 'Compounds on' fieldset | tax.management (1) |
| FR-04 ordering meaning | intro line + keyboard Move controls (per-context, D4) | tax.management (1) |
| FR-05 inherited vs overridden | InheritanceBadge + the NEW clearing control (D3) | tax.management (3) |
| FR-06 preview bill | live region + Calculating… busy; engine lines verbatim | tax.management (4) + determinism pin |
| FR-07 retire vs delete | distinct postures; server-parity delete gating (D5) | tax.management cleanup path |
| FR-08 snapshot (D1) | SnapshotAction + audited client mapping; guard superseded | tax.management (5); db 53/53 |
| FR-09 states | all named surfaces, both routes | tax.surfaces + new suite |
| FR-10 payload error | TaxPayloadError posture preserved | existing unit tests |

## Files changed (checkpoint 1c832f2 — 27 files)

**New:** `tax.surfaces.module.css`, `SnapshotAction.tsx`, `e2e/tax.management.test.ts`,
`e2e/helpers/t2Lock.ts`, `specs/028-tax-configuration-ux/*` (spec/plan/tasks/analysis/
checklists ×2/evidence ×4).
**Modified:** `TaxPage.tsx`, `BranchTaxPage.tsx`, `TaxRulesPanel.tsx`, `BranchTaxPanel.tsx`,
`TaxPreview.tsx`, `taxClient.ts` (+recordSnapshot), `useTax.ts` (+useRecordTaxSnapshot, awaited
invalidation), `customer.menu.test.ts`, `reports.surfaces.test.ts`, `bill.void.audit.test.ts`,
`tests/database/tax.rpc.test.ts` (guard superseded by D1), `docs/frontend-presentation-contracts.md`, `.specify/feature.json`.

## Backend changes

NONE — the tax RPC set, parsers, and formatters consumed as-is; no migration, no policy
change. The only additive code is the thin `recordSnapshot` client mapping (owner-only RPC).

## Validation results

- `npm run verify`: **EXIT 0**.
- Playwright: tax.management 7/7; tax.surfaces 14/14 unedited; chromium + mobile green; tablet
  9/9 isolated (transient worker crash in the combined run — F7); effective **174/174**.
- `npx impeccable detect src`: **0 findings**. Prettier clean. design-literals green.

## Warnings / notes

- Three REAL pre-existing defects were caught and fixed by this phase's E2E (reorder mixing,
  delete over-restriction, missing clearing affordance) — the exit criteria did their job.
- The T2 cross-file race (F5) is closed structurally (t2Lock + scoped assertions); full-suite
  runs should still start from `db:reset` (the standing procedure).
- The tablet worker crash (F7) is environment noise — if it recurs, run
  `--project=tablet-chromium` in isolation as the recorded remedy.

## State

`state.json` → DONE, checkpoint `1c832f2`, next phase 9.
