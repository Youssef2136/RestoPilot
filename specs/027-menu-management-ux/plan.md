# Implementation Plan: Menu Management UX (Phase 07)

**Spec**: `specs/027-menu-management-ux/spec.md` (clarified-by-evidence) · Work lands on `main`.

## Routes

The two paths unchanged: `/dashboard/menu`, `/dashboard/branches/:branchId/menu`. In-page section
structure via SectionCards; the menu page gains a `ManagementLayout` section nav
('Menu sections': Structure / Add category) — fragments documented; the branch page keeps its
single-column preview + availability sections re-hosted in SectionCards under a
'Branch menu sections' nav (Menu preview / Branch availability / Restaurant-wide availability).

## Architecture

- **No new shared layer** — phase 06's `src/components/management/` is consumed as-is
  (ManagementLayout, SectionCard, ScopeBadge, StatusPill management family) plus 022 primitives
  (Button, Field, Input, Checkbox, Feedback EmptyState/ErrorState/StatusPill).
- **New module css** `src/features/menu/menu.surfaces.module.css` — management-density row/
  thumbnail/filter/nav styles on 022 tokens only (design-literals gate).
- **Page composition (re-skins; all behavior preserved):**
  - `MenuPage` → h1 'Menu' (frozen) + intro line + restaurant selector (unchanged ids/labels) +
    ManagementLayout with SectionCards: `#structure` (the re-skinned MenuStructurePanel) and
    `#add-category` (the CreateCategoryForm, keeping its frozen h3 'Add a category' and labels).
  - `MenuStructurePanel` → dense rows: `MenuItemRow` renders thumbnail (signed-URL or
    ImagePlaceholder — dashed box with an image glyph/word), name, description, price
    (`MoneyText`-consistent exact formatters), availability pills, extras preview lines
    (`Extra garlic sauce — Free` frozen text), Move up/down (frozen names, keyboard-native Q1),
    Edit (frozen `Edit Hummus`), move-to-category select, restaurant availability toggle.
    Category blocks keep region semantics (`aria-labelledby` → 'Mains'/'Starters'/'Grill'
    regions frozen) + reorder/rename/delete buttons (frozen names) + per-category create form
    (frozen labels 'Item name'/'Price'/'Add item').
  - **New `MenuFilter`**: single search box (`label 'Filter items'`) filtering items within each
    category region client-side (name + description match, case-insensitive); filtered-empty
    renders 'No items match your filter.' per category; a global empty state when everything is
    filtered out. Read-only concern: no data changes.
  - **New delete consequence messaging (FR-01)**: category delete button performs the RPC; on the
    non-empty refusal the message renders verbatim next to the control with the guidance already
    in the server text ('This category still contains items; move them to another category
    first.'). No confirm dialog (Q2: no item deletion exists; an empty-category delete is the
    only destructive path and its refusal is recoverable).
  - `MenuItemEditor` → re-hosted on Field/Input primitives (labels frozen: 'Name', 'Description
    (optional)', 'Price'), PRICE_HINT feedback retained, ExtrasEditor + ItemImageField re-skinned
    in place (frozen region names 'Extras for Hummus', 'No extras yet.', extra text lines).
  - `BranchMenuPage` → h1 '{branch} menu' (frozen) + BranchMenuPreview re-skinned (category
    regions + staff-view reasons + Customer view toggle ALL frozen) + the two availability
    sections in SectionCards with ScopeBadge (owner vs manager clarity, phase-06 Q4 pattern);
    toggles re-skinned as labelled checkbox rows with the verbatim blast-radius/no-effect copy.
- **Data layer:** `menuClient.ts`, `menuImages.ts`, `money.ts`, `useMenu.ts` UNTOUCHED
  (52 unit tests + integration suite must pass unmodified).
- **Realtime (Q5/FR-09):** `BranchMenuPage` already binds `branch_unavailable_items`
  invalidation for the branch projection — extend the SAME page binding to ALSO invalidate the
  restaurant menu key (`['menu', restaurantId]`) so the owner's availability controls on the
  branch page reflect mid-service changes; the branch-menu-view E2E proves the no-refresh effect
  on the customer-visible projection. No new channel machinery.

## Backend contracts used

**NOT_REQUIRED** — full menu RPC set + `get_branch_menu` + `menu-images` bucket + realtime table
exist and are consumed as-is (verified against `supabase/migrations/20260917072220_menu_rpcs.sql`,
`20260917072213_menu_media.sql`, seed fixtures).

## Responsive

≥1024 desktop: structure + editor in place (side-flow), preview + availability sections stacked.
<1024: section nav collapses to horizontal scroller (026 pattern). <768: rows fall back to card
layout via same-DOM CSS; the image upload affordance is hidden with its guidance line stating the
boundary (Q3) — `@media` rules only, no JS branch; availability toggles remain reachable.

## Accessibility

Reorder via buttons (no drag); toggles = labelled checkboxes with state text; file input keeps a
visible label (keyboard-operable); image `alt=""` (decorative; the name is the meaning); errors
announced per field (`role="alert"` Feedback pattern); section nav = `nav` with distinct labels
('Menu sections'/'Branch menu sections' — never 'Staff area'); the axe WCAG 2.2 AA floor runs on
both routes (session-gated, owner-signed-in).

## Loading / empty / error states

Menu loading ('Loading the menu…' preserved), provider error (`role="alert"` preserved), empty
menu ('no menu yet' preserved), empty category ('No items in this category yet.' preserved),
filtered-empty (new), image none/uploading/rejected/undisplayable (preserved + placeholder
language), extras none/ceiling-refusal (preserved verbatim), branch preview empty ('Nothing is
offered at this branch yet.' preserved).

## Testing strategy

- **Unit:** `tests/unit/menu.client.test.ts` (52) UNCHANGED and green; no new unit files unless
  the filter's normalization warrants one (skip — E2E covers it).
- **E2E preserved:** all 13 `e2e/menu.surfaces.test.ts` assertions UNEDITED; full-journey's menu
  hop (Add category/Add item labels) UNEDITED; session.surfaces/cart anchors untouched (customer
  surface not in this phase's edit set).
- **E2E new:** `e2e/menu.management.test.ts` (serial, one worker):
  1. owner journey on the scratch design (spec): category create-or-find (`E2E Scratch Menu`),
     item create `Scratch Item <runid>`, edit name/price (exact decimal), add extra (Free),
     retire it, image upload (byte-exact tiny PNG) → preview visible → remove image, availability
     stop → cleanup: extras gone, image gone, item stopped (all legal operations);
  2. search/filter narrows seeded items + filtered-empty message;
  3. empty-category delete consequence: attempt on 'Starters' → server text verbatim, category
     intact (read-and-reject on seeded data — the refusal itself is the proof, no data harmed);
  4. realtime: Bob (Downtown manager) toggles a seeded item's branch availability OFF then ON —
     the customer-view projection updates WITHOUT reload (exit criterion);
  5. 390px fallback (same DOM, upload hidden with boundary note);
  6. axe on `/dashboard/menu` (alice) — joins the session-gated pattern.
- **Gates:** `npm run db:reset -- --yes` before verify (E2E-residue lesson); `npm run verify`;
  `npm run test:e2e -- --reporter=line`; `npx impeccable detect src` → 0.

## Design strategy

022 tokens only; management density distinct from customer airiness; thumbnails as fixed-ratio
boxes with placeholder language; pills reuse the 022 StatusPill tones ('available' positive /
'unavailable' danger via StateChip vocabulary where applicable). Impeccable: `detect` at the gate;
critique of the structure view density; polish last. The row/panel pattern appears in BOTH 06 and
07 → per the Master Plan, `extract` candidates are evaluated but the 06 SectionCard ALREADY is the
shared layer — no further promotion needed this phase (recorded decision).

## Migration notes (ledger)

Expected §Phase 027 additions: menu section nav/SectionCards, dense item rows (thumbnail/price/
pills), MenuFilter + filtered-empty, delete-consequence messaging, image placeholder language,
branch-page ScopeBadge treatment, realtime dual-key invalidation on the branch page, mobile
upload boundary. NO frozen anchor moves anticipated; any deviation recorded with its reason.
