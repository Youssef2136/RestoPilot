# Checklist: Phase 09 — Fidelity to frozen contracts (specs/029-cashier-operations-ux)

The pinned assertions this phase must pass UNEDITED. Check each anchor against the re-skinned DOM before verify.

## Attributes / hooks (realtime + journeys)
- [ ] `article[data-round-id]`, `article[data-round-state="…"]`, `article[data-voided="true"]` on every card (RoundCard root).
- [ ] `data-ticket-*` kitchen hooks untouched (TicketCard not modified).
- [ ] `[data-live-cue]` role=status 'A new order arrived.' + Dismiss kept on /dashboard.
- [ ] `data-refusal` paragraph on refusals.

## Text pins
- [ ] Card heading keeps the 'round <id8>' fragment shape (realtime's /round ([0-9a-f]{8})/).
- [ ] Locked card contains /Total/i with a digit (full-journey) — 'Subtotal … tax …' money line stays.
- [ ] Voided card contains the void reason (`data-voided-note`).
- [ ] Button names verbatim: 'Accept round', 'Start preparation', 'Mark ready', 'Send out for delivery', 'Mark completed', 'Lock round', 'Reduce one', 'Remove line', 'Void round', 'Confirm void', 'Cancel', 'Show bill' (label of the checkbox), 'Void reason' (label of the input), 'Dismiss'.
- [ ] Bill testids: `session-bill` (section aria-label 'Session bill'), `bill-grand-total` ('Grand total ' + ONE figure), `bill-voided-section`, `data-bill-voided-round` (line = exactly TWO figures + reason), `bill-address`, `bill-participants`, `data-bill-round`, `data-bill-lines`, `data-bill-tax-lines`.
- [ ] Bill voided line text keeps '(was {state})' shape and the reason.
- [ ] Sessions: h2 'Open sessions — {branch}'; rows are listitems with participants; 'Close session for {label}', 'Confirm closing {label}', 'Keep it open'; the closure notice is the ONLY role=status on the page.
- [ ] Loading/error texts preserved where pinned ('Loading the branch rounds…', 'The rounds could not be loaded…', 'Loading the bill…', 'The bill could not be loaded.', 'Loading the open sessions…', 'No open sessions at this branch.').
- [ ] Single-branch pages keep zero 'Branch' label and zero 'Marina' text (carla/eve pins on /dashboard/sessions).
- [ ] dan's denial on /dashboard/rounds and /dashboard/sessions preserved (h1 'Not authorized' posture).

## Data contracts
- [ ] `staffOpsClient.ts` + `useStaffOps.ts` unchanged (money-free parser intact); `tests/unit/staffops.client.test.ts` passes UNCHANGED.
- [ ] Realtime invalidation set unchanged (branchRounds + kitchenQueue + all sessionBill keys on rounds events).
- [ ] No money on any kitchen surface; no new RPCs.

## Gates
- [ ] `npm run db:reset -- --yes` before verify AND before the full Playwright run.
- [ ] `npm run verify` EXIT 0; full Playwright green (tablet-chromium isolated rerun on transient crash); `npx impeccable detect src` 0.
- [ ] Prettier on every new/edited file before verify.
