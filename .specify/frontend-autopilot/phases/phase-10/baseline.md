# Phase 10 — Baseline (INSPECT)

- Date: 2026-10-01 · Baseline commit: `d5223dc` (feat(029), pushed to origin/main) · Branch `main` clean (by-design untracked: `.agents/`, `.freebuff/`, `.zcode/`, `.specify/frontend-autopilot/`, Master Plan, DESIGN.md).
- Feature dir: `specs/030-kitchen-display-ux` (Master Plan §Frontend Phase 10). Mode: Operate (glanceable, hands-busy). **Sequential after Phase 09** (both edit `features/staffOps/**` + `e2e/kitchen.cashier.test.ts`); Phase 09's board/state/freshness patterns are the deliberate foundation.

## Master Plan phase-10 contract (condensed)
- **Purpose**: a kitchen display readable from two metres, on a screen nobody touches with clean hands — incoming tickets, exactly two actions (`start preparation`, `mark ready`), survives a dropped connection or reload mid-service.
- **Scope**: `/dashboard/kitchen` only: three columns new/preparing/ready with counts, ticket cards (items, quantities, extras, age, channel-blind), large-format controls, live updates, reconnect/offline behavior, empty/error states, branch selector when multi-branch.
- **Out of scope**: NO money anywhere (money-free parser keeps rejecting money keys); no accept action (cashier accepts first); no item-level machine; no availability control; no printing; no sound unless clarified.
- **Contracts**: `get_kitchen_queue` (money-free, channel-blind: no address, no money), `start_preparation`, `mark_round_ready`, ticket states new→accepted→preparing→ready, one-ticket-per-round, realtime `kitchen_tickets`+`rounds`, role reach, `data-kitchen-column`/`data-ticket-id`/`data-ticket-state` hooks.
- **Key FRs**: FR-01 columns+counts+empty states; FR-02 ticket cards (lines/quantities/extras, channel-neutral); FR-03 elapsed time with staleness (no fabricated precision); FR-04 exactly the contract's actions w/ busy protection; FR-05 live updates + visible connection state; FR-06 reload recovery; FR-07 branch selector; FR-08 refusal on the originating card verbatim; FR-09 no money/address ever.
- **UX/Visual**: readability over density — large type, high contrast, generous targets, cards survive being seen at an angle; moved tickets visibly change columns; offline obvious and non-blocking (last-known board readable); no modal interrupts. Kitchen-specific scale within the same tokens (larger radii, heavier borders, stronger state colors); age escalation without alarm fatigue; distinct offline treatment.
- **Responsive**: primary landscape tablet/wall ≥1024 touch; portrait stacking; phone explicitly OUT (readable fallback + documented boundary).
- **A11y**: pinned names 'Start preparation'/'Mark ready', large targets; polite coalesced live regions; column headings as real headings; color never alone; reduced-motion honored.
- **Testing**: unit staffops.client preserved + age/state mapping; E2E kitchen.cashier + realtime preserved; NEW offline/reconnect (context offline), reload recovery mid-service, landscape tablet pass, axe; money/address absences re-asserted explicitly.
- **Impeccable**: shape (legibility/glanceability/touch) → critique (cook at two metres) → audit (contrast/target/motion) → harden (offline/stale) → polish.
- **Expected clarifies**: sound/badge (no outbound contract — visual only); age thresholds; cashier's new-column visibility; wall-screen resolution.
- **Exit**: a kitchen member works a service on a landscape tablet — sees tickets live, starts/completes them, survives reload + disconnect, never sees money/addresses; frozen assertions preserved or migrated with a record.
- **Gates**: verify; test:e2e (kitchen.cashier, realtime); axe + landscape-tablet specs. Checkpoint `feat(030)`.

## Frontend state at baseline (post-029)
- `KitchenDashboardPage.tsx`: role gate (all staff roles reach the route), branch selector via `useStaffBranchOptions()` (kitchen included), two realtime bindings (`kitchen_tickets` + `rounds` → kitchenQueueKey), three plain-div columns (`data-kitchen-column`, h2 labels) with 'Nothing here.', `refusalFor` over start/ready, loading/error paragraphs. No freshness, no connection banner, no age.
- `TicketCard.tsx` (48 ln): `article[data-ticket-id][data-ticket-state]`, h3 'Table {label}', state text, items `q × name (+ extras)`, `data-refusal`, two plain buttons (pinned names, busy/disabled).
- Reusable from 029: `LiveBadge` (dataUpdatedAt ticking + pulse), `ReconnectingBanner` (aria-live polite, retry), `staffOps.surfaces.module.css` conventions, `pickRefusal` shape (page keeps its own two-mutation loop — fine).
- Data: `staffOpsClient.getKitchenQueue` → `assertMoneyFree` runtime guard; `KitchenTicket` {ticket_id, round_id, state, table_label, created_at, items{name,quantity,extras}} — NO session_type/address (channel-blind by contract).
- Realtime: `useRealtimeInvalidation` (coalescing + SUBSCRIBED recovery + `onStatus` — already used by the rounds page since 029).

## Fixture facts (seed.sql)
- Downtown channel demo sessions: delivery `...8003` ('12 Marina Walk', participant Nour, token `dev-token-downtown-delivery-2026`), takeaway `...8004` (participant Zaid, token `dev-token-downtown-takeaway-2026`) — open, round-less, IDEMPOTENT (re-run converges: closed_at cleared, address restored). Deterministic.
- Marina T1 = the seeded INACTIVE fixture under `withMarinaT1Lock` (used by realtime + cashier.operations).
- `kitchen_tickets.state` check constrains 'new' at insert; runtime states new/accepted/preparing/ready/lock (transitions update; lock hides tickets).

## Frozen contracts (must pass UNEDITED)
- `e2e/kitchen.cashier.test.ts` (serial): dan signs in → Marina queue (or empty) → `section` innerText matches NO /subtotal|tax|total|price/i → /dashboard/rounds refused (h1 denial); the cashier journey on Downtown T3 (board pins — must stay green through any TicketCard changes only insofar as the BOARD is untouched).
- `e2e/realtime.test.ts`: Marina T1 activation under `withMarinaT1Lock` → dan's kitchen `article[data-ticket-id]` count grows LIVE after a real Marina T1 customer submit → money-free re-assert → deactivate restores Inactive.
- `e2e/full-journey.test.ts` (fiona): kitchen reached from the dashboard nav; `[data-ticket-state="accepted"]` → 'Start preparation' → `[data-ticket-state="preparing"]` → 'Mark ready' → `[data-ticket-state="ready"]`.
- a11y helper: axe baseline EMPTY — the re-skinned kitchen must scan clean.
- `tests/unit/staffops.client.test.ts` UNCHANGED (money-free parser discipline).

## Prior-phase lessons applied
- db:reset before verify AND before full Playwright (029 F5: even after partial runs).
- Dev server alive on 5173; background Playwright + sleep 570; tablet-chromium isolated rerun on transient crash.
- Strict-mode anchors: new labels must not collide ('Kitchen' heading is the h1; column h2s; pinned button names); role=status singletons (none pinned on the kitchen route — banners use aria-live anyway).
- Frozen checkbox/`has`/`contains` pins on sessions/boards stay untouched; the kitchen surfaces are mine to re-skin.
- Tokens only (comments included); prettier everything; evidence via run-then-delete script; `signInAsFiona` exists (full-journey owns it).
