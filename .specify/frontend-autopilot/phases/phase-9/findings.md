# Phase 09 Findings (specs/029-cashier-operations-ux)

## F1 — Strict-mode: sibling void dialogs collide on a page-level 'Void reason' (own E2E, resolved)
With more than one lock-state card on the board, `page.getByLabel('Void reason')` resolves TWO
inputs (every card owns a closed dialog). The suite's own first run caught it; fix scoped every
dialog interaction to `article[data-round-id="<id>"]` (the bill.void.audit pattern). No product
code change — the E2E now models real multi-card usage.

## F2 — modify_round_line permits removing the last surviving line (documented, not a defect)
The evidence collector assumed a remove-of-last-line refusal; the migration (§6,
`20260920150000_round_lifecycle.sql`) allows it — only `ready`/`lock` states and unknown
lines refuse ('This round is not available for that action.'). The spec's FR-03 "consequence
messaging" claim stays honest: the helper copy warns BEFORE the attempt, the UI never invents
a refusal, and the refusal ROUTING (`pickRefusal`) is unit-covered for every real refusal
shape (state guards, void boundaries, permission). Recorded so the generic-refusal pin is not
misread as covering removal.

## F3 — fiona uses `signInAsFiona` (the full-body fiona lock)
The summary's standing rule suggested fiona sign-ins must wrap the whole body; in fact
`e2e/helpers/signInAs.ts` exports `signInAsFiona` (the fionaLock lives inside the helper), and
the only fiona file (full-journey) already uses it. Our suite uses carla/alice — no shared-
identity interference. Recorded to prevent a future suite from raw-`signInAs`-ing fiona.

## F4 — The 'Rounds' nav collision was REAL and avoided pre-emptively
full-journey's fiona `getByRole('link', { name: 'Rounds' })` would strict-collide with any cue
link containing 'Rounds'. The cue link ships as 'Show the new order'. Zero frozen anchors moved.

## F5 — verify's db gate requires db:reset even when the E2E run looked "innocent"
The first verify attempt failed 23 db tests: the standalone operations run (and its evidence
collector) left journey residue behind. The reset-before-verify rule is now confirmed to apply
to PARTIAL E2E runs too, not just full runs. verify re-run clean after reset.

## F6 — Group labels chosen against ambiguity
'Served (locked)' read as parenthetical decoration; shipped as 'Served' with the StateChip
('Locked') carrying the machine term on the card. Group headings are presentation; the state
vocabulary lives once on the chips.
