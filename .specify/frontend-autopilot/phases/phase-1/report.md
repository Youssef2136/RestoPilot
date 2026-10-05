# Phase 01 Report — Frontend Foundation & Architecture Baseline

**Date:** 2026-09-27 · **Operator:** Buffy (frontend-autopilot) · **Feature:** `specs/021-frontend-foundation` · **Baseline:** `b569215` → **Checkpoint:** `a707a27`

## Final status

**PHASE 01 COMPLETE — CONVERGED.** All 12 FRs implemented, all 6 SCs evidenced, every validation tier green (one documented environmental deviation, below), checkpoint committed. No blockers.

## Objective

Give every later frontend phase a safe substrate (Master Plan §8 Phase 01): styles pipeline, route metadata, error boundary, one evidence-based query policy, a11y/responsive/console test tooling, and the written presentation-contract ledger — with zero visual design decisions and zero behavior change.

## Requirements / tasks completed

- Spec: 6 user stories, 12 FRs, 6 SCs, 4 owner clarifications (Q1–Q4, answered 2026-09-26).
- Tasks: **T001–T024 all complete** (`specs/021-frontend-foundation/tasks.md`).
- Pipeline stages executed: SPECIFY → CLARIFY → PLAN → CHECKLIST (READY) → TASKS → ANALYZE → IMPLEMENT → VALIDATE → CONVERGE (3 convergence rounds; findings F1–F6 fixed) → CHECKPOINT → REPORT.

## Implementation summary

| FR | Delivered |
| --- | --- |
| FR-01 | `src/styles/` reset.css + base.css; import order reset → base → index.css in main.tsx; documented token absence |
| FR-02 | `src/app/routes.ts` registry (25 routes) + `RouteTitles` applying title + meta description centrally |
| FR-03 | `ErrorBoundary` + `RouteErrorView` (recoverable view, no internal messages, plain-anchor routes back); nested-boundary minimal fallback |
| FR-04 | Dedicated `NotFoundView` on the `*` route (Q1: never a silent redirect) |
| FR-05 | `src/app/queryClient.ts` codifying current behavior exactly; defaults unit-pinned; deviation process documented in docs/development.md |
| FR-06 | `eslint-plugin-jsx-a11y` over `src/**` (recommended set; 4 composition-dependent rules advisory until Phases 03/15); one real finding fixed (`ItemImageField` alt) |
| FR-07 | axe WCAG 2.2 AA floor (`e2e/a11y.baseline.test.ts`) over `/`, `/signin`, `/reset-password`, `/dashboard`; committed-baseline waiver mechanism (currently empty — scanned routes came back clean) |
| FR-08 | Viewport projects `mobile-chromium` (390×844) + `tablet-chromium` (834×1112) running the overflow smoke; console/rejection/request-failure assertions per route with an explicit expected-refusal list (F-G14) |
| FR-09 | Dev gallery `/dev/gallery` (DEV-gated in router.tsx) — grep-proven absent from `dist` |
| FR-10 | `docs/frontend-presentation-contracts.md`: categories A (~666 assertions: 387 role / 166 label / 128 text), B (9 data-\* hooks), C (16 testids), D (2 frozen keys) with change discipline + regeneration recipes |
| FR-11 | docs/conventions.md + docs/development.md updated (styles pipeline, route metadata, error/404, query policy, a11y tooling, viewports, console assertions, ledger) |
| FR-12 | No new package.json scripts (Q4: axe rides test:e2e; a11y lint rides lint) — `verify` unchanged |

## Design / Impeccable findings

Structural phase — `shape` skipped (justified in plan.md's Design Direction, per §6.2 ordering notes). Impeccable `audit` verb does not exist in the installed launcher (v0.1.6 exposes `detect`); ran `detect src` → **exit 0, zero findings**, recorded as the pre-design technical baseline for Phases 15/18 (findings F8, decisions D8).

## Files changed

46 files (+4152/−219) — new: `src/styles/{reset,base}.css`, `src/app/{routes,RouteTitles,queryClient}`, `src/components/{ErrorBoundary,RouteErrorView(+css),NotFoundView(+css),SkipLink,renderFallbackError}`, `src/routes/DevGalleryPage`, 4 e2e specs + 2 helpers, 4 unit suites, the ledger, the feature directory (spec/plan/research/quickstart/checklist/tasks/evidence), `.npmrc`. Modified: AppShell (SkipLink + `id="main"` only), router (gallery, 404, RouteTitles), App (boundary + queryClient import), main.tsx (import order), index.css (split), eslint/playwright configs, package.json (+2 dev-only deps), security.bundle.test.ts (`DEV` allowlisted as Vite's compile-time constant), ItemImageField (a11y fix), docs ×2, feature.json → 021.

## Routes / components changed

No path changes; no guard decisions touched. New renders: `*` → NotFoundView, `/dev/gallery` (DEV only). AppShell gained the skip link and `#main`.

## Backend contracts used

**None modified; NOT_REQUIRED.** `npm run test:db` 516/516 unchanged; no migration, RPC, RLS, or generated-type edit (F-G07/F-G08/F-G11 upheld). `db:reset` used between tiers for fixture posture (documented remedy, dev project only).

## Accessibility / responsive results

html[lang] asserted; skip link first in tab order → `#main`; `:focus-visible` policy in base.css; error/404 views semantic with live `role="alert"` copy; axe baseline clean on all 4 scanned routes; no horizontal overflow at 390×844 / 834×1112 on the swept surfaces.

## Tests / build / E2E results

format:check PASS · lint PASS (0 errors, 3 pre-existing warnings) · typecheck PASS · unit **295/295** · test:db **516/516** · integration **38/38** · build PASS (708 kB JS / ~197 kB gzip / 4 kB CSS; gallery excluded) · e2e **126/127** (full run in `evidence/final-e2e-run.log`).

## Fixes and convergence rounds

3 rounds: (1) RouteTitles layout-route blank-page defect; (2) Vite-defines-absent crash in E2E imports; (3) DEV-flag indirection defeating DCE — gallery leaked into dist, caught by the phase's own bundle grep; final architecture confines build-mode logic to router.tsx. Plus console-helper location matching, sweep redirect settling, and the a11y alt fix. Details: findings.md F1–F6, decisions D2/D3.

## Git checkpoint

`a707a27` — `feat(021): frontend foundation …` on `main` (46 files, secrets-checked, tool-config dirs excluded). Not pushed.

## Remaining warnings / blockers

- **W1 (carry-forward, pre-existing):** mutating e2e/integration suites leave fixture residue and race each other under file parallelism (spec-020 scratch membership `…b201` vs the auth.signin exact-count matrix; Fiona-dashboard and platform-onboarding ordering sensitivities). Produced the single full-E2E failure (passes isolated) and the only `verify`-run integration flake. Owner-approved teardown/sequencing fix belongs to a phase owning those suites (Phase 14 candidate) or an owner task.
- **W2:** integration-tier 429s under back-to-back runs remain environmental (D4 discipline applied; final runs clean).
- **W3:** the 3 pre-existing lint warnings are untouched (out of scope).
- No blockers.

## Traceability (requirement → implementation → validation)

| Requirement | Implementation | Validation |
| --- | --- | --- |
| FR-01/US6 | src/styles/*, main.tsx | stylesPipeline.test.ts; lint; e2e sweep |
| FR-02/US2/SC-001 | routes.ts + RouteTitles | routeRegistry.test.ts; route.titles.test.ts sweep |
| FR-03/US1/SC-002 | ErrorBoundary/RouteErrorView | errorBoundary.test.tsx; gallery.error.test.ts (live) |
| FR-04/US1/Q1 | NotFoundView + `*` route | route.titles.test.ts 404 tests |
| FR-05/US3/SC-004 | queryClient.ts | queryClient.test.ts; behavior E2E green (no test changed) |
| FR-06 | eslint.config.js + plugin | lint 0 errors; ItemImageField fix |
| FR-07/US4 | a11y helper + baseline spec | a11y.baseline.test.ts 4/4 clean |
| FR-08/US4 | console helper + viewport projects | sweep assertions; responsive.smoke 2×5 pass |
| FR-09 | DevGalleryPage DEV-gated in router | build + dist grep: GALLERY-EXCLUDED; gallery title e2e |
| FR-10/US5/SC-005 | docs/frontend-presentation-contracts.md | counts cross-checked vs grep recipes (666/9/16/2) |
| FR-11 | docs ×2 | content review; development.md tooling section |
| FR-12 | no script changes | verify script string unchanged |
| SC-003 | — | 126/127 e2e incl. all 13 pre-existing suites green |
| SC-006 | — | every verify constituent green (per-tier evidence; W1 race documented) |

## Next step

**Phase 02 — Design System & Visual Language** (`specs/022-frontend-design-system`): `$impeccable init` → PRODUCT.md; `shape` for the system; tokens + primitive inventory into the styles slot this phase reserved; the gallery becomes the system's proving ground.
