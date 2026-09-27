# Phase 02 Research

**Date:** 2026-09-27 · **Baseline:** `a707a27`

## R1 — Test method for component contracts (repository truth)

Unit tests run in Vitest **node** environment (`tests/setup-env.ts`); component-level tests
render via `renderToStaticMarkup` (no jsdom, no @testing-library). Phase 02 contract tests
follow the same method: assert on serialized markup (roles, aria attributes, disabled
semantics, class hooks). Keyboard/focus behavior is proven in E2E (axe + interaction specs),
not in unit tests — consistent with how Phase 01 validated the boundary and skip link.

## R2 — Token architecture (CSS custom properties, semantic layer)

Master Plan §5.2 mandates semantic tokens (`--color-danger-surface`-style) rather than literal
palettes at the consumption layer. Verified Phase 01 state: `src/styles/{reset,base}.css`
exists; base.css deliberately carries exactly five literals inherited from the old index.css
(`#1f2328` ink, `#f6f7f9` surface, `#ffffff` skip-link surface, ink-colored focus ring and
skip-link text) with an explicit header comment deferring values to Phase 02. Decision: tokens
absorb those five values as the seed of the semantic roles — no third value set is introduced;
base.css is rewritten to reference vars.

## R3 — Primitive inventory vs creation rule (FR-04, FA-5)

§5.3 lists the full vocabulary, but FR-04's creation rule forbids speculative primitives: a
primitive ships when foundational, required by an identified Phase 03+ surface, or clearly
reused. Cross-checking §6 (Phase 03 shell needs: Button, IconButton, Field/Input/Textarea/
Select/Checkbox/RadioGroup, Dialog confirm variant, Drawer for mobile nav, Card/Panel,
SectionHeader, Toolbar, Stack/Grid, Badge/StatusPill, Toast+useToast, Alert, Spinner, Skeleton,
EmptyState, ErrorState, Sidebar/Header/Breadcrumbs/ContextSwitcher/MobileNav composition
pieces, SkipLink exists, Icon, Divider, Tabs); Phase 06/13/14 data surfaces need DataTable with
sortable header + empty/loading rows + responsive fallback, KeyValueList, Pagination/LoadMore;
Phase 05/09–11 money/state surfaces need MoneyText, StateChip, TotalsPanel shell. Everything
in §5.3 is therefore reachable by a named consumer within Phases 03–14 — the inventory ships
complete but each member documents its first consumer.

## R4 — State matrix per primitive (Master Plan "State Matrix" block)

Per interactive primitive: default, hover, focus-visible, active, disabled, loading, selected/
checked (where applicable), invalid, read-only. Feedback primitives: info/success/warning/
danger × dismissible × with/without action. Dialog: open/confirming/busy/error. Toast:
queued/visible/dismissed/stacked overflow. The gallery renders all of these; unit contract
tests assert the machine-readable ones (disabled/aria attributes, live regions).

## R5 — Motion grammar (Q8 + operate.md)

Operate-mode constraints: 150–250 ms transitions, exponential ease-out, motion conveys state
only (loading, feedback, reveal of state change), no orchestrated page-load sequences, no
decorative loops. Tokens: `--motion-fast` (150 ms), `--motion-base` (200 ms), `--motion-slow`
(250 ms), `--ease-out` (cubic-bezier(0.22, 1, 0.36, 1)). `prefers-reduced-motion: reduce`
collapses all durations to ~0 and disables non-essential animation globally in base.css.

## R6 — Color strategy (new-work §4 under Operate mode)

Product defaults to **Restrained**: neutral ink/surface families plus one brand accent used
for primary actions, current selection, and state indicators only — not decoration. A second
neutral layer (surface-raised) serves sidebars/toolbars/panels. Status roles (positive/
warning/danger/info) form the state vocabulary shared by StateChip. Focus ring is its own
token (never repurposed from ink). Light theme only (Q2). Contrast targets (Q6): every
ink-on-surface pair used for text ≥ 4.5:1; large text and UI glyph pairs ≥ 3:1. The palette is
anchored on the absorbed Phase 01 neutrals so existing screens' look does not silently shift
in this phase.

## R7 — Type scale (Q7 + operate.md)

System font stack retained (no webfont; operate.md: one well-tuned sans carries product UI).
Fixed rem scale, ratio ≈ 1.2, weights 400/500/600 (700 reserved for numeric emphasis in
reports contexts). Line heights: 1.5 body, 1.25 headings. Sizes: 0.75/0.8125/0.875/1/1.125/
1.25/1.5/1.875 rem (sm→display). Tabular numerals for data via a `data-*`/utility class on
numeric cells (money, counts) — money formatting itself stays in the existing formatters.

## R8 — Spacing, radii, elevation, z-index, breakpoints, touch targets

Spacing scale 4-based: 2/4/8/12/16/20/24/32/40/48/64 px tokens. Radii: sm 6, md 10, lg 14,
pill 999 (craft-floor: card radii 12–16; pills for small controls). Elevation: two shadow
levels + one overlay level, all with offset+blur (no zero-offset halos). Border widths 1/2.
Z-index layers: nav 100, dropdown 200, drawer 300, dialog 400, toast 500, tooltip 600.
Breakpoints: mobile ≤ 640, tablet 641–1024, desktop 1025–1440, wide > 1440 — aligned with the
Phase 01 viewport projects (390×844 mobile, 834×1112 tablet). Touch target minimum 44×44 px
(Q6), enforced by component sizing not by test.

## R9 — Density modes (Q3)

Density via spacing tokens scoped by a class/attribute on a surface root: comfortable
(default) and compact (staff data surfaces) — compact reduces row padding and control heights
within touch-target minimums. Defined as token overrides now; consumed by Phase 03 shell and
data surfaces.

## R10 — Gallery architecture (Phase 01 reuse)

`router.tsx` owns `import.meta.env.DEV` (direct member reads only — D3), the gallery registry
entry, and `extraRoutes` for RouteTitles. Phase 02 only adds content to the existing
`DevGalleryPage` and its spec coverage; no build-mode logic moves. Dist-grep gate (`GALLERY-EXCLUDED`)
is re-run at validation.

## R11 — Impeccable entry (init/new-work/shape)

`impeccable context` ran clean: no PRODUCT.md, incumbent visual implementation present. init
completed via user interview (2026-09-27): product summary confirmed, no brand assets, stack
= tokens+CSS Modules, one light theme, system fonts. No image generation in this environment →
**code-led** build path (no comp round; ambition carried by the direction contract). Launcher
0.1.6 provides `detect` only — critique/audit/polish remain unavailable (Phase 01 F8);
compensations: axe + console E2E on the gallery, `detect` on changed files, screenshot
evidence at required viewports.
