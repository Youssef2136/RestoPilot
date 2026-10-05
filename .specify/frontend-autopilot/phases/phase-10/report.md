# Phase 10 Report — Kitchen Display UX (specs/030-kitchen-display-ux)

**Status: DONE** · Checkpoint: `feat(030)` pushed to `origin/main` · Baseline `d5223dc` → checkpoint (this commit).

## Objective

The Master Plan §Phase 10 kitchen display: readable from two metres on a screen nobody touches
with clean hands — incoming tickets, exactly two actions, realtime truth, and survival of a
dropped connection or reload mid-service — as a re-skin of the complete existing journeys with
every frozen assertion passing unedited.

## Requirements → implementation → validation

| Req | Implementation | Validation |
| --- | -------------- | ---------- |
| FR-01 columns | `KitchenBoard`: three labelled columns + count pills + named empties + skeleton | kitchen.display SC-01 + kitchen.cashier unedited |
| FR-02 cards | KDS-scale `TicketCard`: StatusPill, quantity-emphasized lines, extras, 'Counter order' heads | hooks/names unedited; full-journey green |
| FR-03 age | `ticketAge.ts` (D2: bands 0–4/5–14/≥15, '3 min'/'1 h 05 min', never seconds, '—' fallback) | unit 7/7 |
| FR-04 actions | Exactly the two pinned controls, large targets, busy/disabled | kitchen.cashier/full-journey unedited |
| FR-05 live | Coalesced invalidation + LiveBadge + ReconnectingBanner (onStatus) + polite announcement | kitchen.display offline→recovery |
| FR-06 reload | Reads own the state; asserted | kitchen.display SC-02 |
| FR-07 branch | Frozen 'kitchen-branch' selector (multi-branch); none single | page unchanged mechanics |
| FR-08 refusals | Verbatim on the originating card (`data-refusal`) | existing posture preserved |
| FR-09 blindness | Money-free parser unchanged + address-free re-assert over live text | kitchen.display SC-03 |

## Implementation summary

New: `KitchenBoard.tsx`, `kitchen.surfaces.module.css`, `ticketAge.ts` (+7 unit tests),
`e2e/kitchen.display.test.ts` (4 tests), artifacts `specs/030-…`. Rebuilt: `TicketCard.tsx`
(KDS scale), recomposed `KitchenDashboardPage.tsx` (toolbar, banner, skeleton, announcement).
Unchanged byte-for-byte: `staffOpsClient.ts`, `useStaffOps.ts`, the other board components
from 029 (LiveBadge/ReconnectingBanner reused as-is).

## Design/Impeccable

`detect src` 0; KDS scale within the 022 tokens (larger radii `--radius-lg`, heavy
`--border-width-strong` borders, status pairs on chips, `tabular-nums`); state never
color-only (StatusPill labels + text-bearing 'late'); the D1 arrival fade collapses under
reduced motion; axe clean on the populated landscape board (baseline stays empty).

## Backend contracts used

NOT_REQUIRED — `get_kitchen_queue`/`start_preparation`/`mark_round_ready`/realtime consumed
as-is; the ticket-mirror audit (findings F3) confirmed the contract's shape at the SQL level;
no migration, no RPC change.

## Files changed

`src/features/staffOps/` (TicketCard, + KitchenBoard, + kitchen.surfaces.module.css,
+ ticketAge.ts), `src/routes/KitchenDashboardPage.tsx`, `tests/unit/ticketAge.test.ts`,
`e2e/kitchen.display.test.ts`, `docs/frontend-presentation-contracts.md` (§Phase 030),
`specs/030-kitchen-display-ux/*` (spec/plan/tasks/analysis/checklists ×2/evidence ×3).

## Results

- verify EXIT 0 (unit 387 / db 31 files / integration 7 files / build).
- Full Playwright **182/182 in 11.7 m** (178 pre-existing UNEDITED + 4 new).
- Responsive: landscape fluid fill; portrait/phone stacked (no overflow); axe floor clean.

## Fixes and convergence

One convergence round with two real items: (F1) the new column REGIONS broke the frozen
single-`section` pin — columns became DIVs keeping the data hooks/aria-label/headings (the
only product change in the round); (F2) transient full-run flakes proven environmental by the
stash-baseline comparison (disjoint sets, all green isolated, final full run clean) — no code
chased. No CRITICAL/HIGH findings open.

## Git checkpoint

`feat(030)` — focused commit on `main`, pushed to `origin/main` (standing auto-push rule).
Diff inspected: no secrets; the by-design-untracked set (`.agents/`, `.freebuff/`, `.zcode/`,
`.specify/frontend-autopilot/`, Master Plan, DESIGN.md) stayed untracked (a mid-run stash
cycle briefly staged them — unstaged before the commit; verified by `git status`).

## Remaining warnings / blocked items

- 4 pre-existing lint warnings (untouched files) + the pre-existing build chunk-size warning.
- The transient flake record (F2) stands as environmental context for future full runs.
- None blocked.
