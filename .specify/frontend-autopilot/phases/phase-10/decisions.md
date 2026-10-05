# Phase 10 Decisions (specs/030-kitchen-display-ux)

## D1 — Alerting: VISUAL ONLY (user decision, clarify)
No sound, no notifications, ever, this phase (no outbound-alert contract exists). The alarm is
composition: the incoming column leads, its count is prominent, and a NEW ticket arrives with a
one-shot brand-surface fade (~2.4 s, tracked by ticket id so unrelated refetches never re-arm
it; reduced-motion collapses it via the global base.css rule).

## D2 — Ages: three named bands with honest granularity (user decision)
Minutes under the hour ('3 min'), hours+minutes after ('1 h 05 min'), NEVER seconds. Bands:
fresh 0–4 (muted), working 5–14 (normal), late ≥15 (warning pair + text-bearing 'late —').
No flashing; static escalation. The age derives from the payload's `created_at` — display
only; an unusable timestamp renders '—' (the board never fabricates).

## D3 — The `new` column is VISIBLE but NOT actionable (user decision)
The contract's queue carries the submission-mirror tickets and the pinned E2E read them; the
board labels the column 'Incoming (awaiting cashier)' with NO action button (accept is
cashier-only by RPC). The card heads 'Counter order' when `table_label` is null (the channel
sessions) — never 'Table null'. SC-01's journey therefore drives the accept through alice's
rounds board and proves dan's OPEN board moves columns LIVE.

## D4 — Wall-screen: fluid ≥1024, no separate breakpoint (user decision)
The KDS grid fills the viewport (auto-fit minmax(19rem,1fr)); portrait stacks (same DOM);
phone is a readable stacked fallback with a no-horizontal-overflow assertion — a documented
boundary, not a working surface.

## D5 — Columns are DIVs, not regions (convergence, F1)
The route's frozen kitchen.cashier pin reads `page.locator('section').innerText()` — a SINGLE
section. The first re-skin rendered the columns as `<section aria-label>` regions and broke
the pin (strict-mode 4 elements). The columns became DIVs keeping `data-kitchen-column` +
`aria-label` + real h2 headings (heading-first semantics; axe stayed clean), and the new
suite asserts the structure through the data hooks instead of regions. The frozen pin passes
UNEDITED.

## D6 — The full-suite chaos was not this phase's code (convergence, F2)
Two full runs (this phase's tree AND the stashed d5223dc baseline) each failed 4 UNRELATED
transient points under 2-worker contention (sign-in bursts/pacing on a slowed machine,
billing-region close races, entry-lock window ordering, a Marina T1 flip settle) — disjoint
test sets, all green isolated, and the final full run with everything applied passed
182/182 in 11.7 m. No code change was chased; the recorded remedy is re-run + the standing
isolated-rerun pattern.
