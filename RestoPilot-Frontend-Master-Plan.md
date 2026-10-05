# RestoPilot Frontend Master Plan

**Document type:** Master frontend roadmap (planning artifact — nothing in this document is implemented)
**Status:** Planning baseline
**Version:** 1.1.0
**Date:** 2026-09-26
**Repository state inspected at:** commit `b569215` (branch `main`)
**Governing authorities:** `.specify/memory/constitution.md` → `RestoPilot-Master-Plan.md` → feature specs under `specs/`
**Frontend design/UX specialist:** Impeccable (skill `impeccable` v4.4.0, launcher 0.1.6)
**Execution pipeline:** SpecKit with Impeccable integration — the single canonical per-phase order is §6.2: `$speckit-specify` → `$speckit-clarify` → `$speckit-plan` → `$impeccable shape` → `$speckit-checklist` → `$speckit-tasks` → `$speckit-analyze` → `$speckit-implement` (Impeccable build/craft happens inside implementation) → validation → `$impeccable critique` → `$impeccable audit` → fix tasks → `$speckit-analyze` → `$speckit-converge`

> This document plans. It does not implement, does not modify application code, does not
> touch the database, and does not claim completion of any phase. Every phase below is a
> SpecKit feature to be executed later, one at a time, with its own spec, plan, tasks,
> checklists, analysis, validation, and convergence.

**Revision note (v1.1.0):** An engineering correction pass over v1.0.0 from an architecture
review, covering: one canonical SpecKit + Impeccable execution order (§6.2), hardening-phase
sequencing (Phases 15→16→17 and 09→10 sequential by default), deterministic failure injection
and measured performance evidence, the categorized presentation-contract ledger, evidence-based
QueryClient governance, tiered validation, a reusable Surface Design Definition of Done (§14.2),
and AI-agent execution-safety rules. No product scope, phase numbering, backend contract, or gate
was removed or weakened; nothing is implemented — this remains a planning document.

---

## 1. Executive Summary

### 1.1 What this plan is

RestoPilot's backend, product behavior, authorization model, and validation suites are
already built and proven across SpecKit features `001`–`020`: 36 migrations, 65 public RPCs,
23 public tables, RLS + RBAC, multi-tenancy, sessions/rounds/kitchen/cashier operations,
channels, voids and audit, realtime, reports, super admin and subscriptions, tenant
onboarding, security hardening, performance baselines, end-to-end validation, and
production readiness.

What does **not** exist is a production-quality **user interface**. The frontend today is a
complete, working, accessible-name-stable _functional_ surface with essentially no visual
system: 25 routes, 11 feature modules, 13 Playwright suites — and exactly two CSS files
(`src/index.css`, 30 lines; `src/components/AppShell.module.css`, 66 lines) with five
hard-coded hex colors, zero CSS custom properties, zero media queries, zero icons, zero
shared UI primitives, and no responsive, loading-skeleton, toast, dialog, drawer, or
data-table components.

This plan defines the roadmap from that reality to a **complete, coherent, production-quality
frontend**, without breaking a single existing backend contract, RLS rule, authorization
decision, lifecycle rule, or tested behavior.

### 1.2 The framing that matters

The plan is deliberately **not** "build a frontend from scratch". It is:

1. **A structural pass** where structure is genuinely missing — the application shell,
   shared navigation, global UX infrastructure (toasts, confirmations, error/offline
   handling), and the customer mobile experience.
2. **A visual-system pass** across surfaces that already work — one design system, one
   component vocabulary, consumed by every later phase.
3. **A productionization pass** — responsive behavior, accessibility, performance,
   state hardening, end-to-end validation across every role, and release readiness.

Any plan that ignored step 1 would ship a beautiful set of disconnected pages. Any plan that
skipped step 2 would ship 25 hand-styled pages that drift apart. Any plan that skipped step 3
would ship a demo.

### 1.3 The hard constraint that shapes every phase

The existing Playwright suites assert **~666 accessible-name and text expectations** across
13 files (`372 × getByRole`, `166 × getByLabel`, `128 × getByText`), plus 10 `data-*`
attribute hooks (`data-round-state`, `data-kitchen-column`, `data-ticket-state`,
`data-audit-action`, `data-bill-round`, `data-voided`, `data-banner-state`, …) and 16
`data-testid` hooks (`platform-overview`, `session-bill`, `report-aggregates`, `qr-code`, …).

That is not an obstacle. It is the **regression net for a redesign**: it means the redesign
cannot silently break a label, a role, a heading, or a status region without a test failing.
Every phase therefore treats the accessible-name surface as a _contract_ with an explicit
migration rule (see §12, gate **F-G09**): names may be preserved, or intentionally changed
with the test updated in the same commit and recorded in the phase's spec — never weakened,
never deleted, never loosened.

From Phase 01 the ledger is organized into four stability categories — **A Semantic** (accessible
names, labels, roles, headings, live regions, tested focus behavior), **B Behavioral** (`data-*`
state hooks, lifecycle state selectors, state-specific DOM markers), **C Test-only**
(`data-testid`), and **D Storage** (the frozen `localStorage` keys `restopilot.session-token` and
`restopilot.cart`) — because they carry different stability levels and different change costs
(Phase 01 FR-10, gate F-G09).

### 1.4 Structure of the plan

- **20 phases**, dependency-ordered, each independently specified/planned/implemented/validated
  through the existing SpecKit pipeline, and each mapped to its own `specs/` feature directory
  (`021`–`040`).
- **The design system is Phase 02** — established before any surface phase, then consumed,
  never reinvented (§5, §12 gate F-G10).
- **Impeccable enters at Phase 02** (product truth → design world → the system itself) and is
  used per-surface from Phase 03 onward through its verified commands (§6).
- **Cross-cutting hardening phases** (accessibility, responsive, state/error, performance)
  come after the surfaces exist, so they harden real things instead of hypothetical ones.
- **Full E2E validation is Phase 19**; **release readiness is Phase 20**.

### 1.5 Recommended first phase

**Frontend Phase 01 — Frontend Foundation & Architecture Baseline** (`specs/021-frontend-foundation`),
immediately followed by **Frontend Phase 02 — Design System & Visual Language**
(`specs/022-frontend-design-system`). Nothing else may start before the design system is
stable; the shell (Phase 03) is its first consumer and its proving ground.

### 1.6 Non-negotiables

- Business behavior is not redesigned. The frontend derives from the product contract (§3).
- No authorization logic is added, moved, or weakened on the client. Guards stay
  presentation-only (Constitution IV).
- No database change, migration, RPC signature change, RLS change, or generated-type edit is
  in scope anywhere in this plan.
- No invented feature. Surfaces listed as _not in the product_ (payments, bill splitting,
  printing, discounts, customer accounts, SMS/WhatsApp, POS integrations, exports) stay out
  and are recorded as such (§7.3).
- Evidence over claims: every phase ends with `npm run verify`, the relevant Playwright
  suites, and captured screenshots/records — not prose.

---

## 2. Current Frontend State

All statements below were verified by reading the repository at `b569215`. Nothing here is
inferred from the presence or absence of a visual style; each claim names where it was checked.

### 2.1 Stack (as configured)

| Concern                        | Reality                                                                                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime deps                   | `@supabase/supabase-js` ^2.116, `@tanstack/react-query` ^5.102, `qrcode` ^1.5.4, `react` ^19.2, `react-dom` ^19.2, `react-router` ^7.18                    |
| Dev deps                       | `@playwright/test`, `vitest` 5, `typescript` ~6.0, `eslint` 10 + `typescript-eslint` + react-hooks + react-refresh, `prettier`, `vite` 8, `wrangler`, `pg` |
| Build                          | Vite (`vite.config.ts` — react plugin only), `tsc -b` typecheck, `dist/` output                                                                            |
| Router                         | `react-router` v7 declarative `<Routes>` in `src/app/router.tsx`                                                                                           |
| Server state                   | TanStack Query v5; one module-level `QueryClient` in `src/app/App.tsx` with **default options** (no shared retry/staleTime/error policy)                   |
| Styling                        | **CSS Modules only** (`docs/conventions.md` names `ComponentName.module.css` beside its component). Effectively unused: 2 CSS files total                  |
| Component library              | None. No Tailwind, no UI kit, no headless primitives, no icon package                                                                                      |
| CSS variables / tokens         | None. `AppShell.module.css` hard-codes `#ffffff`, `#e1e4e8`, `#59626e`, `#1f2328`; `index.css` hard-codes `#1f2328` on `#f6f7f9`                           |
| Media queries / responsive CSS | Zero (`grep -rn "@media" src` → no matches). Only `index.html`'s viewport meta                                                                             |
| Fonts / icons                  | System font stack; one `public/favicon.svg` (9.5 KB). No icon system                                                                                       |
| Document titles / meta         | `document.title` never set; static `<title>RestoPilot</title>`                                                                                             |
| Error boundaries / lazy routes | None (`grep -rniE "errorboundary                                                                                                                           | suspense | lazy\\(" src` → no matches) |
| i18n                           | None. UI copy is English literals in components. `docs/test-data-guide.ar.md` is an Arabic _manual fixture guide_, not a product locale                    |

### 2.2 Application composition and routing

- `src/main.tsx` → `src/app/App.tsx` (`QueryClientProvider` → `AuthProvider` → `BrowserRouter` → `AppRouter`).
- `src/app/router.tsx` registers **25 routes**; `src/routes/` holds 25 page components plus one
  non-page component (`DashboardLiveCue.tsx`).
- Route groups actually present:
  - Public/entry: `/`, `/r/:slug`, `/r/:slug/menu`, `/order/:branchId`, `/signin`,
    `/reset-password`, `/account/password`.
  - Staff area (inside `AppShell`): `/dashboard`, `/dashboard/profile`, `/dashboard/staff`,
    `/dashboard/sessions`, `/dashboard/rounds`, `/dashboard/kitchen`, `/dashboard/audit`,
    `/dashboard/reports`, `/dashboard/voids`, `/dashboard/restaurant`, `/dashboard/menu`,
    `/dashboard/tax`, `/dashboard/branches`, `/dashboard/branches/:branchId`,
    `/dashboard/branches/:branchId/menu`, `/dashboard/branches/:branchId/tax`.
  - Platform area: `/admin`, `/admin/platform`.
- Two routes are still **Phase-0 placeholders** and are asserted by `e2e/routes.test.ts` and
  `e2e/smoke.test.ts`:
  - `/` → `RootPage`: heading `RestoPilot`, text "application shell placeholder".
  - `/order/:branchId` → `OrderPage`: heading `Order`, text "Branch ordering placeholder —
    route /order/:branchId. The customer menu will live here in a later phase."
  - Resolution is a **clarification** in Phase 04 (customer entry), not an assumption.

### 2.3 Feature modules (11)

`src/features/` contains `audit`, `auth`, `management`, `menu`, `order`, `platform`,
`realtime`, `reports`, `session`, `staffOps`, `tax`. Each follows a consistent internal shape:

- `*Client.ts` — thin, typed wrappers over Supabase RPCs/tables returning discriminated
  results (`{ ok: true, data } | { ok: false, message }`) or typed payload errors
  (`TaxPayloadError`, `PlatformPayloadError`, `ReportsPayloadError`).
- `use*.ts` — TanStack Query hooks with exported query-key factories
  (`branchRoundsKey`, `kitchenQueueKey`, `sessionBillKey`, `sessionRoundsKey`,
  `publicRestaurantKey`, `sessionContextKey`, `sessionMenuKey`, `branchSessionsKey`,
  `AUTH_CONTEXT_QUERY_KEY`), mutations that invalidate rather than optimistically write.
- `components/` — surface-local components (e.g. `CartPanel`, `RoundCard`, `TicketCard`,
  `BillPanel`, `MenuStructurePanel`, `TaxRulesPanel`, `BranchSessionsPanel`, `OnboardingPanel`).
- Pure domain helpers where needed: `cartState.ts`, `menuImages.ts`, `workingHours.ts`,
  `qrEntry.ts`, `money.ts`, `taxMoney.ts`.

This structure is a strength and the plan preserves it: **UI phases add presentation, not new
transport layers.** Existing clients/hooks are the frontend's only data path.

### 2.4 Authentication, authorization, and routing guards

- `features/auth/AuthProvider.tsx` — session state from a single `onAuthStateChange`
  subscription; status `loading | signed-in | signed-out`; `loading` never flashes denied content.
- `features/auth/useAuthContext.ts` — one `current_auth_context` RPC read cached under
  `['auth','context', userId]`, exposing advisory predicates: `isStaff`, `isSuperAdmin`,
  `canReadStaffList`, `canManageRestaurant`, `canViewBranchMenu`, `canManageBranchAvailability`,
  `canViewBranchTax`, `canManageBranchTax`, `canViewSessions`, `canCloseSession`.
- `features/auth/guards.tsx` — `RequireAuth` (redirect to `/signin` with `state.from`),
  `RequireStaff`, `RequireProfile`, `RequireSuperAdmin`, and the explicit `NotAuthorized` view
  (heading "Not authorized"). Guards are **presentation only**; the data layer is the boundary.
- In-page role gates exist on several pages (e.g. cashier/kitchen denials) and are likewise
  presentation-only, re-authorized by every RPC.

### 2.5 Data, realtime, forms, and validation

- Reads: direct policy-scoped table reads (`branches`, `profiles`, …) for small lookups, RPCs
  for everything business-shaped.
- Writes: RPC-only for every business operation; UI never writes business tables directly.
- Realtime: `features/realtime/useRealtimeInvalidation.ts` subscribes to five published tables
  (`rounds`, `kitchen_tickets`, `sessions`, `branch_unavailable_items`, `dining_tables`) with a
  server-side row filter (`branch_id=eq.<scope>` by default), coalesces events over **200 ms**,
  and refetches on `SUBSCRIBED` (first connect _and_ every reconnect). Events are **never
  rendered** — they only invalidate. `useNewRoundCue.ts` provides the cashier's event-derived
  "a new order arrived" cue (rendered by `src/routes/DashboardLiveCue.tsx`).
- Customer liveness: customers have no profile and therefore **no subscription**; their order
  status is a **10 s poll** through `get_session_rounds` (`useSessionRounds`).
- Forms: uncontrolled-by-design local `useState` per page, native `<form onSubmit>`, native
  `<label htmlFor>`/implicit labels (73 label associations repository-wide).
- Validation: client checks are **feedback only** (e.g. phone regex, address ≤ 200, quantity
  1–99, empty-cart guard); the server's message is surfaced **verbatim** in `role="alert"`.
- Feedback primitives today: `role="alert"` (54 usages) and `role="status"` (13 usages) plus
  `role="note"` (1). No toasts, no dialogs, no drawers, no skeletons.
- Confirmations: two-step inline button confirmations (e.g. "Close session for T1" →
  "Confirm closing T1"), asserted by E2E.
- Client-local state: `restopilot.session-token` and `restopilot.cart` in `localStorage` — both
  asserted by E2E; **keys are frozen contracts** for this plan.

### 2.6 Testing state (what a redesign must not break, and what it lacks)

| Tier        | Command                    | Current reality                                                                                                                                                                                                                 |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `npm run test:unit`        | Vitest, **node environment**, `tests/setup-env.ts`, 30 s timeout. Component tests render via `renderToStaticMarkup` (no DOM env, no `@testing-library`). Covers clients, cart, guards, realtime bindings, env, production guard |
| Database    | `npm run test:db`          | ~490+ assertions against the cloud dev project; RLS/tenancy/role/lifecycle/atomicity                                                                                                                                            |
| Integration | `npm run test:integration` | Real Auth + PostgREST journeys                                                                                                                                                                                                  |
| E2E         | `npm run test:e2e`         | Playwright, `testDir: e2e`, `fullyParallel`, **chromium / Desktop Chrome only**, `baseURL http://localhost:5173`, `webServer: npm run dev` (`reuseExistingServer`), expect timeout 15 s, 13 suites / 2942 lines                 |
| Full gate   | `npm run verify`           | `format:check` → `lint` → `typecheck` → `test:unit` → `test:db` → `test:integration` → `build`                                                                                                                                  |

E2E gaps that later phases must fill (each justified before adding tooling):
no mobile/tablet viewport project, no cross-browser project (WebKit/Firefox), no accessibility
assertions (no axe), no visual-regression baselines, no reduced-motion/forced-colors checks,
and no console-error assertion on route navigation.

E2E cost constraints are real and must be respected by every phase that adds coverage:
sign-in is rate limited (**30 per 5 minutes per IP**, ~14 sign-ins per current E2E run),
the recovery endpoint enforces a **60 s window** between requests, and hosted SMTP allows
**2 emails/hour** (so no automated test sends recovery email). Database/E2E suites require a
migrated + seeded **cloud development project**.

### 2.7 Tooling, docs, and process that already exist

- Commands available today (do not invent others): `dev`, `build`, `preview`, `lint`, `format`,
  `format:check`, `typecheck`, `test:unit`, `test:db`, `test:integration`, `test:e2e`, `verify`,
  `db:migrate`, `db:seed`, `db:reset`, `types:gen`, `deploy`.
- `docs/conventions.md` — folder placement, naming, CSS Modules convention, SpecKit feature
  workflow. `docs/development.md` — setup acceptance gate, per-tier suite catalogue, rate-limit
  notes, data-layer workflow, platform configuration. `docs/production-runbook.md` — Cloudflare
  Pages contract, environment matrix (Local/Staging/Production), §28 checklist dispositions.
- SpecKit is installed and used: `.specify/` (constitution v1.0.0 with 8 principles, templates,
  PowerShell scripts, `feature.json` currently pointing at `specs/020-self-service-password-change`),
  11 `speckit-*` skills in `.agents/skills/` and `.zcode/skills/`, and `scripts/mark-tasks.mjs`.
- Impeccable is installed and **unused**: skill `impeccable` v4.4.0 at its skill base directory
  (`~/.agents/skills/impeccable`, launcher `scripts/impeccable`, Windows `impeccable.cmd`,
  launcher version `0.1.6`), with `.impeccable/config.local.json` present (design-detector hook
  consent `accepted`, path excluded via `.git/info/exclude`). **No `PRODUCT.md`, no `DESIGN.md`,
  no surface briefs, no review/mocks artifacts exist yet.**

### 2.8 What is missing versus what merely looks plain

**Genuinely missing (must be built):**

1. One design system: tokens (type, color, spacing, radius, shadow, border, motion), and
   primitives (button, field, select, checkbox/radio, dialog, drawer, card, table, tabs,
   badge/status pill, toast, alert, skeleton, spinner, empty state, error state, pagination).
2. An application shell per experience: staff/admin chrome with role-aware sidebar + header +
   tenant/branch context switcher, and a separate lightweight customer shell — instead of the
   placeholder top bar in `AppShell.tsx` that shows customer/dashboard/admin links to everyone.
3. Responsive behavior of any kind (no breakpoints exist).
4. Global UX infrastructure: toast host, confirmation/`ConfirmDialog` pattern, focus
   management, route-level error boundary, offline/reconnect banner, route titles.
5. Loading/empty/error state vocabulary (today: bare `<p>Loading…</p>` / "Nothing here.").
6. Accessibility work beyond labels and alert roles: no skip link, no focus trap, no keyboard
   interactions, no contrast verification, no reduced-motion handling, no a11y lint/test tooling.
7. E2E coverage of responsive viewports, accessibility, and console cleanliness.

**Present and working (must be preserved, then re-skinned):** every route, client, hook, guard,
realtime binding, form validation rule, verbatim error surfacing, two-step confirmation, and
the entire backend contract surface.

---

## 3. Backend / Product Contracts

The frontend consumes these. **Nothing in this section may change in any frontend phase**
(§12 gate F-G11). Where a frontend idea would require a change here, the phase must stop and
record it as an explicit contract-conflict item for the owner instead of implementing it.

### 3.1 Authority and rules

- `.specify/memory/constitution.md` (v1.0.0): I Business Scope Integrity (not a POS), II Specs are
  business truth, III Multi-Tenant Isolation, IV Server-Enforced Authorization, V Database as
  source of truth, VI Explicit state/data integrity, VII Auditability, VIII Minimal complexity.
- `RestoPilot-Master-Plan.md` §4–§5, §30–§39: client state may improve responsiveness but never
  become business truth; realtime is a delivery mechanism, not a source of truth; no privileged
  credentials in the browser; UI hiding is a UX concern, never authorization.
- Feature specs `001`–`020` remain the per-feature source of truth; frontend phases may cite them
  but never restate or contradict them.

### 3.2 Public RPC surface (65 functions) — grouped by the frontend surface that consumes it

| Domain                   | RPCs                                                                                                                                                                                                                                                                                                                                                                                                                                  | Consumed by                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Auth/context             | `current_auth_context`                                                                                                                                                                                                                                                                                                                                                                                                                | Every staff/admin gate and view |
| Restaurant/branch/tables | `create_restaurant`, `update_restaurant_profile`, `update_restaurant_settings`, `create_branch`, `rename_branch`, `replace_branch_working_hours`, `create_dining_table`, `rename_dining_table`, `set_dining_table_active`                                                                                                                                                                                                             | Phase 06                        |
| Staff                    | `add_staff_member`, `update_staff_membership`, `remove_staff_membership`                                                                                                                                                                                                                                                                                                                                                              | Phase 06                        |
| Menu                     | `create_menu_category`, `update_menu_category`, `delete_menu_category`, `reorder_menu_categories`, `create_menu_item`, `update_menu_item`, `delete_menu_item`(via `remove_menu_item_extra`/item lifecycle), `move_menu_item`, `reorder_menu_items`, `add_menu_item_extra`, `update_menu_item_extra`, `remove_menu_item_extra`, `set_menu_item_image`, `set_menu_item_availability`, `set_branch_item_availability`, `get_branch_menu` | Phase 07                        |
| Tax                      | `create_tax_rule`, `update_tax_rule`, `retire_tax_rule`, `delete_unused_tax_rule`, `reorder_tax_rules`, `set_branch_tax_override`, `get_branch_tax_config`, `calculate_branch_taxes`, `record_tax_snapshot`                                                                                                                                                                                                                           | Phase 08                        |
| Sessions (customer)      | `get_public_restaurant`, `open_session_at_table`, `open_session_channel`, `get_session_context`, `get_session_menu`                                                                                                                                                                                                                                                                                                                   | Phases 04–05                    |
| Sessions (staff)         | `get_branch_open_sessions`, `close_session`                                                                                                                                                                                                                                                                                                                                                                                           | Phases 06/09                    |
| Rounds (customer)        | `submit_round`, `get_session_rounds`                                                                                                                                                                                                                                                                                                                                                                                                  | Phase 05                        |
| Rounds (staff)           | `get_branch_rounds`, `accept_round`, `start_preparation`, `mark_round_ready`, `lock_round`, `mark_out_for_delivery`, `mark_completed`, `modify_round_line`, `void_round`, `get_kitchen_queue`, `get_session_bill`                                                                                                                                                                                                                     | Phases 09–11                    |
| Audit                    | `get_audit_log`                                                                                                                                                                                                                                                                                                                                                                                                                       | Phase 13                        |
| Reports                  | `get_branch_sales_report`, `get_branch_void_report`                                                                                                                                                                                                                                                                                                                                                                                   | Phase 13                        |
| Platform                 | `get_platform_overview`, `set_subscription_dates`, `set_restaurant_platform_disabled`, `onboard_restaurant`, `get_my_subscription`                                                                                                                                                                                                                                                                                                    | Phase 14                        |

Private helpers the frontend never calls but must respect the semantics of: `has_branch_role`,
`can_act_on_round`, `calculate_tax_totals`, `round_payload`, `subscription_state`,
`ops_profile_id`, `is_super_admin_profile`, `validate_tenant_inputs`.

### 3.3 Tables (23) and enums (2)

`app_meta`, `audit_log`, `branch_tax_overrides`, `branch_unavailable_items`,
`branch_working_hours`, `branches`, `dining_tables`, `kitchen_tickets`, `menu_categories`,
`menu_item_extras`, `menu_items`, `profiles`, `restaurants`, `round_item_extras`,
`round_items`, `rounds`, `session_participants`, `session_tokens`, `sessions`,
`staff_memberships`, `subscriptions`, `tax_rule_categories`, `tax_rule_compounds`,
`tax_rule_items`, `tax_rules`, `tax_snapshots`. Enums: `staff_role` (`owner`,
`branch_manager`, `cashier`, `kitchen`), `weekday`.

Write posture the UI must never bypass: business tables are **RPC-only** for clients; the
realtime migration added SELECT-only grants on `rounds`, `kitchen_tickets`, `sessions` for
`authenticated` (needed for realtime delivery); session tables carry **zero grants**.

### 3.4 Roles, scope, and what the UI may merely _present_

| Actor                   | Effective reach (enforced server-side)                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner                   | Restaurant-wide: all branches, restaurant config, staff, menu, tax, reports, audit                                                             |
| Branch manager          | Own branch only: branch config/tables/hours, branch-scoped availability + tax override, staff list (read), reports, audit for managed branches |
| Cashier                 | Own branch operational data: rounds queue, modifications, voids, bill, session close, session oversight; **no** financial reporting dashboard  |
| Kitchen                 | Own branch kitchen queue and ticket transitions only; money-free reads; no cashier routes                                                      |
| Customer (guest, token) | One session's own context/menu/rounds; no staff data; no subscription                                                                          |
| Platform super admin    | `/admin`, `/admin/platform`, onboarding, subscription dates, disable flag; **no** restaurant tenant data by default                            |

Presentation predicates the UI may use (advisory only, already implemented in
`useAuthContext`): `isStaff`, `isSuperAdmin`, `canReadStaffList`, `canManageRestaurant`,
`canViewBranchMenu`, `canManageBranchAvailability`, `canViewBranchTax`, `canManageBranchTax`,
`canViewSessions`, `canCloseSession`. Deep links to unauthorized views must render the explicit
`NotAuthorized` denial — rejected, never merely hidden. E2E asserts this behavior.

### 3.5 Lifecycles the UI renders but never invents

- **Session:** `OPEN` / `CLOSED`; no automatic timeout; the cashier/authorized user closes.
- **Round:** `new → accepted → preparing → ready → lock` (terminal), plus delivery
  `out_for_delivery → completed` (terminal). Illegal transitions are refused by guarded updates.
- **Kitchen ticket:** `new → accepted → preparing → ready` (never `lock`); one ticket per round.
- **Cutoffs (state-driven, evaluated in the submission transaction):** delivery refuses further
  rounds once any round is `out_for_delivery`/`completed`; takeaway once any round is
  `ready`/`lock`; dine-in never (session close governs).
- **Void:** an **overlay**, not a state — four additive columns on `rounds` plus a ticket mirror;
  reason required (≤ 500 trimmed); boundary is `lock` for dine-in, `out_for_delivery`+ for
  delivery, `ready` for takeaway; the bill's grand total sums **non-voided** rounds only.
- **Subscription:** derived state (`never_activated`, `active`, `nearing_expiration`, `expired`)
  plus a **separate** manual `platform_disabled` flag and reason. **Expiry never disables
  ordering automatically**; the platform owner decides. Read via `get_my_subscription`.

### 3.6 Realtime and notification contracts

- Published tables: `rounds`, `kitchen_tickets`, `sessions`, `branch_unavailable_items`,
  `dining_tables`. Delivery is policy-filtered per subscriber using the same
  `private.has_branch_role` predicate as RLS.
- Client rule already implemented and to be preserved: **events invalidate, reads render**;
  200 ms coalescing; refetch on every `SUBSCRIBED`; payloads never displayed.
- Customers have **no subscription**; their status cadence is the 10 s poll of
  `get_session_rounds`.
- In-app notification surface that exists: the new-round cue (event-derived, no recovery read)
  and the subscription banner (`SubscriptionBanner.tsx`, `get_my_subscription`). There is **no**
  outbound notification channel (no email/SMS/WhatsApp/push) in the product contract.

### 3.7 Storage, secrets, and environment

- Menu images: private `menu-images` bucket, migration-configured (5 MiB, JPEG/PNG/WebP, no
  update policy — replacement is insert + delete), object paths
  `restaurant/<restaurantId>/item/<itemId>/<uuid>.<ext>`, deletion only via Storage API.
- Browser-visible configuration is exactly `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` (validated fail-fast in `src/lib/env.ts`).
  `SUPABASE_DB_URL` / `SUPABASE_PROJECT_REF` must never reach the bundle
  (proved by `tests/unit/production.guard.test.ts`).
- Deployment contract: Cloudflare Pages, `npm run build` → `dist/`, `npm run deploy`
  (`scripts/deploy-frontend.mjs`, `--dry-run` rehearsal), SPA fallback verified at deploy root.
- Frozen client-storage keys: `restopilot.session-token`, `restopilot.cart`.
- Frozen E2E-asserted presentation hooks: `data-round-state`, `data-round-id`,
  `data-kitchen-column`, `data-ticket-id`, `data-ticket-state`, `data-audit-action`,
  `data-bill-round`, `data-bill-voided-round`, `data-voided`, `data-banner-state`, and the
  `data-testid` set listed in §2.3.

### 3.8 Contract conflicts and open decisions to surface (never silently resolve)

| #   | Item                                                                      | Why it needs a decision                                                                                                                                                |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `/order/:branchId` placeholder                                            | Superseded by `/r/:slug` (spec 007) but still routed and E2E-asserted. Decide: keep as a branch deep-link entry, redirect to `/r/:slug`, or retire with test migration |
| C2  | `/` placeholder                                                           | Currently "application shell placeholder" with an H1 asserted by two suites. Decide its real purpose (public landing / restaurant lookup / staff entry)                |
| C3  | Nav visible in `AppShell` for everyone ("Customer", "Dashboard", "Admin") | Real role-aware navigation changes shell semantics; must be specified, and the existing E2E heading/nav assertions re-mapped                                           |
| C4  | Bill splitting, payment/closing, printing                                 | **Not in the product contract** (§3.2 of the master plan). Cashier "split bills" and "payment" surfaces must not be invented; refusal recorded in Phase 09             |
| C5  | Exports (CSV/PDF) from reports/audit                                      | No RPC or export contract exists. Out of scope unless a future backend spec adds one                                                                                   |
| C6  | Kitchen alerting beyond visual (sound/badge)                              | No outbound/alert contract. Visual + in-app cue only; sound is a clarify question, not an assumption                                                                   |
| C7  | Multi-language / RTL                                                      | No i18n in the product. Arabic doc is fixture guidance only. Any localization is a scope amendment, not a frontend phase                                               |
| C8  | Dark mode                                                                 | No theming contract exists. If desired, it is a design-system decision in Phase 02 (tokens make it cheap; scope says one theme unless the owner chooses otherwise)     |

---

## 4. Frontend Architecture Principles

Binding for every frontend phase. Derived from the constitution, the master plan, and the
repository's own conventions — no new architecture is invented.

- **FA-1 — The database is the only business truth.** UI state (cart, filters, drafts,
  optimistic affordances) improves responsiveness and may be discarded at any time; it never
  becomes the record. Money, states, and lifecycle always come from a read.
- **FA-2 — Realtime invalidates, reads render.** Preserve the existing pattern: events never
  carry rendered data; `SUBSCRIBED` triggers a recovery refetch; coalescing stays at 200 ms.
- **FA-3 — Authorization is server-side; the UI only presents.** Guards and predicate
  functions stay advisory. The UI must never assume a client check prevents access.
- **FA-4 — Two shells, three experiences.** A customer shell (mobile-first, no staff chrome)
  and a staff/platform shell (navigation, context switcher) are distinct compositions sharing
  only the design system and primitives.
- **FA-5 — One design system, consumed not extended.** After Phase 02, surfaces compose
  primitives and tokens. New one-off variants are a defect unless the design system itself is
  amended (Phase 02 feature, or an explicit amendment task inside the phase's spec).
- **FA-6 — Feature-module boundaries stay as they are.** New UI lives in
  `src/features/<module>/components/` or `src/routes/`; shared UI primitives live in
  `src/components/ui/` (Phase 01/02 decision, §5.4). No page reaches into another module's
  client directly; shared reads are exposed through hooks.
- **FA-7 — The server's message is the message.** Verbatim refusal text in a live region stays
  the rule. UX improvements may add context _around_ a server message, never replace it.
- **FA-8 — Presentation-only migration of the E2E contract.** Accessible names, live-region
  roles, and `data-*` hooks are contracts: preserve, or migrate deliberately in the same commit
  with the suite updated and the change recorded in the phase spec.
- **FA-9 — Accessibility is structural, not decorative.** Semantic elements, label
  associations, visible focus, keyboard operability, and live regions are phase requirements —
  not a later clean-up pass. Phase 15 audits; it does not introduce the basics.
- **FA-10 — Zero new runtime dependencies by default.** The design system is CSS + tokens +
  internal primitives. Any proposed runtime dependency requires an explicit justification in
  the phase plan (constitution VIII) and owner approval.
- **FA-11 — Budgets are measured, not asserted.** Customer menu and order submission outrank
  analytics surfaces (§26/§41 of the master plan). Use the 016 baselines as the reference and
  add frontend-side measurements where they exist (navigation timings, bundle size).
- **FA-12 — No placeholder surfaces left behind.** Every route either becomes real or is
  deliberately retired/redirected with its E2E assertions migrated (C1/C2 in §3.8).
- **FA-13 — Honest states.** Loading, empty, success, partial, error, forbidden, offline, and
  realtime-update states are designed per surface; a spinner is not a state matrix.
- **FA-14 — Documentation follows the code.** Surfaces that change behavior conventions update
  `docs/conventions.md` (and `docs/development.md` for new commands) in the same phase.
- **FA-15 — Shells are composition, not business logic.** Shell components (staff/platform shell,
  customer shell) are infrastructure: they may consume authentication context, navigation models,
  context-switching state, global UI infrastructure, and route metadata; they must NOT own
  feature-specific business mutations, feature-specific data fetching, domain lifecycle logic,
  database access, client-side authorization enforcement, or feature-specific state machines.
  Authorization stays server-authoritative; client guards stay presentation-only (Phase 03).

---

## 5. Design System Strategy

Established in **Phase 02** and consumed by every later phase.

### 5.1 Stack decision (recommended, to be confirmed in Phase 02 clarify)

- **Tokens as CSS custom properties** in a small set of global stylesheets (`src/styles/`),
  imported once from `src/main.tsx`.
- **Component styles as CSS Modules** beside their component — the convention
  `docs/conventions.md` already documents, already used once by `AppShell.module.css`.
- **No CSS framework, no UI kit, no runtime styling dependency.** Rationale: constitution
  VIII (minimal complexity), master plan §4.2 ("the final library list must stay intentionally
  small"), and zero existing usage to build on. Phase 02 records the trade-off explicitly; if
  the owner prefers a library, that is a clarify decision made before implementation.
- **Icons:** a small internal `Icon` component with an explicit inline-SVG set (the product
  needs roughly 15–25 glyphs). No icon package dependency.
- **Motion:** CSS transitions/animations driven by token values, with a
  `prefers-reduced-motion` policy defined in Phase 02 and enforced in Phase 15.

### 5.2 Token taxonomy (Phase 02 deliverable, no values fixed here)

Type scale + weights + line heights; semantic color roles (surface, surface-raised, border,
ink, ink-muted, brand, positive, warning, danger, info, focus-ring); spacing scale; radii;
shadows/elevation; border widths; z-index layers (nav, dropdown, drawer, dialog, toast,
tooltip); motion durations + easings; breakpoints; touch-target minimums.

Tokens are **semantic** (`--color-danger-surface`) rather than literal (`--red-500`) at the
consumption layer, so status vocabulary (rounds, tickets, subscription) maps to one palette.

### 5.3 Primitive inventory (Phase 02 deliverable)

| Group         | Primitives                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Actions       | `Button` (primary/secondary/ghost/danger, sizes, loading, disabled), `IconButton`, `Link` styling                                                            |
| Forms         | `Field` (label + hint + error + required), `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `NumberInput`, `FormErrorSummary`                        |
| Overlays      | `Dialog` (confirm variant), `Drawer`/`Sheet` (mobile nav, filters), `Popover`/menu, focus management                                                         |
| Structure     | `Card`, `Panel`, `SectionHeader`, `Tabs`, `Toolbar`, `Divider`, `Stack`/`Grid` layout helpers                                                                |
| Data          | `DataTable` (sortable header, empty/loading rows, responsive fallback), `KeyValueList`, `Pagination`/`LoadMore`                                              |
| Feedback      | `Toast` host + `useToast`, `Alert` (inline), `Badge`/`StatusPill`, `Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, `ProgressBar`                          |
| Navigation    | `Sidebar`, `Header`, `Breadcrumbs`, `ContextSwitcher` (restaurant/branch), `MobileNav`, `SkipLink`                                                           |
| Domain-shared | `MoneyText` (routes through existing formatters), `PriceSummary`/`TotalsPanel` shell (tax lines as data), `StateChip` (round/ticket/subscription vocabulary) |

Reuse rule: the domain-shared group is where the product's money and state vocabulary is
rendered once — never re-derived per page (master plan §16: one canonical tax presentation).
Creation rule: Phase 02 implements a primitive when it is foundational, required by an identified
surface, or clearly reused across multiple surfaces — never speculatively (Phase 02 FR-04, FA-5).

### 5.4 Placement and ownership

```text
src/styles/            tokens.css, base.css, reset.css (Phase 01/02)
src/components/ui/     shared primitives + Component.module.css (Phase 02+)
src/components/layout/ shell compositions (Phase 03)
src/features/<module>/components/  surface-specific composition only
src/routes/            thin pages: fetch + compose + states
```

- A primitive used by two or more modules moves to `src/components/ui/` — never copied.
- Surfaces may not add raw hex values, magic spacing, or bespoke animations: tokens only.
- A dev-only gallery route (`import.meta.env.DEV`) renders every primitive in every state for
  review and screenshot evidence; it is excluded from production builds and from routing tests.

### 5.5 Impeccable artifacts are part of the design system

`PRODUCT.md` (product truth), `DESIGN.md` (the committed visual world), and per-surface briefs
with their direction contracts are **design system artifacts** and are committed (see §6.6 for
the ignore policy). Later phases read them before touching UI and update them only when the
system itself changes.

---

## 6. SpecKit + Impeccable Operating Model

### 6.1 Verified tool inventory (checked against the installed skills, not assumed)

- **SpecKit** (installed, `.agents/skills/` and `.zcode/skills/`, `.specify/integration.json`
  `speckit_version 1.0.5`, PowerShell script flavor): `speckit-specify`, `speckit-clarify`,
  `speckit-plan`, `speckit-checklist`, `speckit-tasks`, `speckit-analyze`, `speckit-implement`,
  `speckit-converge`, `speckit-constitution`, `speckit-taskstoissues`, `speckit-autopilot`.
  Canonical per-feature order (from the autopilot skill):
  `specify → clarify → plan → checklist → tasks → analyze → implement → analyze → converge`,
  with converge-appended tasks looping back through `implement` (max 3 rounds). The frontend
  variant of this order — where `$impeccable shape` slots between `plan` and `checklist`, and
  Impeccable build/craft/critique/audit work integrates around `implement` — is defined once in
  §6.2 and is the only pipeline this plan recognizes.
  Helpers: `.specify/scripts/powershell/*` (feature creation/prerequisites),
  `scripts/mark-tasks.mjs`, `.specify/feature.json` (must be updated to the active feature
  directory at the start of each phase).
- **Impeccable** (installed at its skill base directory — `~/.agents/skills/impeccable` on this
  machine; the SKILL.md is `impeccable` **v4.4.0**, launcher `scripts/impeccable` /
  `impeccable.cmd`, launcher version `0.1.6`):
  `init`, `document`, `extract`, `shape`, `craft` _(deprecated alias — do not schedule it)_,
  `critique`, `audit`, `polish`, `harden`, `clarify`, `adapt`, `optimize`, `onboard`, `animate`,
  `colorize`, `typeset`, `layout`, `delight`, `quieter`, `bolder`, `distill`, `overdrive`, `live`,
  `generate`, plus `hooks` and `doctor`. Setup per session: run the launcher's `context` verb
  once (it loads `PRODUCT.md`, `DESIGN.md`, surface briefs) and follow its directives.
  Modes: **Persuade** (public restaurant entry), **Operate** (every staff/admin surface and the
  customer menu/cart — task completion first), **Read** (guide/help surfaces), **Experience**
  (not applicable).
- `.impeccable/config.local.json` already records design-detector hook consent (`accepted`), so
  UI edits surface detector findings automatically. `hooks`/`doctor` may be used when drift or
  findings need attention — they are not part of every phase.

**Exact invocation forms used in this plan:**

```text
$impeccable init                     # product truth → PRODUCT.md (Phase 02, once per project)
$impeccable shape <surface>          # UX/UI planning + user-confirmed design brief (per surface)
$impeccable <new-work request>        # build/craft work — happens DURING $speckit-implement,
                                     #   driven by SpecKit tasks (never a separate pre-task step;
                                     #   `craft` is only a deprecated alias — do not schedule it)
$impeccable critique <target>         # UX review with heuristic scoring (after implementation)
$impeccable audit <target>            # technical checks: a11y, perf, responsive, anti-patterns (after implementation)
$impeccable extract <target>          # pull repeated patterns back into the design system
$impeccable polish <target>           # final quality pass before a surface closes
$impeccable harden|clarify|adapt|optimize|animate|onboard|layout|typeset|colorize <target>
```

If the launcher is unavailable in a session, follow the skill's documented fallback: state that
context loading did not run, read `PRODUCT.md`/`DESIGN.md` directly, and continue — do not invent
context.

### 6.2 The per-phase pipeline (frontend variant)

```text
WHAT / WHY / BUSINESS RULES            (this master plan + the cited feature specs)
        ↓
$speckit-specify                       spec.md: user stories, FRs, state matrix, contract citations
        ↓
$speckit-clarify                       resolve every real ambiguity BEFORE design/build (max 3 markers / 5 questions)
        ↓
$speckit-plan                          plan.md + research.md + contracts/ + quickstart.md,
                                       including a "Design Direction" section (6.3)
        ↓
[Impeccable] $impeccable shape <surface>   design brief + direction contract (before checklist/tasks)
        ↓
$speckit-checklist                     reviewer-owned requirements-quality checklist
        ↓
$speckit-tasks                         dependency-ordered tasks.md (one task per measurable unit)
        ↓
$speckit-analyze                       cross-artifact consistency (pre-implement)
        ↓
$speckit-implement                     execute SpecKit tasks; Impeccable build/craft work happens
                                       HERE, as part of implementing the tasks — never before
                                       tasks exist and never bypassing them
        ↓
validation                             tiered per §12.6: milestone gate = npm run verify + relevant
                                       Playwright suites + evidence
        ↓
[Impeccable] critique                  UX review of the built surface (after implementation)
        ↓
[Impeccable] audit                     technical a11y/perf/responsive audit (after critique)
        ↓
fix tasks (if required)                findings become SpecKit tasks, looped through implement
        ↓
$speckit-analyze → $speckit-converge   post-implement analysis, then convergence vs spec/plan/tasks
```

Impeccable `polish` (final quality pass; detector findings resolved or recorded) runs inside the
post-implementation window — after `audit`/fix tasks and before convergence — as part of closing
the surface; it is not a separate pipeline stage.

**Ownership boundaries (binding):** SpecKit owns WHAT and WHY (requirements, tasks, analysis,
convergence). Impeccable `shape` owns visual/design direction before checklist/tasks. Impeccable
build/craft happens during implementation, executed through SpecKit tasks — Impeccable must NOT
become an independent implementation authority that bypasses the task list. Impeccable
critique/audit happen after implementation and before convergence.

Ordering notes and justified deviations:

- **`shape` precedes `checklist`/`tasks`** for visual phases: the design brief is an input to
  task generation (tasks must name primitives, states, and the direction contract they build).
  For purely structural phases (e.g. Phase 01 tooling), `shape` is skipped and the plan's
  Design Direction section is enough.
- **Build/craft work lives inside `$speckit-implement`**, executed as SpecKit tasks in the
  committed design world. There is no separate Impeccable build stage between `shape` and
  `checklist`; scheduling craft work before tasks exist would put the cart before the task list.
- **`critique`/`audit` sit between implementation and convergence** because they produce fix
  tasks; folding them earlier would review unbuilt work, folding them after converge would
  invalidate the convergence baseline.
- **`extract` is scheduled in Phases 15/19**, where drift across many surfaces is detectable,
  and wherever a pattern appears three times during implementation.
- **`constitution` and `taskstoissues` are out of scope** for this roadmap unless the owner asks.
- `$speckit-autopilot` may drive a phase only when the owner explicitly asks for unattended
  execution; the manager/worker split it documents still requires human answers at the clarify
  and checklist gates.

### 6.3 What must appear in every frontend `plan.md`

1. **Design Direction** — mode (Persuade/Operate/Read), the surface brief path under
   `.impeccable/`, and the direction contract's six blocks (THESIS, OWN-WORLD, STORY,
   FIRST VIEWPORT, FORM, FINISH) or an explicit statement that the surface inherits an existing
   world unchanged.
2. **Contract Consumption** — the RPCs/reads/subscriptions used, cited to §3, with a statement
   that no contract changes are proposed.
3. **State Matrix** — the phase's loading/empty/success/error/forbidden/offline/realtime states
   as concrete UI outcomes.
4. **Presentation-Contract Migration** — the E2E selectors/names the phase intentionally
   changes, each with the suite and test that must be updated in the same commit.
5. **Accessibility Plan** — semantics, labels, focus order, live regions, contrast, target sizes.
6. **Responsive Plan** — the breakpoints the surface must satisfy and its mobile/tablet posture.
7. **Evidence Plan** — screenshots at required viewports, detector output, test output, and where
   they are recorded.

### 6.4 How Impeccable is prevented from changing things it must not touch

| Risk                                               | Guardrail                                                                                                                                                                                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changing backend behavior                          | The design brief and tasks may only reference §3 contracts. Any task touching `supabase/**`, `src/types/database.types.ts`, or an RPC signature is rejected at `analyze` (gate F-G11)                                                         |
| Changing authorization rules                       | Guards/predicates are named as _presentation inputs_ in the plan; tasks that would alter a guard decision, add a client-side permission, or hide a required denial are rejected. `NotAuthorized` rendering and E2E denial tests are the check |
| Changing database contracts                        | No migration, no SQL, no generated type edit is in any phase's scope. `npm run test:db` must pass unchanged                                                                                                                                   |
| Inventing unsupported functionality                | Every FR must cite a spec (`001`–`020`), this plan, or a recorded clarification. Unsupported surfaces are recorded as out-of-scope (§7.3, C4–C6)                                                                                              |
| Creating duplicate components                      | Primitives are enumerated in `DESIGN.md` + the dev gallery; a new primitive requires amending the design system (`extract` or a Phase 02 amendment task), and `analyze` flags a third copy of a pattern (gate F-G10)                          |
| Introducing inconsistent visual patterns           | Tokens only (no raw hex/magic spacing), one motion grammar, one state vocabulary. Phase 15's `audit` + `extract` pass is the enforcement point; the design-detector hook surfaces findings during every edit                                  |
| Rewriting user-facing copy to fit a layout         | Copy changes are listed in the phase's Presentation-Contract Migration and any user-visible wording change that E2E asserts requires the paired test update                                                                                   |
| Scope creep into "design systems nobody asked for" | Phase 02's primitive list is closed; additions ride later phases with justification (FA-5, constitution VIII)                                                                                                                                 |

### 6.5 Roles in the pipeline

- **SpecKit owns truth**: requirements, acceptance criteria, tasks, analysis, convergence. It is
  the only source for _what_ and _why_.
- **Impeccable owns craft**: direction, composition, tokens, component craft, critique, audit,
  polish. It is the only source for _how it looks and feels_.
- **The repository owns constraints**: contracts, conventions, and tests outrank both when they
  conflict.

### 6.6 Impeccable artifact policy

Commit `PRODUCT.md`, `DESIGN.md`, and surface briefs (they are durable design authority). Ignore
heavy ephemeral output (`.impeccable/review/**` screenshots, `.impeccable/mocks/**` comps,
`.impeccable/build/**`) unless the owner wants goldens in-repo; if goldens are wanted, keep a
curated subset (one file per required viewport per surface) and say so in `docs/conventions.md`.
`.impeccable/config.local.json` stays machine-local (already excluded via `.git/info/exclude`).

---

## 7. Frontend Surface Inventory

Every route in `src/app/router.tsx`, validated against the repository. "Exists" means a
functional implementation is present and E2E-asserted; it does **not** mean production quality.

### 7.1 Surface table

| Route                                | Component(s)                                                                                                  | Actor(s)                       | Status today                                                                                               | Gap class                                                       | Phase |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----- |
| `/`                                  | `RootPage`                                                                                                    | public                         | Placeholder text + H1 asserted by E2E                                                                      | Decision C2 → real entry or retire                              | 04    |
| `/r/:slug`                           | `RestaurantPublicPage` → `RestaurantEntry`                                                                    | customer                       | Functional (branch/table/channel/identity/validation)                                                      | Visual + mobile UX + brand + join guidance                      | 04    |
| `/r/:slug/menu`                      | `CustomerMenuPage` → `SessionIndicator`, `CartPanel`, `RoundsHistory`                                         | customer                       | Functional (menu, extras, cart, submit, history, 10 s poll)                                                | Visual + categories nav + item detail + status UX + mobile cart | 05    |
| `/order/:branchId`                   | `OrderPage`                                                                                                   | public                         | Placeholder, H1 asserted                                                                                   | Decision C1                                                     | 04    |
| `/signin`                            | `SignInPage`                                                                                                  | staff                          | Functional (sign-in + recovery request modes, return-to)                                                   | Visual + shell fit                                              | 04    |
| `/reset-password`                    | `ResetPasswordPage`                                                                                           | any session                    | Functional (recovery link → new password)                                                                  | Visual                                                          | 04    |
| `/account/password`                  | `ChangePasswordPage`                                                                                          | any signed-in                  | Functional (verify-then-update, session matrix messaging)                                                  | Visual                                                          | 04    |
| `/dashboard`                         | `DashboardPage`                                                                                               | staff                          | Functional but overloaded: context switcher + nav + scope + branches + create-restaurant panel in one page | Restructure into home + shell                                   | 03    |
| `/dashboard/profile`                 | `ProfilePage`                                                                                                 | staff                          | Functional (own profile read)                                                                              | Visual                                                          | 03    |
| `/dashboard/restaurant`              | `ManageRestaurantPage` + `RestaurantQrPanel`, `WorkingHoursEditor`, `StaffManagementPanel`                    | owner                          | Functional (profile/settings/QR/hours/tables/staff)                                                        | Split + visual + tables UX                                      | 06    |
| `/dashboard/branches`                | `BranchesPage`                                                                                                | staff scoped                   | Functional (policy-scoped list)                                                                            | Visual + table UX                                               | 06    |
| `/dashboard/branches/:branchId`      | `BranchDetailPage` + `BranchSessionsPanel`                                                                    | owner/manager/cashier          | Functional (branch detail, tables, sessions, live)                                                         | Visual + structure                                              | 06    |
| `/dashboard/staff`                   | `StaffListPage`                                                                                               | owner/manager                  | Functional (staff list + provisioning panel)                                                               | Visual + dialog/drawer patterns                                 | 06    |
| `/dashboard/sessions`                | `StaffSessionsPage` + `BranchSessionsPanel`                                                                   | owner/manager/cashier          | Functional (open sessions, participants, close with confirm)                                               | Visual + realtime cue                                           | 09    |
| `/dashboard/menu`                    | `MenuPage` + `MenuStructurePanel`, `MenuItemEditor`, `ExtrasEditor`, `ItemImageField`, `AvailabilityControls` | owner                          | Functional (categories/items/extras/price/availability/image)                                              | Restructure + visual + mobile                                   | 07    |
| `/dashboard/branches/:branchId/menu` | `BranchMenuPage` + `BranchMenuPreview`                                                                        | owner/manager/any branch staff | Functional read-only branch menu                                                                           | Visual + availability controls                                  | 07    |
| `/dashboard/tax`                     | `TaxPage` + `TaxRulesPanel`                                                                                   | owner                          | Functional (rules CRUD, compounds, ordering)                                                               | Visual + complex-form UX                                        | 08    |
| `/dashboard/branches/:branchId/tax`  | `BranchTaxPage` + `BranchTaxPanel` + `TaxPreview`                                                             | owner/manager                  | Functional (effective config, overrides, preview)                                                          | Visual + precedence explainability                              | 08    |
| `/dashboard/rounds`                  | `CashierRoundsPage` + `RoundCard`, `BillPanel`                                                                | cashier/manager/owner          | Functional (grouped rounds, transitions, modify, void, bill, live)                                         | Visual + density + keyboard + realtime UX                       | 09    |
| `/dashboard/kitchen`                 | `KitchenDashboardPage` + `TicketCard`                                                                         | kitchen (and staff)            | Functional (3 columns, transitions, live, money-free)                                                      | Visual + large-format KDS + offline UX                          | 10    |
| `/dashboard/audit`                   | `AuditLogPage`                                                                                                | owner/manager                  | Functional (filterable audit trail)                                                                        | Visual + table UX                                               | 13    |
| `/dashboard/reports`                 | `ReportsPage`                                                                                                 | owner/manager                  | Functional (per-branch per-period aggregates, comparison)                                                  | Visual + chart/table craft                                      | 13    |
| `/dashboard/voids`                   | `VoidReportPage`                                                                                              | owner/manager                  | Functional (void ledger)                                                                                   | Visual + table UX                                               | 13    |
| `/admin`                             | `AdminPage`                                                                                                   | super admin                    | Thin landing (identity + link)                                                                             | Real console landing                                            | 14    |
| `/admin/platform`                    | `PlatformConsolePage` + `OnboardingPanel` + `SubscriptionBanner`                                              | super admin                    | Functional (overview table, dates, disable, onboarding)                                                    | Visual + table + destructive-action patterns                    | 14    |

### 7.2 Cross-surface capabilities (not routes) that phases must cover

- **Restaurant/branch context switching** — today scattered (selects inside `DashboardPage`,
  `useStaffBranchOptions` in ops pages, `?branch=` deep links). Phase 03 owns one convention.
- **Role-aware navigation** — the set of entries each role may see already exists as predicates
  in `DashboardPage`; Phase 03 turns it into the shell's navigation model.
- **In-app notification cue** — `DashboardLiveCue` + `useNewRoundCue` (Phase 12 owns the
  presentation and the global toast policy).
- **Subscription awareness** — `SubscriptionBanner` renders on the dashboard today (Phase 12/14).
- **Session recovery/refusal** — `SessionIndicator` + recovery redirect in `CustomerMenuPage`
  (Phase 04/05 own its UX; the rules are frozen).
- **Unauthorized/denial views** — `NotAuthorized` (Phase 03 owns its look, not its decision).

### 7.3 Explicitly NOT in the product (do not build in any phase)

Payments/payment capture, invoice printing, receipt printing, bill splitting, accounting,
internal inventory, customer accounts, WhatsApp/SMS/email/push notifications, discounts and
coupons, loyalty, dynamic/generated QR per table, native mobile apps, POS integrations, data
exports, analytics/marketing tracking, multi-language/RTL, and any new business table or RPC.
Each of these is recordable as a future scope change that must go through the constitution and
a backend spec — never through a frontend phase.

---

## 8. Phase Roadmap

20 phases. Each is a SpecKit feature with its own directory, spec, plan, checklist, tasks,
analysis, and convergence run. Every phase inherits the canonical operating model (§6 — the one
pipeline defined in §6.2) and the global gates (§12); those are not repeated per phase. The
per-phase Impeccable Workflow bullets below name that phase's Impeccable activities only; in every
phase "build" means build/craft work executed **during `$speckit-implement` as SpecKit tasks**
(never before tasks exist), and `critique`/`audit`/`polish` happen **after implementation and
before convergence** — exactly as §6.2 orders them.

| Phase | Name                                                            | Feature dir                                 | Primary actors                  |
| ----- | --------------------------------------------------------------- | ------------------------------------------- | ------------------------------- |
| 01    | Frontend Foundation & Architecture Baseline                     | `specs/021-frontend-foundation`             | all (enabling)                  |
| 02    | Design System & Visual Language                                 | `specs/022-frontend-design-system`          | all (enabling)                  |
| 03    | Application Shell, Navigation & Global UX Infrastructure        | `specs/023-application-shell-and-global-ux` | staff, platform, customer shell |
| 04    | Authentication, Account & Customer Entry UX                     | `specs/024-auth-and-customer-entry-ux`      | staff, customer                 |
| 05    | Customer Menu, Cart, Rounds & Order Status UX                   | `specs/025-customer-ordering-ux`            | customer                        |
| 06    | Restaurant, Branch, Tables & Staff Management UX                | `specs/026-management-ux`                   | owner, manager                  |
| 07    | Menu Management UX                                              | `specs/027-menu-management-ux`              | owner, manager                  |
| 08    | Tax Configuration UX                                            | `specs/028-tax-configuration-ux`            | owner, manager                  |
| 09    | Cashier Operations UX (Rounds, Sessions, Bill, Void)            | `specs/029-cashier-operations-ux`           | cashier, manager, owner         |
| 10    | Kitchen Display UX (KDS)                                        | `specs/030-kitchen-display-ux`              | kitchen                         |
| 11    | Delivery & Takeaway Channel UX                                  | `specs/031-channel-operations-ux`           | customer, cashier, kitchen      |
| 12    | Realtime, Notifications & Subscription Awareness UX             | `specs/032-realtime-and-notifications-ux`   | staff, customer                 |
| 13    | Reports, Audit & Void Log UX                                    | `specs/033-reports-and-audit-ux`            | owner, manager                  |
| 14    | Super Admin, Tenant Onboarding & Subscription Administration UX | `specs/034-platform-console-ux`             | super admin                     |
| 15    | Accessibility Hardening                                         | `specs/035-accessibility-hardening`         | all                             |
| 16    | Responsive & Device Hardening                                   | `specs/036-responsive-and-device-hardening` | all                             |
| 17    | State, Error, Loading & Offline Hardening                       | `specs/037-frontend-state-hardening`        | all                             |
| 18    | Performance & Perceived Speed                                   | `specs/038-frontend-performance`            | customer first, then staff      |
| 19    | Frontend End-to-End Validation                                  | `specs/039-frontend-e2e-validation`         | all roles                       |
| 20    | Frontend Production Readiness & Release                         | `specs/040-frontend-release-readiness`      | all                             |

---

### Frontend Phase 01 — Frontend Foundation & Architecture Baseline

**Feature dir:** `specs/021-frontend-foundation` · **Mode:** none (structural) · **Depends on:** nothing

- **Purpose** — Give every later frontend phase a safe substrate: a styles pipeline, route
  metadata, an error boundary, one query-client policy, accessibility/responsive/console test
  tooling, and a written presentation-contract ledger. No visual design decisions here.
  The ledger and the query policy are evidence-based artifacts, not opinionated defaults.
- **Scope** — `src/styles/` structure imported once; route metadata/title registry; app-level and
  route-level error UI; `QueryClient` defaults documented and centralized; base CSS (reset,
  focus-visible, skip link) deliberately neutral; dev-only design gallery route; accessibility
  lint (`eslint-plugin-jsx-a11y`, dev-only); Playwright accessibility harness (`@axe-core/playwright`,
  dev-only); Playwright viewport projects (mobile 390×844, tablet 834×1112) as tagged projects;
  unexpected-console-error/rejection/request-failure assertions helper (F-G14 semantics, with
  per-phase expected-refusal lists); the E2E presentation-contract ledger
  (`docs/frontend-presentation-contracts.md`); `docs/conventions.md` + `docs/development.md`
  updates; `.specify/feature.json` set to this feature.
- **Out of Scope** — No tokens/values (Phase 02), no shell layout or navigation (Phase 03), no
  route retirement (Phase 04), no copy changes, no backend/database/generated types, no runtime
  dependency, no production deploy.
- **Dependencies** — None. It is the first phase and blocks nothing else's _code_, but every later
  phase consumes its ledger and tooling.
- **Existing Contracts** — §3.7 (env, deploy, frozen `localStorage` keys), §2.3 (E2E hooks),
  `docs/conventions.md` naming/placement, the existing `package.json` script set (§12.3).
- **User Stories** — As the project owner I get a frontend that never shows a white screen, surfaces
  no unexpected console errors or failed requests on route changes (expected business refusals are
  explicitly identified, not treated as failures), and has an automated accessibility floor; as a
  future phase agent I get one ledger naming the assertions I must not break.
- **Functional Requirements** — FR-01 styles pipeline + import order; FR-02 per-route titles and
  meta description; FR-03 top-level error boundary rendering a recoverable error view;
  FR-04 unknown-path handling (404 state or documented redirect — clarify); FR-05 centralized
  `QueryClient` policy derived from documented current behavior — never guessed — per the
  evidence-based process below; FR-06 a11y lint enabled for `src/**`; FR-07 axe assertions runnable
  per route; FR-08 viewport projects and at least one unexpected-console-error assertion per
  top-level route; FR-09 dev-only
  gallery route excluded from production; FR-10 committed presentation-contract ledger (selectors,
  names, roles, `data-*`, `data-testid`, `localStorage` keys) generated from `e2e/**` and `src/**`,
  organized into the four stability categories (A Semantic / B Behavioral / C Test-only /
  D Storage) defined below;
  FR-11 docs updated; FR-12 any new script added to `package.json` is registered in `verify` and
  `docs/development.md` in the same commit.

**FR-05 QueryClient governance (mandatory process — the phase must not guess a policy):**

1. **Document current behavior** — the repository facts to record and cite: the single module-level
   `QueryClient` in `src/app/App.tsx` carries **default options** (no shared retry/staleTime/error
   policy); `staleTime: 60 s` on the public restaurant read; a `refetchInterval: 10 s` customer
   poll; staff surfaces rely on refetch-on-focus; realtime `SUBSCRIBED` triggers a recovery
   refetch.
2. **Define the proposed policy** as an explicit written statement (defaults + per-query-family
   deviations) before touching code.
3. **Identify behavior-sensitive settings** — `retry`, mutation retry, `staleTime`, `gcTime`,
   `refetchOnWindowFocus`, polling behavior, realtime-invalidation interaction, and error
   surfacing — each with what changes and what must not change.
4. **Validate against existing behavior** — confirm each setting preserves today's business
   behavior (poll cadence, refetch triggers, refusal rendering, realtime recovery) rather than
   "improving" it.
5. **Record regression evidence** — the unit assertions for defaults and the E2E behavior proof
   that the policy did not change any tested behavior.

Preserve existing business behavior; **no query-policy change is accepted merely because it is
considered a generic best practice.** Any deviation that would alter observable behavior is a
clarify question with the owner, not a default.

**FR-10 ledger structure (the four stability categories):**

- **A — Semantic contract:** accessible names, labels, roles, headings, live regions, and tested
  focus behavior. Highest stability: user-facing and asserted by ~666 E2E assertions; changes
  require the paired-test migration rule.
- **B — Behavioral contract:** `data-*` state hooks (`data-round-state`, `data-kitchen-column`,
  `data-ticket-state`, `data-audit-action`, `data-bill-round`, `data-voided`, `data-banner-state`,
  …), lifecycle state selectors, and state-specific DOM markers. High stability: they encode
  lifecycle/staleness assumptions; changes require the same documented-migration discipline.
- **C — Test-only contract:** `data-testid` hooks (`platform-overview`, `session-bill`,
  `report-aggregates`, `qr-code`, …). Test-internal identifiers: more movable than A/B but still
  enumerated and never removed without a same-commit test update.
- **D — Storage contract:** the frozen `localStorage` keys `restopilot.session-token` and
  `restopilot.cart`. Frozen for the entire plan; no phase may rename or repurpose them.

All existing hooks are kept; tests are never weakened to make a redesign pass; any intentional
contract change is (1) documented in the phase spec, (2) updated in the same change, (3) justified,
and (4) validated (gate F-G09).

- **UX Requirements** — Error and 404 states are human-readable, offer a route back (dashboard or
  entry), and never expose internal messages; route titles make browser history usable; no visible
  behavior change otherwise.
- **Visual Requirements** — Base normalization only: font stack inherited, sensible focus ring,
  skip-link styling, a documented spacing/typography _absence_ (Phase 02 supplies values). No
  component styling in this phase.
- **Responsive Requirements** — The three playwright viewport projects exist and pass against
  current surfaces; the breakpoint contract (names only: mobile / tablet / desktop / wide) is
  documented for Phase 02 to fill with values.
- **Accessibility** — Skip link to `#main`; `focus-visible` policy; `html[lang]` present; per-route
  document titles; WCAG target recorded (clarify: assume 2.2 AA); automated axe floor on public and
  staff routes for the signed-out state; no keyboard traps introduced.
- **State Matrix** — Route error (unhandled render), 404/unknown route, global error boundary,
  loading of the app shell, dev gallery rendering. Surface state matrices belong to their phases.
- **Security** — No new endpoints or reads; dev gallery excluded from production builds; bundle
  must still contain no non-`VITE_` variable (`npm run test:unit` production guard stays green).
- **Components** — `ErrorBoundary`, `RouteErrorView`, `NotFoundView`, `SkipLink`, `DevGallery`
  (dev-only), test utilities for viewport/a11y/console assertions.
- **Routes** — No product routes added; dev-only `/dev/gallery`; unknown-path state per FR-04.
- **Data Dependencies** — None added; the query-client policy is the only data-layer change.
- **Testing** — Unit: error-boundary rendering (static markup, matching the existing node-environment
  method), route-metadata coverage for every registered path, query-client defaults assertions (the
  FR-05 process's recorded evidence). E2E: axe baseline per route, unexpected-console-error/
  -rejection/-request-failure assertions with an explicit expected-refusal list for scenarios that
  exercise server-authoritative refusals, viewport-project smoke of the existing
  surfaces. No database/integration changes.
- **Impeccable Workflow** — Optional and non-design: run `$impeccable audit` once at the end to
  capture a pre-design technical baseline (a11y/perf/responsive findings) as evidence for Phases 15
  and 18. `init`/`shape`/build belong to Phase 02.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: WCAG target; which viewports;
  whether a WebKit project is added now (cost) or in Phase 16; 404 vs redirect for unknown paths;
  approval for the two dev-only dependencies; whether `verify` gains an a11y step. Checklist focus:
  tooling correctness and non-regression. No `shape` step (structural phase) — justified in
  plan.md's Design Direction section.
- **Exit Criteria** — `npm run verify` passes with the new lint rule and any script changes;
  Playwright a11y/console/viewport specs exist and pass against unmodified surfaces; the
  presentation-contract ledger is committed and reviewed against `e2e/**`; docs updated;
  `feature.json` points at `specs/021-frontend-foundation`.
- **Validation Gates** — `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run build`;
  `npm run test:e2e` (requires migrated+seeded cloud dev project); `npm run verify`.
- **Git Checkpoint** — One commit **after** the phase converges (tooling + docs + ledger), following
  the repo's `feat(NNN): …` convention. Do not commit the untracked tool-config directories
  (`.agents/`, `.zcode/skills/speckit-autopilot/`, `.freebuff/`).

---

### Frontend Phase 02 — Design System & Visual Language

**Feature dir:** `specs/022-frontend-design-system` · **Mode:** Operate (system) + the product's own voice · **Depends on:** Phase 01

- **Purpose** — Establish one committed visual world and one component vocabulary before any
  surface is touched, so 20 phases converge on the same product instead of 25 opinions. This is
  where Impeccable enters the project.
- **Scope** — Impeccable `init` → `PRODUCT.md`; the design world (mode, color strategy, type,
  spacing, radius, elevation, motion) → `DESIGN.md` at finish; token stylesheets; the full primitive
  inventory (§5.3) with every state; the dev gallery rendering all primitives in all states;
  component documentation; the drift rules (tokens only, no raw hex, one motion grammar);
  `docs/conventions.md` update for the UI layer; optional dark-theme decision recorded (C8).
- **Out of Scope** — No surface redesign (surfaces start in Phase 03+), no route/nav changes, no
  copy rewrite of existing surfaces, no backend/database touch, no runtime dependency, no new
  business component (e.g. `RoundCard`, `TicketCard`, `BillPanel` stay feature-owned until a later
  phase earns their promotion via `extract`).
- **Dependencies** — Phase 01 (styles pipeline, gallery route, a11y/console/viewport tooling).
- **Existing Contracts** — Presentation contracts that primitives must not break: label
  associations (73), `role="alert"`/`role="status"` live regions, two-step confirm buttons,
  `data-*` hooks. Money rendering keeps using existing formatters (`features/menu/money.ts`,
  `features/tax/taxMoney.ts`) — `MoneyText` wraps, never re-implements (master plan §16).
- **User Stories** — As an owner/manager/cashier/kitchen member I get an interface that looks and
  behaves like one product; as a customer I get readable, tappable, trustworthy screens; as a future
  agent I get components I must reuse instead of reinvent.
- **Functional Requirements** — FR-01 `PRODUCT.md` committed; FR-02 `DESIGN.md` committed at finish,
  describing the built world (not a wish list); FR-03 tokens implemented as CSS custom properties
  with semantic names; FR-04 every primitive in §5.3 **that meets the creation rule** exists with
  documented props/states — a primitive is implemented in Phase 02 when it is foundational,
  required by an identified surface, or clearly reused across multiple surfaces; AI agents must
  NOT create speculative "nice-to-have" primitives merely because they appear aesthetically
  useful. Any later phase that genuinely discovers a missing reusable primitive must: (1) identify
  the reuse case, (2) amend the design system explicitly, (3) add the primitive once, (4) document
  the amendment, and (5) reuse it rather than creating a local duplicate (FA-5, F-G10);
  FR-05 gallery renders each primitive in default/hover/focus/active/disabled/loading/error states;
  FR-06 focus-visible, reduced-motion, and forced-colors-safe defaults; FR-07 no raw color/spacing
  literals outside token files (lint or detector check); FR-08 surface briefs template + direction
  contract block recorded for Phase 03's surface; FR-09 component contract tests (static-markup
  assertions consistent with the repo's node-environment test method); FR-10 `extract`-ready
  domain-shared primitives (`MoneyText`, `StateChip`, `TotalsPanel` shell) defined once.
- **UX Requirements** — Interaction states are visible and consistent; destructive actions always
  use the confirm primitive; live regions are used for async outcomes (not for decoration); form
  errors attach to fields and are announced; nothing requires hover to be understood; dense staff
  surfaces get a compact density mode; customer surfaces get a comfortable density.
- **Visual Requirements** — One committed palette (semantic roles), type scale, spacing scale,
  radius, elevation, icon set, status vocabulary (round/ticket/subscription/availability); motion
  grammar (durations, easings, what may animate, what never animates). The direction contract is the
  authority; screenshots at required viewports are the evidence.
- **Responsive Requirements** — Breakpoint values defined (mobile/tablet/desktop/wide), touch-target
  minimum, fluid rules for cards/tables, and a documented table→card fallback strategy for narrow
  widths (consumed by Phases 06/13/14).
- **Accessibility** — Contrast verified for every token pair used for text/interactions; focus ring
  visible on every interactive primitive; target sizes ≥ the documented minimum; reduced-motion
  honored; primitives are keyboard-operable by construction (dialogs trap and restore focus).
- **State Matrix** — Per primitive: default, hover, focus-visible, active, disabled, loading,
  selected/checked, invalid, read-only, empty, skeleton. Per feedback primitive: info/success/
  warning/danger, dismissible, with/without action. Dialog: open/confirming/busy/error. Toast:
  queued/visible/dismissed/stacked overflow.
- **Security** — No secrets, no new data access, no authorization semantics inside a component.
- **Components** — The complete §5.3 inventory plus `Icon`, `Divider`, `Stack`/`Grid`, and the
  gallery. Feature-owned components are **not** restyled here except where they are plain HTML
  (they are re-composed in their own phase).
- **Routes** — None added; the dev-only gallery now renders the full system.
- **Data Dependencies** — None. The gallery uses static fixtures, never live tenant data.
- **Testing** — Unit: token presence/semantic-name assertions, component contract tests, no raw
  literals. E2E: gallery smoke + axe on the gallery, screenshot goldens per required viewport
  (curated, per §6.6). No database/integration changes.
- **Impeccable Workflow** — `$impeccable init` (product truth, once per project — includes the
  stack and build-path questions); `$impeccable shape` for the system (before checklist/tasks);
  build/craft the primitives and gallery **during `$speckit-implement`, executed as SpecKit
  tasks**; `critique` and `audit` on the gallery after implementation; fix tasks if findings
  require them; `polish` last before convergence; `DESIGN.md` written at finish from the built
  world; `document` only if a coherent incumbent system ever needs recording (not the case here).
- **SpecKit Workflow** — Full pipeline with `shape` between plan and checklist (frontend variant,
  §6.2; build/craft inside implementation). Expected clarify questions: framework-vs-CSS-modules decision (§5.1), dark mode (C8),
  density modes, icon sourcing, brand assets (logo/imagery) availability, WCAG target confirmation.
  Checklist focus: system completeness (every primitive × every state) and drift rules.
- **Exit Criteria** — `PRODUCT.md` + `DESIGN.md` exist and are committed; every primitive in the
  inventory exists with states and a gallery entry; tokens are the only color/spacing source; unit
  contract tests pass; axe + console checks pass on the gallery; screenshots archived per §6.6;
  `docs/conventions.md` documents how to consume (and how to amend) the system.
- **Validation Gates** — `npm run verify`; `npm run test:e2e -- e2e/design.system.test.ts`
  (or the phase's gallery spec); detector run on changed files with findings resolved or recorded.
- **Git Checkpoint** — Commit the system (+ `PRODUCT.md`, `DESIGN.md`, briefs) after convergence;
  `feat(022): …`. This is the checkpoint every later phase branches from — no surface work starts
  before it lands.

---

### Frontend Phase 03 — Application Shell, Navigation & Global UX Infrastructure

**Feature dir:** `specs/023-application-shell-and-global-ux` · **Mode:** Operate · **Depends on:** Phase 02

- **Purpose** — Replace the placeholder top bar with real experience shells: staff/platform chrome
  (sidebar + header + restaurant/branch context) and a lightweight customer shell; plus the global
  UX infrastructure every later surface assumes (toasts, confirmations, offline/reconnect, session
  expiry, denial view, titles).
- **Scope** — `AppShell` split into `CustomerShell` and `StaffShell`(+ platform variant); role-aware
  navigation built from the existing predicates; restaurant/branch `ContextSwitcher` with a single
  URL convention (`?restaurant=` / `?branch=` preserved where already used); `DashboardPage`
  restructured into a real home (context, role landing, operational shortcuts) while keeping the
  create-restaurant bootstrap panel for membership-less profiles; toast host + `useToast`;
  `ConfirmDialog` primitive adoption for the two-step confirmations; global offline/reconnect banner
  driven by realtime channel status + `navigator.onLine`; session-expiry/signed-out handling route;
  `NotAuthorized` restyled; skip link + landmarks; mobile navigation drawer.
- **Out of Scope** — No change to guard _decisions_, predicate logic, or denial semantics; no change
  to auth flows (Phase 04); no surface feature work (Phases 04–14); no API/RPC changes; no new
  business data reads beyond existing context/branches reads.
- **Shell architecture bounds (FA-15, mandatory):** shells are **composition/infrastructure
  components, not business-logic containers.** A shell may consume: authentication context,
  navigation models, context-switching state, global UI infrastructure (toast host, banners,
  error boundaries), and route metadata. A shell must NOT own: feature-specific business
  mutations, feature-specific data fetching, domain lifecycle logic, database access,
  client-side authorization enforcement, or feature-specific state machines. Feature data flows
  through the existing feature-module hooks; authorization stays server-authoritative and client
  guards (including anything the shell renders) stay presentation-only.
- **Dependencies** — Phase 02 primitives (nav, drawer, dialog, toast, badge), Phase 01 tooling.
- **Existing Contracts** — `current_auth_context`, the `branches` policy-scoped read used for branch
  options; guards in `features/auth/guards.tsx` (unchanged behavior); sign-out via
  `authClient.signOut()` (local scope, other devices unaffected); multi-membership context switching
  (FR-015 of spec 003); E2E assertions on `/dashboard` heading and role-based nav link presence.
- **User Stories** — As an owner with two restaurants I switch context in one place; as a branch
  manager I see only my branch everywhere; as a cashier I land on the operational surface relevant
  to my shift; as a kitchen member I never see cashier/money entries; as anyone I get told when I am
  offline, when my session expired, and when an action succeeded or failed.
- **Functional Requirements** — FR-01 two shells selected by route group (public/customer vs staff/
  platform); FR-02 navigation model derived from predicates, one declaration point; FR-03 context
  switcher (restaurant, branch, “all branches” for owners) persisted across routes; FR-04 dashboard
  home replaces the current wall of lists; FR-05 toast API with success/error/info variants, used for
  mutation outcomes that today are inline-only, without removing verbatim inline errors; FR-06
  confirm dialog wraps every destructive action (session close, void, membership removal, subscription
  disable) with the same two-step semantics E2E asserts; FR-07 offline/reconnect banner with a manual
  retry that refetches active queries; FR-08 session-expiry handling (guarded routes redirect with
  return-to as today, plus a friendly message); FR-09 mobile drawer navigation; FR-10 route titles
  from Phase 01 wired per surface; FR-11 `NotAuthorized` view explains what the account lacks and how
  to get access (without disclosing tenant data); FR-12 no surface may render both shells.
- **UX Requirements** — Current location is always evident (active nav state, breadcrumb for branch
  detail); destructive actions require explicit confirmation and state the consequence; async
  outcomes are announced without stealing focus; long lists are scrollable within the shell, not the
  page body; keyboard order is logical from skip link onward; the shell never shifts layout when
  toasts appear.
- **Visual Requirements** — Sidebar/header hierarchy, active/hover states, context switcher visual
  identity, denial view, banner/offline state, and toast styling all from Phase 02 tokens. The staff
  shell is desktop/tablet-first and dense; the customer shell is mobile-first and airy.
- **Responsive Requirements** — Staff shell: persistent sidebar ≥ desktop, collapsible/drawer on
  tablet, drawer + compact header on mobile; platform console uses the same shell with its own nav
  group; customer shell: single column, sticky session indicator, bottom-anchored primary actions.
- **Accessibility** — Landmarks (`header`/`nav`/`main`/`aside`), one `h1` per page, skip link first
  in tab order, drawer/dialog focus trap + restore, `aria-current` on active nav items, toast and
  banner live regions configured politely (never `assertive` for passive news), and no
  navigation-by-hover.
- **State Matrix** — Shell resolution (loading context, resolved, context error, no memberships,
  unlinked identity, denied); offline / reconnecting / recovered; toast queued / visible / dismissed /
  stacked; session expired; unknown route; membership removed mid-session (next action refuses →
  toast + refetch); mobile drawer open/closed.
- **Security** — Navigation visibility remains presentation-only; the shell must never fetch data a
  role cannot read (branch options come from the policy-scoped read + memberships); no tenant
  identifiers are rendered for out-of-scope branches; `NotAuthorized` never reveals names.
- **Components** — `StaffShell`, `CustomerShell`, `Sidebar`, `TopBar`, `MobileNav`, `ContextSwitcher`,
  `UserMenu`, `ToastHost`, `ConfirmDialog` usage site, `OfflineBanner`, `NotAuthorized` (restyle),
  `PageHeader`, `Breadcrumbs`.
- **Routes** — All existing routes re-mounted inside the correct shell; no path changes. Any change to
  a path is forbidden in this phase (decision C1/C2 belongs to Phase 04).
- **Data Dependencies** — `current_auth_context` (existing), `branches` read for the switcher
  (existing), realtime channel status for the offline banner (existing bindings).
- **Testing** — Unit: navigation model per persona (extend the existing persona matrix in
  `tests/unit/auth.guards.test.tsx` style), shell selection, context-switcher resolution.
  E2E: sign-in → land on dashboard for each role (existing assertions preserved), role-based nav
  presence/absence, context switch persistence, confirm-dialog destructive flows, offline banner +
  recovery, session-expiry redirect with return-to, mobile drawer navigation at the Phase 01 mobile
  viewport, axe on shell routes.
- **Impeccable Workflow** — `$impeccable shape` for the shell surfaces (staff shell + customer
  shell + dashboard home) before checklist/tasks; build the shells **during `$speckit-implement`
  as SpecKit tasks**; `critique` on the shell
  at both densities; `audit` for the drawer/dialog focus behavior; fix tasks if required; `polish`
  before convergence.
- **SpecKit Workflow** — Full pipeline with `shape` between plan and checklist. Expected clarify
  questions: nav item ordering per role; whether the dashboard home absorbs or links the ops queues;
  whether toasts replace or accompany inline success text (E2E asserts several `role="status"`
  messages — keep them); offline banner trigger source; membership-less bootstrap placement.
  Checklist focus: authorization neutrality + E2E presentation migrations.
- **Exit Criteria** — Every route renders inside the correct shell; role-based nav verified for all
  seeded personas; destructive flows confirmed through the dialog primitive with existing assertions
  migrated and recorded; offline/reconnect banner demonstrated; `NotAuthorized` restyled without
  changing its decision semantics; verify + e2e green.
- **Validation Gates** — `npm run verify`; `npm run test:e2e` (all existing suites must pass, with a
  documented list of any deliberately migrated selector/name); `npm run test:unit`; axe + console
  checks on shell routes.
- **Git Checkpoint** — Commit after convergence; `feat(023): …`. No surface phase starts before this
  lands (Phase 04+ assumes the shells exist).

---

### Frontend Phase 04 — Authentication, Account & Customer Entry UX

**Feature dir:** `specs/024-auth-and-customer-entry-ux` · **Mode:** Persuade (public entry) + Operate (credentials) · **Depends on:** Phase 03

- **Purpose** — Make the two entry experiences real: staff credential surfaces that feel trusted, and
  a customer entry that a guest at a table can complete on a phone in seconds. Also resolve the two
  placeholder routes (C1/C2) explicitly.
- **Scope** — `/signin` (sign-in + recovery request), `/reset-password`, `/account/password`;
  `/r/:slug` customer entry (branch → channel → table/address → identity) with the join-existing-session
  affordance and not-found state; `/` root purpose; `/order/:branchId` decision; customer shell fit;
  brand presentation from `get_public_restaurant` (name, brand description, branch/table payload).
- **Out of Scope** — No change to auth semantics: the single generic failure message, the
  non-enumerating recovery confirmation, verify-then-update password change, session persistence and
  multi-tab semantics (spec 020), the guards, or the return-to mechanism. No new identity fields, no
  customer accounts, no sign-up (self-service sign-up stays disabled). No session/token algorithm or
  `localStorage` key change.
- **Dependencies** — Phase 03 (shell + feedback primitives).
- **Existing Contracts** — `authClient` (`signIn`, `signOut`, `requestPasswordReset`, password update
  via ephemeral verification client), `current_auth_context` (landing decision), `get_public_restaurant`,
  `open_session_at_table`, `open_session_channel`, token storage in `restopilot.session-token`,
  client-side validation bounds mirrored from the RPC contract (display name ≤ 60, phone regex,
  address ≤ 200), verbatim server messages.
- **User Stories** — As a staff member I sign in quickly and recover my password without guessing; as
  an unlinked or membership-less identity I still understand where I stand; as a guest at a table I
  pick my table, give my name and phone, and reach the menu on a phone without zooming; as a returning
  guest I rejoin the open session instead of creating a duplicate.
- **Functional Requirements** — FR-01 staff sign-in surface with mode switch to recovery; FR-02
  password-recovery request surface with the generic confirmation preserved verbatim in behavior;
  FR-03 recovery-link landing (`/reset-password`) and account password (`/account/password`) surfaces;
  FR-04 customer entry wizard with branch (auto-skipped for single-branch restaurants), channel
  (dine-in/delivery/takeaway), table or address, identity; FR-05 client validation feedback identical
  in outcome to today (same messages, same ordering); FR-06 join-existing-session affordance and
  closed-session behavior guidance preserved; FR-07 not-found restaurant state; FR-08 root route
  decision implemented; FR-09 `/order/:branchId` decision implemented with E2E migration if the
  heading/route changes; FR-10 entry remembers nothing beyond the token contract.
- **UX Requirements** — One decision per screen on mobile; branch/table selection is a select or
  list with large targets (no free text); channel choice explains the difference in one line each;
  phone/name fields carry input hints and correct `inputMode`/`autoComplete`; validation feedback
  appears next to the field and in the alert region; the primary action label matches the channel
  (`Join the table`, `Start a delivery order`, `Start a takeaway order` — names asserted by E2E);
  busy state prevents double submit; recovery flow explains where the emailed link leads.
- **Visual Requirements** — Trust-forward credential surfaces (restrained color, clear hierarchy, no
  jokes); customer entry leads with the restaurant name and brand description; QR-origin entry feels
  like the restaurant's page, not a platform page. All from Phase 02 tokens/primitives.
- **Responsive Requirements** — Customer entry is designed at 390 px first (single column, ≥ 44 px
  targets, sticky primary action, no horizontal scroll), verified at tablet/desktop; credential
  surfaces are centered with a max measure on desktop and full-bleed on mobile.
- **Accessibility** — Explicit labels and `autocomplete` on every credential field; error summary +
  field-level errors; radio group for channels with a `fieldset`/`legend`; focus moves to the first
  invalid field on submit failure; alert region announced; heading order preserved (`h1` = restaurant
  name on entry, asserted by E2E).
- **State Matrix** — Sign-in: idle / submitting / generic failure / awaiting context / success redirect;
  recovery: idle / sending / confirmation / rate-limited (without enumeration); entry: loading payload /
  not found / single branch / multi branch / channel-specific branches / validating / submitting /
  server refusal (verbatim) / success; join-session: existing open session / table free / stale token /
  closed session; recovery landing: valid link / expired link / no session.
- **Security** — No enumeration in recovery; no credential echoes; publishable key only; no tenant data
  on the not-found state; server refusals rendered verbatim; the visual layer must not introduce a
  "remember me" or any mechanism that changes session persistence semantics.
- **Components** — `AuthCard`, `CredentialForm` (uses `Field`/`Input`/`Button`), `RecoveryRequestForm`,
  `ResetPasswordForm`, `ChangePasswordForm`, `EntryWizard` (steps), `ChannelSelector`, `TablePicker`,
  `BranchPicker`, `CustomerShellHeader` (restaurant identity), `SessionJoinNotice`.
- **Routes** — `/signin`, `/reset-password`, `/account/password`, `/r/:slug`, `/` (per FR-08),
  `/order/:branchId` (per FR-09). No other path changes.
- **Data Dependencies** — `get_public_restaurant`, `open_session_at_table`, `open_session_channel`,
  `current_auth_context`, `authClient` surfaces. All existing.
- **Testing** — Unit: entry validation mapping (existing `channel.entry` tests extended), root/order
  route decisions, recovery copy assertions. E2E: existing `auth.routes` + `session.surfaces` entry
  and validation tests preserved and extended (single-branch skip, channel switching, join notice,
  not-found); axe on all four public surfaces; unexpected-console-clean navigation (expected
  refusals named per F-G14); mobile-viewport completion of
  the full entry flow. No database changes.
- **Impeccable Workflow** — `$impeccable shape` on `/r/:slug` (Persuade) and `/signin` (Operate);
  build; `critique` on the customer entry at 390 px; `audit` for label/contrast/target checks;
  `clarify` for copy; `polish` before exit.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: root route purpose (C2);
  `/order/:branchId` fate (C1); whether the entry wizard is single-page or stepped on mobile; how the
  join notice is worded; whether restaurant imagery/brand assets exist (if none, state absence rather
  than inventing logos). Checklist focus: frozen auth semantics + mobile usability.
- **Exit Criteria** — Both entry experiences are production-quality at mobile and desktop; every
  existing auth/entry E2E assertion still passes or is deliberately migrated and recorded;
  C1/C2 resolved and implemented; axe + console checks clean.
- **Validation Gates** — `npm run verify`; `npm run test:e2e` with `e2e/auth.routes.test.ts`,
  `e2e/session.surfaces.test.ts`, `e2e/routes.test.ts`, `e2e/smoke.test.ts` green; axe specs; mobile
  viewport spec.
- **Git Checkpoint** — Commit after convergence; `feat(024): …`.

---

### Frontend Phase 05 — Customer Menu, Cart, Rounds & Order Status UX

**Feature dir:** `specs/025-customer-ordering-ux` · **Mode:** Operate (mobile-first) · **Depends on:** Phase 04

- **Purpose** — The product's core revenue path: browsing a menu, building a cart with extras,
  submitting a round, and seeing order status — all on a phone at a table with one thumb.
- **Scope** — `/r/:slug/menu`: category navigation, item list with availability, item detail with
  structured extras, quantity, add-to-cart feedback; cart surface (lines, totals, adjust/remove,
  submit, empty state); rounds history with captured money and state vocabulary; session indicator and
  recovery states; cutoff messaging (delivery/takeaway) presented as a state, not a surprise; the
  10 s status cadence surfaced honestly (freshness affordance, manual refresh).
- **Out of Scope** — No pricing/tax computation in the UI (captured money only, one canonical
  presentation); no cart server-side persistence (the cart stays device-local under
  `restopilot.cart`); no change to `submit_round` semantics, cutoffs, or the availability rule; no
  customer accounts; no new item fields (no free-text notes — extras are structured only); no
  optimistic price math presented as truth.
- **Dependencies** — Phase 04 (entry + shell), Phase 02 primitives, Phase 03 toasts/offline.
- **Existing Contracts** — `get_session_menu` (branch menu payload: categories, items, extras,
  availability layers, `is_offered`), `get_session_rounds` (rounds with captured prices and tax lines,
  newest-first), `submit_round` (all-or-nothing, server validation, verbatim refusals), session context/
  indicator reads, `ROUND_STATE_LABEL` customer vocabulary (`Sent to kitchen`, `Accepted`,
  `Being prepared`, `Ready`, `Served`), 1–99 quantity bounds, empty-cart guard, double-submit guard.
- **User Stories** — As a customer I find my dish fast, understand extras and prices, send my order, and
  see exactly where it stands without asking staff; as a second guest at the same table I add my own
  round to the shared session; as a delivery customer I understand when I can no longer add items.
- **Functional Requirements** — FR-01 category navigation (anchors or segmented control) with counts and
  availability awareness; FR-02 item list with price, description, image (when present), availability
  state; FR-03 item detail/add flow with required/none extras and quantity; FR-04 cart with line
  adjust/remove, advisory total, and the itemized state preserved across reload; FR-05 submit with
  disabled/busy state, success feedback naming the round/ticket, and preserved cart on refusal;
  FR-06 rounds history with per-round state, items, extras, captured subtotal/tax/total; FR-07 session
  indicator with channel/table/address echo; FR-08 cutoff state explaining why continuation is closed;
  FR-09 status freshness affordance for the poll; FR-10 recovery-refusal return-to-entry (frozen rule);
  FR-11 empty states for no categories, no items, empty cart, no rounds.
- **UX Requirements** — One-hand reachability for primary actions; sticky cart affordance with line count;
  no layout jump when a round is submitted; add-to-cart feedback is immediate and does not navigate away;
  unavailable items are visibly unavailable rather than hidden mysteries; refusal messages appear where
  the action happened and the cart is untouched; the taste of the page is the restaurant's, not the
  platform's; totals presented as a bill-like summary, not a debug list.
- **Visual Requirements** — Food imagery handling (missing images must look intentional), price
  hierarchy, extra markers, state chips for rounds, cart drawer/sheet and its desktop variant. All from
  Phase 02 tokens; the money presentation is one component (`MoneyText`/`TotalsPanel`).
- **Responsive Requirements** — 390 px design target; item grid becomes a single column under tablet;
  cart is a bottom sheet on mobile and a side panel on desktop; category navigation becomes a horizontal
  scroller on mobile; the whole flow must be completable without horizontal scrolling at 320–430 px.
- **Accessibility** — Quantity as a labelled number input (E2E uses `getByRole('spinbutton')`); extras as
  a labelled fieldset with real checkboxes; add-to-cart results announced; cart status as a `region`
  named `Cart` (asserted — migrate deliberately if the name changes); submit result in a `status` region
  (asserted); refusals in an `alert` region (asserted); focus returns to a sensible place after add/remove;
  contrast on price/availability text; image `alt` from item name.
- **State Matrix** — Menu: loading (skeleton) / loaded / partial (category empty) / error with retry /
  unavailable-session refusal → return to entry; Item: available / not offered / image missing / extras
  none-required-optional; Cart: empty / lines / adjust in-flight / submit busy / refusal preserved /
  cutoff closed; History: loading / empty / rounds / poll stale / refresh failure; Session: resolved /
  closed / tampered token (frozen behavior).
- **Security** — Reads and writes only through token-scoped RPCs; no staff data and no phone numbers in
  customer payloads; no client-side authorization assumptions; the advisory cart must never be presented
  as authoritative money.
- **Components** — `CategoryNav`, `ItemCard`, `ItemDetailSheet`, `ExtrasFieldset`, `QuantityInput`,
  `CartSheet`, `CartLine`, `TotalsPanel` (shared shell), `SubmitBar`, `RoundTimeline`/`RoundCard`
  (customer variant), `SessionBar` (indicator), `CutoffNotice`, `RefreshAffordance`.
- **Routes** — `/r/:slug/menu` only (plus the entry redirect behavior already owned by Phase 04).
- **Data Dependencies** — `get_session_menu`, `get_session_rounds`, `submit_round`, session context read;
  realtime is intentionally **not** subscribed for customers (10 s poll is the contract).
- **Testing** — Unit: cart merge/bounds/token-scoping (existing `order.cart` tests extended if the cart
  component shape changes), totals rendering from captured money only, state-label mapping. E2E: every
  existing cart/submission/history assertion in `e2e/session.surfaces.test.ts` preserved (add with extras,
  advisory total, adjust/remove, reload persistence, no cart on entry, submit clears + names ticket,
  poisoned-cart refusal preserves cart, two rounds, cutoff refusal above preserved cart); new: category
  navigation, item detail extras, mobile-viewport completion, axe on the menu route,
  unexpected-console-clean poll (expected refusals named per F-G14).
- **Impeccable Workflow** — `$impeccable shape` on the customer menu (mobile composition, cart model);
  build; `critique` on the 390 px flow; `audit` (targets, contrast, live regions); `clarify` for status
  copy; `harden` for cutoffs/stale states; `polish` last.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: cart as sheet vs dedicated step;
  category navigation style; whether item images are available in seed/production (absent ⇒ designed
  absence); how "stale status" is communicated; whether the customer may cancel a submitted round
  (contract says no — record the refusal). Checklist focus: money fidelity (captured, never recomputed)
  and preserved verbatim refusals.
- **Exit Criteria** — A guest completes the full journey on a 390 px viewport with no unexpected
  console errors or network failures (expected refusals — poisoned cart, cutoff, closed session —
  are explicitly identified as expected in the phase's E2E scenarios);
  every existing cart/order E2E assertion passes or is migrated with a recorded reason; axe clean;
  money on screen is captured money only; cutoffs and refusals show the server's message verbatim.
- **Validation Gates** — `npm run verify`; `npm run test:e2e` (`session.surfaces`, `routes`, plus the new
  customer specs at mobile viewport); axe spec; `npm run test:unit` (cart/order client unchanged).
- **Git Checkpoint** — Commit after convergence; `feat(025): …`.

---

### Frontend Phase 06 — Restaurant, Branch, Tables & Staff Management UX

**Feature dir:** `specs/026-management-ux` · **Mode:** Operate · **Depends on:** Phase 03

- **Purpose** — Turn the owner/manager configuration surfaces from stacked forms into navigable
  management screens: restaurant identity, branches, tables, working hours, the QR entry point, and
  staff provisioning — the surfaces an owner lives in on day one.
- **Scope** — `/dashboard/restaurant` split into navigable sections (profile, settings, QR, hours,
  tables); `/dashboard/branches` list + `/dashboard/branches/:branchId` detail (branch data, tables,
  working hours, sessions entry); `/dashboard/staff` list + provisioning flow + membership edit/removal;
  QR panel presentation (SVG/PNG download, entry URL) with `qr-code`/`qr-entry-url` hooks preserved;
  destructive/impactful confirmations (identifier change, membership removal, table deactivation);
  owner-only vs manager-scoped affordances made visually explicit.
- **Out of Scope** — No changes to RPC validation rules, error messages, or audit behavior; no
  identifier-release semantics change; no new staff roles or permission model; no bulk import; no
  branch deletion (not in the contract); no change to last-owner safeguards; no session/menu/tax work
  (later phases).
- **Dependencies** — Phase 03 (shell, context switcher, confirm dialog, toasts).
- **Existing Contracts** — `create_restaurant` (bootstrap + owner membership), `update_restaurant_profile`,
  `update_restaurant_settings`, `create_branch`, `rename_branch`, `replace_branch_working_hours`
  (split days, post-midnight intervals, all-or-nothing), `create_dining_table`, `rename_dining_table`,
  `set_dining_table_active`, `add_staff_member` (one-time credential shown once; existing identity linked
  without credential; unclaimed stub gains profile + credential), `update_staff_membership`,
  `remove_staff_membership`, `get_branch_open_sessions` (entry to oversight), policy-scoped `branches`
  and `profiles` reads, audit writers.
- **User Stories** — As an owner I set up my restaurant, branches, tables and staff in a guided order and
  recover the QR to print; as a branch manager I edit exactly my branch's tables and hours; as an owner
  I add a team member and hand over a one-time credential without it ever being shown twice; as any
  scoped staff member a deep link outside my scope tells me clearly that I am out of scope.
- **Functional Requirements** — FR-01 restaurant profile/settings sections with the identifier-change
  warning-before-confirm flow (cancelled by default, never submitted accidentally); FR-02 branch
  create/rename with working-hours editor (split days, overnight intervals, validation messages
  verbatim); FR-03 tables management (create, rename, activate/deactivate, per-branch listing, inactive
  state visible); FR-04 QR panel with the restaurant-level entry URL, size/format options, and download;
  FR-05 staff list with role/branch scope, provisioning form, membership edit/removal, last-owner
  safeguard messaging, and the one-time credential presentation (copy affordance, explicit
  "not shown again" notice); FR-06 branch detail with its sessions entry point and scoped affordances;
  FR-07 out-of-scope branch id renders the denial state, never a name; FR-08 every write shows busy state
  and surfaces refusals verbatim; FR-09 list surfaces expose empty states with the next action.
- **UX Requirements** — Progressive disclosure: heavy editors live in sections/drawers, not in one wall;
  tables and staff lists are scannable with filters/sort; membership removal states the consequence
  (access ends now, the person persists); credential display is impossible to miss and never re-shown;
  working-hours editor prevents invalid interval combinations and explains rejections; QR panel answers
  "where do I print this?"; long forms preserve input on validation failure.
- **Visual Requirements** — Management layout language (section nav, toolbars, dense tables, inline
  editors, status pills for active/inactive), branch identity headers, QR presentation card. Tokens and
  primitives only; no raw values.
- **Responsive Requirements** — Desktop-first for tables/hour editors; tablet: collapsible section nav;
  mobile: read-mostly with key actions (activate/deactivate table, view QR, add staff) reachable; data
  tables fall back to card rows under the documented breakpoint.
- **Accessibility** — Table markup with `th scope`, sortable headers as buttons with `aria-sort`;
  form errors tied to fields + summary; confirmations focus the dialog and restore focus; hours editor
  keyboard-operable (no drag-only interactions); QR download has an accessible name; denial view is a
  heading-level-1 state.
- **State Matrix** — Restaurant: unset profile / set / saving / refusal; branches: none / list / loading /
  error; branch detail: in scope / out of scope (denial) / loading; hours: empty / valid / invalid /
  saved; tables: none / list / inactive rows / create busy / refusal; staff: none / list (owner vs manager
  view) / provisioning busy / credential shown / credential dismissed / last-owner refusal / removal
  confirm; QR: ready / generation error / download busy.
- **Security** — Owner-only controls remain gated in-page and re-authorized by RPC (deep links rejected,
  not hidden); the staff list never shows phone numbers (E2E asserts absence); the one-time credential is
  displayed only in the provisioning response and never persisted in client storage; out-of-scope data
  never renders (not even as a placeholder name).
- **Components** — `ManagementLayout` (section nav), `SectionCard`, `ConfirmImpactDialog`,
  `WorkingHoursEditor` (rebuilt on primitives), `TableManager`/`TableRow`, `StaffTable`, `StaffForm`,
  `CredentialReveal`, `QrPanel`, `BranchHeader`, `ScopeBadge`, `EmptyState` usage, `DataTable` usage.
- **Routes** — `/dashboard/restaurant`, `/dashboard/branches`, `/dashboard/branches/:branchId`,
  `/dashboard/staff` (paths unchanged; section navigation may use URL fragments or query state —
  documented in the spec).
- **Data Dependencies** — The management RPC set above, policy-scoped `branches`/`profiles` reads,
  `get_branch_open_sessions` hand-off.
- **Testing** — Unit: staff-provisioning client shapes (existing `management.client` tests), working-hours
  mapping (existing `workingHours` tests), QR payload builder (existing `management.qr` tests). E2E:
  all `e2e/management.surfaces.test.ts` assertions preserved (creation panel, owner nav, identifier-change
  warning cancellation, tables + QR surfaces, non-owner/super-admin denials); new: staff provisioning
  presentation with a scratch identity (self-cleaning) or reuse of the integration-suite patterns;
  axe + responsive checks on management routes. Database suites untouched and must pass.
- **Impeccable Workflow** — `$impeccable shape` per management section group (restaurant profile,
  branches/tables, staff); build; `critique` on density and scannability; `audit` for table semantics and
  target sizes; `extract` if a pattern (section nav, inline editor) repeats three times.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: section nav vs tabs vs sub-routes;
  where the one-time credential lives in the layout; whether branch detail absorbs tables or links them;
  manager-visible vs owner-only affordance treatment; QR download formats.
- **Exit Criteria** — An owner completes the day-one setup path (restaurant → branch → tables → QR → staff)
  without a dead end; manager scope enforced visually and by RPC; every existing management E2E assertion
  preserved or migrated with a recorded reason; no phone numbers in client output.
- **Validation Gates** — `npm run verify`; `npm run test:db` (management + staff suites unchanged);
  `npm run test:e2e` (`management.surfaces` + shell suites); axe/responsive specs.
- **Git Checkpoint** — Commit after convergence; `feat(026): …`.

---

### Frontend Phase 07 — Menu Management UX

**Feature dir:** `specs/027-menu-management-ux` · **Mode:** Operate · **Depends on:** Phase 06 (branch context, table patterns)

- **Purpose** — Make menu maintenance fast and safe for an owner/manager: categories, items,
  descriptions, prices, images, structured extras, ordering, and per-branch availability — including
  the realtime availability toggles a branch manager uses mid-service.
- **Scope** — `/dashboard/menu`: structure editing (categories, item move/reorder), item editor
  (name, description, price, image, extras), availability controls (restaurant-wide and per-branch),
  image upload/replace/remove flow; `/dashboard/branches/:branchId/menu`: the branch-facing read-only
  menu with its availability controls; empty/loading/error states for every list; the plan's first
  full use of the storage-backed image field UX.
- **Out of Scope** — No price-policy change, no availability-rule change (two layers: item-level and
  branch-level), no change to menu RPC validation or image path grammar
  (`restaurant/<restaurantId>/item/<itemId>/<uuid>.<ext>`), no Storage policy change, no client-side
  deletion via SQL semantics (replacement remains insert + delete through the Storage API), no catalog
  import/export (not in the contract).
- **Dependencies** — Phase 06 (management layout + data-table/editor patterns), Phase 02 primitives.
- **Existing Contracts** — `create_menu_category`, `update_menu_category`, `delete_menu_category`,
  `reorder_menu_categories`, `create_menu_item`, `update_menu_item`, `move_menu_item`,
  `reorder_menu_items`, `add_menu_item_extra`, `update_menu_item_extra`, `remove_menu_item_extra`
  (20-extras ceiling), `set_menu_item_image` (previous-path return), `set_menu_item_availability`,
  `set_branch_item_availability`, `get_branch_menu` (branch-facing read), private `menu-images` bucket
  rules (5 MiB, JPEG/PNG/WebP), `branch_unavailable_items` realtime table.
- **User Stories** — As an owner I build a menu quickly and fix a typo without breaking history; as a
  branch manager I stop an item for my branch during service in two taps and the customer menu reflects
  it immediately; as any staff member with branch access I can read the branch's customer-visible menu
  exactly as guests see it.
- **Functional Requirements** — FR-01 category list with create/rename/reorder/delete (with consequence
  messaging when items exist); FR-02 item list per category with search/filter, price display, availability
  state, image thumbnail; FR-03 item editor with validation feedback, extras management (add/edit/remove,
  ceiling enforced), and image upload with progress/preview/replace; FR-04 restaurant-wide availability
  toggle with a clear statement of blast radius; FR-05 per-branch availability toggle (manager-scoped)
  with the same clarity; FR-06 branch menu preview surface that mirrors the customer payload; FR-07
  reorder interactions (keyboard-accessible move up/down or drag with keyboard equivalent); FR-08 all
  refusals verbatim; FR-09 realtime availability reflected without manual refresh on the branch menu view.
- **UX Requirements** — Menu editing is a flow, not 20 forms: inline create, side-panel edit, no page
  reloads, unsaved-change protection; destructive deletes explain what disappears; price entry is a single
  unambiguous field with formatting feedback; image upload shows limits before the attempt; availability
  toggles show effective state per branch; long menus stay navigable (sticky category nav).
- **Visual Requirements** — Dense management list language (rows, thumbnails, price column, status pill),
  editor panel visual rhythm, extras editor, availability switch with state color, image placeholder
  language for missing images — shared with the customer surfaces (same tokens, different density).
- **Responsive Requirements** — Desktop: list + editor side by side; tablet: list with editor drawer;
  mobile: read + availability toggles + simple edits (name/price) with deferred heavy editing (image
  upload) — documented capability boundary, not a broken layout.
- **Accessibility** — Reorder without drag-only; toggles as labelled switches with state text; upload
  control keyboard-operable with a file-input label fallback; image `alt` guidance; error messages tied to
  fields; table semantics for the item list.
- **State Matrix** — Categories: empty / list / busy / refusal; items: empty category / list / filtered-empty
  / item missing image / item unavailable (both layers) / price invalid; extras: none / some / ceiling
  reached / removal confirm; image: none / uploading / uploaded / replace busy / rejection (type/size) /
  provider error; branch view: in-scope / denial state / realtime update arriving.
- **Security** — Owner-only writes gated in-page and re-authorized; manager writes limited to their branch
  availability; the storage client uses only the publishable key and the owner's session; object paths are
  never constructed outside `menuImages.ts`; the branch menu read is the only customer-visible projection
  and it is not cached in shared contexts.
- **Components** — `MenuStructureTree` (rebuilt on primitives), `CategoryRow`, `MenuItemRow`,
  `ItemEditorPanel`, `ExtrasEditor` (rebuilt), `ItemImageField` (rebuilt on `Field`+upload primitive),
  `AvailabilitySwitch`, `BranchAvailabilityPanel`, `ImagePlaceholder`, `ConfirmDeleteDialog`,
  `ReorderControls`.
- **Routes** — `/dashboard/menu`, `/dashboard/branches/:branchId/menu` (unchanged paths).
- **Data Dependencies** — The menu RPC set, `get_branch_menu`, Storage upload/signed-read through existing
  helpers, `branch_unavailable_items` realtime invalidation (existing binding pattern).
- **Testing** — Unit: menu client error mapping (existing `menu.client`), image orchestration ordering
  (existing `menu.images` integration), visibility/rules mapping, formatter reuse. E2E: all
  `e2e/menu.surfaces.test.ts` assertions preserved (owner structure editor, per-item editor with price/
  availability/extras/image fields, branch-facing read-only view, non-owner denials — read-and-reject
  posture retained: no menu data created by the suite unless a self-cleaning scratch item is introduced and
  justified); new: availability toggle realtime effect on the branch menu view; axe + responsive checks.
- **Impeccable Workflow** — `$impeccable shape` on the menu editor and the branch menu view; build;
  `critique` on editor flow; `audit` for form semantics, upload accessibility, responsive behavior;
  `polish` last. `extract` if the row/panel pattern appears in Phases 06 and 07 — promote once.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: reorder interaction model (drag vs
  explicit move controls); whether item deletion exists in this phase (contract permits — confirm UX);
  mobile editing boundary; image guidance policy (dimensions/aspect). Checklist focus: availability layers
  correctness + storage safety.
- **Exit Criteria** — An owner builds and edits a category/item with extras and an image end-to-end;
  a manager toggles branch availability and the customer-visible branch menu changes without refresh;
  every existing menu E2E assertion preserved or migrated with a recorded reason; unit/db suites green.
- **Validation Gates** — `npm run verify` (includes `test:db` and `test:integration`);
  `npm run test:e2e` (`menu.surfaces` + realtime availability spec); axe/responsive specs.
- **Git Checkpoint** — Commit after convergence; `feat(027): …`.

---

### Frontend Phase 08 — Tax Configuration UX

**Feature dir:** `specs/028-tax-configuration-ux` · **Mode:** Operate · **Depends on:** Phase 07 (editor patterns, branch context)

- **Purpose** — Make a genuinely complex configuration understandable: tax rules with scopes
  (subtotal, item, category), compound relationships, ordering, branch overrides, and a preview that
  shows the resulting money — without the UI ever doing arithmetic that disagrees with the engine.
- **Scope** — `/dashboard/tax`: rules list, rule editor (name, rate, scope/target, active/retired),
  ordering, compound links, deletion of unused rules; `/dashboard/branches/:branchId/tax`: effective
  configuration (branch overrides layered over restaurant rules), override editor, and the calculation
  preview with sample baskets; explainability of precedence and of retired rules' exclusion.
- **Out of Scope** — No change to tax math: rates, rounding (half-up at the line boundary), compound
  ordering, snapshot rules, or `calculate_branch_taxes` behavior; no client-side tax calculation presented
  as authoritative (the preview renders the RPC's output); no new tax scopes; no invoice/printing artifacts.
- **Dependencies** — Phase 07, Phase 03 (branch context), Phase 02 (form primitives).
- **Existing Contracts** — `create_tax_rule`, `update_tax_rule`, `retire_tax_rule`,
  `delete_unused_tax_rule`, `reorder_tax_rules`, `set_branch_tax_override`, `get_branch_tax_config`,
  `calculate_branch_taxes` (deterministic, same basket → byte-identical totals), `record_tax_snapshot`,
  existing payload validators (`parseTaxConfig`/`parseCalculation`, `TaxPayloadError`), money formatters.
- **User Stories** — As an owner I configure a realistic tax setup (VAT plus a compound levy) and see
  exactly how it applies to a sample item; as a branch manager I add or remove my branch's override and
  immediately understand what changes; as an auditor I can see which rules were retired and why the
  preview differs from a competitor's arithmetic.
- **Functional Requirements** — FR-01 rules list with scope, target, rate, ordering, active/retired state;
  FR-02 rule editor with validation feedback and the exact validation messages from the RPC; FR-03 compound
  configuration that explains "calculated after" semantics in plain language; FR-04 ordering control with
  a clear statement of what order changes; FR-05 branch override surface distinguishing inherited vs
  overridden values; FR-06 preview panel: basket builder (item/quantity selection) → server calculation →
  rendered lines with subtotal, each tax, and total; FR-07 retirement vs deletion distinction; FR-08
  snapshot action presented with its meaning; FR-09 empty/loading/error states for both pages; FR-10
  malformed payload handling surfaced as an error state, never a crash.
- **UX Requirements** — Precedence is visible at a glance (inherited / overridden badges); the preview
  updates only after a server response and shows a busy state instead of guessing; currency formatting
  consistent with the rest of the product; destructive rule actions explain blast radius (existing
  sessions keep captured money — say so); long rule lists stay scannable; terminology matches the spec
  (rule, scope, compound, override, retire).
- **Visual Requirements** — Form-heavy layout with grouped fields, explanatory helper text, override
  badges, preview panel that reads like a bill (same `TotalsPanel` shell as customer/cashier views),
  status pills for active/retired. Tokens and primitives only.
- **Responsive Requirements** — Desktop: rules list + editor + preview simultaneously; tablet: two columns;
  mobile: read rules and preview, edit simple fields; explicit statement in the spec of what is
  deliberately not editable on mobile.
- **Accessibility** — Numeric inputs labelled with units and bounds; grouped fieldsets for scope/target;
  helper text tied via `aria-describedby`; error summary; preview results announced in a live region on
  refresh; keyboard-accessible ordering; no color-only meaning for inherited/overridden.
- **State Matrix** — Rules: none / list / retired-only / create busy / validation refusal / delete blocked
  (in use) / delete confirm; compounds: none / configured / invalid source refusal; overrides: none /
  inherited / overridden / clearing; preview: idle / calculating / result / empty basket / provider error /
  payload error; snapshot: idle / recording / recorded.
- **Security** — Owner-only rule writes and manager-scoped overrides enforced by RPC and presented only to
  permitted roles; deep links render the denial state; no tax internals beyond what the RPC returns are
  exposed in the payload.
- **Components** — `TaxRulesTable`, `TaxRuleEditor`, `ScopeSelector`, `CompoundEditor`, `OrderControls`,
  `OverridePanel` (branch), `InheritanceBadge`, `TaxPreviewPanel` (basket + result), `RetireDialog`,
  `MoneyText`/`TotalsPanel` reuse.
- **Routes** — `/dashboard/tax`, `/dashboard/branches/:branchId/tax` (unchanged paths).
- **Data Dependencies** — The tax RPC set and both existing client parsers; no new reads.
- **Testing** — Unit: existing `tax.client` mapping + parser tests extended for new UI-facing shapes;
  formatter reuse. E2E: all `e2e/tax.surfaces.test.ts` assertions preserved (owner editor, branch override
  page, manager scoped controls, cashier read-only view, non-owner denials, totals preview rendering the
  deterministic calculation); new: compound explanation, override badges, preview busy state; axe +
  responsive checks. Database suites untouched.
- **Impeccable Workflow** — `$impeccable shape` on the rule editor (the hardest form in the product);
  build; `critique` for cognitive load; `clarify` for the tax vocabulary and helper copy (high value here);
  `audit` for form accessibility; `polish`.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: terminology set shown to users; basket
  presets for the preview; whether retired rules remain visible by default; whether snapshots are surfaced
  here at all (contract exists — confirm the surface belongs to this phase). Checklist focus: no client
  arithmetic + precedence honesty.
- **Exit Criteria** — An owner configures a realistic multi-rule tax setup and the preview matches the
  engine; a manager overrides their branch and can see the difference; all existing tax E2E assertions
  preserved or migrated; no arithmetic in the UI.
- **Validation Gates** — `npm run verify` (tax db + integration suites included); `npm run test:e2e`
  (`tax.surfaces`); axe/responsive specs.
- **Git Checkpoint** — Commit after convergence; `feat(028): …`.

---

### Frontend Phase 09 — Cashier Operations UX (Rounds, Sessions, Bill, Void)

**Feature dir:** `specs/029-cashier-operations-ux` · **Mode:** Operate (dense, realtime) · **Depends on:** Phase 03 (shell, toasts, offline), Phase 02 primitives

- **Purpose** — The operational console a cashier uses for a whole shift: live round queues, reliable
  transitions, order modifications, voids with reasons, session oversight and closure, and a readable
  bill — with realtime updates that never lie about state.
- **Scope** — `/dashboard/rounds` (queue grouped by state, per-round actions, line modification, void,
  bill panel, session linkage); `/dashboard/sessions` + branch session panel (open sessions, participants,
  close with confirmation); operational alerts and the new-round cue presentation; the bill/aggregated
  view (subtotal, items, extras, tax lines, grand total, voided section, participants, delivery address
  echo); realtime-driven refresh behavior and freshness affordances.
- **Out of Scope** — **No payment capture, no bill splitting, no printing, no accounting** (not in the
  product contract — §3.8 C4). No change to transition legality, the void's overlay semantics, the bill's
  non-voided summing rule, RPC authorization, or audit writing. No manual "add round" surface beyond what
  the contract supports (record the boundary if raised).
- **Dependencies** — Phase 03; benefits from Phase 05 (shared money/state components) but must not block on it.
- **Existing Contracts** — `get_branch_rounds`, `get_kitchen_queue` (money-free), `accept_round`,
  `start_preparation`, `mark_round_ready`, `lock_round`, `mark_out_for_delivery`, `mark_completed`,
  `modify_round_line` (captured-price re-derivation), `void_round` (reason required ≤ 500; channel
  boundaries: `lock` dine-in, `out_for_delivery`+ delivery, `ready` takeaway; one generic refusal for
  unknown/already-void/below-boundary), `get_session_bill` (non-voided grand total), `get_branch_open_sessions`,
  `close_session`, `get_session_rounds` (staff-side reads only where applicable), realtime tables `rounds`
  and `kitchen_tickets`, the 200 ms coalescing + `SUBSCRIBED` recovery refetch pattern, `useNewRoundCue`,
  actor attribution in audit (owner/manager acting operationally is traceable).
- **User Stories** — As a cashier I see new rounds appear without refreshing, accept them, modify a line
  when a guest changes their mind, void a round with a reason when it must come off the bill, and close a
  session knowing the bill is settled in the external POS; as an owner/manager acting operationally I
  perform the same actions and they are attributed to me; as a second cashier I never see a stale queue.
- **Functional Requirements** — FR-01 queue grouped by state (`new`, in progress, ready, out for delivery,
  delivered, served) with counts and per-group empty states; FR-02 per-round actions exactly as the state
  machine allows, with busy/disabled states and no double-submit path; FR-03 line modification (remove /
  reduce) with consequence messaging and verbatim refusals; FR-04 void flow with mandatory reason,
  boundary-aware availability, and the voided state visibly distinct from `lock`; FR-05 bill panel tied to
  a session with participants, line detail, tax lines, voided section, and grand total as returned by RPC;
  FR-06 session oversight list with participants, scoping, and confirmed closure; FR-07 realtime freshness:
  a visible "last updated"/pulse affordance, coalesced refetch, and recovery after reconnect; FR-08 the
  new-round cue rendered as an announcement with a clear path to the new round (and no fabricated data);
  FR-09 refusal routing: a mutation failure lands on the originating card, verbatim; FR-10 pressure
  resilience: long queues stay performant (virtualization or pagination only if measured necessary).
- **UX Requirements** — The queue answers "what needs me now?" first; actions are one deliberate tap with
  no accidental state changes; destructive/irreversible actions require confirmation; a round that moved
  states elsewhere visibly leaves its old group (realtime proof); keyboard shortcuts may be added only if
  discoverable and non-conflicting; a busy queue never blocks on one card's pending action; money never
  appears on kitchen-blind surfaces.
- **Visual Requirements** — Card/board language with strong state vocabulary (color + label + icon, never
  color alone), density suited to a tablet at arm's length, monospace-ish alignment for money columns,
  distinct voided styling, bill panel that reads like a printed check (external POS owns payment).
- **Responsive Requirements** — Primary target: tablet landscape (cashier station) and desktop; mobile is
  read/alert-capable with key transitions, explicitly documented as secondary for this surface; columns
  collapse to stacked groups on narrow widths.
- **Accessibility** — Every action a real button with an accessible name (E2E names preserved:
  `Accept round`, `Start preparation`, `Mark ready`, `Send out for delivery`, `Mark completed`, plus modify/
  void controls); groups as labelled regions/lists; realtime announcements via polite live regions (not
  assertive spam); `data-round-state`/`data-round-id` hooks preserved; focus is never stolen by a refetch;
  confirmations trap and restore focus.
- **State Matrix** — Queue: loading / empty (per group and overall) / populated / stale-while-refetching /
  realtime update arriving / reconnecting / error with retry; round: each state + voided + busy transition +
  refusal; modification: idle / busy / protected (price re-derivation) / refused; void: available /
  below-boundary (unavailable with reason) / reason empty / busy / refused / succeeded; bill: loading /
  empty / populated / voided section / session closed mid-view; sessions: loading / none open / list /
  closing / close refused / closed; cue: idle / arrived / dismissed / superseded.
- **Security** — Every action re-authorized server-side; the UI never offers an action the RPC would refuse
  _silently_ — refusals are shown verbatim; branch scoping visible and enforced; no cross-branch data in
  any cache shared across sessions; the bill shows only the selected session's data; kitchen-blind surfaces
  never receive money fields.
- **Components** — `RoundsBoard`, `RoundCard` (rebuilt), `StateChip`, `TransitionActions`, `ModifyLineDialog`,
  `VoidRoundDialog` (reason + boundary state), `BillPanel` (rebuilt), `SessionPanel`/`SessionRow`,
  `CloseSessionDialog`, `LiveBadge`/`FreshnessIndicator`, `NewRoundCue`, `RefusalText`.
- **Routes** — `/dashboard/rounds`, `/dashboard/sessions` (unchanged paths; deep links with `?branch=`
  preserved where already asserted).
- **Data Dependencies** — The staff-ops RPC set and realtime bindings above; no new reads.
- **Testing** — Unit: staff-ops client payload discipline (existing `staffops.client` tests — money-free
  queue parser must keep rejecting money keys), refusal routing logic, state grouping mapping. E2E: all
  `e2e/kitchen.cashier.test.ts`, `e2e/bill.void.audit.test.ts`, `e2e/session.surfaces.test.ts` (oversight +
  close), and `e2e/realtime.test.ts` assertions preserved (real customer round → accept → modify → start/
  ready → lock → bill; void with reason → voided section + reduced grand total; second-browser realtime
  updates; cue after `SUBSCRIBED`); new: tablet-viewport operations pass, keyboard-only transition path,
  reconnecting banner behavior. Sign-in budget respected (§12.5).
- **Impeccable Workflow** — `$impeccable shape` on the rounds board and bill; build; `critique` for
  operational density and error recovery; `audit` (target sizes, live regions, contrast on state color);
  `harden` for stale/offline/refusal states; `polish`.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: whether the bill opens inline or in a
  drawer/route; freshness affordance form; cue persistence rules; whether a re-open/undo exists (contract:
  no — void is not reversible; confirm messaging); whether keyboard shortcuts ship.
  Checklist focus: state-machine fidelity + realtime honesty (no optimistic state).
- **Exit Criteria** — The full cashier journey works on a tablet viewport against real submissions with
  realtime updates and no optimistic state anywhere; void, modify, and close behave exactly as the
  contract; existing E2E assertions preserved or migrated with a record; money-free surfaces stay money-free.
- **Validation Gates** — `npm run verify`; `npm run test:e2e` (cashier/kitchen/bill-void/realtime/session
  suites); axe + tablet responsive specs.
- **Git Checkpoint** — Commit after convergence; `feat(029): …`.

---

### Frontend Phase 10 — Kitchen Display UX (KDS)

**Feature dir:** `specs/030-kitchen-display-ux` · **Mode:** Operate (glanceable, hands-busy) · **Depends on:** Phase 09 (sequential by default — both edit `features/staffOps/**`), Phase 03, Phase 02 primitives

- **Purpose** — A kitchen display readable from two metres away, on a screen nobody touches with clean
  hands, that shows incoming tickets, drives exactly two actions (`start preparation`, `mark ready`), and
  survives a dropped connection or a reload mid-service.
- **Scope** — `/dashboard/kitchen`: columns for `new` / `preparing` / `ready` with counts, ticket cards
  (ticket id, items with quantities and extras as contractually allowed, age/elapsed time, channel-blind
  presentation), large-format controls, live updates, reconnect/offline behavior, empty and error states,
  and the branch selector where multiple branches are readable.
- **Out of Scope** — No money anywhere (kitchen-blinded by contract — `data-testid="kitchen-*"` and the
  money-free queue parser must keep rejecting money keys); no accept action (the cashier accepts first —
  the contract's clarification); no item-level state machine (ticket/round transitions only); no menu
  availability control (kitchen does not manage stock); no printing, no sound unless the clarify answer
  below says otherwise.
- **Dependencies** — Phase 03 (shell + offline banner). **Sequential after Phase 09 by default** (both
  phases modify `features/staffOps/**` and `e2e/kitchen.cashier.test.ts` — §11 wave E); Phase 10
  consumes the board/state patterns Phase 09 establishes (the `TicketCard`/board extraction is
  deliberate, informed by what 09 shipped). Parallel execution only with an explicit owner
  partition of files/components and an accepted reconciliation cost.
- **Existing Contracts** — `get_kitchen_queue` (money-free, channel-blind: no address, no money, no new
  states), `start_preparation`, `mark_round_ready`, ticket states `new → accepted → preparing → ready`, the
  one-ticket-per-round rule, realtime tables `kitchen_tickets` + `rounds`, role reach (kitchen/cashier/
  manager/owner), `data-kitchen-column`, `data-ticket-id`, `data-ticket-state` hooks.
- **User Stories** — As a cook I see what to start next without asking anyone; as a cook I mark a ticket
  ready in one tap and it leaves my column; as kitchen staff on a flaky tablet I keep seeing the truth and
  know when I am offline; as a manager passing by I can read the board from across the kitchen.
- **Functional Requirements** — FR-01 three columns with counts and per-column empty states; FR-02 ticket
  cards with item lines, quantities, extras (presentation only), and channel-neutral wording; FR-03 elapsed
  time since submission with a staleness treatment (not a clock the UI fabricates precision about); FR-04
  exactly the contract's actions with busy/disabled protection; FR-05 live updates via existing realtime
  invalidation, with a visible connection state; FR-06 reload recovery (state read from server, not from
  client memory); FR-07 branch selector for multi-branch identities; FR-08 refusal text on the originating
  card, verbatim; FR-09 no money and no delivery address rendered under any condition.
- **UX Requirements** — Readability over density: type is large, contrast is high, tap targets are generous,
  and cards survive being seen at an angle; a ticket that changed state elsewhere moves columns visibly;
  offline state is obvious and non-blocking (the last-known board stays readable); no modal interrupts
  service; sound/badge is a clarify decision, never an assumption.
- **Visual Requirements** — Kitchen-specific density and scale within the same token system (larger radii,
  heavier borders, stronger state colors), three-column board language, age indicators that escalate
  without alarm fatigue, and a distinct offline treatment.
- **Responsive Requirements** — Primary target: landscape tablet / wall screen (≥ 1024 px, touch); vertical
  stacking for portrait tablets; phone is explicitly out of scope for KDS as a working surface (documented
  boundary, with a readable fallback).
- **Accessibility** — Buttons with the exact accessible names E2E asserts (`Start preparation`, `Mark ready`)
  and large targets; live regions for ticket arrivals (polite, coalesced — never a stream of assertions);
  column headings as real headings for screen-reader navigation; color never the only state signal (label +
  icon); reduced-motion honored for any pulse/animation.
- **State Matrix** — Board: loading (skeleton columns) / empty kitchen / populated / realtime arrival /
  reconnecting / offline (last known) / error with retry; ticket: new (awaiting cashier) / accepted /
  preparing / ready / voided (ticket mirror) / busy action / refusal; branch: single / multiple / denied;
  connection: connected / reconnecting / recovered.
- **Security** — Kitchen role sees only its branch queue; owner/manager see their scoped branches; no money,
  no phone numbers, no addresses rendered; all actions re-authorized by RPC; the UI must render the refusal
  rather than pretending success.
- **Components** — `KitchenBoard`, `KitchenColumn`, `TicketCard` (rebuilt for KDS scale),
  `TicketItemList`, `TicketAge`, `ConnectionStatus`, `KitchenEmptyState`, `BranchScopedHeader`.
- **Routes** — `/dashboard/kitchen` (unchanged path).
- **Data Dependencies** — `get_kitchen_queue`, `start_preparation`, `mark_round_ready`, realtime bindings
  for `kitchen_tickets` and `rounds`.
- **Testing** — Unit: existing `staffops.client` money-free assertions preserved; display mapping for ages/
  states. E2E: all `e2e/kitchen.cashier.test.ts` kitchen assertions preserved (dan's queue at Marina, no
  cashier route access, no money text, live updates in `e2e/realtime.test.ts`); new: offline/reconnect
  behavior (simulated by context offline), reload recovery mid-service, landscape table viewport pass,
  axe checks. Kitchen-blind assertions (no money, no address) re-asserted explicitly.
- **Impeccable Workflow** — `$impeccable shape` on the KDS (legibility, glanceability, touch)
  then build; `critique` from the "cook at two metres" standpoint; `audit` (contrast, target size, motion);
  `harden` for offline/stale; `polish`.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: whether sound/badge alerting is required
  (no outbound-alert contract exists — the answer may be "visual only"); age thresholds and escalation
  treatment; whether the cashier's `new` column is visible or hidden to kitchen; wall-screen target
  resolution. Checklist focus: money-blindness + offline honesty.
- **Exit Criteria** — A kitchen member works a service on a landscape tablet: sees new tickets live, starts
  and completes them, survives a reload and a disconnect, and never sees money or addresses; existing
  kitchen E2E assertions preserved or migrated with a record.
- **Validation Gates** — `npm run verify`; `npm run test:e2e` (`kitchen.cashier`, `realtime`); axe +
  landscape-tablet responsive specs.
- **Git Checkpoint** — Commit after convergence; `feat(030): …`.

---

### Frontend Phase 11 — Delivery & Takeaway Channel UX

**Feature dir:** `specs/031-channel-operations-ux` · **Mode:** Operate · **Depends on:** Phase 05 (customer), Phase 09 (cashier), Phase 10 (kitchen)

- **Purpose** — Channel-aware behavior across the three experiences: delivery and takeaway already exist
  in the contract (address capture, dispatch/completion transitions, state-driven cutoffs, channel-blind
  kitchen) but the UI presents them as an afterthought. This phase makes channel state legible everywhere
  it matters.
- **Scope** — Customer: delivery address echo, channel identity, cutoff state messaging, order status for
  dispatched/delivered flows. Cashier: dispatch (`Send out for delivery`) and `Mark completed` actions with
  their delivery-only/kitchen-denied posture made visible; channel filters on the rounds board; address
  rendered only where the contract allows. Kitchen: confirmation that channel changes nothing (boarding
  stays channel-blind) with channel neutral wording. Cross-surface: one channel vocabulary (dine-in /
  delivery / takeaway) and one cutoff explanation.
- **Out of Scope** — No rider/driver management, no delivery ETA promises (no contract), no driver
  assignment, no address editing after entry (address is set once at entry — no write path), no per-channel
  pricing or fees, no new states.
- **Dependencies** — Phases 05, 09, 10 (this phase refines them; it must not re-implement their surfaces).
- **Existing Contracts** — `open_session_channel` (one customer per channel session; dine-in redirect),
  `sessions.type` widened checks, session delivery-address rules (null for non-delivery, ≤ 200 chars),
  `submit_round` cutoffs (delivery: any round `out_for_delivery`/`completed`; takeaway: any round
  `ready`/`lock`; dine-in never), `mark_out_for_delivery` and `mark_completed` (delivery-only, kitchen
  denied, audited), staff reads carrying `session_type` (+ address on the bill), kitchen queue remaining
  channel-blind, `channel.entry` client mapping and its refusal-preservation rules (unavailable-session
  refusal clears token + cart; cutoff refusal preserves both).
- **User Stories** — As a delivery customer I can add items until my order is on its way, and I understand
  the cutoff before I hit it; as a cashier I handle dispatch and completion distinctly from dine-in
  service; as a cook I am never asked to read an address; as a takeaway customer I know when adding is closed.
- **Functional Requirements** — FR-01 channel identity on every relevant surface (session bar, round cards,
  bill, session list); FR-02 cutoff state surfaced to the customer _before_ the attempt (disabled add
  affordance + explanation), with the server refusal still possible and verbatim; FR-03 dispatch and
  completion actions on the cashier board, only in their legal states, with confirmation for completion;
  FR-04 address presentation limited to contract-permitted surfaces (customer's own echo, bill); FR-05
  channel filtering/grouping on the staff board (only if it earns its complexity — a clarify question);
  FR-06 consistent refusal copy for channel-specific refusals (e.g. "already on its way") preserved
  verbatim; FR-07 status progression visible to the customer for dispatched/delivered rounds.
- **UX Requirements** — Channel is never a surprise: the customer chose it at entry and the UI keeps
  saying it; the cutoff is explained proactively with the reason; staff actions are labelled with their
  consequence; nothing on the kitchen surface mentions delivery logistics beyond channel identity if the
  contract allows none.
- **Visual Requirements** — One channel chip component reused everywhere; cutoff notice treatment; status
  timeline treatment for dispatched/delivered; delivery address typography (readable, not decorative).
- **Responsive Requirements** — Customer surfaces verified at 390 px (address echo must not overflow);
  cashier board tablet-first with channel chips surviving narrow widths; kitchen unchanged (channel-blind).
- **Accessibility** — Channel radio group semantics preserved from Phase 04; disabled add affordance is
  programmatically disabled (`disabled`, not just styled) with an explanation tied via
  `aria-describedby`; status announcements for cutoff crossing; no color-only channel coding.
- **State Matrix** — Customer: ordering / cutoff reached (dine-in never) / dispatched / completed / session
  closed mid-flight; cashier: delivery round in each state / dispatch busy / completion confirm / refusal;
  kitchen: unchanged, with a positive assertion that no channel logistics leak; address: present (delivery) /
  absent (takeaway, dine-in).
- **Security** — Address is customer-owned data shown only where the contract permits; no address in
  kitchen payloads; no new read paths; refusals verbatim; the unavailable-session refusal's token-clearing
  behavior stays exactly as specified (cutoff refusals preserve token + cart).
- **Components** — `ChannelChip`, `CutoffNotice`, `ChannelFilter` (if clarified in), `DispatchActions`,
  `StatusTimeline` (customer), `AddressEcho` (customer/bill variants), `CompletionConfirmDialog`.
- **Routes** — No new routes; refinements land inside `/r/:slug/menu`, `/dashboard/rounds`,
  `/dashboard/kitchen`, `/dashboard/sessions`.
- **Data Dependencies** — Existing channel RPCs and reads only.
- **Testing** — Unit: existing `channel.entry` tests preserved (refusal mapping, token/cart preservation).
  E2E: existing delivery/takeaway entry assertions and the delivery-cutoff journey in
  `e2e/session.surfaces.test.ts` preserved end-to-end (including the four staff transitions that trigger
  the cutoff); new: proactive cutoff affordance at 390 px, channel chip consistency, completion
  confirmation, and an explicit kitchen-blind assertion. Database suites untouched and green.
- **Impeccable Workflow** — `$impeccable shape` on the cutoff/dispatch moments (small but
  high-stakes); build; `critique` on the customer's understanding of the cutoff; `audit` for disabled-state
  semantics; `polish`.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: whether the cutoff disables the cart
  entirely or only submission (contract: submission refuses; UI may pre-empt — decide the presentation);
  channel filtering on the board; completion confirmation wording; whether takeaway pickup readiness gets a
  customer-facing highlight (contract provides `ready`). Checklist focus: refusal-preservation fidelity.
- **Exit Criteria** — All three channels are legible and correct on every affected surface; the cutoff is
  explained before it bites; kitchen remains channel-logistics-free; existing channel E2E assertions pass.
- **Validation Gates** — `npm run verify` (channel db suite included); `npm run test:e2e`
  (`session.surfaces` channel block, `kitchen.cashier`, `realtime`); axe/responsive specs.
- **Git Checkpoint** — Commit after convergence; `feat(031): …`.

---

### Frontend Phase 12 — Realtime, Notifications & Subscription Awareness UX

**Feature dir:** `specs/032-realtime-and-notifications-ux` · **Mode:** Operate · **Depends on:** Phases 03, 05, 09, 10

- **Purpose** — One coherent story for "the product tells me things": what arrives live, how it is
  announced, how a reconnect heals it, and how subscription state is communicated to owners without ever
  implying that expiry stops ordering.
- **Scope** — Global realtime connection/status UX (connected, reconnecting, recovered) shared by every
  live surface; the new-round cue's presentation and its interaction with toasts (without duplicating
  payload data); freshness/last-updated affordances on live lists; subscription awareness surfaces
  (`SubscriptionBanner` states + owner-facing detail) using the derived state vocabulary
  (`never_activated`, `active`, `nearing_expiration`, `expired`) and the separate manual disable flag;
  announcement policy (what is polite-live, what is a toast, what is silent); and an honest statement that
  no outbound notification channel exists.
- **Scope rule:** **Phase 11 is a presentation and workflow refinement phase over existing channel
  contracts. It must not introduce new channel behavior that requires backend changes.** Any idea
  that would need a new RPC, a signature change, new states, or new validation is recorded as a
  contract conflict (§3.8), not implemented.
- **Out of Scope** — No notification store/center (no table or RPC exists — do not invent one; any
  "activity" surface must read existing RPCs and is a clarify decision); no email/SMS/WhatsApp/push; no
  browser Notification API permission prompts; no change to realtime authorization, publication, filters,
  coalescing, or the customer's 10 s poll; no change to subscription state derivation; no automatic
  disabling of anything on expiry.
- **Dependencies** — Phases 03 (toast host, offline banner), 09/10 (live boards), 05 (customer status).
- **Existing Contracts** — Realtime publication of five tables with policy-filtered delivery; the
  invalidation-only principle (payloads never rendered); 200 ms coalescing; `SUBSCRIBED` recovery refetch;
  `useNewRoundCue` (event-derived, no recovery read); `get_my_subscription` (§3.5 state vocabulary);
  `platform_disabled` as a separate flag; audit trail (`get_audit_log`) and branch reads as the only
  existing "activity" sources.
- **User Stories** — As a cashier I am told a new order arrived and can jump to it, and I trust the board
  after my tablet reconnects; as an owner I see my subscription nearing expiry without panic and understand
  it does not stop orders; as a manager I can tell whether what I am looking at is live or stale.
- **Functional Requirements** — FR-01 one connection-status model surfaced consistently (badge/banner)
  across live surfaces; FR-02 new-round cue presentation with an accessible announcement and a clear
  affordance to the new round, never rendering event payload fields; FR-03 freshness indicator with
  last-updated semantics on live lists (staff) and the poll cadence communicated honestly to customers;
  FR-04 reconnect behavior: visible reconnecting state → automatic recovery refetch → confirmation that
  data is current; FR-05 subscription banner states with owner-facing explanation, including the explicit
  "ordering is not affected by expiry" clarification; FR-06 platform-disabled state surfaced only where the
  contract exposes it (super admin console, and owner-facing if a read permits — confirm in clarify);
  FR-07 announcement policy implemented in one place (toast vs live region vs silent invalidate) with no
  duplicate announcements for one event; FR-08 optional bounded activity panel reading existing RPCs
  (clarify-gated; default: not built).
- **UX Requirements** — Live updates never move focus or selection; announcements are informative but
  dismissible; the cue does not stack into a wall on a busy night (coalesce, cap, and supersede); stale
  data is never presented as live; the subscription banner is informative rather than alarming, and its
  call-to-action is honest about who can act (platform owner, not the restaurant).
- **Visual Requirements** — Connection/live badge language, cue card treatment, banner variants per
  subscription state, freshness typography. Tokens/primitives only; motion minimal and reduced-motion safe.
- **Responsive Requirements** — Cue and banner must not cover primary actions at 390 px; connection badge
  remains visible but compact on mobile; toasts are anchored and never fill the viewport.
- **Accessibility** — Live regions chosen deliberately per announcement type (polite for arrivals, none for
  silent refetch); toasts are keyboard dismissible and non-trapping; connection state exposed as text, not
  color/icon only; reduced-motion for any pulse; no auto-focus.
- **State Matrix** — Connection: connected / reconnecting / offline / recovered; cue: none / arrived /
  multiple coalesced / dismissed / superseded by state change; freshness: fresh / stale / refetch-in-flight /
  error-with-retry; subscription: never activated / active / nearing expiration / expired / manually
  disabled; announcement: toast / polite live region / silent.
- **Security** — Realtime remains policy-filtered server-side; never render event payload fields (no money,
  no PII from channels); subscription reads stay self-scoped; no new permission assumptions; no cross-tenant
  leakage through caches keyed only by branch id where a restaurant context changes.
- **Components** — `LiveStatusBadge`, `ConnectionBanner` (extends Phase 03's offline banner),
  `NewRoundCue` (shared presentation), `FreshnessLabel`, `SubscriptionBanner` (rebuilt with states),
  `SubscriptionDetailPanel`, `AnnouncementHost` policy helper.
- **Routes** — No new routes; banner/cue/status appear within existing shells. If FR-08 is approved, it
  lands inside `/dashboard` only.
- **Data Dependencies** — `get_my_subscription`; existing realtime bindings; `get_audit_log`/branch reads
  only if FR-08 is approved.
- **Testing** — Unit: cue set/clear cycle (existing `realtime.test.ts` contract), announcement policy
  mapping, subscription state label mapping. E2E: existing `e2e/realtime.test.ts` journeys preserved
  (customer submission appears on the open cashier dashboard; a round advanced in one staff browser moves
  groups in another; kitchen queue updates live and stays money-free; cue renders after `SUBSCRIBED`); new:
  reconnecting/recovered states, banner states for seeded subscription fixtures, no-payload-render assertion
  (event fields never appear in the DOM), and a ×-viewport pass. Sign-in budget respected (§12.5).
- **Impeccable Workflow** — `$impeccable shape` on announcements (a small surface with outsized impact on
  trust); build; `critique` for alarm fatigue; `audit` for live-region correctness; `polish`.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: whether any activity feed is built
  (default no); cue dismissal/persistence; whether subscription detail gets its own route or a panel;
  announcement volume policy on busy nights. Checklist focus: realtime-not-truth discipline + no invented
  notification infrastructure.
- **Exit Criteria** — Connection, cue, freshness, and subscription states are all visible, honest, and
  non-duplicative; no event payload is ever rendered; existing realtime E2E journeys pass; no notification
  store was invented.
- **Validation Gates** — `npm run verify`; `npm run test:e2e` (`realtime`, plus the platform banner
  assertions in `platform.surfaces`); axe specs; responsive checks.
- **Git Checkpoint** — Commit after convergence; `feat(032): …`.

---

### Frontend Phase 13 — Reports, Audit & Void Log UX

**Feature dir:** `specs/033-reports-and-audit-ux` · **Mode:** Read (with operational framing) · **Depends on:** Phases 03, 09

- **Purpose** — Make operational truth readable: branch performance by period, best sellers, channel mix,
  the owner's cross-branch comparison, the void ledger, and the audit trail — within the product's explicit
  non-accounting boundary.
- **Scope** — `/dashboard/reports`: period selector (day/week/month, calendar buckets), per-branch figures
  (rounds submitted, rounds voided, net money over non-voided rounds, channel breakdown including explicit
  zeros, top-10 best sellers), owner comparison view across branches; `/dashboard/voids`: the void ledger
  with who/when/why and captured totals; `/dashboard/audit`: filterable, paginated action trail with the
  actor/action/target/reason shape; empty states (e.g. no voids in period) and honest "no data yet" states.
- **Out of Scope** — No new report RPCs or client aggregation of money (figures come from the RPCs; a UI
  sum that disagrees with the server is a defect); no exports (CSV/PDF — not in the contract, C5); no
  materialized views or caching layers; no financial/accounting framing (the product is not a POS); no
  cashier/kitchen access to these surfaces (contract: refused, and the denial must render).
- **Dependencies** — Phase 03 (shell, table primitives), Phase 09 (void flow whose ledger this shows).
- **Existing Contracts** — `get_branch_sales_report(restaurant, branch, period, anchor_date)` (Monday-start
  weeks, three-channel breakdown with explicit zeros, top-10 by captured quantity),
  `get_branch_void_report(restaurant, branch, limit)`, `get_audit_log` (owner restaurant-wide incl.
  `branch_id is null`; manager over managed branches; filters + clamp + ordering), reach = `private.has_branch_role`
  verbatim, `data-testid` hooks (`report-aggregates`, `report-best-sellers`, `report-channels`,
  `report-comparison`, `audit-table`, `void-log-table`, `void-log-empty`) and `data-audit-action`.
- **User Stories** — As an owner I see how branches compare this week and where the money actually came
  from; as a manager I read my branch without seeing siblings; as an owner I trace who voided what and why;
  as an owner I see an honest empty state when nothing has happened yet.
- **Functional Requirements** — FR-01 period + anchor-date controls with an unambiguous timezone story
  (restaurant timezone from settings — confirm in clarify); FR-02 per-branch figures with units and money
  formatting consistent with the rest of the product; FR-03 channel breakdown that always renders all three
  channels (zeros included); FR-04 best-seller ranking with captured quantities; FR-05 owner comparison
  across readable branches with a clear "same period" guarantee; FR-06 void ledger with reason text,
  actor, timestamp, and captured total; FR-07 audit trail with filters (action, actor, date range), stable
  ordering, and pagination/limit handling; FR-08 print-friendly? **no** — printing is out of scope; FR-09
  denial states for cashier/kitchen deep links (rendered, not hidden); FR-10 no client-side money
  aggregation presented as a report figure.
- **UX Requirements** — Numbers are scannable and comparable (aligned columns, consistent decimals); the
  period control always states exactly what range is shown; zero and empty are distinguishable; a manager
  never wonders whether numbers include other branches; long trails stay performant and filterable; nothing
  on these pages implies tax/accounting authority.
- **Visual Requirements** — Reporting layout language using `DataTable` + `TotalsPanel`-family components;
  simple SVG/CSS visualizations (bars/sparklines) built with tokens — **no charting dependency** (FA-10);
  voided styling consistent with Phase 09; ledger typography for reasons (long text truncation with full
  value available).
- **Responsive Requirements** — Desktop-first for comparison and dense tables; tablet: stacked summaries;
  mobile: summaries + drill-down lists with horizontal-safe money columns; tables fall back to card rows.
- **Accessibility** — Data tables with proper headers and scopes; sortable/filterable controls labelled;
  charts carry text equivalents (table or summary) — never color-only meaning; period changes announced;
  pagination controls keyboard-operable; long reason text readable by screen readers in full.
- **State Matrix** — Report: loading (skeleton) / populated / all-zero period / empty branch / provider
  error / denial; comparison: single branch / multiple / partial failure of one branch's call (must show the
  failure honestly, not a zero); void log: empty (`void-log-empty`) / populated / filtered-empty / error;
  audit: loading / page / no results for filters / clamp reached / error; date: future range / invalid range.
- **Security** — Reach enforced by RPC and mirrored only as presentation; no cashier/kitchen rendering of
  report surfaces; no cross-branch figures for managers; audit reasons rendered as plain text (no
  interpretation); no export path that could leak tenant data.
- **Components** — `PeriodControl`, `ReportSummaryCards`, `ChannelBreakdown`, `BestSellersTable`,
  `BranchComparison`, `SimpleBar`/`Sparkline` (token-driven, dependency-free), `VoidLogTable`,
  `AuditTrailTable`, `FilterBar`, `EmptyState`/`ErrorState` usage.
- **Routes** — `/dashboard/reports`, `/dashboard/voids`, `/dashboard/audit` (unchanged paths).
- **Data Dependencies** — The three report/trail RPCs above; `branches` read for scope labels.
- **Testing** — Unit: existing `reports.test.ts` client mapping preserved/extended; figure formatting; range
  helpers. E2E: all `e2e/reports.surfaces.test.ts` assertions preserved (owner picker + comparison, manager
  single-branch, cashier/kitchen denials, aggregates/best-sellers/channels rendering) and the audit/void
  assertions in `e2e/bill.void.audit.test.ts`; new: empty-period state, filter behavior, card fallback at
  mobile width, axe checks. Database suites untouched.
- **Impeccable Workflow** — `$impeccable shape` on the reports page (information design); build; `critique`
  for number legibility; `audit` for table/chart accessibility; `clarify` for empty/zero copy; `polish`.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: timezone convention for periods;
  visualization depth (numbers + bars vs decorative charts); whether comparison uses one call per branch
  (yes per plan D2 — confirm UX for partial failures); audit filter set. Checklist focus: no client
  aggregation + honest empties.
- **Exit Criteria** — Every figure matches the RPC byte-for-byte; comparison and ledger are readable at
  desktop and acceptable at mobile; denials render for cashier/kitchen; all existing report/audit/void E2E
  assertions preserved or migrated with a record.
- **Validation Gates** — `npm run verify` (reports db suites included); `npm run test:e2e`
  (`reports.surfaces`, `bill.void.audit`); axe/responsive specs.
- **Git Checkpoint** — Commit after convergence; `feat(033): …`.

---

### Frontend Phase 14 — Super Admin, Tenant Onboarding & Subscription Administration UX

**Feature dir:** `specs/034-platform-console-ux` · **Mode:** Operate · **Depends on:** Phase 03 (platform shell), Phase 12 (narrowed: the subscription state vocabulary artifact — see Dependencies)

- **Purpose** — Give the platform owner a real console: onboard a restaurant with its first owner,
  administer subscription dates, see platform usage, and disable/re-enable a tenant deliberately — with
  destructive actions that are impossible to fire by accident.
- **Scope** — `/admin` as a genuine console landing (platform identity, current posture, entry to the
  console and to guidance); `/admin/platform`: tenant overview (name, derived subscription state, dates,
  usage counts, disabled flag + reason), activate/change-dates flow, disable flow with mandatory reason,
  re-enable flow, onboarding panel (restaurant + first owner provisioning with credential handling),
  filtered/sorted tenant list, empty state (platform with one tenant / none).
- **Out of Scope** — No change to `get_platform_overview` shape, `set_subscription_dates` validation,
  `set_restaurant_platform_disabled` semantics, or `onboard_restaurant` behavior; **no automatic
  disabling on expiry** (the platform owner decides — the UI must say so); no cross-tenant data browsing
  beyond the overview; no restaurant-tenant data access (the capability grants none by default); no billing
  or invoicing (not in the contract); no new admin roles.
- **Dependencies** — Phase 03 (platform shell + nav group), Phase 12 **narrowed to the subscription
  state vocabulary** (see below), Phase 06
  (shared table/credential patterns for onboarding).

**Dependency narrowing (reviewed, not assumed):** what Phase 14 actually consumes from Phase 12 is
the committed **subscription state vocabulary** — the owner-facing labels/state pills for the
derived states (`never_activated`, `active`, `nearing_expiration`, `expired`) plus the separate
`platform_disabled` flag presentation. It does **not** need Phase 12's realtime/cue work. The
dependency stays (it is real: P14 renders the same owner-facing state names P12 commits), but it
is narrowed to that vocabulary artifact. Consequently **P14 may proceed once the subscription
vocabulary is committed — potentially in parallel with the remainder of Phase 12's realtime/cue
work — or run strictly after P12**; the choosing phase must document which it did and why. No
dependency exists here for ordering convenience alone.

- **Existing Contracts** — `current_auth_context` (`is_super_admin`), `get_platform_overview`,
  `set_subscription_dates`, `set_restaurant_platform_disabled` (reason required), `onboard_restaurant`
  (composition of existing primitives; creates restaurant + first owner), derived subscription states,
  `data-testid="platform-overview"` and `data-testid="disabled-<slug>"` hooks, audit rows for every
  platform action.
- **User Stories** — As the platform owner I provision a new restaurant and hand its owner credentials;
  as the platform owner I extend a subscription and see the state change; as the platform owner I disable a
  tenant with a recorded reason and can reverse it; as the platform owner I always know that expiry alone
  did not stop anyone's orders.
- **Functional Requirements** — FR-01 console landing with the platform identity and a clear statement of
  what the capability does and does not grant; FR-02 tenant table with derived state, dates, usage counts,
  disabled flag + reason, sortable/filterable; FR-03 activate / change-dates flow with date validation
  feedback and confirmation; FR-04 disable flow requiring a reason (mandatory, bounded), with consequence
  messaging; FR-05 re-enable flow; FR-06 onboarding flow collecting restaurant + first-owner details with
  validation feedback and the one-time credential presentation; FR-07 every action's outcome surfaced
  (success toast + refreshed row); FR-08 refusal text verbatim (`42501` rendered as a clear denial, not a
  raw code); FR-09 empty/first-run states; FR-10 no tenant data beyond the overview is fetched.
- **UX Requirements** — Destructive and irreversible-feeling actions are visually distinct and confirmed;
  "disable" explains exactly what stops (hosted actions) and what does not (existing captured data); the
  state vocabulary is consistent with the owner-facing banner from Phase 12; onboarding is a short guided
  form, not a wall; usage counts are labelled with units and a definition.
- **Visual Requirements** — Admin-density table language, state pills matching the owner-facing vocabulary,
  destructive dialog treatment, credential reveal treatment shared with Phase 06, console landing with
  clear hierarchy. Tokens/primitives only.
- **Responsive Requirements** — Desktop-first console (the primary venue is a laptop); tablet: table with
  card fallback; mobile: summaries + the small set of safe actions, with heavy editing explicitly deferred.
- **Accessibility** — Table semantics and sortable headers; dialogs trap/restore focus; the mandatory reason
  field is labelled and validated inline; credential reveal has an accessible name and keyboard copyability;
  denial and disabled states announced; no color-only subscription state.
- **State Matrix** — Overview: loading / populated / only-one-tenant / error / denial (non-super-admin);
  row actions: idle / editing dates / saving / refused / saved; disable: reason empty / reason over limit /
  confirming / refused / disabled; re-enable: confirming / saved; onboarding: idle / validating / busy /
  refusal (verbatim) / success with credential / credential dismissed; disabled tenant rendering (flag +
  reason shown consistently).
- **Security** — Every console RPC re-verifies the super-admin flag (presentation mirrors it only); the
  console never reads restaurant tenant data beyond the overview payload; the one-time credential is shown
  only in the onboarding response and never stored client-side; disable reasons are required and rendered as
  text, never interpreted; no cross-tenant identifier leakage into URLs beyond what exists.
- **Components** — `PlatformConsoleLayout`, `TenantTable`, `SubscriptionStatePill`, `DatesDialog`,
  `DisableTenantDialog`, `ReenableConfirmDialog`, `OnboardingPanel` (rebuilt), `CredentialReveal` (shared),
  `UsageCounts`, `ConsoleLanding`.
- **Routes** — `/admin`, `/admin/platform` (unchanged paths).
- **Data Dependencies** — The five platform RPCs above; no new reads.
- **Testing** — Unit: existing `platform.test.ts` mapping preserved/extended; state-label and reason-bound
  helpers. E2E: all `e2e/platform.surfaces.test.ts` assertions preserved (overview table rendering, disabled
  flag display, denial for non-super-admin, banner behavior) — read-and-reject posture retained (no tenant
  creation by the suite unless a self-cleaning scratch tenant is justified and approved); new: disable
  reason validation, dates flow, onboarding form validation, table card fallback, axe checks.
- **Impeccable Workflow** — `$impeccable shape` on the console (density + destructive safety); build;
  `critique` for operator mistakes; `audit` for dialog/table accessibility; `polish`.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: whether onboarding creates credentials
  inline or hands off (it issues a one-time credential like staff provisioning — confirm presentation);
  whether the console needs saved views/filters; tenant-detail drill-down (default: none). Checklist focus:
  destructive-action safety + no invented billing scope.
- **Exit Criteria** — A super admin can onboard a tenant, adjust dates, disable and re-enable with reasons,
  all with confirmations and verbatim refusals; non-super-admin denials render; existing platform E2E
  assertions preserved or migrated with a record.
- **Validation Gates** — `npm run verify` (platform db suites included); `npm run test:e2e`
  (`platform.surfaces`); axe/responsive specs.
- **Git Checkpoint** — Commit after convergence; `feat(034): …`.

---

### Frontend Phase 15 — Accessibility Hardening

**Feature dir:** `specs/035-accessibility-hardening` · **Mode:** Operate/Read (audit) · **Depends on:** Phases 04–14 (surfaces exist)

- **Purpose** — Turn accessibility from "labels and alert roles" into a verified property of the whole
  product: keyboard-complete, screen-reader-correct, contrast-compliant, target-size-safe, motion-honest —
  for every role, including the customer with one hand and a phone on a restaurant floor.
- **Scope** — A full manual + automated audit pass across all 25 routes and both shells; fixes; documented
  keyboard maps for operational surfaces (cashier, kitchen); focus management review (drawers, dialogs,
  route changes, refetch-driven re-renders); live-region policy review; contrast verification for every
  token pair in use; touch-target audit; reduced-motion and forced-colors behavior; screen-reader passes on
  the critical journeys (customer ordering, cashier transition, kitchen ticket, session close, onboarding);
  an `extract` consolidation of any accessibility pattern that repeated across surfaces.
- **Out of Scope** — No visual redesign (fixes must respect the committed design world; if a fix requires a
  system change, it amends the design system rather than forking it); no backend/authorization changes; no
  localization; no new features.
- **Dependencies** — All surface phases complete enough to audit; Phase 01's a11y tooling.
- **Existing Contracts** — The E2E presentation surface (labels, roles, headings, live regions) as the
  regression net; the WCAG target recorded in Phase 01; `docs/conventions.md` accessibility rules.
- **User Stories** — As a keyboard-only cashier I complete a full round transition; as a screen-reader user
  I follow a ticket from arrival to ready; as a customer with low vision I read prices and states; as a
  motion-sensitive user I am not subjected to pulsing live surfaces.
- **Functional Requirements** — FR-01 automated a11y assertions for every route in its authorized state
  (owner/manager/cashier/kitchen/super-admin/customer where reachable); FR-02 keyboard-complete critical
  journeys proven in E2E; FR-03 documented keyboard maps in `docs/`; FR-04 focus-order and focus-restore
  rules for dialogs/drawers/route changes; FR-05 live-region audit with a corrected policy where
  announcements duplicate or spam; FR-06 contrast audit of all token pairs with documented results; FR-07
  touch-target audit at mobile and tablet viewports; FR-08 reduced-motion and forced-colors verification;
  FR-09 skip links and landmarks on every shell; FR-10 accessible names verified against the ledger (no
  regressions); FR-11 a recorded, reviewed exceptions list (each with reason and owner) — no silent gaps.
- **UX Requirements** — Every interactive element reachable and operable without a mouse; no action reachable
  only by hover or drag; error recovery never requires re-entering a whole form; long operations announce
  progress politely; nothing steals focus on live updates.
- **Visual Requirements** — Fixes must look intentional within the design system: focus rings as first-class
  visual elements, state changes conveyed by more than color, no "accessibility mode" that looks worse than
  the default.
- **Responsive Requirements** — Target sizes verified at mobile and tablet; keyboard operation verified with
  the mobile drawer; zoom to 200 % without loss of content or function on the critical journeys.
- **Accessibility** — This phase's entire subject. Deliverables: audit report (findings, severity, fixes),
  updated policies, and the E2E a11y suite as the standing proof.
- **State Matrix** — Per audited surface: default / focus-visible / keyboard-only / screen-reader / zoomed /
  reduced-motion / forced-colors / high-contrast; loading and error announcements.
- **Security** — Accessibility fixes must not alter authorization decisions or reveal denied data (e.g. an
  improved denial view still discloses nothing).
- **Components** — Any primitive fixes made centrally; a documented a11y test helper; possibly
  promoted patterns from `extract`.
- **Routes** — All (audited; no additions).
- **Data Dependencies** — None new.
- **Testing** — E2E: axe suite expanded to all routes/roles; new keyboard-journey specs (customer ordering,
  cashier transitions, kitchen ticket, dialog flows); focus-restore assertions. Unit: policy helpers
  (live-region mapping, focus utilities). Manual: recorded screen-reader walkthroughs in the phase's
  quickstart with expected outcomes.
- **Impeccable Workflow** — `$impeccable audit` is the phase's primary engine (accessibility, responsive,
  anti-patterns), followed by `critique` where findings are experiential; `extract` for repeated fixes;
  `polish` for the visual finish of fixes. Do not redesign — refine.
- **SpecKit Workflow** — Full pipeline, but with an intent difference to state explicitly in the spec: this
  phase **hardens**, so its FRs are audit-and-fix requirements, and its exit criteria are findings-driven
  (every finding either fixed or recorded). Expected clarify questions: WCAG level confirmation; exceptions
  policy; scope of screen-reader walkthroughs (which journeys); whether forced-colors support is required
  now or recorded.
- **Exit Criteria** — Automated a11y assertions pass on all routes/roles; critical journeys are
  keyboard-complete with E2E proof; contrast/target/motion audits documented with results; exceptions list
  reviewed; no new accessibility regressions introduced in later phases (Phases 16–20 must re-run the suite).
- **Validation Gates** — `npm run verify`; `npm run test:e2e` (full suite, including the a11y and keyboard
  specs); documented manual walkthroughs.
- **Git Checkpoint** — Commit after convergence; `fix(035): …` or `feat(035): …` per the repo convention —
  fixes plus the standing a11y suite.

---

### Frontend Phase 16 — Responsive & Device Hardening

**Feature dir:** `specs/036-responsive-and-device-hardening` · **Mode:** Operate · **Depends on:** Phases 04–14, Phase 15 (fixes must not break a11y)

- **Purpose** — The product is used on a guest's phone, a cashier's tablet, a kitchen wall screen, and an
  owner's laptop. This phase makes every surface genuinely usable on its real device class instead of
  merely "not broken".
- **Scope** — A per-surface device contract (primary device class, secondary, explicitly unsupported);
  breakpoint behavior implemented consistently from tokens; layout hardening (no horizontal scroll at
  320–430 px, tablet landscape cashier/kitchen, desktop wide layouts); touch-target and spacing verification;
  sticky/anchored action patterns for mobile; table→card fallbacks; image and media behavior at each width;
  orientation change behavior on tablets; a documented responsive rule set in `docs/conventions.md`.
- **Out of Scope** — No PWA/offline app shell, no native app wrappers, no tablet-specific product features,
  no redesign of surfaces already correct at their device class, no change to design tokens beyond adding
  missing breakpoint/measure tokens if genuinely required.
- **Dependencies** — All surface phases; Phase 15 (sequential hardening chain — §9, §11 wave H); Phase 15's a11y suite must keep passing after layout changes.
- **Existing Contracts** — Phase 01's viewport projects; Phase 02's breakpoint/touch tokens; E2E assertions
  that must survive layout changes (selectors, names, order-sensitive locators such as
  `page.locator('li').filter(...)` — layout rewrites that move elements between lists must migrate those
  assertions deliberately and record it).
- **User Stories** — As a guest I order on a 390 px phone without zooming or horizontal scrolling; as a
  cashier I work a tablet in landscape with everything in reach; as kitchen staff I read the board from two
  metres on a wall screen; as an owner I work a laptop with dense tables; as anyone I can rotate a tablet
  without losing my place.
- **Functional Requirements** — FR-01 device contract per surface, documented; FR-02 breakpoint behavior
  driven by tokens (no ad-hoc media queries with magic numbers); FR-03 no horizontal overflow on any route
  at 320/390/430 px; FR-04 tablet landscape operational layouts verified for cashier and kitchen; FR-05
  desktop wide layouts for management/reports/platform; FR-06 table→card fallbacks with no data loss;
  FR-07 sticky/anchored actions on mobile surfaces; FR-08 orientation-change state preservation (scroll,
  open panels, in-flight actions); FR-09 virtual keyboard behavior on customer forms (no obscured fields or
  buttons at 390 px); FR-10 responsive regression suite in Playwright at the defined viewports.
- **UX Requirements** — Density follows device: airy on phones, compact on tablets, comfortable on desktop;
  primary actions always reachable with a thumb on mobile; nothing important is hidden by a breakpoint
  without a discoverable alternative; first paint at each width shows meaningful content, not a stack of
  skeleton padding.
- **Visual Requirements** — Responsive grid/measure rules, mobile navigation presentation, table collapse
  styling, sticky bar treatment, and image aspect handling — all from tokens; no surface may invent its own
  breakpoints.
- **Responsive Requirements** — This phase's entire subject: mobile (≈390 px), tablet portrait/landscape
  (≈768/1024 px touch), desktop (≈1280–1600 px), and one wide check for reports/comparison.
- **Accessibility** — Re-verify targets, focus order, and contrast after layout changes; mobile drawer
  keyboard/AT behavior; no layout change may remove a skip link, landmark, or live region; zoom resilience.
- **State Matrix** — Per surface × viewport: default / long-content / empty / error / loading / dialog open /
  drawer open / orientation change / virtual keyboard open. Tablet: touch vs stylus/mouse parity.
- **Security** — Layout changes must not reveal data hidden by a narrower layout (e.g. a card fallback must
  respect the same field-level visibility rules as the table view); no management-only fields leaking into
  mobile card rows for lower roles.
- **Components** — `ResponsiveTable`/card fallback primitive, `StickyActionBar`, `MobilePageHeader`,
  `OverflowRow`, plus per-surface layout fixes.
- **Routes** — All (no additions).
- **Data Dependencies** — None new.
- **Testing** — E2E: responsive suite across all routes at the defined viewports (chromium device emulation;
  WebKit if approved in Phase 01/16 clarify); orientation and overflow assertions; form-completion at
  390 px; axe re-run at mobile and tablet. Unit: helper assertions for breakpoint-driven components.
- **Impeccable Workflow** — `$impeccable adapt <target>` per surface group is the primary command; `audit`
  for the responsive findings; `critique` at 390 px and tablet landscape; `polish` for finish. `adapt`
  outputs are reviewed against the design system, not applied blindly.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: whether WebKit/Firefox E2E projects are
  added now; the officially supported device matrix (and what is explicitly unsupported); whether tablet
  landscape is the cashier's primary form factor; mobile-editing boundaries for management surfaces.
  Checklist focus: device contract honesty (unsupported stated, not implied).
- **Exit Criteria** — Every route satisfies its documented device contract; responsive regression suite
  green; no horizontal overflow at the small widths; tablet/desktop layouts verified for operational
  surfaces; a11y suite still green; presentation migrations recorded.
- **Validation Gates** — `npm run verify`; `npm run test:e2e` (full suite + responsive specs); axe at
  mobile/tablet; screenshots archived per §6.6.
- **Git Checkpoint** — Commit after convergence; `feat(036): …`.

---

### Frontend Phase 17 — State, Error, Loading & Offline Hardening

**Feature dir:** `specs/037-frontend-state-hardening` · **Mode:** Operate · **Depends on:** Phases 04–14, Phase 16

- **Purpose** — Make the product honest in every situation that is not the happy path: slow networks,
  failed reads, refused writes, empty tenants, partial data, expired sessions, and offline tablets. This is
  the phase where "loading / empty / error" stops being an afterthought and becomes a designed, tested state
  vocabulary.
- **Scope** — A complete state audit for all 25 routes and every mutation; skeletons instead of bare
  loading text where a read is slow; meaningful empty states with the next action; error states with retry
  and safe recovery; refusal rendering unified (verbatim server message + context); forbidden/denied states;
  offline/reconnecting behavior on operational surfaces (last-known data, clear staleness, no phantom
  success); duplicate-submit and double-click protection across every action; partial-data handling (e.g.
  one branch failing in a comparison); timeout and unreachable-backend states; error-boundary coverage at the
  route level; and a documented state vocabulary in `docs/conventions.md`.
- **Out of Scope** — No new product features, no new data reads, no changes to server error semantics,
  no retry policy that could duplicate a mutation, no offline write queue (nothing in the contract supports
  deferred writes — do not invent it).
- **Dependencies** — Phases 04–14 (all states exist somewhere), Phase 16 (sequential hardening chain — §9, §11 wave H), Phase 03 (toast/offline infrastructure).
- **Existing Contracts** — Verbatim refusal text (e.g. `This item is not available here.`,
  `already on its way`, session-unavailable refusal, `42501` denials); the disabled-while-in-flight rule that
  is the double-submit guard's client half; the customer's 10 s poll; realtime `SUBSCRIBED` recovery; the
  `role="alert"` / `role="status"` conventions; existing E2E assertions on these states.
- **User Stories** — As a cashier on bad Wi-Fi I know my last click reached the server or not; as an owner
  I see "no voids this week" instead of a blank box; as a customer submitting an order that fails I keep my
  cart and read exactly why; as anyone whose session expired I am returned somewhere sane with an
  explanation; as a manager reading a comparison where one branch failed I see the failure, not a zero.
- **Functional Requirements** — FR-01 state inventory per route (loading/empty/error/partial/forbidden/
  offline/stale) recorded and implemented; FR-02 skeletons for reads expected to exceed ~300 ms (menu, lists,
  boards, reports); FR-03 empty states that name the next action (and are never mistaken for errors);
  FR-04 error states with retry + preserved user input; FR-05 one refusal-rendering policy (inline at the
  action site for mutations, page-level for reads) with verbatim messages; FR-06 mutation in-flight discipline
  audited across every action (button disabled + guard, no duplicate writes); FR-07 offline/reconnecting
  behavior on cashier, kitchen, session oversight: last-known data readable, staleness obvious, actions
  blocked or clearly queued-for-retry (never silently dropped); FR-08 route-level error boundary fallback
  with a recovery path; FR-09 partial failure handling for multi-call surfaces (comparison, multi-branch
  reads); FR-10 session-expiry path with return-to preserved and an explanation; FR-11 the state vocabulary
  documented for future phases.
- **UX Requirements** — States never look like bugs: distinguish "nothing yet" from "couldn't load" from
  "you can't access this"; retry is always available where a retry can help; loading never shifts layout;
  long-running actions give progressive feedback; error copy is plain-language and states what the user can
  do; nothing pretends to be fresh when it is stale; offline must not silently degrade the kitchen board.
- **Visual Requirements** — Skeleton, empty, error, offline, forbidden, and partial treatments as
  first-class components (a consistent visual family, not per-page inventions); status colors used
  consistently; error state typography that reads as guidance, not alarm.
- **Responsive Requirements** — State components verified at mobile/tablet/desktop; skeleton dimensions
  match the content they replace at each breakpoint; offline banner placement does not cover primary actions
  on phones or the kitchen board.
- **Accessibility** — Loading announced politely only when it matters; error states focusable/focus-managed
  and announced; retry reachable by keyboard; empty states are real text, not images of text; offline state
  is text as well as color; refusal announcements do not spam the live region during a burst.
- **State Matrix** — The phase's deliverable _is_ the matrix. Each route records: initial load / background
  refetch / empty / partial / read error / mutation in-flight / mutation refused / forbidden / session
  expired / offline / reconnected / stale-while-realtime. Each row maps to a component and a test.
- **Security** — Error surfaces must not leak internals (no raw provider errors, no SQL/PostgREST messages
  beyond what the contract surfaces, no stack traces); denial states disclose nothing about other tenants;
  retry logic must never re-issue a mutation without user intent.
- **Components** — `Skeleton` family, `EmptyState`, `ErrorState`, `RetryButton`, `PartialFailureNotice`,
  `OfflineSurface`, `RefusalAlert`, plus route-level `ErrorBoundary` fallback.
- **Routes** — All (no additions).
- **Data Dependencies** — None new; the query-client policy from Phase 01 is reviewed here (retry semantics
  for reads only).
- **Testing** — E2E: **deterministic failure injection only** — route-level request failures via
  Playwright routing (mocked network failures), controlled delayed responses, controlled empty
  results, controlled RPC refusals, and controlled realtime disconnect/reconnect scenarios driven
  by the test. **Forbidden:** manually disconnecting Wi-Fi, random timing, sleep/wait races,
  unreliable network conditions, or any mechanism that amounts to "hope the request fails". The
  objective is reproducible tests, not simulated chaos — every injected failure must produce the
  same result on every run. Offline simulation, slow-response simulation for skeletons, duplicate-click
  protection on high-risk actions
  (submit round, transitions, void, close session, onboarding), refresh-failure for live lists, partial
  comparison failure, session expiry, error-boundary recovery. Unit: state-selection helpers. Database/
  integration suites unchanged.
- **Impeccable Workflow** — `$impeccable harden <target>` per surface group is the primary command;
  `onboard` is appropriate for first-run/empty-state craft (a new tenant's first day); `critique` for error
  copy; `clarify` for every user-facing failure message; `audit` for live-region/announcement correctness;
  `polish`.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: skeleton threshold; whether offline
  actions are blocked or hidden; refusal-rendering policy details (inline vs page-level); whether last-known
  data is shown offline for cashier (contract-neutral, UX decision); retry attempt policy for reads.
  Checklist focus: honesty (never show stale as fresh, never fake success).
- **Exit Criteria** — Every route has its full state matrix implemented and tested; failure injection specs
  pass; no unhandled error reaches a white screen; state vocabulary documented; existing E2E assertions
  preserved.
- **Validation Gates** — `npm run verify`; `npm run test:e2e` (full suite, including new failure-injection
  and offline specs); axe re-run on state-heavy routes.
- **Git Checkpoint** — Commit after convergence; `feat(037): …`.

---

### Frontend Phase 18 — Performance & Perceived Speed

**Feature dir:** `specs/038-frontend-performance` · **Mode:** Operate · **Depends on:** Phase 17 (states finalized), Phase 16 (layouts finalized)

- **Purpose** — The customer menu and order submission are the product's most latency-sensitive paths
  (master plan §26). This phase makes the frontend fast in ways that are measured, not asserted — reusing
  the 016 baselines and adding frontend-side budgets.
- **Scope** — Bundle analysis and route-level code splitting; query-cache policy tuning (staleTime,
  refetch-on-focus, prefetch on hover/intent for staff surfaces); customer menu first-paint and cart
  interaction responsiveness; image handling (menu images: sizing, lazy loading, placeholder behavior,
  signed-read reuse); realtime cost review (channel count, coalescing, redundant invalidations); list
  rendering for long queues/trails; re-render profiling on live boards; measured budgets with recorded
  evidence; documented performance budget + how to measure it.

**Evidence structure (mandatory for every optimization):** each performance change is recorded in
the feature directory as **Baseline → Change → Measurement → Result**. A Baseline is the measured
value before the change; the Change names exactly what was altered; the Measurement re-runs the
same measurement; the Result states what improved (or did not). **No performance claim is accepted
merely because an optimization "looks better."** Where practical, measure: customer menu initial
load, route transition behavior, JavaScript payload, image payload, staff dashboard render, KDS
render, data-fetch latency, and perceived loading behavior. Only measured bottlenecks are
optimized; budgets must be explicitly justified and recorded — never invented without support from
the existing project context.

- **Out of Scope** — No backend/RPC/database optimization (016 owns backend baselines); no CDN/provider
  changes; no caching layer that could serve stale business state; no dependency-driven optimization that
  changes behavior (e.g. server-side rendering, a new data client); no speculative micro-optimization
  without a measurement.
- **Dependencies** — Phases 17/16 (state and layout stable), Phase 02 tokens (image aspect rules).
- **Existing Contracts** — 016 baselines (`menu_loading` budget 1500 ms, `round_submission` budget 800 ms,
  realtime subscribe ≈ 218 ms, reconnect ≈ 72 ms, storage upload ≈ 189 ms / signed read ≈ 258 ms); the
  invalidation-only realtime pattern; the cart's local-first design (instant perceived add-to-cart);
  `refetchInterval: 10 s` customer poll; `staleTime: 60 s` public restaurant read.
- **User Stories** — As a guest I see the menu in under two seconds on a phone with a mediocre connection,
  and adding an item feels instant; as a cashier the board never stutters while rounds arrive; as kitchen
  staff the board updates promptly without flicker; as an owner reports open quickly without freezing my
  laptop.
- **Functional Requirements** — FR-01 measured baseline capture for frontend paths (route navigation
  timings, interaction latency, bundle sizes per route) recorded in the feature directory;
  FR-02 route-level code splitting so customer routes do not carry staff/admin code (and vice versa);
  FR-03 image strategy: correct sizes, lazy loading below the fold, stable aspect boxes, no layout shift;
  FR-04 cache policy written down per query family (freshness expectations vs poll/realtime); FR-05
  prefetching where it improves navigation without wasting bandwidth; FR-06 re-render discipline on live
  boards (memo boundaries, no list-wide re-render per event); FR-07 long-list rendering strategy where
  measurements demand it; FR-08 budgets: customer menu interactive latency, route chunk sizes, and
  interaction responsiveness, each with a measured result and a threshold; FR-09 no regression against the
  016 numbers attributable to the frontend.
- **UX Requirements** — Perceived speed first: instant local feedback for cart actions, skeletons shaped
  like content, no spinner-only waits for long reads, no layout jank when images land, no visual "pop" when
  realtime refreshes replace lists (stable keys, no unnecessary remount).
- **Visual Requirements** — No visual change is the goal; any change needed for layout stability (aspect
  boxes, reserved space) must be invisible at rest. Skeleton and loading treatments come from Phase 17.
- **Responsive Requirements** — Performance verified on a throttled mobile profile (slow 3G/CPU ×4) for the
  customer journey, and on the operational tablet profile for cashier/kitchen; document any device-class
  specific finding.
- **Accessibility** — Performance work must not remove live regions, focus management, or labels; lazy
  loading must not hide focusable content from keyboard or AT; motion introduced for perceived speed must
  respect reduced-motion.
- **State Matrix** — Cache: fresh / stale / refetching / offline; images: placeholder / loading / loaded /
  failed (must not shift layout); chunks: loaded / slow (loading state) / failed (error boundary path);
  lists: short / long / virtualized (if used).
- **Security** — No new caching of tenant data across identities (cache keys must include identity/scope as
  they already do); no persistent client caches of business data beyond what exists; prefetch only for
  surfaces the identity may already read.
- **Components** — `SmartImage`, prefetch utilities, memoized row/card components, optional
  virtualization primitive (only if measurement demands), and a small measurement harness.
- **Routes** — All (no additions); splitting boundaries introduce loading states reused from Phase 17.
- **Data Dependencies** — None new; cache policies are queried per existing keys.
- **Testing** — E2E: throttled-profile customer journey within budget; measurement assertions recorded
  (informational thresholds where network variance dominates, hard assertions only where deterministic —
  e.g. chunk size, no duplicated requests). Unit: cache-policy helpers, image helper behavior. Manual:
  Lighthouse-style capture recorded in the feature directory (tool choice recorded, values not frozen as
  assertions on shared cloud infrastructure).
- **Impeccable Workflow** — `$impeccable optimize <target>` for frontend performance diagnosis and fixes;
  `audit` to confirm no accessibility/layout regressions; `polish` where perceived-speed treatments are
  visual. No redesign.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: which budgets become hard assertions;
  whether list virtualization is allowed (and where); bundle-size thresholds; throttling profile to use;
  whether to add Lighthouse automation or keep it manual in this phase. Checklist focus: measurement honesty
  (no unmeasured claims) and no behavioral change.
- **Exit Criteria** — Recorded **Baseline → Change → Measurement → Result** entries for every
  optimization (no claim without this structure); recorded measurements for every FR-08 budget;
  customer journey meets its budget on the
  throttled profile; operational boards show no measurable stutter under a burst; no 016 regression
  attributable to the frontend; all behavior and tests unchanged.
- **Validation Gates** — `npm run verify`; `npm run test:e2e` (full suite + the throttled/journey specs);
  recorded measurement artifacts.
- **Git Checkpoint** — Commit after convergence; `perf(038): …`.

---

### Frontend Phase 19 — Frontend End-to-End Validation

**Feature dir:** `specs/039-frontend-e2e-validation` · **Mode:** Operate (validation) · **Depends on:** Phases 15–18

- **Purpose** — The frontend's dress rehearsal, mirroring spec 017 for the UI: one connected multi-role
  journey plus a per-role proof table covering realtime, notifications, responsive, accessibility,
  performance, and the state matrix — with every scenario either cited to a standing suite or newly covered.
- **Scope** — One long, deterministic browser journey across roles and surfaces (owner setup → customer entry
  → rounds → cashier/kitchen handling → status → bill/void → session close → reports/audit → platform
  console), driven at the interface level; per-role journeys for owner, branch manager, cashier, kitchen,
  super admin, and the public guest; realtime liveness; notification/cue behavior; responsive viewport pass;
  accessibility pass; performance smoke; error/loading/empty state spot-checks; a scenario→proof table; and a
  committed validation record.
- **Out of Scope** — No new product features; no redesign (friction found is recorded, not fixed here —
  fixes go to the owning phase or a convergent task with a justification); no new backend coverage (db/
  integration suites already exist and are cited); no production deployment (Phase 20).
- **Dependencies** — All previous phases; requires a migrated + seeded cloud dev project and respects the
  sign-in rate limit (§12.5).
- **Existing Contracts** — The full E2E surface (13 existing suites + the suites added by Phases 01–18); the
  seeded fixture personas (alice owner Blue Olive, bob manager Downtown, carla cashier Downtown, dan kitchen
  Marina, eve dual-role, fiona membership-less, platform admin); deterministic fixture ids; the no-residue
  posture of the read-and-reject suites.
- **User Stories** — As the product owner I can watch one connected story prove the frontend works end to
  end; as a reviewer I can find the proof for any scenario in one table; as a future maintainer I can rerun
  the whole thing and trust the result.
- **Functional Requirements** — FR-01 one committed journey from setup through reporting (freshly created
  scratch tenant, cleaned up or explicitly left as documented residue); FR-02 a per-role journey suite
  (owner, manager, cashier, kitchen, super admin, public guest) each proving its primary task; FR-03 a
  scenario→proof table covering: realtime arrival, reconnect recovery, notification/cue, cutoff, void, audit
  visibility, subscription states, responsive completion at mobile/tablet/desktop, accessibility assertions,
  console cleanliness (expected-vs-unexpected per F-G14), and the state matrix spot-checks; FR-04 every scenario either cited (file + test name)
  or newly covered — no silent gaps; FR-05 failures are fixed or the intended behavior asserted, never
  weakened; FR-06 the full gate (`npm run verify` + `npm run test:e2e`) passes after this phase, with a
  recorded run summary.
- **UX Requirements** — The journeys are driven the way a human would (no DOM shortcuts to bypass UI),
  except where a documented injection is the only way to create a state (e.g. a stale cart line — the
  existing poisoned-cart precedent).
- **Visual Requirements** — Screenshots at required viewports captured per surface and archived per §6.6 as
  the visual record of the release candidate.
- **Responsive Requirements** — Every journey runs at its real device class: customer at 390 px, cashier and
  kitchen at tablet landscape, management/reports/platform at desktop.
- **Accessibility** — The a11y suite runs against the release candidate on every route/role; manual
  screen-reader spot-checks on the four highest-value journeys recorded with outcomes.
- **State Matrix** — Spot-checks per role for loading, empty, error, offline/reconnect, and refusal states —
  at least one of each proven in a real browser.
- **Security** — Journeys must demonstrate denial behavior (out-of-scope deep links, role denials,
  cross-tenant isolation at the UI level) rather than only happy paths; no secrets in test artifacts; the
  suite must not weaken any existing security assertion.
- **Components** — Test helpers only (storage-state fixtures to conserve sign-ins, viewport fixtures,
  failure-injection helpers), placed consistently with existing `e2e/` conventions.
- **Routes** — All.
- **Data Dependencies** — Seeded fixtures + scratch data created and cleaned by the journey; no new RPCs.
- **Testing** — E2E is the deliverable. The suite is organized so a reviewer can run one role's journey
  independently; serial/parallel posture documented per file (the existing convention: serial where fixture
  tables are shared). Database and integration suites run unchanged as regression.
- **Impeccable Workflow** — No design work here. `critique` may be run once on the release candidate to
  capture an independent UX verdict as evidence; `audit` is run as the final technical sweep; findings are
  recorded (fixed only if they are defects in phase scope).
- **SpecKit Workflow** — Full pipeline, with `tasks` weighted toward validation coverage rather than
  construction. Expected clarify questions: which scenarios get new coverage vs citation; whether the
  journey creates a scratch tenant or runs against the seed; how much residue is acceptable; whether WebKit
  joins the validation run. Checklist focus: judgement honesty — a scenario without a standing proof is a
  gap, and a proof with a weakened assertion is worse.
- **Exit Criteria** — The journey and all role suites pass in one run on a freshly seeded database; the
  scenario→proof table has no gaps; the a11y/responsive/console suites pass on the release candidate; run
  summary + screenshots committed; `npm run verify` green; console cleanliness proven as
  expected-vs-unexpected (F-G14), not as a blanket "zero errors" claim.
- **Validation Gates** — `npm run verify`; `npm run test:e2e` (full suite, single documented run window
  respecting rate limits); documented run summary.
- **Git Checkpoint** — Commit the validation suites + record after convergence; `test(039): …`.

---

### Frontend Phase 20 — Frontend Production Readiness & Release

**Feature dir:** `specs/040-frontend-release-readiness` · **Mode:** Operate (release) · **Depends on:** Phase 19

- **Purpose** — Ship it: a production build that deploys reproducibly, carries no secret, serves every
  client route correctly, is monitored enough to be operated, and has a documented rollback — with the
  frontend production checklist answered item by item.
- **Scope** — Production build verification (chunks, budgets, sourcemaps policy); environment configuration
  per environment (Local/Staging/Production values and where they live); deploy rehearsal and real deploy
  path through the existing Cloudflare Pages contract; SPA fallback verification for deep links; caching
  headers for hashed assets vs `index.html`; auth redirect URL requirements for the production domain;
  secret-in-bundle re-verification; error-tracking/monitoring decision recorded (vendor-free by default:
  what the error boundary exposes, what the operator wires); final cross-browser/device regression; the
  **frontend production-readiness checklist**; release notes and rollback procedure; documentation updates
  (`docs/production-runbook.md`, `docs/development.md`, `docs/conventions.md`).
- **Out of Scope** — No database migrations or Supabase project creation (operator actions, already
  documented by spec 018); no CI pipeline unless the owner asks (the repo has none today — record the
  decision); no analytics/marketing tooling; no service worker/PWA; no new feature work; no change to the
  existing deploy script's contract beyond what this phase explicitly specifies.
- **Dependencies** — Phase 19 validation record; Phase 01/16 tooling and viewport matrix.
- **Existing Contracts** — `npm run build` (`tsc -b && vite build`), `npm run deploy`
  (`scripts/deploy-frontend.mjs`), `--dry-run` rehearsal, required Cloudflare credentials
  (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`), SPA fallback precondition
  (`dist/index.html` at the deploy root), `tests/unit/production.guard.test.ts` (no non-`VITE_` variable may
  reach the bundle), the environment matrix in `docs/production-runbook.md`, `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_PUBLISHABLE_KEY` as the only public configuration.
- **User Stories** — As the operator I deploy the release candidate with one command and can roll back with
  one command; as a guest I reach a deep link (e.g. a QR URL) on a fresh browser and the app loads;
  as the owner I know what happens when something breaks in production and who is told; as a future
  maintainer I have a checklist that says exactly what was verified and what remains an operator action.
- **Functional Requirements** — FR-01 production build succeeds from a clean tree with zero warnings that
  matter (each warning either fixed or recorded with a reason); FR-02 bundle budget check recorded per route
  chunk; FR-03 no secret in the bundle (guard test + manual inspection of the built assets named in the
  checklist); FR-04 environment values documented per environment with the exact variable names; FR-05 SPA
  fallback proven by deep-link loads for: `/r/:slug`, `/r/:slug/menu`, `/signin`, `/dashboard/*`, `/admin/*`;
  FR-06 auth redirect URLs for the production domain recorded as an operator step with its dashboard path;
  FR-07 caching policy for hashed assets vs `index.html` recorded; FR-08 error tracking decision recorded
  (either a wired vendor with credentials as operator steps, or an explicit "none — error boundary + manual
  reporting" disposition with rationale); FR-09 rollback procedure recorded (Pages rollback + what cannot be
  rolled back); FR-10 the **frontend production-readiness checklist** with dispositions
  `wired`/`operator`/`n/a`-with-reason, mirroring the honesty posture of the existing runbook;
  FR-11 cross-browser/device regression record (chromium + whichever additional engines were approved);
  FR-12 release notes (what shipped across Phases 01–19, in user terms).
- **UX Requirements** — No UX change in this phase beyond fixes required by release findings; every fix
  must pass the Phase 15 a11y suite and Phase 16 responsive suite unchanged.
- **Visual Requirements** — Release candidate screenshots (desktop/mobile per key surface) archived as the
  release record; favicon/app icon set verified; no placeholder assets remaining anywhere.
- **Responsive Requirements** — Final device matrix verified on the production build (not the dev server):
  customer at mobile, cashier/kitchen at tablet, management/reports/platform at desktop.
- **Accessibility** — The a11y suite runs against the production build at a real deploy URL (or the preview
  build served locally); any finding is fixed or recorded before release.
- **State Matrix** — Production-build verification of: cold load, deep-link load, error boundary, offline
  banner, session expiry, and a refused mutation — proving the states behave in the built artifact, not only
  in dev.
- **Security** — Only `VITE_*` variables inlined; publishable key is public by design; no service-role or
  database credential in any artifact; CSP/headers posture recorded (what the host provides vs what would
  need configuration); no test/dev credentials in the shipped artifacts; the reset/seed scripts remain absent
  from the deploy path (existing guard).
- **Components** — None new; possibly a release-check script if the owner wants it automated (registered in
  `package.json` + docs per §12.3).
- **Routes** — All, verified in the built artifact (including deep links without a dev server).
- **Data Dependencies** — Production Supabase project (operator-created per the runbook); no schema change.
- **Testing** — E2E: the Phase 19 suite re-run against the preview/production build configuration where
  possible (environment permitting), plus deep-link and cold-load checks; `npm run verify` on the release
  commit; `node scripts/deploy-frontend.mjs --dry-run`; manual checklist verification for host-side items.
- **Impeccable Workflow** — Optional final `$impeccable polish` and `audit` on the release candidate;
  findings recorded. No new design work.
- **SpecKit Workflow** — Full pipeline. Expected clarify questions: whether error tracking is wired now or
  deferred; whether a release-check script is added; whether CI is introduced; who owns each operator step.
  Checklist focus: deploy honesty (nothing claimed that the repository cannot prove).
- **Exit Criteria** — Production build + deploy rehearsal succeed; the frontend checklist is complete with
  dispositions and proofs; deep links verified in the built artifact; no secret in the bundle; regression
  green on the release commit (unexpected console/network cleanliness verified on the built artifact,
  expected business refusals per F-G14); release notes + rollback documented; `feature.json` closed out.
- **Validation Gates** — `npm run verify`; `npm run test:e2e` (full);
  `node scripts/deploy-frontend.mjs --dry-run`; `npm run build` from a clean tree.
- **Git Checkpoint** — Final commit after convergence (docs + checklist + any release fixes); `release(040): …`
  or `docs(040): …`. Tagging, deploying, and pushing are owner actions — not part of this plan's execution.

---

## 9. Phase Dependency Graph

```text
                  Phase 01  Foundation & architecture baseline
                       ↓
                  Phase 02  Design system & visual language   ← the gate for all surfaces
                       ↓
        ┌──────────────┴───────────────┐
        ↓                              ↓
   Phase 03                     (design system consumed, never re-created)
   Application shell, navigation & global UX
        ↓
        ├───────────────────────────────┬───────────────────────────────┐
        ↓                               ↓                               ↓
   Phase 04                        Phase 06                        Phase 09
   Auth, account &                 Restaurant, branch,             Cashier operations UX
   customer entry UX               tables & staff UX                    ↓
        ↓                               ↓                          Phase 10
   Phase 05                        Phase 07                       Kitchen display UX
   Customer menu, cart,            Menu management UX                  ↓
   rounds & order status                ↓                          Phase 11
        ↓                          Phase 08                       Delivery & takeaway
        │                          Tax configuration UX           channel UX
        │                               │                               │
        └───────────────┬───────────────┴───────────────┬───────────────┘
                        ↓                               ↓
                   Phase 12                        Phase 13
                   Realtime, notifications          Reports, audit &
                   & subscription awareness        void log UX
                        ↓                               ↓
                   Phase 14  Super admin, tenant onboarding & subscription administration UX
                        ↓
                  Phase 15  Accessibility hardening
                        ↓
                  Phase 16  Responsive & device hardening
                        ↓
                  Phase 17  State, error, loading & offline hardening
                        ↓
                                     Phase 18  Performance & perceived speed
                                          ↓
                                     Phase 19  Frontend end-to-end validation
                                          ↓
                                     Phase 20  Frontend production readiness & release
```

Reading the graph:

- **Phase 02 is a hard gate.** No surface phase starts before the design system is committed
  (`DESIGN.md` + primitives + tokens). Phase 03 is its first consumer and its proof.
- **Phase 03 is a soft gate** for all staff-facing surfaces: they assume the shell, navigation,
  context switcher, toasts, confirm dialogs, and offline banner exist. Phase 04 (public/customer)
  depends on it for the customer shell only.
- **Phases 04→05** are sequential (entry precedes ordering). **06→07→08** are sequential within
  the management thread (branch context and table patterns precede the menu editor, whose editor
  patterns precede tax forms). **09 → 10** are sequential by default: both modify
  `features/staffOps/**` and the same E2E suites, so two agents must not work them concurrently
  unless the owner explicitly partitions files/components and accepts the reconciliation cost
  (§11 wave E). **11** refines both and therefore follows them. **12** needs live surfaces (09, 10) plus the shell. **13** is independent of 09/10 code-wise but describes their outcomes; run
  it after 09 so the void ledger matches the void flow that shipped.
- **14** follows 03 (platform shell) and 12 — specifically the **subscription state vocabulary**
  Phase 12 commits (§8 Phase 14 dependencies), not all of Phase 12's realtime/cue work.
- **15, 16, 17** audit/finish everything from 04–14 and must not run before those surfaces exist.
  They are **sequentially dependent by default (15 → 16 → 17)**: all three touch the same
  components and visual surfaces, and concurrent execution reliably produces reconciliation and
  re-verification churn. They may run in parallel only if the owner explicitly authorizes it
  after reviewing the expected reconciliation/re-verification cost (§11 wave H) — the default
  is the sequential order above.
- **18** follows 16/17 (measuring layouts and states that are final). **19** validates the frozen
  product. **20** ships it.

---

## 10. Critical Path

The longest dependency chain is 13 phases:

```text
Phase 01 → Phase 02 → Phase 03 → Phase 04 → Phase 05 → Phase 11 → Phase 12 → Phase 15 → Phase 16
        → Phase 17 → Phase 18 → Phase 19 → Phase 20
```

The non-obvious parts of this path:

- **Phase 02 sits on the path.** Rushing the design system to "start screens sooner" moves the
  whole release later, not earlier (every later phase would rework visuals twice).
- **Phase 05 → Phase 11** is the product's revenue path: ordering must exist before channel
  behavior can be refined, and both sit upstream of the notification and hardening phases.
- **Phase 15 → 16 → 17 → 18** is deliberately sequential on the critical path even though they
  touch different concerns: each one's exit criteria include "the previous suite still passes",
  and running them concurrently on the same components reliably produces contention and
  re-verification churn (constitution VIII — no complexity without a measured need).

Shorter branches (management `06→07→08`, operations `09→10`, reporting `13`, platform `14`) can
finish well before the critical path's tail, which is what makes the parallel waves in §11
practical — with Phases 09→10 and the hardening chain 15→16→17 sequential by default (§9, §11).

---

## 11. Parallelization Opportunities

Parallel work is allowed only where it cannot collide on files, fixtures, or the shared E2E database.

| Wave | Can run together                                 | Preconditions                                                                                         | Collision rules                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | —                                                | Phase 01 must land alone (it touches tooling/config every phase uses)                                 | —                                                                                                                                                                                                                                                                                                                                                                                                                               |
| B    | —                                                | Phase 02 must land alone: it defines tokens/primitives every surface consumes                         | —                                                                                                                                                                                                                                                                                                                                                                                                                               |
| C    | —                                                | Phase 03 must land alone: it restructures the shell, which mounts every route                         | —                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D    | **04**, **06**                                   | Design system + shell stable                                                                          | 04 touches `features/session` + auth/entry routes; 06 touches `features/management` + management routes. No shared files except shell slots                                                                                                                                                                                                                                                                                     |
| E    | **05**, **07**                                   | 04 (for 05), 06 (for 07)                                                                              | 05 = customer order/menu features; 07 = menu management + menu primitives. **Phases 09 and 10 are NOT in this wave**: they both modify `features/staffOps/**` and `e2e/kitchen.cashier.test.ts`, so they run sequentially by default (**09 → 10**); parallel execution only if the owner explicitly partitions files/components and accepts the reconciliation cost — never two agents editing staffOps concurrently by default |
| F    | **08**, **13**, **14**                           | 07 (for 08), 09 (for 13), 12's subscription vocabulary (for 14 — may start once the vocabulary lands) | 08 = tax feature; 13 = reports/audit; 14 = platform. Disjoint                                                                                                                                                                                                                                                                                                                                                                   |
| G    | **11**, **12**                                   | 05, 09, 10 (for 11); 03, 09, 10 (for 12)                                                              | 11 refines surfaces owned by 05/09/10; 12 touches shell-level announcements. Prefer serial: 11 then 12                                                                                                                                                                                                                                                                                                                          |
| H    | **15** → **16** → **17** (sequential by default) | 04–14 complete at their exit criteria                                                                 | All three harden the same components and visual surfaces. Default is mandatory sequential order 15 → 16 → 17; parallel execution only if the owner explicitly authorizes it after reviewing the expected reconciliation/re-verification cost — not merely "discouraged"                                                                                                                                                         |
| I    | **18**                                           | 16, 17                                                                                                | Alone (it measures and edits broadly)                                                                                                                                                                                                                                                                                                                                                                                           |
| J    | **19**                                           | 15–18                                                                                                 | Alone (it is the validation run)                                                                                                                                                                                                                                                                                                                                                                                                |
| K    | **20**                                           | 19                                                                                                    | Alone                                                                                                                                                                                                                                                                                                                                                                                                                           |

Shared-resource rules for any parallel work:

- **One E2E database.** Concurrent phases run Playwright against the same seeded cloud dev project. Fixtures must be chosen so two phases do not drive the same table/session simultaneously; the existing pattern (dedicated tables per scenario, serial files where a fixture table is shared) is mandatory (see §12.5).
- **Sign-in budget.** Two phases running E2E concurrently can exceed 30 sign-ins / 5 minutes per IP.
  Serialize E2E runs, or split suites by file with a documented schedule.
- **Design-system stability.** A phase that needs a primitive it does not have must _amend the design
  system_ with an explicit task, reviewed as a design-system change — not fork a local variant.
- **Documentation ownership.** `docs/conventions.md`, `docs/development.md`, and
  `docs/production-runbook.md` are edited by one phase at a time (otherwise merge conflicts on prose).
- **`PRODUCT.md` / `DESIGN.md` ownership.** Only a design-system amendment or an owner decision edits
  them; surface phases update their own briefs.

---

## 12. Global Quality Gates

Every phase must satisfy all of gates **F-G01…F-G14** plus the command gates in §12.2 before it is
considered complete. Gates are cumulative: a later phase may not disable an earlier phase's suite.

### 12.1 Architectural gates

| #     | Gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-G01 | **TypeScript passes** — `npm run typecheck` clean; no new `any`, `@ts-ignore`, or non-null assertions without a justification recorded in the phase's plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| F-G02 | **Lint + format pass** — `npm run lint`, `npm run format:check` clean; no rule disabled to make a phase pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| F-G03 | **Unit tests pass** — `npm run test:unit`; new UI logic is unit-tested where it is testable in the node environment (pure helpers, mapping, policies) and proven in E2E where DOM behavior is the subject                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| F-G04 | **Database and integration suites pass unchanged** — `npm run test:db`, `npm run test:integration`. Any change to these suites is a red flag: they belong to backend features                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| F-G05 | **Relevant E2E suites pass** — `npm run test:e2e`, at minimum the suites named in the phase's validation gates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| F-G06 | **Production build passes** — `npm run build`; `npm run verify` runs the whole local pipeline in order (§12.6 defines when the full gate is required: milestone boundaries and final validation — never a weakened version mid-phase)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| F-G07 | **No authorization regression** — guards/predicates behave identically; denial views render (rejected, not hidden); no client-side check is introduced as if it were enforcement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| F-G08 | **No tenant-isolation regression** — no new read/write path, no cache key that omits identity/scope, no cross-branch data rendered for out-of-scope branches; `npm run test:db` isolation suites green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| F-G09 | **Presentation-contract discipline** — accessible names, live-region roles, `data-*` hooks, `data-testid` values, and the frozen `localStorage` keys are preserved, or intentionally migrated in the same commit with the phase spec recording each change and why. No assertion is deleted or loosened to pass a phase. The Phase 01 ledger organizes these into four stability categories — **A Semantic** (accessible names, labels, roles, headings, live regions, tested focus behavior), **B Behavioral** (`data-*` state hooks, lifecycle selectors, state-specific DOM markers), **C Test-only** (`data-testid`), **D Storage** (frozen `localStorage` keys) — with the change-cost discipline each category carries |
| F-G10 | **No duplicated design-system primitives** — new UI composes existing primitives; a genuinely new pattern is added to the design system once (with the amendment recorded) and reused; a third copy of any pattern is a defect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| F-G11 | **No unapproved backend/database change** — zero diffs under `supabase/**`, `src/types/database.types.ts`, RPC signatures, RLS policies, or migration files; any frontend idea that would require one is recorded as a contract conflict (§3.8) instead of implemented                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| F-G12 | **Accessibility baseline** — the Phase 01 a11y suite passes for every route the phase touches (and stays passing for the rest); new interactive elements are keyboard-operable with visible focus and accessible names                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| F-G13 | **Responsive baseline** — the phase's surfaces satisfy their documented device contract; no horizontal overflow at mobile widths; new tables/lists have their narrow-width behavior defined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| F-G14 | **Console and network cleanliness (expected vs unexpected)** — no unexpected console errors, unhandled promise rejections, React warnings, or unexpected network failures on the phase's routes during its E2E runs. Expected business refusals and server-authoritative validation responses (unauthorized access, invalid lifecycle transitions, closed sessions, unavailable items, rejected mutations, invalid state transitions) must be explicitly identified by the phase — they are expected business behavior, not unexpected network failures — and each relevant phase may maintain an explicit expected-failure list for its E2E scenarios. The requirement for genuinely unexpected failures is not weakened    |

### 12.2 Command gates (the project's real scripts — no invented commands)

```bash
npm run format:check      # prettier check
npm run lint              # eslint
npm run typecheck         # tsc -b
npm run test:unit         # vitest, tests/unit
npm run test:db           # vitest, tests/database (needs migrated+seeded cloud dev project)
npm run test:integration  # vitest, tests/integration (same precondition)
npm run build             # tsc -b && vite build
npm run verify            # format:check → lint → typecheck → test:unit → test:db → test:integration → build
npm run test:e2e          # playwright (starts its own dev server on :5173)
node scripts/deploy-frontend.mjs --dry-run   # deploy rehearsal (Phase 20)
```

Phase-level rule: a phase may not weaken `verify`. If a phase adds a standing check (a11y suite,
responsive suite, budget check), it runs inside `npm run test:e2e` or is added to `package.json`
**and** to `verify` **and** to `docs/development.md` in the same commit (Phase 01, FR-12).

### 12.3 Dependency policy

- Default: **no new runtime dependency.** Styling is CSS Modules + tokens; icons are inline SVG.
- Dev-only additions that are already planned and require explicit owner approval: `eslint-plugin-jsx-a11y`
  (Phase 01), `@axe-core/playwright` (Phase 01). Anything else is a clarify question with a written
  justification (constitution VIII).
- Any approved dependency must appear in the phase's plan.md with its reason and must not change runtime
  behavior of existing surfaces.

### 12.4 Determinism and honesty rules

- **No flaky-by-construction tests.** Time-dependent assertions use the same tolerance patterns the
  existing suites use; network-variance-dependent numbers are recorded as measurements, not as hard
  assertions (Phase 18).
- **No optimistic business state.** The UI never shows a state the server has not confirmed; only
  presentation-level affordances (disabled/busy) may be optimistic.
- **No fabricated content.** No invented brand claims, testimonials, prices, or capabilities; synthetic
  demonstration data is labelled as such where it appears in a deliverable.
- **Evidence, not adjectives.** Each phase commits its evidence: test output summaries, screenshots at
  required viewports, detector output, and (where applicable) measurements.
- **No claim of completion for a phase whose exit criteria are unmet.** Record the gap instead.

### 12.5 E2E resource discipline (mandatory for every phase that touches Playwright)

- **Sign-in budget:** 30 sign-ins / 5 minutes / IP; the current E2E run uses ≈ 14. New specs must reuse
  `storageState` per role (a small number of genuinely sign-in-fresh specs stay in `auth.routes`), and
  phases must not run E2E concurrently with another phase.
- **No recovery emails from tests** (hosted SMTP: 2/hour).
- **Recovery endpoint window:** 60 s between requests — no test may hit it more than once per run.
- **Database precondition:** migrated + seeded cloud dev project; a failing isolation/suite precondition is
  reported, not skipped.
- **Residue policy:** read-and-reject suites stay read-only; mutating specs create scratch data and clean
  up (or are serial with a documented fixture table, as `session.surfaces.test.ts` does with Downtown T3).

### 12.6 Tiered validation (full gates at meaningful boundaries, smaller sets during work)

The global gates (§12.1) and `npm run verify` are not weakened or removed. Validation is layered so
agents do not re-run the most expensive suites after every tiny change while full strength is
preserved where it matters:

- **Phase-local validation (during active implementation):** the smallest relevant deterministic
  set — `format:check`, `lint`, `typecheck`, plus the **relevant** unit tests, E2E specs, and
  accessibility/responsive checks for the files and surfaces actually being changed. No full-suite
  repetition is required mid-implementation.
- **Milestone validation (at named boundaries):** `npm run verify` **plus the appropriate E2E
  suites**. The mandatory milestone gates are: (a) each phase's convergence (every phase's exit
  criteria already require its named suites); (b) the **Phase 02 design-system gate** (the whole
  system committed before any surface starts); (c) the **Phase 03 shell gate** (the mount point for
  every route); and (d) the **pre-hardening boundary** (Phases 04–14 complete at their exit criteria
  before Phase 15 starts).
- **Final validation:** Phases 19 and 20 perform the complete final validation the plan already
  requires (full `npm run verify`, full `npm run test:e2e`, the validation record, and the release
  checklist). Nothing about this tiering reduces what Phases 19/20 must prove.

Rules: no gate may be deleted; no phase may weaken `verify` (§12.2); a phase-local pass never
substitutes for a milestone or final gate; and any new standing check still registers in
`package.json` + `verify` + `docs/development.md` (Phase 01 FR-12).

---

## 13. Final Production Readiness

The **Frontend Production Readiness Checklist** delivered by Phase 20. Dispositions follow the existing
runbook's honesty posture: `wired` (a repository artifact proves it), `operator` (an action a human
performs, with owner and console path), `n/a` (with a reason).

### 13.1 Build and deployment

| #   | Item                                                       | Disposition target | Proof                                                                                                |
| --- | ---------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| 1   | Production build succeeds from a clean tree                | wired              | `npm run build` output recorded                                                                      |
| 2   | Deploy rehearsal succeeds without credentials              | wired              | `node scripts/deploy-frontend.mjs --dry-run` output                                                  |
| 3   | Deploy path unchanged and documented                       | wired              | `docs/production-runbook.md` §1                                                                      |
| 4   | SPA fallback serves deep links                             | wired              | built-artifact deep-link checks (`/r/:slug`, `/r/:slug/menu`, `/signin`, `/dashboard/*`, `/admin/*`) |
| 5   | Asset caching policy (hashed assets vs `index.html`)       | wired/operator     | recorded per host capability                                                                         |
| 6   | Rollback procedure (Pages rollback; forward-only database) | operator           | runbook §1 rollback, owner named                                                                     |

### 13.2 Configuration and security

| #   | Item                                                               | Disposition target | Proof                                                     |
| --- | ------------------------------------------------------------------ | ------------------ | --------------------------------------------------------- |
| 7   | Only `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` inlined | wired              | `tests/unit/production.guard.test.ts` + bundle inspection |
| 8   | No service-role/database credential in any artifact                | wired              | guard test + manual inspection recorded                   |
| 9   | Auth redirect URLs for the production domain                       | operator           | Supabase dashboard path recorded                          |
| 10  | Environment matrix (Local/Staging/Production) current              | wired              | runbook §3                                                |
| 11  | No development credentials or seed data in shipped artifacts       | wired              | guard test + Phase 20 inspection                          |
| 12  | Client authorization assumptions absent (server-enforced)          | wired              | denial E2E suite                                          |

### 13.3 Product quality

| #   | Item                                                                                                                                                 | Disposition target    | Proof                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------- |
| 13  | All roles work on their real device class                                                                                                            | wired                 | Phase 19 role journeys at documented viewports                       |
| 14  | Customer journey completes on a 390 px phone                                                                                                         | wired                 | Phase 05 + Phase 19 journeys                                         |
| 15  | Cashier and kitchen operational flows live on tablet landscape                                                                                       | wired                 | Phases 09/10 + Phase 19                                              |
| 16  | Super-admin onboarding, subscription and disable flows work                                                                                          | wired                 | Phase 14 + Phase 19                                                  |
| 17  | Realtime liveness and reconnect recovery                                                                                                             | wired                 | `e2e/realtime.test.ts` + Phase 12/17 specs                           |
| 18  | Accessibility baseline (WCAG target) with recorded exceptions                                                                                        | wired + review record | Phase 15 report + standing a11y suite                                |
| 19  | Responsive baseline per device contract                                                                                                              | wired                 | Phase 16 report + responsive suite                                   |
| 20  | State matrix complete (loading/empty/error/offline/partial/forbidden)                                                                                | wired                 | Phase 17 matrix + failure-injection specs                            |
| 21  | Performance budgets measured and met for the customer path                                                                                           | wired                 | Phase 18 measurements                                                |
| 22  | No unexpected console errors, rejections, or failed requests on any route (expected business refusals identified per phase, not counted as failures) | wired                 | Phase 01/17/19 console assertions + per-phase expected-failure lists |
| 23  | No broken routes (every registered path reachable in its shell)                                                                                      | wired                 | Phase 19 route sweep                                                 |
| 24  | Presentation contract intact (no lost assertions)                                                                                                    | wired                 | E2E suite green + migration ledger                                   |

### 13.4 Operations

| #   | Item                                                     | Disposition target | Proof            |
| --- | -------------------------------------------------------- | ------------------ | ---------------- |
| 25  | Error tracking / monitoring decision recorded            | operator or wired  | Phase 20 FR-08   |
| 26  | Support path for production issues documented (who, how) | operator           | runbook addition |
| 27  | Release notes in user terms                              | wired              | Phase 20 FR-12   |
| 28  | Backups/monitoring posture unchanged from spec 018       | operator           | runbook §4       |

Nothing in this checklist may be marked `wired` on the basis of a plan; only artifacts count.

---

## 14. Definition of Done

### 14.1 Per-phase DoD (in addition to §12 gates)

1. The phase's SpecKit artifacts exist: `spec.md` with clarifications recorded, `plan.md` (including
   Design Direction, Contract Consumption, State Matrix, Presentation-Contract Migration, Accessibility
   Plan, Responsive Plan, Evidence Plan), a reviewed custom checklist, `tasks.md` with all tasks checked,
   a pre-implement and post-implement analyze record, and a convergence record.
2. `.specify/feature.json` pointed at the phase's directory during execution and is moved on deliberately.
3. Impeccable artifacts updated: the surface brief with its direction contract; `DESIGN.md` only if the
   system changed (with the change recorded).
4. Exit criteria met as written; any unmet item is explicitly recorded as a residual with an owning phase.
5. Evidence committed or archived per §6.6: test summaries, screenshots at required viewports, detector
   output, measurements.
6. No unrequested scope introduced; every FR traces to a citation (a spec, this plan, or a recorded
   clarification).
7. `docs/` updated where conventions changed (conventions/development/runbook).
8. For every surface the phase implements or redesigns, the Surface Design DoD (§14.2) is satisfied
   for each applicable item — a surface is not "done" on its happy path alone.
9. A single clean commit for the phase after convergence, staging only that phase's artifacts (the
   untracked tool-config directories are left alone).

### 14.2 Surface Design Definition of Done (apply to every product surface a phase implements or redesigns)

Every surface must be checked against this list **where the items apply to that surface** — the
point is to prevent a "happy path = done" declaration, not to force irrelevant states onto
stateless surfaces. A surface may not be declared complete on its happy path alone.

```text
[ ] Surface design brief exists
[ ] Impeccable direction contract exists
[ ] Correct shell/context is defined
[ ] Desktop behavior defined
[ ] Mobile behavior defined (where applicable)
[ ] Loading state
[ ] Empty state
[ ] Error state
[ ] Forbidden / NotAuthorized state (where applicable)
[ ] Success state
[ ] Disabled state
[ ] Keyboard behavior defined
[ ] Focus behavior defined
[ ] Accessible names / semantics defined
[ ] Responsive behavior defined
[ ] Existing E2E presentation contract preserved or intentionally migrated
[ ] No duplicate design-system primitive introduced
[ ] Screenshot/evidence captured (where required)
[ ] Impeccable critique completed
[ ] Impeccable audit completed
[ ] Validation gates pass
```

This checklist is referenced from the per-phase DoD (§14.1 item 8) and is inherited by every
phase's exit criteria for the surfaces it implements or redesigns. Items that genuinely do not
apply to a surface may be skipped with a one-line justification in the phase spec — silence is
not a justification.

### 14.3 Frontend DoD (the whole roadmap)

- Every route in §7.1 is production-quality on its device class, inside the correct shell, with the full
  state matrix, and no placeholder surfaces remain (C1/C2 resolved).
- One design system is in force: tokens only, no duplicated primitives, states and motion consistent
  across all ten surfaces.
- Every existing backend contract is intact: no migration, no RPC signature change, no RLS/RBAC change, no
  generated-type edit, and no client-side authorization assumption introduced anywhere.
- Every pre-existing E2E assertion either still passes or was deliberately migrated with a recorded reason; no
  assertion was deleted or weakened.
- Accessibility, responsive, state, and performance hardening are verified by standing suites, not by prose.
- The product ships from `main` through the existing Cloudflare Pages path with a documented checklist,
  environment matrix, monitoring decision, and rollback procedure.
- Full-catalogue evidence: `npm run verify` green, `npm run test:e2e` green on a freshly seeded database,
  and the Phase 19 validation record + Phase 20 release record committed.

---

## 15. Risks and Mitigations

| #   | Risk                                                              | Why it is real here                                                                                 | Mitigation                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Redesign breaks the E2E contract**                              | ~666 accessible-name assertions, 10 `data-*` hooks, 16 `data-testid`s across 13 suites              | Gate F-G09 with the categorized ledger (A Semantic / B Behavioral / C Test-only / D Storage — §1.3, Phase 01 FR-10); every phase's plan carries a Presentation-Contract Migration section; E2E runs inside each phase's validation gates, not only at the end |
| R2  | **Design drift across 20 phases**                                 | 10 surfaces, multiple agents, long horizon                                                          | Design system in Phase 02 as a hard gate; tokens-only rule; dev gallery; `extract` scheduled in Phases 15/19; F-G10; detector hook already consented                                                                                                          |
| R3  | **Backend contract damage by "helpful" UI work**                  | The frontend already has direct table reads and RPC wrappers; a shortcut could add a write path     | F-G11; §3.4 write posture; db suites mandatory in every phase's gates; contract conflicts recorded instead of implemented                                                                                                                                     |
| R4  | **Authorization creep into the client**                           | Tempting to "just hide" or "just allow" based on predicates                                         | F-G07; guards documented as presentation-only; denial rendering asserted; predicate changes require a spec                                                                                                                                                    |
| R5  | **E2E rate limits / shared fixture collisions**                   | Sign-in 30/5 min per IP, ~14 sign-ins per run, one cloud dev database                               | §12.5 discipline; storage-state reuse; no concurrent phases on E2E; serial fixture files; read-and-reject default                                                                                                                                             |
| R6  | **Scope creep into out-of-scope product**                         | Payments, bill splitting, exports, notifications vendors are all "obvious next features"            | §7.3 list; constitution I/VIII; every FR must cite; clarify questions capture the refusal explicitly                                                                                                                                                          |
| R7  | **Mobile quality treated as a breakpoint pass**                   | The customer path is the revenue path and is mobile-first in reality                                | Phase 04/05 design at 390 px first; Phase 16 device contracts; Phase 19 runs phone journeys                                                                                                                                                                   |
| R8  | **Accessibility deferred to the end**                             | Historically the pattern in this repo (labels only, no tooling)                                     | Phase 01 installs tooling from day one; Phase 15 audits; F-G12 applies per phase; Phase 19 re-verifies                                                                                                                                                        |
| R9  | **Performance claimed without measurement**                       | 016 already set budgets and honesty rules for the backend                                           | Phase 18 requires recorded measurements; no speculative optimization; budget assertions only where deterministic                                                                                                                                              |
| R10 | **State hardening becomes polish-only**                           | "Add a spinner" is the cheap version of this work                                                   | Phase 17's deliverable is the recorded state matrix per route with failure-injection tests                                                                                                                                                                    |
| R11 | **Impeccable pushes a new visual world mid-roadmap**              | Later phases may prefer a "better" direction                                                        | FA-5; redesign only via a design-system amendment or explicit owner decision; direction contracts are the authority; refinement preserves identity by default                                                                                                 |
| R12 | **Agent invents unsupported functionality to satisfy a bullet**   | The task lists (POS, split bills, payment) invite invention                                         | §3.8 C4–C6; the master plan's out-of-scope list; analyze catches uncited FRs                                                                                                                                                                                  |
| R13 | **Parallel phases contend on files, docs, and the design system** | Waves D–F allow parallel work; Phases 09/10 and the 15–17 hardening chain are sequential by default | §11 collision rules; one phase owns each doc at a time; design-system amendments are explicit tasks                                                                                                                                                           |
| R14 | **Impeccable artifacts bloat the repository or leak dev context** | Screenshots and comps are heavy; direction contracts must never ship in the bundle                  | §6.6 ignore policy; never copy direction contracts into source or browser-delivered artifacts (Impeccable's own rule)                                                                                                                                         |
| R15 | **Phase bloat / long unattended runs**                            | 20 phases is a long road                                                                            | Each phase is independently verifiable and produces a shippable increment; waves allow parallel work where safe; a phase may only be marked complete on evidence                                                                                              |

---

## 16. Recommended Execution Order

Start with **Phase 01**, then **Phase 02**, then **Phase 03** — sequentially, alone. After that, use
waves, keeping the critical path (§10) in mind — with Phases 09→10 and the hardening chain
15→16→17 sequential by default; parallel execution there requires explicit owner authorization
with an accepted reconciliation cost.

| Order | Phase                                        | Runs with | Why in this position                                                                                                                |
| ----- | -------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 01 Foundation & architecture baseline        | —         | Everything else consumes its tooling and ledger                                                                                     |
| 2     | 02 Design system & visual language           | —         | Hard gate for all surfaces; Impeccable enters here                                                                                  |
| 3     | 03 Application shell, navigation & global UX | —         | Shell is the mount point for every route                                                                                            |
| 4     | 04 Auth, account & customer entry UX         | 06        | Both are entry surfaces; disjoint files                                                                                             |
| 5     | 05 Customer ordering UX                      | 07        | Revenue path first on the critical path                                                                                             |
| 6     | 06 Management UX _or_ 07 Menu UX             | 05 / 06   | Management thread can advance while ordering lands                                                                                  |
| 7     | 08 Tax configuration UX                      | 09 or 10  | Management thread tail; forms benefit from 07's editor patterns                                                                     |
| 8     | 09 Cashier operations UX                     | —         | Operations substrate; runs before 10 by default (both edit staffOps)                                                                |
| 9     | 10 Kitchen display UX                        | —         | Follows 09 sequentially by default; parallel only with an explicit owner partition of staffOps files + accepted reconciliation cost |
| 10    | 11 Channel UX                                | —         | Refines 05/09/10 after they exist                                                                                                   |
| 11    | 12 Realtime, notifications & subscription UX | 13 or 14  | Needs live surfaces; 13/14 are independent                                                                                          |
| 12    | 13 Reports, audit & void log UX              | 14        | Needs the void flow (09) and the audit trail                                                                                        |
| 13    | 14 Platform console UX                       | 13        | Needs the platform shell (03) and Phase 12's subscription vocabulary (not all of Phase 12)                                          |
| 14    | 15 Accessibility hardening                   | —         | Every surface must exist before it is audited; hardening chain starts here                                                          |
| 15    | 16 Responsive & device hardening             | —         | Sequential after 15 by default (same components)                                                                                    |
| 16    | 17 State, error & offline hardening          | —         | Sequential after 16 by default (same components)                                                                                    |
| 17    | 18 Performance & perceived speed             | —         | Measures the finished product                                                                                                       |
| 18    | 19 Frontend E2E validation                   | —         | The dress rehearsal                                                                                                                 |
| 19    | 20 Production readiness & release            | —         | Ship it                                                                                                                             |

### 16.1 What to do first (the next action, when this plan is approved)

1. Read `.specify/memory/constitution.md`, `docs/conventions.md`, this document's §6 and §12.
2. Set `.specify/feature.json` to `specs/021-frontend-foundation` and run the full SpecKit pipeline for
   Frontend Phase 01, resolving its clarify questions through `ask_questions` (WCAG target, viewports,
   dependency approval, 404 behavior).
3. Stop at Phase 01's exit criteria. Do not start Phase 02 in the same execution without the owner's go-ahead —
   Phase 02 begins with `$impeccable init`, which asks product questions a human must answer.

### 16.2 What this plan does not decide (deliberately)

Design values (colors, type, spacing, motion), the visual direction, brand assets, copy rewrites, and the
final device matrix are decisions for the phases that own them — each with its own clarify step and its own
recorded answer. This plan fixes _order, contracts, gates, and boundaries_; it does not pre-empt craft.

---

**End of plan.** Nothing in this document is implemented. Phase 01's only next step is SpecKit
`specify`, and Phase 02 does not start until the owner approves what `$impeccable init` returns.
