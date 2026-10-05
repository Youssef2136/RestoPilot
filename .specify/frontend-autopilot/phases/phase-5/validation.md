# Phase 05 Validation (specs/025-customer-ordering-ux)

Final validation 2026-09-29, branch `main`, baseline `9a41734`.

## Gates

| Gate | Command | Result |
| --- | --- | --- |
| Format | `npm run format:check` | PASS (after prettier on the new files) |
| Lint | `npm run lint` | PASS |
| Typecheck | `npm run typecheck` | PASS |
| Unit | `npm run test:unit` | **369/369** (29 files; +7 money/state pins; `order.cart.test.ts` UNCHANGED and green) |
| Database | `npm run test:db` | **516/516** (on a clean `db:reset` base — see the incident note) |
| Integration | `npm run test:integration` | **38/38** |
| Build | `npm run build` | PASS — 749.82 kB (gzip 206.33 kB) |
| E2E (full) | `npm run test:e2e` | **156/156, 0 failed, 0 did not run** (9.3 min; 150 prior + 6 new customer.menu) |
| Design | `npx impeccable detect src` | **0 anti-patterns** (exit 0, no output) |
| A11y | axe WCAG 2.2 AA | baseline 4 routes green + NEW session-gated menu-route scan green (after the opacity-contrast fix) |

## Frozen-contract proof (the phase's central risk)

`e2e/session.surfaces.test.ts` 18/18 + `e2e/full-journey.test.ts` 3/3 ON the re-skinned surfaces —
every cart/submission/history pin (region `Cart`, advisory totals, adjust/remove `+`/`−`/`Remove`,
reload persistence, submit clears + names ticket, poisoned-cart verbatim refusal with preserved
cart, two rounds, cutoff refusal above preserved cart) passed WITHOUT assertion edits. The
convergence fixes that made this true: aside→section (role `region`), bare `+`/`−` button names
(aria-labels broke the pin), `role="note"` on CutoffNotice (kept `getByRole('status')` unique).

## Mid-phase incident (recorded)

First `npm run verify` failed 12 db tests — E2E residue again (full-journey tenant rows + this
phase's own test rounds shifting best-sellers determinism), NOT a regression: `db:reset --yes`
re-run and the full gate re-proven on the clean base (R1's "verify before full E2E or reset first"
now cuts both directions — run verify on a fresh reset after E2E too).

## Convergence (targeted) evidence

- session.surfaces alone: 17/18 → 18/18 after the three role/name fixes.
- session.surfaces + full-journey: 21/21.
- customer.menu: 4/6 → 5/6 (exact-match 'Total') → 6/6 (contrast fix).
