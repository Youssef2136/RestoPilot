# Implementation Plan: 031-channel-operations-ux (Frontend Phase 11)

**Mode**: Operate (refinement over existing surfaces) · **Baseline**: `9959364` · **Backend impact**: NOT_REQUIRED (all contracts exist; D5 records the one payload gap instead of patching it)

## Routes touched (no new routes)

1. `/r/:slug/menu` — `CustomerMenuPage.tsx`: derive the cutoff state from the rounds read (shared cache with `RoundsHistory`, no new fetch) and thread `orderingClosed` + the notice anchor id into `MenuSections` (→ `ItemCard` disabled add) while `CartRegion` gains the linked, announcing notice. `RoundsHistory` gains the `StatusTimeline` (channel rounds only) + the takeaway pickup announcement.
2. `/dashboard/rounds` — `CashierRoundsPage.tsx`: hold the `ChannelFilter` selection (default 'All channels'); filtered rounds feed the existing `RoundsBoard`. `TransitionActions` gates 'Mark completed' behind `CompletionConfirmDialog`. `RoundCard` keeps every pinned name/attribute; the channel chip becomes the extracted `ChannelChip` (same text, same `data-channel-chip`).
3. `/dashboard/kitchen` — ZERO code change (D6); new E2E asserts blindness over a live delivery round.
4. Sessions oversight — `BranchSessionsPanel.tsx`: `session.table_label ?? 'Counter session'` main line (D5).

## Components (new/changed)

| Component | Change | Pins held |
| --- | --- | --- |
| `ChannelChip` (NEW, `features/session/components`) | one chip: `<span data-channel-chip>` + `channelLabel` | text 'Dine-in/Delivery/Takeaway' + `data-channel-chip` preserved |
| `ChannelFilter` (NEW, `features/staffOps/components`) | radio group 'All channels'/'Dine-in'/'Delivery'/'Takeaway', default All, one DOM | default renders the exact board of today |
| `CompletionConfirmDialog` (NEW, wraps `ConfirmDialog`) | D3 copy; confirm 'Complete the delivery', cancel 'Not yet' | card button keeps pinned 'Mark completed'; no pinned E2E clicks it |
| `CutoffNotice` (EXTEND) | optional `id` + `orderingClosed` → crossed-state sentence + polite crossing announcement `<p aria-live="polite">` | stays role="note"; never role="status" |
| `StatusTimeline` (NEW, `features/order/components`) | `<ol>` milestones per channel, `aria-current="step"`, emphasis milestone | no role="status"; lives inside region 'Your rounds' |
| `ItemCard` (EXTEND) | `orderingClosed` → `disabled` on 'Add to cart' + `aria-describedby={noticeId}`; composes with the existing unavailable posture | dine-in never closed → frozen add pins untouched |
| `MenuSections` / `CartRegion` / `RoundsHistory` / `RoundCard` / `TransitionActions` / `BranchSessionsPanel` (THREAD) | pass-through props only | all structural pins unchanged |

## State/data flow

- Cutoff derivation is a PURE helper in `features/order/cutoffState.ts`: `cutoffCrossed(channel, rounds)` → delivery: any round `out_for_delivery`/`completed`; takeaway: any round `ready`/`lock`; dine-in: never. Voided rounds do NOT trigger (a voided delivery round is not "on its way" — matches the server's authoritative check reading live rounds' states). Unit-tested (node env, house method).
- Timeline mapping is a PURE helper `timelineMilestones(channel)` + `milestoneFor(state, channel)` in the same module: delivery [Sent to kitchen, In the kitchen, On its way, Delivered]; takeaway [Sent to kitchen, In the kitchen, Ready for pickup, Picked up]; mapped from `new`/`accepted|preparing`/`out_for_delivery|ready`/`completed|lock`. Unknown states fall back to the raw chip (never a wrong claim).
- Filter state: `useState<'all'|'dine-in'|'delivery'|'takeaway'>('all')` in `CashierRoundsPage`; filtering is a pure predicate in `roundGroups.ts` (`matchesChannel(round, filter)`); groups/counts derive post-filter. No persistence, no URL state (tablet tool, not a shareable view).
- The customer page reads the SAME `useSessionRounds` cache `RoundsHistory` uses (identical key) → the 10 s poll drives the crossing; no extra fetch, no new read path.

## Backend contracts used (all existing — ALREADY_SUPPORTED)

`get_session_context`, `get_session_menu`, `get_session_rounds`, `submit_round` (cutoffs), `mark_out_for_delivery`, `mark_completed`, `get_branch_rounds`, `get_session_bill`, `get_branch_open_sessions` (payload gap recorded, D5), `open_session_channel`, realtime tables `rounds`/`kitchen_tickets` (invalidation only). **BLOCKING_CONTRACT_GAP: none.** Recorded conflict: sessions-list `session_type` absence (D5).

## Responsive behavior

- 390 px: disabled add row + notice + timeline are stacked prose — no horizontal overflow (E2E asserts at 390 px); the cart stays the same-DOM bottom sheet.
- Cashier board: filter wraps above `data-testid="rounds-board"`; chips survive narrow cards; ≥1025 column layout untouched.
- Kitchen: untouched.

## Accessibility

- `ChannelFilter`: fieldset+legend or radiogroup with visible labels; keyboard native radios.
- Disabled add: real `disabled` + `aria-describedby` → the notice id (exists whenever disabled).
- Crossing/pickup announcements: `aria-live="polite"` paragraphs appearing with the state — never role="status" (single-status pin).
- Timeline: `<ol>` + `aria-current="step"`; text-bearing milestones (no color-only).
- axe scans on the customer menu (closed state) and the rounds page (filter present) in the new E2E.

## Loading/empty/error states

- Filtered-empty board: existing group empties remain ('Nothing waiting here right now.') + the filter still visible — honest, no invented "no delivery orders" flourish beyond the true empty sentence.
- Cutoff before the rounds read resolves: buttons stay enabled until the state is KNOWN (the poll latency is honest; the server covers the race) — no speculative disabling.
- Rounds read error: existing history alert path unchanged; the cutoff simply stays open (client-unknown ≠ client-claimed-closed).
- Completion dialog busy/refusal: busy on confirm; server refusal renders verbatim in the card's refusal slot (existing routing).

## Testing strategy

- Unit (node, house method): `cutoffState.test.ts` (derivation matrix + void exclusion + dine-in never), `timeline.test.ts` (mapping per channel + unknown fallback + aria-current step), `roundBoard.test.ts` extended (`matchesChannel`).
- E2E `e2e/channel.operations.test.ts` (new, serial-safe, isolated rerun-friendly): (1) delivery journey — entry, first round, four staff transitions, disabled adds + notice link + announcement after crossing, verbatim refusal + preserved cart, timeline 'On its way', axe on the closed state; (2) completion confirmation — dialog copy, confirm completes; (3) channel filter narrows/restores with honest counts; (4) takeaway leg — cutoff on ready, pickup announcement; (5) kitchen blindness over the live delivery round (no address/'Deliver to'/logistics); (6) 390 px pass. Existing session.surfaces cutoff journey migrated per D1 (recorded).
- Full gates: `npm run db:reset -- --yes` → `npm run verify` → full Playwright (182 existing + new) in the background with the 590 s sleep cadence; isolated reruns for any transient set.

## Design strategy (Impeccable)

- `shape` on the cutoff/dispatch moments: the disabled row must read as "closed, and why", not as breakage — the notice copy carries the reason; the dim is one token step.
- `critique` the customer's understanding: the cart is the customer's money surface — the notice never implies cart loss (the 'safe' sentence stays).
- `audit` disabled-state semantics (real disabled + describedby, no aria-disabled mixing).
- `polish` the timeline: compact, token-only, reduced-motion safe (no animation needed at all).

## Task order

T001 unit helpers → T002 ChannelChip extract → T003 customer cutoff (notice link + ItemCard disable + announcement) → T004 StatusTimeline + pickup announcement → T005 ChannelFilter → T006 CompletionConfirmDialog → T007 sessions-list marker → T008 new E2E → T009 session.surfaces D1 migration → T010 CSS tokens + prettier → targeted checks per task; full verify + full Playwright at the gate.
