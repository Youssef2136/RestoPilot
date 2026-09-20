# Feature Specification: Cart and Rounds (Phase 7)

**Feature Branch**: `008-cart-and-rounds`

**Created**: 2026-09-20

**Status**: Draft

**Input**: Master plan §18 (Phase 7 — Cart and Rounds): "Implement the core ordering engine" — a localStorage cart with server-side session recovery, and the atomic round-creation transaction (validate session, availability, items/extras, price snapshot, taxes, create round + items/extras + kitchen ticket, commit).

## Clarifications

### Session 2026-09-20

- Q: Who is a round attributed to when several participants share a session? A: Session-level — the round belongs to the session; no participant reference (the token owns identity; a client-supplied participant id would be spoofable and contradicts 007's minimal-indicator posture).
- Q: What happens to the unsubmitted local cart when the session is closed or recovery is refused? A: It is cleared — the cart key belongs to the session's context, and a refused recovery already returns the customer to entry.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The Customer Cart (Priority: P1)

As a seated customer reading the session menu, I can add menu items — each with its chosen extras and quantity — to a cart, adjust or remove them, and see the running total update as I shop, so that building an order feels immediate and forgiving.

**Why this priority**: the cart is the customer's only ordering surface; nothing downstream exists without it.

**Independent Test**: enter a session, add items with extras, change quantities, remove lines — the cart reflects every change immediately and survives a page reload (local persistence), while never offering cart capability without an active session.

**Acceptance Scenarios**:

1. **Given** an active session, **When** the customer adds an item and selects its extras, **Then** the cart shows the item with its extras, the quantity, and the line total derived from the menu's prices.
2. **Given** items in the cart, **When** the customer changes a quantity or removes a line, **Then** the running total recalculates from the same menu prices with no stale rows.
3. **Given** a cart built in this browser, **When** the customer reloads the page, **Then** the cart is restored exactly (items, extras, quantities) — the local cart is optimized for immediate recovery.
4. **Given** no active session (no stored token, or a refused recovery), **When** the customer reaches any cart surface, **Then** no cart exists and none is persisted — the cart is meaningless without the session it would be submitted to.

### User Story 2 - Round Submission (Priority: P1)

As a seated customer with a non-empty cart, I can submit the cart as a round, so that the kitchen receives exactly what I ordered and nothing about the submission is partially applied.

**Why this priority**: this is the core ordering transaction — the master plan's critical path (§18 "Critical transaction").

**Independent Test**: submit a valid cart; then submit carts engineered to fail each validation class (unavailable item, retired extra, foreign item, closed session); every accepted submission produces a complete round (items, extras, prices, taxes, kitchen ticket) and every refused one produces nothing at all.

**Acceptance Scenarios**:

1. **Given** a valid cart for the session's branch, **When** the customer submits, **Then** a single atomic operation creates the round, its items and extras at the menu's current prices (the price snapshot), the calculated tax lines, and exactly one kitchen ticket for the newly submitted items — all or nothing.
2. **Given** a cart referencing an unavailable item, a retired extra, or an item of another branch/restaurant, **When** the customer submits, **Then** the submission is refused with a specific message and NOTHING is created — no partial round, no orphan ticket (the critical transaction guarantees).
3. **Given** a tampered, unknown, or closed session token, **When** the customer submits, **Then** the submission is refused with the established indistinguishable session refusal and nothing is created.
4. **Given** a submission, **When** it is accepted, **Then** the round starts in the NEW state, its kitchen ticket is distinct from every earlier round's ticket in the same session, and the cart is cleared.

### User Story 3 - Multiple Rounds and Recovery (Priority: P2)

As a seated customer who has already ordered, I can keep shopping and submit further rounds in the same session, and after a reload see the rounds I have already submitted, so that a long meal flows naturally without duplicated kitchen work.

**Why this priority**: the master plan's exit condition (§18) — "Round 1 and Round 2 in the same session without duplicating previous kitchen work" — and the recovery half of the cart's two-sided design.

**Independent Test**: submit two rounds in one session; verify two distinct rounds and two distinct kitchen tickets, each carrying only its own items; reload and recover the submitted-round history from the stored token.

**Acceptance Scenarios**:

1. **Given** one submitted round, **When** the customer builds and submits a second cart, **Then** a second round is created in the same session with its own kitchen ticket containing ONLY the second round's items — previously submitted items are never sent to the kitchen again (§7.5).
2. **Given** submitted rounds in the session, **When** the customer reloads (fresh client, stored token), **Then** the round history for the session is recovered from the server — the submitted state is the server's, not the browser's.
3. **Given** the round history view, **When** the customer reviews a past round, **Then** its items, extras, quantities, captured prices, and tax lines render exactly as submitted (the snapshot, not the menu's current state).

### User Story 4 - Kitchen Ticket Readiness (Priority: P3)

As kitchen staff preparing for the operations phase, I can rely on every accepted round having produced exactly one kitchen ticket whose items mirror the round's items and extras, so that the Phase 8 operational flows can be built on a trustworthy artifact.

**Why this priority**: Phase 7 creates the ticket as a data guarantee; reading and working it is Phase 8's surface.

**Independent Test**: database-level proofs — for every accepted submission the ticket exists, mirrors the round's items/extras, and carries the round's initial state; no staff role or anonymous caller can create or alter tickets directly (zero client grants; the submission RPC is the only path).

**Acceptance Scenarios**:

1. **Given** any accepted round, **When** its kitchen ticket is examined, **Then** it exists, references the round, and its items mirror the round's items and extras exactly — one ticket per round, never more, never fewer.
2. **Given** any client role (anon, authenticated customer, any staff role), **When** a direct write to the round or ticket tables is attempted, **Then** it is denied — the submission RPC is the only write path (the established zero-grant posture).

### Edge Cases

- A cart whose item became unavailable between adding and submitting: submission refuses that line with a specific message; the cart itself is untouched (the customer removes the line and resubmits).
- An empty cart submitted: refused client-side and server-side — no empty rounds exist.
- An extra retired after being added to the cart: submission refuses with a specific message (the cart's copy is stale; the server's state decides).
- Two devices sharing one session token both submit simultaneously: each submission is its own atomic round — both succeed as separate rounds; neither corrupts the other (the session's partial-unique and row-locking guarantees decide; no lost items).
- A submission racing a menu price change: the captured price is the one effective at submission — the transaction reads prices once and writes the snapshot (Risk 6).
- A quantity beyond sane bounds (0, negative, or absurdly large): refused with a bound message both client-side and server-side.
- A customer submitting to a CLOSED session (staff closed between adding and submitting): refused with the established session refusal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The customer experience MUST provide a cart on the session menu surface: add an item with optional extras and a quantity, adjust quantities, remove lines, and a running total — usable only while a session context resolves.
- **FR-002**: The cart MUST persist locally in the browser (localStorage under a documented key) and be restored exactly on reload — items, extras, quantities.
- **FR-003**: No cart state MUST be created or persisted for a customer who has not entered an active session; a refused session recovery (or a closed session) clears the stored cart along with the token (clarified posture).
- **FR-004**: Cart contents are advisory until submission: prices and availability shown in the cart come from the menu payload, and the server re-validates everything at submission (the cart never authorizes anything).
- **FR-005**: Round submission MUST be a single database function executed as one transaction that: validates the session (open, the token's binding); validates every item's availability in the session's branch; validates every extra against the item's current structured extras (retired extras refused); captures each line's unit price from the menu (the price snapshot); calculates the round's taxes through the feature 006 engine (the branch's rules, ordering, overrides, compound semantics, half-up rounding at the line boundary); creates the round, its items and item-extras, the tax lines, and exactly one kitchen ticket; and commits — any failure aborts everything.
- **FR-006**: The created round MUST belong to the session's restaurant, branch, and session (composite tenancy), start in the NEW state — attribution is session-level: no participant reference is recorded or trusted from the client (clarified posture).
- **FR-007**: The kitchen ticket MUST mirror the round's items and extras exactly, one ticket per round, and MUST NOT include items from any earlier round of the session (§7.5).
- **FR-008**: Round submission MUST refuse, with specific messages and zero side effects: empty cart; quantity outside bounds (minimum 1, maximum 99); an item that is unavailable or not the session branch's; an extra that is retired or not the item's; a closed, unknown, or tampered session (the established indistinguishable refusal where session identity is involved).
- **FR-009**: The submission MUST be idempotent-safe under double-submit: a customer double-tap cannot create two identical rounds (the client disables during flight; the server treats each accepted request as its own round — no partial states either way).
- **FR-010**: After an accepted submission the cart MUST be cleared; after a refused one the cart MUST remain exactly as it was.
- **FR-011**: The customer MUST be able to list the session's submitted rounds after any reload: each round with its items, extras, quantities, captured unit prices, and tax lines exactly as submitted (the server is the recovery mechanism — the submitted state never lives only in the browser).
- **FR-012**: Round state is initially NEW; this phase implements NO state transitions — ACCEPTED/PREPARING/READY/LOCK and their actor permissions are Phase 8's surface (the state column and its closed check exist from birth).
- **FR-013**: Kitchen tickets are created but not yet readable by any staff surface — Phase 8 adds the kitchen view; this phase proves the artifact's existence and integrity at the data layer only.
- **FR-014**: Round submission is a customer action by an unauthenticated identity: it MUST produce NO audit record (the established posture — audits attach to authenticated staff actions); the round itself is the trace.
- **FR-015**: The round data layer MUST follow the established posture: zero client grants on the new tables; the submission and read RPCs are the only paths; composite tenancy foreign keys throughout; no new dependency (Constitution III/IV/VIII).
- **FR-016**: The tax lines captured on the round MUST be the deterministic output of the feature 006 engine for the submitted lines at submission time — re-running the engine on the same inputs reproduces them (Risk 6: no drift between captured and recomputable).
- **FR-017**: The cart and submission client surface MUST reuse the feature 007 session module's token handling and error mapping — one canonical session identity path, no parallel mechanism.
- **FR-018**: The round schema, functions, and workflow MUST be delivered through the canonical migration/seed/types workflow with no client write grants — data-layer functions are the only write paths (FR-022 lineage).

## Key Entities

- **Cart** (client-only): the in-browser order being built — lines of `{menu item, selected extras, quantity}`; lives in localStorage under a documented key; meaningful only with a stored session token; never authoritative.
- **Round**: one customer submission — belongs to restaurant/branch/session; state NEW; attribution is session-level; carries its items, item-extras, captured unit prices, and tax lines as written at submission (the snapshot).
- **Round item**: a line in a round — the menu item, quantity, captured unit price, and the line's extras (each with its captured price).
- **Kitchen ticket**: the operational artifact for one round — a separate representation mirroring the round's items and extras, created in the same transaction, ready for Phase 8's kitchen surface.
- **Session** (existing, feature 007): the ordering container — a session holds many rounds; its token authorizes submission and reads.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A seated customer can build a cart, submit it, and see the round appear in their session history — end to end in under a minute of interaction, with every refused input producing a clear message and no partial state.
- **SC-002**: For any accepted submission, the database contains the round, its items/extras/prices/tax lines, and exactly one kitchen ticket — verified by the database suite's atomicity proofs (each validation class leaves zero rows).
- **SC-003**: Two rounds submitted into one session produce two rounds and two kitchen tickets whose items never overlap — the master plan §18 exit condition.
- **SC-004**: The captured tax lines on every round equal the feature 006 engine's recomputation for the same inputs (automated cross-check in the database suite).
- **SC-005**: A page reload never loses the unsubmitted cart (local) nor the submitted rounds (server recovery) — both recovery halves proven in the integration journey.
- **SC-006**: The full quality gate (`npm run verify` + `npm run test:e2e`) exits 0 with the new suites, on a freshly reset and seeded database, with `package.json` unchanged.
- **SC-007**: The deterministic seed produces the same rounds-related fixture after every reset (`db:reset` → `db:seed` → `test:db` green; types byte-stable).

## Assumptions

- Round state transitions beyond NEW are Phase 8 (§19); this phase fixes the state column's closed shape (`new` only writable at creation) so later phases extend, not migrate.
- Realtime delivery of round events is feature 012's surface (§5.4: realtime is not the source of truth; the recommended implementation order sequences it after the ordering engine). This phase commits state; nothing emits events.
- The cart is per-device, not per-participant: the same token on two devices shows two independent carts but one shared round history (the server's view).
- Taxes are calculated per submission for the submitted lines only (no per-session running bill in this phase — the aggregated bill view is Phase 8's cashier surface).
- The kitchen ticket's initial state mirrors the round's NEW state; its own state machine is Phase 8.
- Menu prices are per-item and per-extra amounts (features 004/005); the snapshot captures what the branch's menu payload serves at submission time.

## Out of Scope

- Payment, bill aggregation and splitting, discounts, tips, service charges (later phases; Constitution I).
- Round state transitions (ACCEPTED/PREPARING/READY/LOCK), kitchen operations, cashier operations, voids (Phase 8).
- Realtime delivery of round/ticket events (feature 012).
- Delivery and takeaway channels (Phase 9 — the round model stays dine-in-only here, though the session type already exists).
- Stock/inventory management.
- Any staff-facing round or ticket UI (Phase 8).
