# Tasks: Realtime and In-App Notifications (Phase 11)

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

**Created**: 2026-09-21

## Foundation

- [ ] T001 Baseline: `npm run test:db` green and `git status` clean of Phase 11 work before any change
- [X] T002 Migration `supabase/migrations/<ts>_realtime_authorization.sql` (data-model.md §1–§2): the `supabase_realtime` publication additions (five tables), the staff SELECT policies on `rounds`/`kitchen_tickets`/`sessions` reusing the 009 role predicate verbatim, no new grants; apply with `npm run db:migrate`; `npm run types:gen` clean
- [X] T003 `tests/database/realtime.schema.test.ts` (data-model.md, research §6): the publication carries exactly the five tables with INSERT+UPDATE+DELETE; the policies exist with the exact `has_branch_role` predicates; RLS stays enabled; zero new direct-table grants; the fail-closed direction (an unauthorized identity matches no policy row); the OTHER tables remain unpublished
- [X] T004 Full `npm run test:db` regression green; mark the foundation complete

## US1/US2 — the staff dashboards go live

- [X] T005 [US1] Create `src/features/realtime/useRealtimeInvalidation.ts` (contracts/realtime-client.md §1): the channel registry, the coalesced invalidate, the SUBSCRIBED → refetch recovery, the cleanup discipline
- [X] T006 [US1] Wire `CashierRoundsPage` (contracts §3): `rounds` @ branch invalidates branchRounds + kitchenQueue + all sessionBill keys
- [X] T007 [US2] Wire `KitchenDashboardPage` (contracts §3): `kitchen_tickets` + `rounds` @ branch invalidates kitchenQueue only
- [X] T008 [US5] Wire `StaffSessionsPage` (`sessions` @ branch) and `BranchMenuPage` (`branch_unavailable_items` @ branch) per contracts §3
- [X] T009 [US4] Create `src/features/realtime/useNewRoundCue.ts` (contracts §2) + the dashboard shell cue region (`role="status"`, derived text only)

## Acceptance

- [X] T010 `tests/unit/realtime.test.ts` (contracts §1–§2, research §6): the event → invalidator mapping per surface, the coalescing window (N events → one invalidate), the SUBSCRIBED recovery refetch, the channel cleanup, the cue set/clear cycle — the channel mocked, no sockets
- [X] T011 `e2e/realtime.test.ts` (SC-001…SC-004): two browser contexts — a customer submission appears in carla's dashboard without manual refresh; a state advance moves groups live; the kitchen queue updates live with zero money text; the reload recovery; the cue renders and clears
- [X] T012 Full `npm run verify` + `npm run test:e2e` exit 0; `package.json` unchanged

## Polish

- [X] T013 [P] Extend `docs/development.md`: the Phase 11 suite table and the "realtime drives invalidation, reads stay the render path" rationale (plan D3), the customer-poll decision (research §3)
- [X] T014 Reset-and-rebuild determinism: `npm run db:reset -- --yes` → `npm run db:seed` → `npm run test:db` green; `types:gen` byte-identical
- [X] T015 Run the quickstart walkthroughs (`scripts/run-realtime-walkthroughs.mjs`), append the validation record to `quickstart.md`; restore the project afterwards
- [ ] T016 Final commit and push of all Phase 11 artifacts to GitHub `main`

## Notes

- The customer surface (US3) is intentionally NOT a Postgres subscription — research §3's resolution: the 10s poll + mutation refetch through the unchanged reads; the quickstart asserts the cadence
- Realtime NEVER renders payloads (plan D3) — the reads remain the only render path; money/PII never arrive via events
- Policies reuse `private.has_branch_role` verbatim — zero authorization-vocabulary drift
