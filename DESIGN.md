# DESIGN.md — The Committed Visual World

<!-- impeccable:design record — written AT FINISH from the built world
     (spec 022 FR-02; Master Plan §6.6). This describes what IS, backed by
     the token file and the gallery; it is not a wish list. Later phases read
     this before touching UI and amend it only when the system itself
     changes (docs/conventions.md → Amending the design system). -->

**Built in:** Phase 02 (`specs/022-frontend-design-system`, commit `306c0ae`)
**Authoritative values:** `src/styles/tokens.css` (this file names roles and
rules; the token file is the source of every number)
**Proof surface:** `/dev/gallery` (DEV-only) — every primitive × every state;
screenshots in `specs/022-frontend-design-system/evidence/`

## Mode

**Operate** — the visitor completes a task. Scanability, consistency, and
state legibility outrank expression. Brand lives in precise details (one
committed accent, one status vocabulary, tabular money), never in decoration.
Customer-facing surfaces keep the same system at comfortable density.

## Color strategy — Restrained

Neutral ink/surface families carry the product; ONE brand accent
(`--color-brand` #0f766e, deep teal-green) marks primary actions, current
selection, and active indicators only. Status roles are the product's state
vocabulary, never decoration.

- **Surfaces:** page ground `--color-surface` (#f6f7f9, absorbed incumbent);
  raised cards/panels `--color-surface-raised` (#ffffff); sunken wells/table
  heads `--color-surface-sunken` (#eef0f3).
- **Ink:** `--color-ink` (#1f2328, absorbed), `--color-ink-muted` (#59626e)
  for secondary text — tinted from the same neutral family, never gray-on-color.
- **Borders:** structural hairlines `--color-border` (#e1e4e8, absorbed);
  control boundaries `--color-border-strong` (#767e89 — meets the WCAG 1.4.11
  3:1 non-text floor, verified in `tests/unit/design.tokens.test.ts`).
- **Status pairs** (ink on soft surface, all ≥ 4.5:1, test-pinned): positive
  #15803d/#e8f7ee, warning #92400e/#fdf3e1, danger #b42318/#fdecea, info
  #1d4ed8/#e9effd; brand tint #e6f4f2; solid destructive fill #b42318 with
  #ffffff text (hover/active shades tokenized).
- **Contrast evidence:** every text/UI pair declared in the token contract
  test and measured ≥ its WCAG 2.1 AA ratio at build time — contrast is a
  failing build, not an audit.

## Typography

One family: the **system UI stack** (`--font-family-ui`) — product UI needs
no display/body pairing (operate.md). Fixed rem scale, ratio ≈ 1.2, no fluid
clamps: 0.75 / 0.8125 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 1.875 rem.
Weights: 400 (body), 500 (controls), 600 (headings/labels), 700 (totals
emphasis). Line height 1.5 body / 1.25 headings; headings track −0.02em.
**Money and counts render with tabular numerals** (`MoneyText`,
`DataTable` numeric columns).

## Spacing, radii, elevation

- **Spacing:** 4-based scale, tokens `--space-1…12` (2→64px). More space
  above a heading than below; tight groups, generous separation.
- **Radii:** sm 6 (controls/inputs), md 10 (cards), lg 14 (large surfaces),
  pill 999 (status pills and small controls only).
- **Elevation:** two levels, offset+blur (`--shadow-1` hairline lift,
  `--shadow-2` floating), overlay `--shadow-overlay` for dialogs/drawers.
  Border XOR shadow per element — no ghost cards.

## Z-index layers

nav 100 < dropdown 200 < drawer 300 < dialog 400 < toast 500 < tooltip 600
(native `<dialog>` top layer sits above all; tokens document the policy).

## Motion grammar

State-conveying only: 150–250 ms (`--motion-fast/base/slow`) with
`--ease-out` cubic-bezier(0.22, 1, 0.36, 1). What may animate: hover/focus
feedback, dialog/drawer entrance, toast entrance, progress fill, loading
spinners/skeletons. What never animates: page loads (no orchestrated
entrances), decoration, text. `prefers-reduced-motion: reduce` collapses all
durations globally (base.css) and is honored by every primitive. Compositor-
only properties (transform/opacity) — the detector rejects layout-animated
transitions (caught once on ProgressBar, fixed to scaleX).

## Status vocabulary (StateChip mapping — one place)

Round lifecycle: new→neutral, accepted/out_for_delivery→brand, preparing→info,
ready/completed→positive, lock→neutral, voided→danger. Sessions:
open→positive, closed→neutral. Subscription: active→positive,
nearing_expiration→warning, expired/disabled→danger, never_activated→neutral.
Availability: available→positive, unavailable→danger. A new status extends
`STATUS_TONES` in `src/components/ui/MoneyText.tsx` — never a page-local choice.

## Density modes

**Comfortable** (default; customer surfaces, control height 2.5rem) and
**compact** (staff data surfaces; a surface root sets
`data-density="compact"` → controls 2rem, tightened section spacing). Touch
target floor: 44px on primary actions (`--touch-target`); dense-list
controls (checkboxes, inline dismiss) hold the axe 24px floor and are
documented exceptions, never primary touch actions.

## Breakpoints

mobile ≤ 640 / tablet 641–1024 / desktop 1025–1440 / wide > 1440 (tokens
document values; `@media` uses literals — CSS custom properties cannot reach
media queries). Responsive tables scroll horizontally (documented fallback;
card-ification is a per-surface decision). Viewport evidence: 1440×900,
834×1112, 390×844 (committed screenshots).

## Craft rules (the drift bans)

Tokens only (no raw hex/spacing outside tokens.css — build fails); no
gradient text; no kickers/eyebrows; no colored border-left accents; no
hard-offset shadows; no glass/blur decoration; icons drawn (one 1.75 stroke,
authored set) — never emoji/unicode stand-ins; empty states teach (never
"Nothing here"); the server's message renders verbatim in `role="alert"`
slots (context may be added around it, never replace it); destructive
actions confirm through the Dialog primitive.

## Forced colors & degradation

Primitives keep semantics under forced-colors: borders, labels, and focus
remain distinguishable when the browser strips surface tints (native
controls where degradation matters: checkbox/radio use drawn-but-native
inputs).

## Amendment path

A missing primitive/token is an explicit amendment (spec state, add once,
document here + conventions, reuse) — never a local duplicate. See
`docs/conventions.md → Amending the design system`.
