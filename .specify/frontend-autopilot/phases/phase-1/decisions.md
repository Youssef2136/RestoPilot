# Phase 01 Decisions

**Date:** 2026-09-27 · **Baseline:** `b569215`

## D1 — QueryClient policy = exact codification (no behavior change)

research.md R1/R2: the centralized client pins the v5 defaults the app already ran with (retry 3, staleTime 0, gcTime 5 min, refetchOnWindowFocus/Reconnect true; mutations retry false). Per-family deviations stay in their hooks. No "best practice" changes — any deviation that would alter observable behavior would be a clarify question (FR-05). Unit-pinned in `tests/unit/queryClient.test.ts`.

## D2 — RouteTitles as a sibling of `<Routes>`, not a layout route

The first implementation wrapped `<Routes>` in `<Route element={<RouteTitles />}>`; a layout route must render an `<Outlet>`, and RouteTitles renders null → the entire app blanked (caught by full E2E). The component is a plain sibling mounted above `<Routes>` inside the router fragment.

## D3 — DEV gating architecture: build-mode logic confined to router.tsx

Three iterations, driven by two contradicting constraints: (a) routes.ts is imported by E2E specs that Playwright transpiles WITHOUT Vite's `import.meta.env` defines; (b) the dev gallery must be dead-code-eliminated from production bundles, which requires statically-replaceable `import.meta.env.DEV` member reads (helper indirection or optional-chaining defeats rolldown's DCE — verified by dist grep). Resolution: routes.ts carries zero build-mode logic; router.tsx (Vite-only import graph) owns `import.meta.env.DEV`, the gallery route, and its registry entry, passing `extraRoutes` to RouteTitles/routeMetaFor. Bundle verified: gallery strings absent from dist.

## D4 — Console floor: expected-refusal list with justifications (F-G14)

`e2e/helpers/console.ts` collects console errors / pageerrors / requestfailed and asserts cleanliness per route, matching patterns against text AND location (browser resource errors have generic text). Expected entries: the boundary's own log (FR-03 evidence path) and the demo-slug `get_public_restaurant` 400 (a business refusal routes.test.ts has always asserted). Nothing silently ignored; Vite dev-messenger noise filtered as build-environment-only.

## D5 — Viewport projects scoped by testMatch

`mobile-chromium` (390×844) and `tablet-chromium` (834×1112) run only `e2e/responsive.smoke.test.ts`; the chromium project `testIgnore`s it. Keeps the 13 existing suites chromium-only and the E2E time budget flat while satisfying FR-08.

## D6 — eslint-plugin-jsx-a11y peer-range deviation

Plugin 6.10.2 declares peer eslint `^3–^9`; the repo runs ESLint 10. The plugin fully supports flat config (verified: rules execute, one real finding surfaced and fixed). `legacy-peer-deps=true` pinned in `.npmrc` with the justification; recorded for docs (FR-06).

## D7 — Error-view recovery links are plain anchors

The boundary holds the caught error; client-side navigation would re-render the fallback (the tree is poisoned). Full document loads are the reset the error state needs. Unit + E2E assert the anchors work.

## D8 — Impeccable `audit` verb unavailable; `detect` run as the baseline

The installed launcher (0.1.6) exposes `detect` (anti-pattern scan), not the Master Plan §6.1's `audit`. Ran `detect src` → exit 0, zero findings; recorded as the pre-design technical baseline evidence for Phases 15/18. Deviation documented here rather than inventing a command.

## D9 — Verification order and evidence discipline

Tier order for clean evidence: db:reset → test:db → test:integration (quiet window) → build; E2E last (its mutations poison fixtures). The W1 inter-file race and 429 windows are recorded per phase-0 precedent (D4 there): every gate green individually; the deviation is documented, not absorbed silently.
