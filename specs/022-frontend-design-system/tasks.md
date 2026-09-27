# Phase 02 Tasks — Design System & Visual Language

**Feature dir:** `specs/022-frontend-design-system` · **Date:** 2026-09-27

| # | Task | Covers | Status |
|---|---|---|---|
| T001 | Token stylesheets: `src/styles/tokens.css` (color roles, type, spacing, radii, shadows, borders, z-index, motion, breakpoints, touch target, density), absorb Phase 01 base.css literals into vars (no third value set), reduced-motion + selection/caret/scrollbar theming, `main.tsx` import order reset→tokens→base | FR-03, FR-06 | [ ] |
| T002 | Contrast verification: unit test parses token values and asserts WCAG ratios for every declared text/glyph pair (≥4.5:1 text, ≥3:1 large/glyph), pairs recorded | FR-06, Q6 | [ ] |
| T003 | `Icon` component + authored inline-SVG glyph set (~18 glyphs, single stroke/weight), no dependency | FR-04, Q4 | [ ] |
| T004 | Actions: `Button` (primary/secondary/ghost/danger, sizes, loading, disabled), `IconButton` | FR-04 | [ ] |
| T005 | Forms: `Field` (label+hint+error+required), `FormErrorSummary`, `Input`, `Textarea`, `NumberInput`, `Select`, `Checkbox`, `RadioGroup` — errors attach to fields and are announced | FR-04, UX | [ ] |
| T006 | Overlays: `Dialog` (native `<dialog>`, confirm variant, focus trap/restore, open/confirming/busy/error), `Drawer` (mobile nav ready, focus management, Esc close) | FR-04 | [ ] |
| T007 | Structure: `Card`, `Panel`, `SectionHeader`, `Tabs` (keyboard arrows), `Toolbar`, `Divider`, `Stack`, `Grid` | FR-04 | [ ] |
| T008 | Data: `DataTable` (sortable header buttons, empty/loading rows, responsive fallback documented), `KeyValueList`, `Pagination`/LoadMore | FR-04 | [ ] |
| T009 | Feedback: `ToastProvider` + `useToast` (info/success/warning/danger, dismissible, action, stacked overflow), `Alert`, `Badge`/`StatusPill`, `Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, `ProgressBar` | FR-04 | [ ] |
| T010 | Domain-shared: `MoneyText` (wraps existing formatters), `StateChip` (status vocabulary → one palette), `TotalsPanel` shell (tax lines as data) | FR-10 | [ ] |
| T011 | Gallery expansion: every primitive × every state, grouped by primitive, states labeled, static fixtures only | FR-05 | [ ] |
| T012 | Unit contract tests per primitive family (static-markup: roles/labels/aria/disabled/live regions) | FR-09 | [ ] |
| T013 | Unit: tokens presence/semantic-naming test + FR-07 literal drift scan of component CSS | FR-03, FR-07 | [ ] |
| T014 | E2E `design.system.test.ts`: gallery smoke + axe + console floor across chromium/mobile/tablet projects | US3 | [ ] |
| T015 | `templates/surface-brief.md` (direction-contract block, FR-08); `docs/conventions.md` consume/amend guide (FR-11); `docs/development.md` gallery note | FR-08, FR-11 | [ ] |
| T016 | `impeccable detect` on changed files; resolve mechanical findings | AUDIT | [ ] |
| T017 | Screenshot evidence: gallery desktop + mobile + tablet captures into specs evidence dir | FINISH | [ ] |
| T018 | Validation: `npm run verify`; `test:e2e` design.system + regressions; dist grep `GALLERY-EXCLUDED` | Gates | [ ] |
| T019 | `DESIGN.md` written at finish from the built world | FR-02 | [ ] |
| T020 | Convergence: fix findings, re-run targeted gates (max 3 rounds) | CONVERGE | [ ] |
| T021 | Checkpoint: secrets-checked `feat(022)` commit; push origin main (user-instructed auto-push) | CHECKPOINT | [ ] |
| T022 | Report + state.json DONE + carry-forwards recorded | REPORT | [ ] |
