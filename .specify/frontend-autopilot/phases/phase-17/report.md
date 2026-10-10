# Phase 17 — Report (specs/037 · State, Error, Loading & Offline Hardening)

## Final status

**DONE — converged (first round)** — T001–T019 complete, `npm run verify` green
on the final tree, batched Playwright closed with ZERO failures in the final
sweep, zero Category-A migrations (one late verbatim-discipline repair — see
Fixes), nothing committed (awaiting the user's word).

## Objective

Harden every user-facing state into a shared vocabulary so a failure is never
ambiguous: skeletons that keep the layout box stable, an `EmptyState` naming
the next action, a codified refusal split (inline `RefusalAlert` verbatim for
mutations / page-level error posture for reads), `OfflineSurface` with
BLOCKED-with-reason writes and readable last-known data, an expiry resolution
that is honest and NON-double-handling (D8), and a partial-failure posture on
the comparison surface that names the failed branch without erasing siblings.
Every claim proven through deterministic failure injection
(`route.fulfill`/`route.abort`/`context.setOffline`) — no Wi-Fi tricks, no
timing races.

## Clarify-encoded decisions

Skeleton ≤ ~300ms posture; offline mutations BLOCKED with the reason (never
hidden); refusal split = inline for mutations / page-level for reads;
last-known offline data shown stale-obvious; ONE automatic read retry (reads
only; mutations never auto-resubmit — `retry: false`, FA-7).

## Deliverables

- `src/components/state/` — the family: Skeleton (testId passthrough both
  variants), EmptyState (testId + title + children-as-body), ErrorState,
  RefusalAlert, RetryButton, PartialFailureNotice, **OfflineSurface**,
  **offlineGate.ts** (useOfflineState — banner + blocked-writes semantics).
- Adoption: OfflineSurface on CashierRoundsPage, KitchenDashboardPage,
  BranchSessionsPanel; Skeletons at CustomerMenuPage pending-branch
  (`&nbsp;` title + text lines + block), rounds board, staff list (4), reports
  (5); EmptyState at EIGHT sites keeping frozen verbatim copy as the title
  (audit with the td colSpan=5 wrapper, branches, branch tables, kitchen
  board, reports best-sellers, staff list, management members, void log —
  `void-log-empty` testId kept for the `reports.readability` pins).
- RefusalAlert adopted at six mutation sites (submit round ×2, onboarding,
  restaurant entry, tax snapshot, platform console).
- `specs/037-frontend-state-hardening/`: spec.md (clarify section), plan.md
  (D1–D8; D8 = expiry composes with the in-flight guard, no double-handling),
  checklists/requirements.md (16/16), tasks.md T001–T019 all [x] with
  verification annotations, **state-matrix.md** (the twelve states × every
  route, zero unclassified), mutation-audit.md (T005 audit table + T012
  post-condition addendum).
- Docs: `docs/conventions.md` §State vocabulary (spec 037) — the seven
  family rules incl. D8 single handling; ledger §Phase 037 presentation
  record (Zero Category-A migrations).

## Determinism + E2E (all new suites serial, injection-only)

- `state.operations` 2/2 — offline oversight leg (setOffline→banner, the
  last-known list readable, close-session confirm disabled WITH the reason,
  back-online re-enables) + injected 400 refusal on `accept_round` rendered
  verbatim on the pinned `[data-refusal]` card, ONE refusal after a burst.
  Standalone-lesson: **carla** (seeded Downtown cashier) not fiona (no seed
  memberships).
- `state.reads` 5/5 — reports skeleton + control-box stability under a held
  `get_branch_sales_report` route (1200ms), staff skeleton, customer menu
  skeleton on reload, void `[]` → data-state=empty (non-alert), audit
  `{entries:[]}` → audit-log-empty. Real-rpc-name + payload-shape ledger:
  `get_branch_sales_report`, `get_session_menu`, staff = `rest/v1/staff_memberships`
  table read, audit = `get_audit_log` returning `{entries:[]}` (a bare `[]`
  body IS the malformed case — AuditPayloadError).
- `state.customer` 2/2 (T2 lock, 390×844) — route-fulfilled 400 renders
  verbatim + button re-enables; `route.abort('connectionreset')` → the
  retry-kind honesty line asserting NOT a fabricated ticket.
- `state.expiry.partial` 3/3 — leg1: a `current_auth_context` 400
  `{code:401}` read resolves ONCE to the deny-by-default guard's explicit
  `Not authorized` denial (never a white screen, never /signin, one heading —
  D8 proven); leg2: a genuinely-ENDED session (localStorage `*auth-token*`
  wipe → SDK SIGNED_OUT on next navigation) redirects /signin exactly once
  with the `expired:true` note (FR-08); leg3: Marina's report row refused
  403 42501 → the per-row line names the branch, Downtown intact (FR-09).
- key learned fact: `fetchAuthContext` DOES throw (error → throw), but the
  guards INTENTIONALLY deny-by-default on a failed context read — the
  honest denial view IS the expired-read posture.

## Late finds (repaired, never weakened)

1. **RefusalAlert verbatim leak** — the T005 consolidation passed
   `context="Sending your order"` as the Alert TITLE, so `role=alert` text
   became `Sending your order This item is not available here.` — breaking the
   verbatim-only contract pinned by `session.surfaces:394`
   (`toHaveText('This item is not available here.')`). Repair (component
   level, six call sites fixed at once): the context sentence moved OUT of
   the alert into a container description (`aria-describedby` + styled
   `.context` p). Verified: session.surfaces:394 green, stateFamily 9/9
   (unit expectation unchanged — context still in the html), ALL suites green
   in the final sweep.
2. **T010 copy-drift regressions** — two EmptyState titles dropped their
   pinned trailing period: AuditLogPage `No audit entries match` and
   ReportsPage `No items sold in this period` (pinned by `bill.void.audit`
   and `reports.surfaces`). Both restored verbatim; a sweep of all seven
   EmptyState titles found no other drift.
3. **bill.void.audit run-order** — its serial void→audit pairing consumed the
   previous batch's leftover T3 sessions; repaired with a self-resetting
   `beforeAll` (`execSync npm run db:reset -- --yes`), verified green with and
   without external reset; `--repeat-each=2` leg proved the audit test itself
   is run-order-stable.

## Validation results (final)

| Gate | Result |
| --- | --- |
| format:check | PASS (clean after prettier on the touched files) |
| lint | 0 errors (4 pre-existing warnings, untouched files) |
| typecheck (`tsc -b`) | PASS |
| test:unit | 447/447 (40 files) |
| test:db | 516/516 (after db:reset) |
| test:integration | 38/38 |
| build | PASS (~794 kB JS) |
| Playwright (batched, db:reset first, chromium) | state.* + full-journey 15/15; session/management/reports 32/32; bill.void.audit 2/2; kitchen+realtime 6/6; menu/tax surfaces 24/24; platform/auth/readability/surfaces 30/30; cashier/channel/customer/entry 15/15; staff/menu-mgmt/platform-console/tax-mgmt 21/21; live/titles/routes/shell/smoke/gallery 31/31; design/kitchen-display/a11y-baseline/responsive-smoke/keyboard/touch/motion 20/20; a11y.matrix + responsive family 48/48 — **zero failures in the final sweep** |

Phase 15/16 carry-forward re-run UNMODIFIED: a11y.matrix 31/31, responsive
family 22/22 (first carry-forward leg), then the full final sweep 48/48 —
zero assertion edits.

## Convergence

One round, zero spec gaps: every story's E2E is green (US1 T008, US2 T011,
US3 T013, US4 T014+T016, US5 T015+T016); the state-matrix has zero
unclassified routes; D8 held — no double-handling found after the
RefusalAlert repair; the forbid-list (no Wi-Fi tricks) upheld by injection
proof.

## Git checkpoint

None created — the working tree holds the phase; commit as
`feat(037)/fix(037)` at the user's word (nothing pushed, nothing committed by
the autopilot without the user's request).
