# Phase 02 Tasks — Design System & Visual Language

**Feature dir:** `specs/022-frontend-design-system` · **Date:** 2026-09-27

| # | Task | Covers | Status |
|---|---|---|---|
| T001 | Token stylesheets: `src/styles/tokens.css` (color roles, type, spacing, radii, shadows, borders, z-index, motion, breakpoints, touch target, density), absorb Phase 01 base.css literals into vars (no third value set), reduced-motion + selection/caret/scrollbar theming, `main.tsx` import order reset→tokens→base | FR-03, FR-06 | [X] — done: tokens.css (150 lines) + import order pinned by stylesPipeline.test |
| T002 | Contrast verification: unit test parses token values and asserts WCAG ratios for every declared text/glyph pair (≥4.5:1 text, ≥3:1 large/glyph), pairs recorded | FR-06, Q6 | [X] — done: design.tokens.test.ts — 14 pairs measured at build time |
| T003 | `Icon` component + authored inline-SVG glyph set (~18 glyphs, single stroke/weight), no dependency | FR-04, Q4 | [X] — done: Icon.tsx (21 authored glyphs) + gallery icons section |
| T004 | Actions: `Button` (primary/secondary/ghost/danger, sizes, loading, disabled), `IconButton` | FR-04 | [X] — done: Button/IconButton + button.test.tsx (state matrix) |
| T005 | Forms: `Field` (label+hint+error+required), `FormErrorSummary`, `Input`, `Textarea`, `NumberInput`, `Select`, `Checkbox`, `RadioGroup` — errors attach to fields and are announced | FR-04, UX | [X] — done: Field/forms/FormErrorSummary + field.test.tsx |
| T006 | Overlays: `Dialog` (native `<dialog>`, confirm variant, focus trap/restore, open/confirming/busy/error), `Drawer` (mobile nav ready, focus management, Esc close) | FR-04 | [X] — done: Dialog+ConfirmDialog/Drawer (native focus mgmt) + structure tests |
| T007 | Structure: `Card`, `Panel`, `SectionHeader`, `Tabs` (keyboard arrows), `Toolbar`, `Divider`, `Stack`, `Grid` | FR-04 | [X] — done: Card/Panel/Tabs/Stack/Grid… + structure.test.tsx |
| T008 | Data: `DataTable` (sortable header buttons, empty/loading rows, responsive fallback documented), `KeyValueList`, `Pagination`/LoadMore | FR-04 | [X] — done: DataTable/KeyValueList/Pagination + structure.test.tsx |
| T009 | Feedback: `ToastProvider` + `useToast` (info/success/warning/danger, dismissible, action, stacked overflow), `Alert`, `Badge`/`StatusPill`, `Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, `ProgressBar` | FR-04 | [X] — done: Toast/Alert/StatusPill/Skeleton/EmptyState… + feedback.test.tsx |
| T010 | Domain-shared: `MoneyText` (wraps existing formatters), `StateChip` (status vocabulary → one palette), `TotalsPanel` shell (tax lines as data) | FR-10 | [X] — done: MoneyText/StateChip/TotalsPanel (formatter routing pinned) |
| T011 | Gallery expansion: every primitive × every state, grouped by primitive, states labeled, static fixtures only | FR-05 | [X] — done: DevGalleryPage 9 sections, every primitive x state |
| T012 | Unit contract tests per primitive family (static-markup: roles/labels/aria/disabled/live regions) | FR-09 | [X] — done: tests/unit/ui/* 34 static-markup assertions green |
| T013 | Unit: tokens presence/semantic-naming test + FR-07 literal drift scan of component CSS | FR-03, FR-07 | [X] — done: design.literals.test.ts scans all src CSS (2 exempted incumbents) |
| T014 | E2E `design.system.test.ts`: gallery smoke + axe + console floor across chromium/mobile/tablet projects | US3 | [X] — done: e2e/design.system.test.ts 8/8 on chromium/mobile/tablet |
| T015 | `templates/surface-brief.md` (direction-contract block, FR-08); `docs/conventions.md` consume/amend guide (FR-11); `docs/development.md` gallery note | FR-08, FR-11 | [X] — done: templates/surface-brief.md + conventions amendment path |
| T016 | `impeccable detect` on changed files; resolve mechanical findings | AUDIT | [X] — done: impeccable detect: 0 findings (ProgressBar F3 fixed) |
| T017 | Screenshot evidence: gallery desktop + mobile + tablet captures into specs evidence dir | FINISH | [X] — done: evidence/gallery-{desktop,mobile,tablet}.png committed |
| T018 | Validation: `npm run verify`; `test:e2e` design.system + regressions; dist grep `GALLERY-EXCLUDED` | Gates | [X] — done: verify green 2026-09-27; re-proven live today — fresh build, gallery markers ABSENT from dist (DevGalleryPage/GALLERY_SECTIONS/Dev gallery = 0 matches) |
| T019 | `DESIGN.md` written at finish from the built world | FR-02 | [X] — done: DESIGN.md at repo root (tokens.css is the value source) |
| T020 | Convergence: fix findings, re-run targeted gates (max 3 rounds) | CONVERGE | [X] — done: one convergence cycle, fixes F1-F4 (phase-2 report) |
| T021 | Checkpoint: secrets-checked `feat(022)` commit; push origin main (user-instructed auto-push) | CHECKPOINT | [X] — done: 306c0ae secrets-checked, pushed (2026-09-27); republished in docs batch b1a871e |
| T022 | Report + state.json DONE + carry-forwards recorded | REPORT | [X] — done: phase-2 report + state done; carry-forwards W1/F4 recorded |
