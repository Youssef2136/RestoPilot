# Data Model: Tax Engine (Phase 5)

**Feature**: `006-tax-engine` | **Date**: 2026-09-19 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Extends the tenancy model of features 002–005: no new tenancy entity, no new role, no columns on existing tables. Six new tables in the `public` schema, all RLS-enabled with `revoke all … from anon, authenticated` before selective `grant select`; `id uuid primary key default gen_random_uuid()`; `created_at timestamptz not null default now()` on every table; audit via `private.record_audit` inside the RPCs.

## ERD (textual)

```text
restaurants (002) 1───∞ tax_rules (nullable branch_id: null = restaurant-level, non-null = branch-only)
                          │ 1
                          ├───∞ tax_rule_items ∞───1 menu_items (005)          [scope targets]
                          ├───∞ tax_rule_categories ∞───1 menu_categories (005) [scope targets]
                          ├───∞ tax_rule_compounds ∞───1 tax_rules              [compound sources]
                          │ 1
                          └───∞ branch_tax_overrides ∞───1 branches (002/004)   [per-branch replacement rates]

tax_rules 1───∞ tax_snapshots   (no FK — snapshots are self-contained; the fingerprint embeds rule ids)
```

## Tables

### `tax_rules`

One tax rule: restaurant-level (branch_id null) or branch-only (branch_id non-null).

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `restaurant_id` | `uuid` | `not null` — composite tenancy anchor |
| `branch_id` | `uuid` | `null` = restaurant-level; non-null = branch-only at that branch |
| `name` | `text` | `not null`, `btrim(length) between 1 and 80` |
| `rate` | `numeric(7,4)` | `not null default 0`, `check (rate >= 0 and rate <= 100)` — widened from the originally documented `numeric(5,4)` by migration `20260919122230_tax_rate_precision.sql` after the seed proved `numeric(5,4)` cannot represent a two-digit rate |
| `scope` | `text` | `not null`, `check (scope in ('total','items','categories'))` |
| `sort_order` | `integer` | `not null default 0`, `check (sort_order >= 0)` |
| `is_active` | `true` default | retirement flag — never deleted when referenced (research §7) |
| `created_at` | `timestamptz` | `not null default now()` |

**Constraints**:
- `tax_rules_scope_target_key`: `check ((scope = 'total' and no target rows) or (scope in ('items','categories') and targets exist))` — enforced at save time by the write RPCs over the junction tables (declarative cross-table checks are not expressible); the junctions' FKs make cross-restaurant targets impossible.
- `tax_rules_branch_scope_fkey`: composite FK `branches (restaurant_id, branch_id)` — a branch-only rule's branch MUST belong to the rule's restaurant; `on delete restrict`.
- `tax_rules_restaurant_fkey`: composite FK `restaurants (restaurant_id, id)`.
- `tax_rules_restaurant_name_key`: case-insensitive name uniqueness within the restaurant across restaurant-level and branch-only rules: `unique index on (restaurant_id, lower(btrim(name)))`.
- Index: `(restaurant_id, is_active, sort_order)` for the engine's ordered read.

### `tax_rule_items` (scope targets)

| Column | Type | Constraints |
|---|---|---|
| `rule_id` | `uuid` | composite FK `tax_rules (restaurant_id, rule_id)` |
| `item_id` | `uuid` | composite FK `menu_items (restaurant_id, item_id)` |
| `restaurant_id` | `uuid` | `not null` |

- PK `(rule_id, item_id)`; both FKs `on delete cascade` (a rule delete cascades its targets — allowed only when unreferenced per research §7).

### `tax_rule_categories` (scope targets)

Same shape as `tax_rule_items` with `category_id` → `menu_categories (restaurant_id, category_id)`; PK `(rule_id, category_id)`.

### `tax_rule_compounds` (compound sources)

| Column | Type | Constraints |
|---|---|---|
| `rule_id` | `uuid` | composite FK `tax_rules (restaurant_id, rule_id)` |
| `source_rule_id` | `uuid` | composite FK `tax_rules (restaurant_id, source_rule_id)` |
| `restaurant_id` | `uuid` | `not null` |

- PK `(rule_id, source_rule_id)`; `check (rule_id <> source_rule_id)`; composite FKs make cross-restaurant compound references impossible (research §2); `on delete cascade`.

### `branch_tax_overrides`

| Column | Type | Constraints |
|---|---|---|
| `branch_id` | `uuid` | part of PK; composite FK `branches (restaurant_id, branch_id)` |
| `rule_id` | `uuid` | part of PK; composite FK `tax_rules (restaurant_id, rule_id)` |
| `restaurant_id` | `uuid` | `not null` |
| `rate` | `numeric(7,4)` | `not null`, `check (rate >= 0 and rate <= 100)` — the replacement rate (same widening as `tax_rules.rate`) |

- PK `(branch_id, rule_id)`; per-branch override uniqueness is the PK itself.

### `tax_snapshots`

Self-contained immutable records; **no FK to any table** (immutability must not depend on other lifecycles — research §7).

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK |
| `restaurant_id` | `uuid` | `not null` (policy anchor) |
| `branch_id` | `uuid` | `not null` |
| `fingerprint` | `text` | `not null` — canonical deterministic content string (research §3) |
| `recorded_at` | `timestamptz` | `null` until recorded — null = produced-but-unrecorded (mechanism row) |
| `payload` | `jsonb` | `not null` — the applied configuration, lines, and total exactly as produced |
| `created_at` | `timestamptz` | `not null default now()` |

- `tax_snapshots_fingerprint_once_key`: **partial** unique index `on (restaurant_id, branch_id, fingerprint) where recorded_at is not null` — the once-only guarantee, declarative (Constitution VI).
- No update path exists (no RPC, no grant ever); the RLS insert policy is RPC-only (security definer), the select policy is staff-of-restaurant.

## RLS policy matrix (select grants to `authenticated`; writes only through RPCs)

| Table | Select policy |
|---|---|
| `tax_rules` | `restaurant_id in (select private.staff_restaurant_ids((select auth.uid())))` |
| `tax_rule_items`, `tax_rule_categories`, `tax_rule_compounds` | same arm as `tax_rules` |
| `branch_tax_overrides` | `restaurant_id in (select private.staff_restaurant_ids((select auth.uid())))` |
| `tax_snapshots` | `restaurant_id in (select private.staff_restaurant_ids((select auth.uid())))` |

## Function inventory (contracts/database-functions.md holds signatures)

Six write RPCs (`security definer`, authorize-first, `private.record_audit` in-transaction, no-op rule): `create_tax_rule`, `update_tax_rule`, `reorder_tax_rules`, `retire_tax_rule`, `delete_unused_tax_rule`, `set_branch_tax_override` (also clears; branch-manager-eligible for own branch). Two `security invoker` reads: `calculate_branch_taxes`, `get_branch_tax_config`. One snapshot function: `record_tax_snapshot` (`security definer`, granted, test-exercised, called by no surface this phase).

## Seed fixture extension (FR-023)

Blue Olive: rules `Service charge tax` is NOT created (anti-scope) — the demo config is: `VAT` (total scope, 8.25%, order 1), `City tax` (total scope, 1.5%, order 2, compound source `VAT`), `Alcohol duty` (categories scope → Drinks, 10%, order 3), `Imported sweets tax` (items scope → one Desserts item, 5%, order 4); a branch-only rule `Downtown surcharge` (2%, order 5) at Downtown; and a replacement-rate override on `VAT` at Marina (8.75%). Cedar Grill: one total-scope rule, unoverridden. Effective configurations differ per branch exactly as §16's branch-override matrix requires; `scripts/db/seed.mjs`'s summary query counts rules and overrides.
