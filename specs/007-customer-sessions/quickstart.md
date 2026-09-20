# Quickstart: Customer Access and Sessions (Phase 6)

**Feature**: `007-customer-sessions` | **Validation record**: appended at the end after the implementation phase runs these walkthroughs (task T031, feature 005/006's method).

**Prerequisites**: the development project is reset and seeded (`npm run db:reset -- --yes` then `npm run db:seed` — destructive, development only). The seeded fixture provides Blue Olive (Downtown, Marina) and Cedar Grill (Airport) with their dining tables, plus two demo open sessions (Downtown T1 and T2) with documented dev tokens (see `tests/database/helpers/fixtures.ts`).

## Walkthrough A — the customer enters (SC-001)

1. Open `/r/blue-olive` in a private browser window (no staff sign-in anywhere).
2. The public page renders the restaurant name and its two active branches (FR-001); select Downtown.
3. Select an active table (the demo session tables are listed; any other active table works); stopped tables are not selectable (FR-003).
4. Enter a display name and phone; submit — the session context is established and the menu route opens with the minimal indicator (restaurant · branch · table) (FR-004, FR-005/FR-006, FR-021).
5. Attempt invalid inputs: unknown slug (`/r/nope`), blank name, a 70-character name, a phone with letters — each rejected with a clear message and nothing created (FR-004).

## Walkthrough B — join, no timeout, staff close (SC-003, SC-005, SC-006)

1. In a second private window, complete entry for the **same table** with a different name/phone — it joins the same session (one session, two participants; no second session) (FR-006, FR-007).
2. Note the session stays open regardless of elapsed time — no expiry exists to observe (FR-008).
3. As carla (Downtown cashier) at `/dashboard/sessions`: the branch's open sessions render with table, opened time, and participants — nothing from Marina or Airport (FR-017, FR-019).
4. Close the session; verify the customer windows' next session-scoped read is refused and the device returns to entry (FR-009, FR-014), and the audit record exists with carla as the actor (FR-018).
5. As dan (Downtown kitchen): the sessions view is denied `42501` at the data layer; as fiona (no membership): everything denied; as eve (Cedar Grill owner AND Downtown cashier by seed): Downtown's sessions are legitimately visible — Marina's are not (FR-019, FR-020).

## Walkthrough C — recovery and abuse (SC-002, SC-004)

1. Complete entry in a window, then reload — the session is recovered without re-entering details (FR-013).
2. Copy the token to a second device/browser and read the session context — it works (possession is the capability), but every operation still resolves only that one session (FR-011, FR-012).
3. Attempt session context with a tampered token — refused with the no-longer-available message; nothing leaks (FR-020).
4. Close the session (staff), open a new one at the same table, reload the first window — recovery is refused and the device returns to entry (the reassociation rule, FR-014).

## Determinism and rebuild (SC-007)

`npm run db:reset -- --yes && npm run db:seed && npm run test:db` exits 0; `npm run types:gen` output is byte-stable; the seeded sessions, participants, and dev-token hashes are identical after every reset.

---

## Validation record

**Date**: 2026-09-19 · **Method**: programmatic execution against the real development project through the real data APIs (`scripts/run-session-walkthroughs.mjs`, feature 005/006 precedent) · **Result**: **22/22 checks PASS** (Walkthrough A — the customer enters: 8; B — join, no timeout, staff close: 8; C — recovery and abuse: 6).

- **A (the customer enters)**: the public payload resolves Blue Olive with both branches; Downtown's active tables include T3 while Marina's stopped table is absent everywhere; entry at T3 issues a token and reads the session menu; every invalid class (blank name, 61-char name, lettered phone, unknown slug) is refused with the contract's message verbatim.
- **B (join, no timeout, staff close)**: the second entry at the same table JOINED (one session, two participants); the context resolves with no expiry concept; carla's staff list carries both participants and no phone numbers; dan (kitchen) denied list and close with `42501`; **eve lists Downtown legitimately (she is Downtown's cashier by seed) and is denied Marina; fiona is denied everything** — the walkthrough script encodes this corrected premise (the drafted step B5's "eve denied" was a stale draft assumption, corrected during execution); carla's close refuses the customer's next read with the single indistinguishable message, and the `session.closed` audit record exists with carla as the actor and the tenant + branch scope.
- **C (recovery and abuse)**: the reload-equivalent recovers the session from the stored token; the same token works from a second device and resolves only its own session; the tampered token is refused with the byte-identical message; after the staff close and a re-seat, the old token is refused (the reassociation rule) while the new session's token is usable; the script closes what it opens.

The development project was restored afterwards (`npm run db:reset -- --yes` + `npm run db:seed`).
