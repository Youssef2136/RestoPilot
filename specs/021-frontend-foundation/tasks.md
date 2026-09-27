# Tasks: Frontend Foundation & Architecture Baseline (Frontend Phase 01)

**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md)

**Tests are mandatory in this feature** — the spec's acceptance scenarios are test-asserted (SC-001…SC-006).

**Mode:** structural — no visual design decisions; no token values; no behavior change.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependencies)
- **[Story]**: owning user story (US1…US6 from spec.md)

## Phase 1: Setup (shared infrastructure)

- [ ] T001 [P] [Setup] Create `src/styles/reset.css` and `src/styles/base.css` — neutral normalization only: box-sizing/margin/media resets; font stack moved from `index.css`; `:focus-visible` outline policy; `.skip-link` visually-hidden-until-focus styling; `#main` scroll-margin. **No token values, no component styling** (FR-01).
- [ ] T002 [Setup] Update `src/main.tsx` import order: `./styles/reset.css` → `./styles/base.css` → `./index.css` (documented order, FR-01); strip the `:root` font/color block from `index.css` into base.css (index.css keeps only the `h1`/`p` defaults it owns today).

## Phase 2: Foundational (blocking prerequisites)

- [ ] T003 [Foundational] Create `src/app/queryClient.ts`: `createQueryClient()` factory returning the client with the exact defaults from research.md R2 (queries: retry 3, staleTime 0, gcTime 300000, refetchOnWindowFocus true, refetchOnReconnect true; mutations: retry false) + the app singleton. Update `src/app/App.tsx` to import it (FR-05; no observable behavior change — SC-004).
- [ ] T004 [P] [Foundational] Create `src/app/routes.ts`: `RouteMeta { path, title, description }` + `ROUTES` array enumerating all 25 registered paths (dev gallery entry DEV-only) + `titleFor(pathname)` matcher for the dynamic patterns (`/r/:slug`, `/r/:slug/menu`, `/order/:branchId`, `/dashboard/branches/:branchId(/menu|/tax)`) (FR-02).
- [ ] T005 [Foundational] Create `src/app/RouteTitles.tsx`: on `useLocation()` change apply `document.title` and the meta description from the registry; mount once above `<Routes>` in `router.tsx` (FR-02).

## Phase 3: US1 — The app never white-screens (P1) 🎯 MVP

**Goal**: render errors and unknown paths always produce recoverable views.

- [ ] T006 [US1] Create `src/components/RouteErrorView.tsx`: recoverable error view — H1 "Something went wrong", human-readable copy, links "Go to dashboard" (`/dashboard`) and "Go to sign-in" (`/signin`); never renders `error.message` (FR-03).
- [ ] T007 [US1] Create `src/components/ErrorBoundary.tsx`: class component, catches render errors, renders `RouteErrorView`; when it nests inside an already-thrown boundary, renders a minimal static fallback (spec edge case); wrap `AppRouter` at the top level in `src/app/App.tsx` (FR-03).
- [ ] T008 [US1] Create `src/components/NotFoundView.tsx` (H1 "Page not found", route back to `/` and `/dashboard`) and register the `*` catch-all route in `router.tsx` — dedicated 404 per Clarification Q1, no redirect (FR-04).
- [ ] T009 [US1] Unit tests `tests/unit/errorBoundary.test.tsx`: throwing child → fallback markup (H1 present; error message absent); nested boundary → minimal fallback; non-throwing child → child renders (SC-002).

## Phase 4: US2 — Every route is addressable and titled (P1)

- [ ] T010 [US2] Unit tests `tests/unit/routeRegistry.test.ts`: every path exported by `ROUTES` has non-empty title + description; no duplicate paths; `titleFor()` resolves sample dynamic values; dev-gallery entry absent when `import.meta.env.DEV` is false (SC-001).
- [ ] T011 [US2] E2E `e2e/route.titles.test.ts`: title + meta description sweep over the public/signed-out reachable routes; unknown path renders the 404 view (SC-001, SC-002).

## Phase 5: US3 — One documented, centralized query policy (P2)

- [ ] T012 [US3] Unit tests `tests/unit/queryClient.test.ts`: pin every default from research.md R2 (SC-004). Extend `docs/development.md` (T023) with the policy statement — defaults table, where defaults apply, and the deviation-registration process (a deviation that would alter observable behavior is a clarify question, never a silent default change; FR-05 AC2).

## Phase 6: US4 — Automated a11y, viewport, and console floor (P2)

- [ ] T013 [US4] Add dev-only deps `eslint-plugin-jsx-a11y` + `@axe-core/playwright` (Q2-approved); register the jsx-a11y plugin in `eslint.config.js` for `src/**` with the strict rule subset from research.md R3; fix any lint findings it surfaces (FR-06).
- [ ] T014 [US4] Create `e2e/helpers/console.ts`: collector for `console.error`/`pageerror`/`requestfailed` with `[vite]` dev-messenger filter and the explicit expected-refusal list (empty today) (FR-08, F-G14).
- [ ] T015 [US4] Create `e2e/helpers/a11y.ts`: axe scan helper (WCAG 2.2 AA) + committed baseline waiver list — findings recorded, never silently waived (FR-07).
- [ ] T016 [US4] E2E `e2e/a11y.baseline.test.ts`: axe baseline on `/`, `/signin`, `/reset-password`, `/dashboard` (signed-out) (FR-07).
- [ ] T017 [US4] Wire the console collector into `e2e/route.titles.test.ts` sweep (at least one assertion per top-level route) (FR-08).
- [ ] T018 [US4] Create `e2e/responsive.smoke.test.ts` (no-horizontal-overflow sweep of public surfaces) and add the tagged `mobile-chromium` (390×844) + `tablet-chromium` (834×1112) projects to `playwright.config.ts` scoped via `testMatch` so existing suites stay chromium-only (FR-08).

## Phase 7: US6 — Styles pipeline and base accessibility (P3)

- [ ] T019 [US6] Create `src/components/SkipLink.tsx` (first tabbable element) and mount it in `src/components/AppShell.tsx`; give the shell's `<main>` element `id="main"` (structural edit only) (SC per US6).
- [ ] T020 [P] [US6] Unit test `tests/unit/stylesPipeline.test.ts`: source-assert `main.tsx` import order reset → base → index.css; assert base.css contains no hex colors / token values beyond the moved font stack (documented absence, FR-01).

## Phase 8: US5 — The presentation-contract ledger (P2)

- [ ] T021 [US5] Generate `docs/frontend-presentation-contracts.md` from `e2e/**` + `src/**` (grep recipes recorded in-document): Category A (accessible names/roles/headings/live regions), B (`data-*` state hooks), C (`data-testid`), D (frozen localStorage keys `restopilot.session-token`, `restopilot.cart`), each with change-cost discipline; cross-check counts against SC-005 (~666 A assertions, 10 B hooks, 16 C hooks) (FR-10).

## Phase 9: Dev gallery (FR-09)

- [ ] T022 [Gallery] Create `src/routes/DevGalleryPage.tsx` (renders the styles/structure available so far: skip link, focus ring, error/404 views as inert demos) and register `/dev/gallery` in `router.tsx` behind `import.meta.env.DEV` so production builds exclude the route entirely (FR-09, Q3).

## Phase 10: Polish & cross-cutting

- [ ] T023 [Polish] Update `docs/conventions.md` (styles pipeline placement rules, route metadata registry convention, error/404 behavior) and `docs/development.md` (a11y lint usage, axe floor, viewport projects, console assertions, ledger location, query policy location; FR-12 script registrations — none planned, verify unchanged per Q4) (FR-11).
- [ ] T024 [Polish] Run the milestone validation: `npm run verify` + `npm run test:e2e`; capture per-viewport evidence screenshots into `specs/021-frontend-foundation/evidence/`; record tier results.

## Dependencies & Execution Order

- T001–T002 (styles) before T019/T020 (skip link + pipeline test).
- T003 (query client) independent; T004 before T005; T005 before T011 sweep.
- US1 (T006–T009) before T022 (gallery renders the error views).
- T013–T018 (tooling) before T024 milestone.
- T021 (ledger) any time after the e2e suites exist (it inventories their selectors); before T023 docs (docs reference it).

## Validation Checkpoint

- After Phase 2: `npm run lint && npm run typecheck && npm run test:unit` (targeted).
- After Phase 8/9: `npm run build` (gallery exclusion proof) + `npm run test:unit`.
- Milestone (T024): full `npm run verify` + `npm run test:e2e` (rate-limit discipline: no `test:integration` within the same 5-minute window).
