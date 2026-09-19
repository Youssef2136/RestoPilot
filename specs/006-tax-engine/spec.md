# Feature Specification: Tax Engine (Phase 5)

**Feature Branch**: `006-tax-engine`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description (confirmed from the master plan): "Implement the centralized, deterministic tax calculation domain (Phase 5): one canonical tax engine — never duplicated per page — supporting taxes applied at total, item, and group/category level; normal subtotal and compound calculation with explicit calculation ordering; restaurant-level tax rules as defaults with branch overrides; and customer-visible tax lines. Persisted calculation snapshots preserve historical correctness." Constrained by the RestoPilot Constitution (especially Principles I–VIII), the master plan's V1 scope (§3.1: dynamic tax configuration) and out-of-scope list (§3.2: no online payment, accounting, invoice printing, or bill splitting), the tax domain model (§6.4: tax rules, scope definitions, ordering, branch overrides, calculation metadata/snapshots), the data-integrity requirements (§35), the audit strategy (§37), the concurrency requirements (§36), and Risk 6 (price/tax drift — centralized rules and preserved snapshots); builds directly on feature 002 (restaurant/branch tenancy, enforced isolation, append-only audit foundation), feature 003 (authenticated staff identities and the role/scope authorization model), feature 004 (restaurant, branch, and staff configuration), and feature 005 (menu items and categories — the objects item- and category-level taxes attach to — and the exact-amount price guarantees this phase inherits).

## Clarifications

### Session 2026-09-19

- Q: Should extras be taxed together with their item when an item- or category-scope tax applies? → A: Yes — an item- or category-scope tax's base is the item's base price plus the selected extras' price adjustments, as one amount.
- Q: Who maintains branch-level tax overrides — a branch's replacement rate or branch-only rule? → A: Branch managers maintain their own branch's overrides (replacement rates and branch-only rules); restaurant-level rules remain owner-maintained; cashiers and kitchen staff manage none.
- Q: What triggers writing a tax snapshot in this phase, given the only calculation surface is the staff preview and bill binding arrives with ordering? → A: Nothing yet — the snapshot mechanism, its once-only enforcement, and its immutability are delivered and test-proven at the data layer, but no surface in this phase writes snapshots; snapshots are written when customer bills bind in the ordering features.
- Q: Which rounding rule applies when a tax line's exact amount lands on a half-cent? → A: Half-up — a half-cent rounds up, the one documented rounding rule for every line.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tax Rule Configuration (Priority: P1)

The owner configures their restaurant's taxes: named rules, each with an exact rate, an application scope — the restaurant's total, specific menu items, or specific menu categories (feature 005's shared categories) — and an explicit position in the calculation order. Rules are created, edited, reordered, and retired; a retired rule stops applying to new calculations while history keeps what it recorded. Configuration is restaurant-level: it is the default every branch inherits.

**Why this priority**: §16 lists restaurant defaults and explicit calculation ordering among the phase's features, and §6.4's domain model — tax rules, scope definitions, ordering — is the substrate every calculation reads. No tax can be computed until rules exist; this is the phase's MVP.

**Independent Test**: With the seeded owner, create rules at each scope (total, an item, a category), set an explicit order among them, edit a rate, reorder, retire a rule, and attempt invalid inputs (blank names, malformed or out-of-bound rates, a category-scoped rule pointing outside the restaurant); verify a branch manager (restaurant-level rules), a cashier, a kitchen member, and another restaurant's owner are each denied; verify a second restaurant's configuration is untouched throughout; verify audit records.

**Acceptance Scenarios**:

1. **Given** a restaurant owner, **When** they create a tax rule with a name, an exact rate, and a scope, **Then** the rule belongs to that restaurant and is in effect at every branch of it as the restaurant default (FR-005, FR-009).
2. **Given** a restaurant owner, **When** they edit a rule's name or rate, **Then** the change persists and takes effect for every later calculation as soon as it is saved — no draft or publish workflow (FR-005, FR-015).
3. **Given** several rules, **When** the owner sets their calculation order, **Then** the order persists and every calculation applies the rules in exactly that order (FR-008).
4. **Given** an attempt to save a rule with a blank name, a malformed rate, a negative rate, or a rate beyond the documented bound, **When** it is attempted, **Then** it is rejected with a clear message and no partial record is created (FR-004).
5. **Given** a rule the restaurant no longer wants, **When** it is retired, **Then** new calculations no longer apply it while any recorded result keeps what it captured (FR-010).
6. **Given** a signed-in branch manager attempting restaurant-level tax rules, a cashier, a kitchen member, or a staff member of another restaurant, **When** they attempt to change tax configuration through any access path, **Then** the attempt is denied at the trusted data layer, not merely hidden in the interface (FR-002, FR-003).
7. **Given** any accepted configuration change, **When** it completes, **Then** an append-only audit record exists with the actor, the time, the resource, the change, and the tenant scope (FR-021).

---

### User Story 2 - Branch Tax Overrides (Priority: P2)

A branch can carry its own version of a tax rule — a different rate, or an additional tax that exists only at that branch. Everywhere a branch carries no override, the restaurant default applies unchanged. The effective configuration of a branch is computed, never implied: owners and each branch's manager see which branches differ from the default and why.

**Why this priority**: §16 names branch overrides among the phase's features and §6.4 lists them in the domain model. They are a refinement of configuration (US1) and a prerequisite surface for the customer-visible lines of US3 — without them the defaults are already correct; with them the branch view becomes truthful.

**Independent Test**: With the seeded owner, override a default rule's rate at one branch, add a branch-only rule there, and verify the restaurant defaults still apply unchanged at another branch; clear the override and verify the branch returns to the default; verify a branch manager can maintain their own branch's overrides but is denied for another branch and for restaurant-level rules, and a cashier and another restaurant's owner are denied; verify the effective configuration of each branch reflects every saved change on the next read.

**Acceptance Scenarios**:

1. **Given** a branch of a restaurant with default rules, **When** the owner overrides a rule's rate at that branch, **Then** only that branch's effective configuration changes and the restaurant default remains intact for every other branch (FR-009).
2. **Given** a branch, **When** the owner adds a branch-only tax rule there, **Then** the rule applies at that branch only and is invisible to every other branch's effective configuration (FR-009).
3. **Given** a branch carrying an override, **When** it is cleared, **Then** the branch returns to the restaurant default for that rule (FR-009).
4. **Given** a signed-in branch manager, **When** they set, change, or clear an override for their own branch, **Then** it succeeds within their branch scope; **When** they attempt an override at another branch or any restaurant-level change, **Then** the attempt is denied at the trusted data layer (FR-002, FR-003).
5. **Given** any accepted override change, **When** it completes, **Then** an audit record exists with the branch scope recorded (FR-021).

---

### User Story 3 - Deterministic Calculation and Customer-Visible Tax Lines (Priority: P3)

The engine computes taxes for a bill deterministically: given the same menu selections and the same effective configuration, the result is always the same — the same lines, in the same order, to the same exact amounts. Taxes apply at the scopes configured in US1/US2 (total, item, category), combine under explicit ordering — including compound application where a later tax applies to an amount that an earlier tax has already increased — and every result is presented as explicit tax lines, as customers will see them. Staff can see exactly what a customer will see before anything is ordered.

**Why this priority**: The calculation is the phase's purpose (§16: "centralized, deterministic tax calculation"), but it consumes configuration; it cannot exist before US1/US2. Its output — the tax lines — is what later phases (sessions, rounds, cashier) consume.

**Independent Test**: Configure known rules at multiple scopes with explicit ordering (including a compound pair), present a known basket of items, and verify the computed lines match hand-calculated exact amounts in the configured order; repeat the identical request and verify a byte-identical result; change an item's selection or a rule and verify only the affected lines change; verify the calculation and its lines are readable by staff of the owning restaurant only.

**Acceptance Scenarios**:

1. **Given** configured rules at total, item, and category scope with an explicit order, **When** a basket of items is presented for calculation, **Then** the result contains one line per applied tax in the configured order, each with its name, rate, and an exact two-decimal amount that sums with the subtotal to the total (FR-012, FR-013).
2. **Given** a compound pair — a later tax configured to apply on the subtotal including an earlier tax — **When** the calculation runs, **Then** the later tax's base is the earlier tax's amount included, and the order is the configured one, never an implementation accident (FR-014).
3. **Given** the identical basket and configuration, **When** the calculation runs twice, **Then** both results are identical — same lines, same order, same amounts (FR-012).
4. **Given** an empty basket, **When** the calculation runs, **Then** the result is an empty line set and a zero total — not an error (FR-012).
5. **Given** a staff member of the owning restaurant, **When** they view the calculation preview, **Then** they see exactly the tax lines a customer would be shown for the same basket and branch (FR-014).
6. **Given** a signed-in staff member of another restaurant, **When** they request this restaurant's calculation or its configuration, **Then** the attempt is denied (FR-002, FR-004).

---

### User Story 4 - Historical Correctness (Priority: P4)

A calculation that was recorded at some point in the past never changes: when rules, rates, ordering, or overrides change later, every previously recorded result keeps its lines and amounts, and no surface presents a later configuration as a past one. Every real calculation result is recorded once, at the moment it is produced, with the configuration it used; a repeat calculation that produces no new result records nothing.

**Why this priority**: Risk 6 (price/tax drift) and §16's "persisted snapshots when required to preserve historical correctness" make this the guarantee later billing and reporting depend on; but nothing in the exit journey needs it until calculations are consumed by ordering (features 007/008), hence P4.

**Independent Test**: Produce a calculation with known rules, change a rate and retire a rule, then verify the original recorded result is unchanged and remains retrievable with its original lines; verify a changed rate appears only in calculations produced after the change; verify an identical repeat calculation writes no second record.

**Acceptance Scenarios**:

1. **Given** a recorded calculation result, **When** a rule's rate is later changed, **Then** the recorded result still shows its original rate and amount, and no surface presents the new rate as the historical one (FR-017).
2. **Given** a recorded calculation result, **When** a rule is retired, **Then** the recorded result keeps the retired rule's line exactly as it was (FR-017).
3. **Given** an accepted real calculation, **When** it completes, **Then** a record exists capturing the applied configuration and its lines at that moment (FR-016).
4. **Given** a repeated identical calculation that produces no new result, **When** it completes, **Then** no additional record is written (FR-016).

---

### Edge Cases

- What happens when no tax rules exist at all? Calculations proceed with an empty line set and a total equal to the subtotal — taxes are never a blocking prerequisite for ordering (§16 test matrix: "no taxes").
- What happens when two rules share the same order position? Impossible: the order is explicit and total among the applying rules (FR-008); the engine rejects a configuration whose ordering is ambiguous.
- What happens when a category-scoped rule's category is involved in a move or is emptied? The rule keeps its reference to the category itself; an item's taxes follow the item's current category (feature 005's identity guarantee).
- What happens when a rate changes while a customer is viewing a menu? The customer's next calculation reflects the saved rate; no surface may present a stale configuration as current (FR-015).
- What happens when a rule is retired while a customer is browsing? The next calculation no longer applies it; recorded results keep what they captured (FR-010, FR-017).
- What happens when a compound tax's earlier tax is retired or its rate becomes zero? The compound tax's base changes accordingly — the configuration is explicit, the result follows it deterministically (FR-012).
- What happens when a branch-only rule is created with the same name as a restaurant-level rule? Rejected: rule names are unique within the restaurant across restaurant-level and branch-level rules (FR-005); the operator names the branch rule distinctly.
- What happens when two owners edit the same rule or override concurrently? Each accepted change is applied atomically; the final state reflects the accepted writes with no partial or contradictory records (FR-018, Constitution VI).
- What happens when a staff member of another restaurant crafts a direct data request for this restaurant's tax configuration or calculations? Denied — the isolation categories of features 002/003 are re-proven over the new surfaces (FR-019).
- What happens when the platform super admin (no restaurant memberships) attempts tax configuration? Denied — the capability grants no tenant access (feature 003 FR-012; feature 004 FR-021 continuity).
- What happens when amounts would round? Rounding is defined exactly once, per line, at the end of that line's calculation, by an explicit documented rule — never per intermediate step, and never differently between two calculations of the same basket (FR-013).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The platform MUST implement one shared tax calculation domain (the engine) — every surface that produces or presents a tax amount MUST obtain it from the engine; no surface MAY implement its own tax logic (§16: "the tax engine should not be duplicated independently in multiple UI pages").
- **FR-002**: Every action defined by this phase MUST be authorized at the trusted data layer against the acting member's current role and scope (feature 003's authorization model) through every access path; requests outside the actor's scope MUST be denied, and interface visibility MUST NOT be treated as the authorization boundary (Constitution III/IV; master plan §5.2).
- **FR-003**: Tax configuration is distributed as follows. Owners maintain the restaurant's tax rules and may set or clear overrides at any branch. Branch managers may set, change, and clear overrides — replacement rates and branch-only rules — for their own branch only, and maintain no restaurant-level rules. Cashiers and kitchen staff manage no tax configuration. No actor may act outside their own restaurant or branch scope, and the platform super-admin capability grants no tax access (feature 003 FR-012).
- **FR-004**: A restaurant's tax configuration MUST be readable only by members of that restaurant; staff members of another restaurant MUST NOT read or change it through any access path, and nothing introduced by this phase becomes publicly readable in this phase (feature 002 FR-008; feature 005 FR-004 continuity).
- **FR-005**: Owners MUST be able to create, edit, reorder, and retire tax rules of their restaurant. A rule MUST have a non-blank name (unique within the restaurant, compared case-insensitively after trimming), a scope, and a rate; a duplicate or blank name MUST be rejected with a clear message and no partial record.
- **FR-006**: A tax rule MUST be applicable at exactly one scope: the restaurant's total, one or more specific menu items of the same restaurant, or one or more of the restaurant's shared menu categories. Scope definitions MUST reference only objects of the same restaurant; cross-restaurant references MUST be impossible (§6.4 scope definitions; feature 005's composite-tenancy pattern).
- **FR-007**: A rate MUST be a non-negative percentage with an exact, bounded number of decimal places and a documented maximum; malformed, negative, and out-of-bound rates MUST be rejected without altering the stored value. A zero rate is valid (an explicitly no-charge rule). A retired rule's name and rate are kept as history (FR-010).
- **FR-008**: The calculation order MUST be explicit and total: every applicable rule carries a position; two rules MUST NOT share a position. Owners MUST be able to reorder the restaurant's rules and any branch's rules; a branch manager MUST be able to reorder their own branch's rules. The order MUST be deterministic everywhere the calculation runs or is displayed (§16: explicit calculation ordering; feature 005 FR-009 continuity).
- **FR-009**: A restaurant's rules MUST be the defaults in effect at every branch of that restaurant (§16: restaurant defaults). An owner MUST be able to override a rule's rate at any branch, to add a branch-only rule, and to remove an override — returning that branch to the restaurant default for that rule; an override MUST NOT affect any other branch or the restaurant-level configuration.
- **FR-010**: A rule the restaurant no longer wants MUST be retired — never deleted — so recorded results keep the rule's history; a retired rule MUST stop applying to new calculations immediately and MUST remain visible to staff with its state (feature 005 FR-007 continuity). Only a rule never referenced by any recorded result MAY be deleted outright (a mistake made before use).
- **FR-011**: The engine MUST compute a calculation result for a given branch from that branch's effective configuration: the restaurant's rules with that branch's overrides applied. The effective configuration MUST be computed at the trusted data layer; a client MUST NOT assemble or compute it (Constitution V).
- **FR-012**: The engine MUST apply the applicable rules of the effective configuration in their explicit order to the presented basket and return: one line per applied tax (name, rate, scope, exact amount, order position) and the resulting total; item-scope rules apply to the basket items they name — an item's taxable base being its base price plus its selected extras' price adjustments — category-scope rules to the items of the categories they name on the same base, total-scope rules to the subtotal; compound application (a rule configured to apply on a base that includes an earlier applied tax) MUST follow the configured order exactly (§16: normal and compound calculation). The result MUST be deterministic: identical input and configuration MUST produce identical results every time (Risk 6).
- **FR-013**: Amounts MUST be exact (feature 005's money guarantees): a line's amount MUST be rounded to the currency's two decimals at the end of that line's own calculation, by the one documented rounding rule — half-up, a half-cent rounding up — never per intermediate step, never differently between two calculations of the same basket; the total MUST be the exact sum of the subtotal and the lines.
- **FR-014**: The calculation and its lines MUST be readable by staff of the owning restaurant per their read scope as a preview of what a customer will be shown — the customer-facing presentation arrives with feature `007-customer-access-and-session`; in this phase the preview is staff-only and nothing becomes publicly readable (feature 005 FR-014 continuity).
- **FR-015**: The calculation used for the customer-facing presentation MUST be the current saved configuration on each calculation; a saved change MUST NOT require a further action to take effect, and no surface may present a stale configuration as current (feature 005 FR-011 continuity; §16 "customer-visible tax lines").
- **FR-016**: Every real calculation result MUST be recorded once at the moment it is produced — a persisted snapshot carrying the basket's identity, the effective configuration (rule identities, rates, scope, order, compound flags as applied), and the lines and total as produced; a repeated identical calculation MUST NOT write a second record (Risk 6; §6.4 "calculation metadata/snapshots where required"). In this phase no surface writes snapshots: the recording mechanism, its once-only enforcement, and its immutability are delivered and exercised at the data layer by this phase's tests; the flow that binds results to customer bills — the moment a snapshot is written — arrives with the ordering features (`007-customer-access-and-session`, `008-cart-and-rounds`).
- **FR-017**: A recorded snapshot MUST be immutable: later configuration changes MUST NOT alter it, and no surface may present a current rule's state as a past record's value (Risk 6 mitigation: "preserve required snapshots").
- **FR-018**: Concurrent tax configuration edits — including simultaneous rule edits and override changes — MUST be applied atomically, and every value MUST remain single-valued and consistent (Constitution VI; feature 005 FR-025 continuity).
- **FR-019**: The guarantees of features 002, 003, 004, and 005 MUST remain intact over every surface this phase touches: deny-by-default for public and unauthenticated access, tenant and branch isolation, and the role/scope authorization model — re-proven over tax rules, overrides, calculations, and snapshots (feature 005 FR-026 continuity).
- **FR-020**: An owner MUST be able to see, for each branch of their restaurant, that branch's effective tax configuration and exactly how it differs from the restaurant defaults — which rules are overridden, at what rate, and which branch-only rules exist — and each branch's manager likewise sees their own branch's effective configuration (the visibility promise of User Story 2).
- **FR-021**: Every accepted tax change — rule create/edit/reorder/retire, override set/change/clear — MUST be recorded in the append-only audit foundation with actor, action, resource, change, and tenant scope — branch scope where applicable (feature 002 FR-012/FR-013; master plan §37). Audit records MUST remain unmodifiable and MUST NOT be readable through client-accessible paths in this phase (feature 005 FR-024 continuity).
- **FR-022**: The project MUST include automated tests proving at least: (a) the authorization matrix over this phase's surfaces — denials for unauthorized roles, out-of-scope branches and restaurants, and direct data access; (b) the validation rules — blank and duplicate rule names, malformed/negative/out-of-bound rates, cross-restaurant scope references; (c) the calculation matrix of §16 — no taxes, one subtotal tax, multiple taxes, compound taxes, item-level, group/category-level, mixed scopes, branch overrides, ordering changes; (d) determinism — identical inputs and configuration produce identical results; (e) snapshot immutability — recorded results unchanged after later configuration changes; and (f) the audit records of FR-021.
- **FR-023**: The development seed MUST provide the fixture needed to demonstrate and test this phase without manual setup — the tenancy and staff identities of features 002–004, the menu of feature 005, plus a deterministic demo tax configuration: rules at total, item, and category scope with an explicit order including a compound pair, and one branch override — idempotent and converging.
- **FR-024**: All schema changes for this phase MUST flow through the single canonical migration workflow (features 001–005 continuity); generated data-access types MUST be regenerated rather than hand-edited, and the existing test tiers MUST be extended rather than replaced.

## Key Entities

This phase extends the tenancy model that features 002–005 delivered — it introduces no new tenancy entity and no new tenancy level. Its new data is restaurant-level tax configuration, branch-scoped tax overrides, the calculation results the engine produces, and the persisted snapshots of those results.

- **Tax Rule**: a named tax with an exact non-negative percentage rate, exactly one scope (the restaurant's total, specific menu items, or specific menu categories of the same restaurant), an explicit position in the calculation order, and an active/retired state; created, edited, reordered, and retired by the restaurant's owners; the restaurant-level default in effect at every branch.
- **Branch Tax Override**: a branch's replacement rate for a restaurant-level rule, or a branch-only additional rule, at exactly one branch of the owning restaurant; clearing it returns the branch to the restaurant default for that rule.
- **Effective Configuration**: the computed set of rules a branch's calculation applies — the restaurant's active rules with that branch's overrides applied, in the explicit order; computed at the trusted data layer, never assembled by a client.
- **Calculation Result**: the engine's deterministic output for a presented basket at a branch — one line per applied tax (name, rate, scope, exact amount, order position) and the exact total; identical for identical input and configuration.
- **Tax Snapshot**: the immutable persisted record of a real calculation result — the applied configuration (rule identities, rates, scopes, order, compound flags) and the lines and total exactly as produced at that moment; the historical-correctness guarantee (Risk 6) that later billing and reporting consume. In this phase the mechanism and its guarantees are delivered and test-proven; the flow that binds calculations to customer bills arrives with the ordering features.
- **Audit Record** (feature 002, extended): the append-only trace of sensitive actions; this phase adds tax rule and override changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner can configure a restaurant's complete tax setup — rules at all three scopes, an explicit order including a compound pair, and one branch override — in a single session in under 15 minutes with no operator intervention.
- **SC-002**: 100% of unauthorized attempts are denied at the trusted data layer — wrong role (branch manager, cashier, kitchen, super admin), wrong branch, other restaurant, and direct data-access attempts.
- **SC-003**: 100% of invalid inputs are rejected with a clear message and leave no partial or contradictory state: blank and duplicate rule names, malformed, negative, and out-of-bound rates, and cross-restaurant scope references.
- **SC-004**: 100% of the calculation-matrix cases (§16: no taxes, one subtotal tax, multiple taxes, compound taxes, item-level, category-level, mixed scopes, branch overrides, ordering changes) produce exactly the hand-calculated expected lines in the expected order, and re-running any case produces identical results (0% nondeterminism).
- **SC-005**: 100% of recorded snapshots remain unchanged after later configuration changes (0% historical drift); no surface presents a current rule's state as a past record's value.
- **SC-006**: 100% of accepted tax changes — rules and overrides — exist in the audit store with actor, action, resource, change, and scope.
- **SC-007**: The seeded development database demonstrates the phase's journey — multi-scope rules, a compound pair, a branch override, and a deterministic calculation preview — with zero manual data setup.
- **SC-008**: Configuration reads and calculation previews respond within 2 seconds for a realistic setup (up to 25 rules across all scopes against a 200-item menu) — baseline target; tuning beyond it belongs to the performance phase, master plan §26.

## Assumptions

- **Branch managers maintain their own branch's overrides** — replacement rates and branch-only rules — mirroring feature 005's availability-override precedent, while restaurant-level rules remain owner-maintained (confirmed in the 2026-09-19 clarification session). Branch managers manage no restaurant-level configuration. *(The alternative — owners maintain every branch's overrides — was considered and rejected.)*
- **Rule names are unique within the restaurant across restaurant-level and branch-level rules** (case-insensitive, trimmed), following feature 005's category-name precedent; a branch-only rule sharing a default rule's name would make lines ambiguous to staff.
- **Rounding is per line, once, half-up, at the end of that line's own calculation** — the single documented rule; intermediate values are never rounded, and the total is the exact sum. (The bound details — maximum rate, decimal places — are fixed in the plan's research, within the spec's requirement that a documented bound exists and is enforced.)
- **Whether a rule compounds on earlier taxes is part of that rule's configuration** (explicit per rule), not a global mode; §16's "compound calculation" and "explicit calculation ordering" are read together as ordered application where a compounding rule's base includes the amounts of the earlier-applied rules its configuration names.
- **One currency for the V1 platform** (feature 005's clarified rule); tax amounts are exact two-decimal amounts in that currency, and per-restaurant currency remains an additive later change.
- **A calculation result becomes a snapshot only when bound to a customer bill**; the staff preview this phase exposes is read-only and records nothing. The snapshot mechanism, its once-only recording, and its immutability are delivered and test-proven here; the binding flow arrives with features 007/008.
- **Rate changes are manual and immediate** — no effective-dating, scheduled changes, or retroactive recalculation of past bills; snapshots preserve history instead. Time-based tax scheduling would be an additive specification.
- **Taxes apply to item base prices plus their selected extras' adjustments** (confirmed in the 2026-09-19 clarification session): an item- or category-scope tax's base is the item's price and its selected extras as one amount, and the base price itself remains before tax (feature 005 FR-010 continuity).
- **The tenancy and role model is untouched**: no new tenancy entity, no new role, no change to the staff membership model of features 002–005; tax data hangs off the restaurant with branch-scoped overrides only.
- **Audit records remain write-only in this phase** (feature 002 FR-012/FR-013 continuity): this phase produces tax-configuration records; reading and presentation arrive with the audit feature.
- **The canonical workflow continues**: schema changes flow through migrations, generated data-access types are regenerated, the development seed stays idempotent and deterministic, and the existing test tiers are extended rather than replaced (FR-024).

## Out of Scope

The following are explicitly out of scope for Phase 5 and belong to later phases per the master plan's feature decomposition (§10) and V1 boundary (§3.1–§3.2):

- The customer-facing tax presentation — the public menu and bill surfaces that show tax lines to customers — feature `007-customer-access-and-session` and the ordering features; this phase delivers the staff preview (FR-014).
- Binding calculations to bills, session price/tax locks, and the ordering flow — features `007-customer-access-and-session` and `008-cart-and-rounds`; this phase delivers the snapshot mechanism they consume (FR-016).
- Online payment, accounting, invoice printing, and bill splitting — §3.2 excludes them from the roadmap entirely; tax amounts here are order-collection data, never a financial system (Constitution I).
- Tax remittance, filing, tax-authority reporting, and exemption certificates — accounting-adjacent, excluded by §3.2 and Constitution I.
- Discounts, coupons, and promotions, and any tax interaction with them — §3.2 excludes discounts from V1.
- Service charges, cover charges, tips, and gratuity rules — not in the master plan's V1 scope; only taxes are named (§16).
- Tax-inclusive menu price presentation (whether customer menus show prices with tax included) — feature 005 delivers base prices; the customer display decision belongs to feature `007-customer-access-and-session`.
- Multiple currencies and per-restaurant currency settings (feature 005 clarification continuity).
- Realtime propagation of tax changes to already-open screens — feature `012-realtime-and-notifications`; this phase guarantees current configuration on each calculation (FR-015).
- Tax-rule effective-dating, scheduled changes, and retroactive recalculation of recorded results — snapshots preserve history; scheduling would be additive.
- External tax-service integrations and jurisdiction databases — outside the platform scope.
- The audit viewing, search, and retention experience — a later feature (master plan §37); audit records are write-only here (FR-021).

