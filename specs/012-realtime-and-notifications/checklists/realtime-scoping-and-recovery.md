# Checklist: Realtime Scoping, Authorization, and Recovery (Phase 11)

**Purpose**: Validate the realtime surface against the master plan's four design principles and the security rule.

**Created**: 2026-09-21

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](plan.md)

**Ownership note**: reviewer-owned acceptance artifact. The agent maintains `checklists/requirements.md`; this checklist's `[ ]` items are for the reviewer at the planning/implement gates (the 005–011 convention).

## Principle 1 — the database write succeeds first

- [ ] No realtime event is a prerequisite for any write path (the writes are the unchanged RPCs)
- [ ] The subscription handlers never write

## Principle 2 — realtime communicates the new state

- [ ] Every §3 wire-in invalidates the query keys whose reads the event affects
- [ ] The coalescing window cannot drop the LAST event (the trailing invalidate always fires)

## Principle 3 — refetch recovery

- [ ] `SUBSCRIBED` triggers exactly one refetch of the surface's queries (missed-event recovery)
- [ ] A reload of any dashboard shows authoritative state within the normal load path (SC-004's browser proof)

## Principle 4 + Security — scoped, authorized, non-public

- [ ] The staff SELECT policies exist on the five published tables with the `has_branch_role` predicate (or fail-closed absence where intended)
- [ ] A policy-less/grant-less client receives no events (fail-closed verified structurally)
- [ ] No Broadcast/Presence channel carries private operational data
- [ ] The event payload is never rendered (no money/PII/kitchen state from events — FR-010/FR-003)
- [ ] The publication carries exactly the intended tables (no superset)

## Exit condition

- [ ] Two-browser proof: a write in one appears in the other without manual refresh (SC-001/SC-002)
- [ ] Reconnect proof: the recovery refetch reconciles a missed window (SC-004)
