# Implementation Plan: Delivery and Takeaway (Phase 9)

**Branch**: `010-delivery-and-takeaway` | **Spec**: [spec.md](spec.md) | **Created**: 2026-09-20

## Summary

One schema/RPC migration + thin surface extensions. The session `type` check widens
(`dine-in`/`delivery`/`takeaway`); a NEW `open_session_channel` RPC handles non-dine-in
entry (name/phone + optional address — no table); `submit_round` gains the channel
cutoffs (delivery: any round `out_for_delivery`/`completed`; takeaway: any round
`ready`+; dine-in: never) with two new customer-facing messages; the round state check
widens (`out_for_delivery`, `completed`) with two cashier-only transitions audited
`round.out_for_delivery`/`round.completed` — delivery sessions only; the staff reads and
session payloads carry `type` (+ address on cashier/bill surfaces only). The money, tax,
ticket, and audit machinery is UNTOUCHED — only channel-specific behavior varies (§20).

## Constitution trace

| Principle | How this plan honors it |
|---|---|
| I. No payment | Cutoff = ordering gate; no bill/payment vocabulary |
| II. One money math | Zero changes to pricing/tax/capture — the widened core is untouched |
| III. RLS + RPC gateway | New RPC reuses the 007 definer posture; zero direct-table grants |
| IV. Identity server-side | Cutoff and transitions derive everything from tokens/JWT |
| VI. Audit | Two new audited actions through `private.record_audit` |
| Reuse (§20) | Sessions/rounds/pricing/tax/kitchen/cashier/audit all reused |

## Research decisions

See [research.md](research.md). Key: the cutoff reads round states at submission time
(deterministic, test-provable — no wall-clock scheduling); the entry RPC is NEW (not an
overload of `open_session_at_table`) so the dine-in contract stays byte-stable; tickets
never extend past `ready` (the kitchen's world is channel-blind).

## Data model

See [data-model.md](data-model.md). Widened checks: `sessions_type_check`,
`rounds_state_check`; new column `sessions.delivery_address` (nullable, bounded, set
once); no new tables.

## Contracts

- [contracts/database-functions.md](contracts/database-functions.md) — `open_session_channel`, the cutoff in `submit_round`, the two transitions, read-shape additions
- [contracts/session-client.md](contracts/session-client.md) — channel entry, cutoff error mapping, address display

## Quickstart

[quickstart.md](quickstart.md) — three walkthroughs: the delivery journey end-to-end,
the takeaway cutoff, and the channel-awareness of the staff surfaces.

## Project Structure

```
supabase/migrations/<ts>_channel_schema.sql     # checks, address column, RPCs
src/features/session/                           # entry channel choice, cutoff mapping
src/features/order/                             # cutoff mapping on submit
src/features/staffOps/                          # channel labels + 2 cashier transitions
src/routes/                                     # entry flow + cashier buttons
e2e/session.surfaces.test.ts                    # channel e2e blocks
tests/database/channel.{schema,rpc}.test.ts     # the matrix suites
```
