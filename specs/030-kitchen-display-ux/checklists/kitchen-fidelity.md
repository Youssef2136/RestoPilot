# Checklist: Phase 10 — Fidelity to frozen contracts (specs/030-kitchen-display-ux)

## Hooks / names (must survive the re-skin)
- [ ] `article[data-ticket-id]`, `article[data-ticket-state="accepted|preparing|ready"]` roots.
- [ ] `data-kitchen-column={new|preparing|ready}` on the column roots.
- [ ] Button names verbatim: 'Start preparation', 'Mark ready'.
- [ ] `data-refusal` on refusals; h1 'Kitchen' intact; branch select label/id 'kitchen-branch'.
- [ ] Loading/error texts preserved: 'Loading the kitchen queue…' / 'The queue could not be loaded. Reload the page and try again.' (role=alert).

## Blindness (asserted in frozen + new tests)
- [ ] `section` innerText on the kitchen route matches NO /subtotal|tax|total|price/i (kitchen.cashier + realtime) — the re-skin must not add any such word (watch helper copy: 'total'/'price' forbidden in kitchen copy too).
- [ ] No delivery address ('12 Marina Walk') anywhere on the route (new suite).
- [ ] staffops.client UNCHANGED (assertMoneyFree intact); useStaffOps UNCHANGED.

## Test-suite integrity
- [ ] kitchen.cashier.test.ts UNEDITED and green.
- [ ] realtime.test.ts UNEDITED and green (Marina T1 lock discipline respected).
- [ ] full-journey.test.ts UNEDITED and green (fiona via signInAsFiona).
- [ ] axe baseline stays EMPTY (new kitchen scan clean; all motion collapsed under reduced-motion).

## Gates
- [ ] db:reset before verify AND before the full Playwright run.
- [ ] verify EXIT 0; full Playwright green; `impeccable detect src` 0; prettier on every touched file.
