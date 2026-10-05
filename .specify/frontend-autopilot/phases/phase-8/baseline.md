# Phase 08 — Baseline (INSPECT)

- Date: 2026-09-30 · Baseline commit: `e851b22` (feat(027), pushed to origin/main) · Branch `main`, tree clean (by-design untracked: `.agents/`, `.freebuff/`, `.zcode/`, `.specify/frontend-autopilot/`, `RestoPilot-Frontend-Master-Plan.md`, `DESIGN.md`).
- Feature dir: `specs/028-tax-configuration-ux` (per Master Plan §Frontend Phase 08, lines 1477–1560). Mode: Operate. Depends on Phase 07 (editor patterns, branch context), Phase 03 (branch context), Phase 02 (form primitives).

## Master Plan phase-8 contract (condensed)
- **Purpose**: make a genuinely complex configuration understandable — tax rules with scopes (subtotal/item/category), compound relationships, ordering, branch overrides, and a preview that shows the resulting money — without the UI ever doing arithmetic that disagrees with the engine.
- **Scope**: `/dashboard/tax` (rules list, rule editor, ordering, compound links, delete of unused rules); `/dashboard/branches/:branchId/tax` (effective config, override editor, calculation preview with sample baskets, precedence + retired-exclusion explainability).
- **Out of scope**: NO change to tax math (rates, half-up line rounding, compound ordering, snapshot rules, `calculate_branch_taxes`); no client-side tax arithmetic presented as authoritative (the preview renders the RPC's output); no new scopes; no invoice/print artifacts.
- **Existing contracts**: `create_tax_rule`, `update_tax_rule`, `retire_tax_rule`, `delete_unused_tax_rule`, `reorder_tax_rules`, `set_branch_tax_override`, `get_branch_tax_config`, `calculate_branch_taxes` (deterministic — same basket → byte-identical totals), `record_tax_snapshot`; payload validators `parseTaxConfig`/`parseCalculation` (`TaxPayloadError`); money formatters.
- **Key FRs**: FR-01 rules list (scope/target/rate/order/active-retired); FR-02 rule editor w/ verbatim validation messages; FR-03 compound "calculated after" in plain language; FR-04 ordering control stating what order changes; FR-05 branch override surface (inherited vs overridden); FR-06 preview: basket → server calc → rendered lines (subtotal/taxes/total); FR-07 retire vs delete distinction; FR-08 snapshot action with meaning; FR-09 empty/loading/error states both pages; FR-10 malformed payload → error state, never a crash.
- **UX**: precedence at a glance (inherited/overridden badges); preview updates only after a server response (busy state, never guessing); money formatting consistent; destructive actions explain blast radius (existing sessions keep captured money); terminology matches the spec (rule, scope, compound, override, retire).
- **Visual**: form-heavy grouped fields + helper text; override badges; preview reads like a bill (same `TotalsPanel` shell as customer/cashier); active/retired status pills; tokens and primitives only.
- **Responsive**: desktop rules+editor+preview together; tablet two columns; mobile read rules + preview, edit simple fields; the spec must state what is deliberately NOT editable on mobile.
- **A11y**: numeric inputs labelled with units/bounds; grouped fieldsets for scope/target; helper text via `aria-describedby`; error summary; preview results in a live region; keyboard-accessible ordering; no color-only inherited/overridden.
- **State matrix**: rules none/list/retired-only/create busy/validation refusal/delete blocked (in use)/delete confirm; compounds none/configured/invalid-source refusal; overrides none/inherited/overridden/clearing; preview idle/calculating/result/empty-basket/provider-error/payload-error; snapshot idle/recording/recorded.
- **Components suggested**: TaxRulesTable, TaxRuleEditor, ScopeSelector, CompoundEditor, OrderControls, OverridePanel, InheritanceBadge, TaxPreviewPanel, RetireDialog, MoneyText/TotalsPanel reuse.
- **Impeccable**: `shape` on the rule editor; `critique`; `clarify` (vocabulary + helper copy); `audit` (form a11y); `polish`.
- **Expected clarify questions**: terminology set shown to users; basket presets for the preview; whether retired rules remain visible by default; whether snapshots are surfaced here at all (contract exists — confirm the surface belongs to this phase).
- **Exit criteria**: an owner configures a realistic multi-rule setup and the preview matches the engine; a manager overrides their branch and sees the difference; all existing tax E2E assertions preserved or migrated; no arithmetic in the UI.
- **Gates**: `npm run verify` (tax db + integration included); `npm run test:e2e` (tax.surfaces); axe/responsive. Checkpoint `feat(028)` after convergence.

## Frontend state at baseline
- Routes: `src/routes/TaxPage.tsx` (125 ln: owner-only gate `canManageRestaurant`, multi-restaurant selector, menu-target pickers via `useRestaurantMenu`) and `src/routes/BranchTaxPage.tsx` (118 ln: `canViewBranchTax` gate, exact canManage composition = owner-of-restaurant OR branch_manager-here, BranchTaxPanel + TaxPreview).
- Feature `src/features/tax/`: `taxClient.ts` (462 ln — the RPC mapping + `parseTaxConfig`/`parseCalculation` + `TaxPayloadError`), `taxMoney.ts` (53 ln — `canonicalizeRate`/`isValidRateInput`/`formatRate`/`RATE_HINT`/`RATE_PATTERN`), `useTax.ts` (212 ln — reads + mutations + preview hook + `useTaxInvalidation`), `components/`:
  - `TaxRulesPanel.tsx` (554 ln): ordered rule list w/ scope badges, effective rates, active/retired state, compound-source labels; shared create/edit form (name/rate/scope/target checkboxes/compound source multi-select) validating rate against RATE_PATTERN pre-submit; reorder by complete ordered list; retire w/ confirmation naming the rule; delete only when the read marks unreferenced; verbatim server messages.
  - `BranchTaxPanel.tsx`: effective config read + per-rule override editor (replacement rate) + branch-only rules; origin labels exist as plain text.
  - `TaxPreview.tsx` (217 ln): basket rows (item select 'Add an item' labeled `Hummus — 6.50`, extras, quantity), submit-once-per-press (`submitted` basket drives `useTaxPreview`), lines rendered verbatim from the engine + subtotal/total; empty state 'This branch has no offered items yet…'.
- Money primitives available: `MoneyText`, `TotalsPanel` (phase 05) — the preview currently renders its own lines (not yet the TotalsPanel shell).
- Management language available: `ManagementLayout`, `SectionCard`, `ScopeBadge`, `StatusPill` (phase 026) — NOT yet applied to either tax route (plain h1 + stacked sections).
- Menu surface CSS module pattern (`menu.surfaces.module.css`) is the template for a `tax.surfaces.module.css`.

## Frozen contracts (must pass UNEDITED)
- `e2e/tax.surfaces.test.ts` (232 ln, ~12 tests): h1 'Tax'; 'Add a tax rule' button; denials h1 'Not authorized' + 'Add a tax rule' count 0 (bob manager, carla cashier, dan kitchen, platform admin, eve other-owner isolation — no 'VAT — 8.25%'/'City tax' text); Marina h1 'Marina tax' (no 'Downtown surcharge'); Downtown h1 'Downtown tax' (no '(branch override)' text Downtown-side); bob has Downtown controls, rejected at Marina; carla sees Downtown view with zero 'Override' buttons; preview: 'Add an item' select 'Hummus — 6.50', lines in configured order, deterministic identical resubmission, viewers have no 'Save' count, Marina empty state.
- `tests/unit/tax.client.test.ts` (477 ln) — mapping + parser tests, UNCHANGED.
- `docs/frontend-presentation-contracts.md` — no tax anchors yet (the tax route was never re-skinned); this phase's ledger entry becomes the first.

## Prior-phase lessons applied (from phases 5–7)
- verify cycle: `db:reset` BEFORE verify AND before the full Playwright run (serial customer journeys accumulate open T2 sessions; F6/027).
- Playwright full run ~9.5 min, 3 chromium projects; dev server on 5173 must be alive (restart after Freebuff restarts).
- Frozen-anchor discipline: never edit pinned assertions; fix presentation on OUR side (027 F3 label-collision lesson — new nav/section buttons must not collide with pinned accessible names under strict mode).
- Editor mechanics: wrapper SECTION (not form) when inner forms exist; name follows current values; controlled checkboxes lag the round trip (verify clicks; 027 D8).
- Design gate: colors only via tokens (comments included — 027 F5); `npx impeccable detect src` exit 0; axe floor holds on data-dependent states (empty-category contrast lesson, 027 F4).
- Evidence scripts under `scripts/e2e/` run-then-delete; Prettier on everything before verify.
