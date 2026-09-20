# Specification Quality Checklist: Kitchen and Cashier Operations (Phase 8)

**Purpose**: Validate specification completeness and quality before proceeding to planning

**Created**: 2026-09-20

**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No `[NEEDS CLARIFICATION]` markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded (Phase 10 owns bill/void; Phase 12 owns the realtime transport; stock management is out of scope per §19)
- [x] Dependencies and assumptions identified (Phase 7 substrate, Phase 3 RBAC, Phase 2 audit, §5.4 realtime posture)

## Constitution Alignment (review pass)

- [x] No payment/bill-splitting/discount/tip concept enters the spec (Constitution I — the bill panel is display-only aggregation)
- [x] Money re-derivation is specified through the single canonical engine core (Constitution II — FR-007)
- [x] Tenancy scoping is specified for every read and action (Constitution III — FR-005)
- [x] Zero-grant RPC-only posture is named as a constraint (Constitution IV — FR-011)
- [x] The database remains the source of truth; realtime is transport-only (Constitution V / §5.4 — FR-013)
- [x] State shapes are closed and terminal states are specified (Constitution VI — FR-001)
- [x] Staff operational actions are audited; customer actions remain unaudited (FR-012, US4)

## Unresolved / Deferred

- [x] None blocking — realtime transport wiring (FR-013) is explicitly deferred to Phase 12 by the master plan's own architecture; this phase ships database truth + refetch

**Validation**: the three material product decisions (kitchen sees `new` immediately; the cashier modification rule; lock semantics and actors) were resolved through the clarification session recorded in spec.md and are encoded in the FRs. No markers remain.
