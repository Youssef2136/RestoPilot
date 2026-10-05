# Phase 11 Baseline — Delivery & Takeaway Channel UX (031)

**Recorded**: 2026-10-01 · **Git**: branch `main`, HEAD `9959364` (feat(030)), in sync with `origin/main`.
Tree clean except the by-design untracked set (`.agents/`, `.freebuff/`, `.specify/frontend-autopilot/`, `.zcode/`, `DESIGN.md`, `RestoPilot-Frontend-Master-Plan.md`).
**Predecessors**: 05 (customer ordering), 09 (cashier board), 10 (kitchen) — all checkpointed and pushed.

## What already exists (INSPECT — this phase REFINES, never re-implements)

### Customer (`/r/:slug/menu`)
- `SessionIndicator` (features/session/components): channel chip text + read-only address echo for delivery (`session.table_id === null` branch); dine-in shows `Table {label}`. `aria-live="polite"` paragraphs; the unavailable-session state renders the ONLY role="status"-safe recovery hint via text (the page's single role="status" belongs to the submit-success region — strict pin).
- `CutoffNotice` (features/order/components, spec 025 T008): state text BEFORE the attempt — "Once your delivery is on its way…"/"Once your takeaway order has been handed over…" + "Items already in your cart are safe." — `role="note"` deliberately (never role="status"). Dine-in → null. It does NOT disable anything yet (FR-02's gap).
- `CartRegion`: frozen `region` named `Cart`; itemized lines with adjust/remove; advisory TotalsPanel; `SubmitBar` (verbatim refusal alert, ticket-naming success status). The delivery-cutoff E2E pin (session.surfaces FR-011) adds a line ABOVE the cutoff and submits a second one AFTER dispatch → expects the verbatim 'already on its way' alert + preserved cart. **Any disabled-add design must keep the submit path live.**
- `MenuSections` → `ItemCard`: quantity input + `Add to cart` button (+ per-card `aria-live="polite"` announcement); unavailable items already render their own disabled posture.
- `RoundsHistory`: region named `Your rounds`; per-round heading 'Round N — time' + `roundStateLabel` chip (new='Sent to kitchen', accepted='Accepted', preparing='Being prepared', ready='Ready', lock='Served'); captured money through TotalsPanel; 'Updated Xs ago' + Refresh affordance (FR-09 pin). No timeline for dispatched/delivered (FR-07's gap). 10 s poll IS the customer's live status.

### Cashier (`/dashboard/rounds`)
- `RoundsBoard`: `data-testid="rounds-board"`; six state groups as labelled `<section>`s with counts + 'Nothing waiting here right now.' empties; unknown states append. No channel filter (FR-05's gap).
- `RoundCard`: `article[data-round-id][data-round-state][data-voided]`; header 'Table X / channel — round <id8>'; `data-channel-chip` span (channelLabel); delivery address line 'Deliver to: …' (contract-permitted); inline modify (pinned 'Reduce one'/'Remove line'); StateChip; cued badge; refusal verbatim; `TransitionActions` (pinned names: 'Accept round', 'Start preparation', 'Mark ready', 'Lock round' (delivery excluded), 'Send out for delivery' (delivery+ready), 'Mark completed' (delivery+out_for_delivery)); two-step void with channel boundaries (`isVoidable`).
- `BillPanel`: heading names table or channel; `data-testid="bill-address"` 'Deliver to: …' (delivery only); participants; per-round lines; tax lines by name; voided section (two-figure pin); grand total (one-figure pin).
- `roundGroups.ts`: group order incl. 'Out for delivery'/'Delivered'; `isVoidable` channel matrix; `pickRefusal`.
- `staffOpsClient`: `mark_out_for_delivery`, `mark_completed` RPCs EXIST (010 §3); `useStaffOps` routes all six transitions.

### Kitchen (`/dashboard/kitchen`)
- Channel-blind by contract: `get_kitchen_queue` joins `dining_tables` only; `table_id NULL → 'Counter order'`; NO address, NO money, NO session_type. 030 re-skin kept it so; kitchen.display E2E already asserts '12 Marina Walk' never appears. Phase 11 changes NO kitchen code — positive assertion added instead.

### Sessions oversight (DashboardPage → `BranchSessionsPanel`)
- `get_branch_open_sessions` returns ALL open sessions (dine-in AND channel) but the payload carries NO `session_type` — only id/table_id/table_label/opened_at/participants. Channel sessions render today with an EMPTY main line (table_label null) — a legibility gap. Per-channel identity on THIS list is impossible without a payload change → contract conflict §3.8, recorded, not implemented (D5: neutral 'Counter session' marker).

### Entry (`ChannelSelector`)
- Radio group dine-in/delivery/takeaway (Phase 04 semantics, preserved); `open_session_channel` mapping + refusal preservation live in `sessionClient.ts`/`useSession.ts` with unit tests (`channel.entry` refusal mapping, token/cart preservation) — preserved untouched.

## Contracts in force (verified)
- `submit_round` cutoffs: delivery → any round `out_for_delivery`/`completed`; takeaway → any round `ready`/`lock`; dine-in never. Server refusals verbatim; unavailable-session refusal clears token+cart, cutoff refusal preserves both.
- `mark_out_for_delivery` / `mark_completed`: delivery-only, kitchen denied, audited.
- Delivery address: set once at entry, ≤200 chars, null for non-delivery; permitted surfaces = customer echo + staff bill/round reads. No write path — no address editing (out of scope).
- No new states; no rider/ETA/driver concepts; no per-channel pricing.

## Tooling facts (carried)
- verify = format:check + lint + typecheck + test:unit + test:db + test:integration + build; `npm run db:reset -- --yes` before verify and before ANY Playwright run; Playwright ~11–18 min (2 workers) → background + sleep 590; 182 E2E tests currently green; lint has 4 pre-existing warnings on untouched files + a pre-existing chunk warning; dev server may be down after Freebuff restarts (check :5173, restart with `(npm run dev > /tmp/restopilot-dev.log 2>&1 &)`); push needs the saved postBuffer/lowSpeed settings; prettier on every touched file.

## Prerequisite check
- Phases 05/09/10 merged and pushed ✓ (checkpoint `9959364` = 030).
- All Phase 11 dependencies are reads/RPCs that exist ✓ → backend impact **ALREADY_SUPPORTED / NOT_REQUIRED**; the one payload gap (sessions list `session_type`) is recorded as a contract conflict, worked around presentationally (D5), NOT patched in SQL.
- Frozen anchors to hold unedited: session.surfaces channel block (entry ×2, cutoff journey), customer.menu (region 'Your rounds', single role="status", 390px, axe), cashier.operations, kitchen.cashier, kitchen.display, full-journey, bill.void.audit, realtime.
