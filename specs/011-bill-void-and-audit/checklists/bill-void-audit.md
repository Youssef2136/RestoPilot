# Checklist: Void Integrity and Display Correctness (Phase 10)

**Purpose**: Validate requirements quality for this phase's two highest-risk clusters: the void's irreversibility/auditability (a money-adjacent business operation) and the bill's correctness as the accounting display.

**Created**: 2026-09-21

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

*Reviewer-owned: these stay unchecked for the human reviewer (the 005–010 convention). The agent verifies them through the test suites but does not check the boxes.*

## Void integrity

- [ ] CHK-1: Is every void-refusal path proven to leave ZERO rows changed (state, void columns, ticket mirror, audit count)?
- [ ] CHK-2: Is the void boundary exactly the clarified channel set, with a test per channel and per just-below state?
- [ ] CHK-3: Is the mandatory reason enforced server-side (blank AND >500), with the stored value the TRIMMED verbatim text?
- [ ] CHK-4: Is a repeat void (voided round) refused with the generic refusal?
- [ ] CHK-5: Does the void audit row carry actor, timestamp, target round, and the verbatim reason — exactly one row per void?
- [ ] CHK-6: Does voiding leave `state` untouched (the delivery cutoff still fires after a void — FR-011)?
- [ ] CHK-7: Is the ticket mirror transactional with the round void (one RPC body, no partial states)?

## Display correctness

- [ ] CHK-8: Are the bill's per-line figures byte-identical to the captured values (unit prices, extras, tax lines)?
- [ ] CHK-9: Is the grand total the non-voided sum only, with the voided section listing round/reason/totals?
- [ ] CHK-10: Are the participants rendered with NO per-person totals or splitting concepts anywhere?
- [ ] CHK-11: Does the bill payload change remain additive (the 008/010 strict parsers unaffected)?

## Audit access

- [ ] CHK-12: Is the owner's view restaurant-wide (branch_id-null rows included) and the manager's the exact union of their branches?
- [ ] CHK-13: Is a manager's out-of-scope branch filter a 42501 (never silently narrowed)?
- [ ] CHK-14: Are cashier/kitchen/anon denied the audit read?
- [ ] CHK-15: Is `p_limit` clamped and the ordering deterministic (created_at desc, id desc)?
- [ ] CHK-16: Does every mutation vocabulary of 005–010 appear correctly in the trail (no invented actions, none missing from what the RPCs actually write)?
