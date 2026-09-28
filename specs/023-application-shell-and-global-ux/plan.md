# Phase 03 Implementation Plan — Application Shell, Navigation & Global UX

**Feature dir:** `specs/023-application-shell-and-global-ux` · **Baseline:** `306c0ae` · **Date:** 2026-09-27

## Summary

Split the placeholder `AppShell` into `StaffShell` (+ platform variant) and `CustomerShell`,
driven by one navigation-model declaration; add the shell-level ContextSwitcher, restructure
`DashboardPage` into a real home, and wire the global UX infrastructure (toast host, confirm
dialog adoption, offline/reconnect banner, session-expiry note, NotAuthorized restyle, mobile
drawer). No path changes; no auth-flow changes; no new data reads.

## Backend impact

**NOT_REQUIRED** — consumes only `current_auth_context` + the existing policy-scoped `branches`
read + realtime channel status (existing bindings).

## Design direction (surface brief, code-led)

- **THESIS** — The chrome frames the work: the sidebar is the map of the member's actual power
  (only what their roles permit), the header is identity + context, and the content is the task.
  Refuses the generic admin-template sidebar-with-emoji-tiles.
- **OWN-WORLD** — Staff shell: `--color-surface-raised` sidebar, 1px `--color-border` structure,
  brand `aria-current` marker (left rail + tint), dense spacing (`data-density="compact"` on the
  shell root); customer shell: airy single column on `--color-surface`, no chrome beyond a
  minimal header. Both from Phase 02 tokens; no new primitives invented.
- **STORY** — Staff: "this is my restaurant, my shift, my tools" — the context switcher and nav
  mirror their scope. Customer: "I'm in the restaurant's space" — platform chrome invisible.
- **FIRST VIEWPORT** — Staff: sidebar (brand mark top, nav below, context header above content)
  with the dashboard home's h1 and shortcuts visible without scrolling at 1024×768.
- **FORM** — code-led (no image generation); signature interaction: the context switcher's
  one-place switch with persisted selection.
- **FINISH** — unreviewed and undocumented is unfinished; this build ends with the finish review
  (detect + axe + console + screenshots), the verdict, and the migrated-selector list recorded.

## Architecture

### Files created/changed

```
src/app/navigation.ts            NEW — FR-02: the one nav-model declaration (items + predicates)
src/components/shell/StaffShell.tsx      NEW — sidebar+header shell (FR-01)
src/components/shell/CustomerShell.tsx   NEW — lightweight shell (FR-01)
src/components/shell/ShellNav.tsx        NEW — renders the nav model (desktop list + drawer) w/ aria-current
src/components/shell/ContextSwitcher.tsx NEW — FR-03 (selects, sessionStorage persistence)
src/components/shell/OfflineBanner.tsx   NEW — FR-07 (channel status + navigator.onLine)
src/components/shell/StaffShell.module.css / CustomerShell.module.css  NEW
src/components/AppShell.tsx      DELETE (replaced by the two shells)
src/features/realtime/useRealtimeInvalidation.ts  EDIT — optional onStatus consumer (FA-2 intact)
src/features/realtime/useRealtimeStatus.ts       NEW — shell-level aggregate status (any active channel)
src/app/router.tsx               EDIT — shell selection by route group (FR-01, one declaration point)
src/routes/DashboardPage.tsx     EDIT — home restructure (FR-04); nav <ul> moves to the shell
src/features/auth/guards.tsx     EDIT — NotAuthorized restyle only (FR-11, heading preserved)
src/routes/SignInPage.tsx        EDIT — expired-session note (FR-08, presentation only)
src/components/NotFoundView.tsx  UNCHANGED (already renders in the shell)
src/features/staffOps/*          EDIT — ConfirmDialog adoption at the 4 destructive sites (FR-06)
src/app/App.tsx                  EDIT — ToastProvider at the app root (FR-05 host)
tests/unit/navigation.test.tsx   NEW — persona nav matrix + switcher resolution
e2e/shell.test.ts                NEW — shell selection, role nav, drawer, banner, confirm flows
docs/conventions.md              EDIT — shell architecture note (FA-15 bounds)
```

### Shell selection & composition

`router.tsx` maps route groups: staff/platform routes under `<StaffShell>` (the existing
`RequireStaff`/`RequireProfile`/`RequireSuperAdmin` guards stay on the routes — the shell renders
*around* them, decisions unchanged); public routes under `<CustomerShell>`; credential routes
under `<CustomerShell>` without nav. The `*` 404 stays inside the staff-shell group as today
(shell + skip link preserved). FA-15 bounds: shells consume context/nav-model/UI infrastructure
only.

### State/data flow

- ContextSwitcher state: `useState` + `sessionStorage` (`restopilot.dashboard-context`:
  `{restaurantId, branchId}`), validated against memberships/branches on read (invalid → first
  valid). NOT a new data source; the branches read reuses the DashboardPage's existing query
  shape, lifted to the switcher.
- OfflineBanner: `useRealtimeStatus()` aggregates `navigator.onLine` + a module-level channel
  status registry fed by the binding's optional `onStatus`; `refetchQueries({type:'active'})` on
  retry.
- Toast host: mounted once at `App.tsx` (inside QueryClientProvider); surfaces call `useToast`.

### Responsive behavior

Staff shell: persistent sidebar ≥1024px; drawer below (menu button in the header). Customer
shell: single column at all widths; bottom-anchored primary actions belong to Phase 04 surfaces
(the shell only provides the column + safe padding).

### Accessibility

One `<main>` per shell; skip link first (existing, retargets `#main` in both shells);
`aria-current="page"`; drawer/dialog traps from primitives; banner `role="status"` polite; toasts
polite; nav landmarks labeled ("Staff area" preserved for E2E); h1 per page from surfaces.

### Loading/empty/error states

Shell resolution: `isPending` → null (no denial flash — existing guard behavior); context error →
the existing per-page posture; the switcher's branch read failure keeps the current selection +
banner. NotAuthorized restyle keeps the heading and adds "why + how" copy.

### Testing strategy

- Unit: persona × nav-item matrix (owner/branch manager/cashier/kitchen/super admin/unlinked);
  switcher resolution (grouping, owner "All branches", invalid-id fallback); shell selection.
- E2E `shell.test.ts`: persona nav presence/absence (mirrors the existing dashboard assertions,
  now against the sidebar), context switch persistence across routes, mobile drawer navigation
  (390 viewport project), confirm-dialog flows for session close (names preserved), offline
  banner (online/offline emulation + retry), sign-out via shell.
- Existing suites: must pass with the recorded migration list (nav region moved; confirm flows
  gain dialog role). `npm run verify` + full e2e at the gate.

## Risks & mitigations

- **R-A**: 13 existing suites assert through the old dashboard nav → run the full e2e early
  (after the nav move), migrate with recorded names before building further.
- **R-B**: duplicate `Restaurant`/`Branch` labels (page selects + switcher) → switcher labels
  "Context — Restaurant"/"Context — Branch" (never `Restaurant`/`Branch` bare).
- **R-C**: realtime status surface leaks into invalidation semantics → the `onStatus` consumer is
  optional and side-effect-free by default; unit tests pin the existing behavior.
- **R-D**: kitchen/cashier nav leakage → the persona matrix unit test is exhaustive (all 5 roles
  × all 13 items).
