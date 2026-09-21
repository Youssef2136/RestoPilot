# Research: Bill, Void, and Audit (Phase 10)

Created 2026-09-21 · resolves the design questions the spec and plan depend on.

## 1. Void as a flag, not a state

The `rounds.state` machine (`new → accepted → preparing → ready →
out_for_delivery → completed / lock`) is terminal-closed and every 008–010 RPC
guards on it. Making `voided` a state would (a) require widening every check
constraint and guard in three migrations' worth of code, (b) create bogus
"transitions" (completed → voided) that the master plan never asked for, and
(c) entangle the cutoff logic (a voided completed delivery round must STILL
block new orders — FR-011). Instead: a `voided` flag + `voided_at` +
`voided_by_profile_id`, set in one guarded update that also requires the
state to be at the channel's void boundary. The lifecycle is untouched; the
void is a business overlay, which is exactly what §21's "separate void
record" describes.

## 2. The void boundary per channel

`lock` (dine-in), `out_for_delivery`/`completed` (delivery), `ready`/`lock`
(takeaway) — the same states where each channel's session cutoff fires. The
rationale: "post-billing" means the operational flow has finished with the
round (§21's bill is a display, so payment-time is represented by the
terminal states). The boundary is enforced in the RPC's `where` clause as a
channel-derived predicate — one guarded update, race-safe by the 009
mechanism (`row_count = 0 ⇒ generic refusal`).

## 3. The bill payload extension — additive only

`get_session_bill` (20260920150500) currently returns `{ session_id,
session_type, delivery_address, table_label, rounds[{round_id, state,
subtotal, tax_total, tax_lines, created_at}], grand_total }`. The extension
adds keys WITHOUT changing existing ones (the strict clients of 008/010 parse
additively): each round gains `items[]` (name, quantity, unit_price, extras[]
with captured adjustments — the same shape `get_branch_rounds` already
surfaces) and `voided`/`void_reason`; the top level gains `participants[]`
(id, display_name, joined_at). The `grand_total` becomes the sum over
NON-voided rounds only — a behavior change that is the spec's FR-003 (the
bill IS the corrected display; no client of the old shape depended on
voided-inclusive totals because no void existed).

## 4. The audit read — who sees what

`audit_log` carries `restaurant_id` + nullable `branch_id`. §21 wants the
trail inspectable; 009's read posture (silent `[]` filtering) is the
precedent:
- **Owner** (`m.role = 'owner'`, branch_id null): the whole restaurant.
- **Branch manager** (branch-scoped membership): their branch only. A
  manager of TWO branches gets both (the union of memberships) — the same
  union rule `get_branch_open_sessions` uses.
- **Cashier / kitchen / anon / fiona**: `42501` (the spec's FR-010 gate) —
  §21 makes the trail management-level; the spec's clarification (carla
  denied) matches the existing role vocabulary.
Filters: `p_action` (exact operation, nullable = all), `p_branch_id` (must
be within reach — validated, not silently ignored), `p_limit` capped at 200
(a display page, not an export).

## 5. Void permission and the reason rules

`mark_*` posture reused verbatim: `private.ops_profile_id()` + the
`has_branch_role` check with `['cashier','branch_manager']` (owner reach via
the membership-shape check — the same predicate the 009 transitions use).
Reason rules (FR-006): `btrim(reason) = ''` refuses
`'A void reason is required.'`; length > 500 refuses
`'A void reason may be at most 500 characters.'` — stored verbatim on the
audit row (`record_audit`'s `p_reason`) AND on the round's `void_reason`
column (the bill's voided section reads the round, not the log — one
denormalized copy that makes the bill payload self-contained).

## 6. Ticket void mirror

`kitchen_tickets.voided` set in the SAME update transaction as the round
(one plpgsql body, two updates, one audit call). The kitchen queue
(`get_kitchen_queue`) keeps its channel-blindness: it shows tickets by
state; a voided ticket's state is whatever it ended at, and the queue adds
no money/address. The BILL renders the voided ticket alongside the voided
round (FR-008's display half).

## 7. No new state vocabulary on the client

`RoundCard` gains a void control rendered only when `state` is at the
channel boundary AND `voided` is false; the bill's voided section renders
from the payload. No new states to map — the existing `data-round-state`
contract is untouched.
