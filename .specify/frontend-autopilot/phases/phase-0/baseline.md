# Phase 0 Baseline — RestoPilot Frontend Autopilot

**Recorded:** 2026-09-26 · **Commit:** `b569215` (main, synced with origin) · **Operator:** Buffy (frontend-autopilot)

## Interpretation of "start phase 0"

The Frontend Master Plan (v1.1.0) defines **Frontend Phases 01–20**. There is no Phase 0
phase in the Master Plan. Per the autopilot SKILL.md **First Run** procedure, "start
phase 0" = inspect the repository + Master Plan, establish the baseline, determine
prerequisites, then begin the workflow for Phase 01 (`specs/021-frontend-foundation`).
This document is the baseline record.

## Verified repository facts (Master Plan §2 claims all confirmed)

- **Stack:** React 19.2 + react-router 7.18 (declarative `<Routes>`), TanStack Query 5.102,
  Supabase JS 2.116, Vite 8, TS 6.0, ESLint 10, Prettier, Playwright 1.63, Vitest 5, wrangler.
  No Tailwind, no UI kit, no icon package.
- **Routes:** 25 registered in `src/app/router.tsx` — public (`/`, `/r/:slug`, `/r/:slug/menu`,
  `/order/:branchId`, `/signin`, `/reset-password`, `/account/password`), staff area inside
  `AppShell` (13 routes), platform (`/admin`, `/admin/platform`). Guards are presentation-only
  (`RequireAuth`/`RequireProfile`/`RequireStaff`/`RequireSuperAdmin` + `NotAuthorized`).
- **Styling:** exactly 2 CSS files (`src/index.css` 30 lines, `src/components/AppShell.module.css`
  66 lines), 5 hard-coded hex colors, zero custom properties, zero `@media` queries, no
  `src/styles/` directory. No route titles (`document.title` never set), no error boundaries,
  no lazy routes.
- **QueryClient:** single module-level instance in `src/app/App.tsx` with **default options**
  (no retry/staleTime/error policy) — matches Master Plan FR-05's documented current behavior.
  Known per-query deviations in code: `staleTime` 60 s on the public restaurant read, 10 s
  customer poll, realtime `SUBSCRIBED` recovery refetch.
- **Feature modules (11):** audit, auth, management, menu, order, platform, realtime, reports,
  session, staffOps, tax — clients return discriminated results, hooks own query keys, mutations
  invalidate (no optimistic business writes).
- **Tests:** 13 Playwright suites (`e2e/`), chromium Desktop-Chrome only, `fullyParallel`,
  webServer `npm run dev` on :5173. Unit: 16 files / 276 tests, node environment,
  `renderToStaticMarkup` for component tests. DB: 31 files / 516 tests. Integration: 7 files /
  38 tests. `npm run verify` = format:check → lint → typecheck → test:unit → test:db →
  test:integration → build.
- **SpecKit:** `.specify/` with constitution v1.0.0, templates, PowerShell scripts,
  `feature.json` pointed at `specs/020-self-service-password-change`; 12 speckit skills under
  `.agents/skills/`; `scripts/mark-tasks.mjs`.
- **Impeccable:** `.impeccable/config.local.json` only (hook consent accepted). No `PRODUCT.md`,
  no `DESIGN.md`, no surface briefs. Skill not exercised in phase 0.
- **Environment:** Node v22.19.0, npm 10.9.3, Windows; `.env` present with the four documented
  variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL`,
  `SUPABASE_PROJECT_REF`); 36 migrations on disk.
- **Git:** clean tracked tree; untracked tool-config dirs `.agents/`, `.freebuff/`,
  `.zcode/skills/speckit-autopilot/` and the Master Plan file `RestoPilot-Frontend-Master-Plan.md`
  (untracked; per plan §8 Phase 01 git guidance these stay uncommitted).

## Master Plan citations used

- §6.2 pipeline (canonical per-phase order), §8 Phase 01 spec (scope/FRs/exit criteria),
- §12 gates F-G01…F-G14 + §12.2 command gates, §12.6 tiered validation,
- §16.1 "What to do first" (feature.json → specs/021, clarify via ask_questions).
