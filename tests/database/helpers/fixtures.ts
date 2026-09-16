/**
 * Deterministic seed fixture constants (spec 002 FR-015, spec 003 FR-021,
 * spec 004 FR-023; data-model.md seed table).
 *
 * These values MUST stay identical to `supabase/seed.sql`: the suites assert
 * the seeded database through these ids (and, for Phase 2, the sign-in
 * credentials), so any drift between the two files fails the tests.
 *
 * Fixture shape: Blue Olive (`blue-olive`) owns branches Downtown and Marina;
 * Cedar Grill (`cedar-grill`) owns branch Airport. Eve holds memberships in
 * BOTH restaurants (owner of Cedar Grill, cashier at Downtown) — the
 * multi-membership case. Platform Admin carries the super-admin flag with no
 * memberships — the modeled-only case.
 *
 * Phase 3 additions (spec 004, data-model.md seed table): the restaurant
 * profile/settings values (`seedRestaurantSettings`), the weekly working-hours
 * fixture (`seedBranchWorkingHours` — split days, a post-midnight interval,
 * and the boundary-touching pair), the table-activation expectations
 * (`seedDiningTableActivation` — Marina `T1` inactive), and a seventh seeded
 * person, **Fiona** (`fiona@restopilot.dev`) — a linked profile with NO
 * memberships, the creation-bootstrap fixture (spec 004 FR-001/FR-023).
 */

export type StaffRole = 'owner' | 'branch_manager' | 'cashier' | 'kitchen'

export const restaurantIds = {
  blueOlive: '00000000-0000-4000-8000-000000000001',
  cedarGrill: '00000000-0000-4000-8000-000000000002',
} as const

export const branchIds = {
  downtown: '00000000-0000-4000-8000-000000000101',
  marina: '00000000-0000-4000-8000-000000000102',
  airport: '00000000-0000-4000-8000-000000000201',
} as const

export const profileIds = {
  alice: '00000000-0000-4000-8000-000000001001',
  bob: '00000000-0000-4000-8000-000000001002',
  carla: '00000000-0000-4000-8000-000000001003',
  dan: '00000000-0000-4000-8000-000000001004',
  eve: '00000000-0000-4000-8000-000000001005',
  platformAdmin: '00000000-0000-4000-8000-000000001006',
  fiona: '00000000-0000-4000-8000-000000001007',
} as const

/**
 * Auth identity ids — the deterministic UUIDs `supabase/seed.sql` provisions
 * in `auth.users` (spec 003 FR-021); each profile links to one via
 * `profiles.auth_user_id`.
 */
export const authUserIds = {
  alice: '00000000-0000-4000-8000-000000002001',
  bob: '00000000-0000-4000-8000-000000002002',
  carla: '00000000-0000-4000-8000-000000002003',
  dan: '00000000-0000-4000-8000-000000002004',
  eve: '00000000-0000-4000-8000-000000002005',
  platformAdmin: '00000000-0000-4000-8000-000000002006',
  fiona: '00000000-0000-4000-8000-000000002007',
} as const

/**
 * Seeded sign-in credentials for the seven seeded identities (spec 003 FR-021,
 * spec 004 FR-023, SC-007; data-model.md seed table) — the single credential
 * source shared by the seed (`supabase/seed.sql` mirrors these values verbatim)
 * and every Phase 2/3 test suite.
 *
 * Keyed like `authUserIds`: `auth_user_id` is the id of the real auth user
 * the seed provisions (contracts/supabase-auth-surface.md), so a signed-in
 * session's `sub` equals it. Development-only passwords; a manually changed
 * password is restored by `npm run db:reset -- --purge-auth`.
 */
export const seedCredentials = {
  alice: {
    auth_user_id: authUserIds.alice,
    email: 'alice@restopilot.dev',
    password: 'dev-alice-2026',
  },
  bob: {
    auth_user_id: authUserIds.bob,
    email: 'bob@restopilot.dev',
    password: 'dev-bob-2026',
  },
  carla: {
    auth_user_id: authUserIds.carla,
    email: 'carla@restopilot.dev',
    password: 'dev-carla-2026',
  },
  dan: {
    auth_user_id: authUserIds.dan,
    email: 'dan@restopilot.dev',
    password: 'dev-dan-2026',
  },
  eve: {
    auth_user_id: authUserIds.eve,
    email: 'eve@restopilot.dev',
    password: 'dev-eve-2026',
  },
  platformAdmin: {
    auth_user_id: authUserIds.platformAdmin,
    email: 'platform-admin@restopilot.dev',
    password: 'dev-platform-admin-2026',
  },
  fiona: {
    auth_user_id: authUserIds.fiona,
    email: 'fiona@restopilot.dev',
    password: 'dev-fiona-2026',
  },
} as const

export const diningTableIds = {
  downtownT1: '00000000-0000-4000-8000-000000003001',
  downtownT2: '00000000-0000-4000-8000-000000003002',
  downtownT3: '00000000-0000-4000-8000-000000003003',
  marinaT1: '00000000-0000-4000-8000-000000003004',
  airportT1: '00000000-0000-4000-8000-000000003005',
} as const

export const membershipIds = {
  aliceOwnerBlueOlive: '00000000-0000-4000-8000-000000004001',
  bobManagerDowntown: '00000000-0000-4000-8000-000000004002',
  carlaCashierDowntown: '00000000-0000-4000-8000-000000004003',
  danKitchenMarina: '00000000-0000-4000-8000-000000004004',
  eveOwnerCedarGrill: '00000000-0000-4000-8000-000000004005',
  eveCashierDowntown: '00000000-0000-4000-8000-000000004006',
} as const

export const seedRestaurants = [
  { id: restaurantIds.blueOlive, name: 'Blue Olive', slug: 'blue-olive' },
  { id: restaurantIds.cedarGrill, name: 'Cedar Grill', slug: 'cedar-grill' },
] as const

export const seedBranches = [
  { id: branchIds.downtown, restaurant_id: restaurantIds.blueOlive, name: 'Downtown' },
  { id: branchIds.marina, restaurant_id: restaurantIds.blueOlive, name: 'Marina' },
  { id: branchIds.airport, restaurant_id: restaurantIds.cedarGrill, name: 'Airport' },
] as const

export const seedProfiles = [
  {
    id: profileIds.alice,
    display_name: 'Alice',
    auth_user_id: authUserIds.alice,
    is_super_admin: false,
  },
  { id: profileIds.bob, display_name: 'Bob', auth_user_id: authUserIds.bob, is_super_admin: false },
  {
    id: profileIds.carla,
    display_name: 'Carla',
    auth_user_id: authUserIds.carla,
    is_super_admin: false,
  },
  { id: profileIds.dan, display_name: 'Dan', auth_user_id: authUserIds.dan, is_super_admin: false },
  { id: profileIds.eve, display_name: 'Eve', auth_user_id: authUserIds.eve, is_super_admin: false },
  {
    id: profileIds.platformAdmin,
    display_name: 'Platform Admin',
    auth_user_id: authUserIds.platformAdmin,
    is_super_admin: true,
  },
  // Phase 3 creation-bootstrap fixture: a linked profile with NO membership
  // row (spec 004 FR-001/FR-023) — distinct from the modeled-only super admin.
  {
    id: profileIds.fiona,
    display_name: 'Fiona',
    auth_user_id: authUserIds.fiona,
    is_super_admin: false,
  },
] as const

export interface SeedMembership {
  id: string
  profile_id: string
  restaurant_id: string
  role: StaffRole
  branch_id: string | null
}

export const seedMemberships: readonly SeedMembership[] = [
  {
    id: membershipIds.aliceOwnerBlueOlive,
    profile_id: profileIds.alice,
    restaurant_id: restaurantIds.blueOlive,
    role: 'owner',
    branch_id: null,
  },
  {
    id: membershipIds.bobManagerDowntown,
    profile_id: profileIds.bob,
    restaurant_id: restaurantIds.blueOlive,
    role: 'branch_manager',
    branch_id: branchIds.downtown,
  },
  {
    id: membershipIds.carlaCashierDowntown,
    profile_id: profileIds.carla,
    restaurant_id: restaurantIds.blueOlive,
    role: 'cashier',
    branch_id: branchIds.downtown,
  },
  {
    id: membershipIds.danKitchenMarina,
    profile_id: profileIds.dan,
    restaurant_id: restaurantIds.blueOlive,
    role: 'kitchen',
    branch_id: branchIds.marina,
  },
  {
    id: membershipIds.eveOwnerCedarGrill,
    profile_id: profileIds.eve,
    restaurant_id: restaurantIds.cedarGrill,
    role: 'owner',
    branch_id: null,
  },
  {
    id: membershipIds.eveCashierDowntown,
    profile_id: profileIds.eve,
    restaurant_id: restaurantIds.blueOlive,
    role: 'cashier',
    branch_id: branchIds.downtown,
  },
]

export const seedDiningTables = [
  {
    id: diningTableIds.downtownT1,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    label: 'T1',
  },
  {
    id: diningTableIds.downtownT2,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    label: 'T2',
  },
  {
    id: diningTableIds.downtownT3,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    label: 'T3',
  },
  {
    id: diningTableIds.marinaT1,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.marina,
    label: 'T1',
  },
  {
    id: diningTableIds.airportT1,
    restaurant_id: restaurantIds.cedarGrill,
    branch_id: branchIds.airport,
    label: 'T1',
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 fixtures (spec 004 FR-023, SC-007; data-model.md seed table). The
// seed mirrors these values verbatim (T010/T021/T030); the Phase 3 suites
// assert against them.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The Phase 3 restaurant profile/settings columns (spec 004 FR-002/FR-003;
 * data-model.md): brand description, contact information, and the
 * restaurant's authoritative timezone. `name`/`slug` keep the
 * `seedRestaurants` shape above.
 */
export const seedRestaurantSettings = [
  {
    id: restaurantIds.blueOlive,
    brand_description: 'Wood-fired Mediterranean plates in a former harbour warehouse.',
    contact_email: 'hello@blue-olive.example',
    contact_phone: '+351 21 555 0100',
    timezone: 'Europe/Lisbon',
  },
  {
    id: restaurantIds.cedarGrill,
    brand_description: 'Charcoal grill house serving late into the night.',
    contact_email: 'hello@cedar-grill.example',
    contact_phone: '+34 91 555 0200',
    timezone: 'Europe/Madrid',
  },
] as const

/** The seven ISO weekdays in declaration (= display and `order by`) order — mirrors the `public.weekday` enum. */
export type Weekday =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface SeedBranchWorkingHours {
  id: string
  restaurant_id: string
  branch_id: string
  weekday: Weekday
  open_time: string
  close_time: string
}

/**
 * The branch weekly working-hours fixture (spec 004 FR-008/FR-009, FR-023;
 * data-model.md seed table), ordered by id. Exercises every interesting
 * shape: a split day (Downtown Mon–Fri lunch + dinner), a post-midnight
 * interval (18:00–02:00, stored under its start day with
 * `end_minute >= 1440`), a closed day (Downtown Sunday — no rows), and the
 * boundary-touching pair (Marina Wednesday 12:00–18:00 + 18:00–23:00 —
 * accepted, not an overlap). `time` values are the `HH:MM:SS` strings the
 * database returns.
 */
export const seedBranchWorkingHours: readonly SeedBranchWorkingHours[] = [
  // Downtown — Mon–Fri lunch 11:00–15:00 (split day, first half).
  {
    id: '00000000-0000-4000-8000-000000005001',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    weekday: 'monday',
    open_time: '11:00:00',
    close_time: '15:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005002',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    weekday: 'tuesday',
    open_time: '11:00:00',
    close_time: '15:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005003',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    weekday: 'wednesday',
    open_time: '11:00:00',
    close_time: '15:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005004',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    weekday: 'thursday',
    open_time: '11:00:00',
    close_time: '15:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005005',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    weekday: 'friday',
    open_time: '11:00:00',
    close_time: '15:00:00',
  },
  // Downtown — Mon–Fri dinner 18:00–02:00 (split day, second half; the
  // post-midnight interval — close_time < open_time, end_minute +1440).
  {
    id: '00000000-0000-4000-8000-000000005006',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    weekday: 'monday',
    open_time: '18:00:00',
    close_time: '02:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005007',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    weekday: 'tuesday',
    open_time: '18:00:00',
    close_time: '02:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005008',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    weekday: 'wednesday',
    open_time: '18:00:00',
    close_time: '02:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005009',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    weekday: 'thursday',
    open_time: '18:00:00',
    close_time: '02:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005010',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    weekday: 'friday',
    open_time: '18:00:00',
    close_time: '02:00:00',
  },
  // Downtown — Saturday 12:00–02:00; Sunday closed (no rows).
  {
    id: '00000000-0000-4000-8000-000000005011',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    weekday: 'saturday',
    open_time: '12:00:00',
    close_time: '02:00:00',
  },
  // Marina — Wednesday 12:00–18:00 + 18:00–23:00 (the boundary-touching
  // pair — accepted: [720, 1080) and [1080, 1380) share their boundary).
  {
    id: '00000000-0000-4000-8000-000000005012',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.marina,
    weekday: 'wednesday',
    open_time: '12:00:00',
    close_time: '18:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005013',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.marina,
    weekday: 'wednesday',
    open_time: '18:00:00',
    close_time: '23:00:00',
  },
  // Marina — Thursday through Sunday 12:00–23:00.
  {
    id: '00000000-0000-4000-8000-000000005014',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.marina,
    weekday: 'thursday',
    open_time: '12:00:00',
    close_time: '23:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005015',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.marina,
    weekday: 'friday',
    open_time: '12:00:00',
    close_time: '23:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005016',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.marina,
    weekday: 'saturday',
    open_time: '12:00:00',
    close_time: '23:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005017',
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.marina,
    weekday: 'sunday',
    open_time: '12:00:00',
    close_time: '23:00:00',
  },
  // Airport — daily 06:00–22:00.
  {
    id: '00000000-0000-4000-8000-000000005018',
    restaurant_id: restaurantIds.cedarGrill,
    branch_id: branchIds.airport,
    weekday: 'monday',
    open_time: '06:00:00',
    close_time: '22:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005019',
    restaurant_id: restaurantIds.cedarGrill,
    branch_id: branchIds.airport,
    weekday: 'tuesday',
    open_time: '06:00:00',
    close_time: '22:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005020',
    restaurant_id: restaurantIds.cedarGrill,
    branch_id: branchIds.airport,
    weekday: 'wednesday',
    open_time: '06:00:00',
    close_time: '22:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005021',
    restaurant_id: restaurantIds.cedarGrill,
    branch_id: branchIds.airport,
    weekday: 'thursday',
    open_time: '06:00:00',
    close_time: '22:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005022',
    restaurant_id: restaurantIds.cedarGrill,
    branch_id: branchIds.airport,
    weekday: 'friday',
    open_time: '06:00:00',
    close_time: '22:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005023',
    restaurant_id: restaurantIds.cedarGrill,
    branch_id: branchIds.airport,
    weekday: 'saturday',
    open_time: '06:00:00',
    close_time: '22:00:00',
  },
  {
    id: '00000000-0000-4000-8000-000000005024',
    restaurant_id: restaurantIds.cedarGrill,
    branch_id: branchIds.airport,
    weekday: 'sunday',
    open_time: '06:00:00',
    close_time: '22:00:00',
  },
]

/**
 * The seeded activation state of every dining table (spec 004 FR-011/FR-012,
 * SC-007; data-model.md seed table), ordered by id: Marina `T1` is the
 * deliberate inactive fixture (inactive tables stay visible with their
 * state); every other seeded table is active.
 */
export const seedDiningTableActivation = [
  { id: diningTableIds.downtownT1, is_active: true },
  { id: diningTableIds.downtownT2, is_active: true },
  { id: diningTableIds.downtownT3, is_active: true },
  { id: diningTableIds.marinaT1, is_active: false },
  { id: diningTableIds.airportT1, is_active: true },
] as const
