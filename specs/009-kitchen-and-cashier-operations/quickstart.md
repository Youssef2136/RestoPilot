# Quickstart: Kitchen and Cashier Operations (Phase 8)

**Feature**: `009-kitchen-and-cashier-operations` | **Validation record**: appended at the end after the implementation phase runs these walkthroughs (the 005/006/007/008 method).

**Prerequisites**: the development project is reset and seeded (`npm run db:reset -- --yes` then `npm run db:seed` — destructive, development only). Round histories start empty; Downtown T1/T2 have open demo sessions.

## Walkthrough A — the state machine end to end (SC-001, FR-001…FR-004, FR-012)

1. Submit a round into Downtown T1 through the real customer path (dev token + `submit_round`): state `new`, one kitchen ticket `new`.
2. Accept it as **carla** (Downtown cashier) through `accept_round`: round and ticket `accepted`; one `round.accepted` audit row whose actor is carla's profile.
3. Start preparation as **dan** (kitchen, Marina) on the same round → REFUSED (wrong branch; also kitchen acting on accept is not in dan's set anywhere). Start preparation as **carla** → `preparing` (staff may help across the counter); audit `ticket.preparing`.
4. Mark ready as carla → `ready` (audit `ticket.ready`); lock as carla → `lock` (audit `round.locked`).
5. Terminality: every action (accept/prepare/ready/lock/modify) on the locked round refuses with zero state change and zero new audit rows.

## Walkthrough B — modification, money re-derivation, atomicity (SC-003, FR-005…FR-007)

1. Submit a two-line round (Lamb Kebab ×2 with Extra rice; Hummus ×1) as the token; accept it as carla.
2. Reduce the kebab line to 1 as carla (`modify_round_line` `reduce`): the response carries the re-derived money; a fresh `private.calculate_tax_totals` over the surviving lines is byte-equal (SC-003). One `round.item_quantity_reduced` row with reason `quantity 2 → 1`.
3. Remove the hummus line: money re-derives again; audit `round.item_removed` with `removed 1 × Hummus`.
4. Refusals: reduce to 0 (use remove instead); reduce below 1; modify a `ready` round; kitchen attempting modify (dan). Each refuses verbatim, zero rows changed, one transaction (a forced mid-body failure leaves nothing).
5. Money integrity: the round's captured values equal the engine's — never the menu-current prices (change nothing; the engine is called with captured rows).

## Walkthrough C — dashboards, scoping, bill (SC-004, SC-005, FR-005, FR-008…FR-010)

1. `get_branch_rounds(Downtown)` as carla: the rounds with lines and captured money. As dan (Marina kitchen): Downtown rounds are NOT in his reach; his own queue is Marina's (empty).
2. `get_kitchen_queue(Downtown)` as carla: grouped by state; the payload carries NO money keys (shape-asserted).
3. Bill: `get_session_bill` over T1's session with two rounds — the grand total equals the exact sum of the captured totals (SC-005); no payment concept anywhere.
4. Cross-restaurant: eve (owner Cedar Grill, cashier Downtown) reaches Downtown as staff; fiona (no memberships) is denied both dashboards.
5. Concurrency: accept and prepare the same fresh round in interleaved order — exactly one first transition wins; the loser refuses; state stays consistent (Risk 7).

## Determinism and rebuild (SC-006/SC-007)

`npm run db:reset -- --yes && npm run db:seed && npm run test:db` exits 0; `npm run types:gen` byte-stable; no rounds are seeded (histories start empty).

---

## Validation record

**Date**: 2026-09-20 · **Method**: programmatic execution against the real development project through the real data APIs (`scripts/run-staffops-walkthroughs.mjs`) · **Result**: **24/24 PASS** — Walkthrough A (state machine end to end: submit → accept by carla with the actor-attributed audit, dan's cross-branch refusal, prepare → ready → lock with ticket+audit sync, terminal zero-change refusals); Walkthrough B (two-line round, reduce-to-1 with the re-derived money byte-equal to a fresh `private.calculate_tax_totals` over the surviving captured lines, audit reasons verbatim `quantity 2 → 1` / `removed 1 × Hummus`, refusal vocabulary, captured-price integrity); Walkthrough C (branch-scoped reads with silent `[]` filtering, the money-free kitchen queue shape-asserted, the bill's grand total equal to the exact captured sum, eve's dual-role reach and fiona's denial, the one-winner transition posture). The fixture was restored afterwards (`npm run db:reset -- --yes && npm run db:seed`); `test:db` re-run green on the restored state.
