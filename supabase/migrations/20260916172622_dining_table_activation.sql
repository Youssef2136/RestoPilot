-- Dining-table activation state (spec 004 FR-011/FR-012;
-- data-model.md "Entity: dining_tables"; research.md §11).
--
-- Phase 3 migration 2 of 5. The explicit persisted `active | inactive`
-- state, authored only through `set_dining_table_active`: tables are never
-- deleted in this phase, an inactive table stays visible (and renamable),
-- and repeating a transition is a no-op that leaves state consistent.
-- Existing rows default to active — the state every seeded table had
-- implicitly before this column existed.

alter table public.dining_tables
  add column is_active boolean not null default true;
