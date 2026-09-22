# Plan: End-to-End Validation (Phase 16)

**Feature**: [spec.md](spec.md) · Created 2026-09-22

## 1. The shape of the phase

Two deliverables, both test-tier-honest:

- **US1 — the happy-path journey** (`e2e/full-journey.test.ts`): ONE Playwright
  file driving §27's chain verbatim against **freshly created data**. The seed
  suites prove every surface in isolation; §27's premise is the composition,
  from nothing to closed session.
- **US2 — the scenario ledger**: the spec's scenario→proof table is the
  record. Three §27 lines have no standing proof and get new coverage
  (below); the other nine are cited — the reuse rule (016 FR-003) applied
  again.

## 2. The journey's design decisions

- **D1 — The owner is Fiona.** The fixture's linked-profile owner with no
  memberships exists exactly for this: her dashboard renders the creation
  panel, so the journey can create a real restaurant from scratch without
  touching any seeded tenant. Slug `dress-rehearsal` (unique, deterministic;
  the journey cleans up nothing — one row-set per run is acceptable and
  re-runs create suffixed tenants only if the slug is taken... no: the
  journey ASSERTS creation succeeds, so it uses a date-suffixed slug
  `dress-rehearsal-YYYYMMDD` and skips nothing).
- **D2 — Creation goes through the real UI** where the UI has forms
  (restaurant, branch, tables, category, item — all have owner forms),
  because §27 says "owner creates" from the customer's perspective: the
  product's claim is that the UI alone suffices. The kitchen/cashier hops
  use the staff pages (accept/prepare/ready buttons, close confirmation).
- **D3 — The customer is a second browser context** (the 012 pattern): entry
  via `/r/<slug>` → branch/table → name/phone → customer menu; round 1 and
  round 2 from the same token; the state watch between hops.
- **D4 — Money assertions** at three points: round 1's line total, round 2's
  second ticket in history, and the staff bill panel's grand total == the
  captured sum (the 008 SC-005 rule, re-proven on fresh data with the new
  item's price).
- **D5 — Customer-visible state**: the journey asserts the customer's
  history reflects each accepted/prepared/ready transition (the 012
  recovery rule: refetch on subscribe; here, explicit reload is allowed —
  the state assert is about correctness, not liveness, which 012 owns).

## 3. The three new coverage pieces (US2)

- **N1 — closed session → new session (e2e)**: in the journey file, after
  the close, a fresh customer context re-enters the freed table and opens a
  NEW session (new token, empty history) — §27 scenario 2.
- **N2/N3 — the two price-change timings (db)**:
  `tests/database/e2e.pricechanges.test.ts`: owner changes an item's price;
  (a) a NEW session's next round uses the new price; (b) an OLD session's
  existing rounds keep their captured `unit_price` while ITS next round
  after the change also uses the new price — the capture-at-submit rule
  with the living-menu boundary, both timings in one rolled-back suite.
- **The other nine scenarios** are cited in tasks Notes + docs (files and
  test names verified in the spec table).

## 4. Verification

- `npm run verify` exit 0 (the db suite joins test:db; e2e joins the gate).
- Full e2e single-worker (the documented deterministic gate).
- Determinism: reset → seed → db regression → `types:gen` byte-identical.
- The journey is **rerunnable**: it creates its own tenant each run (date
  suffix) and never mutates the seeded fixture.

## 5. Risks

- **Slug collisions across runs** → date suffix (D1).
- **Creation-form selectors drift** → the journey uses the same roles/labels
  the 004/005 surfaces render (verified in this plan's survey: "Create your
  restaurant", "Create branch", "Create table", "Add category", "Add item").
- **Serial-worker runtime** → the journey is one file, ~6 tests, run in the
  existing single-worker gate; budget ~2 min.
