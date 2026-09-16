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

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 restaurant profile/settings convergence (spec 004 FR-023; research.md
-- §15; data-model.md seed table). Values copied verbatim from
-- tests/database/helpers/fixtures.ts (`seedRestaurantSettings`).
--
-- `on conflict (id) do update` for the NEW columns only: `name`/`slug` keep the
-- `do nothing` semantics of the block above, while a database migrated in place
-- converges to the fixture's brand/contact/timezone values without a reset.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.restaurants
  (id, name, slug, brand_description, contact_email, contact_phone, timezone)
values
  ('00000000-0000-4000-8000-000000000001', 'Blue Olive', 'blue-olive',
   'Wood-fired Mediterranean plates in a former harbour warehouse.',
   'hello@blue-olive.example', '+351 21 555 0100', 'Europe/Lisbon'),
  ('00000000-0000-4000-8000-000000000002', 'Cedar Grill', 'cedar-grill',
   'Charcoal grill house serving late into the night.',
   'hello@cedar-grill.example', '+34 91 555 0200', 'Europe/Madrid')
on conflict (id) do update set
  brand_description = excluded.brand_description,
  contact_email = excluded.contact_email,
  contact_phone = excluded.contact_phone,
  timezone = excluded.timezone;

insert into public.branches (id, restaurant_id, name) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Downtown'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Marina'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000002', 'Airport')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seeded staff auth identities (spec 003 FR-021; research.md §1–§4;
-- contracts/supabase-auth-surface.md provisioning contract). Seven identities
-- since Phase 3: the six staff fixtures plus **Fiona** (spec 004 FR-023) — a
-- linked profile with NO memberships, the creation-bootstrap fixture for
-- FR-001 and the `RequireProfile` dashboard panel.
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
  ('00000000-0000-4000-8000-000000002006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'platform-admin@restopilot.dev', crypt('dev-platform-admin-2026', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', now(), now()),
  ('00000000-0000-4000-8000-000000002007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fiona@restopilot.dev', crypt('dev-fiona-2026', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '', '', now(), now())
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000002001', '00000000-0000-4000-8000-000000002001', 'email', '00000000-0000-4000-8000-000000002001', '{"sub":"00000000-0000-4000-8000-000000002001","email":"alice@restopilot.dev","email_verified":true}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-000000002002', 'email', '00000000-0000-4000-8000-000000002002', '{"sub":"00000000-0000-4000-8000-000000002002","email":"bob@restopilot.dev","email_verified":true}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002003', '00000000-0000-4000-8000-000000002003', 'email', '00000000-0000-4000-8000-000000002003', '{"sub":"00000000-0000-4000-8000-000000002003","email":"carla@restopilot.dev","email_verified":true}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002004', '00000000-0000-4000-8000-000000002004', 'email', '00000000-0000-4000-8000-000000002004', '{"sub":"00000000-0000-4000-8000-000000002004","email":"dan@restopilot.dev","email_verified":true}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002005', '00000000-0000-4000-8000-000000002005', 'email', '00000000-0000-4000-8000-000000002005', '{"sub":"00000000-0000-4000-8000-000000002005","email":"eve@restopilot.dev","email_verified":true}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002006', '00000000-0000-4000-8000-000000002006', 'email', '00000000-0000-4000-8000-000000002006', '{"sub":"00000000-0000-4000-8000-000000002006","email":"platform-admin@restopilot.dev","email_verified":true}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000002007', '00000000-0000-4000-8000-000000002007', 'email', '00000000-0000-4000-8000-000000002007', '{"sub":"00000000-0000-4000-8000-000000002007","email":"fiona@restopilot.dev","email_verified":true}'::jsonb, now(), now())
on conflict (id) do nothing;

-- Profiles link to the identities above (the FK requires the identity to
-- exist). The upsert re-establishes linkage on re-runs: after db:reset the
-- re-created profiles re-link to the surviving auth identities. Fiona holds
-- NO membership row (spec 004 FR-023 — the membership-less creation
-- bootstrap, distinct from the modeled-only super admin).
insert into public.profiles (id, display_name, auth_user_id, is_super_admin) values
  ('00000000-0000-4000-8000-000000001001', 'Alice', '00000000-0000-4000-8000-000000002001', false),
  ('00000000-0000-4000-8000-000000001002', 'Bob', '00000000-0000-4000-8000-000000002002', false),
  ('00000000-0000-4000-8000-000000001003', 'Carla', '00000000-0000-4000-8000-000000002003', false),
  ('00000000-0000-4000-8000-000000001004', 'Dan', '00000000-0000-4000-8000-000000002004', false),
  ('00000000-0000-4000-8000-000000001005', 'Eve', '00000000-0000-4000-8000-000000002005', false),
  ('00000000-0000-4000-8000-000000001006', 'Platform Admin', '00000000-0000-4000-8000-000000002006', true),
  ('00000000-0000-4000-8000-000000001007', 'Fiona', '00000000-0000-4000-8000-000000002007', false)
on conflict (id) do update set auth_user_id = excluded.auth_user_id;

insert into public.staff_memberships (id, profile_id, restaurant_id, role, branch_id) values
  ('00000000-0000-4000-8000-000000004001', '00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000001', 'owner', null),
  ('00000000-0000-4000-8000-000000004002', '00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000001', 'branch_manager', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000004003', '00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000001', 'cashier', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000004004', '00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000001', 'kitchen', '00000000-0000-4000-8000-000000000102'),
  ('00000000-0000-4000-8000-000000004005', '00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000002', 'owner', null),
  ('00000000-0000-4000-8000-000000004006', '00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000001', 'cashier', '00000000-0000-4000-8000-000000000101')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Dining-table activation fixture (spec 004 FR-011/FR-023; research.md §11;
-- data-model.md seed table). Values copied verbatim from
-- tests/database/helpers/fixtures.ts (`seedDiningTableActivation`): Marina
-- `T1` is inactive, every other seeded table is active — the persisted
-- `active | inactive` state that has no delete path.
--
-- `on conflict (id) do update set is_active` converges the activation state on
-- re-run: a table deactivated (or reactivated) through the app returns to the
-- fixture without a reset (spec 004 SC-007 posture).
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.dining_tables (id, restaurant_id, branch_id, label, is_active) values
  ('00000000-0000-4000-8000-000000003001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T1', true),
  ('00000000-0000-4000-8000-000000003002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T2', true),
  ('00000000-0000-4000-8000-000000003003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'T3', true),
  ('00000000-0000-4000-8000-000000003004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'T1', false),
  ('00000000-0000-4000-8000-000000003005', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201', 'T1', true)
on conflict (id) do update set is_active = excluded.is_active;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 branch working-hours fixture (spec 004 FR-008/FR-009, FR-023;
-- research.md §15; data-model.md seed table). Values copied verbatim from
-- tests/database/helpers/fixtures.ts (`seedBranchWorkingHours`).
--
-- One row per open interval, stored under the weekday it starts on — the
-- `branch_working_hours_no_overlap` exclusion constraint rejects anything
-- else (a shared boundary is legal; 18:00–02:00 carries the +1440
-- normalization in the generated `end_minute`). The fixture exercises every
-- interesting shape: a split day (Downtown Mon–Fri lunch + dinner), a
-- post-midnight interval (18:00–02:00), a closed day (Downtown Sunday — no
-- rows), and the boundary-touching pair (Marina Wednesday 12:00–18:00 +
-- 18:00–23:00 — accepted, not an overlap).
--
-- `on conflict (id) do update` converges the schedule columns on re-run: a
-- database whose hours were edited through the app returns to the fixture
-- without a reset (spec 004 SC-007 posture).
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.branch_working_hours
  (id, restaurant_id, branch_id, weekday, open_time, close_time)
values
  ('00000000-0000-4000-8000-000000005001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'monday', '11:00', '15:00'),
  ('00000000-0000-4000-8000-000000005002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'tuesday', '11:00', '15:00'),
  ('00000000-0000-4000-8000-000000005003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'wednesday', '11:00', '15:00'),
  ('00000000-0000-4000-8000-000000005004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'thursday', '11:00', '15:00'),
  ('00000000-0000-4000-8000-000000005005', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'friday', '11:00', '15:00'),
  ('00000000-0000-4000-8000-000000005006', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'monday', '18:00', '02:00'),
  ('00000000-0000-4000-8000-000000005007', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'tuesday', '18:00', '02:00'),
  ('00000000-0000-4000-8000-000000005008', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'wednesday', '18:00', '02:00'),
  ('00000000-0000-4000-8000-000000005009', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'thursday', '18:00', '02:00'),
  ('00000000-0000-4000-8000-000000005010', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'friday', '18:00', '02:00'),
  ('00000000-0000-4000-8000-000000005011', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'saturday', '12:00', '02:00'),
  ('00000000-0000-4000-8000-000000005012', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'wednesday', '12:00', '18:00'),
  ('00000000-0000-4000-8000-000000005013', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'wednesday', '18:00', '23:00'),
  ('00000000-0000-4000-8000-000000005014', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'thursday', '12:00', '23:00'),
  ('00000000-0000-4000-8000-000000005015', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'friday', '12:00', '23:00'),
  ('00000000-0000-4000-8000-000000005016', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'saturday', '12:00', '23:00'),
  ('00000000-0000-4000-8000-000000005017', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'sunday', '12:00', '23:00'),
  ('00000000-0000-4000-8000-000000005018', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201', 'monday', '06:00', '22:00'),
  ('00000000-0000-4000-8000-000000005019', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201', 'tuesday', '06:00', '22:00'),
  ('00000000-0000-4000-8000-000000005020', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201', 'wednesday', '06:00', '22:00'),
  ('00000000-0000-4000-8000-000000005021', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201', 'thursday', '06:00', '22:00'),
  ('00000000-0000-4000-8000-000000005022', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201', 'friday', '06:00', '22:00'),
  ('00000000-0000-4000-8000-000000005023', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201', 'saturday', '06:00', '22:00'),
  ('00000000-0000-4000-8000-000000005024', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201', 'sunday', '06:00', '22:00')
on conflict (id) do update set
  weekday = excluded.weekday,
  open_time = excluded.open_time,
  close_time = excluded.close_time;
