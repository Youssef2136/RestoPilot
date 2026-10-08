# Quickstart: 036-responsive-and-device-hardening

Runnable validation scenarios proving the phase end-to-end. Each script is FROZEN
here with its expected outcomes; the implementation tasks cite them, and the final
gate (T-last) reconciles the recorded results. Prerequisites for every script:
`npm run db:reset -- --yes` (mandatory before any Playwright run — Phase-14 record),
the dev server on `:5173` (Playwright webServer starts it; `reuseExistingServer`).

## W1 — The overflow sweep (FR-03, SC-002)
**Run**: the responsive overflow suite across all routes at 320/390/430 px in the
authorized states, with long-content variants on content routes.
**Expected**: zero horizontal overflow anywhere — `scrollWidth <= clientWidth` on
every route×width, no interactive element clipped by the viewport edge. First paint
at each width shows meaningful content. Any overflow found is fixed or (never)
waived silently — the sweep must end green.

## W2 — The device-class journeys (FR-04, FR-05, SC-003)
**Run**: the device journeys suite — cashier assign→bill→close at tablet landscape
(1112×834) with interaction assertions; kitchen board at tablet portrait + large
desktop (column identity, ticket states, no clipped actions); management/report/
platform routes at desktop 1280–1600 and the wide check (>1600).
**Expected**: every control visible and operable without horizontal scrolling;
dialogs fit the rotated viewport; the kitchen board stays bounded and named at
1600+; reports/comparison stay readable, not stretched.

## W3 — The table fallbacks (FR-06, SC-004)
**Run**: each of the six production tables narrowed below its crossover width —
staff list, audit log, void report, reports aggregates, platform console, tax
preview — and the same-disclosure check for a lower-privileged role (kitchen or
cashier where the surface is shared).
**Expected**: every row's card (or documented scroll region) carries the same
fields the table showed for that role — no column disappears, no field appears
that the table view did not show.

## W4 — Orientation + virtual keyboard (FR-08, FR-09)
**Run**: the orientation preservation checks (customer menu, cashier dashboard,
kitchen board: rotate portrait ↔ landscape) and the 390 px keyboard-shrink form
completion (customer entry/order forms).
**Expected**: scroll position, open surfaces, and input values survive rotation;
no duplicate announcements; the focused field and the submit action remain
reachable with the keyboard-occupied viewport; input state survives scrolling.

## W5 — The a11y carry-forward gate (FR-10, SC-005)
**Run**: the FULL Phase 15 a11y suites unmodified (a11y.matrix 31 rows, keyboard
journeys, touch targets, motion preferences) after all layout work + the axe
mobile/tablet rows + 200 % zoom.
**Expected**: all green — skip links, landmarks, live regions, keyboard
operability, and announcement policy survive re-layout; touch targets hold the
44 px floor at 390/834; any failing pin is a Category-A migration (ledger +
paired suite edit in the same commit), never a silent weakening.

## The full gate (final task)
`npm run db:reset -- --yes` → `npm run verify` EXIT 0 → the full Playwright run
(batched per the standing protocol) green → the W1–W5 outcomes recorded in the
phase report → `docs/conventions.md` responsive rules + device-contracts.md
reviewed against the shipped layout.
