# Phase 04 Decisions (specs/024-auth-and-customer-entry-ux)

## D1 — Spec-020 semantics frozen, presentation re-skinned only
Branch/Table/Your name/Phone number labels, "Join the table", the h1 = restaurant name, and the `Blue Olive · Downtown · Table T3` indicator stay byte-identical; "Table"/"Branch" appear in no other entry-page label. The re-skin (AuthCard, entry components) is presentation-only — auth.routes and session.surfaces assertions were not weakened, only re-anchored where markup changed.

## D2 — Entry split via module components, not a new route layer
`CustomerShellHeader`, `ChannelSelector`, `SessionJoinNotice` + `entry.module.css` compose the existing RestaurantEntry; RestaurantEntry keeps the payload-reset effect (branchId/tableId reset on restaurant payload change) and the single-branch auto-pick (`effectiveBranchId = branchId ?? (branches.length===1 ? branches[0].id : null)`). No behavior change; the public payload only ever exposed ACTIVE tables, so no gating logic was added.

## D3 — Real `/` landing + `/order/:branchId` redirect (C1/C2)
RootPage renders the two real ways in (entry by public identifier, staff sign-in); OrderPage redirects to the landing with the branch echo instead of a half-surface. Route registry metadata (titles/descriptions) added for both; routes.test.ts pins migrated per the recorded plan.

## D4 — E2E fixture coordination: three machine-wide mutexes
Kept the fionaLock pattern: atomic mkdir under `test-results/`, bounded wait, stale-steal. `entryLock` serializes the shared Blue Olive customer entry (platform kill-switch is a machine-global hazard for it); `marinaT1Lock` serializes the seeded Marina T1 activation lifecycle (management.surfaces asserts Inactive; realtime's kitchen-queue flips it through the real browser UI because RPCs are unreachable from a test browser by house discipline). Everything else stays fullyParallel.

## D5 — Kill-switch window, not file-spanning lock holding
See findings F3: the entry lock is held only across the disable→re-enable pair, with an afterAll safety net re-enabling the tenant if the window's owner dies. Rationale: a file-spanning hold serializes the whole suite behind the platform run and turns the default 30s test timeout into a flake factory. Trade-off accepted: a failure INSIDE the disable test briefly leaves Blue Olive disabled for concurrent files until afterAll fires — bounded, and the safety net makes it self-healing.

## D6 — State-agnostic flip with toPass self-healing
The kitchen-queue flip drives T1 to Active from whatever state it finds (a crashed earlier run can leave it Active) using the toggle label as the state oracle; the teardown deactivates only if visible and retries click+assert via toPass (F2). Idempotent in both directions.

## D7 — verify re-proven on a clean reset after an interrupted db:reset
The verify failure (17 db tests) was E2E residue (onboarding memberships), not a regression; rather than cherry-pick, re-ran db:reset to completion and re-proved unit 362 / db 516 / integration 38 / build on the clean base. Cost: one reset (~2 min). Benefit: the checkpoint's validation claim is against the canonical base.

## D8 — Impeccable finding applied, not argued
The 3px one-sided border on `.deepLinkNote` was removed outright (subtle muted indent kept) — matching the 022 token system is the phase's own bar; no counter-argument survived scrutiny.
