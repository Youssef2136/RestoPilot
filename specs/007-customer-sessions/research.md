# Research: Customer Access and Sessions (Phase 6)

**Feature**: `007-customer-sessions` | **Date**: 2026-09-19 | **Plan**: [plan.md](./plan.md)

## §1 — The access mechanism (the spec's explicit plan-delegation)

**Decision**: A pure **server-verified access token**: at entry the data layer generates 32 random bytes with `pgcrypto.gen_random_bytes(32)`, returns the base64url token to the customer exactly once, stores only its SHA-256 hash (`digest(token, 'sha256')`, hex-encoded) in `session_tokens` bound to the session, and verifies it on every customer-scoped operation by hashing the presented token and looking up the hash (unique index → one-row or no-row). The customer's device persists the raw token in `localStorage` (documented key, contracts/session-client.md) for recovery.

**Rationale**: The hosted project has anonymous sign-ins **disabled** (probed 2026-09-19: `anonymous_provider_disabled`), and enabling a provider for this would put one `auth.users` row per customer device into the auth schema — state with operational consequences the master plan never asked for. A plain token keeps the customer entirely outside `auth.users` (FR-015 — no account, no linkage), needs no new provider configuration, no new dependency, and works identically through `anon`-role data-API calls. Unpredictability comes from 256 bits of server entropy; the stored hash makes a database read of the token table useless for impersonation; the unique-hash index makes verification one indexed lookup. The token never appears in a URL after entry — recovery re-validates it from device storage — so referrer/header leakage is out of the threat model; `https` transport is the platform's.

**Alternatives considered**:
- *Supabase anonymous sign-ins* — rejected: provider disabled on the hosted project; would create auth.users rows per device; couples customer identity to the auth schema (FR-015 tension); extra client session lifecycle for no added security over a hashed capability token.
- *JWT signed by the server, stateless* — rejected: revocation on close then requires a denylist (state reintroduced); the session row is the truth (Constitution V), so the token should point at it, not restate it.
- *Signed URL capability (HMAC in the QR link)* — rejected: tokens in URLs leak via logs/referrers; rotation impossible without re-issuing the QR.
- *6-digit table PIN* — rejected as the primary mechanism: ~10^6 space is brute-forceable against a token-check RPC without rate limiting; would need throttling machinery (complexity without a requirement).

## §2 — Public route identity and reads

**Decision**: The public route is `/r/:slug`, resolved against the existing `restaurants.slug` column (present since feature 002, verified in the schema). Public reads go through one `security definer` RPC (`get_public_restaurant(p_slug)`) returning the restaurant's public page payload (name, description, active branches with ids and names) and, for a branch, one `get_session_menu` wrapper that reuses feature 005's payload assembly for the branch menu. `restaurants` itself gains **no anon grants** — the definer functions are the only public read path, keeping PII-adjacent configuration out of row-level reach.

**Rationale**: The slug exists and is unique (feature 002's uniqueness rule); inventing a second public identifier would duplicate the concept (Constitution VIII). A definer read function sidesteps writing `anon`-role RLS policies on tenancy tables (which would widen the read surface beyond this phase's need) and matches the established pattern of explicit, auditable read paths (features 004–006 read RPCs).

**Alternatives considered**: anon-grant + RLS policies on `restaurants`/`branches`/`dining_tables` — rejected: three new policy families on pre-existing tables for a payload two functions can assemble; broader blast radius, no benefit.

## §3 — One open session per table under concurrency (Risk 7)

**Decision**: A **partial unique index** — `create unique index … on sessions (restaurant_id, branch_id, table_id) where status = 'open'` — makes two open sessions for one table impossible at the storage level. The entry RPC inserts the session and lets a unique violation surface as `P0001` "A session is already open at this table. Join it instead." — no advisory locks, no `for update` pre-checks, no retry loop.

**Rationale**: The index is the declarative, race-free guarantee (two concurrent inserts: exactly one commits, the loser gets a deterministic violation). FR-005/FR-007 and SC-003 require exactly this. The `on conflict`-style explicit handling keeps the message customer-facing rather than exposing the constraint name.

**Alternatives considered**: `advisory_xact_lock` around a select-then-insert — rejected: serialization machinery where a constraint suffices; `select … for update` pre-check — rejected: still racy without the lock, and the lock reintroduces the machinery.

## §4 — Session lifecycle rules

**Decision**: `status` is a check-constrained `'open' | 'closed'`. **No timeout of any kind**: no cron, no `expires_at`, no lazy-expiry predicate — an open session stays open until `close_session` flips it. `close_session` is a definer RPC authorizing owner/branch manager/cashier of the session's own branch (the clarified close permission), idempotent-error on an already-closed session (`P0001` "This session is already closed."), setting `status='closed'`, `closed_at=now()`, `closed_by_profile_id=<actor>`, and writing exactly one `session.closed` audit record with branch scope. Recovery against a closed session is refused with the same shape as any invalid token (`P0001` "This session is no longer available." — no information about *why* it is invalid). Reopening is impossible: no RPC sets an open status on an existing closed row (FR-010).

**Rationale**: §8.1 (OPEN/CLOSED, no automatic timeout) and FR-008/FR-010 demand exactly this shape; the clarified role set is encoded directly. Refusing recovery with the invalid-token message implements FR-014's reassociation rule without leaking session history to a stale device.

**Alternatives considered**: soft-close with a grace period, scheduled close, reopen path — all rejected: the spec defines closure as explicit, immediate, and terminal.

## §5 — PII shape and posture

**Decision**: `session_participants` carries `display_name text not null` (trimmed, 1–60 chars) and `phone text not null` (validated shape: 7–15 characters of digits with optional leading `+`, stored trimmed). Both are retained indefinitely (the clarified posture). The three session tables have **zero grants to `anon`/`authenticated`** — participant PII is never directly row-readable by any client role; it appears only inside the definer RPC payloads (customer: their own session context; staff: their own branch's sessions).

**Rationale**: FR-004's validation bounds, the clarified retention, and FR-020's server-side verification all point one way: PII behind functions, not policies. The bounds are generous for real names and international phones while blocking garbage.

**Alternatives considered**: RLS-visible participant tables with column masking — rejected: wider surface, harder to reason about; encrypted phone column — rejected: no requirement drives key management complexity (Constitution VIII).

## §6 — Entry validation bounds

**Decision**: Display name: `btrim` 1–60 characters (any content; the trim guards whitespace-only input). Phone: after stripping spaces, dashes, and parentheses, the remainder must match `^\+?\d{7,15}$` (stored trimmed as entered minus those separators' allowance — the original trimmed string is stored). Table/branch/restaurant validation happens in the RPC: restaurant by slug, branch active, table active and belonging to that branch, per FR-002/FR-003.

**Rationale**: §6 fixed these bounds from the spec's "documented length bound" and "reasonable numeric shape"; they are testable and customer-sensible.

## §7 — Seeded sessions and dev tokens

**Decision**: The seed provisions two open sessions in the demo data (Downtown T1 and T2), participants, and their access tokens with **deterministic dev token values** (documented constants, e.g. the SHA-256 of a fixed dev string per session) so the database and e2e suites can drive customer flows without authenticating anything. The tokens' hashes are computed in SQL at seed time.

**Rationale**: Every prior phase's seed is deterministic for test stability; sessions need the same. Dev tokens are development-only constants in `tests/database/helpers/fixtures.ts` mirrored by `supabase/seed.sql` (the established fixture-constant discipline), never secrets.

**Alternatives considered**: no seeded sessions (tests create everything) — partially adopted: the RPC matrix creates its own scratch sessions; the seed's two demonstrate the staff oversight surface and the e2e flows deterministically.

## §8 — Rejected complexity

- **Token rotation/refresh**: a token is issued at entry and persists for recovery; no rotation requirement exists. Rejected (Constitution VIII).
- **Per-device session-identity table**: device identity beyond the token adds nothing — the token *is* the device's binding. Rejected.
- **Join deduplication by name/phone**: the spec's assumptions explicitly reject it (display-only identity, no accounts). Not built.
- **Rate limiting on token checks**: the token space is 2^256; brute force is not a credible vector; throttling machinery has no requirement. Rejected (documented for the abuse-review posture).
- **Session capacity limits per table**: no requirement names a participant ceiling. Not built.
- **Realtime session state**: §5.4 keeps realtime out; staff list is a pull refresh. Rejected.
