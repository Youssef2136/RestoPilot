-- Menu schema: the four Phase 4 tables (spec 005 FR-001, FR-005–FR-013,
-- FR-018, FR-021; data-model.md; research.md §2, §7–§9).
--
-- The restaurant's single shared menu (categories + items), the structured
-- extras of an item, and the presence-only branch override. Every table gets
-- RLS enabled and client-role grants revoked in THIS migration, before any
-- policy exists — the deny-by-default posture established at creation
-- (feature 002 FR-008). The policies, the grants, and the write functions
-- arrive in the following migrations.

-- ── menu_categories: the restaurant's ordered, flat grouping list (FR-001) ──
-- Category names are unique per restaurant, compared case-insensitively after
-- trimming (FR-005): the expression index is the enforcement, and the RPC
-- translates its 23505 into a user-facing message.
-- unique (restaurant_id, id) is the composite anchor menu_items points at.

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_categories_name_check check (length(btrim(name)) > 0),
  constraint menu_categories_name_length_check check (length(name) <= 80),
  constraint menu_categories_description_length_check
    check (description is null or length(description) <= 500),
  constraint menu_categories_sort_order_check check (sort_order >= 0),
  constraint menu_categories_restaurant_id_id_key unique (restaurant_id, id)
);

create unique index menu_categories_restaurant_name_key
  on public.menu_categories (restaurant_id, lower(btrim(name)));

create index menu_categories_restaurant_id_idx on public.menu_categories (restaurant_id);

-- ── menu_items: an orderable product of exactly one category (FR-007) ───────
-- Items are never deleted — availability (is_available) is their lifecycle —
-- so nothing here is soft-deletable and no cascade exists anywhere.
-- price is numeric(12,2): exact decimal money, base amount before tax; the
-- RPC rejects more than two decimals instead of letting the type round
-- (research.md §9). image_path can only reference an object under this row's
-- own tenant and item prefix — a row-level check with no subquery (FR-021).

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  category_id uuid not null,
  name text not null,
  description text,
  price numeric(12,2) not null,
  is_available boolean not null default true,
  image_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_items_name_check check (length(btrim(name)) > 0),
  constraint menu_items_name_length_check check (length(name) <= 120),
  constraint menu_items_description_length_check
    check (description is null or length(description) <= 1000),
  constraint menu_items_price_check check (price >= 0),
  constraint menu_items_sort_order_check check (sort_order >= 0),
  constraint menu_items_image_path_check check (
    image_path is null
    or image_path like 'restaurant/' || restaurant_id::text || '/item/' || id::text || '/%'
  ),
  constraint menu_items_category_scope_fkey
    foreign key (restaurant_id, category_id) references public.menu_categories (restaurant_id, id),
  constraint menu_items_restaurant_id_id_key unique (restaurant_id, id)
);

-- Two items can never reference the same object (FR-021).
create unique index menu_items_image_path_key
  on public.menu_items (image_path)
  where image_path is not null;

create index menu_items_restaurant_id_idx on public.menu_items (restaurant_id);
create index menu_items_category_id_idx on public.menu_items (category_id);

-- ── menu_item_extras: a structured option of exactly one item (FR-018) ──────
-- Flat and independently selectable (clarified 2026-09-17): no group entity,
-- no min/max columns. The 20-per-item bound is a cross-row rule enforced in
-- the RPC under an item-row lock (research.md §8).
-- Restrict (the default) is deliberate: items are never deleted, so no
-- cascade semantics need reasoning about.

create table public.menu_item_extras (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  item_id uuid not null,
  name text not null,
  price_adjustment numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_item_extras_name_check check (length(btrim(name)) > 0),
  constraint menu_item_extras_name_length_check check (length(name) <= 80),
  constraint menu_item_extras_price_adjustment_check check (price_adjustment >= 0),
  constraint menu_item_extras_sort_order_check check (sort_order >= 0),
  constraint menu_item_extras_item_scope_fkey
    foreign key (restaurant_id, item_id) references public.menu_items (restaurant_id, id)
);

create index menu_item_extras_restaurant_id_idx on public.menu_item_extras (restaurant_id);
create index menu_item_extras_item_id_idx on public.menu_item_extras (item_id);

-- ── branch_unavailable_items: the presence-only branch override (FR-013) ────
-- A row means "this item is unavailable at this branch". The existence of the
-- row IS the state, so no value can contradict the clarified one-directional
-- rule: the override hides, it never revives (research.md §2). Clearing is a
-- delete, so "the branch returns to the restaurant-wide state" is structural.
-- Immutable rows: created_at only.

create table public.branch_unavailable_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  branch_id uuid not null,
  item_id uuid not null,
  created_at timestamptz not null default now(),
  constraint branch_unavailable_items_scope_fkey
    foreign key (restaurant_id, branch_id) references public.branches (restaurant_id, id),
  constraint branch_unavailable_items_item_scope_fkey
    foreign key (restaurant_id, item_id) references public.menu_items (restaurant_id, id),
  constraint branch_unavailable_items_branch_item_key unique (branch_id, item_id)
);

create index branch_unavailable_items_restaurant_id_idx
  on public.branch_unavailable_items (restaurant_id);
create index branch_unavailable_items_branch_id_idx
  on public.branch_unavailable_items (branch_id);

-- ── deny-by-default posture from creation (FR-004, FR-026) ─────────────────

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_extras enable row level security;
alter table public.branch_unavailable_items enable row level security;

revoke all on table public.menu_categories from anon, authenticated;
revoke all on table public.menu_items from anon, authenticated;
revoke all on table public.menu_item_extras from anon, authenticated;
revoke all on table public.branch_unavailable_items from anon, authenticated;
