# Research: Frontend Foundation & Architecture Baseline (Phase 01)

**Date:** 2026-09-26 · **Feature:** `specs/021-frontend-foundation` · **Method:** repository evidence only (Master Plan §8 Phase 01 FR-05 mandates an evidence-based process; no guessed policy).

## R1 — Current QueryClient behavior (FR-05 step 1: document current behavior)

Every claim below was verified by reading the file cited; commit `b569215`.

| Fact | Evidence |
| --- | --- |
| Single module-level `QueryClient` with **default options** (`new QueryClient()` — no shared `retry`/`staleTime`/`gcTime`/`refetchOnWindowFocus`/error policy) | `src/app/App.tsx` line 8 |
| TanStack Query v5 defaults therefore apply app-wide: `retry: 3` (queries), **no mutation retry**, `staleTime: 0`, `gcTime: 5 min`, `refetchOnWindowFocus: true`, `refetchOnReconnect: true`, `refetchOnMount: true` | @tanstack/react-query 5.102 defaults (package in `package.json`) |
| `staleTime: 60_000` + `retry: false` on the public restaurant read | `src/features/session/useSession.ts` (`usePublicRestaurant`) |
| `refetchInterval: 10_000` + `retry: false` customer rounds poll (the customer's "live" status; no realtime subscription for customers) | `src/features/order/useOrder.ts` (`useSessionRounds`) |
| `retry: false` on `useSessionContext` and `useSessionMenu` (token-scoped reads must not retry a refused/expired token) | `src/features/session/useSession.ts` |
| Staff surfaces rely on **refetch-on-focus** (default `true`) — no per-hook override found | absence of `refetchOnWindowFocus` in `src/**` (code search) |
| Realtime `SUBSCRIBED` (first connect **and** every reconnect) triggers a recovery refetch; 200 ms coalescing; events never rendered | `src/features/realtime/useRealtimeInvalidation.ts` |
| Mutations invalidate query keys in `onSuccess`; no optimistic business writes | `useEnterSession`, `useSubmitRound`, all `use*` mutation hooks |
| Error surfacing: query errors are thrown by `queryFn` from discriminated results; pages render `role="alert"` with the message verbatim; errors are not retried for token-scoped reads | clients in `src/features/*/​*Client.ts`, 54 `role="alert"` usages |

**Behavior-sensitive settings** (FR-05 step 3) and what must not change:

| Setting | Current observable behavior | What a change would break |
| --- | --- | --- |
| `retry: 3` (query default) | transient failures on staff reads retry before the error state renders | error-state timing tests; perceived latency under refusal |
| mutation retry (none) | a failed mutation surfaces its message immediately | double-submit semantics of RPC-only writes (E2E asserts refusal text) |
| `staleTime: 0` default | staff navigations always refetch (freshness) | stale context/branch data in role-gated views |
| `staleTime: 60_000` on public restaurant read | entry page avoids hammering the public RPC within a minute | E2E entry-flow request cadence |
| `refetchInterval: 10_000` customer poll | customer sees round-state transitions within 10 s (012 US3) | the poll cadence is E2E-asserted behavior |
| `refetchOnWindowFocus: true` | staff surfaces refresh on focus (their "liveness" complement to realtime) | staff freshness assumptions |
| realtime `SUBSCRIBED` recovery refetch | reconnect correctness after dropouts | realtime.test.ts recovery assertions |
| error surfacing (verbatim server message) | refusals render in `role="alert"` | F-A07/FA-7 — the server's message is the message |

## R2 — Proposed policy (FR-05 step 2: define before touching code)

**Decision: the centralized client sets defaults that reproduce today's behavior exactly.** The policy is *codification*, not improvement. Defaults table (to be pinned by unit assertions in `tests/unit/queryClient.test.ts`):

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,                    // v5 default, kept — staff reads retry transients
      staleTime: 0,                // v5 default, kept — staff navigations refetch
      gcTime: 5 * 60 * 1000,       // v5 default, kept
      refetchOnWindowFocus: true,  // v5 default, kept — staff freshness
      refetchOnReconnect: true,    // v5 default, kept — complements SUBSCRIBED recovery
    },
    mutations: {
      retry: false,                // v5 default, kept — RPC-only writes never auto-resubmit
    },
  },
})
```

**Per-query-family deviations (already in code, unchanged, documented in the policy):** `retry: false` + `staleTime: 60_000` (`usePublicRestaurant`); `retry: false` (token-scoped session reads); `retry: false` + `refetchInterval: 10_000` (`useSessionRounds`). Deviations stay in their hooks — the client centralizes only what is truly shared.

**Rationale:** Master Plan FR-05: "No query-policy change is accepted merely as a generic best practice; any deviation that would alter observable behavior is a clarify question." Zero behavior-affecting changes ⇒ zero clarify questions needed. Alternatives (global `staleTime: 30_000`, global `retry: 1` on mutations) were evaluated and rejected: both alter observable behavior without a requirement.

## R3 — Tooling decisions

- **`eslint-plugin-jsx-a11y`** (dev-only, Clarification Q2 approved): flat-config plugin registered in a `src/**` config block; strict subset used — the rule set that errors on genuinely broken semantics (`alt-text`, `anchor-is-valid`, `aria-props`, `aria-role`, `aria-unsupported-elements`, `label-has-associated-control`, `no-access-key`, `no-autofocus`, `no-distracting-elements`, `no-redundant-roles`, `no-static-element-interactions` as **warn** initially, `role-has-required-aria-props`, `tabindex-no-positive`, `heading-has-content`, `html-has-lang`, `iframe-has-title`). Configured as errors where the current tree already passes — verified by running lint before finalizing. Codebase audit found: all inputs labeled (73 associations), all images alt'ed (`menuImages` renders `<img>` with alt), `html[lang]` already in `index.html`.
- **`@axe-core/playwright`** (dev-only, Q2 approved): WCAG 2.2 AA target (Q2). Signed-out baseline routes: `/`, `/signin`, `/reset-password`, plus `/dashboard` (redirects to sign-in — the signed-out staff posture). Scan helper `e2e/helpers/a11y.ts` with a committed-baseline waiver list (empty at first run if axe finds nothing; any finding is recorded, never silently waived).
- **Viewport projects** (FR-08): two new tagged Playwright projects `mobile-chromium` (390×844) and `tablet-chromium` (834×1112) reusing `devices['Desktop Chrome']` with overridden viewport. **Console/a11y suites are tagged desktop-only; smoke routes tests get `test.describe.configure({ mode: 'serial' })`-free normal parallel runs but must run under every project.** Note on suite count: projects multiply suites that don't filter by tag; E2E time budget respected by giving the new viewport projects **only the route smoke suite** (`e2e/responsive.smoke.test.ts`, new, ~8 assertions) — existing 13 suites stay `chromium`-only via `testMatch`-scoped projects.
- **Console-cleanliness helper** (F-G14 semantics): `e2e/helpers/console.ts` — collects `console` errors, `pageerror`, `requestfailed`; expected-refusal list is an explicit array in the helper keyed by route (empty today: no route currently surfaces an expected console error; business refusals render as `role="alert"` text, not console errors — verified in the denial E2E assertions). Wired into the new route-sweep spec (`e2e/route.titles.test.ts`), which also asserts per-route titles.
- **Route registry:** `src/app/routes.ts` — `export type RouteMeta = { path, title, description }`; `ROUTES: RouteMeta[]` enumerating all 25 paths (+ `/dev/gallery` in DEV builds) + a `titleFor(pathname)` matcher supporting the two dynamic segments (`/r/:slug`, `/r/:slug/menu`, `/order/:branchId`, `/dashboard/branches/:branchId`, `.../menu`, `.../tax`). `RouteTitles` component in `src/app/RouteTitles.tsx` applies `document.title` + the meta description on `useLocation()` change. `main` landmark: the shell's `<main>` gets `id="main"` so the skip link targets it (AppShell edit is the only existing-component edit allowed — it is structural: `id`, `SkipLink` mount point, `ErrorBoundary` wrapper).
- **Error boundary:** `src/components/ErrorBoundary.tsx` — class component (`renderToStaticMarkup`-testable like existing unit tests), `componentDidCatch` re-throws nothing (logs via `console.error` once — expected and excluded by the console assertion's boundary-aware list), fallback `RouteErrorView` with `role="main"`-safe structure, H1 "Something went wrong", route-back buttons (dashboard when signed-in posture unknown → both public entry + sign-in links), never exposes `error.message`. Top-level boundary wraps `AppRouter` in `App.tsx`; boundary-inside-boundary renders the minimal static fallback (spec edge case).
- **404:** `NotFoundView` route `*` — Q1 decision: dedicated 404, links to `/` and `/dashboard`.
- **Styles pipeline:** `src/styles/reset.css` (box-sizing, margin resets, media defaults) + `src/styles/base.css` (font stack moved from `index.css`, `:focus-visible` outline policy, `.skip-link` styling, `#main` scroll-margin). Import order in `main.tsx`: `styles/reset.css` → `styles/base.css` → `index.css` (kept: `h1`/`p` typographic defaults that the 25 existing pages render with today — moving them into base.css is cosmetic-equivalent but `index.css` deletion risks zero-benefit churn; documented as the reserved Phase 02 consolidation point). `index.css` loses its `:root` font/color block to base.css; raw hex stays until Phase 02 tokens (documented absence per FR-01 — no NEW token values added here).
- **Skip link:** `SkipLink` component in `src/components/SkipLink.tsx`, visually-hidden-until-focus, first tabbable element (rendered first inside `AppShell`).
- **Dev gallery:** `src/routes/DevGalleryPage.tsx` at `/dev/gallery`, gated `import.meta.env.DEV` in the router (not rendered at all in production builds — route literally absent), excluded from route-sweep test via `process.env.NODE_ENV !== 'production'` filter in the registry consumer.
- **Ledger generation:** hand-generated this phase from `e2e/**` + `src/**` (greps: `getByRole|getByLabel|getByText`, `data-[a-z-]+=` in tests, `data-testid`, `localStorage`), committed as `docs/frontend-presentation-contracts.md` with the four categories (A/B/C/D) and change-cost discipline; a regeneration note documents the grep recipes so future phases regenerate rather than hand-append.

## R4 — Structure decisions

- `src/app/routes.ts` (registry) lives beside `router.tsx`; pages do not import it (metadata applied centrally — FR-02).
- `QueryClient` moves to `src/app/queryClient.ts` exporting `createQueryClient()` (factory) + the singleton; `App.tsx` consumes; unit test imports the factory to assert defaults without touching the app singleton.
- Test helper placement: `e2e/helpers/{a11y,console}.ts` — `e2e/` has no helpers dir today; creating it is conventional Playwright layout.

## R5 — Risks

| Risk | Mitigation |
| --- | --- |
| axe finds violations on existing surfaces | baseline waiver list records each finding with justification; CRITICAL/serious findings become fix tasks in this phase if trivially fixable (e.g. missing landmark), else recorded for Phase 15 |
| Console assertion fails on pre-existing dev-only noise | helper filters Vite dev-messenger noise (`[vite]`); production guard test unaffected |
| Viewport projects double E2E runtime | new viewport projects run only the new smoke suite (project-scoped `testMatch`) |
| `role="alert"`/`role="status"` + axe | verified live-region roles are axe-clean |
| Rate-limit discipline (D4) | E2E run adds no sign-ins (sweep uses signed-out routes + storage-state reuse from existing suites' pattern — actually zero sign-ins: titles sweep is all public/redirect routes) |
