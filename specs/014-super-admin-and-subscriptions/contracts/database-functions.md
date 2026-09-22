# Contract: database functions — Super Admin and Subscriptions (Phase 13)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](plan.md)
Verified against the deployed surface 2026-09-22 (post-implement analyze:
signatures, grants, posture all probed live via pg_catalog).

## §1 The four platform RPCs

All four are `security definer`, `search_path = ''`, owned by `postgres`,
executable by `authenticated` ONLY (revoked from `public` and `anon` —
probed: `anon` has no EXECUTE; the refusal for non-flag identities is the
generic 42501, indistinguishable by design).

| Function | Signature | Returns |
|---|---|---|
| `get_platform_overview` | `()` | `jsonb` — array of `{ restaurant_id, name, slug, start_date, end_date, state, platform_disabled, platform_disabled_reason, branch_count, staff_count, session_count, round_count }` ordered by name |
| `get_my_subscription` | `()` | `jsonb` — the caller's (owner's) restaurant payload: the same fields minus usage counts, plus `state` |
| `set_subscription_dates` | `(p_restaurant_id uuid, p_start_date date, p_end_date date)` | `jsonb` — `{ restaurant_id, start_date, end_date, state }` |
| `set_restaurant_platform_disabled` | `(p_restaurant_id uuid, p_disabled boolean, p_reason text)` | `jsonb` — `{ restaurant_id, platform_disabled, changed }` |

Refusal texts (verbatim, `P0001` unless noted):

- Console/read reach: `You do not have permission to view the platform console.` (42501)
- Dates reach: `You do not have permission to manage subscriptions.` (42501)
- Dates null/incomplete: `Both subscription dates are required.`
- Dates inverted: `The subscription end date must not precede its start date.`
- Unknown restaurant: `Restaurant not found.`
- Disablement without reason: `A reason is required to disable a restaurant.`

## §2 The lifecycle derivation (read-time, no stored state)

`private.subscription_state(p_start_date date, p_end_date date) -> text`,
the CASE evaluated at every read — nothing scheduled, no state column
(probed: no `subscription_state`/`lifecycle_state` column anywhere):

- either date null → `never_activated`
- `now()::date > end_date` → `expired`
- `end_date - now()::date <= 7` → `nearing_expiration` (the 7-day window
  INCLUDES day 0 — end = today reads expired first; end = today+7 reads
  nearing_expiration, end = today+8 reads active)
- otherwise → `active`

`platform_disabled` is a SEPARATE axis on `restaurants` — both are
displayed independently; neither derives the other.

## §3 The audited actions (Phase 5's `audit_log`, inline writes)

| Action | Writer | Reason |
|---|---|---|
| `platform.subscription_dates_set` | `set_subscription_dates` | `subscription dates set: <start> → <end> (was <old-start> → <old-end>)` |
| `platform.restaurant_disabled` | `set_restaurant_platform_disabled` | the mandatory operator reason |
| `platform.restaurant_enabled` | `set_restaurant_platform_disabled` | empty (re-enable needs no reason) |

Idempotence: no-op disable/enable (flag already in the target state) returns
`changed: false` and writes NO audit row. Reach for reading these rows stays
Phase 10's `get_audit_log` tenant reach — the affected restaurant's owner
sees the platform's actions in her trail; the platform admin (no
memberships) is refused the tenant read.

## §4 The doors (the only ordering-availability behavior)

When `restaurants.platform_disabled` is true, all three refuse with the
verbatim `This restaurant is not available.` (`P0001`):

- `open_session_at_table` — predicate inserted after the restaurant-exists
  check, before branch/table validation
- `open_session_channel` — predicate inserted after the branch check,
  before channel validation
- `submit_round` — predicate inserted after the token/open-session gate,
  before the Phase 9 cutoffs and cart validation

The bodies are the VERBATIM deployed definitions (007's entry, 010's
channel + cutoffs, 008's ordering discipline, Phase 6's tax engine call)
with exactly one inserted predicate each — the client-parsed shapes
(`parseEntry`: full session + participant keys; `parseRound`) and every
validation text are untouched. **The Important rule**: expired and
never_activated NEVER block ordering — only the manual flag does; a
disabled restaurant's cart is preserved (the refusal fires before any
cart work; the client keeps state and the token).

## §5 Schema + fixture ownership

- `public.subscriptions (restaurant_id uuid PK → restaurants on delete
  cascade, start_date date NULL, end_date date NULL, updated_at timestamptz
  NOT NULL)` — exactly one row per restaurant; a missing row makes the
  tenant invisible to `get_platform_overview` (inner join).
- `restaurants` gains `platform_disabled boolean NOT NULL DEFAULT false`,
  `platform_disabled_reason text`, `platform_disabled_by_profile_id uuid
  → profiles` (the tenancy schema test declares all three).
- Fixture ownership: `supabase/seed.sql` inserts the subscription rows
  (fresh builds: migrations run before the seed's restaurants exist);
  the migration's `insert … select … on conflict do nothing` covers
  in-place upgrades only.
