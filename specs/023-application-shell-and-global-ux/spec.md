# Feature Specification: Application Shell, Navigation & Global UX Infrastructure (Frontend Phase 03)

**Feature Branch**: `023-application-shell-and-global-ux`

**Created**: 2026-09-27

**Status**: Clarified

**Input**: Frontend Master Plan §8 Phase 03 — "Replace the placeholder top bar with real
experience shells: staff/platform chrome (sidebar + header + restaurant/branch context) and a
lightweight customer shell; plus the global UX infrastructure every later surface assumes."

**Authorities**: RestoPilot-Frontend-Master-Plan.md §4 FA-15 (shell bounds, mandatory), §8 Phase 03
(FR-01…FR-12); `.specify/memory/constitution.md` (IV server-enforced authorization);
`docs/frontend-presentation-contracts.md` (≈666 E2E expectations); Phase 02 design system.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — The right chrome for the right experience (Priority: P1)

A signed-in staff member lands in a staff shell (sidebar + header, dense) with navigation that
shows only what their effective roles permit; the platform super admin gets the same shell with a
platform nav group; an anonymous customer on `/r/:slug` and `/r/:slug/menu` gets a lightweight
mobile-first customer shell with no staff chrome. No surface renders both shells. Sign-out and
account-password stay one click away in the shell header.

**Why this priority**: the shell is the container every later surface assumes; wrong shell
selection or role leakage breaks FR-008/FA-15.

**Independent Test**: visit routes across the seeded personas (owner, branch manager, cashier,
kitchen, super admin, anonymous) and assert shell type, nav presence/absence, and landmarks
(one `main`, skip link first, `aria-current` on active items).

**Acceptance Scenarios**:

1. **Given** each seeded staff persona, **When** they visit any `/dashboard/**` route, **Then**
   the staff shell renders with exactly the nav entries their predicates permit (kitchen never
   sees Sessions/Rounds/Reports; cashier never sees Reports/Tax/Menu) and `aria-current="page"`
   marks the active entry.
2. **Given** the platform super admin, **When** they visit `/admin/**`, **Then** the staff shell
   renders with the platform nav group (not restaurant management entries).
3. **Given** an anonymous guest on `/r/:slug/menu`, **When** the page renders, **Then** the
   customer shell renders (no sidebar, no staff nav) with the single-column layout.
4. **Given** any route, **When** rendered, **Then** exactly one `<main>` landmark exists and the
   skip link remains the first tabbable element targeting it.

### User Story 2 — Context switches in one place (Priority: P1)

An owner with two restaurants switches restaurant/branch context from the shell's context
switcher; the selection persists across routes within the session; branch-scoped members see
only their branch; the switcher derives every option from the existing effective context +
policy-scoped `branches` read (no new data access).

**Why this priority**: FR-03 is the shell's only new state; deriving it wrongly would leak
tenant names (Security constraint).

**Independent Test**: unit tests on the switcher resolution (options per persona, invalid ids
ignored, "All branches" owner-only); E2E switches context and navigates — selection persists.

**Acceptance Scenarios**:

1. **Given** an owner of two restaurants, **When** they switch restaurant in the shell, **Then**
   the branch options re-derive and the selection persists across navigation.
2. **Given** a branch-scoped member, **When** the switcher renders, **Then** only their assigned
   branch appears (no "All branches").
3. **Given** a `?restaurant=` / `?branch=` URL parameter (where already used), **When** present,
   **Then** the existing pages' behavior is preserved verbatim (their own selects stay the
   contract — Clarification Q2).

### User Story 3 — The dashboard becomes a home, not a wall of lists (Priority: P2)

A signed-in staff member sees a real home on `/dashboard`: who they are, their effective context,
role-appropriate operational shortcuts (the nav model), and their scope; the create-restaurant
bootstrap panel stays exactly as-is for membership-less profiles. The context selects
(`dashboard-restaurant` / `dashboard-branch`) and scope lists stay asserted-by-E2E.

**Why this priority**: FR-04 restructures the most-visited surface; the E2E persona matrix
asserts its pieces.

**Independent Test**: E2E sign-in per persona → land on `/dashboard` → heading + shortcuts +
branch links visible; kitchen persona sees no cashier shortcuts.

**Acceptance Scenarios**:

1. **Given** each persona, **When** `/dashboard` renders, **Then** the h1 stays "Staff Dashboard"
   and the operational shortcuts match the nav model (same predicate matrix).
2. **Given** the membership-less profile (Fiona), **When** `/dashboard` renders, **Then** the
   create-restaurant panel renders unchanged (E2E `management.surfaces` unchanged).

### User Story 4 — Global UX infrastructure works everywhere (Priority: P1)

Async mutation outcomes surface a polite toast (info/success/warning/danger) while verbatim
inline errors stay (both); destructive actions confirm through the `ConfirmDialog` primitive with
the same two-step semantics and button names E2E asserts; an offline/reconnect banner driven by
realtime channel status + `navigator.onLine` offers a manual retry that refetches active queries;
signed-out/expiry lands on `/signin` with return-to and a friendly message; `NotAuthorized`
explains what the account lacks without disclosing tenant data.

**Why this priority**: these are the global behaviors every surface phase assumes.

**Independent Test**: unit + E2E on banner states (offline/reconnecting/recovered), toast
announcement (polite live region), confirm-dialog wrapping with existing button names preserved,
signed-out redirect with return-to (existing suite), NotAuthorized content.

**Acceptance Scenarios**:

1. **Given** a mutation success, **When** it completes, **Then** a toast announces politely AND
   the existing inline success text still renders (Q3: accompany, never replace).
2. **Given** every destructive action (session close, void, membership removal, subscription
   disable), **When** triggered, **Then** the two-step flow runs through the confirm dialog with
   the SAME accessible button names E2E asserts (Q4: names are contracts).
3. **Given** the realtime channel errors or the browser goes offline, **When** the banner
   renders, **Then** it shows the offline/reconnecting state; on recovery it shows recovered and
   its manual retry refetches active queries (Q5: banner source = channel status + onLine).
4. **Given** a signed-out identity hitting a guarded route, **When** redirected, **Then** the
   existing return-to behavior is preserved plus a friendly expired-session message.

## Clarifications (Q1–Q6, resolved 2026-09-27 from repository contracts)

- **Q1 Nav item ordering per role** → One canonical order for all roles: Dashboard, Sessions,
  Rounds, Kitchen, Branches, Staff, Restaurant, Menu, Tax, Reports, Void log, Audit, Profile —
  filtered per persona (visibility ≠ order). Operational items (sessions/rounds/kitchen) lead
  because the cashier/kitchen personas land there for their shift (User Story: "land on the
  operational surface relevant to my shift").
- **Q2 Do the page-level context selects move into the shell?** → **No.** `getByLabel('Restaurant')`
  / `getByLabel('Branch')` are E2E contracts on six surface pages. The shell gains a
  `ContextSwitcher` that persists restaurant/branch context across routes via
  `sessionStorage` (per-session UX state) and the `?restaurant=`/`?branch=` URL convention
  **stays where already used** (the pages keep their own selects untouched). The switcher is
  the global affordance; the page selects remain the per-page contract. No duplication of
  accessible labels on the same page (the switcher uses distinct labeling: "Context").
- **Q3 Do toasts replace inline success text?** → **No — accompany.** Several E2E suites assert
  `role="status"` success messages inline. Toasts add announcement for outcomes that today are
  silent or inline-only; inline text is never removed in this phase.
- **Q4 Confirm-dialog adoption vs the two-step inline buttons** → The dialog wraps the two-step
  semantics: first click opens the `ConfirmDialog` whose confirm button carries the SAME name the
  inline second button had (e.g. "Confirm closing T1"), so E2E assertions hold with a migrated
  *dialog role* but unchanged names. Recorded as a deliberate presentation migration per
  F-G09/FA-8 (names preserved, role region changes).
- **Q5 Offline banner trigger source** → The realtime channel status (`CHANNEL_ERROR` /
  `TIMED_OUT` surfaced from the existing binding) OR `navigator.onLine` flips, whichever reports
  first; recovery on `SUBSCRIBED` + `online`. The binding's status callback grows an optional
  consumer without changing the invalidation semantics (FA-2 untouched).
- **Q6 Membership-less bootstrap placement** → Stays ON `/dashboard` exactly as today
  (`management.surfaces` E2E asserts Fiona's dashboard renders the creation panel); the shell
  renders around it. No separate onboarding route in this phase.

## Requirements

### Functional Requirements

- **FR-01** Two shells selected by route group: `CustomerShell` for public/customer routes
  (`/r/**`, `/order/**`, `/` stays dual-purpose per C2-deferred) and `StaffShell` for
  `/dashboard/**` + `/admin/**` (platform = staff shell variant with its own nav group). Public
  credential routes (`/signin`, `/reset-password`, `/account/password`) render the customer shell
  without nav links. Shell selection lives in one declaration point; no surface renders both.
- **FR-02** One navigation-model declaration point (`src/app/navigation.ts`): the canonical item
  list with, per item, its route, label, and the predicate (from the existing
  `useAuthContext` predicates + membership lookups) that decides visibility. Both the sidebar and
  the dashboard home shortcuts and the mobile drawer consume it — never a second list.
- **FR-03** `ContextSwitcher` in the staff shell header: restaurant options grouped from
  effective memberships; branch options from the existing policy-scoped `branches` read for the
  selected restaurant; "All branches" owner-only; selection persisted (sessionStorage, key
  `restopilot.dashboard-context`) and re-applied across routes; invalid/cross-tenant ids ignored
  (fall back to first valid). Security: options come only from what the caller may read; no
  tenant identifiers render for out-of-scope choices.
- **FR-04** `DashboardPage` restructured into a real home: h1 "Staff Dashboard" (contract),
  context summary (who + selected context), operational shortcut tiles from the navigation model,
  branch links (per scope), scope list, SubscriptionBanner + DashboardLiveCue preserved, and the
  CreateRestaurantPanel preserved verbatim for membership-less profiles (Q6).
- **FR-05** Toast adoption for async outcomes that are today inline-only or silent: success/
  error/info via `useToast` at the shell level; verbatim inline errors and existing inline
  success text are NOT removed (Q3). Toast host renders inside the shell (no layout shift —
  fixed position).
- **FR-06** `ConfirmDialog` adoption for the destructive actions (session close, void, membership
  removal, subscription disable) with the two-step semantics and existing confirm-button names
  preserved verbatim (Q4); the first step's button keeps its current name; the dialog's confirm
  button keeps the second step's name. Each adoption site records the (unchanged) names in the
  phase migration list.
- **FR-07** `OfflineBanner` at the shell top: states offline / reconnecting / recovered;
  triggered by realtime channel error/timeout OR `!navigator.onLine`; recovery on SUBSCRIBED or
  `online`; a manual "Retry now" button refetches active queries (`queryClient.refetchQueries`).
  The realtime binding grows an optional `onStatus` consumer (FA-2 semantics unchanged).
- **FR-08** Session-expiry handling: the existing signed-out redirect with return-to stays; the
  sign-in surface shows a friendly "Your session ended" note when the redirect resulted from an
  expiry/signed-out event (not a cold visit) — without changing the auth flow (Phase 04 owns it).
- **FR-09** Mobile navigation drawer (mobile viewport < 1024px): the nav model renders in a
  `Drawer` from the shell header's menu button; focus trap/restore via the Phase 02 primitive;
  `aria-current` preserved inside the drawer.
- **FR-10** Route titles: Phase 01's registry/RouteTitles continue to apply per surface —
  unchanged architecture, no new titles for shell chrome.
- **FR-11** `NotAuthorized` restyled with the Phase 02 vocabulary (heading "Not authorized" is an
  E2E contract): explains the account lacks the required role/access and how to get it
  (contact the restaurant owner) without revealing tenant names or role inventories.
- **FR-12** No surface renders both shells; the shell renders exactly one `<main>` landmark
  (the customer shell's and staff shell's mains are theirs); skip link targets `#main` as today;
  `aria-current="page"` on the active nav item everywhere the nav renders.

### Presentation-Contract Constraints (must not regress)

- ≈666 accessible-name expectations; the persona nav assertions
  (`kitchenPage.getByRole('link', { name: 'Sessions' })` count 0; dashboards' link sets),
  `getByLabel('Restaurant')` / `getByLabel('Branch')` per-page selects, "Staff Dashboard" h1,
  "Not authorized" heading, two-step confirm names, SubscriptionBanner `data-banner-state`, and
  the DashboardLiveCue rendering are contracts. The migration list (deliberate presentation
  changes) is recorded in the phase report — currently: confirm flows gain a `dialog` role with
  unchanged button names; the nav moves from the dashboard page into the shell (same link names,
  new `aria-current`).
- The ledger (`docs/frontend-presentation-contracts.md`) is updated in the same change for any
  selector whose region changes.

### Edge Cases

- A member whose memberships change mid-session (removed while browsing): the next action's RPC
  refuses; the context refetch drops the membership; the switcher falls back to the remaining
  valid context; a toast explains; the denial view renders for the stale route.
- The switcher's persisted context references a deleted/foreign id: invalid ids are ignored and
  the first valid membership wins (never a foreign tenant name).
- Offline during a context switch: the switcher's branch read fails — the switcher keeps the
  current selection and surfaces the banner state; no silent empty options.
- Kitchen persona deep-linking to cashier surfaces: unchanged denial semantics (the shell's nav
  absence is presentation; the guard/rpc denial is the boundary).
- Toasts stacking with a destructive dialog open: toasts never steal focus; the dialog stays
  modal (z-order: toast above dialog visually per tokens, but non-blocking).

## Review & Acceptance Checklist

Gate checks sourced from `specs/023-application-shell-and-global-ux/checklists/requirements.md`.

## Dependencies

- Phase 02 primitives (Button, Drawer, Dialog/ConfirmDialog, Toast/useToast, StatusPill, Icon,
  Stack/Grid) and Phase 01 tooling (axe/console/viewport E2E, route titles).
- Existing: `useAuthContext`, `guards.tsx`, `authClient.signOut`, the policy-scoped `branches`
  read, realtime binding, SubscriptionBanner, DashboardLiveCue.

## Out of Scope

- No auth flow changes (Phase 04), no surface feature work (Phases 04–14), no API/RPC changes,
  no new business data reads beyond the existing context/branches reads, no path changes
  (C1/C2 in Phase 04), no dashboard-home data fetching beyond what exists.
