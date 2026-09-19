# Contract: Database Functions — Tax Engine (Phase 5)

**Feature**: `006-tax-engine` | **Data model**: [data-model.md](../data-model.md) | **Research**: [research.md](../research.md)

Conventions inherited from features 004/005: every write function is `security definer`, `set search_path = ''`, authorizes as its first act (`42501` "…not authorized…" when out of role/scope), validates with `P0001` messages, catches constraint violations **by constraint name** and re-raises them as clear messages, calls `private.record_audit` in the same transaction, and treats unchanged values as explicit no-ops that write nothing and return the stored state. Read functions are `security invoker`, authorize scope explicitly first, then read under the caller's own policies. All amounts and rates cross the boundary as exact strings; percentages as four-decimal strings.

## §1 Write RPCs — restaurant-level rules (owner-only)

### `create_tax_rule(p_name text, p_rate text, p_scope text, p_sort_order int, p_item_ids uuid[], p_category_ids uuid[], p_compound_source_ids uuid[]) → tax_rules`

- Owner-only (`42501` otherwise). Name: non-blank after trim, ≤ 80 chars, unique case-insensitively within the restaurant **across restaurant-level and branch-only rules** (`P0001` "A tax rule with this name already exists." / "A tax rule name is required.").
- Rate: validated by the same rules as the client (`P0001` "A tax rate must be between 0 and 100 with at most four decimal places.") — malformed, negative, >100, >4 decimals rejected; zero valid.
- Scope: `'total' | 'items' | 'categories'` (`P0001` "A tax rule scope must be total, items, or categories."). `total` → target arrays must be empty; `items`/`categories` → the corresponding array non-empty and the other empty; ids must exist in the caller's restaurant (FK `23503` → clear message).
- Compound sources: optional; each must be an active rule of the same restaurant, not self (`P0001` "A tax cannot compound on itself." / "A compound source must be an active rule of this restaurant.").
- Audit: `tax.rule_created` with change `name=<name>; scope=<scope>; rate=<rate>; order=<n>`.
- Returns the created row (with its target ids resolved).

### `update_tax_rule(p_rule_id uuid, p_name text, p_rate text, p_scope text, p_sort_order int, p_item_ids uuid[], p_category_ids uuid[], p_compound_source_ids uuid[]) → tax_rules`

- Owner-only; the rule must belong to the caller's restaurant (`42501`/`P0001` "Tax rule not found."). Same validation as create. A rule referenced by a snapshot **MAY be edited** (rate/name/targets) — snapshots are self-contained and unaffected (research §7); a retired rule MAY be reactivated.
- No-op rule: identical values (including identical target sets) write nothing and return the stored row.
- Audit on change: `tax.rule_updated` with change `field=<changed fields>; before=<…>; after=<…>`.

### `reorder_tax_rules(p_rule_ids uuid[], p_branch_id uuid default null) → void`

- Owner-only when `p_branch_id` is null (the restaurant-level set); owner or that branch's manager when a branch is named (that branch's branch-only rules + override-bearing rules' local ordering context — see §3). The id array MUST be the complete set of rules in the addressed context, each exactly once (`P0001` "The reorder list must contain every rule exactly once."). Writes `sort_order` per position.
- Audit: `tax.rules_reordered` (branch scope when a branch context).

### `retire_tax_rule(p_rule_id uuid) → tax_rules`

- Owner-only for restaurant-level rules; owner or the owning branch's manager for branch-only rules. Sets `is_active = false`. Idempotent no-op when already retired.
- Audit on change: `tax.rule_retired` with change `name=<name>`.

### `delete_unused_tax_rule(p_rule_id uuid) → void`

- Owner-only. Refused with `P0001` "This tax rule has been applied in recorded results and cannot be deleted." when the rule is referenced by any recorded snapshot's fingerprint, any override row, or any target/compound junction row; otherwise deletes the rule and cascades its junction rows.
- Audit on success: `tax.rule_deleted`.

## §2 Write RPCs — branch overrides (owner anywhere; branch manager own branch only)

### `set_branch_tax_override(p_branch_id uuid, p_rule_id uuid, p_rate text | null) → branch_tax_overrides`

- Authorized: the restaurant's owner, or a `branch_manager` member **of that branch** (`42501` otherwise) — clarification 2. The rule must be a restaurant-level active rule of the branch's restaurant (`P0001` "Only a restaurant-level rule can be overridden at a branch.").
- `p_rate` non-null: validates like create; upserts the override row (insert or replace the rate). `p_rate` null: deletes the override row (clear → back to the restaurant default). No-op: setting the same rate again (or clearing a missing override) writes nothing and reports "changed: false".
- Branch-only rules are managed as rules (§1 with `p_branch_id`-scoped authorization on `create_tax_rule`'s branch-only variant — see §4), never through this function.
- Audit: `tax.branch_override_set` / `tax.branch_override_cleared` with branch scope and change `rule=<name>; rate=<rate|default>`.

## §3 Read RPCs (`security invoker`)

### `get_branch_tax_config(p_branch_id uuid) → jsonb`

- Authorized: owner of the branch's restaurant, or any membership on that branch (`42501`). Returns the branch's **effective configuration**: the ordered rule list as applied — each entry `{ rule_id, name, rate (effective four-decimal string), scope, targets, compound_sources, order, origin: "restaurant" | "branch-only" | "override" }` — plus the diff summary the visibility promise (FR-020) needs: which rules are overridden, at what effective rate, which branch-only rules exist.
- Ordering: `(sort_order, name)`; the payload is validated client-side by `parseTaxConfig` (contracts/tax-client.md).

### `calculate_branch_taxes(p_branch_id uuid, p_selections jsonb) → jsonb`

- Authorized: same scope as `get_branch_tax_config` (`42501`). `p_selections` = `[{ item_id, extras: [{ extra_id }], quantity }]` (quantity positive integer, default 1; malformed → `P0001` "A calculation selection is malformed.").
- The engine: resolve the branch's effective configuration (active rules: restaurant-level + that branch's branch-only; overrides applied; ordered by `(sort_order, name)`); compute per line: item-scope rules over the named items' (base + selected extras adjustments) × quantity; category-scope rules over the items of the named categories on the same base; total-scope rules over the subtotal; a rule's base includes the amounts of its named compound sources that applied earlier in the order (research §2); round each line once, half-up, at the end of its own calculation (`round(numeric, 2)`); the total = exact subtotal + lines.
- Returns `{ lines: [{ rule_id, name, rate, scope, order, amount }], subtotal, total, effective_config: <the §3 config> }`. Deterministic: identical input + configuration → byte-identical result (the §16 matrix).
- Empty basket → empty lines, subtotal 0.00, total 0.00 (FR-012's edge case).

## §4 Authorization summary

| Function | Owner | Branch manager | Cashier / kitchen | Other restaurant |
|---|---|---|---|---|
| `create/update/reorder/retire/delete_unused_tax_rule` (restaurant-level) | ✓ | ✗ `42501` | ✗ `42501` | ✗ `42501` |
| branch-only rule variants (with `p_branch_id`) | ✓ any branch | ✓ own branch only | ✗ | ✗ |
| `set_branch_tax_override` | ✓ any branch | ✓ own branch only | ✗ | ✗ |
| `get_branch_tax_config` / `calculate_branch_taxes` | ✓ any branch of own restaurant | ✓ own branch | ✓ read scope on own branch | ✗ `42501` |
| `record_tax_snapshot` | granted; test-exercised; called by no surface this phase (clarification 3) | | | |

## §5 Error vocabulary

`42501` for authorization (message names the missing capability, matching features 004/005); `P0001` for validation with the messages quoted above; `23503` caught by constraint name → clear message. The client maps `42501` → `AuthorizationError` and `P0001` → `ValidationError`, surfacing the server message verbatim (contracts/tax-client.md).
