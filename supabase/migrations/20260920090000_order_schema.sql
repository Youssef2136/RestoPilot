-- ────────────────────────────────────────────────────────────────────────────
-- Phase 7 (cart and rounds) — the order schema (spec 008 T003; data-model.md).
--
-- Discipline inherited from features 002–007: `public` tables, composite
-- tenancy foreign keys `(restaurant_id, …)` everywhere, RLS enabled with no
-- policies, `revoke all … from anon, authenticated` and NO grant of any kind
-- — the two RPCs (the following migration) are the only paths
-- (Constitution III/IV; the zero-grant posture).
--
-- The kitchen ticket deliberately has NO items table: its items are the
-- round's items by construction (research.md §4) — `kitchen_tickets_one_per_round`
-- is the structural one-per-round guarantee.
--
-- Round state is born CLOSED (`state in ('new')`): Phase 8 extends the check,
-- it does not migrate it (FR-012; research.md §8's no-realtime deferral).
-- ────────────────────────────────────────────────────────────────────────────

-- ── rounds: one customer submission (the atomic transaction's artifact) ─────

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  branch_id uuid not null,
  session_id uuid not null references public.sessions (id),
  state text not null default 'new',
  subtotal numeric(14, 2) not null,
  tax_total numeric(14, 2) not null,
  tax_lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint rounds_state_check check (state in ('new')),
  constraint rounds_subtotal_check check (subtotal >= 0),
  constraint rounds_tax_total_check check (tax_total >= 0),
  constraint rounds_branch_scope_fkey
    foreign key (restaurant_id, branch_id) references public.branches (restaurant_id, id),
  -- The composite target the child tables reference (the menu schema's
  -- `menu_items_restaurant_id_id_key` precedent).
  constraint rounds_restaurant_id_id_key unique (restaurant_id, id)
);

-- NOTE: sessions' PK is `id` alone (no composite unique on (restaurant_id,
-- id) — feature 007's documented shape), so the session FK is a plain `id`
-- reference; the (round → session → restaurant/branch) coherence is
-- structural in the submission RPC, which derives restaurant_id, branch_id
-- and session_id together from the token's session row — a round can never
-- name a session outside its declared restaurant/branch because all three
-- come from that one row (contracts/database-functions.md §1).

create index rounds_session_id_idx on public.rounds (session_id);

-- ── round_items: a line of a round (item, quantity, captured unit price) ────

create table public.round_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  round_id uuid not null,
  item_id uuid not null,
  quantity integer not null,
  unit_price numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  constraint round_items_quantity_check check (quantity between 1 and 99),
  constraint round_items_unit_price_check check (unit_price >= 0),
  constraint round_items_round_scope_fkey
    foreign key (restaurant_id, round_id) references public.rounds (restaurant_id, id),
  constraint round_items_item_scope_fkey
    foreign key (restaurant_id, item_id) references public.menu_items (restaurant_id, id),
  constraint round_items_round_item_key unique (round_id, item_id),
  constraint round_items_restaurant_id_id_key unique (restaurant_id, id)
);

create index round_items_round_id_idx on public.round_items (round_id);

-- ── round_item_extras: the structured extras selected on a line ─────────────

create table public.round_item_extras (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  round_item_id uuid not null,
  extra_id uuid not null references public.menu_item_extras (id),
  price_adjustment numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  constraint round_item_extras_price_adjustment_check check (price_adjustment >= 0),
  constraint round_item_extras_line_scope_fkey
    foreign key (restaurant_id, round_item_id) references public.round_items (restaurant_id, id),
  -- NOTE: menu_item_extras carries no composite unique (feature 005's
  -- predates the convention), so the extra FK is a plain `id` reference; the
  -- (extra → item) scope coherence is enforced by the submission RPC before
  -- any insert (contracts/database-functions.md §1 step 4) — the row is
  -- written only after the RPC has verified the extra belongs to the
  -- submitted item, so a cross-item extra can never land.
  constraint round_item_extras_line_extra_key unique (round_item_id, extra_id)
);

create index round_item_extras_round_item_id_idx on public.round_item_extras (round_item_id);

-- ── kitchen_tickets: the operational header for one round (§7.5) ────────────
-- Its items ARE the round's items (same transaction, research §4); the
-- partial unique index is the exactly-one-per-round guarantee.

create table public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  branch_id uuid not null,
  round_id uuid not null,
  state text not null default 'new',
  created_at timestamptz not null default now(),
  constraint kitchen_tickets_state_check check (state in ('new')),
  constraint kitchen_tickets_branch_scope_fkey
    foreign key (restaurant_id, branch_id) references public.branches (restaurant_id, id),
  constraint kitchen_tickets_round_scope_fkey
    foreign key (restaurant_id, round_id) references public.rounds (restaurant_id, id)
);

create unique index kitchen_tickets_one_per_round on public.kitchen_tickets (round_id);

create index kitchen_tickets_branch_id_idx on public.kitchen_tickets (branch_id);

-- ── posture: RLS enabled (no policies), every privilege revoked ─────────────

alter table public.rounds enable row level security;
alter table public.round_items enable row level security;
alter table public.round_item_extras enable row level security;
alter table public.kitchen_tickets enable row level security;

revoke all on public.rounds from anon, authenticated;
revoke all on public.round_items from anon, authenticated;
revoke all on public.round_item_extras from anon, authenticated;
revoke all on public.kitchen_tickets from anon, authenticated;
