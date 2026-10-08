# Device Contracts — specs/036 (the reviewed per-route record)

The standing record FR-01 requires: per route — primary device class, secondary,
explicitly unsupported, table narrow-width behavior (where the route renders a
production table), and the clarified mobile-editing boundary on management routes
(clarify Q4). Grounded in the router inventory (`src/app/router.tsx`, 25 routes +
catch-all; the dev-only gallery is excluded from product claims by design).

**The official matrix (clarified Q2)**: phone 320–430 px · tablet touch
768–1024 px portrait and landscape · desktop ≥1280 px (wide check >1600 for
reports/comparison). **Explicitly unsupported everywhere**: below 320 px,
watch-class, TV-class displays, foldables' inner displays.

Device classes: **P** phone (320/390/430) · **T** tablet touch (768/834/1024,
portrait+landscape) · **D** desktop (1280–1600) · **W** wide check (>1600).

## Public & customer (CustomerShell — one main, no nav)

| Route | Primary | Secondary | Unsupported notes | Table behavior | Notes |
| --- | --- | --- | --- | --- | --- |
| `/` (landing) | P | T, D, W | — | — | Simple flow layout; the QR guidance reads on a phone |
| `/r/:slug` (restaurant entry) | **P** (the QR destination) | T, D | — | — | Entry form + info; thumb-reachable actions |
| `/r/:slug/menu` (in-session menu) | **P** | T, D | — | — | The revenue surface: sticky cart actions per its contract (FR-07); long item names wrap |
| `/order/:branchId` | — | — | n/a | — | Pure redirect to `/` (spec 024 FR-09) — no layout surface of its own |
| `/signin` | P | T, D | — | — | Auth form: keyboard completion at 390 (FR-09); the 036 auth-card work already holds 44 px targets |
| `/reset-password` | P | T, D | — | — | Same form contract as `/signin` |
| `/account/password` | P | T, D | — | — | Signed-in form; simple flow |
| `*` (404) | all | — | — | — | Landmark-pure error view; no overflow at any class |

## Staff dashboard (StaffShell — sidebar collapses per its 023 contract)

| Route | Primary | Secondary | Unsupported notes | Table behavior | Mobile-editing boundary (clarify Q4) |
| --- | --- | --- | --- | --- | --- |
| `/dashboard` (session list) | **T landscape** (cashier's floor device) | D, T portrait; P best-effort | P: best-effort, not a design target | — | Cashier route: fully operable at T landscape (FR-04) |
| `/dashboard/profile` | D | T; P best-effort | — | — | Simple self-service form; safe on P |
| `/dashboard/staff` | **D** | T; P view-first | — | `StaffListPage` → **card fallback** | Read on P; safe quick actions operable; add/edit staff = D/T-primary |
| `/dashboard/sessions` | **T landscape** | D; P best-effort | — | — | Cashier route: operable at T landscape |
| `/dashboard/rounds` (queue) | **T landscape** | D; P best-effort | — | — | Cashier route: operable at T landscape; round transitions stay reachable |
| `/dashboard/kitchen` (board) | **D large / W** (wall-screen legibility) | T portrait+landscape | P: best-effort — the board is a two-metre display | — | Board columns stay named and bounded at 768 and 1600+ (FR-05) |
| `/dashboard/audit` | **D** | T; P view-first | — | `AuditLogPage` → **card fallback** | Read on P (audit is read-only by nature) |
| `/dashboard/reports` | **D** (+ **W** wide check) | T; P view-first | — | `ReportsPage` → **documented scroll region** (many-column aggregates; sticky identity column) | Read on P via the scroll region; no management field appears beyond the table's disclosure |
| `/dashboard/voids` | **D** | T; P view-first | — | `VoidReportPage` → **card fallback** | Read on P |
| `/dashboard/restaurant` (settings) | **D** | T; P view-first | — | — | Heavy configuration → D/T-primary editing; P reads |
| `/dashboard/menu` (structure) | **D** | T; P view-first | — | — | Heavy configuration → D/T-primary; P reads |
| `/dashboard/tax` | **D** | T; P view-first | — | — | Heavy configuration → D/T-primary; P reads |
| `/dashboard/branches` (list) | **D** | T; P view-first | — | — | Read on P; branch creation = D/T-primary |
| `/dashboard/branches/:branchId` (config) | **D** | T; P view-first | — | — | Safe quick actions on P: table active toggle; config forms = D/T-primary |
| `/dashboard/branches/:branchId/menu` | **D** | T; P view-first | — | — | Heavy configuration → D/T-primary; P reads |
| `/dashboard/branches/:branchId/tax` | **D** | T; P view-first | — | `TaxPreview` → **card fallback** | Heavy configuration → D/T-primary; the preview reads on P |

## Platform

| Route | Primary | Secondary | Unsupported notes | Table behavior | Mobile-editing boundary (clarify Q4) |
| --- | --- | --- | --- | --- | --- |
| `/admin` | **D** | T; P view-first | — | — | Subscription state reads on P; date changes = D/T-primary |
| `/admin/platform` (console) | **D** | T; P view-first | — | `PlatformConsolePage` → **card fallback** | Read on P; disable/dates = D/T-primary (super-admin only) |

## The six production tables (FR-06, research R4 — the implemented state, T009)

The repo audit (T009) found the card fallback ALREADY COMMITTED on five of six —
the defined behaviors below are the shipped patterns, corrected from the plan's
assumed DataTable migration:

| Surface | Narrow-width behavior (implemented) | Crossover |
| --- | --- | --- |
| `StaffListPage` | 026 `data-label` card rows (same DOM; thead leaves the flow at ≤767px) | 767px |
| `AuditLogPage` | reports D3 `cardTable` labelled-card fallback | 720px |
| `VoidReportPage` | reports D3 `cardTable` labelled-card fallback | 720px |
| `ReportsPage` | reports D3 `cardTable` on BOTH tables (channels + comparison — the read is the card, not a scroll region as first planned) | 720px |
| `PlatformConsolePage` | reports D3 `cardTable` labelled-card fallback | 720px |
| `TaxPreview` | joined the D3 `cardTable` pattern this phase (T009 — was an unstyled browser-default table) | 720px |

The DataTable `cardBreakpoint` (T008) is the SYSTEM primitive for NEW tables;
the production tables ride their committed, documented patterns — one
disclosure (each cell states its own label), no column lost. Note: the
reporting falls in the 720–767px band where BOTH committed crossovers (767
and 720) sit — inside the tablet band, below the desktop band; documented
here as-is.

Same-disclosure rule: every card row carries exactly the fields the table showed
for the signed-in role — verified for a lower-privileged role (T011).

## Pre-existing media-query audit (FR-02, D2 — resolved in T013)

The 22 existing `@media` blocks (12 files) are audited against the documented
scale (640/1024/1440). Result recorded here per file: normalized, or the
exception with its reason. No new magic numbers.

## The sticky/anchored action pattern (FR-07 — as built, T004)

The **committed 025 cart bottom-sheet** is the phase's system pattern for anchored
mobile actions: `CustomerMenuPage.module.css` `.cartColumn` — sticky to the viewport
bottom (z-index 5), max-height 45dvh with internal scroll, one-thumb reach, and the
desktop crossover turns it into the side panel at ≥1024px. Proven by
`e2e/responsive.devices.test.ts` (the submit stays inside the FULL and the
keyboard-shrunk viewport; Tab never leaves the visible area). **No new
`StickyActionBar` primitive**: zero second consumer today = speculative (the
creation rule, FA-5) — the pattern is documented here and in `docs/conventions.md`
so the SECOND anchored-action surface reuses/extracts it, rather than forking a new
one-off loader.

## Media-query audit result (T013 — the completed audit)

The documented scale: 640 / 1024 / 1440 px (`tokens.css` documentation tokens;
`@media` blocks cite the values literally). 15 real media queries across the
product (plus 3 `prefers-reduced-motion` blocks, out of the breakpoint scale's
subject) — the audit found THREE drift values and normalized them to the scale
(EXACTLY what FR-02 bans as silent drift, here corrected and recorded):

| File (before → after) | Was | Now | Note |
| --- | --- | --- | --- |
| management.module.css `.sectionCard` | `max-767px` | `max-640px` | the mobile-padding crossover joins the scale |
| BranchDetailPage.module.css (rows→cards) | `max-767px` | `max-640px` | the 026 card-row crossover joins the scale |
| StaffListPage.module.css (rows→cards) | `max-767px` | `max-640px` | same |
| menu.surfaces.module.css (card fallback + boundary note) | `max-767px` | `max-640px` | same |
| tax.surfaces.module.css (picker block) | `max-767px` | `max-640px` | same |
| reports.surfaces.module.css + tax.surfaces.module.css (`cardTable`) | `max-720px` | `max-640px` | the D3 crossover joins the scale |
| kitchen.surfaces.module.css `.board` | `min-1025px` | `min-1024px` | the board-grid crossover joins the scale (was 1px off) |
| staffOps.surfaces.module.css `.board` | `min-1025px` | `min-1024px` | same |
| AuthCard / CustomerShell / DevGallery (`max-640px`), StaffShell (`min-1024px`), CustomerMenuPage (`min-1024px`), Feedback/Button/base (reduced-motion only) | on scale | on scale | already correct |

The breakpoint band between 641–1023 px (the tablet band) now has NO max-width
query middle-land: surfaces either hold the base (mobile-first) layout or their
`min-width: 1024px` adjustment — matching the documented token scale and the Q2
device matrix (tablet = 768–1024 touch; the app is mobile-first below). The
026-era comment on the pre-normalized crossover ("at 390px-band widths") is
史料-corrected by this table.
