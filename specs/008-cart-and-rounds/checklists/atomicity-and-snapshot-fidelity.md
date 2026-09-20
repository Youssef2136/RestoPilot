# Checklist: Critical-Transaction Atomicity and Snapshot Fidelity (Phase 7)

**Purpose**: Validate requirements quality for the two highest-risk clusters of this feature (master plan Risk 7: concurrent actions corrupt order state; Risk 6: price/tax drift).

**Created**: 2026-09-20

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

**Ownership note**: reviewer-owned requirements-quality artifact. The agent maintains `checklists/requirements.md`; this checklist gates the implement step (every item must be `[x]` before implementation begins or carry an explicit reviewer decision).

## Atomicity (Risk 7 — the critical transaction)

- [ ] CHK001 — Does the spec state that EVERY refusal class leaves zero rows in all four tables (not merely "nothing created")?
- [ ] CHK002 — Is the failure ordering explicit (session → shape → availability → extras → taxes → writes) so partial work is structurally impossible?
- [ ] CHK003 — Is the concurrent-submission case specified to produce independent complete rounds (never shared state)?
- [ ] CHK004 — Is the double-submit client guard specified as presentation-only (the server remains correct without it)?
- [ ] CHK005 — Does the ticket's one-per-round invariant have a named structural enforcement (a unique index), not a procedure?

## Snapshot fidelity (Risk 6 — price/tax drift)

- [ ] CHK006 — Is every captured value enumerated (unit price, adjustment, subtotal, tax lines) with its capture moment?
- [ ] CHK007 — Is the tax capture delegated to the one canonical engine (no re-implementation)?
- [ ] CHK008 — Is the recompute cross-check a stated success criterion (captured == recomputed)?
- [ ] CHK009 — Is the round's display-name join at read time explicitly distinguished from captured prices (names live, money frozen)?
- [ ] CHK010 — Are captured money columns typed as fixed-point numerics end to end (no float boundary)?

## Validation & refusal vocabulary

- [ ] CHK011 — Does every refusal class have a specific message quoted in the contract (no generic failures on the money path)?
- [ ] CHK012 — Is the session refusal byte-identical with feature 007's (one vocabulary across the customer experience)?
- [ ] CHK013 — Are client-side bounds labeled as feedback only, with the server authoritative?

## Posture & boundaries

- [ ] CHK014 — Is the zero-grant posture stated for all four tables (RLS enabled, no policies, no grants)?
- [ ] CHK015 — Is the audit posture explicit (customer submissions unaudited; the round is the trace)?
- [ ] CHK016 — Are Phase 8/012 deferrals named with their owning features (state transitions, kitchen surfaces, realtime)?
- [ ] CHK017 — Is the cart's advisory status explicit (never authoritative, re-validated at submission)?
- [ ] CHK018 — Is the cleared-cart-on-session-end rule consistent across spec, contract, and plan?

## Traceability

- [ ] CHK019 — Does every FR map to at least one acceptance scenario or edge case?
- [ ] CHK020 — Does every SC have an automatable proof named (suite or walkthrough step)?
