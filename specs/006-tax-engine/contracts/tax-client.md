# Contract: Tax Client — App Module, Routes, Rate Rules (Phase 5)

**Feature**: `006-tax-engine` | **Plan**: [plan.md](../plan.md) | **Functions**: [database-functions.md](./database-functions.md)

## §1 Client modules

### `src/features/tax/taxMoney.ts`

- `RATE_PATTERN` (`^\d{1,2}(\.\d{1,4})?$` plus the `100` special case): syntactic validation before submit.
- `isValidRateInput(input)`; `canonicalizeRate(input)` → trim, reject invalid, pad to exactly four decimals (`"8.25"` → `"8.2500"`); `formatRate(rateString)` → display form (`"8.25%"`).
- **No floating-point arithmetic anywhere** — canonicalisation is string-based; amounts arrive as exact strings from the engine and are displayed, never computed, client-side.

### `src/features/tax/taxClient.ts`

- Typed wrappers over the nine functions with the established error mapping: PostgREST `42501` → `AuthorizationError`, `P0001` → `ValidationError` surfacing the server message verbatim; other errors surfaced loudly.
- `parseTaxConfig(payload)` / `parseCalculation(payload)`: validate the jsonb shapes of `get_branch_tax_config` / `calculate_branch_taxes` into typed structures — rejecting a malformed payload loudly rather than rendering half a configuration or wrong lines.

### `src/features/tax/useTax.ts`

- `useRestaurantTaxRules(restaurantId)` reading `tax_rules` (+ targets) under policies; `useBranchTaxConfig(branchId)` over `get_branch_tax_config`; `useTaxPreview(branchId)` over `calculate_branch_taxes` (computed per submitted selection, not on keystroke).
- Mutation wrappers with the invalidation rules: every tax mutation invalidates `['tax', restaurantId]` including all branch configurations and any rendered preview; **no optimistic values** for rates, order, or calculation results.

## §2 Routes and guards (presentation-only — Constitution IV)

- `/dashboard/tax` (`src/routes/TaxPage.tsx`): owner-only restaurant configuration (in-page `canManageRestaurant` gate; non-owners render `NotAuthorized`, not a hidden control). Registered in `src/app/router.tsx` under the existing `/dashboard` guard chain; owner "Tax" navigation entry in `DashboardPage.tsx`.
- `/dashboard/branches/:branchId/tax` (`src/routes/BranchTaxPage.tsx`): the branch's effective configuration + override controls + the calculation preview. In-page gates: `canViewBranchTax(branchId)` for the route; `canManageBranchTax(branchId)` (owner or that branch's `branch_manager` membership) for the override controls. Linked from `BranchDetailPage.tsx`.
- `src/features/auth/useAuthContext.ts` adds the two presentation-only predicates `canViewBranchTax(branchId)` and `canManageBranchTax(branchId)`.

## §3 UI flows

1. **Owner, restaurant rules** (`TaxRulesPanel.tsx`): the rule list in `(sort_order, name)` order with scope badges, effective rates, and active/retired state; create/edit forms validating against `RATE_PATTERN` before submit (canonical four-decimal string sent); reorder by submitting the complete ordered list; retire with a confirmation naming the rule; delete offered **only** for rules the config read marks unreferenced.
2. **Branch overrides** (`BranchTaxPanel.tsx`): the effective configuration with origin labels (`restaurant` / `branch-only` / `override`); a replacement-rate editor per restaurant-level rule (cleared state shows the restaurant default); branch-only rule management; for a branch manager the surface shows only their own branch's controls; the server's messages surface verbatim.
3. **Calculation preview** (`TaxPreview.tsx`): pick items (with extras) into a basket, submit, and see the exact lines the customer will be shown — name, rate, scope, amount — in the configured order, plus subtotal and total; identical submissions render identical lines (the determinism promise made visible).

## §4 Empty and error states

- No rules yet: the config surfaces show an empty state pointing at create; the preview renders zero lines and subtotal = total (never an error).
- A retired rule: visible with its state badge in the owner's list; absent from effective configurations and previews.
- Rejected input: the server's validation message next to the control; the stored value unchanged.
- Out-of-scope route access: `NotAuthorized` (rejected, not hidden).
