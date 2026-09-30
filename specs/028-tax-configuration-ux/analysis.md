# Analysis: Tax Configuration UX (Phase 08) — post-implement

**Date**: 2026-09-30/10-01 · **Scope**: delivered surface vs spec/plan/checklist; suite health

## Requirements coverage (delivered)

| FR | Delivered | Proven by |
| --- | --- | --- |
| FR-01 rules list | dense rows (scope/target/rate/order, StatusPill Active/Retired, compound meta) | tax.surfaces 14/14 unedited; tax.management (1) |
| FR-02 editor + verbatim | grouped fieldsets, aria-describedby hints, error summary, structural limits-before-attempt (disabled submit) | tax.management (2) |
| FR-03 compound explain | 'calculated after <source>' on each compound row + 'Compounds on' fieldset legend | tax.management (1) |
| FR-04 ordering meaning + a11y | intro line stating what the order changes; per-context Move buttons (complete-list submit) | tax.management (1) |
| FR-05 precedence honesty | InheritanceBadge ('Inherited'/'Overridden') text-bearing; NEW clearing affordance on overridden rows | tax.management (3); pinned count-0 strings green |
| FR-06 preview bill | 'Calculation result' live region (section, polite), Calculating… busy, engine lines verbatim | tax.management (4); determinism pin green |
| FR-07 retire vs delete | distinct controls; per-server isUnreferenced (incoming refs only) | tax.management (1) delete path |
| FR-08 snapshot (D1) | SnapshotAction (owner-only, stable button label, once-only outcome stated); client mapping audited | tax.management (5); db guard updated |
| FR-09 states | all named surfaces preserved + busy; both routes | tax.surfaces (Marina empty) + new |
| FR-10 payload error | TaxPayloadError posture untouched | existing unit tests green |

## REAL defects found & fixed by this phase's E2E (convergence catches)

1. **Branch/restaurant reorder mixing** — the panel submitted the displayed (interleaved) list;
   the RPC validates ONE context ('The reorder list must contain every rule of the context
   exactly once.'). Fixed: the swap happens within the moved rule's context and submits only
   that context's ids. (Pre-existing bug — branch-adjacent moves never worked.)
2. **isUnreferenced overreach** — the client blocked delete on OUTGOING compound citations; the
   server only refuses INCOMING references ('the rule's own outgoing citations die with it').
   Fixed to mirror the RPC exactly.
3. **No clearing affordance on an overridden row** — controls rendered only while
   origin === 'restaurant', locking an override in place with no visible way back (the state
   matrix's 'clearing' arm had no surface). Fixed: overridden rows carry 'Use restaurant
   default' directly.
4. **Busy-through-refetch (027 D8 lesson applied)** — useTaxInvalidation now awaits the
   refetches; panels hold busy until the UI shows the saved state (race-proof controls).
5. **Cross-file T2 race surfaced by the new file's scheduling** — customer.menu's exact bill
   assertions raced reports.surfaces' rounds in the SAME T2 session (strict mode 'Subtotal
   ×N'). Fixed with the t2Lock cross-file mutex + scoping the 390px bill assertions to this
   round's TotalsPanel. Also hardened: bill.void's locked-card selection now excludes the
   seeded voided round (bare .first() could resolve it before our refetch).

## Spec-guard evolution (documented, owner-approved D1)

`tests/database/tax.rpc.test.ts`'s executable guard ('no surface records snapshots', spec 006
clarification 3) is superseded by spec 028 D1: the guard now asserts the INVERSE — exactly one
audited client path (`recordSnapshot`). The RPC's owner-only authorization remains the boundary
(the once-only and cross-tenant guards above it are untouched).

## Validation status

- npm run verify: EXIT 0 (unit 369+3 / db 516 / integration 38 / build).
- Full Playwright: chromium + mobile green; tablet project crashed transiently in the combined
  run (worker exit 0xC0000002, infrastructure) and passes 9/9 isolated → effective 174/174.
- tax.surfaces 14/14 UNEDITED; tax.client unit 28/28 UNCHANGED (mapping additive only).

**Verdict**: converged on artifacts; the checklist is fully checked; no open CRITICAL findings.
