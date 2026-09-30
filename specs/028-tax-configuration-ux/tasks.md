# Tasks: Tax Configuration UX (Phase 08)

**Spec**: `specs/028-tax-configuration-ux/spec.md` (clarified D1–D4) · **Plan**: `plan.md` · **Checklist**: `checklists/tax-fidelity.md`

| ID | Task | Spec | Done |
| --- | --- | --- | --- |
| T001 | `tax.surfaces.module.css`: rule-row density, InheritanceBadge/StatusPill treatments, editor fieldset grouping, preview bill styling, <768px dual-posture (pickers hidden + boundary note) — 022 tokens only | Visual, Responsive | [X] |
| T002 | `TaxPage` re-skin: ManagementLayout 'Tax sections' + SectionCards #rules/#add-rule/#snapshot (D1); h1 'Tax', intro, restaurant selector byte-preserved; loading/error/denial states preserved | FR-01, UX | [X] |
| T003 | `TaxRulesPanel` re-skin: dense rule rows (scope badge, targets, rate, StatusPill Active/Retired, compound 'calculated after' label naming its source), Move controls stating what order changes, Retire/Delete distinction with blast-radius copy; frozen button names intact | FR-01/03/04/07 | [X] |
| T004 | Rule form re-skin: grouped fieldsets (identity/rate/scope-target/compound), `aria-describedby` hints, error summary, verbatim refusals next to fields, input preserved, rate limits-before-attempt | FR-02, A11y | [X] |
| T005 | `SnapshotAction` (D1): owner-only section — branch select, label input, Record; busy/recorded/already-recorded states; copy states what a snapshot captures + once-only; refusals verbatim | FR-08, D1 | [X] |
| T006 | Data layer addition: `taxClient.recordSnapshot` mapping `record_tax_snapshot` (defensive parse of `{recorded, snapshot_id}`) + `useTax` mutation with existing invalidation; NOTHING else in the client changes | FR-08 | [X] |
| T007 | `BranchTaxPage` re-skin: section nav 'Branch tax sections' + SectionCards #effective/#overrides/#preview; h1 '{branch} tax' frozen; denial/read-only postures preserved | FR-05, UX | [X] |
| T008 | `BranchTaxPanel` re-skin: InheritanceBadge ('Inherited'/'Overridden', text-bearing) per effective rule row, branch-only marker preserved, override editor (set/clear) on primitives with busy states | FR-05 | [X] |
| T009 | `TaxPreview` re-skin on the `TotalsPanel` bill shell: frozen 'Add an item' basket select, engine lines verbatim in order, CALCULATING busy state, live-region result announcement, empty-basket/payload/provider states distinct | FR-06/09/10 | [X] |
| T010 | New E2E `e2e/tax.management.test.ts` (serial): owner scratch-config journey (compound + reorder + retire + legal cleanup), rate-refusal verbatim, manager override cycle with badge flip + seeded restore, preview busy→result, snapshot record + once-only, 390px boundary, axe on both routes | Gates | [X] |
| T011 | Validation: db:reset → `npm run verify` → full Playwright → `impeccable detect src` 0; convergence fixes; check off `tax-fidelity.md` items | Gates | [X] |
| T012 | Ledger §Phase 028 + evidence screenshots; checkpoint `feat(028)` + push; phase reports + state DONE | CHECKPOINT/REPORT | [ ] |

## Dependencies

T001 → T002–T009 (styles first). T006 before T005 (the action needs the client mapping).
T002/T003/T004 are the restaurant page cluster; T007/T008/T009 the branch cluster (independent
of each other). T010 needs T005+T006+T008+T009. T011/T012 last.

## MVP

T001–T004 + T010(1,2) alone satisfy User Story 1 (P1) end-to-end.

## Phase N: Convergence

Round 1 (2026-10-01): the post-implement full-suite sweep found and closed — the branch/restaurant
reorder-mixing refusal (real pre-existing bug, fixed to per-context submission), the
isUnreferenced overreach (outgoing citations no longer block delete — server parity), the
missing clearing affordance on overridden rows (new 'Use restaurant default' control), the
busy-through-refetch hardening (awaited invalidation), the cross-file T2 mutex + scoped bill
assertions (customer.menu/reports.surfaces), and the bill.void locked-card selection excluding
the seeded voided round. The spec-006 snapshot guard was superseded by D1 (inverse assertion).
Validation: verify EXIT 0; tax.management 7/7; tax.surfaces 14/14 unedited; tax.client 28/28
unchanged; full Playwright green per project (tablet transient worker crash passed 9/9
isolated); impeccable 0; prettier clean; design-literals green. Checklist tax-fidelity 100%.
Remaining: T012 (ledger + evidence + checkpoint + reports + state). **CONVERGED.**
