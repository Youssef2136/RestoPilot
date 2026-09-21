# Quickstart: Bill, Void, and Audit (Phase 10)

**Feature**: `011-bill-void-and-audit` | **Validation record**: appended at the end after the implementation phase runs these walkthroughs (the 005–010 method).

**Prerequisites**: the development project is reset and seeded (`npm run db:reset -- --yes` then `npm run db:seed` — destructive, development only).

## Walkthrough A — the bill as the accounting display (SC-001, FR-001/FR-002)

1. Dine-in entry at Downtown T1 (dev token), submit a round with the lamb kebab + one extra.
2. As **carla**: accept → preparing → ready → lock.
3. `get_session_bill`: per-round lines with name/quantity/unit price/extras, the captured tax lines by name and amount, `participants` listing the session's customer, and the grand total byte-identical to the captured values.

## Walkthrough B — void with reason (SC-002, SC-003, SC-005, FR-004…FR-008)

1. A second dine-in round at T1, driven to `lock`.
2. Void it as **carla** with reason "Guest left — order cancelled": success; `voided/voided_at/void_reason` set; the ticket mirrors `voided`.
3. The bill: the voided round's money is EXCLUDED from the grand total and listed in the voided section with the reason (SC-002).
4. Audit: exactly one `round.void` row with actor, target round, and the verbatim reason (SC-003).
5. Refusals: empty reason → `'A void reason is required.'`; 501-char reason → `'A void reason may be at most 500 characters.'`; voiding an in-flight (`new`) round → the generic refusal; repeat void → generic refusal; **dan** and **fiona** → `42501` — every refusal with zero rows changed (SC-005).

## Walkthrough C — the audit trail (SC-004, FR-009/FR-010)

1. As **alice** (owner): `get_audit_log` returns the restaurant's entries newest-first — the walkthrough's `round.void` carries the reason; actor display names resolve; branch labels render.
2. Filter `p_action = 'round.void'` → only the void rows; filter by Marina's branch as **bob** (Downtown manager) → only Downtown entries; **bob** asking for Marina → `42501`.
3. **carla** and **dan** call the read → `42501` (the trail is management-level).

## Restore

`npm run db:reset -- --yes && npm run db:seed` — the walkthroughs mutate the fixture; the restore returns the deterministic state.

---

## Validation Record

**Date**: 2026-09-21 · **Method**: programmatic execution against the real development project (`scripts/run-billvoid-walkthroughs.mjs`) · **Result**: **13/13 PASS**

- Walkthrough A (the void overlay): 6/6 — blank and 501-char reasons refused verbatim; the boundary void succeeds with `state` UNCHANGED (`lock`) and the ticket mirrored; the repeat void and the just-below (`ready`) attempt refuse generically with zero change.
- Walkthrough B (the bill): 2/2 — the bill carries the void flags, the per-line detail, and the participants; the grand total equals the non-voided sum exactly, with the voided money accounted for in the exclusion proof (no hardcoded tax assumption — the captured figures decide).
- Walkthrough C (the audit trail): 5/5 — the owner sees the `round.void` entries with reasons and resolved actor names; the Downtown manager sees his branch; the foreign-branch filter, carla/dan reads, and dan's void attempt all refuse verbatim (`42501`) with zero change.
- Deterministic state restored afterwards per the Restore section (reset → seed → 436/436 database tests green, `types:gen` byte-identical).
