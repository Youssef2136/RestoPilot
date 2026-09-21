# Quickstart: Realtime and In-App Notifications (Phase 11)

**Spec**: [spec.md](spec.md) | **Validation**: `scripts/run-realtime-walkthroughs.mjs`

Prerequisites: the deterministic fixture (`npm run db:reset -- --yes && npm run db:seed`), two staff sign-ins ready (carla — Downtown cashier, dan — Marina kitchen), one customer path (the seeded dev token).

## Walkthrough A — the cashier's live dashboard (SC-001)

1. Sign in as **carla** in browser 1; open `/dashboard/rounds` (Downtown).
2. In browser 2 (or the walkthrough script), submit a round through the REAL customer path (`submit_round` on the Downtown dine-in token).
3. Within the realtime interval, the round appears in carla's "incoming" group WITHOUT a manual refresh.
4. Advance the round (accept) in browser 2 → the card moves groups live in browser 1.
5. Void a locked round as carla in browser 2 (a second cashier context) → the voided display state lands live in browser 1.

## Walkthrough B — the kitchen's live queue (SC-002)

1. Sign in as **dan** in browser 1; open `/dashboard/kitchen`.
2. Submit a round on dan's branch (Marina dine-in token) in browser 2 → the ticket appears live, money-free.
3. Advance the ticket (start → ready) in browser 2 → the queue updates live. The page text contains NO money words (SC-002's browser assertion).

## Walkthrough C — recovery and the cue (SC-004, US4)

1. With carla's dashboard open, reload the page → the load path renders authoritative state (the recovery proof in its browser shape).
2. Submit a new Downtown round → the dashboard shell's live cue ("A new order arrived.") appears without navigation; it clears when the round is accepted.

## Walkthrough D — the customer's live-adjacent status (US3)

1. Open the customer menu surface with the Downtown dine-in token in browser 2.
2. Submit an order; within 10 seconds the customer's status advances without manual action (the poll cadence — research §3's resolution).

## Scope assertions (FR-002/FR-003)

- **fiona** (no memberships) subscribed to `rounds` receives no events (the policy matches nothing) — asserted structurally in the database suite.
- The publication carries exactly the five intended tables — no superset.

## Restore

`npm run db:reset -- --yes && npm run db:seed` — the walkthroughs mutate the fixture; the restore returns the deterministic state.

---

## Validation Record

**Date**: 2026-09-21 · **Method**: programmatic execution against the real development project through the real data APIs (`scripts/run-realtime-walkthroughs.mjs`) · **Result**: **9/9 PASS** — Walkthrough A (carla's Downtown INSERT subscription receives a real customer submission live; the read renders the announced round with its captured line; the accept arrives as a live UPDATE event with the read agreeing); Walkthrough B (dan's Marina `kitchen_tickets` subscription receives the new scratch-session ticket live, the `get_kitchen_queue` read agrees and stays money-free, and no out-of-scope event ever arrives); Walkthrough C (the SUBSCRIBED moment triggers the recovery refetch through the unchanged read — FR-004 — and the cue's clear event lands on the round's first state advance); Walkthrough D (fiona, no memberships, subscribed live with her own JWT, receives NOTHING while real submissions commit — the fail-closed direction proven live). Every subscription awaited the SUBSCRIBED handshake before writes were driven (the same test-race discipline the e2e suite's `waitForCueSubscribed` encodes); the fixture was restored afterwards (`npm run db:reset -- --yes && npm run db:seed`); `test:db` 446/446 green on the restored state.
