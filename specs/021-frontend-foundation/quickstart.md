# Quickstart: Frontend Foundation & Architecture Baseline (Phase 01)

Validation walkthrough for the implemented phase. Prerequisites: the standard setup in `docs/development.md` (migrated + seeded cloud dev project, `npm install`).

## 1. Static gates

```bash
npm run format:check && npm run lint && npm run typecheck
```

Expected: PASS. Lint now includes `eslint-plugin-jsx-a11y` rules over `src/**` (FR-06) — a violation here is a phase failure, not a warning to ignore.

## 2. Unit tier (incl. the FR-05 evidence pins)

```bash
npm run test:unit
```

Expected: all existing 276 tests plus the new suites pass:

- `tests/unit/queryClient.test.ts` — pins `createQueryClient()` defaults to research.md R2 (SC-004 evidence).
- `tests/unit/routeRegistry.test.ts` — every registered path has title + description.
- `tests/unit/errorBoundary.test.tsx` — fallback renders, no internal message leaked, nested boundary stays minimal.
- `tests/unit/stylesPipeline.test.ts` — `main.tsx` import order reset → base → index.css.

## 3. Production build

```bash
npm run build
```

Expected: PASS. The bundle must not contain `/dev/gallery` strings or route registration (FR-09) — the gallery is DEV-gated in the router. `tests/unit/production.guard.test.ts` (inside test:unit) proves no non-`VITE_` env var reached the bundle.

## 4. E2E tier

```bash
npm run test:e2e
```

Expected: all 13 existing suites pass unchanged (SC-003) **plus** the new suites:

- `route.titles.test.ts` — every public route title matches the registry; meta description present; unknown path renders the 404 view; console collector reports zero unexpected errors/rejections/failed requests (F-G14 semantics; expected-refusal list is explicit and empty today).
- `a11y.baseline.test.ts` — axe WCAG 2.2 AA floor on `/`, `/signin`, `/reset-password`, `/dashboard` (signed-out); only committed-baseline findings are waived.
- `responsive.smoke.test.ts` — runs under `mobile-chromium` (390×844) and `tablet-chromium` (834×1112) projects; current surfaces render without horizontal overflow.

Rate-limit discipline (phase 0 decision D4): the new suites perform **zero sign-ins**; do not run this tier twice within a 5-minute window after `test:integration`.

## 5. Manual spot checks (browser)

1. Visit an unknown path (e.g. `/nope`) → 404 view with working links to `/` and `/dashboard` (Q1).
2. Tab from page load on `/signin` → skip link appears first, activating it jumps focus to `#main`.
3. Every navigation updates the tab title per route.

## 6. Ledger review

Open `docs/frontend-presentation-contracts.md` and cross-check one entry per category (A/B/C/D) against `e2e/**` — the ledger is generated from the tests, not from memory (FR-10).

## 7. Full gate (milestone)

```bash
npm run verify
```

Expected: PASS end-to-end (SC-006). `verify` is unchanged except for any new script registrations (FR-12) — none are planned (a11y lint rides `lint`; axe rides `test:e2e` per Clarification Q4).
