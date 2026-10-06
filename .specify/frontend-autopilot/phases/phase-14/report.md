# Phase 14 — Report (specs/034 · Platform Console UX)

## Final status
**DONE** — T001–T006 complete (+ one convergence round, C001), every validation gate
has a green run on the final tree, no unresolved CRITICAL/HIGH findings, state
persisted, checkpoint pushed.

> Written 2026-10-06 from session evidence (the run's records live in state.json, the
> §Phase 034 ledger record, and the `9dba5d3` commit message) when the phase's
> autopilot artifacts were normalized to the 031/032 layout — the implementation
> itself is unchanged.

## Objective
Give the platform owner a deliberate operations console: one shared subscription
vocabulary (D1), every action speaking its outcome (D2), a workable tenant list (D3),
inline dates validation (D4), the /admin landing posture (D5), and the
responsive/a11y floor on both admin routes (D6) — Operate mode, all five platform RPC
contracts untouched.

## Requirements → implementation summary
- **T001** `stateLabel()` in `subscriptionCopy.ts` (wraps the P12 map's label); the
  console renders it and the local `STATE_LABELS` map is deleted. The ONE deliberate
  frozen-pin migration: 'Never activated' → 'Not activated yet' — both
  `platform.surfaces` pins moved in the same commit per the Category-A discipline.
- **T002** Toasts on dates saved / tenant disabled / tenant re-enabled / onboarding
  success (restaurant-named; the onboarding toast's wording distinct from the pinned
  inline status so the spec 019 lookups stay strict-safe); refusals verbatim.
- **T003** Labelled case-insensitive name filter + sortable Name/Subscription
  headers (aria-sort buttons, client-side over the already-fetched rows — FR-10).
- **T004** Dates form validates end ≥ start inline (aria-invalid + described error
  line + guarded submit; server refusals still render verbatim).
- **T005** /admin landing posture (N tenants · M disabled + the honesty statement)
  from the SAME overview query the console uses.
- **T006** The console table joins the shared `.cardTable` pattern (AuditLogPage
  precedent): data-label cells, thead out of flow < 720px.
- **C001 (convergence)** The invalid-dates case pinned in the phase E2E (inline error
  + guarded submit + re-validation) — closing R3's "unit+E2E" claim honestly.

## Files changed (checkpoint `9dba5d3` — 12 files)
New: `e2e/platform.console.test.ts`, `tests/unit/adminPosture.test.tsx`,
`specs/034-platform-console-ux/spec.md`. Modified: `src/routes/PlatformConsolePage.tsx`,
`src/routes/AdminPage.tsx`, `src/features/platform/subscriptionCopy.ts`,
`src/features/platform/components/OnboardingPanel.tsx`,
`tests/unit/subscriptionCopy.test.ts`, `e2e/platform.surfaces.test.ts` (the two
migrated pins), `docs/frontend-presentation-contracts.md` (§Phase 034 + the
Category-A row), `.specify/feature.json`, `docs/whatsapp-n8n-api-contract.md`
(prettier-only rider — it alone failed format:check, committed with drift in
`b1a871e`).

## Backend contracts used (ALREADY_SUPPORTED — no backend change)
`current_auth_context`, `get_platform_overview`, `set_subscription_dates`,
`set_restaurant_platform_disabled`, `onboard_restaurant` — verbatim; no RPC, type, or
RLS change anywhere.

## Validation results
- Unit: **430/430** (adminPosture 3 new; subscriptionCopy 7 with the stateLabel
  block).
- Targeted E2E (workers=1/90s, after db:reset): live.awareness **2/2** +
  platform.console **3/3** (new) + platform.surfaces **7/7** (the migrated pins
  green) = **12/12, EXIT:0**.
- `npm run verify` on the final tree: format:check green (after the prettier rider),
  lint green, `tsc -b` clean, test:db **516/516** (first run: 5 failures = E2E
  residue on the shared cloud DB, green after db:reset; one order.rpc audit-count
  flake green on the isolated rerun — the documented shared-cloud environmental),
  test:integration **38/38**, build **OK** (788.74 kB JS / 217.95 kB gzip).
- Convergence C001: platform.console **3/3** green after the pin (after db:reset).

## Convergence / fixes
C001 (the only round): R3's "unit+E2E" claim was aspirational — the dates FLOW was
E2E-covered but the invalid-case feedback was not pinned; pinned in
`platform.console.test.ts` and recorded in `tasks.md`. Environmental finding: the
db/integration suites leave tenant residue on the shared cloud DB (Cedar Grill
observed `platform_disabled` with reason 'test' and Blue Olive carrying subscription
dates after a verify run) — **db:reset before ANY E2E run is mandatory, not
optional**.

## Git checkpoint
`feat(034)` = `9dba5d3` pushed (origin/main verified by ls-remote); state.json
recorded in `55740c2`; artifact normalization + this report in the run's chore commit.

## Remaining warnings / blocked items
None blocking. Environmental notes carried forward: db/integration suites leave
tenant-flag/date residue (reset before E2E); order.rpc audit-count flake
(shared-cloud live writers, isolated-rerun protocol); transient 0xC0000142
worker-fork spawns (rerun once).
