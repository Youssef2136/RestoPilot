# Research: Tax Engine (Phase 5)

**Feature**: `006-tax-engine` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This document resolves every unknown the plan's Technical Context and Constitution Check surfaced. Decisions are binding for the tasks phase; each records the decision, the rationale, and the alternatives rejected.

## §1 — Rate representation and bounds

**Decision**: A rate is an exact `numeric(7,4)` column — a percentage with exactly four decimal places, `0.0000` ≤ rate ≤ `100.0000`, constrained declaratively (`check (rate >= 0 and rate <= 100)`). On the wire and in the UI it is an exact string of up to four decimals (e.g. `"8.25"`, `"0.9050"`, `"12.5"` canonicalised to `"12.5000"`). The client validates against a `RATE_PATTERN` (`^\d{1,2}(\.\d{1,4})?$`, plus `100` and `100.0000`) and canonicalises to four decimals; no floating-point arithmetic anywhere. The engine multiplies in SQL `numeric` arithmetic, which is exact.

> Implementation correction: the column was first specified and created as `numeric(5,4)` — which caps at 9.9999 and cannot represent the seed's own 10% fixture rate. Migration `20260919122230_tax_rate_precision.sql` widens both rate columns to `numeric(7,4)` (full 0–100 range with four decimals), following the canonical never-edit-applied-migrations workflow.

**Rationale**: `numeric(7,4)` represents every retail tax rate exactly (the full 0–100 range at four decimals), is directly comparable and orderable, and mirrors feature 005's `numeric(12,2)` money decision. A percentage — not a per-ten-thousand basis-point integer — matches §16's vocabulary and staff expectations on the config surface. (The original `numeric(5,4)` choice failed its own bound: two-digit rates overflow it.)

**Alternatives rejected**: basis points as integer (obscure on staff surfaces, conversion at every boundary); `float`/`double` (drift — violates FR-013 and Constitution VI); unconstrained `numeric` (no documented bound — violates FR-007's "documented maximum"); `numeric(4,4)` (caps at 0.9999 — cannot represent 8.25%).

## §2 — Compound-base model

**Decision**: Compounding is **explicit per rule** and reference-based: a rule MAY name other rules of the same restaurant as its *compound sources* (`tax_rule_compounds`), meaning "my base includes the amounts of those named rules". The engine resolves the graph by explicit order: each rule's base = its scope's base amount + the amounts of its named compound sources that applied earlier in the order. A compound reference to a rule that is not active at the branch, that sorts later in the order, or to a rule of a different restaurant is **rejected at save time** (the write RPC validates the whole set before accepting a configuration change). Determinism follows from the total order + validated reference graph.

**Rationale**: §16 asks for "compound calculation" and "explicit calculation ordering" as separate features; reference-based compounding names precisely which earlier taxes feed a base, avoiding the ambiguity of a positional "all previous taxes" rule while keeping the mental model simple on the surface ("this tax applies on top of VAT").

**Alternatives rejected**: a per-rule boolean "compounds on all previous taxes" (coarse — cannot express "VAT on (price + service tax)" when another unrelated tax exists; rejected as the primary model, though a single-source case degenerates to it); implicit positional compounding (order changes silently alter tax math — Risk 6); ordering-only compounding with a global mode flag (not per-rule; conflicts with the clarification that compounding is part of a rule's configuration).

## §3 — Snapshot once-only enforcement (fingerprint)

**Decision**: `tax_snapshots` carries a **deterministic fingerprint** of a real calculation — a canonical string over (branch id, per-item selection with extras, effective rule set as applied: identities, rates, scopes, order, compound sources, rounding rule, lines and amounts) — and a **partial unique index on the fingerprint where recorded_at is not null**. Recording is idempotent-by-fingerprint: `record_tax_snapshot` inserts `on conflict (fingerprint) do nothing`; it returns whether the row it saw was newly recorded. The partial index (not a bare unique) leaves the design free to keep unrecorded (preview-shaped) rows out of the store entirely — in this phase, in fact, **no surface writes snapshots** (clarification 3): `record_tax_snapshot` exists, is granted, is test-proven (once-only, immutability, tenant scoping), and is simply unused by any surface until features 007/008 bind bills.

**Rationale**: FR-016's "once at the moment it is produced" + "a repeated identical calculation MUST NOT write a second record" is exactly a deterministic-content fingerprint with an insert-once conflict rule; the partial unique index makes the guarantee declarative (Constitution VI) rather than convention.

**Alternatives rejected**: unique on (branch, basket, timestamp) (timestamps make identical results distinct — defeats once-only); recording only bill-bound results later with no mechanism now (postpones proving the guarantee; FR-016 says the mechanism is this phase's deliverable); upsert-with-overwrite (would violate FR-017 immutability).

## §4 — Calculation placement and read authorization

**Decision**: The calculation lives in one `security invoker` function `calculate_branch_taxes(p_branch_id, p_selections)` — the same posture as feature 005's `get_branch_menu`: it authorizes scope explicitly (owner of the branch's restaurant, or any membership on that branch, or that branch's manager), then reads under the caller's own policies, so it can never disclose what the policies deny. The effective configuration is computed inside the function from the tables; the client sends only the basket (item ids + per-item extras and quantities) and receives the lines and total. A companion `get_branch_tax_config` returns the effective configuration itself (rules as applied, overrides in effect) for the visibility promise (FR-020), with the same posture.

**Rationale**: Constitution V (the database is the source of truth; the client never computes a business-critical value) and FR-011 (effective configuration computed at the trusted data layer). The `security invoker` + explicit-scope-check pattern is the established feature 005 pattern for exactly this shape of read.

**Alternatives rejected**: `security definer` calculation (would read across tenants if buggy; the invoker posture is safer and matches the 005 read precedent); client-side computation over a config read (violates FR-001/FR-011 and Constitution V); a separate RPC per scope (a matrix of endpoints instead of one canonical engine — FR-001's anti-goal).

## §5 — Order representation

**Decision**: Each rule carries an explicit integer `sort_order` (default 0, ≥ 0). Ordering among applicable rules is `(sort_order, name)` — name as the deterministic tiebreak so ties cannot resolve unpredictably (feature 005 FR-009 continuity). "Two rules MUST NOT share a position" (FR-008) is enforced at save time by the write RPCs over the *active, applicable* set of each scope context, and reorder RPCs take the complete ordered list (feature 005's exact-coverage reorder pattern), rejecting partial or duplicated lists.

**Rationale**: matches feature 005's proven reorder mechanics and keeps the engine's sort total and deterministic without DB-level uniqueness (which would make legitimate parallel scopes uninsertable).

**Alternatives rejected**: DB-unique sort_order per restaurant (breaks parallel edits and mid-drag states; the 005 precedent stores order as data, enforced at save time); fractional/decimal orders (unbounded precision games); ordering by creation time (not explicit, not owner-controlled).

## §6 — Override model

**Decision**: `branch_tax_overrides` carries, per (branch, rule), an optional replacement `rate` (`numeric(7,4)`, null = no replacement) — and branch-only rules are themselves rows in `tax_rules` scoped to exactly one branch (nullable `branch_id` on `tax_rules`: null = restaurant-level; non-null = branch-only, and the branch must be of the same restaurant). Clearing an override = deleting the override row (or nulling its rate). Effective rate at a branch = override rate when present, else the restaurant rate. A branch manager may create/edit/reorder/retire branch-only rules and set/clear replacement rates **for their own branch only** (clarification 2); the restaurant-level rows are owner-only writes. Audit actions distinguish restaurant-level from branch-scoped changes.

**Rationale**: one `tax_rules` table with a nullable branch scope keeps the effective-configuration computation and the audit story uniform; a separate branch-only table would duplicate the rule shape, the order mechanics, and the retirement lifecycle.

**Alternatives rejected**: a separate `branch_tax_rules` table (duplicates lifecycle + ordering + audit); override rows that can also change name/scope (an override changes the *rate*; identity changes are edit actions on real rules); branch-scoped rates stored in a JSON blob (loses declarative integrity).

## §7 — Retention of retiring rules referenced by snapshots

**Decision**: Retirement is a state flag (`is_active boolean not null default true`); retirement never deletes the row. A rule referenced by any snapshot's fingerprint content can never be hard-deleted — snapshot rows carry no FK to rules (they are self-contained), but `record_tax_snapshot`'s fingerprint embeds rule ids; to honor FR-010's "never deleted so recorded results keep the rule's history", hard delete is refused whenever the rule has ever been applied in a recorded snapshot (the function checks; the fingerprint stores ids) **or** is referenced by an override or target junction row. A rule never applied and unreferenced MAY be deleted outright (FR-010's "mistake made before use" carve-out), which cascades its junction rows.

**Rationale**: satisfies FR-010's lifecycle exactly while keeping `tax_snapshots` self-contained and FK-free (immutability must not depend on other tables' lifecycles — Constitution VI).

**Alternatives rejected**: FK from snapshot lines to rules (couples immutability to rule lifecycle — a rule delete would cascade into history); allowing hard delete of any rule with a tombstone view (more machinery than a checked delete).

## §8 — What is NOT built (anti-scope)

**Decision**: No tax-amount history table distinct from snapshots (the snapshot IS the history — FR-016/FR-017); no per-item tax-exempt flags (absence of scope targeting = not taxed; additively extendable); no effective-dating or scheduled rate changes (manual, immediate; snapshots preserve history — assumption confirmed); no jurisdiction/tax-category registry (V1 single-currency, restaurant-defined rules; §3.2); no tax-inclusive price display (feature 007's decision); no tax on the subtotal of an empty basket returning an error (FR-012's empty-basket rule: zero lines, zero tax); no client-side computation path (Constitution V); no realtime (feature 012).

**Rationale**: each exclusion is either named in spec Out of Scope, or is an additive-later extension whose absence keeps Constitution VIII honest. The §16 test matrix is fully covered without any of them.

**Alternatives considered and deferred**: an explicit "tax exemption certificates" surface (§3.2 excludes — accounting-adjacent); per-restaurant currency (additive later change per feature 005's clarification).

## §9 — Test-tier mapping

**Decision**: Database tier (`tests/database/tax.rpc.test.ts`): the 9-function authorization matrix, validation bounds, the full §16 calculation matrix (no taxes / one subtotal / multiple / compound / item-level / category-level / mixed / branch overrides / ordering changes), determinism (byte-identical lines on repeat), snapshot once-only + immutability + tenant denial, audit records. Schema tier (`tax.schema.test.ts`): declared shapes, constraints by name, indexes, policies, the partial unique index. Unit tier (`tax.client.test.ts`): `RATE_PATTERN` boundaries (0, 0.0001, 100, 100.0001 rejected, three decimals accepted to four, >100 rejected, negatives rejected), payload parsing, error mapping, line-amount string properties. Integration tier (`tax.calculation.test.ts`): a real-API journey — owner creates a compound pair + branch override, branch manager sets their own override, the preview computes exact known amounts, another restaurant's owner is denied, teardown. E2E tier (`tax.surfaces.test.ts`): read-and-reject presentation matrix (owner config surfaces render; bob sees his branch's tax view with controls; carla sees it without controls; eve and the platform admin denied; no tenant writes).

**Rationale**: mirrors feature 005's proven tier split; the calculation matrix lives in the database tier where the engine runs, with the integration tier proving the real-session journey and the e2e tier proving the surfaces deny and display correctly.

## §10 — Quickstart journey shape

**Decision**: Three walkthroughs: **A** — the owner builds the tax configuration in one session (SC-001): three-scope rules, a compound pair, ordering; **B** — the branch journey: a branch manager overrides a rate at their own branch, is denied elsewhere, the effective configuration and preview reflect it; **C** — isolation and correctness: cross-restaurant denial, the calculation matrix spot-checks, snapshot once-only proof, audit records. Each is programmatically executable against the real project (the feature 003/004/005 precedent), with a validation record appended after the implementation phase runs them.

**Rationale**: covers the exit condition (configurable, deterministic, branch-aware, isolated) with the established validation-record method.
