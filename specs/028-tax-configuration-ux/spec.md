# Feature Specification: Tax Configuration UX (Frontend Phase 08)

**Feature Branch**: `028-tax-configuration-ux`

**Created**: 2026-09-30

**Status**: Draft — clarified (2026-09-30, decisions D1–D2)

**Input**: Frontend Master Plan §"Frontend Phase 08" — "Make a genuinely complex configuration understandable: tax rules with scopes (subtotal, item, category), compound relationships, ordering, branch overrides, and a preview that shows the resulting money — without the UI ever doing arithmetic that disagrees with the engine."

**Authorities**: RestoPilot-Frontend-Master-Plan.md §"Frontend Phase 08" (FR-01…FR-10); frozen contracts — the tax RPC set (`create_tax_rule`, `update_tax_rule`, `retire_tax_rule`, `delete_unused_tax_rule`, `reorder_tax_rules`, `set_branch_tax_override`, `get_branch_tax_config`, `calculate_branch_taxes` [deterministic: same basket → byte-identical totals], `record_tax_snapshot`), the payload validators (`parseTaxConfig`/`parseCalculation`, `TaxPayloadError`), `taxMoney` formatters; `e2e/tax.surfaces.test.ts` (~12 tests asserted — h1 'Tax'/'Marina tax'/'Downtown tax', 'Add a tax rule', denial h1s + zero 'Add a tax rule'/'Override' buttons for non-owners, other-restaurant isolation, the 'Add an item' basket select `Hummus — 6.50`, configured-order lines, deterministic resubmission, Marina's empty-preview state); `tests/unit/tax.client.test.ts` UNCHANGED; Constitution IV (RPC = boundary, rejected-not-hidden), V (the DB computes effective configuration — `get_branch_tax_config`; the preview renders the engine's output), VII (exact decimal strings end-to-end).

**Existing implementation (INSPECT, baseline `e851b22`)**: both journeys are complete and pinned — `TaxPage` (owner gate `canManageRestaurant`, multi-restaurant selector, target pickers fed by `useRestaurantMenu`) → `TaxRulesPanel` (ordered rules with scope badges/effective rates/active-retired state/compound-source labels, shared create-edit form with rate pattern pre-validation, complete-list reorder, retire-with-confirmation, delete only when unreferenced, verbatim server messages) and `BranchTaxPage` (view gate + exact canManage composition: restaurant owner OR branch_manager-here) → `BranchTaxPanel` (effective config read, per-rule override editor, branch-only rules, plain-text origin labels) + `TaxPreview` (basket rows, submit-once-per-press, engine's lines verbatim + subtotal/total, empty state). This phase is a RE-SKIN: ManagementLayout/SectionCard/ScopeBadge/StatusPill application, preview on the `TotalsPanel` shell, precedence badges (inherited/overridden) without color-only meaning, live-region announcement of preview results, mobile dual-posture, and the new explainability affordances — with every pinned assertion passing unedited.

## Clarifications (session 2026-09-30 — decisions D1–D4)

- **D1 — Snapshot surface: IN, owner-only on the restaurant tax page** (user decision; the Master Plan expected this question and FR-08 + the state matrix presume it). The `record_tax_snapshot` contract is owner-only (the migration's recording authority) and ONCE-ONLY per fingerprint (a conflicting re-record reports `recorded:false` — idempotent, not an error). Surface: one action on `/dashboard/tax` that records the CURRENT saved configuration of a chosen branch with the user-composed label; busy while recording; `recorded:true` → confirmation naming the branch; `recorded:false` → the once-only outcome stated (no error); refusals verbatim. Copy must state what a snapshot captures (the configuration as currently saved — not a preview) and that it is once-only per configuration fingerprint.
- **D2 — Basket presets: OUT** (user decision). The free-form builder + Calculate + empty-basket state cover SC-01; no preset baskets this phase.
- **D3 — Retired visibility**: retired rules remain LISTED with their '(retired)' state (existing pinned behavior; the preview excludes them as the engine does).
- **D4 — Terminology**: the existing frozen set (rule, scope, compound, override, retire) is kept — the E2E asserts it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — An owner configures a realistic tax setup and sees exactly what customers are charged (P1)

An owner of a restaurant with multiple rules (a subtotal VAT, an item-scoped levy, a category-scoped city tax, a compound levy calculated after the VAT) opens `/dashboard/tax`, reads the rules in their applied order, and uses the editor to add or change rules — the form groups name/rate/scope-target/compound fields with helper text tied by `aria-describedby`, an error summary, and the server's validation messages verbatim. On the branch tax page they build a sample basket and the preview renders the engine's lines — subtotal, each tax line (name, rate, scope) in the configured order, total — in the same bill shell customers see.

**Why this priority**: the complexity narrative IS the phase: rules, ordering, compounds, and a preview that proves the configuration without the UI ever recomputing it.

**Independent Test**: can be fully tested by configuring a multi-rule setup and verifying the preview's lines match `calculate_branch_taxes` byte-for-byte; delivers an understandable, trustworthy configuration surface.

**Acceptance Scenarios**:

1. **Given** a restaurant with the seeded rules, **When** the owner reads the rules list, **Then** each rule shows scope, target, rate, ordering, active/retired state, and any compound source ("calculated after" naming its source rule in plain language).
2. **Given** the editor open, **When** the owner submits a rate the RPC refuses, **Then** the server's message renders verbatim next to the field, the input is preserved, and an error summary lists the failure.
3. **Given** a sample basket, **When** the preview is submitted, **Then** the lines render in the engine's configured order with subtotal and total byte-identical across identical resubmissions, inside the shared bill shell.

---

### User Story 2 — A manager overrides their branch and immediately sees the difference (P1)

A branch manager opens their branch's tax page, sees the restaurant rules as **inherited** and any replacement rates as **overridden** (badges that do not rely on color alone), sets or clears a replacement rate through the override editor, and understands from the surface alone what changed and what the branch now charges.

**Why this priority**: the branch override is the highest-frequency write in service and the precedence honesty (inherited vs overridden) is the phase's UX requirement.

**Independent Test**: can be tested by setting a replacement rate and observing the inherited→overridden transition and the recalculated preview; delivers confident branch-level control.

**Acceptance Scenarios**:

1. **Given** a rule inherited from the restaurant, **When** the manager reads the branch configuration, **Then** it is badged inherited (text-bearing, not color-only) with the restaurant's rate.
2. **Given** the manager sets a replacement rate, **When** the override saves, **Then** the rule is badged overridden with the branch's rate, and the preview reflects the branch's effective configuration on its next server response.
3. **Given** an override cleared, **When** the read refreshes, **Then** the rule returns to inherited with the restaurant's rate.

---

### User Story 3 — Staff audit the configuration and trust the money (P2)

Any permitted staff member reading the configuration can tell which rules are retired, why the preview excludes them, what the ordering means (the order taxes apply in), and what destructive actions would do (retire explains; delete of an unused rule confirms; blast radius stated: existing sessions keep captured money). The preview announces its results in a live region and shows a busy state while calculating instead of guessing.

**Why this priority**: explainability and honest money make the configuration auditable — the phase's trust goal — but the journeys above carry the value.

**Independent Test**: can be tested by reading the surface as a permitted non-owner and verifying the retired/precedence/busy/live-region affordances; delivers an auditable surface.

**Acceptance Scenarios**:

1. **Given** a retired rule exists, **When** the configuration renders, **Then** the rule is listed with its retired state and the preview excludes it (the configured order shows only active rules).
2. **Given** a delete of an in-use rule is attempted, **When** the RPC refuses, **Then** the server's message renders verbatim and nothing disappears; deleting an unused rule requires its own confirmation naming the rule.
3. **Given** a preview submission, **When** the calculation is in flight, **Then** a busy state replaces the previous result and the result is announced in a live region on arrival.

---

### Edge Cases

- 20-extras ceiling equivalent does not exist here; instead the **rate bounds**: a malformed or out-of-bounds rate is pre-validated against the documented pattern (limits-before-attempt), while the RPC's own refusals surface verbatim.
- Compound source validation: selecting a source that the RPC refuses renders the server's message verbatim; the compound label always names the source rule.
- Image-less: no storage in this phase; no `image_path` analog.
- Malformed branch payload → `TaxPayloadError` → the payload-error state (FR-10), never a crash or a guessed line.
- Long rule lists: sticky section nav keeps the rules/editor/preview reachable; rows stay scannable.
- Empty restaurant menu (no categories/items): target pickers degrade to empty-with-explanation states.
- Empty rules: none / retired-only states each have a named surface.
- Unsaved-change protection: open-form editors with explicit Save (existing); forms keep input on refusal.
- Provider vs payload errors are distinct states (provider error = retry surface; payload error = explicit 'the payload could not be parsed' posture).

## Requirements

- **FR-01** Rules list with scope, target, rate, ordering, active/retired state (StatusPill), compound-source labels — ordered as the engine applies them (`(sort_order, name)`).
- **FR-02** Rule editor: grouped fields (name, rate, scope, targets, compound source) with helper text (`aria-describedby`), error summary, and the exact RPC validation messages verbatim; limits-before-attempt for the rate format.
- **FR-03** Compound configuration explains "calculated after" semantics in plain language next to the control and on each compound rule row.
- **FR-04** Ordering control with a clear statement of what the order changes ("the order taxes apply in") and keyboard-accessible move controls submitting the complete list (the menu precedent).
- **FR-05** Branch override surface distinguishing inherited vs overridden with text-bearing badges (no color-only meaning); override editor sets/clears replacement rates; the exact canManage composition preserved (owner-of-restaurant OR branch_manager-here).
- **FR-06** Preview panel: basket builder (item/quantity/extras) → server calculation → rendered lines with subtotal, each tax (name/rate/scope), and total — the engine's output verbatim, on the shared `TotalsPanel`-style bill shell; submit-once-per-press; busy state while in flight; live-region result announcement.
- **FR-07** Retirement vs deletion distinction: retire confirms and explains (reversible posture); delete is offered only for unreferenced rules with its own confirmation naming the rule; the server's refusal for an in-use delete renders verbatim.
- **FR-08** Snapshot action (D1): one owner-only action on the restaurant tax page recording the current saved configuration of a chosen branch with a user-composed label; busy while recording; recorded → confirmation naming the branch; once-only per fingerprint → the re-record outcome stated without an error; refusals verbatim; the copy states what a snapshot captures (the configuration as currently saved — not a preview) and the once-only guarantee.
- **FR-09** Empty/loading/error states for both pages (rules none/list/retired-only; preview idle/calculating/result/empty-basket; provider error; payload error).
- **FR-10** Malformed payload handling surfaced as an error state, never a crash (`TaxPayloadError` posture preserved).

### UX Requirements

- Precedence visible at a glance: inherited/overridden badges text-bearing.
- The preview updates only after a server response; a busy state replaces guessing.
- Money formatting consistent with the product (exact decimal strings end-to-end; `MoneyText`-consistent formatters).
- Destructive actions explain blast radius (existing sessions keep captured money).
- Long rule lists stay scannable; terminology matches the frozen set: rule, scope, compound, override, retire.

### Visual Requirements

- Form-heavy layout with grouped fields, explanatory helper text, override badges, a preview panel that reads like a bill (the `TotalsPanel` shell shared with customer/cashier views), and status pills for active/retired. Tokens and primitives only (design-literals gate).

### Responsive Requirements

- Desktop: rules list + editor + preview simultaneously; tablet: two columns; mobile: read rules and preview, edit simple fields; the editor's multi-select target pickers and compound multi-select are the deliberately-not-editable-on-mobile set (same-DOM boundary note pattern from phase 07).

### Accessibility

- Numeric inputs labelled with units and bounds (Rate (%) with the documented pattern hint via `aria-describedby`).
- Grouped fieldsets for scope/target selection.
- Error summary; preview results announced in a live region on refresh; keyboard-accessible ordering; no color-only meaning for inherited/overridden.

### State Matrix

- Rules: none / list / retired-only / create busy / validation refusal / delete blocked (in use) / delete confirm.
- Compounds: none / configured / invalid source refusal.
- Overrides: none / inherited / overridden / clearing.
- Preview: idle / calculating / result / empty basket / provider error / payload error.
- Snapshot: idle / recording / recorded / already-recorded (the once-only outcome).

### Security

- Owner-only rule writes and manager-scoped overrides enforced by RPC and presented only to permitted roles; deep links render the denial state (h1 'Not authorized' preserved); no tax internals beyond what the RPCs return.

### Components

- `TaxRulesTable` (dense rows, StatusPill active/retired, scope badges, compound labels), `TaxRuleEditor` (grouped form), `ScopeSelector`, `CompoundEditor`, `OrderControls`, `OverridePanel` (branch), `InheritanceBadge`, `TaxPreviewPanel` (basket + result), `RetireDialog` (existing confirm posture), `SnapshotAction` (owner-only, D1), `MoneyText`/`TotalsPanel` reuse. New `tax.surfaces.module.css` on 022 tokens only.

### Routes

- `/dashboard/tax`, `/dashboard/branches/:branchId/tax` — paths unchanged.

### Testing Strategy

- Unit: existing `tax.client` mapping + parser tests UNCHANGED; formatter reuse (`taxMoney`).
- E2E: all `e2e/tax.surfaces.test.ts` assertions preserved (owner editor, branch override page, manager scoped controls, cashier read-only view, non-owner denials, totals preview rendering the deterministic calculation); new: compound explanation, override badges, preview busy state, 390px mobile boundary, axe on both routes.
- Database suites untouched.

### Backend impact

NOT_REQUIRED — the tax RPC set, both parsers, and the money formatters are consumed as-is. No migration, no policy change, no new reads. (Contrast with phase 07, which carried the replica-identity fix: nothing equivalent surfaced here; the preview determinism pin already guards the engine.)

## Success Criteria

- **SC-01** An owner configures a realistic multi-rule setup (subtotal + item/category + compound) and the preview matches `calculate_branch_taxes` byte-for-byte — no UI arithmetic anywhere.
- **SC-02** A manager overrides their branch and can see the difference (inherited vs overridden badges + the preview reflecting the branch's effective config).
- **SC-03** Every existing `tax.surfaces` assertion passes UNEDITED after the re-skin.
- **SC-04** The full Playwright run, `npm run verify`, and `impeccable detect src` are green; axe floor holds on both tax routes.

## Clarification Log

- Q3 retired-visibility and Q4 terminology: resolved by evidence (pinned behavior), 2026-09-30 (D3/D4).
- Q1 snapshot surface: IN as the owner-only `SnapshotAction` on the restaurant tax page (user decision D1, 2026-09-30).
- Q2 basket presets: OUT — the free-form builder is the only basket path (user decision D2, 2026-09-30).
