-- Seed data for the cloud development database.
-- Applied by `npm run db:seed` (scripts/db/seed.mjs). Idempotent: safe to re-run.
--
-- Baseline row (feature 001 FR-008).
insert into public.app_meta (key, value)
values ('foundation', 'seeded')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tenancy fixture (spec 002 FR-015; data-model.md seed table).
-- Deterministic UUIDs — MUST stay identical to
-- tests/database/helpers/fixtures.ts (the suites assert through them).
--
-- Isolation matrix in data form: Blue Olive owns Downtown + Marina; Cedar
-- Grill owns Airport. Eve holds memberships in BOTH restaurants (owner of
-- Cedar Grill, cashier at Downtown). Platform Admin carries the super-admin
-- flag with no memberships (modeled-only posture).
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.restaurants (id, name, slug) values
  ('00000000-0000-4000-8000-000000000001', 'Blue Olive', 'blue-olive'),
  ('00000000-0000-4000-8000-000000000002', 'Cedar Grill', 'cedar-grill')
on conflict (id) do nothing;

insert into public.branches (id, restaurant_id, name) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Downtown'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Marina'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000002', 'Airport')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seeded staff auth identities (spec 003 FR-021; research.md §1–§4;
-- contracts/supabase-auth-surface.md provisioning contract).
--
-- The ONLY writer to auth.users/auth.identities in Phase 2. Every element is
-- load-bearing (live-verified failure modes — see the contract): instance_id
-- must not be NULL; the five token columns must be EMPTY STRINGS, not NULL;
-- email_confirmed_at must be set; ids equal tests/database/helpers/fixtures.ts
-- authUserIds so a signed-in session's `sub` resolves the Phase 1 policies.
-- Passwords are the documented dev values (data-model.md seed table), hashed
-- with pgcrypto bcrypt cost 10. Identities are inserted BEFORE the profiles
-- block (the Phase 2 FK requires the identity to exist) and survive db:reset
-- (the auth schema is untouched). Idempotent via on conflict (id) do nothing.
-- ─────────────────────────────────────────────────────────────────────────────

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current, created_at, updated_at
) values
  ('00000000-0000-4000-8000-000000002001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@restopilot.dev', crypt('dev-alice-2026', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', now(), now()),
  ('00000000-0000-4000-8000-000000002002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@restopilot.dev', crypt('dev-bob-2026', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', now(), now()),
  ('00000000-0000-4000-8000-000000002003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carla@restopilot.dev', crypt('dev-carla-2026', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', now(), now()),
  ('00000000-0000-4000-8000-000000002004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dan@restopilot.dev', crypt('dev-dan-2026', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', now(), now()),
  ('00000000-0000-4000-8000-000000002005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve@restopilot.dev', crypt('dev-eve-2026', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', now(), now()),
  ('00000000-0000-4000-8000-000000002006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'platform-admin@restopilot.dev', crypt('dev-platform-admin-2026', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', now(), now())
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000002001', '00000000-0000-4000-8000-000000002001', 'email', '00000000-0000-4000-8000-000000002001', '{"sub":"00000000-0000-4000-8000-000000002001","email":"alice@restopilot.dev","email_verified":true}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-000000002002', 'email', '00000000-0000-4000-8000-000000002002', '{"sub":"00000000-0000-4000-8000-000000002002","email":"bob@restopilot.dev","email_verified":true}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002003', '00000000-0000-4000-8000-000000002003', 'email', '00000000-0000-4000-8000-000000002003', '{"sub":"00000000-0000-4000-8000-000000002003","email":"carla@restopilot.dev","email_verified":true}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002004', '00000000-0000-4000-8000-000000002004', 'email', '00000000-0000-4000-8000-000000002004', '{"sub":"00000000-0000-4000-8000-000000002004","email":"dan@restopilot.dev","email_verified":true}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002005', '00000000-0000-4000-8000-000000002005', 'email', '00000000-0000-4000-8000-000000002005', '{"sub":"00000000-0000-4000-8000-000000002005","email":"eve@restopilot.dev","email_verified":true}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002006', '00000000-0000-4000-8000-000000002006', 'email', '00000000-0000-4000-8000-000000002006', '{"sub":"00000000-0000-4000-8000-000000002006","email":"platform-admin@restopilot.dev","email_verified":true}'::jsonb, now(), now())
on conflict (id) do nothing;

-- Profiles link to the identities above (the FK requires the identity to
-- exist). The upsert re-establishes linkage on re-runs: after db:reset the
-- re-created profiles re-link to the surviving auth identities.
insert into public.profiles (id, display_name, auth_user_id, is_super_admin) values
  ('00000000-0000-4000-8000-000000001001', 'Alice', '00000000-0000-4000-8000-000000002001', false),
  ('00000000-0000-4000-8000-000000001002', 'Bob', '00000000-0000-4000-8000-000000002002', false),
  ('00000000-0000-4000-8000-000000001003', 'Carla', '00000000-0000-4000-8000-000000002003', false),
  ('00000000-0000-4000-8000-000000001004', 'Dan', '00000000-0000-4000-8000-000000002004', false),
  ('00000000-0000-4000-8000-000000001005', 'Eve', '00000000-0000-4000-8000-000000002005', false),
  ('00000000-0000-4000-8000-000000001006', 'Platform Admin', '00000000-0000-4000-8000-000000002006', true)
on conflict (id) do update set auth_user_id = excluded.auth_user_id;

insert into public.staff_memberships (id, profile_id, restaurant_id, role, branch_id) values
  ('00000000-0000-4000-8000-000000004001', '00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000001', 'owner', null),
  ('00000000-0000-4000-8000-000000004002', '00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000001', 'branch_manager', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000004003', '00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000001', 'cashier', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000004004', '00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000001', 'kitchen', '00000000-0000-4000-8000-000000000102'),
  ('00000000-0000-4000-8000-000000004005', '00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000002', 'owner', null),
  ('00000000-0000-4000-8000-000000004006', '00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000001', 'cashier', '00000000-0000-4000-8000-000000000101')
on conflict (id) do nothing;

insert into public.dining_tables (id, restaurant_id, branch_id, label) values
  ('00000000-0000-4000-8000-000000003001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T1'),
  ('00000000-0000-4000-8000-000000003002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T2'),
  ('00000000-0000-4000-8000-000000003003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T3'),
  ('00000000-0000-4000-8000-000000003004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'T1'),
  ('00000000-0000-4000-8000-000000003005', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201', 'T1')
on conflict (id) do nothing;
