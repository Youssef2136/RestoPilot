# Phase 09 Validation (specs/029-cashier-operations-ux)

## Gates

| Gate | Command | Result |
| ---- | ------- | ------ |
| Design literals | `npx impeccable detect src` | exit 0 (tokens only) |
| Format | `npm run format:check` | exit 0 |
| Lint | `npm run lint` | 0 errors (4 pre-existing warnings on untouched files) |
| Typecheck | `npm run typecheck` (tsc -b) | exit 0 |
| Unit | `npm run test:unit` | 380 passed / 30 files (incl. NEW roundBoard 11/11; staffops.client UNCHANGED green) |
| Database | `npm run test:db` | 31 files passed (after `db:reset -- --yes`; first attempt failed 23 on E2E residue — F5) |
| Integration | `npm run test:integration` | 7 files passed |
| Build | `vite build` | exit 0 (pre-existing chunk-size warning only) |
| **verify** | `npm run verify` | **EXIT 0** |
| E2E full | `npx playwright test` | **178/178 passed (10.6 min)** — 174 pre-existing (all frozen anchors UNEDITED) + 4 NEW cashier.operations |
| E2E new suite | `npx playwright test cashier.operations --project=chromium` | 4/4 passed (57.6 s): tablet chain (keyboard-only leg) + freshness, 390 px void journey, offline→reconnecting→recovery banner, axe floor on both routes |

## Frozen-anchor spot checks (all UNEDITED, all green in the full run)

- `kitchen.cashier` — board chain + `session-bill`/`bill-grand-total` ('Grand total …'), kitchen money-free.
- `bill.void.audit` — voided line with EXACTLY two figures + grand-total delta math; empty-reason disabled confirm; 'Cancel' recovery; audit trail.
- `realtime` — card-count polling, cross-browser state flip, fragment match, cue, Marina T1 (also used by the new suite under the same lock), money-free kitchen.
- `session.surfaces` — strict single role=status closure notice; pinned dialog names; zero 'Branch'/'Marina' text on single-branch pages.
- `full-journey` (fiona) — 'Rounds' nav strict-match; `data-ticket-state` kitchen; /Total/i on the locked card.
- `reports.surfaces` — the T2 void journey through the re-skinned board (t2Lock held).

## Responsive / a11y evidence

- Tablet 1024×768 board columns (regions + counts), 390 px stacked groups with the void journey operable (`board-390.png`).
- `expectNoNewViolations` (WCAG 2.2 AA automatable set) clean on a POPULATED `/dashboard/rounds` and on `/dashboard/sessions` — the axe baseline stays EMPTY.
- Polite live regions only; no focus effects on refetch; dialogs trap/restore (native `<dialog>`); touch targets via `--touch-target` on staff-critical actions.

## Evidence

`specs/029-cashier-operations-ux/evidence/`: board-tablet.png, board-incoming.png, card-modify.png, bill.png, board-390.png (collected with a run-then-delete script; DB reset afterwards).
