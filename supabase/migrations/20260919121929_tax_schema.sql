-- Tax schema: the six Phase 5 tables (spec 006 FR-005–FR-010, FR-016, FR-017;
-- data-model.md; research.md §1, §5–§7).
--
-- One canonical tax domain: restaurant-level rules (branch_id null) and
-- branch-only rules (branch_id non-null) in one table; per-branch replacement
-- rates in a junction keyed by (branch, rule); rule targets (items and
-- categories) and compound sources in their own junctions, every one of them
-- composite-FK'd so a cross-restaurant reference is structurally impossible
-- (FR-006). Snapshots are deliberately FK-free and self-contained — recorded
-- history must not depend on any other table's lifecycle (research.md §7).
--
-- Every table gets RLS enabled and client-role grants revoked in THIS
-- migration, before any policy exists — the deny-by-default posture
-- established at creation (feature 002 FR-008). The policies, the grants,
-- and the functions arrive in the following migrations.
--
-- Rates are numeric(5,4): an exact percentage with four decimals, 0–100
-- inclusive (research.md §1). Amount arithmetic happens in SQL `numeric`
-- only; the client never computes a value (Constitution V).

-- ── tax_rules: a named tax — restaurant-level or branch-only (FR-005) ───────
-- Names are unique per restaurant across restaurant-level AND branch-only
-- rules (clarified edge case): the expression index is the enforcement and
-- the RPC translates its 23505 into a user-facing message.
-- Retirement (is_active) is the lifecycle; hard delete exists only for rules
-- never applied and unreferenced (FR-010; enforced in the RPC, research §7).

create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  branch_id uuid,
  name text not null,
  rate numeric(5, 4) not null default 0,
  scope text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint tax_rules_name_check check (length(btrim(name)) > 0),
  constraint tax_rules_name_length_check check (length(name) <= 80),
  constraint tax_rules_rate_check check (rate >= 0 and rate <= 100),
  constraint tax_rules_scope_check check (scope in ('total', 'items', 'categories')),
  constraint tax_rules_sort_order_check check (sort_order >= 0),
  constraint tax_rules_restaurant_id_id_key unique (restaurant_id, id)
);

create unique index tax_rules_restaurant_name_key
  on public.tax_rules (restaurant_id, lower(btrim(name)));

create index tax_rules_restaurant_id_idx on public.tax_rules (restaurant_id);
create index tax_rules_branch_id_idx on public.tax_rules (branch_id);
create index tax_rules_order_idx on public.tax_rules (restaurant_id, is_active, sort_order);

-- ── tax_rule_items / tax_rule_categories: multi-target scope (FR-006) ───────
-- A rule names the specific items or categories (of the SAME restaurant) it
-- applies to. The composite FKs make a cross-restaurant target impossible.
-- Cascade: deleting an (unreferenced) rule removes its targets — the only
-- delete path is delete_unused_tax_rule, which refuses referenced rules.

create table public.tax_rule_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  rule_id uuid not null,
  item_id uuid not null,
  created_at timestamptz not null default now(),
  constraint tax_rule_items_scope_fkey
    foreign key (restaurant_id, rule_id) references public.tax_rules (restaurant_id, id) on delete cascade,
  constraint tax_rule_items_item_scope_fkey
    foreign key (restaurant_id, item_id) references public.menu_items (restaurant_id, id) on delete cascade,
  constraint tax_rule_items_rule_item_key unique (rule_id, item_id)
);

create table public.tax_rule_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  rule_id uuid not null,
  category_id uuid not null,
  created_at timestamptz not null default now(),
  constraint tax_rule_categories_scope_fkey
    foreign key (restaurant_id, rule_id) references public.tax_rules (restaurant_id, id) on delete cascade,
  constraint tax_rule_categories_category_scope_fkey
    foreign key (restaurant_id, category_id) references public.menu_categories (restaurant_id, id) on delete cascade,
  constraint tax_rule_categories_rule_category_key unique (rule_id, category_id)
);

create index tax_rule_items_rule_id_idx on public.tax_rule_items (rule_id);
create index tax_rule_items_item_id_idx on public.tax_rule_items (item_id);
create index tax_rule_categories_rule_id_idx on public.tax_rule_categories (rule_id);
create index tax_rule_categories_category_id_idx on public.tax_rule_categories (category_id);

-- ── tax_rule_compounds: the explicit compound-base references (FR-012) ──────
-- A rule MAY name other rules of the same restaurant whose amounts feed its
-- base when they applied earlier in the order. Self-reference is refused
-- declaratively; cross-restaurant references are structurally impossible.
-- Save-time validation (source active, sorts earlier) lives in the RPC.

create table public.tax_rule_compounds (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  rule_id uuid not null,
  source_rule_id uuid not null,
  created_at timestamptz not null default now(),
  constraint tax_rule_compounds_scope_fkey
    foreign key (restaurant_id, rule_id) references public.tax_rules (restaurant_id, id) on delete cascade,
  constraint tax_rule_compounds_source_scope_fkey
    foreign key (restaurant_id, source_rule_id) references public.tax_rules (restaurant_id, id) on delete cascade,
  constraint tax_rule_compounds_rule_id_source_rule_id_key unique (rule_id, source_rule_id),
  constraint tax_rule_compounds_no_self_check check (rule_id <> source_rule_id)
);

create index tax_rule_compounds_rule_id_idx on public.tax_rule_compounds (rule_id);
create index tax_rule_compounds_source_rule_id_idx on public.tax_rule_compounds (source_rule_id);

-- ── branch_tax_overrides: the per-branch replacement rate (FR-009) ──────────
-- A row replaces a restaurant-level rule's rate at one branch. Only
-- restaurant-level rules can be overridden (a branch-only rule is already
-- branch-local) — the RPC enforces the shape; the composite FKs keep the
-- override inside the rule's restaurant. Clearing = deleting the row, so
-- "the branch returns to the restaurant default" is structural.

create table public.branch_tax_overrides (
  branch_id uuid not null,
  rule_id uuid not null,
  restaurant_id uuid not null,
  rate numeric(5, 4) not null,
  created_at timestamptz not null default now(),
  constraint branch_tax_overrides_pkey primary key (branch_id, rule_id),
  constraint branch_tax_overrides_branch_scope_fkey
    foreign key (restaurant_id, branch_id) references public.branches (restaurant_id, id),
  constraint branch_tax_overrides_rule_scope_fkey
    foreign key (restaurant_id, rule_id) references public.tax_rules (restaurant_id, id),
  constraint branch_tax_overrides_rate_check check (rate >= 0 and rate <= 100)
);

create index branch_tax_overrides_rule_id_idx on public.branch_tax_overrides (rule_id);

-- ── tax_snapshots: self-contained recorded history (FR-016, FR-017) ────────
-- No FK to any table — immutability must not depend on another table's
-- lifecycle. The fingerprint is the canonical deterministic content of a real
-- calculation (research.md §3); the PARTIAL unique index makes once-only
-- recording declarative (Constitution VI) while leaving the mechanism's
-- unrecorded rows free of the constraint. No surface writes snapshots in this
-- phase (clarification 3): the function is granted and test-proven only.

create table public.tax_snapshots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  fingerprint text not null,
  recorded_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create unique index tax_snapshots_fingerprint_once_key
  on public.tax_snapshots (restaurant_id, branch_id, fingerprint)
  where recorded_at is not null;

create index tax_snapshots_restaurant_id_idx on public.tax_snapshots (restaurant_id);
create index tax_snapshots_branch_id_idx on public.tax_snapshots (branch_id);

-- ── deny-by-default posture from creation (FR-004, FR-019) ─────────────────

alter table public.tax_rules enable row level security;
alter table public.tax_rule_items enable row level security;
alter table public.tax_rule_categories enable row level security;
alter table public.tax_rule_compounds enable row level security;
alter table public.branch_tax_overrides enable row level security;
alter table public.tax_snapshots enable row level security;

revoke all on table public.tax_rules from anon, authenticated;
revoke all on table public.tax_rule_items from anon, authenticated;
revoke all on table public.tax_rule_categories from anon, authenticated;
revoke all on table public.tax_rule_compounds from anon, authenticated;
revoke all on table public.branch_tax_overrides from anon, authenticated;
revoke all on table public.tax_snapshots from anon, authenticated;
