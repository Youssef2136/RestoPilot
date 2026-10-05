# Phase 11 — Findings (CRITIQUE / AUDIT / FIX during IMPLEMENT)

## Fixed during implementation

- **F1 (HIGH → code) — Mirror parity with the server's cutoff clause.** The pre-implementation draft of `cutoffCrossed` excluded voided rounds; the source SQL shows the server's EXISTS clause reads ALL session rounds (no voided filter) and the customer payload carries no voided flag. Fixed: the mirror checks every round (checklist F4 rewritten; comment cites the migration). Evidence: unit parity test.
- **F2 (MEDIUM → code) — Timeline/chip double render.** The first RoundsHistory cut rendered both the raw state chip (heading) and the milestone story — a mixed claim on one card. Fixed: heading chip suppressed when the state maps onto the timeline (one honest render, conditional).
- **F3 (LOW → test) — Blindness test needed a real ticket.** The first kitchen-leg draft asserted blindness only after a JS catch on ticket attachment; tightened to assert the ticket's appearance is NOT required for the blindness contract (count-of-zero over address substrings + 'Counter order' presence are the assertions), per the D6 positive-assertion framing.

## Audit (Impeccable-equivalent passes shipped)

- Disabled-state semantics audit (D1): real `disabled`, `aria-describedby` → `#cutoff-notice` (renders whenever disabled, dine-in path renders neither); quantity/cart/submit stay enabled; nothing aria-disabled; axe at 390 px on the closed state.
- Refusal-preservation audit (checklist focus): SubmitBar untouched; channel.entry client + unit suite untouched; entry E2E pins untouched; FR-011 migrated mechanically per D1 with the contract assertions identical.
- Consistency audit: one chip component everywhere (indicator + staff card); one timeline vocabulary from cutoffState (no parallel label maps); filter uses the same channel words as the entry radios.

## Deferred / accepted (MEDIUM/LOW, recorded for the report)

- **A1 (LOW)** — CompletionConfirmDialog restates the bound address ('Deliver to …') inside the dialog body; a purely aesthetic call; kept because the D3 review noted the cashier's hand is near the terminal button when confirming and the address is the round's identity here. Not a pin.
- **A2 (LOW/ENV)** — The channel.operations journey is long (~2 staff contexts, four transitions, two sign-ins); it inherits the suite's proven environmental flake posture (isolated rerun + clean full run). Rerun protocol: per-file isolated first, full-run last.

## VALIDATE-cycle findings (targeted E2E → verify → full Playwright)

- **A3 (MEDIUM → code) — axe target-size on the 025 cart micro-buttons.** The delivery journey's default-viewport axe scan failed on `._smallButton` at 19.8×24 px (target-size + target-offset 23.6). Fixed: `.smallButton` `min-width` + `min-height` 1.5rem — 24×24 targets satisfy both checks regardless of neighbors. Owned here (pre-existing 025 finding surfaced by this phase's new scan); the owning-phase note lives in the ledger's 031 record.
- **A4 (test) — False-pass binding in the completion leg.** `cardIn2` filtered by the '9 Channel Road' PREFIX, which also matches every stale completed card previous reruns left on the shared dev board — the `completed` assertion could pass without our completion landing (the round stayed `out_for_delivery` in the DB). Fixed: bind by the run's FULL unique address + await the `mark_completed` RPC response (2xx) before the completed-card assertion and `staff2.close()` (the recorded cancellation lesson).
- **A5 (test) — Takeaway staff cards had no run-unique surface.** The takeaway card shows no address/name; text-filter + `.first()` can latch onto a stale residue card stuck in an early state (the recorded wrong-round 200). Fixed: extract the round id from the customer's own `get_session_rounds` response (predicate rejects the pre-submit empty poll) and bind every staff interaction by `data-round-id`.
- **A6 (test) — Timeline label assertions were vacuous.** `history.getByText('Delivered')` matches a milestone LABEL that always renders; the honest read is the CURRENT step. Fixed: all three milestone assertions read `[aria-current="step"]` (`toHaveText` 'On its way' / 'Delivered' / 'Ready for pickup').
- **A7 (test) — Channel-filter emptiness raced under the parallel full suite.** The Dine-in view asserted a board-wide count of 0 + the named empty — false whenever another concurrently-running spec's dine-in round sat on the SHARED board (fullyParallel). Fixed: emptiness claimed only for what the test owns (its round by address) plus the concurrency-proof property (no 'Deliver to' card renders under Dine-in, whoever's rounds exist); the absolute-empty assertions removed.
- **A8 (test) — My own edit dropped the takeaway cart-add lines** (the data-round-id refactor's oldString swallowed them): the submit button stayed disabled and the leg timed out before any staff action — the DB 'missing round' mystery resolved as test bug, not server behavior. Restored.
- **B1 (MEDIUM/ENV, no code change) — Cloud latency degraded the gate runs.** verify round 1: 14 test:db failures, all 30s timeouts + transaction-abort cascades (tax/management/menu suites at ~4–10× normal latency); latency probe confirmed ~100 ms recovery; round 2 PASSED. Full Playwright round 1 (2 workers, 30 s): 179/185 with realtime:172 + reports.surfaces:131 failing at varying late-flow steps (sign-in bursts, board renders, guard deny-during-load) while siblings with the same identities passed; direct auth REST 200 ×3 and DB roles verified correct (alice=owner). Round 2 (workers=1, timeout=90 s): 182/185, only reports.surfaces:131 failing; its ISOLATED rerun at default timeouts PASSED (27.2 s). Classification: ENVIRONMENT — the old suites' 30 s expectations bind under today's degraded cloud; no code touched by this phase; every one of the 185 tests has a passing run.
- **A2′ (LOW/ENV, protocol note)** — the full-suite gate is accepted at 182/185 + isolated passing reruns of the two environment-bound specs, with the run parameters recorded (`--workers=1 --timeout=90000` round; default-timeout isolated rerun). No frozen anchor moved in any run.

## State at exit

T001–T010 done; cutoffState 11/11; roundBoard 14/14; channel.operations 3/3 (also under workers=1/90 s); verify PASSED (format/lint/typecheck/unit 32/db 31/integration 7/build; 4 pre-existing lint warnings in untouched files); full Playwright 182/185 + isolated greens for the two environment-bound legacy specs. Remaining: checkpoint + push.
