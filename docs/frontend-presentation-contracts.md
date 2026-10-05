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

## Phase 022 presentation record (design system & visual language — the system's own record)

Phase 022 built the world every later record assumes: `src/styles/tokens.css` as the
single raw-value home (semantic color roles, type, spacing, radii, shadows, borders,
z-index, motion, breakpoints, touch targets, density; `main.tsx` order
reset → tokens → base), the `src/components/ui/` primitive library (30 components:
Button/IconButton, Field + form family + FormErrorSummary, Dialog/ConfirmDialog/Drawer,
Card/Panel/SectionHeader/Tabs/Toolbar/Divider/Stack/Grid, DataTable/KeyValueList/
Pagination/LoadMore, Toast/useToast/Alert/StatusPill/Spinner/Skeleton/EmptyState/
ErrorState/ProgressBar, MoneyText/StateChip/TotalsPanel, Icon with 21 authored glyphs),
and the DEV gallery as their proving ground (every primitive × every labeled state).
Contracts this phase introduced and later phases consume: the axed floor on the gallery
(0 violations × chromium/mobile/tablet), the token drift scan (`design.literals.test.ts`
— no raw values outside tokens.css; two dated incumbent exemptions), the 14-pair
contrast contract (`design.tokens.test.ts`), the 34 static-markup ui contract tests,
the surface-brief template, and `DESIGN.md`/`PRODUCT.md` as the product/design truth.
The gallery stays out of the product bundle (re-proven by dist grep at validation).
No surface was restyled in 022 (Out of Scope) — the surface phases 023+ record their
migrations below; hooks they introduced are registered in their own records.

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

## Phase 025 presentation record (customer menu, cart, rounds & order status)

Money fidelity is structural: `MoneyText`/`TotalsPanel` (`src/components/money/`) are the ONE money presentation pair — captured money renders strong from the server payload verbatim; the cart's advisory estimate is muted and always labeled "Total (before tax)". No client recomputation of server money anywhere.

| Surface / hook       | Before (phase ≤ 024)                                                     | After (025)                                                                                                                                                                                         | Migrated suites                                |
| -------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Cart region element  | `<section aria-label="Cart">` wrapping menu + cart + submit (one column) | `<section aria-label="Cart">` (role unchanged) wrapping ONLY the cart lines/totals/submit; desktop side panel ≥1024px, mobile bottom sheet <1024px — same DOM both postures                         | session.surfaces (anchors unchanged, all pass) |
| Cart add controls    | inside CartPanel per item, nested `<li>` text                            | `ItemCard` ordered fields (name → price → description → extras → quantity → Add to cart) — `li` hasText scoping contract PRESERVED by design                                                        | session.surfaces, full-journey                 |
| Cart +/- buttons     | bare `+` / `−` text                                                      | unchanged bare text (an aria-label attempt broke the frozen `getByRole('button', {name: '+'})` pin — reverted)                                                                                      | session.surfaces                               |
| Rounds history money | inline `formatPrice` text (Subtotal/VAT/Total)                           | `TotalsPanel` captured rows (same labels, one component)                                                                                                                                            | session.surfaces, customer.menu                |
| Round state label    | `ROUND_STATE_LABEL` inline in RoundsHistory                              | extracted `roundStateLabels.ts` — identical vocabulary, unit-pinned                                                                                                                                 | full-journey, customer.menu                    |
| History freshness    | none (silent 10s poll)                                                   | "Updated Xs ago" + Refresh button (`data-stale` while fetching) — new surface, new assertions (customer.menu)                                                                                       | customer.menu                                  |
| Cutoff presentation  | submit-time refusal only                                                 | `CutoffNotice` pre-submit state (`role="note"` deliberately — the submit-success region stays the page's ONLY `role="status"`; a `role="status"` notice broke the strict `getByRole('status')` pin) | session.surfaces (cutoff refusal pin intact)   |
| Unavailable items    | omitted from the customer payload render (no add affordance)             | rendered visibly unavailable (struck price, reason, dashed card) — visible-unavailability rule; axe-clean without opacity                                                                           | menu.surfaces, customer.menu                   |
| Menu route a11y      | not scanned                                                              | axe WCAG 2.2 AA session-gated scan in customer.menu (needs a token — cannot join the signed-out baseline sweep)                                                                                     | customer.menu                                  |

New suites: `e2e/customer.menu.test.ts` (serial, one worker, joins Downtown T2 — NOT the pinned T3 surface). Evidence: `specs/025-customer-ordering-ux/evidence/` (3× 390px journey, desktop side panel).

## Phase 026 presentation record (management surfaces)

Management layout language introduced from 022 tokens: `ManagementLayout` (sticky in-page section
nav — labels 'Restaurant sections' / 'Branch sections', deliberately NOT 'Staff area'),
`SectionCard` (optional h2 — children may own a pinned heading), `ScopeBadge` ('Owner controls' /
'Read-only', text-bearing), `StatusPill` ('Active' / 'Inactive'), `BranchHeader` (h1 name). NO
frozen anchor moved: every management.surfaces pin (h1/h2s, identifier warning copy, toggle
names, hours labels, QR heading/downloads, denial h1s) and the full-journey staff chain passed
unedited.

| Surface / hook           | Before (phase ≤ 025)                    | After (026)                                                                                                        | Asserted by                                           |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Restaurant page sections | stacked h2 sections                     | SectionCards (profile/settings/qr ids) under the section nav; fragments reflected in the URL (`#qr`)               | management.surfaces + management.staff (fragment nav) |
| Branch detail            | h1 + stacked sections + link paragraphs | BranchHeader (meta links) + section nav (hours/tables) + ScopeBadge per section; tables rows carry StatusPill      | management.surfaces, management.staff                 |
| Table rows               | bare text 'Active'/'Inactive'           | StatusPill text chips (same strings inside the pinned listitems)                                                   | management.surfaces                                   |
| Staff list               | bare table                              | same table semantics (`th scope`) wrapped for scroll; mobile card-row fallback via `td[data-label]` pseudo-content | management.staff (390px)                              |
| Staff panel              | standalone section                      | unchanged behavior; read-only hints live on the page sections, not the panel                                       | management.staff                                      |

New suite: `e2e/management.staff.test.ts` (serial; scratch-identity provisioning self-cleans via
the removal dialog; unique emails/names per run; clipboard permission granted for the copy
affordance). Evidence: `specs/026-management-ux/evidence/` (restaurant sections, branch detail,
staff list, credential reveal).

## Phase 027 presentation record (menu management UX)

Menu management re-skinned from the 022 tokens + 026 management language: `MenuPage` and
`BranchMenuPage` now render `SectionCard`s under a `ManagementLayout` section nav ('Menu sections'
/ 'Branch menu sections'), the structure panel gets dense item rows (64 px thumbnails via the
signed-URL `useItemImage` hook, availability/override/extras pills, per-category filtered-empty
line), a 'Filter items' input, and the item editor hosts its extras/image blocks inside a
`section[aria-label="Edit <item>"]` wrapper — the save form keeps `Item details for <item>` (a
form inside a form is invalid HTML and silently breaks the inner submits — the T005 nested-form
fix). Below 768 px rows fall back to cards and the upload affordance is swapped — same DOM — for
the capability-boundary note. NO frozen anchor moved: every menu.surfaces pin (13 tests) and the
menu.client 52 unit tests + design.literals passed UNEDITED after the re-skin.

| Surface / hook   | Before (phase ≤ 026)                                                              | After (027)                                                                                                                                                                        | Asserted by                                     |
| ---------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Menu page        | h1 + stacked panels                                                               | ManagementLayout ('Menu sections') + SectionCards #structure / #add-category (add-category renders once menu data is present)                                                      | menu.management (owner journey, axe)            |
| Item rows        | sparse list, no imagery                                                           | dense rows: ItemThumb (signed URL, 'No image' placeholder, alt=""), price, pills (Available/Stopped, 'N branch overrides', extras preview)                                         | menu.surfaces (pins unedited) + menu.management |
| Item search      | none                                                                              | 'Filter items' input + per-category 'No items match your filter.'                                                                                                                  | menu.management (FR-02)                         |
| Item editor      | one form hosting the extras/image blocks (invalid nesting — inner submits broken) | section 'Edit X' → form 'Item details for X' + ExtrasEditor + ItemImageField; the editor STAYS OPEN on a save (Close dismisses)                                                    | menu.management (owner journey, 390px)          |
| Branch menu page | stacked availability sections                                                     | ManagementLayout ('Branch menu sections') + SectionCards preview / branch-availability / restaurant-availability (conditional) + ScopeBadge                                        | menu.management (realtime, FR-09)               |
| Menu realtime    | branch toggle events only delivered for INSERTs (stop)                            | `invalidateMenuForRealtime` clears the whole `['menu']` root; REPLICA IDENTITY FULL on branch_unavailable_items so DELETE (restore) payloads carry branch_id and reach subscribers | menu.management (FR-05/FR-09 exit criterion)    |
| Mobile < 768 px  | untested                                                                          | card-row fallback; upload affordance hidden + boundary note shown (same DOM)                                                                                                       | menu.management (390px)                         |

New suite: `e2e/menu.management.test.ts` (serial; the scratch category is reused, items carry a
per-run suffix, cleanup is legal-only — the RPC set has no item deletion). Schema fix riding this
phase: `supabase/migrations/20260930090000_menu_override_replica_identity.sql` (REPLICA IDENTITY
FULL on `branch_unavailable_items` — restore events were silently dropped because DELETE payloads
carried only `id`). Evidence: `specs/027-menu-management-ux/evidence/` (menu structure, item
editor, branch menu Marina + Downtown, 390 px editor).

## Phase 028 presentation record (tax configuration UX)

Tax surfaces re-skinned from the 022 tokens + 026 management language: `TaxPage` and
`BranchTaxPage` render `SectionCard`s under `ManagementLayout` section navs ('Tax sections' /
'Branch tax sections'), the rules list becomes dense rows (StatusPill-style Active/Retired,
scope badges, compound 'calculated after' labels), the editor groups its fields into fieldsets
with `aria-describedby` hints and an error summary, `BranchTaxPanel` carries the text-bearing
InheritanceBadge ('Inherited'/'Overridden' — never color-only), and `TaxPreview` announces its
results in an `aria-live` 'Calculation result' region with a Calculating… busy state (the
engine's lines and the pinned 'Subtotal: 6.50' text stay verbatim). The owner-only
`SnapshotAction` (spec 028 D1) records the once-only configuration snapshots with a stable
button label and outcomes stated in the status paragraph. Below 768 px the multi-select
target/compound pickers swap — same DOM — for the boundary note. Real pre-existing defects the
phase's E2E caught and fixed: the reorder submission mixed branch and restaurant rules (the RPC
requires ONE context — the fix submits only the moved rule's context), `isUnreferenced` counted
outgoing compound citations (delete now mirrors the server: incoming refs only), and an
overridden row offered NO clearing control ('Use restaurant default' added). NO frozen anchor
moved: every tax.surfaces pin (14 tests) and the tax.client 28 unit tests passed UNEDITED; the
spec-006 'no snapshot surface' executable guard is superseded by D1 (inverse assertion).

| Surface / hook  | Before (phase ≤ 027)                                                   | After (028)                                                                                                         | Asserted by                                    |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Tax page        | h1 + stacked panels                                                    | ManagementLayout ('Tax sections') + SectionCards #rules/#add-rule/#snapshot (D1)                                    | tax.management (axe, owner journey)            |
| Rule rows       | sparse text lines                                                      | dense rows: scope badge, targets, rate, Active/Retired pill, compound 'calculated after' naming its source          | tax.surfaces (pins unedited) + tax.management  |
| Rule editor     | flat form                                                              | grouped fieldsets + aria-describedby hints + error summary + structurally disabled submit on a malformed rate       | tax.management (rate refusal)                  |
| Reorder         | submitted the mixed displayed list (refused for branch-adjacent moves) | per-context swap + per-context submission                                                                           | tax.management (reorder legs)                  |
| Delete gating   | blocked on outgoing citations too                                      | server parity (incoming refs only)                                                                                  | tax.management (cleanup path)                  |
| Branch page     | stacked sections, plain-text origins                                   | ManagementLayout ('Branch tax sections') + SectionCards + InheritanceBadge + clearing affordance on overridden rows | tax.management (badge cycle)                   |
| Preview         | own table, silent refresh                                              | 'Calculation result' aria-live region + Calculating… busy; engine output verbatim                                   | tax.management (FR-06/FR-10) + determinism pin |
| Snapshots       | unsurfaced (spec 006 clarification 3)                                  | owner-only SnapshotAction: branch select + label + Record; once-only outcome stated, never an error                 | tax.management (record + re-record)            |
| Mobile < 768 px | untested                                                               | pickers hidden + boundary note (same DOM); rules + preview readable                                                 | tax.management (390px)                         |

New suite: `e2e/tax.management.test.ts` (serial; per-run suffixed scratch rules; cleanup is
legal-only — scope-change to total clears junction targets before delete; seeded state restored
after the override cycle). Cross-file discipline added: `e2e/helpers/t2Lock.ts` (the T2 shared
table mutex — customer.menu's exact bill assertions vs reports.surfaces' rounds). Evidence:
`specs/028-tax-configuration-ux/evidence/` (rules, rule editor, branch preview, 390 px
boundary).

## Phase 029 presentation record (cashier operations UX)

The cashier surfaces re-skinned into the 022 token system as an operable board: the rounds page
renders its six state groups as labelled regions (`<section aria-label>` + heading + count pill)
under a compact `data-density='compact'` root — columns side-by-side at ≥1025 px (the cashier
station), stacked below (same DOM, `@media` only). `RoundCard` rebuilt with `StateChip` state
vocabulary + channel chip + tabular-numeral money, inline 'Reduce one'/'Remove line' with
consequence copy, `TransitionActions` (pinned names, busy/disabled), the two-step void with the
boundary/irreversibility statement, a distinct voided treatment (danger surface + text-bearing
note), and the cued round marked with a 'New order' badge + `data-round-cue`. `BillPanel` rebuilt
as the printed check (hairline separators, tabular numerals, participants as chips, tax lines by
name, voided section, emphasized grand total). Freshness (D2): 'Updated Xs ago' `LiveBadge`
ticking from `dataUpdatedAt` with a pulsing dot while refetching; a polite `aria-live` refresh
announcement; the binding's previously-unused `onStatus` now drives the 'Reconnecting…' banner
(CHANNEL_ERROR/TIMED_OUT/CLOSED), clearing on SUBSCRIBED; a stale-data error keeps the last-known
board with 'Retry now'. The cue (D3) gained its clear path: the dashboard banner links to the
board, the board marks the round in place. Sessions re-skinned on the same tokens with the pinned
dialog names and the single role=status closure notice intact. NO frozen anchor moved: every
cashier/kitchen/bill-void/realtime/session/realtime/full-journey/reports pin (174 tests) and the
staffops.client payload-discipline suite passed UNEDITED.

| Surface / hook  | Before (phase ≤ 028)                | After (029)                                                                                           | Asserted by                                   |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Rounds page     | stacked div groups, 'Nothing here.' | RoundsBoard labelled regions + counts + named empties; compact density; board grid ≥1025 px           | cashier.operations (tablet pass, axe)         |
| Round card      | plain text state + inline buttons   | StateChip + channel chip + 'New order' cue badge + tabular money + consequence copy; voided distinct  | cashier.operations + realtime pins unedited   |
| Void flow       | confirm with reason only            | VoidRoundDialog: pinned names + boundary/irreversibility statement                                    | bill.void.audit (pins unedited)               |
| Bill            | sparse section list                 | printed-check BillPanel on money primitives (numeric pins held: voided line 2 figures, grand total 1) | bill.void.audit + kitchen.cashier unedited    |
| Freshness       | none                                | LiveBadge 'Updated Xs ago' + pulse; polite refresh announcement                                       | cashier.operations (badge ticks)              |
| Connection      | silent CHANNEL_ERROR/TIMED_OUT      | ReconnectingBanner from binding `onStatus`; recovery on SUBSCRIBED; stale-data retry posture          | cashier.operations (offline → banner → clear) |
| Cue             | announcement only on the dashboard  | + 'Show the new order' board link; board marks the cued round (scroll, no focus steal)                | realtime pins unedited + cashier.operations   |
| Sessions panel  | plain rows                          | token re-skin (SessionRow cards, participant chips); pinned names + single role=status intact         | session.surfaces unedited + axe               |
| Refusal routing | page-level scan                     | extracted `pickRefusal` (unit-tested) rendering verbatim on the originating card                      | unit roundBoard (11)                          |

New suite: `e2e/cashier.operations.test.ts` (serial; Marina T1 scratch fixture under the existing
`withMarinaT1Lock` — activate → operate → deactivate; the customer entry queues on `withEntryLock`):
tablet-viewport full chain with a keyboard-only leg, the offline → reconnecting → recovery banner
behavior, the 390 px void journey, and the axe floor on both routes. Evidence:
`specs/029-cashier-operations-ux/evidence/` (board tablet, incoming round, card modify, bill,
390 px).

## Phase 030 presentation record (kitchen display UX)

The kitchen route re-skinned from a plain three-div list into a KDS-scale board on the same
022 tokens: three columns ('Incoming'/'In preparation'/'Ready to serve') with real h2 headings,
large count pills, and named empties (deliberately DIVs — the route's frozen single-`section`
innerText pin and the board's aria-label + heading structure carry the semantics); `TicketCard`
rebuilt at display scale — StatusPill state vocabulary, the D2 three-band honest age
('3 min' → '1 h 05 min', never seconds; fresh/working/late with a static text-bearing 'late'
treatment), quantity-emphasized item lines with extras, 'Counter order' heads for the channel
sessions (never 'Table null'), and the two large-format controls ('Start preparation'/'Mark
ready') well above the touch floor; the one-shot D1 arrival highlight (brand surface fading —
composition is the alarm; reduced-motion collapses it; no sound, no notifications); freshness
LiveBadge + the ReconnectingBanner on the ticket binding's `onStatus` + the polite refresh
announcement (029 components reused); skeleton-column loading and an overall-empty state.
The incoming `new` tickets are VISIBLE but NOT actionable (D3 — the cashier accepts first; no
accept control exists here). The money-free/address-free blindness re-asserted over the live
board (the seeded '12 Marina Walk' never renders). NO frozen anchor moved: kitchen.cashier,
realtime, and full-journey passed UNEDITED.

| Surface / hook  | Before (phase ≤ 029)              | After (030)                                                                                                     | Asserted by                                   |
| --------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Kitchen board   | three plain divs, 'Nothing here.' | three labelled columns + count pills + named empties + skeleton loading (divs — the single-`section` pin holds) | kitchen.display (SC-01) + kitchen.cashier     |
| Ticket card     | plain state text, small controls  | KDS scale: StatusPill, D2 age bands, quantity-emphasized lines, 'Counter order' heads, large-format controls    | kitchen.display + full-journey pins unedited  |
| Arrival cue     | none                              | one-shot brand fade (D1, visual-only alarm; reduced-motion collapse)                                            | kitchen.display                               |
| Freshness/conn. | none on the route                 | LiveBadge + ReconnectingBanner + polite announcement (029 components)                                           | kitchen.display (offline → banner → recovery) |
| Blindness       | money-free via payload            | money-free + address-free re-asserted over the LIVE board text                                                  | kitchen.display (SC-03)                       |
| Phone (<768)    | untested                          | readable stacked fallback, no horizontal overflow (boundary documented, not a working surface)                  | kitchen.display (390px)                       |

New suite: `e2e/kitchen.display.test.ts` (serial; the Marina T1 fixture under
`withMarinaT1Lock` — activate → operate → deactivate; the customer entry queues on
`withEntryLock`): the landscape 1280×800 journey (live arrival, the cashier-accept split with
dan's open board moving columns live, the keyboard-only walk), reload recovery, the offline
banner, the blindness re-assert, and the 390px fallback. Unit: `tests/unit/ticketAge.test.ts`
(D2 formats/bands/null-safety). Evidence: `specs/030-kitchen-display-ux/evidence/` (KDS tablet,
empty board, 390px).

## Phase 031 presentation record (delivery & takeaway channel UX)

The three channels became legible everywhere they matter (specs/031; Master Plan §Frontend
Phase 11). The cutoff is the SERVER's `submit_round` rule mirrored for presentation
(`cutoffCrossed` — delivery closes on `out_for_delivery`/`completed`, takeaway on
`ready`/`lock`, dine-in never, voided included — server parity is the contract), derived on
the customer page from the SAME shared rounds cache the history renders. D1: the poll is
the client's knowledge; the pre-emption disables the ADD affordance only, BEFORE the
attempt — the cart and the submit path stay alive so the server's verbatim refusal
(FR-06, frozen) remains possible and was proven live with the cart preserved. The channel's
status story renders as a milestone timeline (`aria-current="step"`; the raw chip is
suppressed ONLY when the state maps — F9) with the pickup readiness announced politely
(D4). The cashier board narrows honestly by channel (FR-05/D2: counts and empties derive
from the FILTERED set), completion is two-step (FR-03/D3 — the pinned 'Mark completed'
opens the consequence dialog), the kitchen's channel blindness is re-asserted over a LIVE
delivery round (D6/FR-04 — kitchen code untouched), and branch sessions carry the
'Counter session' neutral marker (D5). NO frozen anchor moved: full-journey and kitchen
suites passed UNEDITED; the customer page's single `role="status"` stays the submit-success
region (the new announcements are `aria-live="polite"`; CutoffNotice stays `role="note"`).

| Surface / hook  | Before (phase ≤ 030)                               | After (031)                                                                                                     | Asserted by                                       |
| --------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Channel chip    | ad-hoc channel spans (RoundCard/SessionIndicator)  | one extracted ChannelChip (`data-channel-chip`) named in the indicator and on every staff card                  | channel.operations (FR-01)                        |
| Customer cutoff | none — the refusal was the first sign              | disabled Add to cart + `aria-describedby` → `#cutoff-notice` + polite crossing announcement, BEFORE the attempt | channel.operations + session.surfaces FR-011 (D1) |
| Status story    | raw state chips only                               | StatusTimeline milestones (aria-current="step", way/pickup emphasis) + pickup announcement                      | channel.operations (FR-07, D4)                    |
| Cashier filter  | one full board                                     | ChannelFilter radios (All channels default) narrowing honestly, restoring exactly                               | channel.operations (FR-05, D2)                    |
| Completion      | one-tap 'Mark completed'                           | two-step: the pinned button opens the consequence dialog ('Complete the delivery' / 'Not yet')                  | channel.operations (FR-03, D3)                    |
| Branch sessions | channel-typed heads only                           | 'Counter session' neutral marker for no-table sessions                                                          | staff surface (D5)                                |
| Cart micro-btns | 025 buttons ~19.8px wide (axe target-size finding) | `.smallButton` min-width/min-height 1.5rem (A3 owned here)                                                      | channel.operations axe pass (default viewport)    |

New suite: `e2e/channel.operations.test.ts` (3): the delivery journey (chip, pre-emption,
verbatim refusal with the cart preserved, one-tap dispatch, two-step completion, timeline,
kitchen blindness over the LIVE round, axe at the default viewport, 390px overflow-only),
the channel filter, and the takeaway leg (cutoff on `ready`, pickup announcement,
timeline). Unit: `tests/unit/cutoffState.test.ts` (11 — mirror parity incl. voided;
milestones/fallback) and `roundBoard` +3 (`matchesChannel`). `session.surfaces` FR-011
migrated to D1 (the second add happens BEFORE the threshold crossing; the verbatim refusal

- preserved cart unchanged).

## Phase 032 presentation record (realtime, notifications & subscription awareness UX)

The awareness layer got its central announcement policy and its honest subscription story
(specs/032; Master Plan §Frontend Phase 12). `announcementPolicy.ts` is the one map from
(event class, dedupe key) → surface/politeness/copy; the cue, reconnecting and offline
banners re-wired onto its FROZEN byte-identical strings (zero DOM change — every lock
held). The cue's one-slot supersede is now pinned by tests: a second INSERT replaces the
visible announcement, only the CURRENT round's advance clears it, and a foreign round's
update is ignored. `SubscriptionDetailPanel` is the honest owner-facing detail (D5): an
in-flow disclosure under the banner — no route, no console, no ticket escape hatch — with
per-state copy. D3 keeps the product quiet: passive events toast nothing, no activity
panel exists. The platform_disabled copy carries the REVERSED truth learned in 030:
ordering stays available during a manual pause; only the platform re-enables
(`state='platform_disabled'` is passed straight through the detail panel). The two
platform-console date journeys (activate → nearing_expiration, expire → expired) are
filed under a new cross-file `subscriptionLock` (the mkdir+steal t2Lock pattern) because
both mutate the SAME blue-olive subscription row; the console proves each write landed
via its own state column. NO frozen anchor moved: platform.surfaces' assertions are
untouched (only the lock wrapper was added); the cue's fixed line, the recovered and
reconnecting pins, and every policy string are byte-identical to their pre-phase values.

| Surface / hook       | Before (phase ≤ 031)                      | After (032)                                                                          | Asserted by                        |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------- |
| Announcements        | per-component string literals             | one `announcementPolicy` map (surface, politeness, copy) + 1 s dedupe guard          | announcementPolicy unit (9)        |
| Supersede            | implied by INSERT-derivation, unpinned    | pinned: INSERT supersedes; current-round advance clears; foreign UPDATE ignored      | newRoundCue.supersede unit (3)     |
| Subscription detail  | banner state only, no explanation         | `SubscriptionDetailPanel` disclosure (aria-expanded) under the banner, no route      | live.awareness (FR-05, D5/D7)      |
| nearing_expiration   | no E2E journey                            | console-driven activate journey + banner state + honest detail                       | live.awareness (new suite)         |
| no-payload cue       | payload discipline asserted only in unit  | live E2E: exactly the fixed line + 2 affordances (count 3), no name/item/money/ids   | live.awareness (F1)                |
| 390px with live cue  | untested with the cue visible             | no horizontal overflow with the cue in flow                                          | live.awareness (F6)                |
| Date journeys        | unserialised console mutations on one row | `withSubscriptionLock` around both; restored to active (end_date +30) before release | platform.surfaces + live.awareness |
| Detail-panel visuals | n/a (new component)                       | approved tokens only (`--color-border`, `--radius-sm`, `--color-surface-raised`)     | design pass                        |

New suite: `e2e/live.awareness.test.ts` (2, serial): the nearing_expiration journey
(console activate → 'Nearing expiration' column → owner banner + detail + collapse →
restore to active) and the cue no-payload/390px journey (ACK-gated join, payload fields
absent, overflow 0 with the cue visible). Unit: `tests/unit/announcementPolicy.test.ts`
(9 — byte-identical strings, dedupe window, politeness) + `subscriptionCopy.test.ts`
(5 — the reversed platform_disabled truth) + `newRoundCue.supersede.test.ts` (3).
`e2e/platform.surfaces.test.ts`: the two date journeys wrapped in `withSubscriptionLock`,
assertions untouched.

## Phase 033 presentation record (reports, audit & void log UX)

The three read-only surfaces got their honesty and readability layer (specs/033; Master
Plan §Frontend Phase 13) with the figures untouched — everything still renders from the
RPCs byte-for-byte through `formatPrice` (Constitution II: no new arithmetic anywhere).
The owner comparison now states its own truth (D1): a same-period sentence derived from
the anchored branch's server-returned bounds, pending rows read 'Loading…', and a failed
branch renders 'Load failed — the figures for this branch could not be loaded.' under
`role="status"` — the old silent '—' (indistinguishable from zero) is gone. The audit
page says what its filter does (D7 exact-match hint wired via `aria-describedby`) and
renders a clamp notice only when the page returns a full 200 entries (D2). All-zero
periods add 'Nothing was recorded in this period.' under the untouched zero figures
(D6); channels and best-sellers gain aria-hidden token-only bars — share of the visible
max, no charting dependency (D4/FA-10); long reasons truncate at two lines with the full
text in the DOM (D5); and the three tables reflow to labelled card rows below 720px via
CSS only (`data-label` cells, thead out of flow — D3, no DOM fork, no assertion change).
NO frozen anchor moved: the six reports.surfaces tests and the bill.void.audit audit
assertions pass unedited; the denials, refusals, and every `data-testid` hook stay
verbatim. Recorded boundary: `get_audit_log` has NO date-range/actor parameters — FR-07
is satisfied to contract (exact match + branch + clamp), anything more is a backend
change (NOT authorized, documented).

| Surface / hook  | Before (phase ≤ 032)                | After (033)                                                                             | Asserted by                     |
| --------------- | ----------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------- |
| Comparison rows | silent '—' for pending AND failure  | period sentence + per-row posture ('Loading…' / failure text, role="status")            | reports.readability + unit (D1) |
| Audit clamp     | full page looked like the end       | 'Showing the most recent 200 entries — narrow the filters…' only at exactly-limit pages | reportFormat unit (R2)          |
| Action filter   | free-text input, semantics unstated | exact-match hint + `aria-describedby`                                                   | reports.readability (D7)        |
| Zero vs empty   | zeros only, no story                | 'Nothing was recorded in this period.' under the byte-identical figures                 | reports.readability (D6)        |
| Channels/best   | plain rows                          | aria-hidden token bars (share of visible max) beside the unchanged numbers              | reports.readability (D4)        |
| Reasons         | full-width unbounded                | 2-line CSS clamp, title attr, full text in DOM                                          | styles (D5)                     |
| Mobile tables   | horizontal scroll only              | labelled card rows < 720px, no overflow at 390px, zero DOM fork                         | reports.readability (D3/R3)     |

New suite: `e2e/reports.readability.test.ts` (4, serial, read-only — no locks needed):
period sentence + bars + zero hint, filter semantics + clamp absence, the 390px card
walk over all three pages (overflow ≤ 0), and axe WCAG 2.2 AA on the three desktop
pages. Unit: `tests/unit/reportFormat.test.ts` (7 — clamp at exactly-limit, zero-safe
bar shares, period sentence). `reportsClient`/`auditClient`/`useAudit` untouched.
