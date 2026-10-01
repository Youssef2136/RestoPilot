# Implementation Plan: Kitchen Display UX (Phase 10)

**Spec**: `specs/030-kitchen-display-ux/spec.md` (clarified D1–D4) · Work lands on `main`.

## Routes

`/dashboard/kitchen` unchanged (h1 'Kitchen' frozen via the E2E heading pin; branch selector label/id 'kitchen-branch' preserved).

## Architecture

- **No new shared layer, no data change** — `staffOpsClient.ts`/`useStaffOps.ts` stay UNCHANGED (the money-free parser is the FR-09 spine); the 029 components are consumed as-is: `LiveBadge` (dataUpdatedAt + pulse), `ReconnectingBanner` (aria-live polite + retry; kitchen has no role=status pin), plus the `staffOps.surfaces.module.css` conventions.
- **New pure helper + unit coverage**: `src/features/staffOps/ticketAge.ts` — `ticketAgeMinutes(createdAt, now)` (integer minutes), `formatTicketAge(minutes)` ('3 min' / '1 h 05 min' — never seconds, D2), `ticketAgeBand(minutes)` ('fresh' | 'working' | 'late' at 0–4 / 5–14 / ≥15). Unit-tested in `tests/unit/ticketAge.test.ts` (new file; `staffops.client` tests UNCHANGED).
- **`kitchen.surfaces.module.css`** (new): the KDS scale — larger radii/borders per the Master Plan (tokens only: `--radius-lg`, `--border-width-strong`, status pairs), fluid 3-column grid ≥1025px (auto-fit minmax(19rem,1fr)), portrait stacking <1025px (same DOM), card min-height/type-scale for two-metre reading, the one-shot NEW highlight (brand surface → fade via animation; reduced-motion collapses), the late treatment (warning-surface + text), the offline/posture treatments.
- **`KitchenBoard.tsx`** (new): the three-column board — `<section data-kitchen-column={key} aria-label={label}>` per column with a real h2 heading + count pill + the column's tickets (or its named empty). Columns: `new` → 'Incoming (awaiting cashier)' (D3), preparing (accepted+preparing merged, the contract's shape) → 'In preparation', ready → 'Ready to serve'. The board root carries `data-testid="kitchen-board"` and the compact→KDS density (NO compact opt-in — the kitchen is the comfortable-scale surface).
- **`TicketCard` rebuilt (same file, all hooks preserved)**: keeps `article[data-ticket-id][data-ticket-state]`; header 'Table {label}' when the table exists, else 'Counter order' (D3 edge: channel sessions have table_label null — the card must not print 'Table null'); the state rendered as a StatusPill (label-bearing, never color alone) + the age line (band class + formatted age, D2) + item lines (quantity prominent, extras on the line) + refusal (`data-refusal`, role=alert) + the action footer with the pinned names on large `Button` targets (`touchAction`). NEW-arrival highlight: a prop (`justArrived`) tinting the card once (the board tracks first-seen ids and clears after ~3s; reduced-motion collapses).
- **`KitchenDashboardPage` recomposed**: board + toolbar row (`LiveBadge` + branch selector) + `ReconnectingBanner` (onStatus wiring on the kitchen_tickets binding, the rounds binding stays default) + polite refresh announcement (count-derived, the 029 pattern) + loading skeleton (three skeleton columns) / hard-error (ErrorState posture paragraph preserved verbatim where pinned) / empty kitchen naming the columns. `data-kitchen-column` stays on the column roots (realtime + full-journey read card hooks, the column hook is asserted by the original 009 suite's shape — preserved regardless).
- **Reload recovery (FR-06)**: already the reads' posture (react-query mount fetch); the new E2E asserts it — no code beyond keeping no-cache-persistence (state from server only).

## Backend contracts used

**NOT_REQUIRED** — `get_kitchen_queue`/`start_preparation`/`mark_round_ready`/realtime tables consumed as-is. Zero client/data changes.

## Responsive

≥1025: three fluid columns filling the viewport (tablet landscape/wall). <1025: stacked columns (same DOM). 390px: readable stacked fallback (documented boundary — not a working surface; asserted only as readable).

## Accessibility

h2 column headings; large targets; StatusPill + text bands (never color alone); polite live regions; reduced-motion honored (the highlight fade, the pulse); axe floor clean on the populated board; focus never stolen by refetch.

## Loading / empty / error states

Board: skeleton columns (loading) / 'The kitchen queue is empty.' naming the columns when overall-empty / populated / reconnecting banner / stale retry / 'The queue could not be loaded…' (hard error, pinned text preserved). Card: busy / refusal verbatim. Age: '—' when created_at is missing (never fabricated).

## Testing strategy

- **Unit**: `tests/unit/ticketAge.test.ts` (formatting at the boundaries 4/5/14/15/59/60+, band mapping, null-safety). `tests/unit/staffops.client.test.ts` UNCHANGED green.
- **E2E preserved UNEDITED**: `kitchen.cashier.test.ts` (dan's money-free + denial; the Downtown board journey), `realtime.test.ts` (Marina T1 live arrival + money-free + fixture restore), `full-journey.test.ts` (fiona: accepted → preparing → ready via the pinned names/hooks).
- **E2E new** `e2e/kitchen.display.test.ts` (serial, one worker; Marina T1 under `withMarinaT1Lock` + entry under `withEntryLock` — the 029 pattern):
  1. Landscape tablet (1280×800): real Marina T1 customer round → ticket arrives LIVE with the brief highlight → keyboard-only walk 'Start preparation' → preparing, 'Mark ready' → ready; column counts tick; axe clean on the populated board.
  2. Reload mid-service: reload → the authoritative columns re-render (the walked ticket stays in its server-true column).
  3. Offline: `setOffline(true)` → banner + last-known board readable; `setOffline(false)` → banner clears (toPass, generous).
  4. Money/address absence re-assert over the live board text (no money words, no 'Deliver to', '12 Marina Walk' never appears) + the 390px readable fallback smoke.
- **Gates**: db:reset → verify → full Playwright (background + sleep 570) → `impeccable detect src` 0.

## Design strategy

KDS scale within the 022 system: the board reads as three slabs — heavy borders, large radii, big counts; cards carry strong state chips and honest ages; the incoming column leads with the count emphasized. Impeccable: `shape` (legibility/glanceability/touch) → `critique` (cook at two metres) → `audit` (contrast/target/motion) → `harden` (offline/stale) → `polish`.

## Migration notes (ledger)

Expected §Phase 030 additions: kitchen board (columns+counts+empties), KDS card scale (chips/age bands/counter orders), freshness + banner on the kitchen route, skeleton loading, reload/offline postures, phone boundary note. NO frozen anchor moves anticipated; deviations recorded.

## Risks

- Column-label pins: the 009-era suite asserts `data-kitchen-column` VALUES only via the DOM shape (no label text pins on the kitchen route) — the renamed headings are safe; the h1 'Kitchen' and the money-free assertion are the live pins.
- The Marina T1 lock contention (realtime + cashier.operations + the new suite) — serial-file discipline + the state-agnostic flip (proven twice).
- The highlight timer must never re-trigger on unrelated refetches (track seen ids, clear by id, not by render).
