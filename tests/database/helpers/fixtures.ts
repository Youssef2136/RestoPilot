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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 menu fixture (spec 005 FR-028, SC-007; data-model.md seed table;
// research.md §13). Mirrors `supabase/seed.sql` exactly — the seed and these
// constants are two views of one fixture.
// ─────────────────────────────────────────────────────────────────────────────

export const menuCategoryIds = {
  blueOliveStarters: '00000000-0000-4000-8000-000000006001',
  blueOliveMains: '00000000-0000-4000-8000-000000006002',
  blueOliveDesserts: '00000000-0000-4000-8000-000000006003',
  blueOliveDrinks: '00000000-0000-4000-8000-000000006004',
  cedarGrillGrill: '00000000-0000-4000-8000-000000006101',
} as const

export const menuItemIds = {
  hummus: '00000000-0000-4000-8000-000000006011',
  grilledHalloumi: '00000000-0000-4000-8000-000000006012',
  soupOfTheDay: '00000000-0000-4000-8000-000000006013',
  lambKebab: '00000000-0000-4000-8000-000000006014',
  /** Stopped restaurant-wide — its Marina override row has no effect. */
  grilledSeaBass: '00000000-0000-4000-8000-000000006015',
  /** Available restaurant-wide, unavailable at Marina only. */
  chickenTagine: '00000000-0000-4000-8000-000000006016',
  chocolateFondant: '00000000-0000-4000-8000-000000006017',
  baklava: '00000000-0000-4000-8000-000000006018',
  seasonalFruitPlate: '00000000-0000-4000-8000-000000006019',
  mintLemonade: '00000000-0000-4000-8000-000000006020',
  stillWater: '00000000-0000-4000-8000-000000006021',
  turkishCoffee: '00000000-0000-4000-8000-000000006022',
  cedarMixedGrill: '00000000-0000-4000-8000-000000006111',
  flatbread: '00000000-0000-4000-8000-000000006112',
} as const

export const menuExtraIds = {
  lambExtraGarlicSauce: '00000000-0000-4000-8000-000000006031',
  lambExtraRice: '00000000-0000-4000-8000-000000006032',
  lambExtraChili: '00000000-0000-4000-8000-000000006033',
  fondantVanillaIceCream: '00000000-0000-4000-8000-000000006034',
  fondantExtraChocolateSauce: '00000000-0000-4000-8000-000000006035',
  cedarExtraFlatbread: '00000000-0000-4000-8000-000000006121',
} as const

export const branchUnavailableItemIds = {
  /** Marina × the restaurant-wide stop (proves the hard stop beats an override). */
  marinaGrilledSeaBass: '00000000-0000-4000-8000-000000006041',
  /** Marina × the everyday override (available everywhere else). */
  marinaChickenTagine: '00000000-0000-4000-8000-000000006042',
} as const

/** The item stopped restaurant-wide (`is_available = false`). */
export const stoppedMenuItemId = menuItemIds.grilledSeaBass

/** The item available restaurant-wide but overridden unavailable at Marina. */
export const marinaOnlyUnavailableItemId = menuItemIds.chickenTagine

export const seedMenuCategories = [
  {
    id: menuCategoryIds.blueOliveStarters,
    restaurant_id: restaurantIds.blueOlive,
    name: 'Starters',
    description: 'Small plates to begin with.',
    sort_order: 1,
  },
  {
    id: menuCategoryIds.blueOliveMains,
    restaurant_id: restaurantIds.blueOlive,
    name: 'Mains',
    description: 'Grilled and slow-cooked plates.',
    sort_order: 2,
  },
  {
    id: menuCategoryIds.blueOliveDesserts,
    restaurant_id: restaurantIds.blueOlive,
    name: 'Desserts',
    description: 'Sweet finishes.',
    sort_order: 3,
  },
  {
    id: menuCategoryIds.blueOliveDrinks,
    restaurant_id: restaurantIds.blueOlive,
    name: 'Drinks',
    description: 'Cold and hot drinks.',
    sort_order: 4,
  },
  {
    id: menuCategoryIds.cedarGrillGrill,
    restaurant_id: restaurantIds.cedarGrill,
    name: 'Grill',
    description: 'From the charcoal grill.',
    sort_order: 1,
  },
] as const

export const seedMenuItems = [
  {
    id: menuItemIds.hummus,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveStarters,
    name: 'Hummus',
    description: 'Chickpea purée with tahini, olive oil, and warm pita.',
    price: '6.50',
    is_available: true,
    sort_order: 1,
  },
  {
    id: menuItemIds.grilledHalloumi,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveStarters,
    name: 'Grilled Halloumi',
    description: 'Charred halloumi with lemon and mint.',
    price: '8.00',
    is_available: true,
    sort_order: 2,
  },
  {
    id: menuItemIds.soupOfTheDay,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveStarters,
    name: 'Soup of the Day',
    description: "Ask the team about today's pot.",
    price: '5.50',
    is_available: true,
    sort_order: 3,
  },
  {
    id: menuItemIds.lambKebab,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveMains,
    name: 'Lamb Kebab',
    description: 'Charcoal-grilled lamb skewers with rice and grilled vegetables.',
    price: '18.50',
    is_available: true,
    sort_order: 1,
  },
  {
    id: menuItemIds.grilledSeaBass,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveMains,
    name: 'Grilled Sea Bass',
    description: 'Whole sea bass with olive oil, lemon, and seasonal greens.',
    price: '24.00',
    is_available: false,
    sort_order: 2,
  },
  {
    id: menuItemIds.chickenTagine,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveMains,
    name: 'Chicken Tagine',
    description: 'Slow-cooked chicken with preserved lemon and olives.',
    price: '16.00',
    is_available: true,
    sort_order: 3,
  },
  {
    id: menuItemIds.chocolateFondant,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveDesserts,
    name: 'Chocolate Fondant',
    description: 'Warm chocolate cake with a molten centre.',
    price: '7.50',
    is_available: true,
    sort_order: 1,
  },
  {
    id: menuItemIds.baklava,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveDesserts,
    name: 'Baklava',
    description: 'Pistachio baklava with honey syrup.',
    price: '6.00',
    is_available: true,
    sort_order: 2,
  },
  {
    id: menuItemIds.seasonalFruitPlate,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveDesserts,
    name: 'Seasonal Fruit Plate',
    description: 'Fresh fruit, sliced to order.',
    price: '5.00',
    is_available: true,
    sort_order: 3,
  },
  {
    id: menuItemIds.mintLemonade,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveDrinks,
    name: 'Mint Lemonade',
    description: 'Fresh lemonade with crushed mint.',
    price: '4.50',
    is_available: true,
    sort_order: 1,
  },
  {
    id: menuItemIds.stillWater,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveDrinks,
    name: 'Still Water',
    description: '750 ml bottle.',
    price: '2.50',
    is_available: true,
    sort_order: 2,
  },
  {
    id: menuItemIds.turkishCoffee,
    restaurant_id: restaurantIds.blueOlive,
    category_id: menuCategoryIds.blueOliveDrinks,
    name: 'Turkish Coffee',
    description: 'Traditional preparation, served with a sweet.',
    price: '3.50',
    is_available: true,
    sort_order: 3,
  },
  {
    id: menuItemIds.cedarMixedGrill,
    restaurant_id: restaurantIds.cedarGrill,
    category_id: menuCategoryIds.cedarGrillGrill,
    name: 'Cedar Mixed Grill',
    description: 'Lamb, chicken, and kofta over charcoal.',
    price: '22.00',
    is_available: true,
    sort_order: 1,
  },
  {
    id: menuItemIds.flatbread,
    restaurant_id: restaurantIds.cedarGrill,
    category_id: menuCategoryIds.cedarGrillGrill,
    name: 'Flatbread',
    description: 'Baked to order, brushed with butter.',
    price: '4.00',
    is_available: true,
    sort_order: 2,
  },
] as const

export const seedMenuItemExtras = [
  {
    id: menuExtraIds.lambExtraGarlicSauce,
    restaurant_id: restaurantIds.blueOlive,
    item_id: menuItemIds.lambKebab,
    name: 'Extra garlic sauce',
    price_adjustment: '0.00',
    sort_order: 1,
  },
  {
    id: menuExtraIds.lambExtraRice,
    restaurant_id: restaurantIds.blueOlive,
    item_id: menuItemIds.lambKebab,
    name: 'Extra rice',
    price_adjustment: '3.00',
    sort_order: 2,
  },
  {
    id: menuExtraIds.lambExtraChili,
    restaurant_id: restaurantIds.blueOlive,
    item_id: menuItemIds.lambKebab,
    name: 'Extra chili',
    price_adjustment: '0.50',
    sort_order: 3,
  },
  {
    id: menuExtraIds.fondantVanillaIceCream,
    restaurant_id: restaurantIds.blueOlive,
    item_id: menuItemIds.chocolateFondant,
    name: 'Vanilla ice cream',
    price_adjustment: '3.50',
    sort_order: 1,
  },
  {
    id: menuExtraIds.fondantExtraChocolateSauce,
    restaurant_id: restaurantIds.blueOlive,
    item_id: menuItemIds.chocolateFondant,
    name: 'Extra chocolate sauce',
    price_adjustment: '2.00',
    sort_order: 2,
  },
  {
    id: menuExtraIds.cedarExtraFlatbread,
    restaurant_id: restaurantIds.cedarGrill,
    item_id: menuItemIds.cedarMixedGrill,
    name: 'Extra flatbread',
    price_adjustment: '2.00',
    sort_order: 1,
  },
] as const

export const seedBranchUnavailableItems = [
  {
    id: branchUnavailableItemIds.marinaGrilledSeaBass,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.marina,
    item_id: menuItemIds.grilledSeaBass,
  },
  {
    id: branchUnavailableItemIds.marinaChickenTagine,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.marina,
    item_id: menuItemIds.chickenTagine,
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 tax fixture (spec 006 FR-023, SC-007; data-model.md seed fixture
// section). Mirrors `supabase/seed.sql` exactly — the seed and these
// constants are two views of one fixture.
// ─────────────────────────────────────────────────────────────────────────────

export const taxRuleIds = {
  vat: '00000000-0000-4000-8000-000000007001',
  cityTax: '00000000-0000-4000-8000-000000007002',
  alcoholDuty: '00000000-0000-4000-8000-000000007003',
  importedSweetsTax: '00000000-0000-4000-8000-000000007004',
  downtownSurcharge: '00000000-0000-4000-8000-000000007005',
  cedarTax: '00000000-0000-4000-8000-000000007101',
} as const

export const taxRuleTargetIds = {
  alcoholDutyDrinks: '00000000-0000-4000-8000-000000007011',
  importedSweetsBaklava: '00000000-0000-4000-8000-000000007012',
} as const

export const taxRuleCompoundIds = {
  cityTaxOnVat: '00000000-0000-4000-8000-000000007021',
} as const

export const branchTaxOverrideIds = {
  marinaVat: '00000000-0000-4000-8000-000000007031',
} as const

/**
 * The seeded override identity pair — the PK of `branch_tax_overrides` is
 * `(branch_id, rule_id)`, so the override fixture is a pair, not an id row.
 * (The `branchTaxOverrideIds` value is kept only as a stable reference handle
 * for test readability.)
 */
export const seededBranchTaxOverride = {
  branch_id: branchIds.marina,
  rule_id: taxRuleIds.vat,
  restaurant_id: restaurantIds.blueOlive,
  rate: '8.7500',
} as const

/** Blue Olive's restaurant-level tax rules, in `(sort_order, name)` order. */
export const seedTaxRules = [
  {
    id: taxRuleIds.vat,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: null,
    name: 'VAT',
    rate: '8.2500',
    scope: 'total',
    sort_order: 1,
    is_active: true,
  },
  {
    id: taxRuleIds.cityTax,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: null,
    name: 'City tax',
    rate: '1.5000',
    scope: 'total',
    sort_order: 2,
    is_active: true,
  },
  {
    id: taxRuleIds.alcoholDuty,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: null,
    name: 'Alcohol duty',
    rate: '10.0000',
    scope: 'categories',
    sort_order: 3,
    is_active: true,
  },
  {
    id: taxRuleIds.importedSweetsTax,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: null,
    name: 'Imported sweets tax',
    rate: '5.0000',
    scope: 'items',
    sort_order: 4,
    is_active: true,
  },
  {
    id: taxRuleIds.downtownSurcharge,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    name: 'Downtown surcharge',
    rate: '2.0000',
    scope: 'total',
    sort_order: 5,
    is_active: true,
  },
  {
    id: taxRuleIds.cedarTax,
    restaurant_id: restaurantIds.cedarGrill,
    branch_id: null,
    name: 'IGIC',
    rate: '7.0000',
    scope: 'total',
    sort_order: 1,
    is_active: true,
  },
] as const

export const seedTaxRuleItems = [
  {
    id: taxRuleTargetIds.importedSweetsBaklava,
    restaurant_id: restaurantIds.blueOlive,
    rule_id: taxRuleIds.importedSweetsTax,
    item_id: menuItemIds.baklava,
  },
] as const

export const seedTaxRuleCategories = [
  {
    id: taxRuleTargetIds.alcoholDutyDrinks,
    restaurant_id: restaurantIds.blueOlive,
    rule_id: taxRuleIds.alcoholDuty,
    category_id: menuCategoryIds.blueOliveDrinks,
  },
] as const

export const seedTaxRuleCompounds = [
  {
    id: taxRuleCompoundIds.cityTaxOnVat,
    restaurant_id: restaurantIds.blueOlive,
    rule_id: taxRuleIds.cityTax,
    source_rule_id: taxRuleIds.vat,
  },
] as const

export const seedBranchTaxOverrides = [
  {
    branch_id: branchIds.marina,
    rule_id: taxRuleIds.vat,
    restaurant_id: restaurantIds.blueOlive,
    rate: '8.7500',
  },
] as const

/**
 * The effective tax configuration per Blue Olive branch (spec 006 FR-020;
 * quickstart walkthroughs): Downtown carries the branch-only surcharge and
 * no overrides; Marina carries the VAT replacement rate and no surcharge.
 */
export const seedTaxEffective = {
  downtown: {
    rules: [
      { id: taxRuleIds.vat, name: 'VAT', rate: '8.2500', origin: 'restaurant' },
      { id: taxRuleIds.cityTax, name: 'City tax', rate: '1.5000', origin: 'restaurant' },
      { id: taxRuleIds.alcoholDuty, name: 'Alcohol duty', rate: '10.0000', origin: 'restaurant' },
      {
        id: taxRuleIds.importedSweetsTax,
        name: 'Imported sweets tax',
        rate: '5.0000',
        origin: 'restaurant',
      },
      {
        id: taxRuleIds.downtownSurcharge,
        name: 'Downtown surcharge',
        rate: '2.0000',
        origin: 'branch-only',
      },
    ],
  },
  marina: {
    rules: [
      { id: taxRuleIds.vat, name: 'VAT', rate: '8.7500', origin: 'override' },
      { id: taxRuleIds.cityTax, name: 'City tax', rate: '1.5000', origin: 'restaurant' },
      { id: taxRuleIds.alcoholDuty, name: 'Alcohol duty', rate: '10.0000', origin: 'restaurant' },
      {
        id: taxRuleIds.importedSweetsTax,
        name: 'Imported sweets tax',
        rate: '5.0000',
        origin: 'restaurant',
      },
    ],
  },
  airport: {
    rules: [{ id: taxRuleIds.cedarTax, name: 'IGIC', rate: '7.0000', origin: 'restaurant' }],
  },
} as const

// ────────────────────────────────────────────────────────────────────────────
// Phase 6 — sessions (spec 007; data-model.md). Deterministic ids, the two
// demo open sessions at Downtown T1/T2, their participants, and the dev
// tokens: plaintext constants here, SHA-256 hashes computed by the seed.
// The dev tokens are development-only values — never secrets.
// ────────────────────────────────────────────────────────────────────────────

export const sessionIds = {
  downtownT1: '00000000-0000-4000-8000-000000008001',
  downtownT2: '00000000-0000-4000-8000-000000008002',
} as const

/**
 * Phase 9 (spec 010) — the channel fixture sessions: one delivery (with the
 * demo address) and one takeaway, both open at Downtown, no rounds.
 */
export const deliverySessionIds = {
  downtownDelivery: '00000000-0000-4000-8000-000000008003',
} as const

export const takeawaySessionIds = {
  downtownTakeaway: '00000000-0000-4000-8000-000000008004',
} as const

export const sessionParticipantIds = {
  downtownT1P1: '00000000-0000-4000-8000-000000008011',
  downtownT1P2: '00000000-0000-4000-8000-000000008012',
  downtownT2P1: '00000000-0000-4000-8000-000000008013',
} as const

export const sessionTokenIds = {
  downtownT1: '00000000-0000-4000-8000-000000008021',
  downtownT2: '00000000-0000-4000-8000-000000008022',
  downtownDelivery: '00000000-0000-4000-8000-000000008023',
  downtownTakeaway: '00000000-0000-4000-8000-000000008024',
} as const

/**
 * The deterministic dev tokens (development-only plaintext; the seed stores
 * only `encode(digest(token, 'sha256'), 'hex')`). Documented here so the
 * suites and e2e can drive customer flows without authenticating anything.
 */
export const devSessionTokens = {
  downtownT1: 'dev-token-downtown-t1-2026',
  downtownT2: 'dev-token-downtown-t2-2026',
  downtownDelivery: 'dev-token-downtown-delivery-2026',
  downtownTakeaway: 'dev-token-downtown-takeaway-2026',
} as const

/** The demo delivery address the seed stamps on the delivery session. */
export const seedDeliveryAddress = '12 Marina Walk'

export const seedSessions = [
  {
    id: sessionIds.downtownT1,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    table_id: diningTableIds.downtownT1,
    type: 'dine-in',
    status: 'open',
  },
  {
    id: sessionIds.downtownT2,
    restaurant_id: restaurantIds.blueOlive,
    branch_id: branchIds.downtown,
    table_id: diningTableIds.downtownT2,
    type: 'dine-in',
    status: 'open',
  },
] as const

export const seedSessionParticipants = [
  {
    id: sessionParticipantIds.downtownT1P1,
    session_id: sessionIds.downtownT1,
    restaurant_id: restaurantIds.blueOlive,
    display_name: 'Sara',
    phone: '+15550101',
  },
  {
    id: sessionParticipantIds.downtownT1P2,
    session_id: sessionIds.downtownT1,
    restaurant_id: restaurantIds.blueOlive,
    display_name: 'Omar',
    phone: '05550102',
  },
  {
    id: sessionParticipantIds.downtownT2P1,
    session_id: sessionIds.downtownT2,
    restaurant_id: restaurantIds.blueOlive,
    display_name: 'Lina',
    phone: '+15550103',
  },
] as const

/** The token rows mirror `devSessionTokens` — hashes only in the database. */
export const seedSessionTokenIds = sessionTokenIds

/** Each dev token must resolve to exactly its session through the RPCs. */
export const devTokenSession = {
  [devSessionTokens.downtownT1]: sessionIds.downtownT1,
  [devSessionTokens.downtownT2]: sessionIds.downtownT2,
  [devSessionTokens.downtownDelivery]: deliverySessionIds.downtownDelivery,
  [devSessionTokens.downtownTakeaway]: takeawaySessionIds.downtownTakeaway,
} as const

/** The Downtown table labels as the payloads surface them. */
export const downtownTableLabels = {
  [diningTableIds.downtownT1]: 'T1',
  [diningTableIds.downtownT2]: 'T2',
  [diningTableIds.downtownT3]: 'T3',
} as const

// ────────────────────────────────────────────────────────────────────────────
// Phase 7 (cart and rounds) fixture constants (spec 008; T002): the item
// selection matrix the submission suites drive. No rounds are seeded —
// histories start empty so Round 1/Round 2 journeys are provable from a
// clean state (research.md §10).
// ────────────────────────────────────────────────────────────────────────────

/**
 * The submission suites' item matrix, expressed from the seeded menu:
 * a priced item WITH extras (lamb kebab: garlic sauce, rice, chili), a plain
 * priced item (mint lemonade), the foreign-restaurant item (Cedar Grill's
 * mixed grill — wrong restaurant for a Blue Olive session), the
 * restaurant-wide stopped item, and the Marina-override item (proves the
 * branch check uses the SESSION's branch).
 */
export const orderTestItems = {
  /** With extras `lambExtraGarlicSauce`/`lambExtraRice`/`lambExtraChili`. */
  lambKebab: menuItemIds.lambKebab,
  /** A plain priced item with no extras rows. */
  mintLemonade: menuItemIds.mintLemonade,
  /** Cedar Grill's item — the foreign-restaurant refusal class. */
  foreign: menuItemIds.cedarMixedGrill,
  /** Restaurant-wide stopped (`is_available = false`). */
  stopped: stoppedMenuItemId,
  /** Available everywhere except Marina (the session-branch check). */
  marinaOnly: marinaOnlyUnavailableItemId,
} as const
