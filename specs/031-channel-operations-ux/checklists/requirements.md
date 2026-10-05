# Requirements Checklist — 031-channel-operations-ux

Purpose: the Master Plan's FR/UX/A11y/responsive/security rows for Phase 11, each with its acceptance evidence location. Filled during ANALYZE and re-checked at VALIDATE.

| # | Requirement (source) | Acceptance | Evidence |
| --- | --- | --- | --- |
| R1 | FR-01 channel identity on session bar, round cards, bill, session list | chip present + 'Counter session' marker; entry assertions pass | channel.operations E2E; session.surfaces preserved |
| R2 | FR-02 cutoff before the attempt: disabled add + aria-describedby + announcement; server refusal verbatim + cart preserved | disabled `Add to cart` with linked notice; 'already on its way' alert; cart line intact | channel.operations T-journey; session.surfaces FR-011 (migrated per D1) |
| R3 | FR-03 dispatch/completion only in legal states + completion confirmation | one-tap dispatch at ready only; dialog copy exact; completion only after confirm | channel.operations completion test |
| R4 | FR-04 address only on permitted surfaces | 'Deliver to' on customer echo + bill/round reads; never on kitchen | kitchen blindness assertion; existing pins |
| R5 | FR-05 channel filter, default All, honest counts | radio group; default identical board; narrowing/restoring assertions | channel.operations filter test |
| R6 | FR-06 channel refusals verbatim | 'already on its way' rendered from the server, never paraphrased | FR-011 pin |
| R7 | FR-07 status progression for dispatched/delivered | timeline milestones per channel; aria-current on reached step | channel.operations timeline assertions |
| R8 | A11y: radio semantics preserved (entry) + real radios on the filter; disabled not styled-only; polite regions (never role="status" on customer page); no color-only channel coding | axe clean at 390 px closed state + rounds page; DOM checks | channel.operations axe + unit |
| R9 | Responsive: 390 px customer no overflow; filter on narrow cashier; kitchen untouched | 390 px scroll-width check; board at 1024/390 | channel.operations responsive |
| R10 | Security: no new read paths; address nowhere unauthorized; token/cart preservation rules intact | unit channel.entry untouched+green; blindness assertion | unit + E2E |
| R11 | No backend changes of any kind | diff contains no SQL/types/RPC signatures | git diff at checkpoint |
| R12 | Frozen anchors pass unedited (with D1's recorded migration only) | session.surfaces, customer.menu, cashier.operations, kitchen.cashier, kitchen.display, full-journey, bill.void.audit, realtime, management/menu/tax/reports/platform/auth | full Playwright log |
