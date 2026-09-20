# Feature Specification: Customer Access and Sessions (Phase 6)

**Feature Branch**: `007-customer-sessions`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description (from the master plan §17): "Implement the customer entry point and secure session model: the restaurant QR / public restaurant route → restaurant page → branch selection if required → table selection for dine-in → customer name + phone → validate/create session context → browse menu. First valid customer interaction opens a dine-in session; other customers using the same restaurant/table flow join the active session. No session timeout — the cashier/authorized operational user controls the close action. The session access mechanism must prevent arbitrary external users from accessing another customer's active session; the exact token/anonymous identity mechanism is finalized during this phase's technical plan. Exit condition: a real customer can enter securely, create/join a session, and recover it without creating a normal account." Constrained by the RestoPilot Constitution (especially Principles I–VIII), the master plan's V1 scope (§3.1) and out-of-scope list (§3.2: no customer accounts, no online payment, no SMS/WhatsApp notifications, no dynamic QR), the session domain model (§6.5: sessions, session participants, customer session identity/token data), the session entity (§7.3: the primary customer ordering container, types dine-in/delivery/takeaway), the session state (§8.1: OPEN/CLOSED, no automatic timeout), the concurrency requirements (§36, Risk 7), and Risk 5 (session security becomes an afterthought — session security is its own feature with dedicated abuse tests); builds directly on feature 002 (restaurant/branch tenancy, enforced isolation, the append-only audit foundation), feature 003 (the staff role/scope authorization model), feature 004 (branches and dining tables — the objects a dine-in session binds to), feature 005 (the branch menu the customer browses after entry), and feature 006 (the tax engine the later rounds will consume — untouched here but structurally respected).

## Clarifications

### Session 2026-09-19

- Q: Should customer entry be refused when the branch is outside its configured working hours? → A: No — entry is not gated by working hours in this phase; hours remain informational on branch pages. A closed branch (inactive) still refuses entry.
- Q: Which staff roles may close a session? → A: The branch's owner, branch manager, or cashier — closing is the checkout-adjacent front-of-house action; kitchen staff are denied.
- Q: How long are customer names and phone numbers (participant rows) retained? → A: Indefinitely — sessions and participants are the restaurant's operational record; no purge or anonymization surface exists in this phase.
- Q: What does the customer see of their session after entry? → A: A minimal persistent indicator (restaurant, branch, and table identity) confirming which session the device is attached to; recovery and reassociation stay silent.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer Entry (Priority: P1)

A customer scans the restaurant's QR code (or opens the restaurant's public route), lands on the restaurant's public page, selects a branch when the restaurant has more than one, selects a dine-in table, enters a display name and a phone number, and reaches the branch's menu — browsing as a valid session customer. No account is created; nothing is asked of the customer beyond name and phone.

**Why this priority**: §17's customer flow is the phase's core; until entry works, no session exists and no later ordering phase can begin. This is the phase's MVP.

**Independent Test**: With the seeded restaurants, open the public route of a seeded restaurant, complete the entry flow (branch, active table, name, phone), and verify the menu browse experience opens with the session context established; verify an unknown restaurant route, an inactive branch, a stopped table, and a blank/overlong name are each rejected with a clear message; verify no staff sign-in is required anywhere in the flow.

**Acceptance Scenarios**:

1. **Given** a restaurant's public route, **When** a customer opens it, **Then** the restaurant's public page renders its name and its branches without any sign-in (FR-001).
2. **Given** a multi-branch restaurant, **When** the customer proceeds, **Then** they select one of the restaurant's active branches; a single-branch restaurant skips the selection (FR-002).
3. **Given** a selected branch, **When** the customer proceeds to dine-in entry, **Then** they select one of that branch's active tables; stopped tables are not selectable (FR-003).
4. **Given** the entry form, **When** the customer submits a valid display name and phone number, **Then** the session context is created and the branch menu opens (FR-004, FR-005).
5. **Given** invalid input at any entry step — an unknown restaurant, an inactive branch, a stopped or nonexistent table, a blank or overlong name, a malformed phone number — **When** it is submitted, **Then** the step is rejected with a clear message and nothing is created (FR-004, FR-016).
6. **Given** the entire flow, **When** it completes, **Then** no customer account, password, or credential was created — the customer's identity exists only inside the session (FR-015).

---

### User Story 2 - The Dine-In Session Model (Priority: P1)

The first valid customer interaction at a table opens that table's session; other customers who enter through the same restaurant/table flow while the session is open join it as participants. The session is the primary ordering container: it stays open until an authorized staff member closes it, regardless of elapsed time.

**Why this priority**: §17's session rules — open on first interaction, join for others, no timeout, staff-controlled close — are the phase's business core and the foundation every ordering phase builds on. Entry (US1) exists to produce it.

**Independent Test**: Open a session at a seeded table, then complete entry again at the same table with a second customer — verify the second customer joined the same session (one session, two participants); verify a third table can open its own session concurrently; verify a session opened days earlier is still open and usable (no timeout); verify the branch's staff can see the active sessions and close one, that closing requires the authorized role, and that every close leaves an audit record.

**Acceptance Scenarios**:

1. **Given** a table with no open session, **When** the first customer completes entry, **Then** exactly one OPEN session is created for that table (FR-005).
2. **Given** a table with an OPEN session, **When** another customer completes the same entry flow for that table, **Then** they join the active session as a participant — no second session is created (FR-006, FR-007).
3. **Given** two customers completing entry for the same vacant table at the same moment, **When** both submissions are processed, **Then** exactly one session exists and both customers are in it (FR-005, FR-007, Risk 7).
4. **Given** an open session untouched for any length of time, **When** it is read or used, **Then** it is still OPEN — inactivity never closes, expires, or invalidates it (FR-008).
5. **Given** an open session, **When** an authorized staff member of that branch closes it, **Then** the session becomes CLOSED, is terminal for later use, and the closure is recorded with who, when, and which session (FR-009, FR-018).
6. **Given** a kitchen member, a cashier of another branch, or a customer token, **When** they attempt to close a session through any access path, **Then** the attempt is denied at the trusted data layer, not merely hidden in the interface (FR-003, FR-020).

---

### User Story 3 - Session Recovery and Access Security (Priority: P2)

A customer's access to their session is bound to an access mechanism issued at entry: possessing it grants exactly that session's context — nothing else. The customer recovers their active session on the same device without re-entering their details; if the session is gone (closed and the table re-seated), the recovering device is refused and returned to entry. An external user without the mechanism cannot reach another customer's active session.

**Why this priority**: §17's exit condition requires recovery, and its security rule plus Risk 5 make the access boundary non-negotiable before ordering rounds arrive in Phase 7 — a leak here becomes an ordering leak there.

**Independent Test**: Complete entry, note the session context, reload the browser and verify the session is recovered without re-entering details; attempt every session-scoped operation without the access mechanism and verify denial; verify the mechanism of one session cannot read or act on another session; close the session, open a new one at the same table, and verify the old device is refused and redirected to entry.

**Acceptance Scenarios**:

1. **Given** a customer with an active session on their device, **When** they return to the customer experience on that device, **Then** their active session is recovered without re-entering name or phone (FR-013).
2. **Given** any session-scoped operation, **When** it is attempted without a valid session access mechanism, **Then** it is denied at the trusted data layer (FR-011, FR-020).
3. **Given** a valid access mechanism for one session, **When** it is used against another session's context, **Then** every operation on the other session is denied (FR-012).
4. **Given** a closed session's device, **When** a new session opens for the same table and the device attempts recovery, **Then** recovery is refused and the customer is returned to the entry flow — reassociated per the closed-session rule (FR-010, FR-014).
5. **Given** the access mechanism's storage, **When** the customer's device loses it, **Then** the customer re-enters through the standard entry flow and joins their table's active session as a participant again (FR-006, FR-013).

---

### User Story 4 - Staff Session Oversight (Priority: P3)

Authorized staff of a branch see their branch's active sessions — which table, opened when, who is in them — and close a session when the guests leave. The oversight view is scoped: each staff member sees only their own branch's sessions.

**Why this priority**: §17 names the staff-controlled close as the only way a session ends; without a minimal oversight surface the close action has no operational home. It completes the lifecycle but does not gate the customer value of US1–US3.

**Independent Test**: As a seeded cashier, view the branch's active sessions and verify another branch's and another restaurant's sessions are invisible and denied at the data layer; close one session and verify its CLOSED state, its audit record, and that the customer-side experience reflects the closure (recovery refused).

**Acceptance Scenarios**:

1. **Given** a branch's authorized staff member, **When** they view sessions, **Then** they see that branch's active sessions with their table, participants, and opened time — and nothing outside their branch (FR-017, FR-019).
2. **Given** an authorized staff member, **When** they close their branch's open session, **Then** the session is CLOSED, the customer side is refused on next contact, and an audit record exists (FR-009, FR-018).
3. **Given** staff of another branch or another restaurant, **When** they attempt to view or close a session outside their scope through any access path, **Then** the attempt is denied at the trusted data layer (FR-019, FR-020).

---

### Edge Cases

- Two devices complete entry for the same vacant table simultaneously — exactly one session opens; the other customer becomes a participant of it (Risk 7's concurrency discipline).
- A customer completes entry for a table whose session is closed moments earlier — a new session opens (the closed session is terminal; the table is free again).
- A device attempts recovery with a stale access mechanism after the table was closed and re-seated — refused and redirected to entry (FR-014).
- A table is stopped (deactivated) while its session is open — the session remains open (no automatic timeout or force-close); new entry for that table is refused.
- Entry attempted outside the branch's working hours — allowed (hours are informational); only an inactive branch refuses entry (FR-023).
- A customer's device loses its access mechanism — they re-enter through the standard flow and rejoin the active session; the participant list grows, no duplicate session appears.
- The same person re-enters with the same name/phone at the same table while the session is open — they join as a participant again (deduplication is not attempted; names are display-only).
- A branch has a single branch — the branch-selection step is skipped automatically.
- Malformed or absurd inputs at entry (a 300-character name, a phone with letters, an empty participant list on close) — rejected with clear messages, nothing stored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a public, no-authentication route per restaurant that resolves the restaurant by its public identifier and renders its public page (name, branding, branch list). Unknown identifiers render a clear not-found state.
- **FR-002**: The entry flow MUST require branch selection when the restaurant has more than one active branch, and MUST skip it when there is exactly one. Only active branches are selectable.
- **FR-003**: The dine-in entry flow MUST require table selection from the chosen branch's active tables; stopped tables and other branches' tables are not selectable.
- **FR-004**: Entry MUST collect a display name and a phone number from each customer and validate them: a non-blank name within a documented length bound, and a phone number of reasonable numeric shape. Invalid input is rejected with a clear message and nothing is created.
- **FR-005**: The first valid customer entry for a table without an open session MUST open exactly one OPEN session for that (restaurant, branch, table) — the dine-in session.
- **FR-006**: A customer completing entry for a table with an OPEN session MUST join that session as a participant, with their display name and phone recorded against the join.
- **FR-007**: A table with an OPEN session MUST NOT open a second session; joining is the only path — enforced at the data layer so simultaneous entries cannot duplicate it.
- **FR-008**: Sessions MUST NOT close, expire, or degrade because of inactivity: there is no timeout.
- **FR-009**: Only authorized staff — the branch's owner, branch manager, or cashier per the established role model — MUST be able to close a session, and only within their own branch (kitchen staff are denied). Closure is an explicit, immediate action with no draft or scheduled state.
- **FR-010**: A CLOSED session MUST be terminal: no later customer or staff action may reopen it, and no ordering round may attach to it. A table with a closed session is eligible for a new session.
- **FR-011**: Every customer session MUST carry an access mechanism issued at entry whose possession grants access to exactly that session's context; the mechanism is verified server-side on every session-scoped operation.
- **FR-012**: The access mechanism MUST be unguessable and MUST NOT leak any other session's context: one session's mechanism yields no read or write on any other session, past or present.
- **FR-013**: A customer MUST be able to recover their active session on the same device without re-entering their details, via a device-persisted reference verified against the server.
- **FR-014**: When recovery references a session that is no longer open, the device MUST be refused and returned to the entry flow — the reassociation rule of the closed-session design.
- **FR-015**: The customer identity MUST NOT become an account: no password, no credential, no linkage to staff identities, no sign-up path. Customer data exists only as session/participant rows.
- **FR-016**: The system MUST maintain each session's participant list (who joined, when), and the opening entry is recorded against the session itself.
- **FR-017**: Authorized staff MUST be able to view their branch's sessions — active ones with table, participants, and opened time; the view is read-only in this phase except for the close action.
- **FR-018**: Every accepted staff action on a session (close) MUST produce an append-only audit record with actor, time, resource, change, and tenant scope. Customer-driven events (open, join) are traceable through the session/participant rows themselves, which carry their timestamps; they produce no audit records because the actor is not an authenticated identity.
- **FR-019**: Staff session access MUST be scoped to the staff member's own branch: reads and the close action are denied outside it at the data layer.
- **FR-020**: Every protected operation — customer session access by mechanism, staff reads and closes by role — MUST be validated server-side (the trusted data layer), never by the interface alone.
- **FR-021**: After entry, the customer browses the branch menu exactly as feature 005 delivers it; this phase adds no menu capability — the session context only carries which branch the customer is at, shown through a minimal persistent indicator (restaurant, branch, table identity) on the customer experience.
- **FR-022**: The session schema, its data-layer functions, and the customer access mechanism MUST be delivered through the canonical migration/seed/types workflow, with no client write grants — data-layer functions are the only write paths.
- **FR-023**: Customer entry MUST NOT be gated by the branch's working hours: hours remain informational, and only an inactive branch refuses entry (clarified posture — no time-based lockout).

## Key Entities

- **Session**: the primary customer ordering container (§7.3) — belongs to a restaurant and branch, binds a dine-in table, carries its type (dine-in in this phase; delivery/takeaway reserved), its state (OPEN | CLOSED per §8.1), opened-at, closed-at, and the staff closer where applicable. One open session per table at most.
- **Session participant**: a customer in a session — display name, phone, joined-at. No account, no credential, no linkage to staff identities (§6.5's session participants). Participant rows are retained indefinitely as the restaurant's operational record — no purge or anonymization in this phase.
- **Session access mechanism**: the customer's anonymous session identity (§6.5's customer session identity/token data) — issued at entry, bound to exactly one session, verifiable server-side, persisted on the customer's device for recovery. Its concrete token form is finalized in this phase's technical plan (§17 explicitly delegates it there).
- **Audit record**: the existing append-only log (feature 002), extended with the session-close event.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A real customer completes QR-to-menu-browsing without an account and without staff assistance; every entry step validates its input and nothing is created on invalid input (100% of the entry validation matrix rejects with a clear message).
- **SC-002**: 100% of session-scoped operations verify the access mechanism server-side; in the dedicated abuse suite, 100% of attempts without a valid mechanism are denied, and 100% of attempts using one session's mechanism against another session are denied.
- **SC-003**: Concurrent entry attempts at the same vacant table produce exactly one session in 100% of trials; both customers end up as participants of it.
- **SC-004**: 100% of same-device recoveries of an active session succeed without re-entering details; 100% of recoveries against a closed-and-reseated table are refused and redirected to entry.
- **SC-005**: 100% of accepted session closes are performed by authorized staff within their own branch and leave exactly one audit record with actor, time, session, and scope; 100% of unauthorized close attempts (kitchen, other branch, other restaurant, customer mechanism) are denied.
- **SC-006**: A session's state never changes due to elapsed time: zero automatic transitions exist (no timeout), verified by an open session remaining OPEN and fully usable arbitrarily long after its last activity.
- **SC-007**: `db:reset` → seed → database test suite exits green and generated types are byte-stable across generations — the deterministic rebuild discipline holds with the session layer added.
- **SC-008**: The project's full quality gate (format, lint, types, unit, database, integration, build) and the browser test suite exit green with this phase's suites included.

## Assumptions

- **Dine-in only in this phase**: §17's flow is explicitly the dine-in path (table selection). The session model carries a type field with `dine-in` today and delivery/takeaway reserved for their ordering phases (§7.3 names the types; §8.3/8.4 tie their lifecycles to later workflows).
- **Phone is operational traceability, not verification**: no SMS, call, or WhatsApp verification exists (§3.2 excludes messaging); the phone number is recorded for the restaurant's operational use.
- **The access mechanism's concrete form is a plan concern**: the spec fixes its required properties — unguessable, bound to one session, server-verified on every operation, device-persisted for recovery — and §17 delegates the exact token/anonymous identity design to this phase's technical plan.
- **"First valid customer interaction"** means a completed, validated entry (valid restaurant, active branch, active table, valid name and phone) for a table without an open session.
- **Participants are display-only identities**: joining again appends a participant; deduplication by name/phone is not attempted (no accounts exist to dedupe against).
- **Closed sessions are kept** (not deleted) for the operational record and the reassociation rule; they are immutable after closure.

## Out of Scope

- Ordering itself: carts, rounds, round items, kitchen tickets — Phase 7 (§18).
- Customer accounts, sign-up, passwords, saved profiles (§3.2).
- Online payment, bill splitting, invoices, receipts (§3.2).
- SMS/WhatsApp/email notifications of any kind (§3.2).
- Dynamic QR codes or per-customer QR rotation (§3.2).
- Delivery and takeaway entry flows and their session lifecycles (§8.3/8.4 — later ordering phases).
- Kitchen operations and any staff workflow beyond session oversight and close (§19 — Phase 8).
- Realtime features (§5.4 — realtime is not the source of truth; nothing in this phase depends on it).
