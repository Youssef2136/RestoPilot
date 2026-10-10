# specs/037 — Quickstart (Human Verification Walkthroughs)

## quickstart.md

Five human walkthroughs (W1–W5) — scripts frozen here, execution is
human-owned (the same EXC-001-style policy as Phase 15). The automated suites
prove everything mechanical; these prove the felt experience.

- **W1 — The cashier on bad Wi-Fi.** Start a session on the cashier dashboard,
  then (using a network throttler, not the test harness) degrade the network to
  offline. Expect: the board stays readable with the staleness banner, actions
  are disabled with the offline reason, no phantom success; reconnect and expect
  reconciliation without duplicates.
- **W2 — The empty tenant's first day.** Sign in as a fresh owner with no
  branches/menu configured. Expect: every surface shows a designed empty state
  naming the next action, none of which reads as an error.
- **W3 — The failed order on the guest's phone.** On a 390 px viewport, fill a
  cart, submit, and intercept the failure (devtools throttling + request
  blocking). Expect: cart intact, verbatim refusal at the action site, plain
  recovery, no lost input.
- **W4 — The expired session.** While reading a management page, let the session
  expire (or force it server-side) and interact. Expect: the sane fallback with
  an explanation, re-authentication returns the user to the attempted page.
- **W5 — The comparison with a dead branch.** Open the reports comparison with
  one branch's data unreachable (blocked request). Expect: other branches render,
  the failed branch is named with a retry, nothing shows as zero.

Each walkthrough records its result in the phase report; failures are findings
with owners, not silent pass-throughs.
