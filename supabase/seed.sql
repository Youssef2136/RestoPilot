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

-- Phase 13 (spec 014): exactly one subscription row per restaurant —
-- never_activated until the platform sets dates. The 014 migration seeds
-- these for in-place upgrades (where restaurants already exist); the seed
-- guarantees them on FRESH builds, where migrations run before any
-- restaurant row exists. Every restaurant, always: get_platform_overview
-- inner-joins subscriptions, so a missing row makes a tenant invisible.
insert into public.subscriptions (restaurant_id)
select r.id from public.restaurants r
on conflict (restaurant_id) do nothing;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 menu fixture (spec 005 FR-028, SC-007; data-model.md seed table;
-- research.md §13). Deterministic UUIDs — MUST stay identical to
-- tests/database/helpers/fixtures.ts.
--
-- Blue Olive carries the shared demo menu (categories, items with descriptions
-- and two-decimal prices, extras on two items) and the two availability
-- states the phase turns on:
--   * Grilled Sea Bass is stopped RESTAURANT-WIDE (`is_available = false`) and
--     ALSO carries a Marina override row — the clarified hard stop wins over
--     an existing override (spec Edge Cases, FR-012/FR-013);
--   * Chicken Tagine is available restaurant-wide but unavailable at Marina
--     only — the everyday branch override (FR-013).
-- Cedar Grill carries its own small menu, proving cross-tenant isolation of
-- categories, items, and extras.
--
-- No item image is seeded: the seed writes to the database only, and a
-- reference without an uploaded object would violate FR-021 (research.md §16).
-- The image journey is proven by the integration round trip and the quickstart
-- upload.
--
-- `on conflict (id) do update` converges the menu content on re-run (spec 004
-- SC-007 posture), so a fixture edited through the app returns to the seeded
-- state without a reset.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.menu_categories (id, restaurant_id, name, description, sort_order) values
  ('00000000-0000-4000-8000-000000006001', '00000000-0000-4000-8000-000000000001', 'Starters', 'Small plates to begin with.', 1),
  ('00000000-0000-4000-8000-000000006002', '00000000-0000-4000-8000-000000000001', 'Mains', 'Grilled and slow-cooked plates.', 2),
  ('00000000-0000-4000-8000-000000006003', '00000000-0000-4000-8000-000000000001', 'Desserts', 'Sweet finishes.', 3),
  ('00000000-0000-4000-8000-000000006004', '00000000-0000-4000-8000-000000000001', 'Drinks', 'Cold and hot drinks.', 4),
  ('00000000-0000-4000-8000-000000006101', '00000000-0000-4000-8000-000000000002', 'Grill', 'From the charcoal grill.', 1)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.menu_items
  (id, restaurant_id, category_id, name, description, price, is_available, sort_order)
values
  ('00000000-0000-4000-8000-000000006011', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006001', 'Hummus', 'Chickpea purée with tahini, olive oil, and warm pita.', 6.50, true, 1),
  ('00000000-0000-4000-8000-000000006012', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006001', 'Grilled Halloumi', 'Charred halloumi with lemon and mint.', 8.00, true, 2),
  ('00000000-0000-4000-8000-000000006013', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006001', 'Soup of the Day', 'Ask the team about today''s pot.', 5.50, true, 3),
  ('00000000-0000-4000-8000-000000006014', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006002', 'Lamb Kebab', 'Charcoal-grilled lamb skewers with rice and grilled vegetables.', 18.50, true, 1),
  ('00000000-0000-4000-8000-000000006015', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006002', 'Grilled Sea Bass', 'Whole sea bass with olive oil, lemon, and seasonal greens.', 24.00, false, 2),
  ('00000000-0000-4000-8000-000000006016', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006002', 'Chicken Tagine', 'Slow-cooked chicken with preserved lemon and olives.', 16.00, true, 3),
  ('00000000-0000-4000-8000-000000006017', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006003', 'Chocolate Fondant', 'Warm chocolate cake with a molten centre.', 7.50, true, 1),
  ('00000000-0000-4000-8000-000000006018', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006003', 'Baklava', 'Pistachio baklava with honey syrup.', 6.00, true, 2),
  ('00000000-0000-4000-8000-000000006019', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006003', 'Seasonal Fruit Plate', 'Fresh fruit, sliced to order.', 5.00, true, 3),
  ('00000000-0000-4000-8000-000000006020', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006004', 'Mint Lemonade', 'Fresh lemonade with crushed mint.', 4.50, true, 1),
  ('00000000-0000-4000-8000-000000006021', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006004', 'Still Water', '750 ml bottle.', 2.50, true, 2),
  ('00000000-0000-4000-8000-000000006022', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006004', 'Turkish Coffee', 'Traditional preparation, served with a sweet.', 3.50, true, 3),
  ('00000000-0000-4000-8000-000000006111', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000006101', 'Cedar Mixed Grill', 'Lamb, chicken, and kofta over charcoal.', 22.00, true, 1),
  ('00000000-0000-4000-8000-000000006112', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000006101', 'Flatbread', 'Baked to order, brushed with butter.', 4.00, true, 2)
on conflict (id) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  is_available = excluded.is_available,
  sort_order = excluded.sort_order;

insert into public.menu_item_extras
  (id, restaurant_id, item_id, name, price_adjustment, sort_order)
values
  ('00000000-0000-4000-8000-000000006031', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006014', 'Extra garlic sauce', 0.00, 1),
  ('00000000-0000-4000-8000-000000006032', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006014', 'Extra rice', 3.00, 2),
  ('00000000-0000-4000-8000-000000006033', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006014', 'Extra chili', 0.50, 3),
  ('00000000-0000-4000-8000-000000006034', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006017', 'Vanilla ice cream', 3.50, 1),
  ('00000000-0000-4000-8000-000000006035', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000006017', 'Extra chocolate sauce', 2.00, 2),
  ('00000000-0000-4000-8000-000000006121', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000006111', 'Extra flatbread', 2.00, 1)
on conflict (id) do update set
  name = excluded.name,
  price_adjustment = excluded.price_adjustment,
  sort_order = excluded.sort_order;

-- Marina's two override rows: the everyday one (Chicken Tagine — available
-- everywhere except Marina) and the one that proves the hard stop (Grilled Sea
-- Bass is stopped restaurant-wide, so its override row has no effect).
insert into public.branch_unavailable_items (id, restaurant_id, branch_id, item_id) values
  ('00000000-0000-4000-8000-000000006041', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000006015'),
  ('00000000-0000-4000-8000-000000006042', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000006016')
on conflict on constraint branch_unavailable_items_branch_item_key do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 5 tax fixture (spec 006 FR-023, SC-007; data-model.md seed fixture
-- section). Deterministic UUIDs — MUST stay identical to
-- tests/database/helpers/fixtures.ts.
--
-- Blue Olive carries the demo tax configuration the phase's journeys need:
--   * VAT (total scope, 8.25%, order 1) — the restaurant default that Marina
--     overrides at 8.75%;
--   * City tax (total scope, 1.5%, order 2) compounding on VAT — the compound
--     pair the matrix and walkthrough B hand-calculate against;
--   * Alcohol duty (categories scope → Drinks, 10%, order 3);
--   * Imported sweets tax (items scope → Baklava, 5%, order 4);
--   * Downtown surcharge (total scope, 2%, order 5) — a BRANCH-ONLY rule at
--     Downtown, proving the branch-only arm of the effective configuration.
-- Cedar Grill carries one unoverridden total rule (IGIC, 7%), proving
-- cross-tenant isolation of tax configuration.
-- No snapshot rows are seeded: nothing records snapshots in this phase
-- (clarification 3), and an empty snapshot table is the honest baseline.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.tax_rules
  (id, restaurant_id, branch_id, name, rate, scope, sort_order, is_active)
values
  ('00000000-0000-4000-8000-000000007001', '00000000-0000-4000-8000-000000000001', null, 'VAT', 8.2500, 'total', 1, true),
  ('00000000-0000-4000-8000-000000007002', '00000000-0000-4000-8000-000000000001', null, 'City tax', 1.5000, 'total', 2, true),
  ('00000000-0000-4000-8000-000000007003', '00000000-0000-4000-8000-000000000001', null, 'Alcohol duty', 10.0000, 'categories', 3, true),
  ('00000000-0000-4000-8000-000000007004', '00000000-0000-4000-8000-000000000001', null, 'Imported sweets tax', 5.0000, 'items', 4, true),
  ('00000000-0000-4000-8000-000000007005', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Downtown surcharge', 2.0000, 'total', 5, true),
  ('00000000-0000-4000-8000-000000007101', '00000000-0000-4000-8000-000000000002', null, 'IGIC', 7.0000, 'total', 1, true)
on conflict (id) do update set
  branch_id = excluded.branch_id,
  name = excluded.name,
  rate = excluded.rate,
  scope = excluded.scope,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.tax_rule_items (id, restaurant_id, rule_id, item_id) values
  ('00000000-0000-4000-8000-000000007012', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000007004', '00000000-0000-4000-8000-000000006018')
on conflict (id) do nothing;

insert into public.tax_rule_categories (id, restaurant_id, rule_id, category_id) values
  ('00000000-0000-4000-8000-000000007011', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000007003', '00000000-0000-4000-8000-000000006004')
on conflict (id) do nothing;

insert into public.tax_rule_compounds (id, restaurant_id, rule_id, source_rule_id) values
  ('00000000-0000-4000-8000-000000007021', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000007002', '00000000-0000-4000-8000-000000007001')
on conflict (id) do nothing;

insert into public.branch_tax_overrides (branch_id, rule_id, restaurant_id, rate) values
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000007001', '00000000-0000-4000-8000-000000000001', 8.7500)
on conflict (branch_id, rule_id) do update set rate = excluded.rate;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6 — sessions (spec 007): two open dine-in demo sessions at Downtown
-- T1/T2 with participants and the dev tokens' SHA-256 hashes computed in SQL
-- (research §7). Deterministic ids per tests/database/helpers/fixtures.ts.
-- Idempotent: on conflict updates the mutable fields, preserves the rest.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.sessions
  (id, restaurant_id, branch_id, table_id, type, status, opened_at)
values
  ('00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000003001',
   'dine-in', 'open', '2026-09-19T12:00:00Z'),
  ('00000000-0000-4000-8000-000000008002', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000003002',
   'dine-in', 'open', '2026-09-19T12:10:00Z')
on conflict (id) do update set
  restaurant_id = excluded.restaurant_id,
  branch_id = excluded.branch_id,
  table_id = excluded.table_id,
  type = excluded.type,
  status = excluded.status,
  -- reopening clears any closure residue (e2e closes demo sessions)
  closed_at = null,
  closed_by_profile_id = null,
  opened_at = excluded.opened_at;

insert into public.session_participants
  (id, session_id, restaurant_id, display_name, phone, joined_at)
values
  ('00000000-0000-4000-8000-000000008011', '00000000-0000-4000-8000-000000008001',
   '00000000-0000-4000-8000-000000000001', 'Sara', '+15550101', '2026-09-19T12:01:00Z'),
  ('00000000-0000-4000-8000-000000008012', '00000000-0000-4000-8000-000000008001',
   '00000000-0000-4000-8000-000000000001', 'Omar', '05550102', '2026-09-19T12:03:00Z'),
  ('00000000-0000-4000-8000-000000008013', '00000000-0000-4000-8000-000000008002',
   '00000000-0000-4000-8000-000000000001', 'Lina', '+15550103', '2026-09-19T12:11:00Z')
on conflict (id) do update set
  display_name = excluded.display_name,
  phone = excluded.phone,
  joined_at = excluded.joined_at;

insert into public.session_tokens
  (id, session_id, restaurant_id, token_hash)
values
  ('00000000-0000-4000-8000-000000008021', '00000000-0000-4000-8000-000000008001',
   '00000000-0000-4000-8000-000000000001',
   encode(extensions.digest('dev-token-downtown-t1-2026', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000008022', '00000000-0000-4000-8000-000000008002',
   '00000000-0000-4000-8000-000000000001',
   encode(extensions.digest('dev-token-downtown-t2-2026', 'sha256'), 'hex'))
on conflict (id) do update set
  token_hash = excluded.token_hash;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9 — channel sessions (spec 010): one delivery + one takeaway demo
-- session at Downtown with dev tokens; no rounds — histories start empty.
-- The address ("12 Marina Walk") lives once on the delivery session.
-- Deterministic ids per tests/database/helpers/fixtures.ts. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.sessions
  (id, restaurant_id, branch_id, table_id, type, status, delivery_address, opened_at)
values
  ('00000000-0000-4000-8000-000000008003', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000101', null,
   'delivery', 'open', '12 Marina Walk', '2026-09-20T12:00:00Z'),
  ('00000000-0000-4000-8000-000000008004', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000101', null,
   'takeaway', 'open', null, '2026-09-20T12:10:00Z')
on conflict (id) do update set
  restaurant_id = excluded.restaurant_id,
  branch_id = excluded.branch_id,
  table_id = excluded.table_id,
  type = excluded.type,
  status = excluded.status,
  -- reopening clears any closure residue (e2e closes demo sessions)
  closed_at = null,
  closed_by_profile_id = null,
  delivery_address = excluded.delivery_address,
  opened_at = excluded.opened_at;

insert into public.session_participants
  (id, session_id, restaurant_id, display_name, phone, joined_at)
values
  ('00000000-0000-4000-8000-000000008014', '00000000-0000-4000-8000-000000008003',
   '00000000-0000-4000-8000-000000000001', 'Nour', '+15550104', '2026-09-20T12:01:00Z'),
  ('00000000-0000-4000-8000-000000008015', '00000000-0000-4000-8000-000000008004',
   '00000000-0000-4000-8000-000000000001', 'Zaid', '+15550105', '2026-09-20T12:11:00Z')
on conflict (id) do update set
  display_name = excluded.display_name,
  phone = excluded.phone,
  joined_at = excluded.joined_at;

insert into public.session_tokens
  (id, session_id, restaurant_id, token_hash)
values
  ('00000000-0000-4000-8000-000000008023', '00000000-0000-4000-8000-000000008003',
   '00000000-0000-4000-8000-000000000001',
   encode(extensions.digest('dev-token-downtown-delivery-2026', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000008024', '00000000-0000-4000-8000-000000008004',
   '00000000-0000-4000-8000-000000000001',
   encode(extensions.digest('dev-token-downtown-takeaway-2026', 'sha256'), 'hex'))
on conflict (id) do update set
  token_hash = excluded.token_hash;
