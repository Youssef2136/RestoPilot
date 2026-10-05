# Phase 02 Report — Design System & Visual Language

**Date:** 2026-09-27 · **Feature:** `specs/022-frontend-design-system` · **Baseline:** `a707a27` · **Checkpoint:** `306c0ae` (pushed to origin/main)

## Final status

**DONE / CONVERGED** — all FRs implemented, all gates green (W1-class
environmental failures diagnosed and carried per protocol), zero unresolved
CRITICAL/HIGH findings in phase code.

## Objective (from the Master Plan)

Establish one committed visual world and one component vocabulary before
any surface is touched: `PRODUCT.md` + `DESIGN.md` committed, semantic
tokens, the §5.3 primitive inventory with full state matrices, the DEV
gallery proving them, contract tests, drift enforcement, and the Phase 03
surface-brief template. Impeccable entered the project (init → new-work,
code-led).

## Requirements → implementation → validation traceability

| FR | Implementation | Validation |
|---|---|---|
| FR-01 PRODUCT.md | `PRODUCT.md` (product schema, confirmed facts, non-features) | committed; init interview answers recorded in spec Clarifications |
| FR-02 DESIGN.md at finish | `DESIGN.md` (mode, palette roles, type, spacing, motion, status vocab, breakpoints, densities, craft bans) | committed; token file is the number source |
| FR-03 semantic tokens | `src/styles/tokens.css` (color roles, type, spacing, radii, shadows, borders, z-index, motion, breakpoints, touch/density); import order reset→tokens→base | `stylesPipeline.test.ts` (order + no raw values in base) + `design.tokens.test.ts` (presence, semantic naming) |
| FR-04 primitives (creation rule) | 30 components in `src/components/ui/` — Button/IconButton, Field+context, Input/Textarea/Select/NumberInput, Checkbox/RadioGroup, FormErrorSummary, Dialog+ConfirmDialog, Drawer, Card/Panel/SectionHeader/Toolbar/Divider/Stack/Grid/Tabs, Toast+useToast, Alert, StatusPill/Spinner/Skeleton/EmptyState/ErrorState/ProgressBar, DataTable/KeyValueList/Pagination/LoadMore, MoneyText/StateChip/TotalsPanel, Icon (21 authored glyphs) | tsc; contract tests (34 static-markup assertions); each names its first consumer |
| FR-05 gallery × states | `DevGalleryPage` rewritten: 9 sections, every primitive's states labeled (buttons variants×4 states, fields incl. invalid/disabled/readonly, feedback severities, overlays incl. busy/error dialogs + tabs + drawer, data incl. loading/empty rows, icons, totals incl. voided line, compact density) | E2E 8/8 across 3 viewport projects; screenshots committed |
| FR-06 a11y defaults | focus-ring tokens; reduced-motion global + per-primitive; contrast pairs test-pinned; Field announces errors; Dialog/Drawer focus management; forced-colors-safe natives | axe 0 violations ×3 projects; contrast contract (11 text + 3 UI pairs) |
| FR-07 drift rules | tokens.css single raw-value home; `design.literals.test.ts` scans all CSS under src (2 justified incumbent exemptions expiring in Phase 03) | unit test green; would fail on any raw value |
| FR-08 brief template | `templates/surface-brief.md` (six direction-contract blocks) | referenced from conventions doc |
| FR-09 contract tests | `tests/unit/ui/{button,field,feedback,structure}.test.tsx` | 34 tests green |
| FR-10 domain-shared once | `MoneyText` wraps `formatPrice`; `StateChip` maps 17 domain statuses; `TotalsPanel` renders lines as data | contract tests (formatter routing, chip mapping) |
| FR-11 conventions | `docs/conventions.md` → "The design system (spec 022)" + amendment path + briefs | committed |

## Implementation summary

Tokens absorb the five incumbent literals (existing screens keep their
look — D2); brand accent #0f766e chosen apart from all status hues (D3);
the a11y wiring is context-driven (controls auto-adopt Field ids — D4,
after the axe run proved callers forget); Tabs own their panels (D5); the
viewport projects gained the gallery suite (D6). The gallery stays
DEV-gated with zero build-mode logic in routes.ts (Phase 01 D3 architecture
re-proven by dist grep).

## Impeccable findings (launcher 0.1.6: `detect` only; critique/audit/polish remain unavailable)

- `detect src`: 1 real anti-pattern found & fixed (ProgressBar width
  transition → scaleX), now 0 — the Phase 15/18 baseline preserved.
- The axe floor functioned as the critique/audit substitute and caught 4
  real defect classes (findings F1) — the compensating controls work.
- Craft-floor compliance reviewed live on the gallery (no kickers, no
  gradient text, offset+blur shadows, drawn icons, honest empty states).

## Files changed (56; +5438/−103)

New: `src/styles/tokens.css`; `src/components/ui/` (30 components + barrel
+ 2 context modules + 12 module.css); `src/routes/DevGalleryPage.module.css`;
`tests/unit/design.{tokens,literals}.test.ts`; `tests/unit/ui/*` (4);
`e2e/design.system.test.ts`; `templates/surface-brief.md`; `PRODUCT.md`;
`DESIGN.md`; `specs/022-frontend-design-system/**` (spec/plan/research/
tasks/checklist + 3 evidence screenshots).
Modified: `src/main.tsx` (import order), `src/styles/base.css`
(tokenized), `src/routes/DevGalleryPage.tsx`, `playwright.config.ts`
(D6), `docs/conventions.md` (FR-11), `tests/unit/stylesPipeline.test.ts`
(tokenized pins), `.specify/feature.json`.

## Routes/components changed

No product routes added or changed. DEV-only gallery content rewritten.
Feature-owned components untouched (out of scope held).

## Backend contracts used

**NOT_REQUIRED** — zero backend touch; gallery uses static fixtures only.

## Accessibility / responsive results

Axe 0 violations (3 projects); contrast build-time contract (14 pairs);
no horizontal overflow at 390/834/1440; reduced motion honored; keyboard
operability by construction (tabs roving focus, dialog trap, drawer
trap/restore/Esc). Screenshots: 1440×900 / 834×1112 / 390×844.

## Tests / build / E2E results

format/lint/typecheck PASS · unit **349/349** · db **516/516** (post-reset)
· integration **38/38 isolated** · build PASS (722 kB JS, 4.09 kB CSS,
`GALLERY-EXCLUDED`, tokens ×1) · e2e phase suite **8/8**; full-suite
failures = W1-class only (see below). `impeccable detect` 0 findings.

## Fixes & convergence rounds

One convergence cycle. Fixes: Field context wiring (F1), Tabs API (F1),
TotalsPanel dl (F1), touch targets (F1), invalid top-level CSS (F2),
ProgressBar compositor transition (F3), Fiona password fixture poisoning
repaired live (F4). No unresolved findings in phase code.

## Git checkpoint

`306c0ae` — secrets-checked (scan clean), 56 files, pushed to origin/main
(user-instructed auto-push after each phase, 2026-09-27).

## Remaining warnings

- 3 pre-existing lint warnings (unchanged since Phase 01).
- W1 (owner-level, carried): fixture residue/ordering under vitest file
  parallelism + the new F4 password-poisoning discovery (spec-020 e2e
  walkthrough mutates Fiona's password; mid-test failures poison the
  fixture because `db:reset` never touches the auth schema). Phase 14
  candidate.
- Impeccable launcher 0.1.6 still lacks critique/audit/polish verbs
  (carried F8 from Phase 01; re-verify next phase).

## Blocked items

None.

## Carry-forwards for Phase 03

1. Absorb the two literal-drift exemptions (`AppShell.module.css`,
   `index.css`) when the shell lands (the allowlist test enforces the
   expiry).
2. First surface brief from `templates/surface-brief.md`; `shape` flow per
   the Master Plan §6.2 order.
3. Adopt `ConfirmDialog` for the two-step confirmations and `ToastProvider`
   for mutation outcomes (the Phase 03 FRs already name them).
