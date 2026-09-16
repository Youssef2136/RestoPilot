-- Restaurant profile and settings columns, plus the blank-name checks the
-- management RPCs' validation relies on (spec 004 FR-002/FR-003/FR-007;
-- data-model.md "Entity: restaurants"; research.md §10, §14).
--
-- Phase 3 migration 1 of 5. Additive only: every existing row takes the
-- column defaults (`timezone` = 'UTC'), and the new checks hold for every
-- existing row. The authoritative IANA validation of `timezone` is the
-- `update_restaurant_settings` RPC (a check constraint cannot consult
-- `pg_timezone_names`, which is not immutable); the check here only rejects
-- the blank value.

alter table public.restaurants
  add column brand_description text,
  add column contact_email text,
  add column contact_phone text,
  add column timezone text not null default 'UTC';

-- `name` can no longer be blank (FR-001/FR-002); consumed by the
-- create/rename paths of User Story 1 and 2.
alter table public.restaurants
  add constraint restaurants_name_check check (length(btrim(name)) > 0);

-- One restaurant-level timezone setting (FR-003, research.md §10).
alter table public.restaurants
  add constraint restaurants_timezone_check check (length(btrim(timezone)) > 0);

-- Branch display names can no longer be blank (FR-007); consumed by
-- `create_branch` / `rename_branch` in User Story 2.
alter table public.branches
  add constraint branches_name_check check (length(btrim(name)) > 0);
