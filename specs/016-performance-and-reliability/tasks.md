# Tasks: Performance and Reliability (Phase 15)

**Feature**: `016-performance-and-reliability` | [Spec](spec.md) | [Plan](plan.md)

**Conventions**: Baselines use the walkthrough pattern (real sign-ins,
real data API, medians of 5 with a discarded warm-up). Reliability tests
join the standing gates.

## Phase 1: Setup + survey

- [x] T001 Read §26, the prior phases' test coverage (012 realtime
      recovery, 007 open-or-join, FR-013 reload), and the read surfaces;
      set `.specify/feature.json`
- [x] T002 Plan the area→surface map and the scenario→test mapping
      (plan D2/D4)

## Phase 2: Baselines

- [x] T003 `scripts/run-perf-baselines.mjs`: measures all nine areas
      (plan D2's table) with medians of 5, writes
      `specs/016-performance-and-reliability/baselines.json` with env
      metadata
- [x] T004 Run the script; check the customer-path budgets (menu ≤ 1500 ms,
      submission ≤ 800 ms); commit the artifact as the first baseline
- [x] T005 Any budget breach → one targeted fix + re-measurement committed
      in the same task (none required if both budgets met)

## Phase 3: Reliability journeys

- [x] T006 Cite the three existing scenarios (refresh, duplicate submit,
      double-click) in tasks + docs with their proving test files
- [x] T007 `tests/database/reliability.transactions.test.ts`: network
      interruption (zero partial rows on aborted submission), stale tab
      (closed-session token refusal), concurrent cashiers (guarded-update
      single-winner semantics)
- [x] T008 Realtime disconnect recovery: extend the 012 unit suite's
      recovery-refetch contract to the unsubscribe→resubscribe cycle
      (FR-006); simultaneous-customer-actions cited to 007's open-or-join
      suite

## Phase 4: Gates + docs

- [x] T009 Full gates: `npm run verify` + full e2e
- [x] T010 `docs/development.md` Phase 15 entry (baselines workflow +
      reliability coverage); quickstart note for re-running baselines
- [x] T011 Determinism: reset → seed → full db regression → `types:gen`
      byte-identical
- [x] T012 Post-implement analyze record + final commit (the launch-gate
      record, FR-005)

## Notes

- T006 citations — the three existing reliability scenarios and their
  proving tests:
  - **Refresh** (a reload reconciles without data loss): the client's
    refused-recovery contract (`tests/unit/session.client.test.ts`, FR-013/14)
    and the live reload path in `e2e/realtime.test.ts` ("the reload path
    reconciles").
  - **Duplicate submit** (two rounds stay independent; nothing partial):
    `tests/database/order.rpc.test.ts` US2 block — sequential independence
    plus the concurrent race proof (Race 7), both zero-partial-write.
  - **Double-click** (the UI guard): `src/features/order/components/
    SubmitControl.tsx` disables while `submitRound.isPending` — the server
    halves are the same US2 postures; the entry-form twin is the
    open-or-join race in `tests/database/session.rpc.test.ts`
    ("A session is already open at this table. Join it instead.").

- T004 evidence: committed `baselines.json` — menu 106 ms (budget 1500),
  submission 306 ms (budget 800); all other areas recorded without
  budgets. No breach → T005 was a no-op by design (the Important rule
  applied to ourselves).
- T008 evidence: the recovery-refetch contract extended for the
  resubscribe cycle in `tests/unit/realtime.test.ts`; 007's
  `session.schema.test.ts` cited for simultaneous customer actions.

## Post-implement analyze (2026-09-22)

Deployed surface verified against the spec, all six FRs on disk:

- **FR-001** ✓ — the committed script measures all nine areas (probe:
  `baselines.json` keys) with medians-of-5 + warm-up and env metadata.
- **FR-002** ✓ — customer-path budgets recorded and met (menu 106/1500 ms,
  submission 306/800 ms). No breach ⇒ FR-004's targeted-fix clause is
  vacuous: zero product changes, the anti-drift rule held untouched.
- **FR-003** ✓ — all eight §26 scenarios mapped: refresh, duplicate
  submit, double-click, and simultaneous-customer-actions cited to their
  existing proving tests (T006 notes); network interruption, stale tab,
  concurrent cashiers covered by the new suite (T007); realtime
  disconnect by the extended 012 contract (T008).
- **FR-005** ✓ — the launch-gate record is committed (baselines.json +
  suites + this tasks.md trail).
- **FR-006** ✓ — recovery is proven by a deterministic unit probe (the
  unsubscribe→resubscribe cycle), not assumed.

No unchecked items remain; no convergence gaps found. The two custom
checklists stay reviewer-owned (the 005–015 convention).
