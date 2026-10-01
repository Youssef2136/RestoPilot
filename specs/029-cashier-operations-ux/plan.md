# Implementation Plan: Cashier Operations UX (Phase 09)

**Spec**: `specs/029-cashier-operations-ux/spec.md` (clarified D1–D5) · Work lands on `main`.

## Routes

Both paths unchanged: `/dashboard/rounds`, `/dashboard/sessions` (`?branch=` deep links preserved; KitchenDashboardPage untouched — phase 10).

## Architecture

- **No new shared layer** — 022 primitives as-is (`Button`, `Checkbox`, `ConfirmDialog`, `Card`/`Stack`/`SectionHeader`, `StatusPill`, `StateChip`, `MoneyText`, `EmptyState`, `Spinner`), the `data-density='compact'` staff mode, and the frozen data hooks (`useStaffOps`, `useSession`) unchanged in behavior.
- **New module css** `src/features/staffOps/staffOps.surfaces.module.css` — board grid, card density, voided treatment, money alignment (tabular numerals), badge/chip treatments, responsive collapse — 022 tokens ONLY (design-literals gate; comments included, the 027 F5 lesson).
- **New pure helpers + unit coverage**:
  - `src/features/staffOps/roundGroups.ts`: `ROUND_GROUP_ORDER` (the six display groups with human labels), `groupRoundsByState(rounds)` (state → group mapping, the FR-01 source of truth), and `pickRefusal(roundId, attempts)` (the FR-09 routing logic extracted from the page: first errored mutation whose variables match the round id, verbatim message). Both unit-tested in `tests/unit/roundBoard.test.ts` (new file; `tests/unit/staffops.client.test.ts` stays UNCHANGED).
- **Component re-skins (staffOps/components/)** — all behavior-preserving:
  - `RoundsBoard.tsx` (new): `<section data-density="compact" aria-label="Rounds board">` rendering the groups as `<section aria-label={label}>` regions with a heading (h2, human label + count pill) and a list of cards; per-group empty states; board grid ≥1024px, stacked below (`@media` only, same DOM). The page keeps the h1 'Rounds', branch selector (frozen ids/labels), loading/error postures.
  - `RoundCard.tsx` (rebuilt): keeps `article[data-round-id][data-round-state][data-voided]`, the 'Table X — round <id8>' text shape (realtime's fragment pin), channel chip, StateChip for the state (label-bearing, never color-only), voided note (reason text preserved), delivery address echo; per-line inline `Reduce one`/`Remove line` (D5) with consequence helper copy; captured 'Subtotal · tax' through MoneyText; refusal via the extracted `RefusalText` (`role="alert"`, `data-refusal`); `TransitionActions` (new): the state-gated buttons with pinned names, busy/disabled; the two-step void through `VoidRoundDialog` (new wrapper around ConfirmDialog keeping 'Void round' / 'Confirm void' / 'Cancel' / 'Void reason' verbatim, adding the boundary + irreversibility statement and reason-required posture); the `Show bill` checkbox (pinned label).
  - `BillPanel.tsx` (rebuilt, D1 inline): keeps `section[aria-label="Session bill"][data-testid="session-bill"]` and every pinned testid (`bill-address`, `bill-participants`, `data-bill-round`, `data-bill-lines`, `data-bill-tax-lines`, `bill-voided-section`, `data-bill-voided-round`, `bill-grand-total`); print-check layout on the money primitives — per-round sections with tabular money, tax lines by name, the voided section with reasons, and the grand total on the `TotalsPanel` grand-total shell. **Numeric pins**: the voided line carries EXACTLY two decimal figures (subtotal, tax — bill.void.audit counts them); the `bill-grand-total` element carries EXACTLY one (the delta math). Round-state group headings inside the bill keep their state labels.
  - `LiveBadge.tsx` (new, D2): 'Updated Xs ago' ticking from `dataUpdatedAt`, `aria-hidden` ticking text duplicated in a stable label; `pulse` class while `isFetching`.
  - `ReconnectingBanner.tsx` (new, D2): polite live region (`role="status"` is NOT used on /dashboard/sessions — here it renders on the rounds page only; role=status is safe there but we use `aria-live="polite"` + a visual banner to keep strict-mode headroom), states: reconnecting (CHANNEL_ERROR/TIMED_OUT/CLOSED) and retry-after-error (isError with data), with a Retry button (`refetch`).
  - `RefusalText.tsx` (new): the verbatim refusal paragraph primitive.
- **Cue (FR-08, D3)**: `DashboardLiveCue` re-skinned — keeps `[data-live-cue]` role=status 'A new order arrived.' + Dismiss; gains 'View on the board' link → `/dashboard/rounds?branch={branchId}`. `CashierRoundsPage` mounts the same cue; the cued round's card receives `data-round-cue="true"` (visible 'New order' marker + scrollIntoView effect, focus-safe — no focus steal). `useNewRoundCue` unchanged.
- **Freshness wiring**: the rounds page passes `onStatus` to `useRealtimeInvalidation` (tracking SUBSCRIBED/CHANNEL_ERROR/TIMED_OUT/CLOSED in state) and `roundsQuery.dataUpdatedAt`/`isFetching` to LiveBadge; the invalidation promise already awaited (028 D6 posture).
- **Sessions re-skin**: `BranchSessionsPanel` → keeps h2 'Open sessions — {branch}', the listitem rows, `Close session for {label}` / `Confirm closing {label}` / 'Keep it open' verbatim, the ONE inline `role="status"` closure notice (strict pin — no other role=status on this page; toasts stay role=region), participants + opened time through the 022 tokens (`SessionRow` extraction), loading/empty/error postures preserved; `StaffSessionsPage` selectors unchanged (frozen labels/ids; single-branch pages keep zero 'Branch'/'Marina' text pins in mind).

## Backend contracts used

**NOT_REQUIRED (database)** — the full staff-ops RPC set, realtime tables, and the cue hook exist and are consumed as-is. No client/parser changes; `staffOpsClient.ts` and `useStaffOps.ts` stay UNCHANGED (the money-free parser keeps rejecting money keys).

## Responsive

≥1024: board columns side-by-side (tablet landscape primary); bill beside/behind the board.
<1024: two-column fall-back; <768: groups stack (same DOM, `@media` only); mobile (390px): read/alert-capable with key transitions operable — every action button reachable; the bill readable (secondary documented posture).

## Accessibility

State groups as `<section aria-label>` + h2 headings with counts; buttons carry the pinned accessible names; voided distinct via text + styling (never color alone); polite live regions only; focus never stolen by refetch (no focus effects on data updates); dialogs trap/restore (native); axe floor clean on `/dashboard/rounds` and `/dashboard/sessions`.

## Loading / empty / error states

Board: 'Loading the branch rounds…' / per-group empties / populated / pulse / reconnecting banner / stale-data retry / hard error. Card: busy transition / refusal. Void: prompt (reason-required) / busy / refusal. Bill: 'Loading the bill…' / populated / voided section / error ('The bill could not be loaded.'). Sessions: 'Loading the open sessions…' / none open / list / closing busy / close refusal verbatim / closed notice.

## Testing strategy

- **Unit:** `tests/unit/roundBoard.test.ts` (new): `groupRoundsByState` mapping (every state → its group, voided overlay stays in-state), `pickRefusal` routing (round-id match for string + object variables, generic fallback). `tests/unit/staffops.client.test.ts` UNCHANGED and green.
- **E2E preserved:** `kitchen.cashier`, `bill.void.audit`, `realtime`, `session.surfaces`, `full-journey`, `reports.surfaces` — every assertion unedited.
- **E2E new:** `e2e/cashier.operations.test.ts` (serial, one worker):
  1. Marina T1 tablet pass under `withMarinaT1Lock` (the scratch fixture pattern): alice activates T1, a real customer enters (entry lock) and submits Hummus; alice works the FULL chain at 1024×768 on `/dashboard/rounds?branch={marina}` — groups labelled with counts, accept → start → ready → lock, bill grand total present; freshness badge ticks.
  2. Keyboard-only transition path: the chain driven by keyboard (focus + Enter) on the same round set.
  3. Reconnecting banner (carla, Downtown): `context.setOffline(true)` → banner; `setOffline(false)` → SUBSCRIBED recovery, banner clears (generous toPass).
  4. Void on the board at 390px: mobile posture — read/alert + key transitions (void with reason) operable.
  5. axe clean on `/dashboard/rounds` (populated, carla) and `/dashboard/sessions`.
- **Gates:** `npm run db:reset -- --yes` before verify AND before the full Playwright run; `npm run verify`; full `test:e2e` (background + sleep 570 pattern); `npx impeccable detect src` → 0.

## Design strategy

Compact staff density on the 022 system: board = column groups with count pills; cards = dense surfaces with StateChip + channel chip + tabular money; voided = danger-tinted, strikethrough-adjacent, text-bearing; bill = print-check (raised surface, hairline separators, tabular numerals, grand total emphasized). Impeccable: `shape` on board+bill; `critique` for operational density/error recovery; `audit` (target sizes, live regions, contrast); `harden` (stale/offline/refusal); `polish`.

## Migration notes (ledger)

Expected §Phase 029 additions in `docs/frontend-presentation-contracts.md`: the rounds board (region groups + counts), RoundCard rebuild (StateChip, TransitionActions, VoidRoundDialog copy), bill print-check on money primitives, LiveBadge + ReconnectingBanner + cue path (D2/D3), sessions re-skin. NO frozen anchor moves anticipated; deviations recorded with reasons.

## Risks

- Strict-mode: new labels must not collide with pinned accessible names ('Accept round'…, 'Close session for T1', 'Show bill', 'Void reason', role=status singletons on sessions).
- The bill's numeric pins (two figures on the voided line; one on the grand total) — any added figure inside those elements breaks bill.void.audit's math.
- The locked card must keep /Total/i-with-digit text (full-journey) and the 'round <id8>' fragment (realtime).
- Reconnect test flakiness — bounded by toPass with generous timeouts; the banner logic must not depend on event timing beyond the binding's status callback.
- Marina T1 fixture: activation/deactivation must stay inside `withMarinaT1Lock` with the self-healing flip (realtime's pattern).
