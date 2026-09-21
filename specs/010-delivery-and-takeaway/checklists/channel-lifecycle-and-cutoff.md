# Checklist: Channel Reuse and Cutoff Correctness (Phase 9)

**Purpose**: Validate requirements quality for the reuse principle and the cutoff mechanics (master plan §20's "do not create a separate order engine"; the cutoff is the phase's riskiest behavior).

**Created**: 2026-09-20

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

**Ownership note**: reviewer-owned requirements-quality artifact. The agent maintains `checklists/requirements.md`; this checklist is left unchecked for the human gate (the 005–009 convention).

## Reuse

- [ ] No second money path: delivery/takeaway rounds capture through the same tax core
- [ ] No second ticket path: kitchen tickets identical across channels
- [ ] No second audit path: the same `private.record_audit` with two new actions
- [ ] No dine-in regression: the 007/008/009 suites pass unchanged

## Cutoff correctness

- [ ] The delivery cutoff fires on the FIRST out-for-delivery round, not on session close
- [ ] The takeaway cutoff fires on the FIRST ready round
- [ ] Dine-in is never cutoff-refused
- [ ] Cutoff refusals preserve the token and the cart
- [ ] Existing rounds still move after the cutoff; staff modify still works

## Lifecycle extension

- [ ] The two new transitions are delivery-only, cashier-reach-only, kitchen-denied
- [ ] Backward/skip/repeat/terminal all refuse with zero change
- [ ] The ticket machine does NOT extend past `ready`
- [ ] `lock` is never reachable for delivery/takeaway rounds

## Data integrity

- [ ] The address is set once, never updated by any RPC
- [ ] The DB enforces the address presence for delivery sessions
- [ ] The kitchen queue carries no address and no money keys
