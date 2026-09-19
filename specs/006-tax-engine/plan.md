# Implementation Plan: Tax Engine (Phase 5)

**Branch**: `006-tax-engine` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-tax-engine/spec.md`, including the Clarifications of 2026-09-19 (extras taxed with their item as one base; branch managers maintain their own branch's overrides; no surface writes snapshots in this phase — the mechanism is delivered and test-proven at the data layer; half-up rounding per line). The feature builds directly on feature 002 (tenancy schema, RLS conventions, private helper family, append-only audit foundation), feature 003 (identity linkage, role-aware policies, `current_auth_context`), feature 004 (the `security definer` management-RPC pattern with `private.record_audit`), and feature 005 (menu items and categories — the targets of item- and category-scoped rules — the composite-tenancy FK pattern, the reorder-by-complete-list pattern, and the exact-amount money rules). Backend remains **Supabase Cloud** (Phase 0 owner directive: no local stack, no Docker).

## Summary

Deliver the Phase 5 tax domain on the established foundation: one canonical tax engine, living entirely in the database, that computes a branch's taxes from its **effective configuration** — the restaurant's rules with that branch's overrides applied — in their explicit order, supporting total-, item-, and category-scope rules, compounding (a rule's base including the amounts of earlier-applied rules its configuration names), and exact half-up amounts. Configuration is owner-maintained at restaurant level (rules: name, exact rate, scope targets, order, compound references, retire) with branch managers maintaining their own branch's overrides (replacement rates and branch-only rules). A staff preview surface computes and presents the exact tax lines a customer will later see; nothing becomes publicly readable in this phase. Real calculation results are captured by an immutable, once-only **snapshot mechanism** delivered and test-proven at the data layer, with no surface writing snapshots until bills bind in features 007/008. Every accepted change is audited; all authorization is enforced at the trusted data layer.

## Technical Context

**Language/Version**: TypeScript (React 19, Vite) for the application; SQL (PostgreSQL 17.6 on the configured Supabase Cloud project) for schema, policies, and the functions — the same split as features 004/005.

**Primary Dependencies**: **No new runtime dependency.** Amounts and rates cross the wire as exact strings and the client performs no floating-point arithmetic; rate validation/canonicalisation joins feature 005's in-repo money module family (`src/features/tax/taxMoney.ts`). `@supabase/supabase-js`, `@tanstack/react-query`, `react-router`, Supabase CLI, `pg`, Vitest, Playwright, pgcrypto are all in place.

**Storage**: Supabase Cloud PostgreSQL: the existing `public`/`private` schemas plus three primary tables (`tax_rules`, `branch_tax_overrides`, `tax_snapshots`) and three junction tables (`tax_rule_items`, `tax_rule_categories` for scope targets; `tax_rule_compounds` for compounding references). No new schemas, no columns on existing tables, no changes to any existing policy, grant, or function, no storage buckets (this phase has no files). Supabase Realtime remains off (master plan §32; live propagation is feature `012`).

**Testing**: The established four tiers, extended not replaced: database (`tests/database/` — the tax RPC matrix including §16's full calculation matrix, in rolled-back transactions with the identity-simulation harness); unit (`tests/unit/` — rate parsing/canonicalisation, payload parsing, error mapping, line arithmetic properties via string-exact cases); integration (`tests/integration/` — a real-API calculation journey with a real owner session and a real branch-manager override session); e2e (`e2e/` — read-and-reject presentation matrix, no tenant writes). `npm run verify` remains the gate (unchanged scripts).

**Target Platform**: Supabase Cloud (region eu-west-1) + browser SPA (Vite dev server at `http://localhost:5173`); tests run from developer machines (Windows primary).

**Performance Goals**: Engineering guidance, not spec gates: the configuration surfaces read the tax tables directly under policies (one query per table, matching the existing initPlan form); a calculation is **one** `calculate_branch_taxes` round trip within SC-008's 2-second budget (the function is a single pass over the effective configuration against the presented selections); no new index on an existing table; the extended suites stay within the existing per-suite budgets.

**Constraints**: Supabase Cloud only (no local stack, no Docker); every schema change through the single canonical migration workflow (FR-024); **no new environment variables**; **no service-role or secret keys anywhere**; **no new npm dependency**; no client write grants on any table; guards and predicates presentation-only (Constitution IV); nothing becomes publicly readable (FR-004); no payment, accounting, invoice, bill-splitting, discount, tip, or service-charge concept anywhere (Constitution I; spec Out of Scope); no surface writes snapshots in this phase (clarification 3) — only the data-layer mechanism exists.

**Scale/Scope**: Three migrations (`<ts>_tax_schema.sql`, `<ts>_tax_policies.sql`, `<ts>_tax_rpcs.sql`); six tables; the `private.branch_manager_branch_ids` helper from feature 005 (reused, not recreated); nine RPCs (six write + two read + one snapshot-recording function exercised only by tests); one new frontend feature module (`src/features/tax/`: 2 modules + 3 components) and two route files plus small edits (router, dashboard navigation, branch detail link); a new in-repo rate/money helper; three new test files plus fixture extension and seed extension. No ordering, session, cart, bill, kitchen, cashier, reporting, realtime, or super-admin surface (spec Out of Scope).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Business Scope Integrity | **PASS** | Taxes are order-collection data for the approved ordering platform (master plan §16, §6.4, §3.1 "dynamic tax configuration"). No payment processing, accounting, invoice printing, inventory, discounts, tips, or service charges: the engine computes tax lines and totals only; remittance/filing are excluded (spec Out of Scope). |
| II | Specifications Are the Source of Business Truth | **PASS** | Every element traces to a spec FR (FR-001…FR-024) or a 2026-09-19 clarification. The bounds the spec deferred to the plan (maximum rate, decimal places, snapshot fingerprint definition, order mechanics) are fixed in research.md within the spec's stated requirement that a documented bound exists and is enforced. |
| III | Multi-Tenant Isolation | **PASS** | The pattern is extended, not weakened: six new tables carry the composite tenant FKs (`tax_rules` → `restaurants(restaurant_id, id)` semantics per feature 002; `branch_tax_overrides` → `branches(restaurant_id, id)` and `tax_rules(restaurant_id, id)`; target/compound junctions → `menu_items(restaurant_id, id)` / `menu_categories(restaurant_id, id)` / `tax_rules(restaurant_id, id)`), every policy uses the wrapped `(select …)` initPlan form over the existing helper family, no existing policy or grant changes, and no client write grants appear. |
| IV | Server-Enforced Authorization | **PASS** | All six write operations authorize inside `security definer` functions (owner-only restaurant rules; owner or that branch's manager for that branch's overrides); the calculation and effective-configuration reads are `security invoker`, authorize scope explicitly, and read under the caller's own policies. Guards and pages are presentation-only. |
| V | Database as the Source of Truth | **PASS** | Tax rules, overrides, effective configuration, calculation results, and snapshots live only in the database; `calculate_branch_taxes` computes the lines server-side — the client never assembles the effective configuration or computes an amount (FR-011, Constitution V). Amounts and rates cross the wire as exact strings. |
| VI | Explicit State and Data Integrity | **PASS** | Declarative first: composite FKs, case-insensitive rule-name uniqueness, rate bounds, per-branch override uniqueness, target-table composite FKs making cross-restaurant references impossible, `on delete restrict` protecting referenced rules. Cross-row rules (order totality, compound-reference validity, snapshot once-only) are enforced in serialized RPCs; each operation is one transaction; unchanged values are explicit no-ops that write nothing. |
| VII | Auditability of Sensitive Operations | **PASS** | Every accepted tax change produces exactly one append-only record through `private.record_audit` with actor, action, resource, tenant scope, and branch scope where applicable (FR-021; master plan §37). No client-readable audit path is added. |
| VIII | Minimal and Intentional Complexity | **PASS** | Five tables, nine functions, **zero new dependencies**, no triggers, no views, no realtime, no storage surface, no generic CRUD layer, no new columns on existing tables. Rejected for being larger than the requirement: a tax-amount history table distinct from snapshots, per-item tax-exempt flags, effective-dated rules, and a jurisdiction/tax-category registry (research.md §3, §8). |

**Post-design re-check (after research.md / data-model.md / contracts / quickstart)**: all eight principles still PASS. No gate violations; Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/006-tax-engine/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── database-functions.md    # The 6 write RPCs + 2 read RPCs + the snapshot function
│   └── tax-client.md            # App module, routes, rate rules, guard/predicate rules
├── checklists/
│   └── requirements.md  # Spec quality checklist (all [x]; re-validated post-clarify)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

Contracts: this project exposes external interfaces on the data-API surface (the nine functions and the new read policies, consumed by the SPA and by any direct data-API call) — contracted, matching features 002–005. This phase has no Storage surface (no files), so there is no storage contract.

### Source Code (repository root — changes for this feature)

```text
/
├── src/
│   ├── app/
│   │   └── router.tsx                     # CHANGED: /dashboard/tax (owner) and
│   │                                      #          /dashboard/branches/:branchId/tax (owner + that branch's manager)
│   ├── features/
│   │   ├── auth/
│   │   │   └── useAuthContext.ts          # CHANGED: adds canManageBranchTax(branchId) and
│   │   │                                  #          canViewBranchTax(branchId) predicates (presentation-only)
│   │   └── tax/                           # NEW feature module (contracts/tax-client.md)
│   │       ├── taxClient.ts               # typed wrappers over the 9 functions; 42501/P0001 mapping;
│   │       │                              # payload parsing into typed structures
│   │       ├── taxMoney.ts                # exact rate validation/canonicalisation/formatting (no float math)
│   │       ├── useTax.ts                  # react-query hooks: configuration reads, branch projection,
│   │       │                              # calculation preview, mutation invalidation rules
│   │       └── components/
│   │           ├── TaxRulesPanel.tsx      # restaurant rules: create/edit/reorder/retire + targets
│   │           ├── BranchTaxPanel.tsx     # branch effective configuration + override controls
│   │           └── TaxPreview.tsx         # staff calculation preview: pick items/extras, see exact lines
│   ├── routes/
│   │   ├── TaxPage.tsx                    # NEW: /dashboard/tax — owner tax configuration
│   │   ├── BranchTaxPage.tsx              # NEW: /dashboard/branches/:branchId/tax — overrides + preview
│   │   ├── DashboardPage.tsx              # EXTENDED: owner "Tax" navigation entry
│   │   └── BranchDetailPage.tsx           # EXTENDED: link to the branch's tax view
│   └── types/
│       └── database.types.ts              # REGENERATED (npm run types:gen) — 5 tables, 9 functions
├── supabase/
│   ├── migrations/
│   │   ├── … (eighteen existing migrations unchanged)
│   │   ├── <ts>_tax_schema.sql            # NEW: 5 tables, constraints, indexes, RLS enable, revokes
│   │   ├── <ts>_tax_policies.sql          # NEW: select grants + read policies
│   │   └── <ts>_tax_rpcs.sql              # NEW: 6 write RPCs + calculate_branch_taxes +
│   │                                      #      get_branch_tax_config + record_tax_snapshot + execute grants
│   └── seed.sql                           # EXTENDED: the demo tax configuration (FR-023)
├── scripts/
│   └── db/
│       └── seed.mjs                       # EXTENDED: tax counts in the summary
├── tests/
│   ├── database/
│   │   ├── helpers/fixtures.ts            # EXTENDED: tax ids and seeded values
│   │   ├── tax.schema.test.ts             # NEW: declared shapes, constraints, indexes, policies
│   │   └── tax.rpc.test.ts                # NEW: the 9-function matrix — authorization, validation,
│   │                                      #      the §16 calculation matrix, determinism, snapshot rules
│   ├── integration/
│   │   └── tax.calculation.test.ts        # NEW: real-API calculation journey (owner + branch manager)
│   └── unit/
│       └── tax.client.test.ts             # NEW: rate rules, payload parsing, error mapping
├── e2e/
│   └── tax.surfaces.test.ts               # NEW: owner tax surfaces, branch override surface, preview lines,
│                                          #      non-owner denials (read-and-reject)
└── docs/
    └── development.md                     # EXTENDED: the Phase 5 suites
```

**Structure Decision**: No new top-level directories. Database work extends the `supabase/migrations/` + `seed.sql` layout; the frontend lands in the feature-module convention (`src/features/tax/`) with pages in `src/routes/`; tests extend the established four tiers. No storage surface exists in this phase.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None. No Constitution violations were identified; no complexity requires justification. The additions that carry machinery — the three junction tables, the snapshot table with its once-only fingerprint rule, and the `security invoker` calculation function — are each the minimal documented mechanism for FR-006 (multi-target scopes and compounding references without cross-restaurant references), FR-016/FR-017 (immutable, once-only historical correctness), and FR-011/FR-012 (a single scope-safe deterministic calculation), with alternatives evaluated and rejected in [research.md](./research.md) §3, §5, §8.
