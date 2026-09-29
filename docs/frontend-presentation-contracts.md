# RestoPilot — Frontend Presentation Contracts (the Ledger)

**Spec:** `specs/021-frontend-foundation` FR-10 · **Generated from:** `e2e/**` + `src/**` on 2026-09-27 at commit `b569215`+phase-01 work · **Master Plan gate:** F-G09

This ledger enumerates every E2E-asserted presentation hook and its stability category. It is the migration rule-book every UI phase reads **before** touching markup. Nothing here may be weakened or deleted; anything may be _migrated deliberately_ under the change discipline below.

## How to regenerate (do not hand-append from memory)

```bash
# Category A — accessible-name assertion volume per locator type
grep -rhoE "getByRole|getByLabel|getByText" e2e --include="*.ts" | sort | uniq -c

# Category B — data-* state hooks (src assignments; e2e selectors)
grep -rhoE "data-(round|kitchen|ticket|audit|bill|voided|banner)[a-z-]*=" src --include="*.tsx" | sort -u
grep -rhoE "\[data-(round|kitchen|ticket|audit|bill|voided|banner)[a-z-]+" e2e --include="*.ts" | sort -u

# Category C — test-only hooks
grep -rhoE "data-testid=\"[^\"]+\"" e2e src --include="*.tsx" --include="*.ts" | sort -u

# Category D — storage keys
grep -rhoE "restopilot\.(session-token|cart)" e2e src tests | sort -u
```

After any UI phase: re-run the recipes, diff against this file, and record every intentional change in the phase spec (gate F-G09).

## Category A — Semantic contract (highest stability)

Accessible names, labels, roles, headings, live regions, and tested focus behavior. Asserted by **~666 E2E locators** (current exact counts: **387 × `getByRole`**, **166 × `getByLabel`**, **128 × `getByText`** — measured across the 13 suites in `e2e/`).

Representative asserted names (non-exhaustive; the suites are the source of truth):

| Surface       | Asserted names (examples)                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Global        | heading `RestoPilot` (/), nav label `Application areas`, `Account password`, `Sign out`, `Signing out…`         |
| Auth          | `Staff sign-in`, `Email`, `Password`, `Sign in`, `Password recovery`, recovery-mode copy                        |
| Guards        | `Not authorized` (explicit denial — rejected, never hidden)                                                     |
| Dashboard     | `Staff Dashboard`, branch/role navigation labels per role                                                       |
| Staff ops     | `Show bill`, two-step confirms (`Close session for T1` → `Confirm closing T1`), round/ticket transition buttons |
| Platform      | `Super Admin`, console headings, `Never activated` subscription posture text                                    |
| Customer      | `Restaurant` entry heading, `Order` placeholder heading, menu/cart labels                                       |
| Reports/audit | `Report aggregates` region names, void-log empty-state text                                                     |

Live regions: **54 × `role="alert"`** and **13 × `role="status"`** (+ 1 `role="note"`) across `src/**` — server refusal text renders verbatim in alerts (FA-7).

**Change discipline:** preserve; or migrate deliberately — (1) documented in the phase spec, (2) paired test updated in the same commit, (3) justified, (4) validated. Never weakened, never deleted.

## Category B — Behavioral contract (high stability)

`data-*` state hooks encoding lifecycle/staleness assumptions. Assigned in `src/**`, asserted in `e2e/**`:

| Hook                     | Values asserted                                        | Suites                                                                                       |
| ------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `data-round-state`       | `new` `accepted` `preparing` `ready` `lock`            | full-journey, session.surfaces, reports.surfaces, realtime, kitchen.cashier, bill.void.audit |
| `data-round-id`          | round UUID                                             | realtime, bill.void.audit                                                                    |
| `data-ticket-state`      | `accepted` `preparing` `ready` (never `lock`)          | full-journey, realtime                                                                       |
| `data-voided`            | `true`                                                 | reports.surfaces, bill.void.audit                                                            |
| `data-audit-action`      | `round.void`                                           | bill.void.audit                                                                              |
| `data-bill-voided-round` | round UUID                                             | bill.void.audit                                                                              |
| `data-banner-state`      | `expired` `disabled` (subscription banner)             | platform.surfaces                                                                            |
| `data-kitchen-column`    | kitchen column state (src; asserted via ticket states) | kitchen.cashier                                                                              |
| `data-bill-round`        | bill round linkage (src)                               | session.surfaces                                                                             |

**Change discipline:** same as Category A — these encode lifecycle state machines the server owns; the DOM markers mirror them exactly.

## Category C — Test-only contract (enumerated, movable with paired updates)

`data-testid` hooks — test-internal identifiers, 16 distinct:

`audit-table`, `bill-address`, `bill-grand-total`, `bill-participants`, `bill-voided-section`, `platform-overview`, `qr-code`, `qr-entry-url`, `report-aggregates`, `report-best-sellers`, `report-channels`, `report-comparison`, `session-bill`, `subscription-banner`, `void-log-empty`, `void-log-table`

**Change discipline:** more movable than A/B, but never removed without a same-commit test update; renames are recorded in the phase spec.

## Category D — Storage contract (frozen)

| Key                            | Contents                                                              | Freezing gate                                                           |
| ------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `restopilot.session-token`     | customer session token (customer identity)                            | asserted across auth/session suites                                     |
| `restopilot.cart`              | customer cart lines                                                   | asserted by order/cart suites                                           |
| `restopilot.dashboard-context` | ContextSwitcher selection `{restaurantId, branchId}` (sessionStorage) | asserted by `e2e/shell.test.ts` (phase 023) — persistence across routes |

**Change discipline:** the first two rows are frozen for the entire frontend plan. No phase may rename or repurpose them; a rename is a cross-cutting contract change requiring an owner-approved spec amendment (Master Plan §3.7). The dashboard-context row is phase-023-added: same discipline from its introduction.

## Phase 023 presentation migrations (F-G09/FA-8: names preserved, role/region changed)

Recorded per the phase-023 spec's migration-list requirement — every row preserves the assertion's TEXT while moving its ROLE or surface:

| Surface                                                          | Before (phase ≤ 022)                                                         | After (023)                                                                                                                                                                                                    | Migrated suites                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Global navigation                                                | AppShell `navigation` landmark on every route                                | Removed: StaffShell sidebar + mobile Drawer carry the model; `/` renders CustomerShell with NO nav (smoke contract: `main` visible, `navigation` count 0)                                                      | smoke, responsive.smoke, route.titles consumers                             |
| Dashboard shortcut tiles                                         | visible-text links (names collided with nav labels under substring matching) | same routes behind `aria-label`s from the `SHORTCUT_ARIA` map ('Your staff home', 'Table oversight across branches', 'The order operations queue', 'The preparation ticket board'); visible text `aria-hidden` | navigation tests, session/management suites                                 |
| Shell context labels                                             | page-level "Restaurant"/"Branch" selects doubled in the header               | switcher labeled "Viewing — Where" / "Viewing — Scope" (ids `context-restaurant`/`context-branch`; NO shell label may contain "Restaurant"/"Branch" — accessible-name matching is case-insensitive SUBSTRING)  | session.surfaces, shell                                                     |
| Toast host                                                       | none (silent/inline-only outcomes)                                           | `role="region" aria-label="Notifications" aria-live="polite"` — deliberately NOT `role="status"` (an always-present status collides with surfaces' strict `getByRole('status')` lookups)                       | ui structure pin; inline statuses unchanged (Q3: accompany, never replace)  |
| Session close / void / membership removal / subscription disable | two-step INLINE buttons (step 2 name e.g. "Confirm closing T1")              | `ConfirmDialog` wraps the same two steps; step-1 button name kept, dialog confirm keeps step-2's name verbatim; void gains required-reason gating via `confirmDisabled`                                        | session.surfaces, full-journey, bill.void.audit (2/2), management, platform |
| Expiry redirect                                                  | bare `/signin` redirect                                                      | `state.expired: true` carried; SignInPage renders "Your session has ended. Sign in again to continue." (`role="status"`)                                                                                       | auth.guards pin, auth.routes                                                |
| `signOut` reachability                                           | AppShell header (every route)                                                | StaffShell header + CustomerShell session bar (credential routes keep a signed-out affordance — NOT a nav link; FR-01 zero-nav intact)                                                                         | auth.routes walkthrough, shell                                              |

## Hooks this phase introduced (new ledger entries)

| Hook                                                                   | Purpose                                                                             | Phase            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------- |
| `<main id="main">`                                                     | skip-link target (`SkipLink` → `#main`) in the shell                                | 021              |
| `document.title` per route                                             | route-metadata registry (`src/app/routes.ts`) — swept by `e2e/route.titles.test.ts` | 021              |
| `meta[name="description"]` per route                                   | same registry, same sweep                                                           | 021              |
| `.skip-link` class                                                     | base styling contract (`src/styles/base.css`)                                       | 021              |
| `aria-label` on nav `<nav>`                                            | "Staff area" / "Platform area" — the nav-matrix selector (`e2e/shell.test.ts`)      | 023              |
| `data-round-state` / `data-round-id` / `data-voided` on the round card | the ops-suites' card scoping (bill.void.audit, reports, full-journey)               | 023 (formalized) |
| ConfirmDialog role=`dialog` two-step names                             | destructive confirmations keep step-2 button names verbatim                         | 023              |
| Offline banner `role="status"` + "Retry now"                           | the shell's connectivity surface (`e2e/shell.test.ts`)                              | 023              |

New suites introduced by Phase 021: `e2e/route.titles.test.ts`, `e2e/a11y.baseline.test.ts`, `e2e/responsive.smoke.test.ts`, `e2e/gallery.error.test.ts` — their assertions join this ledger.

## Phase 024 presentation record (auth re-skin + entry presentation split)

The spec-020 auth and entry semantics are FROZEN verbatim — phase 024 changed only the presentation skin (AuthCard + entry module). No Category A/B/D contract moved; no new `data-testid` was introduced (Category C unchanged at 16). The entry labels (Branch/Table/Your name/Phone number, "Join the table", h1 = restaurant name, the `Blue Olive · Downtown · Table T3` indicator) keep their spec-020 freezing gate.

New presentation contracts introduced:

| Hook / surface                                                   | Contract                                                                                                                   | Asserted by                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `AuthCard` (`src/components/auth/`)                              | shared card primitive re-skinning `/signin`, `/reset-password`, `/account/password`; heading + submit-label text unchanged | a11y.baseline, auth.routes (verbatim flows) |
| `CustomerShellHeader` (`src/features/session/components/entry/`) | restaurant-name h1 + channel affordances on the entry shell; content still spec-020 verbatim                               | routes.test, entry.mobile, session.surfaces |
| `ChannelSelector`                                                | table/takeaway/delivery channel affordance; table labels unchanged                                                         | session.surfaces channel tests              |
| `SessionJoinNotice`                                              | join/refusal status region on the entry shell (copy frozen)                                                                | session.surfaces refusal pins               |
| `/` real landing (C2)                                            | RootPage offers the two real ways in (entry by identifier + staff sign-in); replaces the phase-021 placeholder             | routes.test 2/2 C2 pin                      |
| `/order/:branchId` redirect (C1)                                 | deep link redirects to the landing with the branch echo; no direct entry surface                                           | routes.test C1 pin                          |
| a11y baseline `/r/blue-olive`                                    | the entry route joins the axe WCAG 2.2 AA baseline                                                                         | a11y.baseline 4/4                           |

New E2E infrastructure (test-only, cross-file coordination under `e2e/helpers/`, the fionaLock pattern): `entryLock` (serializes the shared Blue Olive customer-entry surface machine-wide; platform.surfaces holds it ONLY across its disable→re-enable kill-switch window — never file-spanning, that queueing burst blew realtime's default timeout — with an afterAll safety net that re-enables a wedged tenant), `marinaT1Lock` (serializes the seeded Marina T1 Active/Inactive fixture lifecycle; realtime's kitchen-queue flip is state-agnostic with a toPass retry — a swallowed toggle click during React re-render self-heals).
