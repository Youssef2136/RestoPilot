# Contract: Database Functions — Customer Sessions (Phase 6)

**Feature**: `007-customer-sessions` | **Data model**: [data-model.md](../data-model.md) | **Research**: [research.md](./research.md)

Conventions inherited from features 004–006: every function is `security definer`, `set search_path = ''`, schema-qualified, and authorizes as its first act. Authorization failures raise `42501`; validation failures raise `P0001` with the exact messages quoted here; constraint violations are caught by name and re-raised as clear messages. All functions are granted `execute` to `anon, authenticated` unless noted (the customer side calls unauthenticated by design). **The three session tables carry zero client grants** — these functions are the entire surface.

## §1 Public reads (no authentication)

### `get_public_restaurant(p_slug text) → jsonb`

- Resolves the restaurant by `slug` (case-sensitive exact match); unknown slug → `P0001` "Restaurant not found."
- Returns `{ restaurant: { id, name, slug, brand_description }, branches: [{ id, name, is_active }] }` — active branches for entry; inactive ones are excluded.
- No rate limiting this phase (research §8); the payload carries no PII and no configuration beyond the public page's needs.

## §2 Customer entry and session operations (token-authorized)

### `open_session_at_table(p_restaurant_id uuid, p_branch_id uuid, p_table_id uuid, p_display_name text, p_phone text) → jsonb`

- Validates in order: restaurant exists (`P0001` "Restaurant not found."); branch active and belongs to it (`P0001` "Branch not found." when inactive or foreign); table active, belongs to that branch (`P0001` "Table not found."); name `btrim` 1–60 (`P0001` "A display name is required." / "A display name may be at most 60 characters."); phone shape per research §6 (`P0001` "A valid phone number is required.").
- Behavior: if the table has an open session → **join** (append a participant, issue a new token for that session). Otherwise → **open** exactly one session (insert; the partial unique index makes the concurrent race produce one winner — the loser re-reads and joins, FR-005/FR-007).
- Returns `{ session: { id, restaurant_id, branch_id, table_id, type, status, opened_at }, token: <base64url>, participant: { id, display_name, joined_at } }`. The token is returned once; only its SHA-256 hash is stored.
- No audit record (customer actor; traceable through the timestamped rows — spec FR-018's posture).

### `get_session_context(p_token text) → jsonb`

- Verifies `encode(digest(p_token, 'sha256'), 'hex')` against `session_tokens` (unique lookup). Unknown/expired/closed → `P0001` "This session is no longer available." (the closed case is deliberately indistinguishable — FR-014's reassociation rule without history leakage).
- Returns `{ session: { id, restaurant_id, branch_id, table_id, type, status, opened_at }, indicator: { restaurant_name, branch_name, table_label }, participants: [{ id, display_name, joined_at }] }` — the minimal indicator data plus the session's context.

### `get_session_menu(p_token text) → jsonb`

- Same token verification; returns the branch menu exactly as feature 005's `get_branch_menu` assembles it, from the token's session's branch. The customer can only ever read the menu of the branch their session binds.

## §3 Staff operations (role-authorized)

### `get_branch_open_sessions(p_branch_id uuid) → jsonb`

- Authorizes: owner of the branch's restaurant, branch manager or cashier **of that branch** (`42501` otherwise — kitchen too). Returns the branch's open sessions ordered by `opened_at`: `{ sessions: [{ id, table_id, table_label, opened_at, participants: [{ id, display_name, joined_at }] }] }`.

### `close_session(p_session_id uuid) → jsonb`

- Authorizes: owner of the session's restaurant, branch manager or cashier **of the session's branch** (`42501` "You do not have permission to close this session." otherwise). Already-closed → `P0001` "This session is already closed."
- Sets `status='closed'`, `closed_at=now()`, `closed_by_profile_id` to the actor; writes exactly one `private.record_audit` record — action `session.closed`, resource `session`, change `session=<id>; table=<label>`, tenant scope + branch scope.
- Returns `{ closed: true, closed_at }`.

## §4 Authorization summary

| Caller | `get_public_restaurant` | `open_session_at_table` | `get_session_context` / `get_session_menu` | `get_branch_open_sessions` | `close_session` |
|---|---|---|---|---|---|
| `anon` (customer) | ✓ | ✓ | ✓ with valid token | ✗ `42501` | ✗ `42501` |
| `authenticated` customer token (no session role) | ✓ | ✓ | ✓ with valid token | ✗ `42501` | ✗ `42501` |
| Staff: cashier (own branch) | ✓ | ✓ | ✓ | ✓ own branch | ✓ own branch |
| Staff: branch manager (own branch) | ✓ | ✓ | ✓ | ✓ own branch | ✓ own branch |
| Staff: owner | ✓ | ✓ | ✓ | ✓ any branch of restaurant | ✓ any branch of restaurant |
| Staff: kitchen (own branch) | ✓ | ✓ | ✓ | ✗ `42501` | ✗ `42501` |
| Any caller, other restaurant's data | public payload only | joins/opens only via its own flow | ✗ | ✗ `42501` | ✗ `42501` |

## §5 Error vocabulary

`42501` for authorization ("You do not have permission to …", matching features 004–006); `P0001` for validation/lifecycle with the messages quoted above; `23505` (unique violation) caught by constraint name → the join-instead message. The client maps `42501` → `AuthorizationError` and `P0001` → `SessionError`, surfacing the server message verbatim (contracts/session-client.md).
