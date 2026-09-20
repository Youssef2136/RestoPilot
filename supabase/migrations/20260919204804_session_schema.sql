-- Session schema: the three Phase 6 tables (spec 007 FR-005, FR-007, FR-011,
-- FR-016, FR-020; data-model.md; research.md §1, §3, §5, §6).
--
-- The customer session domain: `sessions` is the ordering container —
-- dine-in only this phase, OPEN/CLOSED per master plan §8.1, at most one
-- open session per table enforced by a PARTIAL unique index so concurrent
-- entries cannot duplicate one (FR-005/FR-007; the storage level is the
-- guarantee, not a procedure). `session_participants` carries the
-- display-only customer identity (no account, no credential — FR-015).
-- `session_tokens` carries the access mechanism: only the SHA-256 hash is
-- stored; the raw token is shown once at entry and never persisted
-- (research.md §1).
--
-- Security posture STRICTER than features 004–006: the three tables carry
-- ZERO grants to any client role (anon and authenticated alike) and no RLS
-- policy is defined — the seven RPCs of the following migration are the
-- entire surface, so participant PII and token hashes are never directly
-- row-readable (research.md §5; Constitution IV/V).
--
-- Every table gets RLS enabled and client-role grants revoked in THIS
-- migration — the deny-by-default posture established at creation
-- (feature 002 FR-008), here hardened to grant-less.

-- ── sessions: the customer ordering container (§7.3; FR-005) ────────────────
-- `type` is constrained to 'dine-in' this phase; delivery/takeaway arrive
-- with their ordering phases and extend the check then (spec Assumptions).
-- Closure state is never half-written: status/closed_at/closed_by must
-- agree (sessions_closed_shape).

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  branch_id uuid not null,
  table_id uuid not null,
  type text not null default 'dine-in',
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by_profile_id uuid,
  created_at timestamptz not null default now(),
  constraint sessions_type_check check (type in ('dine-in')),
  constraint sessions_status_check check (status in ('open', 'closed')),
  constraint sessions_branch_scope_fkey
    foreign key (restaurant_id, branch_id) references public.branches (restaurant_id, id),
  constraint sessions_table_fkey
    foreign key (table_id) references public.dining_tables (id),
  constraint sessions_closed_by_fkey
    foreign key (closed_by_profile_id) references public.profiles (id),
  constraint sessions_closed_shape check (
    (status = 'open' and closed_at is null and closed_by_profile_id is null)
    or
    (status = 'closed' and closed_at is not null and closed_by_profile_id is not null)
  )
);

-- The race-free one-open-session-per-table guarantee (FR-005/FR-007;
-- research.md §3): two concurrent entries, exactly one winner.
create unique index sessions_one_open_per_table
  on public.sessions (restaurant_id, branch_id, table_id)
  where status = 'open';

create index sessions_branch_id_idx on public.sessions (branch_id);
create index sessions_status_idx on public.sessions (status);

-- NOTE: dining_tables' PK is `id` alone (no composite unique on
-- (restaurant_id, branch_id, id)), so the table FK is a plain `id` reference;
-- the (table → branch → restaurant) coherence is enforced by the entry RPC
-- before any insert (contracts/database-functions.md §2) and by the composite
-- branch FK above — a session can never name a table outside its declared
-- branch's restaurant because the RPC resolves all three together.

-- ── session_participants: who joined, when (§6.5; FR-006, FR-016) ───────────
-- Display-only identity: a name within a documented bound and a phone of
-- reasonable numeric shape (research.md §6). Retained indefinitely
-- (clarification 3) — no purge surface exists in this phase.

create table public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id),
  restaurant_id uuid not null references public.restaurants (id),
  display_name text not null,
  phone text not null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint session_participants_name_check check (length(btrim(display_name)) between 1 and 60),
  constraint session_participants_phone_check
    check (phone ~ '^\+?[0-9]{7,15}$'),
  constraint session_participants_restaurant_fkey
    foreign key (restaurant_id) references public.restaurants (id)
);

create index session_participants_session_id_idx on public.session_participants (session_id);

-- ── session_tokens: the access mechanism (§6.5; FR-011, FR-012) ─────────────
-- One token per entry, bound to exactly one session. The unique hash index
-- IS the verification lookup (one-row-or-no-row); a database read of this
-- table yields nothing usable for impersonation (research.md §1).

create table public.session_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id),
  restaurant_id uuid not null references public.restaurants (id),
  token_hash text not null,
  created_at timestamptz not null default now(),
  constraint session_tokens_hash_check check (length(token_hash) = 64)
);

create unique index session_tokens_token_hash_key on public.session_tokens (token_hash);
create index session_tokens_session_id_idx on public.session_tokens (session_id);

-- ── deny-by-default + the zero-grant posture ─────────────────────────────────
-- RLS is enabled (defense in depth) and every privilege is revoked from both
-- client roles. NO grant follows — in any migration. The RPC layer is the
-- entire surface (research.md §5; Constitution IV).

alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_tokens enable row level security;

revoke all on public.sessions from anon, authenticated;
revoke all on public.session_participants from anon, authenticated;
revoke all on public.session_tokens from anon, authenticated;
