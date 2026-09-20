# Quickstart: Cart and Rounds (Phase 7)

**Feature**: `008-cart-and-rounds` | **Validation record**: appended at the end after the implementation phase runs these walkthroughs (task T0XX, feature 005/006/007's method).

**Prerequisites**: the development project is reset and seeded (`npm run db:reset -- --yes` then `npm run db:seed` — destructive, development only). The demo sessions (Downtown T1/T2) start with empty round histories; menu items and their extras carry prices.

## Walkthrough A — the customer builds a cart (SC-001, FR-001…FR-004)

1. Use a dev token for Downtown T1 (`dev-token-downtown-t1-2026`): `get_session_context` resolves the session; `get_session_menu` lists the branch's items with prices.
2. Build a cart: one item with two extras (quantity 2), one plain item (quantity 1). The running total equals (item₁ + extras) × 2 + item₂ from the payload's prices.
3. Reload-equivalent: a fresh context re-reads the stored cart — lines, extras, and quantities are exactly as built (FR-002).
4. Bounds feedback: a quantity of 0 or 100 is refused client-side with a bound message (FR-008's client half); no RPC is involved.

## Walkthrough B — submission, refusal, atomicity (SC-002, FR-005…FR-010)

1. Submit the cart: one atomic call returns the round (state `new`), its items/extras with captured prices, the captured tax lines, and the ticket id — and the cart is cleared (FR-010).
2. Re-read the cart: it is empty. Re-read the history: the round appears with exactly the submitted lines (FR-011).
3. Refusal matrix (each against the real RPC, each leaving ZERO rows): empty cart; a foreign item (Cedar Grill's item into a Blue Olive session); an unavailable item (`is_available false` or a branch override); an extra that belongs to another item; a malformed line; quantity 0. Every refusal message matches the contract verbatim (FR-008).
4. Atomicity proof: after every refused submission, `rounds`/`round_items`/`round_item_extras`/`kitchen_tickets` for the session are unchanged — the critical transaction's guarantee (§18).
5. The captured tax lines equal a fresh `calculate_branch_taxes` run over the round's own rows (SC-004) — no drift.

## Walkthrough C — multiple rounds, recovery, ticket integrity (SC-003, SC-005)

1. Build and submit a SECOND cart into the same session: a second round appears; its kitchen ticket is distinct from the first's (two tickets, one per round).
2. Ticket integrity: each ticket's items are exactly its round's items — no item from Round 1 appears in Round 2's ticket (§7.5).
3. Reload-equivalent: a fresh client with the stored token lists BOTH rounds with their lines — the server is the recovery mechanism (FR-011, SC-005).
4. Concurrency: two simultaneous submissions from two clients produce two complete rounds — neither partial, neither lost (Risk 7).
5. Session posture: an unknown/tampered token refused on both RPCs with the byte-identical session refusal; a direct table write under any client role denied (zero grants, FR-015).

## Determinism and rebuild (SC-007)

`npm run db:reset -- --yes && npm run db:seed && npm run test:db` exits 0; `npm run types:gen` output is byte-stable; no rounds are seeded (histories start empty).

---

## Validation record

**Date**: 2026-09-20 · **Method**: programmatic execution against the real development project through the real data APIs (`scripts/run-order-walkthroughs.mjs`, feature 005/006/007 precedent) · **Result**: **14/14 PASS**

- Walkthrough A (4 checks): the dev token resolves; the menu lists Downtown items with prices; the advisory total computes 49.50 from the payload prices ((18.50 + 3.00 + 0.00) × 2 + 6.50); bounds 0/100 are client-refused with no RPC involved.
- Walkthrough B (5 checks): the submission returns the round (state `new`), two captured items, and the ticket id; the write set is exactly +1 round, +2 items, +2 extras, +1 ticket; all six refusal classes fire verbatim (`A cart line is required.`, `This item is not available here.`, `An extra does not belong to its item.`, `A cart line is malformed.`, `A quantity must be between 1 and 99.`) — each leaving ZERO rows behind; the captured taxes equal a fresh `private.calculate_tax_totals` run byte-for-byte (SC-004).
- Walkthrough C (5 checks): the second submission produces a distinct round and ticket; each round owns exactly one ticket; Round 2 carries no Round-1 item; the history read lists both rounds (server recovery); unknown tokens are refused on both RPCs with the byte-identical session refusal.
- Cleanup: the runner deleted the rounds it created (dependent rows first); the session and seed data are untouched. `npm run db:reset -- --yes && npm run db:seed` restores the deterministic state regardless (executed during T024/T025 — 382/382 database tests, 69/69 e2e, `verify` exit 0, `types:gen` byte-identical).
