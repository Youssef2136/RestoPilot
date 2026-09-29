# Feature Specification: Authentication, Account & Customer Entry UX (Frontend Phase 04)

**Feature Branch**: `024-auth-and-customer-entry-ux`

**Created**: 2026-09-28

**Status**: Clarified

**Input**: Frontend Master Plan §8 Phase 04 — "Make the two entry experiences real: staff
credential surfaces that feel trusted, and a customer entry that a guest at a table can complete
on a phone in seconds. Also resolve the two placeholder routes (C1/C2) explicitly."

**Authorities**: RestoPilot-Frontend-Master-Plan.md §8 Phase 04 (FR-01…FR-10); §4 (FA rules);
`.specify/memory/constitution.md` (IV — server-enforced authorization); frozen auth semantics
(spec 020); `docs/frontend-presentation-contracts.md`; Phase 02 design system + Phase 03 shells.

## Clarifications (Q&A resolved from evidence, 2026-09-28)

- **Q1 (C2) What is `/` for?** → **A neutral public landing**: the h1 `RestoPilot` (five E2E
  suites pin or scan this route), a one-paragraph purpose statement, and two affordances: a
  "find your restaurant" explanation (a QR link or typed `/r/<slug>` address — RestoPilot has NO
  public restaurant directory, so no search feature is invented) and a staff sign-in link to
  `/signin`. Not a customer shell change beyond composition; not a marketing page.
- **Q2 (C1) Fate of `/order/:branchId`?** → **A redirect deep-link**. The three options were:
  branch deep-link entry (needs a public branch→restaurant lookup — NO such RPC exists; adding
  one is an unauthorized backend change, Constitution IV), redirect, or retire. Decision:
  the route redirects to `/` with a `?branch=<id>` echo and the landing renders the guidance
  "Open the link from the restaurant's QR code". The `routes.test.ts` '/order/demo-branch' h1
  pin migrates deliberately to a redirect assertion (recorded in the ledger, F-G09/FA-8).
- **Q3 Is the entry wizard stepped or single-page on mobile?** → **Single-page progressive**
  (the existing `RestaurantEntry` shape): sections appear as prior decisions land, the primary
  action is sticky at 390 px. A stepped wizard would break ~8 verbatim pinned assertions
  (Branch/Table/Your name/Phone number labels, "Join the table", h1 = restaurant name) for zero
  contract gain; "one decision per screen" is satisfied by the progressive sectioning.
- **Q4 Join-existing-session wording?** → The server performs open-or-join and the response
  shape does not distinguish joined vs created (contract-pinned `parseEntry`), so the affordance
  is **guidance**: a persistent note under the table picker — "If your table is already open,
  you'll join it as a new participant." — plus the existing verbatim race refusal
  ("A session is already open at this table. Join it instead.") surfaced verbatim when it fires.
- **Q5 Do restaurant brand assets (logos/imagery) exist?** → **No** — `get_public_restaurant`
  exposes name, slug, and `brand_description` only; the seed carries no logo/imagery. Brand
  presentation is typographic: restaurant name as h1, brand_description as the lead paragraph.
  Absence stated; nothing invented.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A guest at the table orders in seconds (Priority: P1)

A guest scans the QR, lands on `/r/blue-olive`, sees the restaurant's name and brand line, and
completes branch → channel → table/address → name+phone on a 390 px phone with ≥ 44 px targets
and a sticky primary action. Client-side validation feedback appears next to the field and in
the alert region; server refusals render verbatim; success lands on the menu with the session
indicator.

**Why this priority**: this is the Persuade mode core of the phase — the revenue path.

**Independent Test**: the existing `session.surfaces` entry-flow assertions still pass verbatim;
new mobile-viewport + axe + console specs over the same flow; visual inspection of the 390 px
full flow.

**Acceptance Scenarios**:

1. **Given** the seeded Blue Olive (2 branches), **When** the guest opens `/r/blue-olive`,
   **Then** h1 = "Blue Olive" with the brand_description lead, the Branch select renders, and
   after choosing Downtown the channel fieldset (legend "How would you like your order?") and
   the Table select render with the join guidance note.
2. **Given** a single-branch restaurant, **When** the guest opens its entry, **Then** the branch
   picker is skipped and the channel fieldset renders immediately.
3. **Given** any invalid input (short name, bad phone, over-long address), **When** the guest
   submits, **Then** the SAME messages as today render next to the form's alert region and the
   submission is not sent.
4. **Given** the guest submits valid data, **When** the RPC accepts, **Then** the button shows
   the pending label ("Joining…") and cannot be double-submitted; on success the menu route
   loads with the indicator; on P0001 refusal the server's message renders verbatim.

### User Story 2 — Credential surfaces that feel trusted (Priority: P1)

A staff member opens `/signin`, signs in (or requests recovery from the same page's mode
switch), and lands where they were headed. `/reset-password` completes the emailed link; `/account/password` keeps the verify-then-update flow. All three surfaces read as one calm,
restrained system built from Phase 02 primitives.

**Why this priority**: Operate mode core; the flows are frozen — this phase is trust-forward
presentation + a11y completeness.

**Independent Test**: `auth.routes` assertions pass unchanged; axe scans on all three
credential surfaces; visual inspection desktop + 390 px.

**Acceptance Scenarios**:

1. **Given** any seeded persona, **When** they sign in, **Then** the flow, messages, and
   landings are byte-identical to today (generic failure, return-to, /admin vs /dashboard).
2. **Given** the recovery request mode, **When** any email is submitted, **Then** the same
   generic confirmation renders (no enumeration) and the mode explains the emailed link leads
   to a page where a new password is set.
3. **Given** the reset landing with a valid link, **When** the two fields match and submit,
   **Then** "Your password has been updated." renders with the continue link; with no link,
   the guidance paragraph routes the visitor back to sign-in.

### User Story 3 — The two placeholder routes resolve (Priority: P2)

`/` explains what RestoPilot is and offers the two real ways in; `/order/:branchId` redirects
instead of showing a placeholder.

**Independent Test**: routes.test's migrated assertions + smoke + responsive + a11y + route
titles all pass on the new real surfaces; `/order/demo-branch` lands on `/` with guidance.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor on `/`, **Then** they see the RestoPilot h1, the purpose
   paragraph, the QR/slug explanation, and a Staff sign-in link — one `main`, no staff nav.
2. **Given** a visitor following an old `/order/:branchId` link, **Then** they land on `/`
   (with the branch echo in the query) and the guidance names the QR-code path.

### Edge Cases

- Entry with a payload whose branch has zero active tables → the Table select offers only the
  placeholder option and the submit is refused with the existing "Choose a table to continue."
- Delivery address exactly 200 chars accepted; 201 refused with the verbatim bound message.
- Phone with spaces/dashes/parens normalizes before validation (existing behavior preserved).
- `/r/unknown-slug` → the not-found state, no tenant data (frozen).
- Double-submit prevented by the pending state (existing disabled-button behavior kept).
- `/reset-password` without any recovery link → the guidance paragraph, never a broken form.
- `/` while signed in as staff → still the public landing (no redirect; staff use `/signin`
  or their dashboard bookmark; no cross-purpose behavior invented).

## Requirements

### Functional Requirements

- **FR-01** `/signin` presents the sign-in form with a mode switch to the recovery request on
  the same page; every existing behavior preserved byte-for-byte (generic failure, return-to,
  expired note, awaiting-context landing).
- **FR-02** `/signin`'s recovery mode renders the generic confirmation verbatim in behavior and
  explains that the emailed link leads to the password-reset page.
- **FR-03** `/reset-password` and `/account/password` render the existing flows with Phase-02
  primitives; no semantic change (spec 020 frozen).
- **FR-04** `/r/:slug` entry: restaurant name h1 + brand_description lead; branch picker
  (auto-skipped for single branch); channel fieldset (dine-in/delivery/takeaway, one-line
  explanations); dine-in table picker with the join guidance; delivery address with live
  length; name/phone identity fields with correct `inputMode`/`autoComplete`; the primary
  action label matches the channel verbatim.
- **FR-05** Client-side validation feedback identical in outcome to today: same messages, same
  ordering, alert region + field context; submission never sent while invalid.
- **FR-06** Join affordance: the guidance note under the table picker (Q4) + the verbatim
  server race refusal; closed-session behavior guidance stays on the customer surfaces (frozen
  flows).
- **FR-07** `/r/unknown-slug` renders the not-found state (no tenant data) as today.
- **FR-08** `/` implements Q2's landing (h1 `RestoPilot` preserved).
- **FR-09** `/order/:branchId` implements Q2's redirect; `routes.test.ts` migrates deliberately.
- **FR-10** Entry remembers nothing beyond the frozen token contract (`restopilot.session-token`);
  no new storage keys; no "remember me"; no credential echoes.

### UX Requirements

- One decision per screen section on mobile; branch/table are selects with large targets; the
  channel choice explains each option in one line; phone/name carry `inputMode`/`autoComplete`
  hints; validation feedback next to the field and in the alert region; busy state prevents
  double submit; the recovery flow explains where the emailed link leads.

### Visual Requirements

- Trust-forward credential surfaces: restrained color, clear hierarchy, centered with a max
  measure on desktop, full-bleed on mobile; the customer entry leads with the restaurant name
  and brand description and feels like the restaurant's page (QR-origin), built exclusively
  from Phase 02 tokens/primitives.

### Responsive Requirements

- The entry flow is designed at 390 px first: single column, ≥ 44 px targets, sticky primary
  action, no horizontal scroll; verified at tablet/desktop. Credential surfaces centered with
  max measure on desktop.

### Accessibility

- Explicit labels + `autocomplete` on every credential field; error summary behavior stays as
  today (alert region) with field context; radio group uses `fieldset`/`legend`; focus moves to
  the first invalid field on failed submit; heading order preserved (h1 = restaurant name on
  entry, h1 = Staff sign-in / Password recovery / Reset your password / RestoPilot).

### State Matrix (from the Master Plan, verified against the code)

- Sign-in: idle / submitting / generic failure / awaiting context / success redirect.
- Recovery: idle / sending / confirmation (generic, rate-limits never enumerated).
- Entry: loading payload / not found / single branch / multi branch / channel-specific fields /
  validating / submitting / server refusal (verbatim) / success.
- Recovery landing: valid link / expired-or-missing link / no session.

### Security

No enumeration; no credential echoes; publishable key only; no tenant data on not-found; no
session-semantics change; the visual layer introduces no new persistence.

### Components

`AuthCard` (credential shell wrapper), `CredentialForm` field wiring on `Field`/`Input`,
`EntryWizard` (the re-skinned progressive entry), `ChannelSelector` (fieldset/legend),
`CustomerShellHeader` (restaurant identity lead), `SessionJoinNotice`. `/`'s landing composes
existing primitives only.

### Routes

`/signin`, `/reset-password`, `/account/password`, `/r/:slug`, `/` (FR-08), `/order/:branchId`
(FR-09 redirect). No other path changes.

### Testing Strategy

Unit: route-decision tests (root landing composition, order redirect mapping) + recovery copy
pins. E2E: `routes.test.ts` migration (C1/C2), `session.surfaces` extensions (join guidance,
single-branch skip already covered, mobile completion), axe on the four public surfaces
(`/`, `/signin`, `/reset-password`, `/r/blue-olive`), console-clean navigation with the
expected-refusal list, mobile-viewport entry completion. `auth.routes` stays untouched in
behavior.

### Backend impact

**NOT_REQUIRED.** All contracts exist (`get_public_restaurant`, `open_session_at_table`,
`open_session_channel`, `current_auth_context`, `authClient`). The branch→restaurant lookup
that a "smart" C1 deep-link would need does NOT exist and is NOT added (Constitution IV;
recorded in Q2).

## Success Criteria

1. Both entry experiences production-quality at 390 px and desktop (evidence screenshots).
2. Every existing auth/entry E2E assertion passes or is deliberately migrated + recorded
   (only the two C1/C2 placeholder pins migrate).
3. C1/C2 implemented per Q1/Q2; axe + console checks clean on the public surfaces.
4. `npm run verify` + `npm run test:e2e` green.
