# Implementation Plan: Restaurant, Branch, Tables & Staff Management UX (Phase 06)

**Spec**: `specs/026-management-ux/spec.md` (clarified-by-evidence) · Work lands on `main`.

## Routes

The four paths unchanged: `/dashboard/restaurant`, `/dashboard/branches`,
`/dashboard/branches/:branchId`, `/dashboard/staff`. Section navigation via URL fragments
(`#profile`, `#settings`, `#qr`, `#hours`, `#tables`, `#sessions`, `#staff`) — Q1.

## Architecture

- **New shared layer** `src/components/management/`:
  - `ManagementLayout.tsx` — section-nav wrapper: sticky nav (collapses <1024px), section
    registry [{id, label}], renders children sections with ids; fragment click scrolls.
  - `SectionCard.tsx` — card with h2 + optional ScopeBadge + toolbar slot.
  - `StatusPill.tsx` — Active/Inactive/Read-only chip (022 tokens; the customer phase-05 chip
    vocabulary reused visually).
  - `BranchHeader.tsx` — branch name h1 + meta (context).
- **Page composition (re-skins; all behavior preserved):**
  - `ManageRestaurantPage` → ManagementLayout(Profile, Settings, QR) — existing forms/QR panel
    re-hosted in SectionCards; the identifier warning flow untouched.
  - `BranchesPage` → list re-skin with status pills + EmptyState (no branches → create CTA).
  - `BranchDetailPage` → BranchHeader + ManagementLayout(Hours, Tables, Sessions entry) —
    WorkingHoursEditor and the tables manager re-hosted; owner controls + read-only hints
    (ScopeBadge) per section; table rows keep listitem semantics + exact toggle names.
  - `StaffListPage` → StaffTable (dense rows, role/branch columns, status pills) +
    StaffManagementPanel re-skinned (CredentialReveal layout per Q2) + removal confirm via the
    023 ConfirmDialog with consequence wording.
- **Data layer:** `managementClient.ts`, `workingHours.ts`, `qrEntry.ts` UNTOUCHED (unit suites
  must pass unmodified). All reads/writes as today; realtime invalidation on branch detail kept.

## Backend contracts used

**NOT_REQUIRED** (all management RPCs + policy reads + `get_branch_open_sessions` exist).

## Responsive

≥1024 desktop two-pane where useful; <1024 the section nav collapses to a horizontal scroller
(the 025 pattern); <768 card-row fallback for tables/staff lists (CSS module media queries —
same DOM, like phase 05).

## Accessibility

`th scope` on table headers; field-tied errors + aria-describedby summary; dialog focus restore
(023); keyboard-operable section nav; denial h1; downloads named. No new landmark collisions
(one `main` per staff shell; section nav is a `nav` with a distinct label — must NOT collide
with 'Staff area').

## Loading / empty / error states

Kept and completed per FR-09: branches none → create CTA; tables none → 'Table label' form is
the CTA; staff none → provisioning form; hours empty → 'No hours configured' + edit CTA; QR
generation error → retry.

## Testing strategy

- **E2E preserved:** management.surfaces (13) + full-journey chain + shell nav matrix — zero
  edits targeted; the section re-hosting must keep every pinned string reachable.
- **E2E new:** `e2e/management.staff.test.ts` (serial, one worker): owner provisions a scratch
  staff identity (unique email per run) → credential reveal (copy + not-shown-again + outcome
  wording) → dismissal; membership removal with consequence dialog; last-owner refusal verbatim
  (remove attempt on the sole owner); section fragments on restaurant/branch pages; Bob's
  read-only hints. Self-cleaning: the added membership is removed in-test (access ends; person
  persists — also demonstrates FR-05's removal).
- **A11y/responsive:** axe on `/dashboard/restaurant` + `/dashboard/staff` via the session-gated
  pattern (in the new suite, owner-signed-in); card-row fallback asserted at 390px in the same
  suite.
- **Gates:** verify; test:db untouched green; full test:e2e.

## Design strategy

022 tokens only; dense-management density distinct from customer airiness but same primitives.
Impeccable detect at the gate + critique of density/scannability on the staff/tables lists.

## Migration notes (ledger)

Expected ledger additions: ManagementLayout/SectionCard/StatusPill/Badge hooks, staff table
semantics, section-fragment navigation, read-only hints, mobile card-row fallback. NO frozen
anchor moves anticipated (all strings preserved); any deviation recorded with its reason.

## Milestones → tasks

- M1 shared management layer + restaurant page re-skin (T001–T002)
- M2 branches list + branch detail re-skin (T003–T004)
- M3 staff list + provisioning/credential re-skin (T005–T006)
- M4 new E2E + axe + responsive fallback + ledger (T007–T008)
- M5 verify + full E2E + impeccable + convergence (T009)
- M6 checkpoint + report (T010)
