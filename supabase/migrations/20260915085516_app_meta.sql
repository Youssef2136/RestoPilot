-- Baseline pipeline-proof table (spec FR-007/FR-013/FR-017, data-model.md).
-- Non-business infrastructure: this table must never hold business data.
create table public.app_meta (
  key text primary key not null,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Deny-by-default posture (spec FR-017): row level security is enabled with
-- NO policies, so anon/authenticated roles receive no access. The table owner
-- (migrations, seed, database tests) is unaffected by ownership semantics.
alter table public.app_meta enable row level security;
