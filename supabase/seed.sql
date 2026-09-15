-- Baseline seed data for the cloud development database (spec FR-008, data-model.md).
-- Applied by `npm run db:seed` (scripts/db/seed.mjs). Idempotent: safe to re-run.
insert into public.app_meta (key, value)
values ('foundation', 'seeded')
on conflict (key) do nothing;
