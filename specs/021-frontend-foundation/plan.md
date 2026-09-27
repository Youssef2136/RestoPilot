# Implementation Plan: Frontend Foundation & Architecture Baseline (Frontend Phase 01)

**Branch**: `021-frontend-foundation` (executed on `main` per repo convention) | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-frontend-foundation/spec.md` (6 user stories, 12 FRs, 6 SCs; 4 owner clarifications Q1–Q4 recorded).

## Summary

Give every later frontend phase a safe substrate, per Master Plan §8 Phase 01: a `src/styles/` pipeline imported once in documented order; a central route-metadata registry driving `document.title` + meta description for every registered route; a top-level error boundary with recoverable error and 404 views; a centralized, evidence-based QueryClient policy that codifies current behavior exactly (FR-05, research.md R1/R2); a11y lint (`eslint-plugin-jsx-a11y`), an axe E2E floor (`@axe-core/playwright`), Playwright viewport projects (mobile/tablet), and console-cleanliness assertions (F-G14 semantics); a dev-only `/dev/gallery` route excluded from production; the committed presentation-contract ledger (FR-10, four stability categories); and FR-11 docs updates. No visual design decisions, no token values, no behavior change.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict), React 19.2, Node 22 LTS
**Primary Dependencies**: react-router 7.18 (declarative `<Routes>`), @tanstack/react-query 5.102, Vite 8, Playwright 1.63, Vitest 5, ESLint 10 (flat config)
**Storage**: Supabase Cloud (unchanged; no data-layer change in this phase)
**Testing**: Vitest (node env, `renderToStaticMarkup` for components), Playwright (chromium Desktop Chrome; new tagged viewport projects), `npm run verify` = format:check → lint → typecheck → unit → db → integration → build
**Target Platform**: Cloudflare Pages SPA (`dist/`), Chromium-only E2E this phase (WebKit/Firefox deferred to Phase 16)
**Project Type**: Web SPA — single-project layout
**Performance Goals**: none new (no runtime dependency; CSS-only additions)
**Constraints**: zero observable behavior change (SC-003/SC-004); E2E sign-in budget untouched (30/5min IP limit); production bundle must stay free of non-`VITE_` vars (production.guard.test.ts stays green)
**Scale/Scope**: 25 registered routes + dev gallery; 13 existing E2E suites must stay green

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after design below.*

| Principle | Verdict |
| --- | --- |
| I Business Scope Integrity | PASS — no feature added; 404/error/gallery are infrastructure |
| II Specs are business truth | PASS — spec.md (Q1–Q4 answered) is the source; plan derives from it |
| III Multi-Tenant Isolation | PASS — no new reads; gallery uses static fixtures |
| IV Server-Enforced Authorization | PASS — no guard decision touched; boundary/404 render after guard decisions |
| V Database as source of truth | PASS — no database change |
| VI Explicit state/data integrity | PASS — error/404 states are explicit, not silent |
| VII Auditability | PASS — ledger + docs record the contract surface |
| VIII Minimal complexity | PASS — two approved dev-only deps (Q2); zero runtime deps; QueryClient policy codifies rather than extends |

## Project Structure

### Documentation (this feature)

```text
specs/021-frontend-foundation/
├── spec.md              # exists (phase 0 output, Q1–Q4 answered)
├── plan.md              # this file
├── research.md          # FR-05 evidence process + tooling decisions (phase 0 output §2.3 done)
├── quickstart.md        # validation walkthrough
└── checklists/requirements.md  # exists (phase 0 output)
```

(`data-model.md` and `contracts/` omitted with justification: no entities, no API/RPC/data contracts — this phase's "contract" artifacts are the route registry (`src/app/routes.ts`) and the committed ledger (`docs/frontend-presentation-contracts.md`).)

### Source Code (repository root)

```text
src/
├── app/
│   ├── App.tsx                # wraps router in ErrorBoundary; consumes queryClient.ts
│   ├── queryClient.ts         # NEW: createQueryClient() factory + singleton (FR-05)
│   ├── routes.ts              # NEW: route metadata registry (FR-02)
│   ├── RouteTitles.tsx        # NEW: applies title + meta description (FR-02)
│   └── router.tsx             # + /dev/gallery (DEV-gated) + * NotFoundView
├── components/
│   ├── AppShell.tsx           # + <SkipLink/> and <main id="main"> (structural only)
│   ├── ErrorBoundary.tsx      # NEW (FR-03)
│   ├── RouteErrorView.tsx     # NEW (FR-03 fallback)
│   ├── NotFoundView.tsx       # NEW (FR-04, Q1: dedicated 404)
│   └── SkipLink.tsx           # NEW (US6)
└── routes/
    └── DevGalleryPage.tsx     # NEW dev-only gallery page (FR-09)
├── styles/                    # NEW: reset.css, base.css (FR-01; no token values)
└── main.tsx                   # imports reset → base → index.css in order

e2e/
├── helpers/a11y.ts            # NEW axe scan helper + baseline waiver list (FR-07)
├── helpers/console.ts         # NEW console/rejection/request-failure collector (FR-08, F-G14)
├── a11y.baseline.test.ts      # NEW (FR-07)
├── responsive.smoke.test.ts   # NEW (FR-08 viewports)
└── route.titles.test.ts       # NEW (FR-02/FR-04 sweep + console assertions)

docs/
├── frontend-presentation-contracts.md  # NEW ledger (FR-10)
├── conventions.md             # FR-11 update
└── development.md             # FR-11 update (+ FR-12 script registrations if any)
```

**Structure Decision**: existing single-project SPA layout preserved (FA-6); new shared components in `src/components/`, app-level composition in `src/app/`, no feature-module changes.

## Design Direction

**Structural phase — `shape` skipped (justified per Master Plan §6.2 ordering notes).** Mode: none (Operate-mode surfaces begin Phase 03). No direction contract; the phase renders no new visual world — only neutral normalization (reset/base), focus-visible policy, skip link, and honest error/404 states using existing unstyled conventions. `Impeccable audit` runs once post-implementation as a pre-design technical baseline for Phases 15/18 (Master Plan §8 Phase 01 Impeccable Workflow).

## Contract Consumption

No RPC, table, RLS, or authorization surface is consumed or changed (backend impact: **NOT_REQUIRED**). Client-side contracts this phase *establishes*: route registry shape (`RouteMeta`), `createQueryClient()` factory, the committed presentation-contract ledger. Contracts this phase *must not break*: the ~666 accessible-name assertions, 10 `data-*` hooks, 16 `data-testid` hooks, frozen localStorage keys (ledger FR-10).

## State Matrix

| State | Where | Outcome |
| --- | --- | --- |
| Render error (any route subtree) | `ErrorBoundary` | recoverable view: H1, human-readable text, "Go to dashboard" / "Go to sign-in" links; no error.message exposure; boundary-in-boundary → minimal static fallback |
| Unknown path | `*` route | dedicated 404 view (Q1): H1 "Page not found", route back to `/` and `/dashboard` |
| Signed-out staff deep link | unchanged | existing redirect → sign-in (guards untouched) |
| Gallery in production | router | `/dev/gallery` absent (route not registered outside DEV) |
| Document title | every route | registry title; dynamic segments render generic fallbacks for unresolvable params |
| App shell load | unchanged | existing behavior (no loading-state change) |

## Presentation-Contract Migration

**None — intentionally.** No accessible name, heading, role, `data-*`, `data-testid`, or localStorage key changes. New hooks introduced by this phase (recorded in the ledger under new entries): `<main id="main">` skip-link target; `document.title` per route. Existing suites stay untouched and green (SC-003).

## Accessibility Plan

- `html[lang="en"]` (already in index.html — asserted).
- Skip link: first tabbable element, target `#main`, visible on focus.
- `:focus-visible` outline policy in base.css (never `outline: none` without replacement).
- Error/404 views: semantic `h1`, real links (`<a>`/`<Link>`), concise text, no hover-only affordances.
- Error boundary fallback announces itself structurally (role `alert` on the message container for SR pickup).
- axe floor: WCAG 2.2 AA automatable subset on `/`, `/signin`, `/reset-password`, `/dashboard` (signed-out), per FR-07; findings recorded as baseline, serious+ become fix tasks.
- jsx-a11y lint on `src/**` (FR-06).

## Responsive Plan

Breakpoint *names* documented (mobile/tablet/desktop/wide) — values stay Phase 02 (FR-01 documented absence). Viewport *tooling* lands now: projects `mobile-chromium` (390×844) and `tablet-chromium` (834×1112) running `e2e/responsive.smoke.test.ts` — asserting current surfaces render without horizontal overflow at those widths. No responsive CSS written this phase.

## Testing Strategy

- **Unit (Vitest, node env):**
  - `tests/unit/queryClient.test.ts` — asserts `createQueryClient()` defaults exactly match research.md R2 (retry 3, staleTime 0, gcTime 300000, refetchOnWindowFocus true, mutations retry false). SC-004 pin.
  - `tests/unit/routeRegistry.test.ts` — every registered path (from `src/app/router.tsx` paths, imported from the registry) has a non-empty title + description; dynamic-pattern matcher resolves sample slugs; no duplicate paths.
  - `tests/unit/errorBoundary.test.tsx` — `renderToStaticMarkup` of a throwing child inside `ErrorBoundary` renders the fallback (H1 present, no error.message); nested boundary renders the minimal static fallback.
  - `tests/unit/stylesPipeline.test.ts` — `src/main.tsx` import order asserts reset before base before index.css (source-text assertion, matching repo's lightweight method).
- **E2E (Playwright, chromium + new tagged viewport projects):**
  - `route.titles.test.ts` — sweep: public routes assert `toHaveTitle` + meta description; unknown path shows 404 view; console-cleanliness collector active on every swept route (errors, pageerrors, requestfailed — with the explicit expected-refusal list, empty today, plus `[vite]` dev-messenger filter).
  - `a11y.baseline.test.ts` — axe scan on the four signed-out baseline routes; violations outside the committed baseline fail.
  - `responsive.smoke.test.ts` — the routes sweep at 390×844 and 834×1112 (body scrollWidth ≤ viewport width + 1 tolerance for scrollbar rounding).
- **Existing tiers:** `npm run verify` full gate at milestone; all 13 existing suites green unchanged (SC-003).

## Evidence Plan

- Per-viewport screenshots of `/`, `/signin`, 404, and (DEV) gallery captured into `specs/021-frontend-foundation/evidence/` at validation time (gitignored `.impeccable/review/**` policy does not apply; this curated subset is the Master Plan §6.6 "curated subset" pattern).
- Tier outputs recorded in `.specify/frontend-autopilot/phases/phase-1/validation.md`.
- `Impeccable audit` baseline output recorded in findings (Phase 15/18 reference).

## Complexity Tracking

No constitution violations. No workarounds.
