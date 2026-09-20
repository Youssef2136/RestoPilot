# Checklist: Round Lifecycle Concurrency and Money Re-derivation (Phase 8)

**Purpose**: Validate requirements quality for this feature's two highest-risk clusters (master plan Risk 7: concurrent actions corrupt order state; Risk 6: price/tax drift — both now live in the state machine and the modification path).

**Created**: 2026-09-20

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

**Ownership note**: reviewer-owned requirements-quality artifact. The agent maintains `checklists/requirements.md`; this checklist gates `implement` until each item is consciously approved (the 006/007/008 convention).

## State machine integrity (Risk 7)

- [ ] CHK001 — Is every illegal transition class enumerated (skip, backward, repeat, terminal, unknown id) with ONE indistinguishable refusal rather than per-class errors?
- [ ] CHK002 — Is the concurrency winner rule specified (first matching guard wins; loser refuses) with the race proven, not just asserted?
- [ ] CHK003 — Is round↔ticket state sync specified as one transaction (never independently mutable)?
- [ ] CHK004 — Is `lock` specified as terminal with no exceptions (including staff ops)?
- [ ] CHK005 — Are kitchen's action boundaries explicit both ways (what kitchen MAY do; what is denied even server-side)?

## Money re-derivation (Risk 6)

- [ ] CHK006 — Is the modification re-derivation specified to use CAPTURED prices (not menu-current) so historical rounds don't re-price?
- [ ] CHK007 — Is the engine-core reuse named (one canonical money math) with a byte-equality check against a fresh calculation?
- [ ] CHK008 — Is the modification's atomicity specified (line change + money update + audit in one transaction, all-or-nothing)?
- [ ] CHK009 — Is the audit reason format specified (before→after) so the log reads as a history, not just an event list?
- [ ] CHK010 — Is the zero-rows guarantee carried from Phase 7 (every refusal leaves the write set untouched)?

## Scoping & tenancy

- [ ] CHK011 — Is every read scope derived from the identity (no client-supplied scope accepted anywhere)?
- [ ] CHK012 — Is the cross-branch kitchen case explicit (dan at Marina cannot reach Downtown rounds or actions)?
- [ ] CHK013 — Is the dual-membership case covered (eve: cashier at Blue Olive, owner at Cedar Grill — each scope evaluated separately)?
- [ ] CHK014 — Is the no-membership case covered (fiona denied everywhere, including reads)?

## Payload discipline

- [ ] CHK015 — Is the kitchen payload specified as money-free with the ABSENCE testable at the contract level?
- [ ] CHK016 — Is the bill aggregation specified as display-only arithmetic over captured values (never recomputation)?
- [ ] CHK017 — Are the post-action payloads specified (FR-008) so the dashboards render server truth without a second read?
- [ ] CHK018 — Is the customer surface's non-involvement explicit (no new anon surface; customer reads stay unaudited)?

## Out-of-scope discipline (Constitution I / Risk 8)

- [ ] CHK019 — Are void, bill editing, discounts, payment, stock management, and the realtime transport all named out of scope with their owning phase (10/12)?
- [ ] CHK020 — Does the spec avoid inventing state transitions beyond the master plan's five (no cancelled/served/refunded)?

*All 20 items intentionally unchecked — the implement gate asks the reviewer to approve them.*
