# Implementation Plan: Bill, Void, and Audit (Phase 10)

**Branch**: `011-bill-void-and-audit` | **Spec**: [spec.md](spec.md) | **Created**: 2026-09-21

## Summary

The accounting-display boundary closes: the session bill becomes the complete
display of captured money (per-line detail, captured tax lines, participants)
with a voided section excluded from totals; a server-side void RPC
(boundary-checked per channel, permission-checked, mandatory reason, audited
`round.void`, zero destructive writes) marks rounds voided; and an
owner/branch-manager audit read makes the trail inspectable. No payment,
splitting, discount, or printing concepts anywhere.

## Technical Context

**Language/Stack**: TypeScript + React 19 (Vite) frontend; PostgreSQL 17 via
Supabase (hosted cloud, pooled session mode) — identical to Phases 005–010.

**Storage**: Two schema additions on `public.rounds` (`voided boolean not null
default false`, `voided_at timestamptz`, `voided_by_profile_id uuid`) plus
`public.kitchen_tickets.voided boolean not null default false` (the ticket's
void mirror — set in the same transaction as the round). One new RPC
`void_round(p_round_id uuid, p_reason text)`; the existing
`get_session_bill` extended in place (line detail + participants +
voided-section exclusion); one new read `get_audit_log(...)` over the existing
append-only `public.audit_log`.

**State model**: Voiding does NOT change `rounds.state` — the lifecycle
columns are frozen at their terminal values; the void is a separate flag +
audit record. The cutoff logic in `submit_round` reads `state` only, so
FR-011 (void does not resurrect the cutoff) holds without touching that code.

**Existing infrastructure reused** (no new engines):
`private.record_audit` (7-arg), `private.ops_profile_id()`,
`private.has_branch_role(...)`, the 009 refusal vocabulary, the 007 result
discipline on the client, react-query hooks with invalidation-only writes.

**New components**:
- `supabase/migrations/<ts>_bill_void_audit.sql` — schema + RPCs + grants
- `tests/database/bill.void.audit.test.ts` — the matrix
- `src/features/audit/` — the audit client + hooks + `AuditLogPage`
- `src/features/staffOps/` extensions — the void client/hooks, the bill's
  line-detail/voided rendering, the RoundCard void control
- `e2e/bill.void.test.ts` — the browser journeys

**Risks** (from the master plan and 005–010 experience):
- Pooled session mode: no concurrent-connection interleaving in tests — the
  suites prove the sequential winner/loser posture (the 008/009 precedent).
- The bill extension must NOT change the existing bill shape in a breaking
  way — additive keys only (the 008/010 client parse strictness).
- Void marking on tickets must be transactional with the round (one body).

## Constitution Check

| Principle | Status |
| --- | --- |
| I | No payment/bill/accounting PROCESSING — the bill is display-only; the POS boundary is restated in the spec | PASS |
| II | All money math server-side, captured values verbatim — the bill payload computes nothing | PASS |
| III | Multi-tenant isolation — the audit read is branch/restaurant-scoped through `has_branch_role`; the void RPC re-checks the round's tenant | PASS |
| IV | Audit for every mutation — `round.void` audited with the mandatory reason; the trail is now readable | PASS |
| V | No optimistic writes — invalidate-only react-query posture (the 008/009 client discipline) | PASS |
| VI | Rows never deleted — void marks, never removes | PASS |
