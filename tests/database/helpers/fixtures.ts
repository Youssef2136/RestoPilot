/**
 * Deterministic seed fixture constants (spec 002 FR-015, spec 003 FR-021;
 * data-model.md seed table).
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
} as const

/**
 * Seeded sign-in credentials for the six staff identities (spec 003 FR-021,
 * SC-007; data-model.md seed table) — the single credential source shared by
 * the seed (`supabase/seed.sql` mirrors these values verbatim) and every
 * Phase 2 test suite.
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
