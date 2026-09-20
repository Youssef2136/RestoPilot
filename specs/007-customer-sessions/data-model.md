# Data Model: Customer Access and Sessions (Phase 6)

**Feature**: `007-customer-sessions` | **Date**: 2026-09-19 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Extends the tenancy model of features 002–006: no new tenancy entity, no new staff role, no columns on existing tables. Three new tables in the `public` schema, RLS-enabled with **`revoke all … from anon, authenticated`** and **no subsequent grant of any kind** — the RPC layer is the entire surface (research §5). All ids `uuid primary key default gen_random_uuid()`; `created_at timestamptz not null default now()` on every table; the staff close audits via `private.record_audit`.

## ERD (textual)

```text
restaurants (002) 1───∞ sessions ∞───1 branches (002/004)
                        │ ∞───1 dining_tables (004)        [dine-in binding]
                        │ 1
                        ├───∞ session_participants          [who joined, when]
                        └───∞ session_tokens                [hash-bound access mechanism]
```

## Tables

### `sessions`

The customer ordering container (§7.3) — dine-in in this phase.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `restaurant_id` | `uuid` | `not null` — composite tenancy anchor |
| `branch_id` | `uuid` | `not null` — composite FK to `branches(restaurant_id, id)` |
| `table_id` | `uuid` | `not null` — composite FK to `dining_tables(restaurant_id, branch_id, id)` |
| `type` | `text` | `not null default 'dine-in'`, `check (type in ('dine-in'))` — delivery/takeaway reserved for their phases (spec Assumptions) |
| `status` | `text` | `not null default 'open'`, `check (status in ('open','closed'))` (§8.1) |
| `opened_at` | `timestamptz` | `not null default now()` |
| `closed_at` | `timestamptz` | `null` — set only by `close_session` |
| `closed_by_profile_id` | `uuid` | `null` — composite FK to `profiles(restaurant_id, id)`; set only by `close_session` |
| `created_at` | `timestamptz` | `not null default now()` |

**Constraints & indexes**:
- `sessions_one_open_per_table`: **partial unique index** `on (restaurant_id, branch_id, table_id) where status = 'open'` — the race-free one-open-session-per-table guarantee (FR-005/FR-007, research §3).
- `sessions_closed_shape`: `check ((status = 'open' and closed_at is null and closed_by_profile_id is null) or (status = 'closed' and closed_at is not null and closed_by_profile_id is not null))` — closure state is never half-written.

### `session_participants`

A customer in a session (§6.5's session participants) — display-only identity, no account (FR-015).

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `session_id` | `uuid` | `not null` — FK to `sessions(id)` |
| `restaurant_id` | `uuid` | `not null` — composite tenancy anchor (mirrors the session's) |
| `display_name` | `text` | `not null`, `btrim(length) between 1 and 60` |
| `phone` | `text` | `not null`, shape per research §6 (`^\+?\d{7,15}$` after separator strip) |
| `joined_at` | `timestamptz` | `not null default now()` |
| `created_at` | `timestamptz` | `not null default now()` |

**Constraints & indexes**: FK to the session; index on `(session_id)` for the participant listing; the retention posture is indefinite (clarification 3 — no purge surface exists).

### `session_tokens`

The access mechanism (§6.5's customer session identity/token data) — one token per entry, bound to exactly one session (FR-011/FR-012).

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `session_id` | `uuid` | `not null` — FK to `sessions(id)` |
| `restaurant_id` | `uuid` | `not null` — composite tenancy anchor (mirrors the session's) |
| `token_hash` | `text` | `not null`, **unique** — `encode(digest(token, 'sha256'), 'hex')`; the raw token is never stored |
| `created_at` | `timestamptz` | `not null default now()` |

**Constraints & indexes**: unique index on `token_hash` (the verification lookup); index on `(session_id)` for session-scoped cleanup/inspection.

## Grant posture (the load-bearing decision)

All three tables: `revoke all on … from anon, authenticated` and **no grant follows**. No RLS policy is defined because no role can reach the tables directly — the definer RPCs are the only read/write paths (Constitution IV/V; research §5). This is stricter than features 004–006, which granted `select` on client-readable tables: session PII and token hashes are never directly row-readable.

## State transitions

```text
            entry (open_session_at_table)
  (none) ──────────────────────────────▶ OPEN ── close_session (owner/manager/cashier, own branch) ──▶ CLOSED (terminal)
                     ▲                                                        │
                     └────────────── the table is free for a new session ─────┘
```

- OPEN → CLOSED is the only transition; there is no timeout, no reopen, no draft state (FR-008/FR-009/FR-010; §8.1).
- Closed sessions are kept (not deleted) for the operational record (clarified retention; FR-014's reassociation rule).
