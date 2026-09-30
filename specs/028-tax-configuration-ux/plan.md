# Implementation Plan: Tax Configuration UX (Phase 08)

**Spec**: `specs/028-tax-configuration-ux/spec.md` (clarified D1–D4) · Work lands on `main`.

## Routes

The two paths unchanged: `/dashboard/tax`, `/dashboard/branches/:branchId/tax`. In-page section
structure via SectionCards under ManagementLayout:
- `TaxPage` → section nav 'Tax sections' with `#rules` (the re-skinned TaxRulesPanel), `#add-rule`
  (the create form, keeping its frozen 'Add a tax rule' button semantics), `#snapshot` (the
  owner-only SnapshotAction, D1). h1 'Tax' + intro line + the multi-restaurant selector
  (frozen ids/labels) preserved byte-for-byte.
- `BranchTaxPage` → h1 '{branch} tax' (frozen: 'Marina tax'/'Downtown tax') + section nav
  'Branch tax sections' with `#effective` (the effective configuration read), `#overrides` (the
  OverridePanel within canManage), `#preview` (TaxPreview re-hosted). The denial/read-only
  postures preserved exactly.

## Architecture

- **No new shared layer** — phase 026's `src/components/management/` family (ManagementLayout,
  SectionCard, ScopeBadge, StatusPill) + 022 primitives (Button, Field, Input, Checkbox,
  Feedback, EmptyState/ErrorState) + 05 money components (`MoneyText`, `TotalsPanel`) consumed
  as-is.
- **New module css** `src/features/tax/tax.surfaces.module.css` — rule-row density, badge/pill
  treatments, editor grouping, mobile dual-posture — 022 tokens ONLY (design-literals gate;
  comments included, the 027 F5 lesson).
- **Page composition (re-skins; all behavior preserved):**
  - `TaxRulesPanel` → `TaxRulesTable`-style dense rows: name, scope badge, target names, rate
    (`formatRate`), StatusPill Active/Retired ('(retired)' text preserved inside the pill row —
    the pinned `getByText` matches stay green), compound label naming its source rule with the
    'calculated after' plain-language phrase (FR-03), Move controls (keyboard-accessible,
    complete-list submit — existing mechanics, FR-04), Retire/Delete with the existing confirm
    posture and blast-radius copy (FR-07).
  - `RuleFields` (shared create/edit form) → grouped fieldsets: identity (Name), rate (Rate (%)
    with `RATE_HINT` via `aria-describedby`, `aria-invalid` posture preserved), scope/target
    (fieldset + checkboxes — the `ScopeSelector` grouping), compound source (multi-select
    fieldset with the invalid-source refusal surfaced verbatim). Error summary block (FR-02)
    listing the current validation failures above the form; server messages remain next to the
    control that produced them.
  - `BranchTaxPanel` → precedence at a glance: each effective rule row carries an
    `InheritanceBadge` — 'Inherited' (restaurant rate) vs 'Overridden' (branch rate) —
    text-bearing, no color-only meaning (FR-05); branch-only rules keep their distinct marker
    ('branch-only' text preserved); the override editor (replacement rate) re-skinned on
    primitives with clearing support.
  - `TaxPreview` → re-hosted on the `TotalsPanel` bill shell (FR-06): the basket builder keeps
    the frozen 'Add an item' select (`Hummus — 6.50` labels), the engine's lines render in the
    configured order with subtotal/total through the money components; CALCULATING busy state
    replaces the previous result while in flight (never guessing); the result region becomes a
    live region announcing the refreshed total (a11y requirement); empty-basket state preserved;
    payload/provider errors distinct (FR-10).
  - **New `SnapshotAction`** (D1, owner-only, restaurant tax page): branch selector (the
    owner's branches), user-composed label, Record button; busy while recording;
    `recorded:true` → 'Snapshot recorded for {branch}.'; `recorded:false` → the once-only
    outcome stated without an error; the explanatory copy states what a snapshot captures (the
    branch's tax configuration as currently SAVED — not a preview) and the once-only-per-
    fingerprint guarantee. Refusals verbatim (owner-only RPC).
- **Data layer (the ONLY additive change):** `taxClient.ts` gains `recordSnapshot(restaurantId,
  branchId, fingerprint, payload)` mapping `record_tax_snapshot` (returns `{recorded,
  snapshot_id}`), parsed defensively like its siblings; `useTax.ts` gains the mutation +
  invalidation wiring via the existing `useTaxInvalidation`. NO existing client/parser/money
  code changes; the 477-line unit suite stays UNCHANGED (a few ADDITIVE mapping tests may join
  it only if the suite's existing structure allows — default: no new unit file, E2E covers).

## Backend contracts used

**NOT_REQUIRED (database)** — the full tax RPC set, `get_branch_tax_config`,
`calculate_branch_taxes`, `record_tax_snapshot` (owner-only, once-only per fingerprint —
migration `20260919122120_tax_reads.sql` verified), and both parsers exist and are consumed
as-is. The only code addition is the thin client mapping for the snapshot RPC (above).

## Responsive

≥1024: rules + editor + preview sections side-by-side per the Master Plan (rules list + editor
on the restaurant page; effective + overrides + preview on the branch page).
<1024: section nav collapses to the horizontal scroller (026 pattern); two columns.
<768: read rules + preview; simple field edits stay; the multi-select target/compound pickers
are the deliberately-NOT-editable set — same-DOM boundary note ('…on a tablet or desktop.')
matching the phase-07 pattern (`@media` rules only, no JS branch). Ordering buttons and badges
stay reachable at 390px.

## Accessibility

Numeric rate input labelled with unit and bounds ('Rate (%)' + hint via `aria-describedby` —
existing label preserved); scope/target/compound as grouped fieldsets with legends; error
summary; preview results announced via the live region; keyboard-accessible ordering (buttons);
inherited/overridden badges text-bearing (never color-only); section navs use distinct names
('Tax sections'/'Branch tax sections' — never 'Staff area'); the axe WCAG 2.2 AA floor runs on
both routes (session-gated, owner-signed-in; Marina as the branch variant).

## Loading / empty / error states

Rules: 'Loading the tax configuration…' preserved; provider error `role="alert"` preserved;
none / retired-only named states. Editor: create busy / validation refusal (verbatim +
preserved input). Delete: blocked-in-use refusal verbatim / confirm naming the rule. Overrides:
none / inherited / overridden / clearing. Preview: idle / calculating (busy) / result /
empty-basket ('This branch has no offered items yet…' preserved) / provider error / payload
error (TaxPayloadError posture). Snapshot: idle / recording / recorded / already-recorded.

## Testing strategy

- **Unit:** `tests/unit/tax.client.test.ts` (477 ln) UNCHANGED and green; `taxMoney` formatters
  reused (no new unit files by default).
- **E2E preserved:** all `e2e/tax.surfaces.test.ts` assertions UNEDITED (~12 tests: owner nav +
  seeded order, role denials ×5, isolation, Marina/Downtown reads, bob controls + Marina
  rejection, carla read-only, preview order + determinism + empty state).
- **E2E new:** `e2e/tax.management.test.ts` (serial, one worker):
  1. owner configures a realistic setup on the scratch design: create item-scoped rule +
     compound rule ('calculated after' visible), reorder via Move controls, retire + delete
     paths (legal cleanup: scratch rules retired; delete only where unreferenced);
  2. validation refusal verbatim (malformed rate) with preserved input + error summary;
  3. manager override: bob sets a replacement rate on a seeded rule → InheritanceBadge flips
     inherited→overridden, preview reflects it on next submission; clearing returns inherited
     (restore the seeded state after — fixture-safe ordering);
  4. preview busy → result on the TotalsPanel shell + live region announces the total;
  5. snapshot: alice records a branch config → confirmation naming the branch; re-record →
     once-only outcome without an error (scratch-branch fingerprint safe; label names the run);
  6. 390px boundary: pickers hidden with the note; rules + preview readable;
  7. axe on `/dashboard/tax` (alice) and `/dashboard/branches/{downtown}/tax` (alice).
  Scratch design mirrors phase 07: names carry a per-run suffix (`E2E Scratch Rule <runid>`),
  never colliding with frozen anchors; cleanup is legal-only.
- **Gates:** `npm run db:reset -- --yes` before verify AND before the full Playwright run
  (027 F6); `npm run verify`; full `test:e2e`; `npx impeccable detect src` → 0.

## Design strategy

022 tokens only; the configuration surface reads as a bill-adjacent admin view — denser than
marketing, calmer than the kitchen. StatusPill tones: Active positive / Retired neutral;
InheritanceBadge: 'Overridden' warning-tinted text chip, 'Inherited' neutral (text-bearing).
Impeccable: `detect` at the gate; `shape`/`critique` focus = the rule editor (the hardest form
in the product per the Master Plan); `clarify`-style vocabulary pass over helper copy during
implement; `polish` last. The rule-row pattern is tax-specific (scope+target+rate columns) — no
promotion/extract candidate this phase (recorded decision).

## Migration notes (ledger)

Expected §Phase 028 additions in `docs/frontend-presentation-contracts.md`: tax section
navs/SectionCards, dense rule rows with StatusPill active/retired, compound 'calculated after'
labels, InheritanceBadge inherited/overridden, preview on the TotalsPanel shell + busy/live
region, SnapshotAction (D1), mobile picker boundary. NO frozen anchor moves anticipated; any
deviation recorded with its reason.

## Risks

- The frozen `getByText('Downtown surcharge')`/`'(branch override)'` count-0 pins mean badge
  text must not accidentally contain those strings on the wrong side — badge vocabulary chosen
  to avoid them ('Overridden'/'Inherited').
- Preview determinism pin + TotalsPanel re-host must not reorder or reword the engine's lines.
- The snapshot RPC is owner-only: the E2E uses alice only (bob's denial posture is already
  pinned by the page-level denials; no new pin invented).
