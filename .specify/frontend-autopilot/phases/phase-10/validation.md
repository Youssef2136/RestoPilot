# Phase 10 Validation (specs/030-kitchen-display-ux)

## Gates

| Gate | Command | Result |
| ---- | ------- | ------ |
| Design literals | `npx impeccable detect src` | exit 0 |
| Format/lint/typecheck | in `npm run verify` | 0 errors (4 pre-existing warnings on untouched files); tsc clean |
| Unit | `npm run test:unit` | 387 passed / 31 files (incl. NEW ticketAge 7/7; staffops.client UNCHANGED green) |
| Database | `npm run test:db` | 31 files passed (after db:reset) |
| Integration | `npm run test:integration` | 7 files passed |
| Build | `vite build` | exit 0 |
| **verify** | `npm run verify` | **EXIT 0** |
| E2E full | `npx playwright test` | **182/182 passed (11.7 m)** — 178 frozen-anchored tests (incl. the 4 from 029) UNEDITED + 4 NEW kitchen.display |
| E2E new suite | `npx playwright test kitchen.display --project=chromium` | 4/4 passed (isolated rerun after the transient full-run flakes; see findings F2) |

## Frozen-anchor spot checks (all UNEDITED, all green in the final full run)

- `kitchen.cashier` — dan's money-free single-`section` assertion (the F1 fix), the denial, the Downtown board journey.
- `realtime` — Marina T1 live ticket arrival + money-free + fixture restore under `withMarinaT1Lock`.
- `full-journey` (fiona) — the kitchen leg: `[data-ticket-state="accepted"]` → 'Start preparation' → preparing → 'Mark ready' → ready, hooks intact.
- `bill.void.audit`, `session.surfaces`, `reports.surfaces`, `cashier.operations` (029's suite) — all green.

## New-suite evidence (SC-01…SC-03)

1. Landscape 1280×800: real Marina T1 submission → ticket live on dan's board ('Hummus', honest age, 'Table T1', no 'Table null'); the cashier-accept split (no button on `new`; alice accepts on the rounds board; dan's OPEN board moves the column live); keyboard-only walk (focus+Enter) accepted→preparing→ready; the ready ticket offers no kitchen action; column structure via `data-kitchen-column` + aria-label; axe clean on the populated board.
2. Reload mid-service → the authoritative columns re-render (FR-06).
3. Offline → banner + last-known board; recovery → banner clears (the binding's SUBSCRIBED refetch).
4. Blindness: live board text matches NO /subtotal|tax|total|price/i and never contains 'Deliver to' or '12 Marina Walk'; 390px stacked fallback with no horizontal overflow.

## Evidence

`specs/030-kitchen-display-ux/evidence/`: kds-tablet.png, kds-empty.png, kds-390.png (collected with a run-then-delete script; DB reset afterwards).

## Transient flake record (convergence)

Two intermediate full runs failed disjoint transient sets under 2-worker contention (sign-in
burst pacing, bill-region close races, an entry-lock window overrun); the stash-baseline
comparison reproduced the SAME class of failures on the PRE-phase tree, and isolated reruns
of every implicated file were green. The final full run with the complete phase applied
passed 182/182 — no product-code change was made for any of them (details: findings F2).
