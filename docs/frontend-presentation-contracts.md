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

| Key                        | Contents                                   | Freezing gate                       |
| -------------------------- | ------------------------------------------ | ----------------------------------- |
| `restopilot.session-token` | customer session token (customer identity) | asserted across auth/session suites |
| `restopilot.cart`          | customer cart lines                        | asserted by order/cart suites       |

**Change discipline:** frozen for the entire frontend plan. No phase may rename or repurpose them; a rename is a cross-cutting contract change requiring an owner-approved spec amendment (Master Plan §3.7).

## Hooks this phase introduced (new ledger entries)

| Hook                                 | Purpose                                                                             | Phase |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ----- |
| `<main id="main">`                   | skip-link target (`SkipLink` → `#main`) in the shell                                | 021   |
| `document.title` per route           | route-metadata registry (`src/app/routes.ts`) — swept by `e2e/route.titles.test.ts` | 021   |
| `meta[name="description"]` per route | same registry, same sweep                                                           | 021   |
| `.skip-link` class                   | base styling contract (`src/styles/base.css`)                                       | 021   |

New suites introduced by Phase 021: `e2e/route.titles.test.ts`, `e2e/a11y.baseline.test.ts`, `e2e/responsive.smoke.test.ts`, `e2e/gallery.error.test.ts` — their assertions join this ledger.
