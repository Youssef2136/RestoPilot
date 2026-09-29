# Feature Specification: Restaurant, Branch, Tables & Staff Management UX (Frontend Phase 06)

**Feature Branch**: `026-management-ux`

**Created**: 2026-09-29

**Status**: Draft — clarify pending

**Input**: Frontend Master Plan §8 Phase 06 — "Turn the owner/manager configuration surfaces from
stacked forms into navigable management screens: restaurant identity, branches, tables, working
hours, the QR entry point, and staff provisioning — the surfaces an owner lives in on day one."

**Authorities**: RestoPilot-Frontend-Master-Plan.md §"Frontend Phase 06" (FR-01…FR-09); frozen
contracts — the management RPC set (`update_restaurant_profile`, `update_restaurant_settings`,
`create_branch`, `rename_branch`, `replace_branch_working_hours`, `create_dining_table`,
`rename_dining_table`, `set_dining_table_active`, `add_staff_member`, `update_staff_membership`,
`remove_staff_membership`), policy-scoped `branches`/`profiles` reads, `get_branch_open_sessions`
hand-off; `docs/frontend-presentation-contracts.md` (the management anchors — h1s, warning copy,
toggle names — are asserted); `.specify/memory/constitution.md` (IV — deep links rejected, not
hidden; the staff list never shows phone numbers); Phase 03 shell/dialog/toast; Phase 05
status-chip/dual-posture lessons.

## Clarifications (Q&A resolved with the owner, 2026-09-29)

- **Q1 Section navigation (FR-01/FR-06)** → **In-page section navigation per route** (`ManagementLayout`
  pattern: a sticky section nav on `/dashboard/restaurant` linking the Profile / Settings / QR
  sections, and on the branch detail linking Hours / Tables / Sessions): URL fragments
  (`#tables`) documented and keyboard-operable; no tabs, no new sub-routes — routes stay exactly
  the Master Plan's four paths.
- **Q2 One-time credential placement (FR-05)** → **An unmissable CredentialReveal panel replacing
  the staff form on success** (same page, form's place; explicit "not shown again" notice + copy
  affordance), exactly the existing StaffManagementPanel behavior — layout re-skin only.
- **Q3 Branch detail: tables absorbed or linked (FR-03/FR-06)** → **Absorbed as a section** (the
  current behavior): hours, tables, and the sessions entry live on the one branch page under
  section nav. Deep tables management stays where realtime/management tests pin it.
- **Q4 Manager-visible vs owner-only affordances (FR-05/FR-06)** → **Explicit ScopeBadge
  treatment**: owner-only controls render only for owners (unchanged gating); a scoped member's
  read-only view carries a visible "Read-only" hint per section — the denial tests already pin
  the negative space; this adds positive clarity.
- **Q5 QR download formats (FR-04)** → **SVG + PNG (1×) preserved** as-is; size options are NOT
  added this phase (no contract for them; the download affordances keep their accessible names).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — The owner's day-one path has no dead end (Priority: P1)

An owner lands on `/dashboard/restaurant`, sets the profile, jumps via section nav to the QR
panel, prints the entry code, creates a branch, sets its hours, adds tables, provisions the
first staff member, and hands over the one-time credential — each step ends in either success or
a verbatim refusal, never a dead end.

**Acceptance scenarios**

1. **Given** the restaurant page, **When** the owner uses the section nav, **Then** the view
   scrolls to the section and the fragment is reflected in the URL.
2. **Given** an identifier edit submitted, **When** the owner cancels the warning, **Then** the
   identifier is unchanged and the warning is gone (frozen flow, re-skinned only).
3. **Given** a new branch created, **When** the owner opens it, **Then** hours/tables/sessions
   sections are reachable from the section nav with their state visible.

### User Story 2 — A manager runs their branch without touching owner land (Priority: P1)

Bob opens his branch, reads hours and tables, sees "Read-only" clarity instead of mysteriously
absent controls, and uses the sessions entry point; a deep link outside his scope renders the
denial h1 with no data echo.

**Acceptance scenarios**

1. **Given** Bob on the branch detail, **When** he views hours/tables, **Then** no owner control
   renders and the scoped read-only hint is visible.
2. **Given** an out-of-scope branch id, **When** deep-linked, **Then** 'Not authorized' h1 and
   zero names (frozen; re-verified).

### User Story 3 — Staff provisioning feels controlled (Priority: P2)

The owner adds a staff member; the one-time credential is unmissable, copyable, explicitly
"not shown again"; removal states the consequence; the last-owner safeguard's refusal surfaces
verbatim.

**Acceptance scenarios**

1. **Given** a successful provisioning, **When** the response lands, **Then** the credential
   reveal replaces the form with copy + "not shown again" and the correct outcome wording for
   new/link/stub identities.
2. **Given** a removal confirmation, **When** the dialog opens, **Then** it states that access
   ends now and the person persists; the last-owner refusal renders verbatim.

### Edge Cases

- Hours editor: split days, overnight intervals, invalid combinations rejected client-side where
  the mapping already does; server refusals verbatim with the editor state preserved (existing
  pinned test).
- Duplicate table label, rename to empty → server messages verbatim, form preserved.
- Credential dismissed cannot be recalled (no persistence — security rule).
- QR generation failure → error state with retry (state matrix).
- Long lists: tables/staff remain scannable (dense table language); mobile falls back to card
  rows under the documented breakpoint.
- Forms preserve input on validation failure (existing behavior — kept).

## Requirements

### Functional Requirements

- **FR-01** Restaurant profile/settings sections with the identifier-change warning-before-confirm
  flow (cancelled by default, never submitted accidentally) — re-skinned into section cards under
  a section nav. (Q1)
- **FR-02** Branch create/rename with the working-hours editor (split days, overnight intervals,
  validation messages verbatim) rebuilt on the 022 primitives while preserving every pinned label
  and behavior.
- **FR-03** Tables management per branch: create, rename, activate/deactivate, inactive rows
  visibly inactive with their toggle affordances — names and reachability frozen.
- **FR-04** QR panel with the restaurant-level entry URL, payload, and SVG/PNG downloads (Q5: no
  new formats), presented as a print-oriented card.
- **FR-05** Staff list with role/branch scope, provisioning form, membership edit/removal with
  consequence-stating confirm, last-owner safeguard verbatim, and the one-time credential reveal
  (Q2) — never persisted client-side.
- **FR-06** Branch detail with its sections (hours/tables/sessions entry, Q3) and scoped
  affordances; sessions hand-off to the oversight surface.
- **FR-07** Out-of-scope branch ids render the denial state, never a name (frozen).
- **FR-08** Every write shows a busy state and surfaces refusals verbatim, input preserved.
- **FR-09** List surfaces expose empty states with the next action (no branches, no tables, no
  staff, no hours configured).
- **FR-10** Scoped members see an explicit read-only hint per section (Q4); owners see their
  controls as today.

### UX Requirements

- Progressive disclosure: section nav + section cards; heavy editors inline per section, not one wall.
- Tables and staff lists scannable: dense rows, status pills for Active/Inactive, clear actions.
- Membership removal states the consequence (access ends now; the person persists).
- The credential display is impossible to miss and never re-shown.
- The hours editor prevents invalid interval combinations client-side and explains rejections.
- The QR panel answers "where do I print this?" (payload + download affordances + guidance text).
- Forms preserve input on validation failure.

### Visual Requirements

Management layout language from 022 tokens only: section nav, SectionCard, toolbars, dense table
rows, status pills for active/inactive, branch identity header (BranchHeader), the QR
presentation card. No raw values.

### Responsive Requirements

Desktop-first for tables/hours editors; tablet: the section nav collapses; mobile: read-mostly
with key actions (toggle table, view QR, add staff) reachable; data tables fall back to card
rows under 768px (the documented breakpoint).

### Accessibility

Table semantics with `th scope`; sortable headers (if sortable) as buttons with `aria-sort`;
form errors tied to fields with a summary; confirmations focus the dialog and restore focus
(023 ConfirmDialog behavior); hours editor fully keyboard-operable; QR downloads have accessible
names; denial view is an h1 state (frozen).

### State Matrix

Restaurant: unset profile / set / saving / refusal. Branches: none / list / loading / error.
Branch detail: in scope / out of scope (denial) / loading. Hours: empty / valid / invalid /
saved. Tables: none / list / inactive rows / create busy / refusal. Staff: none / list / busy /
credential shown / credential dismissed / last-owner refusal / removal confirm. QR: ready /
generation error / download busy.

### Security

Owner-only controls gated in-page AND re-authorized by RPC; the staff list never shows phone
numbers; the one-time credential lives only in the provisioning response (no client storage);
out-of-scope data never renders — not even a placeholder name.

### Components

`ManagementLayout` (section nav), `SectionCard`, `WorkingHoursEditor` (re-skin on primitives),
`TableManager` rows, `StaffTable`, `StaffForm` (existing panel re-skinned), `CredentialReveal`
(existing behavior, layout per Q2), `QrPanel` (existing panel re-skinned), `BranchHeader`,
`ScopeBadge`, status pills, EmptyState usage.

### Routes

`/dashboard/restaurant`, `/dashboard/branches`, `/dashboard/branches/:branchId`, `/dashboard/staff`
— paths unchanged; section navigation via URL fragments (Q1).

### Testing Strategy

- **Unit:** existing `management.client`, `workingHours`, `management.qr` suites must pass
  UNCHANGED (client layer untouched); new presentation pins only if a decision (Q1 fragments)
  warrants them.
- **E2E preserved:** all 13 `e2e/management.surfaces.test.ts` assertions; full-journey's
  day-one chain (create → tables → staff → credential) and the staff-phone-absence pins.
- **E2E new:** `e2e/management.staff.test.ts` — provisioning presentation with a scratch
  identity (unique email per run, self-cleaning removal), credential reveal + dismissal,
  removal consequence dialog, last-owner refusal verbatim; section-nav fragments; scoped
  read-only hints.
- **Gates:** `npm run verify`; `npm run test:db` unchanged and green; `npm run test:e2e`
  (management.surfaces + shell + full-journey); axe/responsive checks on management routes.

### Backend impact

**NOT_REQUIRED** — the full management RPC set, policy-scoped reads, and sessions hand-off exist
and are consumed as-is.

## Success Criteria

1. An owner completes the day-one path (restaurant → branch → tables → QR → staff) without a
   dead end.
2. Manager scope is enforced visually (read-only hints) and by RPC (denials verbatim).
3. Every existing management E2E assertion passes or is migrated with a recorded reason.
4. No phone numbers in client output (asserted).
5. `feat(026)` checkpoint after convergence.
