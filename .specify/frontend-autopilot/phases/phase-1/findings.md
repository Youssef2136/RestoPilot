# Phase 01 Findings & Actions

**Date:** 2026-09-27 · **Baseline:** `b569215`

## F1 — Layout-route null renders blank the whole app (CRITICAL → FIXED)

RouteTitles was first registered as `<Route element={<RouteTitles />}>` wrapping AppShell. A layout route must render an `<Outlet>`; RouteTitles returns null → every page below rendered nothing. Symptom: the first full E2E run showed 8 new-suite failures + mass sign-in timeouts waiting for `getByLabel('Email')` on a blank page. Fixed (see decisions D2) and re-proven: smoke/routes suites green immediately after; final full run 126/127.

## F2 — Vite defines absent outside Vite (HIGH → FIXED)

`import.meta.env.DEV` crashed when E2E specs imported `src/app/routes.ts` (Playwright transpile has no Vite defines → `import.meta.env` undefined). First fix (optional-chain) created F3; final fix: try/catch `isDevBuild()` in routes.ts… then superseded by F3's architecture.

## F3 — Defensive env read defeated DCE: gallery leaked into the production bundle (HIGH → FIXED, caught by own gate)

`import.meta.env?.DEV` and a helper-function form both prevented Vite/rolldown from statically replacing the DEV flag → the dev-gallery branch (and strings) survived into `dist/assets/*.js`. Discovered by the phase's own dist grep during validation (the bundle check FR-09 demands). Final architecture (decisions D3): all build-mode logic in router.tsx with direct member reads; routes.ts is define-free; RouteTitles receives `extraRoutes`. Verified: `GALLERY-EXCLUDED`, unit 295/295, new E2E 27/27, full run 126/127.

## F4 — Browser resource errors: text is generic, location carries identity (MEDIUM → FIXED)

The console helper initially matched expected patterns against message text only; Chromium logs `Failed to load resource: the server responded with a status of 400 ()` with the URL in `location`. Matching now spans `${text} ${location}`; the demo-slug entry-probe 400 is a recorded expected refusal with justification (F-G14 semantics demonstrated on a real case).

## F5 — Guarded-route sweep raced the signed-out redirect (MEDIUM → FIXED)

The redirect fires in an effect after a synchronous session read — `networkidle` passes before it. The sweep now settles on the final URL for guarded entries (asserting the `/signin` landing) and on an H1 for public routes.

## F6 — jsx-a11y lint found one real defect in existing code (LOW → FIXED)

`img-redundant-alt` on `ItemImageField` (`alt="Item image"`). E2E asserts nothing about that alt; the enclosing section is labeled. Fixed to `alt=""` (decorative). Confirms the FR-06 rule set is live and useful.

## F7 — Environmental (documented carry-forward, unchanged from phase 0)

- **W1 residue/ordering defect:** mutating suites leave fixture mutations; vitest file-parallelism lets spec-020's scratch membership (`…b201`) coexist with `auth.signin`'s exact-count matrix → the only integration failure seen under `verify` (passes standalone 38/38, including `--no-file-parallelism`); same class produced the single full-E2E failure (`management.surfaces:36`, passes isolated). Owner-owned teardown fix still recommended for the phase that owns those suites (Phase 14 candidate).
- **429 windows:** two occurrences during back-to-back integration runs; D4 protocol applied; final runs clean.

## F8 — Impeccable launcher inventory vs Master Plan §6.1 (LOW → DOCUMENTED)

The installed binary (v0.1.6) has no `audit`/`critique`/`polish` verbs — only `detect`, `ignores`, `install`, `link`, `update`, `check`. `detect src` → 0 findings (recorded as the Phase 15/18 baseline). Future phases must re-verify the installed verb list instead of trusting §6.1.
