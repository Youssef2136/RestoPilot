# Quickstart: Delivery and Takeaway (Phase 9)

**Feature**: `010-delivery-and-takeaway` | **Validation record**: appended at the end after the implementation phase runs these walkthroughs (the 005–009 method).

**Prerequisites**: the development project is reset and seeded (`npm run db:reset -- --yes` then `npm run db:seed` — destructive, development only).

## Walkthrough A — the delivery journey end to end (SC-001, FR-001…FR-006)

1. Enter as delivery through `open_session_channel` (Blue Olive/Downtown, name + phone + address): the payload's session `type` is `delivery`, the token works on the menu surface.
2. Submit a round with the dev-token path: state `new`, one ticket `new`, captured money identical to the same item dine-in.
3. As **carla**: accept → preparing → ready → **send out for delivery** → **mark completed**; audit rows `round.out_for_delivery` then `round.completed`; the ticket stays `ready` throughout.
4. `get_branch_rounds` shows `session_type = 'delivery'` + the address; `get_kitchen_queue` shows the items with NO address and NO money keys.

## Walkthrough B — the cutoffs (SC-002, SC-005, FR-007, FR-008)

1. Takeaway: submit a round, drive it to `ready` as carla, then submit again → REFUSED `'Your order is ready for pickup — no additional items can be added.'`; `get_session_rounds` still works (token NOT cleared).
2. Delivery: submit, drive to `out_for_delivery`, submit again → REFUSED `'Your order is already on its way — no additional items can be added.'`
3. Post-cutoff, as carla: `mark_completed` on the out-for-delivery round succeeds; a dine-in session (T1) of the same age still accepts submissions.

## Walkthrough C — channel rules and denials (SC-003, SC-004, FR-002, FR-006, FR-011)

1. Wrong-channel transitions: `mark_out_for_delivery` on a dine-in or takeaway round → the generic refusal, zero state change; `mark_completed` before `out_for_delivery` → generic refusal.
2. Role: **dan** (kitchen, Marina) refuses both new transitions on Downtown; **fiona** is denied everything.
3. Delivery entry without an address → `'A delivery address is required.'`; unknown channel → `'Choose delivery or takeaway.'`
4. Closing a delivery session through the 007 close path works and audits identically.

## Validation Record

**Date**: 2026-09-21 · **Method**: programmatic execution against the real development project (`scripts/run-channel-walkthroughs.mjs`, real sign-ins through the hosted auth) · **Result**: **21/21 checks PASS** — Walkthrough A (delivery journey: entry, submission, the full machine to `completed` with both audit rows, the ticket staying `ready`, the channel-carrying reads, the channel-blind queue), Walkthrough B (both cutoffs verbatim with the token preserved, post-cutoff staff actions, dine-in unaffected), Walkthrough C (wrong-channel/wrong-order refusals with zero state change, dan/fiona denials, the address and channel-entry refusals, the 007 close path on a delivery session). The fixture was restored to the deterministic state afterwards (`npm run db:reset -- --yes && npm run db:seed`).
