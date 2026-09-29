# Phase 04 — Implementation Plan

**Feature dir:** `specs/024-auth-and-customer-entry-ux` · **Baseline:** `b14ad19` · **Date:** 2026-09-28

## Routes

| Route | Change | Files |
| --- | --- | --- |
| `/` | Placeholder → real public landing (C2/Q1). h1 `RestoPilot` PRESERVED. | `RootPage.tsx` (+ `.module.css`) |
| `/order/:branchId` | Placeholder → `<Navigate to={/?branch=…} replace>` (C1/Q2). | `OrderPage.tsx` |
| `/signin` | Restyle on Phase-02 primitives; semantics frozen. | `SignInPage.tsx` (+ `.module.css`) |
| `/reset-password` | Restyle on primitives; flows frozen. | `ResetPasswordPage.tsx` (+ shared css) |
| `/account/password` | Restyle on primitives; verify-then-update frozen. | `ChangePasswordPage.tsx` |
| `/r/:slug` | Re-skin the progressive entry (RestaurantEntry) with identity header + join guidance + mobile ergonomics. | `RestaurantEntry.tsx`, new `EntryWizard` support components |

Route titles (`src/app/routes.ts`): `/` description updated to the landing purpose; `/order/:branchId` description updated to "redirects to the landing with guidance". Titles for the other routes unchanged (h1s unchanged → route.titles suite unaffected except those two descriptions which the suite does not assert).

## Components

- `AuthCard` (`src/components/auth/AuthCard.tsx` + css): the credential surfaces' wrapper — CustomerShell composition, centered max-measure column, brand-consistent header slot. Used by SignIn/Reset/ChangePassword.
- `EntryWizard` support (`src/features/session/components/entry/`): `ChannelSelector` (fieldset/legend + one-liners), `CustomerShellHeader` (name + brand_description lead), `SessionJoinNotice` (the Q4 guidance under the table picker). `RestaurantEntry.tsx` stays the state owner (single source of the existing logic) and composes these for presentation — logic untouched, presentation re-skinned (lowest-risk split honoring frozen labels).
- No new deps. All styles = CSS modules consuming tokens only.

## State / data flow

- Entry: unchanged (usePublicRestaurant → conditional sections → enterMutation/channelMutation → navigate to menu). The only new UI state is presentational (no new storage).
- `/order/:branchId`: pure `<Navigate>`; the branch id echoes via `?branch=`; `/` reads `location.search` ONLY to acknowledge the deep link (no fetch — no such contract).
- Sign-in/recovery/reset/change: untouched flows.

## Backend contracts used

`get_public_restaurant`, `open_session_at_table`, `open_session_channel`, `current_auth_context`, `authClient.*` — all existing. **NOT_REQUIRED** backend change.

## Responsive behavior

- Entry: 390 px first — single column (CustomerShell's existing 34rem max), ≥ 44 px control targets (token-based sizing), sticky primary action (css `position: sticky; bottom: 0` on the action row within the form), no horizontal scroll (responsive.smoke already scans `/r/demo-restaurant`).
- Credential surfaces: centered max-measure (AuthCard), full-bleed on mobile.
- Staff shell untouched.

## Accessibility

- `autocomplete` attributes: email/current-password/new-password on the credential forms (already present — preserved); name → `autocomplete="name"`, phone → `autocomplete="tel"` + `inputMode="tel"` on entry (new, additive).
- Channel fieldset/legend preserved + per-option one-line descriptions inside labels.
- Failed client-side submit moves focus to the first invalid field (`ref` map in RestaurantEntry; additive, no behavior change to messages).
- Heading order: h1 on every surface (restaurant name / Staff sign-in / Password recovery / Reset your password / Account password / RestoPilot).
- axe scans extended to `/r/blue-olive`; existing `/`, `/signin`, `/reset-password` scans continue.

## Loading / empty / error states

- Entry: pending label + disabled (existing), not-found section (existing, frozen text), refused submission renders the verbatim message (existing) — all preserved; the re-skin keeps every role (`alert`, `status`).
- Credential surfaces: all existing states preserved verbatim (they are the contract).

## Testing strategy

1. **Unit (new)** `tests/unit/routes-decisions.test.tsx`: `/` renders h1 RestoPilot + staff sign-in link + QR guidance (and ignores unknown query params safely); `/order/:x` navigates to `/?branch=x`; SignIn recovery-mode copy pin; SessionJoinNotice copy pin.
2. **E2E migrations** `e2e/routes.test.ts`: `/order/demo-branch` → expectURL `/?branch=demo-branch` (was h1 'Order'); `/r/demo-restaurant` heading 'Restaurant not found' for the unknown demo slug — ALREADY the case today? (routes.test pins 'Restaurant' heading via regex — verify at implementation; migrate if needed, recorded).
3. **E2E new** `e2e/entry.mobile.test.ts` (or extend session.surfaces): 390×844 completion of the full dine-in flow; no horizontal overflow; sticky action visible.
4. **E2E axe**: `a11y.baseline` gains `/r/blue-olive` scan (baseline updated only if the page has pre-existing violations — target: zero).
5. **Existing suites green**: auth.routes, session.surfaces, smoke, responsive.smoke, route.titles, shell, a11y, console specs.

## Design strategy

Trust-forward/restrained (Operate): AuthCard = neutral surface, single accent on the primary button, generous spacing tokens, no decoration. Persuade (entry): restaurant identity leads (large h1, brand line), form fields full-width with 16px+ text, sticky CTA. Everything through existing tokens — no new colors.

## Risks

- R: the `/r/demo-restaurant` routes.test pin uses a regex heading ('Restaurant') which matches BOTH 'Restaurant entry'… verify against the real page ('Restaurant not found' for unknown demo slug) and migrate exactly once, recorded.
- R: sticky CTA must not cover the alert region at submit — action row is `sticky bottom`, alert sits above it in flow (verified at 390 px screenshot).
- R: focus-on-invalid must not double-announce with role=alert (focus moves, alert text unchanged — acceptable, standard pattern).

## Tasks order

T001 unit route decisions → T002 AuthCard + credential re-skins → T003 entry components + re-skin → T004 C1/C2 routes + routes.ts meta + routes.test migration → T005 mobile/axe/console E2E → T006 evidence screenshots → T007 gates + convergence → T008 checkpoint/report.
