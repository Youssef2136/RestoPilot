# Phase 02 Decisions

**Date:** 2026-09-27 · **Baseline:** `a707a27`

## D1 — Impeccable entry = init + new-work playbooks, code-led

`impeccable context` (launcher 0.1.6) reported NO_PRODUCT_MD + incumbent
implementation. The v4.4.0 SKILL.md's command table is playbook-based (the
launcher binary itself exposes only `detect`/`ignores`/…), so `init`,
`new-work`, `shape`, and `craft-floor` were executed by reading their
reference files — the skill's own degraded-mode path. The decision-page
scripts (`concept-seed`/`serve-question`) do not exist in the launcher, so
the visual-world decision ran through the harness's structured question
tool (user answers captured 2026-09-27). No image generation exists in this
environment → **code-led** build path (new-work's stated fallback), with
the ambition carried by the direction contract and audited by detect + axe
+ screenshots.

## D2 — The incumbent look is absorbed, not replaced (incomplete-brand expansion)

new-work.md's "established world" rule applied: the five incumbent
literals (#1f2328 ink, #f6f7f9 surface, #ffffff raised, #e1e4e8 border,
#59626e muted) became the seed of the semantic roles; only brand/status/
support roles are new decisions. Existing screens keep their look in this
phase — surface restyling starts Phase 03. This matches the Master Plan's
"re-skin, don't re-decide" framing and keeps the phase's regression risk
at zero for the 13 existing suites.

## D3 — Brand accent = deep teal-green #0f766e

Chosen apart from all four status hues (positive green #15803d is
distinctly yellower; info blue; warning amber; danger red) so primary
actions never read as statuses. Verified: ≥4.5:1 with white text (on-brand
controls) and ≥4.5:1 as text on raised surfaces — pinned in
`tests/unit/design.tokens.test.ts`.

## D4 — `Field` owns the a11y wiring via context; controls adopt it

First iteration relied on callers passing ids (render prop or `forId`);
the axe run proved callers forget (7 unlabeled controls in a page that
thought it was correct). The context now carries `{fieldId, describedBy}`
and `Input/Textarea/Select/NumberInput/Checkbox` adopt the Field's id
automatically; an explicit caller id still wins. A11y-by-construction
beats a11y-by-documentation.

## D5 — Tabs own their panels (`panels` prop)

`aria-controls` must reference a rendered element (axe `aria-valid-attr-value`
critical). A detached `TabPanel` cannot guarantee that pairing; the API now
takes `panels: Record<id, ReactNode>` and renders the ARIA-complete pair.
The old `TabPanel` export was removed before any surface consumed it (zero
migration cost — caught in the phase that created it).

## D6 — Viewport projects gain the gallery suite (declared scope change)

FR requires the system to hold at shipped viewports; `design.system.test.ts`
joined `responsive.smoke.test.ts` in the mobile/tablet projects' testMatch
(findings F6). Chromium runs the full suite including the axe and
interaction proofs.

## D7 — `DESIGN.md` written at finish; `PRODUCT.md` at init — both committed

Per Master Plan §6.6 and impeccable rules: PRODUCT.md from the confirmed
init interview (product truth only, no visual decisions); DESIGN.md from
the built world (token file is the number source; this file is the rule
book). Both committed in the phase checkpoint so later phases read them
from the repo, not from chat history.
