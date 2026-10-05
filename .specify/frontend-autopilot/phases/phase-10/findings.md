# Phase 10 Findings (specs/030-kitchen-display-ux)

## F1 — CRITICAL→fixed: the kitchen route's single-`section` pin
`e2e/kitchen.cashier.test.ts` reads `page.locator('section').innerText()` for its money-free
assertion — ONE section. Rendering the three columns as `<section>` regions broke it
(strict-mode). Fixed by making the columns DIVs (keeping `data-kitchen-column`, `aria-label`,
real h2 headings); the frozen assertion passes UNEDITED and the new suite asserts the board
through the data hooks. Lesson recorded: before adding regions to ANY route, grep the frozen
suites for `locator('section')` / role lookups that count them.

## F2 — Transient full-suite failures ≠ regressions (the two-baseline proof)
Full run 2 (with 030): 7 failures — 4 in sign-in paths (burst pacing), 2 in the bill regions
(close + void refetch races), 1 entry-lock window (platform disable overran its 120 s budget
against a slowed machine). Full run 3 (with 030): 4 failures, DISJOINT set. Stash-baseline
full run at d5223dc: 4 failures — again disjoint, including one in MY kitchen.display file
(aria-label race) proving the flake is environmental. Final full run with 030 applied:
182/182 in 11.7 m. Remedy: isolated reruns (all green), then one clean full run; no code
change chased any of them. The machine is ~1.7× slower than the phase-9 runs (10.6 → 18.6 m
contention windows); the standing background+sleep pattern absorbed it.

## F3 — `submit_round` inserts kitchen_tickets at 'new' for EVERY channel (audited)
Verified in both migration bodies (20260920091000 §6 and the 20260920160000 channel
re-application): dine-in, delivery, and takeaway submissions all insert the ticket mirror at
'new' and `accept_round` advances it — the D3 'awaiting cashier' presentation is faithful to
the contract's single machine, and no channel-specific ticket logic exists (channel-blindness
confirmed at the SQL level, not just the payload level).

## F4 — The channel demo sessions are customer-surface-fed, not seed-fed
The seeded delivery/takeaway demo sessions (…8003/…8004) carry dev tokens and participants
but NO rounds; driving a ticket through them in E2E would require the token-entry route the
suites deliberately avoid. The blindness re-assert instead runs a real dine-in journey and
globally asserts the seeded address string ('12 Marina Walk') never renders on the kitchen
route — a stronger, honest check of the same requirement.

## F5 — `toHaveAttribute` on a div's `aria-label` reads null, not '' (E2E nit)
During the transient-run diagnosis, one failed screenshot showed `aria-label` as "unexpected
value null" on a still-hydrating column — the assertion's own retry absorbed it in every
green run; no change needed (Playwright retries attribute reads inside toBeVisible-driven
flows). Recorded so a future reader does not mistake it for a product defect.

## F6 — verify needs db:reset even after isolated E2E runs (re-confirmed)
The phase-9 F5 lesson re-verified: every verify attempt in this phase ran after a fresh
`db:reset -- --yes` and passed first try; the one run attempted without it (phase-9 history)
failed 23 db tests. Standing rule stands.
