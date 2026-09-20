# Specification Quality Checklist: Cart and Rounds (Phase 7)

**Purpose**: Validate specification completeness and quality before proceeding to planning

**Created**: 2026-09-20

**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Acceptance criteria are measurable
- [x] Scope is clearly bounded (out of scope lists Phase 8/9/012 surfaces explicitly)
- [x] Dependencies and assumptions documented (round states → Phase 8; realtime → 012; taxes → the 006 engine)

## Consistency

- [x] Terminology consistent ("round", "kitchen ticket", "cart", "price snapshot" used uniformly)
- [x] Entities match the master plan's data inventory (§6.5/§6.6: rounds, round items, round item extras, kitchen tickets, ticket items)
- [x] No contradiction with earlier features (007's session posture, 006's engine, 005's menu — all consumed, none redefined)

## Potential Risks Readiness

- [x] Risk 6 (price/tax drift) addressed: captured prices + recomputable tax lines (FR-005, FR-016, SC-004)
- [x] Risk 7 (concurrency) addressed: the single-transaction submission, refusal-with-zero-side-effects matrix, double-submit posture (FR-005, FR-008, FR-009)
- [x] Constitution alignment checkable: no payment/accounting concepts (I), composite tenancy (III), zero client grants + RPC-only writes (IV), DB as truth with client cart advisory (V), closed shapes (VI), customer actions unaudited per the 007 posture (VII), zero new dependencies (VIII)

## Validation Results

- [x] All 18 FRs are MUST/SHOULD statements with testable outcomes
- [x] All 7 SCs are measurable
- [x] 4 user stories with independent tests; P1 pair covers cart + submission (the phase's core)
- [x] Edge cases cover the master plan's critical-transaction failure modes (§18)

**Notes**: The spec intentionally defers round state transitions, kitchen surfaces, bills, and realtime to their own features — each deferral is cited to the master plan's section or the recommended implementation order.
