# Feature Specification: Customer Menu, Cart, Rounds & Order Status UX (Frontend Phase 05)

**Feature Branch**: `025-customer-ordering-ux`

**Created**: 2026-09-29

**Status**: Clarified

**Input**: Frontend Master Plan §8 Phase 05 — "The product's core revenue path: browsing a menu,
building a cart with extras, submitting a round, and seeing order status — all on a phone at a
table with one thumb."

**Authorities**: RestoPilot-Frontend-Master-Plan.md §"Frontend Phase 05" (FR-01…FR-11); frozen
contracts — `submit_round` semantics (all-or-nothing, server validation, verbatim refusals),
`ROUND_STATE_LABEL` customer vocabulary (`Sent to kitchen`, `Accepted`, `Being prepared`, `Ready`,
`Served`), 1–99 quantity bounds, empty-cart guard, double-submit guard, `restopilot.cart` storage
contract, `get_session_menu`/`get_session_rounds`, the 10 s status poll (realtime deliberately NOT
subscribed for customers); `docs/frontend-presentation-contracts.md` (Category A/B/C/D — the
`Cart` region, `status` submit region, `alert` refusal region are asserted); Phase 02 design
system; Phase 03 toasts/offline; Phase 04 entry + customer shell; `.specify/memory/constitution.md`
(IV — token-scoped reads/writes only).

## Clarifications (Q&A resolved with the owner, 2026-09-29)

- **Q1 Cart presentation (FR-04)** → **A moving sheet/panel** (`CartSheet`): a sticky bottom
  affordance with the live line count opens a bottom sheet on mobile and a side panel on desktop.
  The Master Plan's component list already names `CartSheet`; the dedicated-step alternative was
  rejected as too heavy for a seated guest. The `region` named `Cart` stays the assertion scope
  (inside the sheet when closed-on-open is irrelevant — the region exists when the sheet is
  rendered, and the sheet renders inline-expanded in E2E where needed).
- **Q2 Category navigation style (FR-01)** → **Sticky horizontal category bar + in-page scroll**
  on mobile (the bar IS the horizontal scroller the responsive requirements call for; tapping a
  category scrolls the list to the section); the same bar persists as the navigation on desktop.
  Counts and availability awareness live in the bar labels.
- **Q3 Stale-status communication (FR-09)** → **Manual refresh button + "Updated Xs ago" line**
  above the history: the honest, explicit rendering of the 10 s poll cadence; the button retries
  `get_session_rounds` immediately. Subtle-pulse-only was rejected as hiding the data age.
- **Q4 Item images** → Resolved by evidence (no owner input needed): `menu_items.image_path`
  exists in the schema but the seed sets no images and no upload surface exists — **designed
  absence** is the shipped state. `ItemCard`/`ItemDetailSheet` render an intentional placeholder
  when `image_path` is null and a real `img alt={item name}` when present (path-structured
  constraint respected; no invented URLs).
- **Q5 Customer round cancellation (FR-12)** → Resolved by contract: no customer-side cancel
  operation exists in `submit_round`/`get_session_rounds`; no affordance is built, and the copy
  never implies the customer can cancel (staff-side change only). Recorded as a deliberate
  refusal-to-build per the Master Plan ("the contract says no — record the refusal").

### User Story 1 — A guest at the table orders in one thumb (Priority: P1)

A seated guest opens the menu on a 390 px phone, jumps to a category, reads prices and
availability, opens a dish, picks structured extras and a quantity, adds to the cart (feedback is
immediate, no navigation), opens the cart, adjusts a line, and submits. The submit names the
round/ticket, the cart clears, and the new round appears in the history with its state.

**Acceptance scenarios**

1. **Given** a joined session at Downtown T3, **When** the guest taps a category in the
   navigation, **Then** the matching items are in view with price, description, and availability
   state — and unavailable items are visibly unavailable, not hidden.
2. **Given** an item with structured extras, **When** the guest selects a required extra set and a
   quantity of 3, **Then** the add-to-cart creates a distinct line, announces the result, and the
   cart affordance shows the updated line count without leaving the menu context.
3. **Given** a cart with lines, **When** the guest submits and the server accepts, **Then** the
   submit result appears in a `status` region naming the round/ticket, the cart empties, the
   layout does not jump, and the history shows the new round with `Sent to kitchen` and the
   captured totals rendered by the shared money component.
4. **Given** the server refuses (poisoned cart), **When** the submission fails, **Then** the
   refusal appears in an `alert` region where the action happened, verbatim, and the cart is
   untouched.

### User Story 2 — A second guest adds their own round (Priority: P1)

A second guest at the same table joins the shared session and submits their own round; both rounds
appear in the history newest-first with per-round state, items, extras, and captured
subtotal/tax/total.

**Acceptance scenarios**

1. **Given** an open session with one submitted round, **When** a second guest submits a
   different round, **Then** both rounds render in the history, newest first, each with its own
   state chip and captured money.
2. **Given** either guest reloads, **When** the page recovers via the stored token, **Then** the
   history and the session indicator re-render identically (server is the source of truth; the
   cart alone is device-local).

### User Story 3 — A delivery customer understands the cutoff (Priority: P2)

A delivery customer browsing after the cutoff sees continuation presented as a state — why adding
is closed — not a surprise error at submit time.

**Acceptance scenarios**

1. **Given** a delivery session past its cutoff, **When** the guest tries to add items, **Then**
   the cutoff state explains that continuation is closed (preserved-cart rule above the cutoff
   refusal stays intact — the existing E2E pin).
2. **Given** the same state, **When** the guest views the cart, **Then** the closed state is
   visible before any submit attempt (no dead-end busy button).

### Edge Cases

- Poisoned/malformed cart at submit → server's refusal verbatim in an `alert` region, cart
  preserved (existing frozen pin).
- Double-submit while busy → guarded (submit disabled/busy state; server double-submit guard is
  the backstop).
- Quantity out of bounds → client clamps with feedback inside 1–99 (unit-tested merge/bounds
  rules unchanged).
- No categories / category with no offered items / empty cart / no rounds → designed empty states
  (FR-11), each with a next step.
- Poll stale or refresh failure → freshness affordance degrades honestly (FR-09); the last good
  data stays on screen with its staleness visible.
- Session closed or token tampered → the frozen single-indistinguishable-refusal recovery rule
  returns the customer to entry (Phase 04 behavior; unchanged).
- Item image missing → designed absence, looks intentional (see Clarifications — resolved by
  evidence).
- Image present → `alt` from the item name; the payload's `image_path` path-structured constraint
  respected; no invented URLs.

## Requirements

### Functional Requirements

- **FR-01** The menu SHALL provide category navigation with per-category counts and availability
  awareness, usable one-handed at 390 px: a sticky horizontal category bar (Q2) whose tap scrolls
  the list to the category section.
- **FR-02** The item list SHALL show price, description, image when present, and availability
  state per item; unavailable items are rendered visibly unavailable (no mystery hiding).
- **FR-03** The item detail/add flow SHALL present structured extras (required / none-required /
  optional) as a labelled fieldset with real checkboxes, and quantity as a labelled number input
  (`getByRole('spinbutton')`), within the 1–99 bounds with merge-on-add semantics identical to
  `cartState`.
- **FR-04** The cart SHALL support line adjust/remove, an advisory total, and preservation of the
  itemized state across reload (device-local under `restopilot.cart`), presented as the
  `CartSheet` moving sheet/panel (Q1).
- **FR-05** Submission SHALL disable/busy while in flight, give success feedback naming the
  round/ticket in a `status` region, and preserve the cart untouched on refusal (refusal verbatim
  in an `alert` region where the action happened).
- **FR-06** The rounds history SHALL show per-round state (customer vocabulary only), items with
  extras, and captured subtotal/tax/total from `get_session_rounds` — newest first. All captured
  money renders through the single shared money component (`MoneyText`/`TotalsPanel`); no client
  recomputation is ever presented as truth.
- **FR-07** The session indicator SHALL echo channel, table (and address for delivery) — the
  existing `SessionIndicator` semantics preserved.
- **FR-08** Cutoff (delivery/takeaway) SHALL be presented as a state explaining why continuation
  is closed, before submit attempts, with the preserved-cart-above-cutoff rule intact.
- **FR-09** The 10 s status cadence SHALL be surfaced honestly: a manual refresh button plus an
  "Updated Xs ago" line on the history (Q3).
- **FR-10** Recovery refusal returns to entry (frozen Phase 04 rule; CustomerMenuPage's existing
  behavior is the contract — no change).
- **FR-11** Empty states SHALL exist for: no categories, no items in a category, empty cart, no
  rounds — each explaining and offering the next step.
- **FR-12** The customer SHALL NOT be offered round cancellation — a submitted round cannot be
  cancelled by the customer (contract: no such operation). Any copy implies staff-side change
  only (recorded; no affordance built).

### UX Requirements

- One-hand reachability: primary actions live in the bottom third at 390 px; the cart affordance
  is sticky with the live line count.
- No layout jump on submit; add-to-cart feedback is immediate and never navigates away.
- Refusals render where the action happened; the cart is untouched on refusal.
- The page tastes of the restaurant (branch name, its content), not the platform.
- Totals read as a bill-like summary (`TotalsPanel`), not a debug list.

### Visual Requirements

- Food imagery: **designed absence** (Q4) — an intentional placeholder when `image_path` is null,
  a real `img alt={item name}` when present.
- Price hierarchy, extra markers, and round state chips from Phase 02 tokens.
- Cart: bottom sheet on mobile, side panel on desktop.
- ALL money on screen — advisory cart totals AND captured money — flows through the one money
  component; the advisory/captured distinction is visually and semantically explicit.

### Responsive Requirements

- 390 px design target; item grid becomes a single column under tablet; category navigation
  becomes a horizontal scroller on mobile (the chosen FR-01 mechanism must satisfy this);
  the full journey completable at 320–430 px with no horizontal scrolling.

### Accessibility

- Quantity: labelled number input (`spinbutton` role asserted by E2E).
- Extras: labelled fieldset with real checkboxes.
- Add-to-cart results announced (live-region or equivalent; asserted).
- Cart is a `region` named `Cart` (frozen hook — migrate deliberately with a recorded reason if
  the name ever changes).
- Submit result in a `status` region (asserted); refusals in an `alert` region (asserted).
- Focus returns to a sensible place after add/remove; contrast on price/availability text; image
  `alt` from item name.

### State Matrix

- **Menu:** loading (skeleton) / loaded / partial (category empty) / error with retry /
  unavailable-session refusal → return to entry.
- **Item:** available / not offered / image missing / extras none-required-optional.
- **Cart:** empty / lines / adjust in-flight / submit busy / refusal preserved / cutoff closed.
- **History:** loading / empty / rounds / poll stale / refresh failure.
- **Session:** resolved / closed / tampered token (frozen behavior).

### Security

- Reads and writes only through token-scoped RPCs (`get_session_menu`, `get_session_rounds`,
  `submit_round`, session context).
- No staff data and no phone numbers in customer payloads; no client-side authorization
  assumptions.
- The advisory cart is NEVER presented as authoritative money.

### Components

`CategoryNav`, `ItemCard`, `ItemDetailSheet`, `ExtrasFieldset`, `QuantityInput`, `CartSheet`,
`CartLine`, `TotalsPanel` (shared shell), `SubmitBar`, `RoundTimeline`/`RoundCard` (customer
variant), `SessionBar` (indicator), `CutoffNotice`, `RefreshAffordance`, `MoneyText` (the single
money presentation component). Existing `CartPanel`/`RoundsHistory`/`SubmitControl` are the
predecessors to re-skin/migrate — presentation-only where their contracts hold.

### Routes

`/r/:slug/menu` only (plus the entry redirect behavior already owned by Phase 04).

### Testing Strategy

- **Unit:** extend `tests/unit/order.cart.test.ts` only if the cart component shape changes
  (merge/bounds/token-scoping rules are frozen); totals rendering from captured money only;
  state-label mapping for the customer vocabulary.
- **E2E (preserved):** every existing cart/submission/history assertion in
  `e2e/session.surfaces.test.ts` — region `Cart`, add with extras, advisory totals, adjust/remove,
  reload persistence, no cart on entry route, submit clears + names ticket, poisoned-cart refusal
  preserves cart, two rounds history, cutoff refusal above preserved cart.
- **E2E (new):** category navigation, item detail extras flow, mobile-viewport (390) full-journey
  completion, axe on the menu route (a11y baseline extension), poll freshness affordance with
  expected refusals named explicitly per F-G14 (poisoned cart, cutoff, closed session are
  *expected* console/network events in their scenarios).
- **Gates:** `npm run verify`; `npm run test:e2e`; axe spec; `npm run test:unit`.

### Backend impact

**NOT_REQUIRED** — every contract exists (`get_session_menu`, `get_session_rounds`,
`submit_round`, session context, `image_path` column). No RPC, schema, or RLS change.

## Success Criteria

1. A guest completes the full journey on a 390 px viewport with no unexpected console errors or
   network failures — expected refusals (poisoned cart, cutoff, closed session) explicitly
   identified as expected in the phase's E2E scenarios.
2. Every existing cart/order E2E assertion passes or is migrated with a recorded reason.
3. Axe clean on the menu route (added to the a11y baseline).
4. Money on screen is captured money only, through the one money component (advisory cart clearly
   advisory).
5. Cutoffs and refusals show the server's message verbatim.
