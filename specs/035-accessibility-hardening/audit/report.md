# Audit Report — specs/035 (Phase 15: Accessibility Hardening)

> Live findings log (T001). Every finding carries severity (critical/serious/
> moderate/minor), decision (fixed / recorded), and evidence. Serious-plus is fixed
> this phase (clarify 2026-10-06); moderate/minor may move to `exceptions.md` with a
> reason and a named owner. Seeded with the route×state inventory (`src/app/router.tsx`
> + `tests/database/helpers/fixtures.ts`) and the recorded 031 A3 finding.

## Inventory — routes × authorized states (the matrix under test)

Shell selection is per router.tsx: CustomerShell for public/customer/credential routes,
StaffShell for staff/platform + the 404 catch-all. Identities are the seeded ones
(seedCredentials): alice (owner, Blue Olive), bob (manager, Downtown), carla (cashier,
Downtown), dan (kitchen, Marina), eve (owner, Cedar Grill), platformAdmin (super admin),
fiona (linked profile, no membership).

| # | Route | Shell | Authorized state scanned | Identity |
|---|-------|-------|--------------------------|----------|
| 1 | `/` | Customer | public landing, signed-out | — |
| 2 | `/signin` | Customer | signed-out | — |
| 3 | `/reset-password` | Customer | signed-out (token-less posture) | — |
| 4 | `/account/password` | Customer | signed-in staff | carla |
| 5 | `/r/blue-olive` | Customer | public restaurant entry, signed-out | — |
| 6 | `/r/blue-olive/menu` | Customer | customer session (in-session) | guest flow |
| 7 | `/order/:branchId` | Customer | branch deep link (Downtown) | — |
| 8 | `/dashboard` | Staff | linked profile with memberships | alice |
| 9 | `/dashboard` (bootstrap) | Staff | linked profile WITHOUT membership | fiona |
| 10 | `/dashboard/profile` | Staff | staff | carla |
| 11 | `/dashboard/staff` | Staff | owner gate | alice (+ bob denial view) |
| 12 | `/dashboard/sessions` | Staff | manager reach | bob (+ dan denial view) |
| 13 | `/dashboard/rounds` | Staff | cashier reach | carla (+ dan denial view) |
| 14 | `/dashboard/kitchen` | Staff | kitchen reach | dan (+ carla denial view) |
| 15 | `/dashboard/audit` | Staff | owner/manager reach | alice (+ carla denial view) |
| 16 | `/dashboard/reports` | Staff | owner/manager reach | alice (+ carla denial view) |
| 17 | `/dashboard/voids` | Staff | owner/manager reach | alice |
| 18 | `/dashboard/restaurant` | Staff | owner gate | alice (+ bob denial view) |
| 19 | `/dashboard/menu` | Staff | owner gate | alice |
| 20 | `/dashboard/tax` | Staff | owner gate | alice |
| 21 | `/dashboard/branches` | Staff | staff, policy-scoped reads | alice (+ bob branch-scoped) |
| 22 | `/dashboard/branches/:branchId` | Staff | in-scope branch | alice |
| 23 | `/dashboard/branches/:branchId/menu` | Staff | in-scope branch | alice |
| 24 | `/dashboard/branches/:branchId/tax` | Staff | in-scope branch | alice |
| 25 | `/admin` | Staff | super admin | platformAdmin |
| 26 | `/admin/platform` | Staff | super admin | platformAdmin |
| 27 | unknown path (404) | Staff | signed-in catch-all | carla |

Notes: `/dev/gallery` is DEV-only (never in production bundles; covered by the
design-system suite, not the audit matrix). Empty/loading/error states ride the same
scans where reachable; mobile (390×844) and tablet (834×1112) rows run the target-size
sweep (T011) and the shell/drawer assertions.

## Findings

| ID | Severity | Where | Finding | Decision | Evidence |
|----|----------|-------|---------|----------|----------|
| F-001 | serious | `/r/blue-olive/menu` @ 390px | Pre-existing target-size findings on the 025 cart micro-buttons (recorded, never silently waived, by the 031 channel-operations E2E comment "findings A3 — owning phase recorded") | ALREADY FIXED by specs/031's audit fix (`order.surfaces.module.css`: `.smallButton` min-height/min-width 1.5rem = 24px with true spacing); T011's sweep is the standing proof | `e2e/channel.operations.test.ts` ~L200 comment; `src/features/order/components/order.surfaces.module.css` A3 comment |
| F-002 | serious | 404 + error views | `NotFoundView` and `RouteErrorView` each rendered a SECOND `<main id="main">` inside the shell's main — nested/duplicate main landmark + duplicate DOM id (invalid ARIA; axe's landmark rules sit outside the wcag tags, the spec 035 shell-floor assertion caught it) | FIXED: both render a labelled `<section>` now; pinned texts unchanged | Matrix rows `/no-such-route` + `/dashboard/branches` (first run, 2026-10-06); fix in the two components |
| F-003 | serious | `/dashboard/branches` (owner state) | The owner's `CreateBranchForm` submit was a BARE native `<button type=submit>` — 21px tall (under the 24px target-size floor); the trailing "Back to the dashboard" link measured 23px of safe space to the form's controls (target-offset) | FIXED: the form uses the system `Button` (control-height ≥32px compact) and the back row takes `--space-8` margin (`BranchesPage.module.css`) | Matrix run 2026-10-06: `target-size (serious)` on `button[type=submit]` + the back link; fix verified by the re-run |
| F-004 | (to fill) | — | Findings surfaced by the keyboard journeys (T008) and the target/motion sweeps (T011/T013) land here as they are triaged | — | — |

## Walkthrough record (W1–W5, from quickstart.md — T015)

The five scripts are FROZEN in `specs/035-accessibility-hardening/quickstart.md` with their expected
outcomes (the phase deliverable per the clarify decision). The human execution
record with a real screen-reader environment is EXC-001 in `exceptions.md`
(owner-owned) — the table below records the automated keyboard/announcement
proof that covers each script's expected lines (the E2E legs), which is the
agent-performable half of every row:

| Script | Journey | Automated proof (this phase) | Human SR run |
|--------|---------|------------------------------|--------------|
| W1 | Customer ordering | `keyboard.journeys.test.ts` (join/add/submit by keyboard; submit-success announced once, no focus steal) + `customer.menu.test.ts` axe floor | EXC-001 (owner) |
| W2 | Cashier transitions | `cashier.operations.test.ts` (keyboard chain; void dialog containment/Escape/restore; no-steal on live refetch) | EXC-001 (owner) |
| W3 | Kitchen ticket | `kitchen.display.test.ts` (keyboard walk; one-arrival-one-announcement; no-steal across a poll cycle; late is text-bearing per 030 D2) | EXC-001 (owner) |
| W4 | Session close | `keyboard.journeys.test.ts` (T2 close: dialog containment/Escape/restore/confirm; closure notice announced once — the surface's only role=status pin) | EXC-001 (owner) |
| W5 | Super-admin onboarding | `keyboard.journeys.test.ts` (form/outcome toast distinct wording/credential copy status) + `platform.console.test.ts` (dates error announced, guarded submit) | EXC-001 (owner) |

## Gates (final reconciliation in T017)

- [x] Expanded axe matrix green — zero unwaived findings, 31/31 (SC-001).
- [x] Keyboard-journey specs green with focus rules — 4/4 + the extended walks 8/8 (SC-002).
- [x] Contrast record complete — 15/15 pairs PASS, zero exceptions (SC-003); targets (T011) + motion/zoom (T013/T014) green.
- [x] Exceptions list complete with owners (EXC-001…003) + walkthrough scripts frozen with automated-proof rows (SC-005).
- [x] `npm run verify` EXIT 0 + full Playwright green (SC-006 standing proof) — T017: verify green on the final tree (unit 434/434, build 788.96 kB); Playwright batched over the reset DB = 244/244 (two shared-cloud timing flakes green isolated; the batch-C early-stop remainder re-run green).
