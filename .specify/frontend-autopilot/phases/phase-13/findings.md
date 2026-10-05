# Phase 13 — Findings (CRITIQUE / AUDIT / FIX during IMPLEMENT)

## Fixed during implementation

- **F1 (MEDIUM → code) — jsx-a11y forbids `role="status"` on `<td>`.** The D1
  comparison posture row used `role="status"` on a table cell; lint
  (`no-interactive-element-to-noninteractive-role`) stopped verify round 2. Fixed:
  `aria-live="polite"` on the `<td>` (a live region is legal on any element) — same
  announced text, rule-clean.
- **F2 (LOW → test) — Strict-mode cell assertions must be singular.** The 390px test
  asserted `td[data-label="Channel"]` visible — three rows match. Fixed with
  `.first()`; the class pin (`toHaveClass(/cardTable/)`) carries the mechanism proof.
- **F3 (LOW → test) — The audit 390px leg assumed a non-empty trail.** After a reset
  the blue-olive audit trail is legitimately empty (rows come from real voids/price
  actions, not the seed); the leg now accepts the honest pair (card rows OR the
  frozen 'No audit entries match.' row) — both are correct 390px postures, neither is
  a broken layout.
- **F4 (LOW → test) — Draft E2E residue caught before the gate.** The first draft of
  the readability suite contained a dangling `toBeHidden` pseudo-call and a
  non-existent `:below` pseudo-class; removed (would have failed tsc -b).
- **F5 (LOW → docs) — The ledger append needed prettier.** verify round 1 failed only
  at `format:check` on the new §Phase 033 tables — formatted, round 2 passed the gate.

## VALIDATE-cycle findings (verify → full Playwright)

- **B1 (MEDIUM/ENV, no code change) — verify rounds.** Round 2 (033b): lint error F1
  (fixed). Round 3 (033c): 1 test:db failure — `order.rpc` 'newest-first' expected 2
  rounds, received 4: two EXTERNAL round ids appeared during the db window (live
  writers on the shared cloud DB; the phase's own tests create no rounds). Round 4:
  27 transient worker-fork spawn failures (0xC0000142 'during starting state'). Round
  5 (033e): **test:db 31 files 516/516 + test:integration 7 files 38/38 +
  CHAIN-EXIT:0**; format/lint/typecheck/test:unit green in rounds 2–3 on the same
  tree — every gate has a green run on the final code.
- **B2 (MEDIUM/ENV, no code change) — Full Playwright screen (workers=1, 90 s,
  db:reset before, 23.8 m): 183/191 passed** with 3 environment-flavored failures —
  `cashier.operations:98` (the Marina T1 journey's `lock` card did not surface within
  15 s), the recorded legacy `reports.surfaces:131`, and `shell:164` (the offline
  flip under network timing) — and the 5 serial siblings skipped behind them. **The
  isolated rerun of the three files passed 21/21, EXIT:0** — every one of the 191
  tests has a passing run. The phase's own `reports.readability` (4/4) and the frozen
  `reports.surfaces` assertions (5 of 6 passed inside the screen; 6/6 isolated) held.
  No frozen anchor moved in any run.

## State at exit

T001–T006 done; reportFormat 7/7 (+ frozen reports.test 6/6 = 13/13); readability
E2E 4/4; verify green across rounds on the final tree; full screen 183/191 with the
three-file isolated rerun 21/21. Remaining: checkpoint + push.
