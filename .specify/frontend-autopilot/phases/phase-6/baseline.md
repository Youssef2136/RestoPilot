# Phase 06 Baseline (specs/026-management-ux) — 2026-09-29

**Git:** `main` @ `2cdbe11` (phase 05 checkpoint, pushed). Tree clean.

**Baseline validation (phase-05 final):** unit 369/369 · db 516/516 · integration 38/38 · e2e 156/156 · build 749.82 kB (gzip 206.33 kB) · impeccable 0.

## What exists today

- **Routes (paths unchanged, per plan):** `/dashboard/restaurant` → `ManageRestaurantPage.tsx` (402 ln: Profile/Settings sections, identifier-change warning flow), `/dashboard/branches` → `BranchesPage.tsx` (290 ln: policy-scoped list + create), `/dashboard/branches/:branchId` → `BranchDetailPage.tsx` (380 ln: hours editor host, tables manager, QR), `/dashboard/staff` → `StaffListPage.tsx` (254 ln: list + StaffManagementPanel).
- **Feature layer:** `src/features/management/` — `managementClient.ts` (373 ln: profile/settings, branch create/rename, hours, tables CRUD+toggle, staff add/update/remove, QR entry), `workingHours.ts` (126 ln), `qrEntry.ts`, components: `WorkingHoursEditor.tsx`, `RestaurantQrPanel.tsx`, `StaffManagementPanel.tsx` (role options, one-time credential reveal + copy + outcome notes, add/edit/remove feedback).
- **Frozen E2E anchors (management.surfaces, 13 tests):** h1 'Restaurant' + h2 'Profile'/'Settings'; labels 'Display name'/'Public identifier'/'Timezone'; the identifier warning ('will no longer address this restaurant', 'no alias, no redirect, no history') + 'Confirm identifier change'/'Cancel'; nav link 'Restaurant' under 'Staff area'; h1 'Branches', link 'Downtown', 'Rename Downtown' absence for Bob; h1 branch name; 'Monday:' listitem text + 'Sunday: Closed'; 'Edit working hours' + 'Monday interval 1 closing time' + 'Save working hours'; tables: h2 'Tables', listitem T1 'Inactive'/'Active', 'Reactivate T1'/'Deactivate T1'/'Rename T1', 'Table label', 'Create table'; QR: h2 'Customer entry QR', payload '/r/blue-olive' without ?/#, 'Download SVG'/'Download PNG'; denials: h1 'Not authorized'. Staff page: full-journey exercises 'Manage staff' h2 + add flow + one-time credential (shown once + copy) + last-owner safeguard; 'Staff list' nav link; staff list must never render phone numbers (asserted in session.surfaces e2e).
- **Fixtures this phase may use:** scratch staff identity patterns already exist in full-journey (unique emails per run; self-cleaning via membership removal).

## Master Plan authorities (§"Frontend Phase 06", lines ~1327–1372)

FR-01 profile/settings + identifier warning-before-confirm; FR-02 branch create/rename + hours editor (split days, overnight, verbatim validation); FR-03 tables CRUD + activate/deactivate + inactive visible; FR-04 QR panel (entry URL, size/format options, download); FR-05 staff list + provisioning + edit/removal + last-owner safeguard + one-time credential; FR-06 branch detail sessions entry + scoped affordances; FR-07 out-of-scope denial, never a name; FR-08 busy states + verbatim refusals; FR-09 empty states with next action. UX: progressive disclosure (sections/drawers), scannable tables/filters, consequence-stated removal, unmissable credential, hours editor prevents invalid combos, QR answers "where do I print this?", forms preserve input on failure. Visual: management layout language (section nav, toolbars, dense tables, status pills). Responsive: desktop-first tables; tablet collapsible nav; mobile read-mostly with key actions; card-row fallback under the documented breakpoint. A11y: th scope, sortable headers as buttons + aria-sort, field-tied errors + summary, dialog focus restore, keyboard-operable hours editor, QR download named, denial is an h1 state. Components suggested: ManagementLayout, SectionCard, ConfirmImpactDialog (023's ConfirmDialog exists), WorkingHoursEditor (rebuild on primitives), TableManager/TableRow, StaffTable, StaffForm, CredentialReveal, QrPanel, BranchHeader, ScopeBadge, EmptyState, DataTable. Expected clarify questions: section nav vs tabs vs sub-routes; credential layout placement; branch detail absorbs vs links tables; manager-visible vs owner-only treatment; QR download formats.

## Phase-05 assets to reuse

MoneyText (not needed here), the ordered-field discipline, the same-DOM dual-posture pattern, status-chip styling, the `role="note"` lesson, axe session-gated scan pattern if needed.

## Risks

- The 13 management tests + full-journey staff chain pin many strings — re-skin must be re-anchoring-free where possible.
- marinaT1Lock interplay: tables toggle affordances are load-bearing for realtime/management tests — same labels, same DOM reachability.
- Staff provisioning E2E (new) touches auth identities — must self-clean (membership removal + unique emails per run) like full-journey does.
