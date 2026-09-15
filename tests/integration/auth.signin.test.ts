import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuthApiError, createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.types'
import { createDbClient } from '../database/helpers/db'
import {
  branchIds,
  diningTableIds,
  membershipIds,
  profileIds,
  restaurantIds,
  seedCredentials,
} from '../database/helpers/fixtures'

/**
 * Integration suite — User Story 1: staff sign-in and role mapping (spec 003
 * US1; FR-001..FR-005, FR-012, FR-021; SC-001/SC-002/SC-007 — the story's
 * Independent Test, run for real), extended with the User Story 2 role-aware
 * data matrix (US2 scenarios 1–4, 8; FR-007 — SC-001/SC-002 through the
 * narrowed policies) and the User Story 5 automatable recovery properties
 * (FR-018/FR-019 — generic recovery responses, post-change round-trip).
 *
 * Everything here goes through the REAL cloud project: sign-ins use the real
 * Auth API (`signInWithPassword` with the publishable key) and data reads go
 * through the real data API under the caller's own grants and RLS policies.
 * Credentials come from the shared fixture source
 * (tests/database/helpers/fixtures.ts) — the same values supabase/seed.sql
 * provisions (FR-021).
 *
 * Rate-limit aware (research.md §12/§14): ~15 sign-in attempts per run, well
 * under the 30-per-5-minutes limit, and NO recovery emails are ever sent
 * (exactly one recover request per run, for a non-existent address — no
 * email is sent for unknown addresses). The US2 matrix reuses the cached
 * sessions — no additional sign-ins.
 *
 * Preconditions: migrated + seeded cloud development database
 * (`npm run db:migrate && npm run db:seed`).
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Copy .env.example to .env and fill it in — see docs/development.md (Setup).',
    )
  }
  return value
}

/** A fresh client per consumer, so sessions never leak between identities. */
function createAuthClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv('VITE_SUPABASE_URL'),
    requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
  )
}

type StaffName = keyof typeof seedCredentials

const staffClients = new Map<StaffName, SupabaseClient<Database>>()

/**
 * Signs `name` in through the real Auth API (once per run, then cached),
 * proving FR-001 (authentication succeeds with the seeded credentials) and
 * FR-003/SC-007 (the session's subject is the deterministic UUID the profile
 * links to — `session.user` is parsed from the access token, so `user.id` is
 * the token's `sub`).
 */
async function signInAs(name: StaffName): Promise<SupabaseClient<Database>> {
  const cached = staffClients.get(name)
  if (cached) return cached

  const credential = seedCredentials[name]
  const client = createAuthClient()
  const { data, error } = await client.auth.signInWithPassword({
    email: credential.email,
    password: credential.password,
  })
  expect(error).toBeNull()
  expect(data.session).not.toBeNull()
  expect(data.session?.user.id).toBe(credential.auth_user_id)

  staffClients.set(name, client)
  return client
}

type ScopeTable = 'restaurants' | 'branches' | 'dining_tables' | 'staff_memberships' | 'profiles'

/** The ids the given client can read through the real data API. */
async function readableIds(client: SupabaseClient<Database>, table: ScopeTable): Promise<string[]> {
  const { data, error } = await client.from(table).select('id')
  expect(error).toBeNull()
  const rows = (data ?? []) as Array<{ id: string }>
  return rows.map((row) => row.id).sort()
}

/**
 * The ids the given client can read through a CRAFTED filtered query — the
 * real-data-API equivalent of a direct query for a specific row. Out-of-scope
 * rows are filtered out by the policies, not merely absent from a list.
 */
async function readableIdsWhere(
  client: SupabaseClient<Database>,
  table: ScopeTable,
  column: string,
  value: string,
): Promise<string[]> {
  const { data, error } = await client.from(table).select('id').eq(column, value)
  expect(error).toBeNull()
  const rows = (data ?? []) as Array<{ id: string }>
  return rows.map((row) => row.id).sort()
}

/**
 * The seeded membership matrix (data-model.md) expressed as each identity's
 * readable scope: an owner sees the whole restaurant; branch-scoped roles see
 * their assigned branch; Eve's dual membership yields the union of both
 * scopes and nothing beyond either; the membership-less super admin reads no
 * restaurant tenant data at all (FR-012).
 */
const SCOPE_MATRIX: ReadonlyArray<{
  identity: StaffName
  restaurants: string[]
  branches: string[]
  diningTables: string[]
}> = [
  {
    identity: 'alice', // owner, Blue Olive — both branches
    restaurants: [restaurantIds.blueOlive],
    branches: [branchIds.downtown, branchIds.marina],
    diningTables: [
      diningTableIds.downtownT1,
      diningTableIds.downtownT2,
      diningTableIds.downtownT3,
      diningTableIds.marinaT1,
    ],
  },
  {
    identity: 'bob', // branch manager, Downtown
    restaurants: [restaurantIds.blueOlive],
    branches: [branchIds.downtown],
    diningTables: [diningTableIds.downtownT1, diningTableIds.downtownT2, diningTableIds.downtownT3],
  },
  {
    identity: 'carla', // cashier, Downtown
    restaurants: [restaurantIds.blueOlive],
    branches: [branchIds.downtown],
    diningTables: [diningTableIds.downtownT1, diningTableIds.downtownT2, diningTableIds.downtownT3],
  },
  {
    identity: 'dan', // kitchen, Marina
    restaurants: [restaurantIds.blueOlive],
    branches: [branchIds.marina],
    diningTables: [diningTableIds.marinaT1],
  },
  {
    identity: 'eve', // owner of Cedar Grill + cashier of Downtown — the union
    restaurants: [restaurantIds.blueOlive, restaurantIds.cedarGrill],
    branches: [branchIds.airport, branchIds.downtown],
    diningTables: [
      diningTableIds.downtownT1,
      diningTableIds.downtownT2,
      diningTableIds.downtownT3,
      diningTableIds.airportT1,
    ],
  },
  {
    identity: 'platformAdmin', // is_super_admin, no memberships — nothing (FR-012)
    restaurants: [],
    branches: [],
    diningTables: [],
  },
]

describe('seeded identities sign in through the real Auth API (FR-001, FR-003, SC-007)', () => {
  for (const name of Object.keys(seedCredentials) as StaffName[]) {
    it(
      `${name} authenticates and the session subject equals the deterministic UUID`,
      { timeout: 10_000 },
      async () => {
        // signInAs asserts a null error and a session whose subject equals the
        // seeded auth_user_id (fixtures.authUserIds) — the live FR-003 proof.
        await signInAs(name)
      },
    )
  }
})

describe('credential rejection is generic and non-enumerating (FR-002)', () => {
  it(
    'a wrong password and a well-formed unknown account fail indistinguishably',
    { timeout: 10_000 },
    async () => {
      const wrongPassword = await createAuthClient().auth.signInWithPassword({
        email: seedCredentials.alice.email,
        password: 'definitely-not-the-seeded-password',
      })
      const unknownAccount = await createAuthClient().auth.signInWithPassword({
        email: 'nobody@restopilot.dev',
        password: 'equally-plausible-password',
      })

      for (const result of [wrongPassword, unknownAccount]) {
        expect(result.data.session).toBeNull()
        expect(result.error).toBeInstanceOf(AuthApiError)
        const error = result.error as AuthApiError
        expect(error.status).toBe(400)
        expect(error.code).toBe('invalid_credentials')
      }
      // Identical through the SDK — neither response reveals whether the
      // account exists or which part of the credentials was wrong.
      expect(unknownAccount.error?.message).toBe(wrongPassword.error?.message)
      expect(wrongPassword.error?.message).toBe('Invalid login credentials')
    },
  )
})

describe('each identity reads exactly its seeded scope (FR-004, SC-001/SC-002)', () => {
  for (const scope of SCOPE_MATRIX) {
    it(
      `${scope.identity} — restaurants, branches, and dining tables match the membership matrix`,
      { timeout: 20_000 },
      async () => {
        const client = await signInAs(scope.identity)

        expect(await readableIds(client, 'restaurants')).toEqual([...scope.restaurants].sort())
        expect(await readableIds(client, 'branches')).toEqual([...scope.branches].sort())
        expect(await readableIds(client, 'dining_tables')).toEqual([...scope.diningTables].sort())
      },
    )
  }
})

describe('staff list visibility follows the role matrix through the real data API (FR-007, SC-001/SC-002)', () => {
  it(
    'Alice (owner) and Bob (branch manager) read the full Blue Olive staff list — memberships and linked profiles',
    { timeout: 20_000 },
    async () => {
      for (const name of ['alice', 'bob'] as StaffName[]) {
        const client = await signInAs(name)
        expect(await readableIds(client, 'staff_memberships')).toEqual([
          membershipIds.aliceOwnerBlueOlive,
          membershipIds.bobManagerDowntown,
          membershipIds.carlaCashierDowntown,
          membershipIds.danKitchenMarina,
          membershipIds.eveCashierDowntown,
        ])
        expect(await readableIds(client, 'profiles')).toEqual([
          profileIds.alice,
          profileIds.bob,
          profileIds.carla,
          profileIds.dan,
          profileIds.eve,
        ])
      }
    },
  )

  it(
    'Carla (cashier) and Dan (kitchen) are denied the staff list — only their own rows and profiles',
    { timeout: 20_000 },
    async () => {
      const ownRowCases: ReadonlyArray<{
        identity: StaffName
        membership: string
        profile: string
      }> = [
        {
          identity: 'carla',
          membership: membershipIds.carlaCashierDowntown,
          profile: profileIds.carla,
        },
        { identity: 'dan', membership: membershipIds.danKitchenMarina, profile: profileIds.dan },
      ]
      for (const { identity, membership, profile } of ownRowCases) {
        const client = await signInAs(identity)
        expect(await readableIds(client, 'staff_memberships')).toEqual([membership])
        expect(await readableIds(client, 'profiles')).toEqual([profile])
        // Crafted direct reads for other members' rows return nothing — the
        // denial is server-enforced, not a hidden UI element.
        expect(
          await readableIdsWhere(
            client,
            'staff_memberships',
            'id',
            membershipIds.bobManagerDowntown,
          ),
        ).toEqual([])
        expect(await readableIdsWhere(client, 'profiles', 'id', profileIds.bob)).toEqual([])
      }
    },
  )

  it(
    'Eve reads the Cedar Grill staff list (owner) but not the Blue Olive one (cashier there)',
    { timeout: 20_000 },
    async () => {
      const client = await signInAs('eve')
      // Own rows (both memberships) + Cedar Grill's rows — exactly her two.
      expect(await readableIds(client, 'staff_memberships')).toEqual([
        membershipIds.eveOwnerCedarGrill,
        membershipIds.eveCashierDowntown,
      ])
      // A crafted staff-list read for Blue Olive returns only her own row.
      expect(
        await readableIdsWhere(
          client,
          'staff_memberships',
          'restaurant_id',
          restaurantIds.blueOlive,
        ),
      ).toEqual([membershipIds.eveCashierDowntown])
      // And no other member's profile is reachable.
      expect(await readableIds(client, 'profiles')).toEqual([profileIds.eve])
    },
  )
})

describe('every staff member reads their own restaurant record (FR-007 baseline, US2 scenario 8)', () => {
  it(
    'each identity reaches exactly its restaurants through a crafted read',
    { timeout: 20_000 },
    async () => {
      const ownRestaurantCases: ReadonlyArray<{
        identity: StaffName
        restaurant: string
      }> = [
        { identity: 'alice', restaurant: restaurantIds.blueOlive },
        { identity: 'bob', restaurant: restaurantIds.blueOlive },
        { identity: 'carla', restaurant: restaurantIds.blueOlive },
        { identity: 'dan', restaurant: restaurantIds.blueOlive },
        { identity: 'eve', restaurant: restaurantIds.cedarGrill },
      ]
      for (const { identity, restaurant } of ownRestaurantCases) {
        const client = await signInAs(identity)
        expect(await readableIdsWhere(client, 'restaurants', 'id', restaurant)).toEqual([
          restaurant,
        ])
      }
    },
  )
})

describe('cross-restaurant and cross-branch reads are denied for every role (US2 scenarios 1–4, 8)', () => {
  it(
    'no Blue Olive member reads Cedar Grill by id; branch scope holds for every role',
    { timeout: 30_000 },
    async () => {
      // Cross-restaurant: every Blue Olive-only member gets nothing for a
      // crafted Cedar Grill read (Eve reaches it — through her OWN Cedar
      // Grill ownership, already asserted above).
      for (const name of ['alice', 'bob', 'carla', 'dan'] as StaffName[]) {
        const client = await signInAs(name)
        expect(
          await readableIdsWhere(client, 'restaurants', 'id', restaurantIds.cedarGrill),
        ).toEqual([])
      }

      // Cross-branch within the own restaurant: Marina is invisible to every
      // Downtown-scoped member (Bob, Carla) and to Eve (cashier at Downtown);
      // Alice (owner) and Dan (Marina kitchen) reach it by right.
      const marinaCases: ReadonlyArray<{ identity: StaffName; expected: string[] }> = [
        { identity: 'alice', expected: [branchIds.marina] },
        { identity: 'bob', expected: [] },
        { identity: 'carla', expected: [] },
        { identity: 'dan', expected: [branchIds.marina] },
        { identity: 'eve', expected: [] },
      ]
      for (const { identity, expected } of marinaCases) {
        const client = await signInAs(identity)
        expect(await readableIdsWhere(client, 'branches', 'id', branchIds.marina)).toEqual(expected)
      }

      // Cross-branch data follows the same boundary: Marina's tables are
      // invisible to Downtown-scoped members (scope bypass re-proven with a
      // real login).
      const client = await signInAs('bob')
      expect(
        await readableIdsWhere(client, 'dining_tables', 'branch_id', branchIds.marina),
      ).toEqual([])
    },
  )
})

/**
 * Integration coverage — User Story 5: the automatable password-recovery
 * properties (spec 003 US5; FR-018/FR-019, SC-005; research.md §12).
 *
 * Rate-limit aware by design: NO recovery email is ever sent. The full
 * email-link path (delivery, expiry, single-use) is the quickstart's manual
 * validation. Automated here: (a) a recovery request for a non-existent
 * email returns the same generic response as the valid case — no account
 * enumeration (US5 scenario 5; no email is sent for unknown addresses), and
 * (b) the post-change round-trip on a scratch identity: a new password set
 * via `updateUser` signs in, the previous password is rejected, and the
 * identity's profile, memberships, roles, and scope are unchanged.
 */
describe('recovery request for a non-existent email is generic (FR-018, US5 scenario 5)', () => {
  it(
    'returns the same generic response as the valid case — no account enumeration',
    { timeout: 10_000 },
    async () => {
      // Exactly ONE recover request per run (the platform enforces a 60 s
      // window between requests; only requests for existing addresses send
      // an email — none is sent for this unknown address).
      const { error } = await createAuthClient().auth.resetPasswordForEmail(
        'nobody@restopilot.dev',
        { redirectTo: '/reset-password' },
      )
      // The generic success response — the platform returns it
      // byte-identically for existing and non-existing addresses
      // (contracts/supabase-auth-surface.md, Password recovery), so an
      // unknown address reveals nothing: no error payload that could hint
      // at account existence (the SDK's typed data for this call is empty).
      expect(error).toBeNull()
    },
  )
})

describe('password change round-trip on a scratch identity (FR-018/FR-019)', () => {
  // Provisioned through the verified seeded-identity SQL pattern
  // (contracts/supabase-auth-surface.md — the documented exception under
  // which test suites may create scratch identities) and deleted afterwards.
  // Unlike the unlinked scratch identity above, this one is LINKED: a
  // profile plus a cashier membership at Blue Olive Downtown — the account
  // state a password recovery must not alter (FR-019).
  const SCRATCH_ID = '00000000-0000-4000-8000-00000000a002'
  const SCRATCH_EMAIL = 'scratch-recovery@restopilot.dev'
  const SCRATCH_PASSWORD = 'dev-scratch-recovery-2026'
  const SCRATCH_NEW_PASSWORD = 'dev-scratch-recovery-new-2026'
  const SCRATCH_PROFILE_ID = '00000000-0000-4000-8000-00000000a102'
  const SCRATCH_MEMBERSHIP_ID = '00000000-0000-4000-8000-00000000a202'

  const db = createDbClient()

  beforeAll(async () => {
    await db.connect()
    // Defensive cleanup: an interrupted earlier run may have left the scratch
    // rows behind; delete-then-insert keeps provisioning deterministic. The
    // profile's FK to auth.users has no cascade, so the order is membership
    // → profile → auth user.
    await db.query('delete from public.staff_memberships where id = $1', [SCRATCH_MEMBERSHIP_ID])
    await db.query('delete from public.profiles where id = $1', [SCRATCH_PROFILE_ID])
    await db.query('delete from auth.users where id = $1', [SCRATCH_ID])
    // The verified auth-identity pattern (contracts/supabase-auth-surface.md).
    await db.query(
      `insert into auth.users (
         id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
         confirmation_token, recovery_token, email_change,
         email_change_token_new, email_change_token_current, created_at, updated_at
       ) values (
         $1, '00000000-0000-0000-0000-000000000000',
         'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf', 10)),
         now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
         '', '', '', '', '', now(), now()
       )
       on conflict (id) do nothing`,
      [SCRATCH_ID, SCRATCH_EMAIL, SCRATCH_PASSWORD],
    )
    await db.query(
      `insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at)
       values (
         $1::uuid, $1::uuid, 'email', $1::uuid,
         jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true),
         now(), now()
       )
       on conflict (id) do nothing`,
      [SCRATCH_ID, SCRATCH_EMAIL],
    )
    // The linked account state: profile + cashier membership at Blue Olive
    // Downtown (FR-019 — only the credential may change).
    await db.query(
      `insert into public.profiles (id, display_name, auth_user_id, is_super_admin)
       values ($1, 'Scratch Recovery', $2, false)
       on conflict (id) do nothing`,
      [SCRATCH_PROFILE_ID, SCRATCH_ID],
    )
    await db.query(
      `insert into public.staff_memberships (id, profile_id, restaurant_id, role, branch_id)
       values ($1, $2, $3, 'cashier', $4)
       on conflict (id) do nothing`,
      [SCRATCH_MEMBERSHIP_ID, SCRATCH_PROFILE_ID, restaurantIds.blueOlive, branchIds.downtown],
    )
  }, 20_000)

  afterAll(async () => {
    // Mirror the provisioning order in reverse: membership → profile → auth
    // user (the FK to auth.users has no cascade, so the profile must go
    // first); the auth.identities row cascades with the user.
    await db.query('delete from public.staff_memberships where id = $1', [SCRATCH_MEMBERSHIP_ID])
    await db.query('delete from public.profiles where id = $1', [SCRATCH_PROFILE_ID])
    await db.query('delete from auth.users where id = $1', [SCRATCH_ID])
    await db.end()
  })

  /** The caller's effective context through the real RPC (FR-010 path). */
  async function readAuthContext(client: SupabaseClient<Database>) {
    const { data, error } = await client.rpc('current_auth_context')
    expect(error).toBeNull()
    return typeof data === 'string' ? JSON.parse(data) : data
  }

  it(
    'new password signs in, previous password is dead, and nothing else about the account changed',
    { timeout: 30_000 },
    async () => {
      // Before: the original password signs in (FR-018 starting point) and
      // the account state is captured — effective context plus readable
      // scope through the real data API.
      const before = createAuthClient()
      const beforeSignIn = await before.auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_PASSWORD,
      })
      expect(beforeSignIn.error).toBeNull()
      expect(beforeSignIn.data.session?.user.id).toBe(SCRATCH_ID)

      const contextBefore = await readAuthContext(before)
      expect(contextBefore.profile).toEqual({
        id: SCRATCH_PROFILE_ID,
        display_name: 'Scratch Recovery',
        is_super_admin: false,
      })
      expect(contextBefore.memberships).toEqual([
        {
          restaurant_id: restaurantIds.blueOlive,
          restaurant_slug: 'blue-olive',
          restaurant_name: 'Blue Olive',
          role: 'cashier',
          branch_id: branchIds.downtown,
          branch_name: 'Downtown',
        },
      ])
      const scopeBefore = {
        restaurants: await readableIds(before, 'restaurants'),
        branches: await readableIds(before, 'branches'),
        diningTables: await readableIds(before, 'dining_tables'),
        memberships: await readableIds(before, 'staff_memberships'),
      }

      // Change: the recovery flow's client call — `updateUser({ password })`,
      // valid with the (recovery-established) session (FR-018).
      const { error: updateError } = await before.auth.updateUser({
        password: SCRATCH_NEW_PASSWORD,
      })
      expect(updateError).toBeNull()

      // After (a): the NEW password signs in through the real Auth API.
      const after = createAuthClient()
      const newSignIn = await after.auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_NEW_PASSWORD,
      })
      expect(newSignIn.error).toBeNull()
      expect(newSignIn.data.session?.user.id).toBe(SCRATCH_ID)

      // After (b): the PREVIOUS password is dead — rejected exactly like any
      // invalid credential (FR-018).
      const oldSignIn = await createAuthClient().auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_PASSWORD,
      })
      expect(oldSignIn.data.session).toBeNull()
      expect(oldSignIn.error).toBeInstanceOf(AuthApiError)
      const oldError = oldSignIn.error as AuthApiError
      expect(oldError.status).toBe(400)
      expect(oldError.code).toBe('invalid_credentials')

      // After (c): profile, memberships, roles, and scope are unchanged —
      // only the credential changed (FR-019).
      expect(await readAuthContext(after)).toEqual(contextBefore)
      expect(await readableIds(after, 'restaurants')).toEqual(scopeBefore.restaurants)
      expect(await readableIds(after, 'branches')).toEqual(scopeBefore.branches)
      expect(await readableIds(after, 'dining_tables')).toEqual(scopeBefore.diningTables)
      expect(await readableIds(after, 'staff_memberships')).toEqual(scopeBefore.memberships)
    },
  )
})

describe('deny-by-default for an authenticated unlinked identity (FR-005)', () => {
  // Provisioned through the verified seeded-identity SQL pattern
  // (contracts/supabase-auth-surface.md — the documented exception under
  // which test suites may create scratch identities) and deleted afterwards.
  // Deliberately NOT linked to any profile: the unlinked-identity case.
  const SCRATCH_ID = '00000000-0000-4000-8000-00000000a001'
  const SCRATCH_EMAIL = 'scratch-unlinked@restopilot.dev'
  const SCRATCH_PASSWORD = 'dev-scratch-2026'

  const db = createDbClient()

  beforeAll(async () => {
    await db.connect()
    // Defensive cleanup: an interrupted earlier run may have left the scratch
    // identity behind; delete-then-insert keeps provisioning deterministic.
    await db.query('delete from auth.users where id = $1', [SCRATCH_ID])
    await db.query(
      `insert into auth.users (
         id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
         confirmation_token, recovery_token, email_change,
         email_change_token_new, email_change_token_current, created_at, updated_at
       ) values (
         $1, '00000000-0000-0000-0000-000000000000',
         'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf', 10)),
         now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
         '', '', '', '', '', now(), now()
       )
       on conflict (id) do nothing`,
      [SCRATCH_ID, SCRATCH_EMAIL, SCRATCH_PASSWORD],
    )
    await db.query(
      `insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at)
       values (
         $1::uuid, $1::uuid, 'email', $1::uuid,
         jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true),
         now(), now()
       )
       on conflict (id) do nothing`,
      [SCRATCH_ID, SCRATCH_EMAIL],
    )
  }, 20_000)

  afterAll(async () => {
    // Nothing links to the scratch identity (it is deliberately unlinked), so
    // deleting the user succeeds; its auth.identities row cascades with it.
    await db.query('delete from auth.users where id = $1', [SCRATCH_ID])
    await db.end()
  })

  it(
    'authenticates through the real Auth API but reads zero rows everywhere',
    { timeout: 20_000 },
    async () => {
      const client = createAuthClient()
      const { data, error } = await client.auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_PASSWORD,
      })
      expect(error).toBeNull()
      expect(data.session?.user.id).toBe(SCRATCH_ID)

      // No linked profile → no membership → every granted table reads empty.
      for (const table of [
        'restaurants',
        'branches',
        'dining_tables',
        'staff_memberships',
      ] as const) {
        expect(await readableIds(client, table)).toEqual([])
      }
    },
  )

  it(
    'has writes denied by grants (42501) through the real data API',
    { timeout: 20_000 },
    async () => {
      const client = createAuthClient()
      const { error: signInError } = await client.auth.signInWithPassword({
        email: SCRATCH_EMAIL,
        password: SCRATCH_PASSWORD,
      })
      expect(signInError).toBeNull()

      const { error } = await client
        .from('restaurants')
        .insert({ name: 'Scratch Write Probe', slug: 'scratch-write-probe' })
      expect(error).not.toBeNull()
      expect(error?.code).toBe('42501')
    },
  )
})
