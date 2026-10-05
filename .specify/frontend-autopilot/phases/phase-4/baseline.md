# Phase 04 — Baseline (INSPECT)

**Date:** 2026-09-28 · **HEAD:** `b14ad19` (feat 023 pushed) · working tree clean (tracked)

## What exists today (the phase's surfaces)

| Surface | File | State |
| --- | --- | --- |
| `/signin` | `src/routes/SignInPage.tsx` (207 ln) | Full: sign-in + recover mode-switch, generic failure, return-to, expired note, awaiting-context landing logic. Semantics frozen (spec 020) — this phase restyles, not re-flows. |
| `/reset-password` | `src/routes/ResetPasswordPage.tsx` (136 ln) | Full: PASSWORD_RECOVERY event + session fallback, match check, generic failure, post-success guidance. |
| `/account/password` | `src/routes/ChangePasswordPage.tsx` (144 ln) | Full verify-then-update flow (spec 020, frozen). |
| `/r/:slug` entry | `RestaurantPublicPage` → `features/session/components/RestaurantEntry.tsx` (~290 ln) | Full single-page wizard already: payload → branch (auto-skip single) → channel fieldset → table/address → name/phone; client bounds mirror RPC; server refusals verbatim; open-or-join via `open_session_at_table` / `open_session_channel`. |
| `/` root (C2) | `RootPage.tsx` (8 ln placeholder) | h1 "RestoPilot" + placeholder paragraph. Asserted by routes.test (heading), smoke (main/nav), responsive (no overflow), a11y.baseline (scan), route.titles. |
| `/order/:branchId` (C1) | `OrderPage.tsx` (11 ln placeholder) | h1 "Order". Asserted by routes.test + route.titles. |

## Key contracts (read, not assumed)

- `get_public_restaurant(p_slug)` (session_rpcs §1): restaurant {id,name,slug,brand_description} + branches with ACTIVE tables only. No logo/imagery field exists — brand presentation = name + brand_description (seed: "Wood-fired Mediterranean plates in a former harbour warehouse."). **Absence of brand assets is a fact to state, not invent (Master Plan Q).**
- `open_session_at_table` (§2): open-or-join + token; "A session is already open at this table. Join it instead." only on lost race. Validation chain messages verbatim-mirrored client-side.
- `sessionClient.ts`: SessionResult mapping (P0001 verbatim, 42501 denial, else retry), `SESSION_TOKEN_KEY` frozen.
- `authClient`: signIn/requestPasswordReset/completePasswordReset with generic-message wrappers — no changes allowed to semantics.

## E2E pins touching this phase's routes

- `routes.test.ts`: `/`→h1 'RestoPilot', `/r/demo-restaurant`→'Restaurant', `/order/demo-branch`→'Order', `/signin`→'Staff sign-in'.
- `smoke.test.ts` (023): `/` main visible, navigation count 0.
- `responsive.smoke.test.ts`: `/`, `/r/demo-restaurant`, `/signin`, `/reset-password`, `/account/password` no horizontal overflow.
- `a11y.baseline.test.ts`: axe scans `/`, `/signin`, `/reset-password`, `/dashboard`.
- `route.titles.test.ts`: includes `/` and `/order/:branchId`.
- `session.surfaces.test.ts`: full entry flow (labels Branch/Table/Your name/Phone number, button 'Join the table', h1 restaurant name, indicator `Blue Olive · Downtown · Table T3`), validation feedback, tampered/closed token, single/serial file behaviors.

## Design system available (phase 02/03)

Tokens (`--color-*`, `--space-*`), primitives (Button, Field/Input, Alert/role=status, Dialog, Drawer, Toast region, StatusPill, Card), shells from 023. CSS modules consume tokens only (FR-07 of 022).

## Working conclusions carried into SPECIFY/CLARIFY

1. C2 (`/`): neutral public landing — h1 'RestoPilot' preserved + one-paragraph purpose + two CTAs (Find your restaurant's page → how-to note since no directory exists; Staff sign in → `/signin`). Keeps all 5 pinning suites; zero invented features.
2. C1 (`/order/:branchId`): redirect deep-link. Server has NO branch→restaurant public lookup, and Master Plan C1 explicitly offers redirect as an option. Redirect to `/` with a `?branch=` param note (client can't resolve restaurant without an unauthorized backend addition) — routes.test's '/order/demo-branch' h1 pin migrates deliberately (recorded per F-G09).
3. Entry wizard: keep the single-page progressive form (it already satisfies "one decision per screen" structurally via conditional sections + it preserves every verbatim E2E name). A stepped wizard would break ~8 pinned assertions for zero contract gain — rejected in clarify.
4. Join-session affordance: open-or-join is server-side; the client adds a visible notice when the RPC returns an existing session. The EntryPayload does NOT currently distinguish joined vs created → detect via `payload.session.opened_at` age is fragile; better: `sessionClient` gains a flag? NO — parseEntry shape is contract-pinned. Alternative: `open_session_at_table` response has no 'joined' flag → the honest affordance is a PRE-submit notice on the table picker when the branch payload shows… the payload has no open-session data either. → The affordance becomes the copy under the table select: "If a session is already open at your table, you'll join it as a new participant." (FR-06 'affordance + guidance preserved' — guidance is the honest implementable half; recorded as a clarify decision.)
