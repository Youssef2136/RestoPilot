# Phase 02 Implementation Plan — Design System & Visual Language

**Feature dir:** `specs/022-frontend-design-system` · **Baseline:** `a707a27` · **Date:** 2026-09-27

## Summary

Build the committed visual world and component vocabulary: token stylesheets, the §5.3
primitive inventory (creation-rule applied), the DEV gallery expansion, contract tests,
drift enforcement, `PRODUCT.md` (done via init), `DESIGN.md` (at finish), and the Phase 03
surface-brief template. No existing surface is restyled; no backend touch.

## Backend impact

**NOT_REQUIRED** — no RPC, table, RLS, auth, or generated-type change. The phase consumes no
live data at all (gallery = static fixtures).

## Design direction (new-work resolution, code-led)

Authority: Master Plan §5/§6 (Operate mode, one committed palette, semantic roles, status
vocabulary, motion grammar) + user clarifications Q1–Q8 (stack, light-only, density, icons,
brand assets, WCAG AA, system fonts, product motion). The incumbent neutral ink/surface
(#1f2328/#f6f7f9/#ffffff) is preserved as the seed of the neutral roles (R2) — an
**incomplete-brand expansion**, not a replacement: existing screens keep their look while the
system formalizes it. Brand accent: a deep teal-green for primary actions/selection/state
indicators, chosen to sit apart from the status hues (positive green, warning amber, danger
red, info blue) and to carry ≥ 4.5:1 with white text; exact value verified by a contrast
script during implementation and recorded in `DESIGN.md`.

### Direction contract (system-level, persists in this plan; per-surface briefs start Phase 03)

- **THESIS** — One calm operating console: the tool disappears into the task; state is
  always legible at a glance (status color vocabulary + tabular data posture), never
  decorated. Refuses the category default of decorative dashboards-with-glass.
- **OWN-WORLD** — Near-white paper surfaces on a cool gray ground, ink-neutral text, one
  committed teal-green brand accent; 1px borders carry structure, two soft shadow levels
  carry elevation; 6/10/14 radii; system sans at a fixed rem scale; compact/comfortable
  densities; 150–250 ms state-conveying motion.
- **STORY** — Staff scan operational truth fast (rounds, tickets, sessions, money);
  customers read a trustworthy menu. Every state (loading/empty/error/disabled) is honest
  and styled by the same vocabulary.
- **FIRST VIEWPORT** — n/a (system phase; gallery IS the first rendering of the world, and
  Phase 03's shell is its first real surface).
- **FORM** — code-led (no image generation in this environment; ambition carried by this
  contract and audited via detect + axe + screenshots).
- **FINISH** — unreviewed and undocumented is unfinished; this build ends with the finish
  review (detect + axe + console + screenshots), the verdict, `DESIGN.md`, and every
  shipping raster carrying its provenance.

## Architecture

### Files created/changed

```
src/styles/tokens.css          NEW — all token groups (FR-03)
src/styles/base.css            EDIT — literals absorbed into vars; reduced-motion; selection/caret
src/styles/reset.css           UNCHANGED (Phase 01)
src/main.tsx                   EDIT — import order: reset → tokens → base
src/components/ui/*            NEW — primitives (FR-04) + Component.module.css each
src/features/**                UNCHANGED (feature-owned components untouched)
src/app/router.tsx             UNCHANGED in architecture; DevGalleryPage content grows
src/routes/DevGalleryPage.tsx  EDIT — renders every primitive × state, grouped, labeled
tests/unit/design.tokens.test.ts      NEW — token presence/semantic naming/contrast data
tests/unit/design.literals.test.ts    NEW — FR-07 drift scan of component CSS
tests/unit/ui/*.test.tsx              NEW — per-primitive contract tests (static markup)
e2e/design.system.test.ts             NEW — gallery smoke + axe + console floor (3 projects)
docs/conventions.md            EDIT — how to consume/amend the system (FR-11)
docs/development.md            EDIT — gallery/design-system notes if command-facing
PRODUCT.md                     NEW (done — init)
DESIGN.md                      NEW at finish
specs/022-frontend-design-system/**  NEW artifacts + evidence
templates/surface-brief.md     NEW — Phase 03 brief template w/ direction-contract block (FR-08)
```

### Primitive inventory (creation rule applied; §5.3 complete, each names its first consumer)

| Group | Primitives (new) | First consumer |
|---|---|---|
| Actions | `Button`, `IconButton` | Phase 03 shell |
| Forms | `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `NumberInput`, `FormErrorSummary` | Phase 04+ surfaces (Phase 03 profile/bootstrap) |
| Overlays | `Dialog` (+confirm variant), `Drawer` | Phase 03 (confirm adoption, mobile nav) |
| Structure | `Card`, `Panel`, `SectionHeader`, `Tabs`, `Toolbar`, `Divider`, `Stack`, `Grid` | Phase 03 |
| Data | `DataTable`, `KeyValueList`, `Pagination` (LoadMore variant) | Phase 06/13/14 |
| Feedback | `Toast` host + `useToast`, `Alert`, `Badge`/`StatusPill`, `Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, `ProgressBar` | Phase 03 (Toast), 05+ |
| Navigation | `SkipLink` (exists — tokenized styling only) | Phase 01 done |
| Domain-shared | `MoneyText`, `StateChip`, `TotalsPanel` shell | Phase 05/09–11 |
| System | `Icon` (+ authored 18-glyph set) | Phase 03 |

Overlays use native `<dialog>` / focus management without portals beyond need; dropdowns
escape overflow via popover-friendly positioning (operate.md component rule).

### State/data flow

None new. Gallery uses static fixtures. `useToast` is client-local (no server state).
`MoneyText` wraps `money.ts`/`taxMoney.ts` formatters (no re-implementation).

### Routes

None added. `/dev/gallery` (DEV-only, existing gate) gains full system content.

### Responsive behavior

Breakpoint tokens (≤640 / 641–1024 / 1025–1440 / >1440); `DataTable` responsive fallback
strategy documented (card-ification consumed later); touch targets ≥ 44 px; gallery verified
at mobile 390×844 and tablet 834×1112 via Phase 01 projects.

### Accessibility

Contrast ≥ 4.5:1 text pairs, ≥ 3:1 large/glyph pairs (script-verified, recorded);
`:focus-visible` tokens on every interactive primitive; keyboard operability by construction
(dialog trap/restore, drawer focus, tabs arrow keys); `prefers-reduced-motion` global
neutralization; forced-colors degradation; axe on gallery in all 3 viewport projects.

### Loading/empty/error states

`Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, `Alert` (info/success/warning/danger ×
dismissible × with/without action), `Toast` (queued/visible/dismissed/stacked), `Dialog`
(open/confirming/busy/error), per-primitive invalid/read-only/disabled/loading — all in the
gallery (FR-05).

### Testing strategy

- Unit (node, static markup): token presence/naming; literal drift scan (FR-07); per-primitive
  contract tests (roles/labels/aria/disabled/live regions).
- E2E: `e2e/design.system.test.ts` — gallery smoke + axe + console floor on chromium,
  mobile-chromium, tablet-chromium (Phase 01 helpers reused).
- Build: dist grep gallery exclusion + tokens ship once.
- `npm run verify` full gate at the end; `impeccable detect` on changed files.
- Existing suites must stay green (no regression — primitives are new leaves).

### Design strategy

See Direction contract. Impeccable craft-floor rules applied (no kicker labels, no gradient
text, shadows with offset+blur, radii 12–16 cards, no colored border-left above 1px, no
hard-offset shadows, icons drawn consistently — no emoji/glyph stand-ins).

## Risks & mitigations

- **R-A**: axe violations from rich primitives → build a11y-first, run axe locally per
  primitive addition, fix before next.
- **R-B**: token drift into module CSS → FR-07 unit scan fails the build on literals.
- **R-C**: gallery regression of Phase 01 gates (console floor, dist exclusion) → same
  helpers, same grep, re-run.
- **R-D**: scope explosion in primitives → creation rule + static fixtures only; no feature
  component restyling.
