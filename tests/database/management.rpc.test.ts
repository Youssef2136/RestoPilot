import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asUser, createDbClient, expectStatementToFail, runAs } from './helpers/db'
import {
  authUserIds,
  branchIds,
  diningTableIds,
  profileIds,
  restaurantIds,
  seedBranchWorkingHours,
  seedBranches,
  seedDiningTableActivation,
  seedDiningTables,
  seedRestaurants,
  seedRestaurantSettings,
  type SeedBranchWorkingHours,
  type Weekday,
} from './helpers/fixtures'

/**
 * Management RPC suite — restaurant (US1) and branch (US2) sections
 * (spec 004 US1: FR-001, FR-004, FR-005, FR-020, FR-022; US2: FR-007,
 * FR-008, FR-009, FR-020, FR-025; SC-002/SC-003/SC-006).
 *
 * The suites simulate acting identities exactly as the data API does (the
 * `authenticated`/`anon` Postgres role + `request.jwt.claims`, per
 * helpers/db.ts) and call the real `security definer` functions inside
 * transactions that are ALWAYS rolled back — the shared cloud development
 * database keeps no test residue. Audit rows have no client grants by design
 * (FR-020), so every audit assertion reads them through the owner connection
 * inside the same transaction.
 *
 * This file is structured for the later stories: US3 (T032) appends its table
 * section alongside the restaurant and branch sections below.
 *
 * Preconditions: migrated + seeded cloud dev DB (`npm run db:migrate &&
 * npm run db:seed`).
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

/** An authenticated identity with no linked profile (the unlinked case). */
const UNLINKED_AUTH_USER = '00000000-0000-4000-8000-000000009999'

const CREATE = 'select * from public.create_restaurant($1, $2, $3, $4, $5, $6)'
const UPDATE_PROFILE = 'select * from public.update_restaurant_profile($1, $2, $3, $4, $5, $6)'
const UPDATE_SETTINGS = 'select * from public.update_restaurant_settings($1, $2)'

const blueOliveBaseline = seedRestaurants.find((r) => r.id === restaurantIds.blueOlive)
const blueOliveSettings = seedRestaurantSettings.find((s) => s.id === restaurantIds.blueOlive)
if (blueOliveBaseline === undefined || blueOliveSettings === undefined) {
  throw new Error('missing Blue Olive seed fixture')
}

/**
 * Assert the RPC fails with the given SQLSTATE and a message containing
 * `messagePart` (the contract's clear-message requirement). The attempt runs
 * inside a savepoint and is rolled back to it, so the enclosing identity
 * block continues at the pre-attempt state — which is exactly what the
 * no-state-change assertions then verify.
 */
async function expectRpcFailure(
  code: string,
  messagePart: string,
  sql: string,
  values: unknown[] = [],
): Promise<void> {
  await client.query('savepoint expect_rpc_failure')
  try {
    await client.query(sql, values)
  } catch (error) {
    await client.query('rollback to savepoint expect_rpc_failure')
    const pgError = error as { code?: string; message: string }
    if (pgError.code !== code) {
      throw new Error(`Expected ${code} but got ${pgError.code ?? 'no code'}: ${pgError.message}`, {
        cause: error,
      })
    }
    expect(pgError.message).toContain(messagePart)
    return
  }
  await client.query('rollback to savepoint expect_rpc_failure')
  throw new Error(`Expected the call to fail with ${code} but it succeeded: ${sql}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Restaurant creation bootstrap (FR-001)
// ─────────────────────────────────────────────────────────────────────────────

describe('restaurant creation bootstrap (FR-001, SC-002/SC-003)', () => {
  it(
    'a linked profile with no memberships creates a restaurant and becomes its owner',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.fiona, async () => {
        const { rows } = await client.query(CREATE, [
          'Fiona Bistro',
          'fiona-bistro',
          'A quiet bistro.',
          'hello@fiona-bistro.example',
          '+351 21 555 0300',
          'Europe/Lisbon',
        ])
        expect(rows).toHaveLength(1)
        const created = rows[0] as { id: string }
        expect(created).toMatchObject({
          name: 'Fiona Bistro',
          slug: 'fiona-bistro',
          brand_description: 'A quiet bistro.',
          contact_email: 'hello@fiona-bistro.example',
          contact_phone: '+351 21 555 0300',
          timezone: 'Europe/Lisbon',
        })
        expect(created.id).toMatch(/^[0-9a-f]{8}-/)

        // The creator's owner membership (FR-001), through the owner
        // connection: the new restaurant is theirs and holds exactly one row.
        await client.query('set local role postgres')
        const membership = await client.query(
          `select profile_id, role, branch_id from public.staff_memberships
           where restaurant_id = $1 order by id`,
          [created.id],
        )
        expect(membership.rows).toEqual([
          { profile_id: profileIds.fiona, role: 'owner', branch_id: null },
        ])
      })
    },
  )

  it(
    'the membership-less platform admin may also create — creation is the person-level entitlement (research.md §13)',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.platformAdmin, async () => {
        const { rows } = await client.query(CREATE, [
          'Admin Bistro',
          'admin-bistro',
          null,
          null,
          null,
          'UTC',
        ])
        const created = rows[0] as { id: string; slug: string }
        expect(created.slug).toBe('admin-bistro')

        await client.query('set local role postgres')
        const membership = await client.query(
          `select profile_id, role, branch_id from public.staff_memberships
           where restaurant_id = $1`,
          [created.id],
        )
        expect(membership.rows).toEqual([
          { profile_id: profileIds.platformAdmin, role: 'owner', branch_id: null },
        ])
      })
    },
  )

  it(
    'an authenticated identity without a linked profile is denied 42501 and creates nothing',
    { timeout: 30_000 },
    async () => {
      await runAs(client, 'authenticated', { sub: UNLINKED_AUTH_USER }, async () => {
        await expectRpcFailure('42501', 'linked profile is required', CREATE, [
          'No Profile Bistro',
          'no-profile-bistro',
          null,
          null,
          null,
          'UTC',
        ])

        await client.query('set local role postgres')
        const { rows } = await client.query(
          `select count(*)::int as n from public.restaurants where slug = 'no-profile-bistro'`,
        )
        expect(rows[0].n).toBe(0)
      })
    },
  )

  it(
    'anon cannot call create_restaurant (execute is granted to authenticated only)',
    { timeout: 30_000 },
    async () => {
      await asAnon(client, async () => {
        await expectRpcFailure('42501', 'permission denied', CREATE, [
          'Anon Bistro',
          'anon-bistro',
          null,
          null,
          null,
          'UTC',
        ])
      })
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Validation rules (FR-001/FR-003, SC-003)
// ─────────────────────────────────────────────────────────────────────────────

describe('restaurant validation leaves nothing created (FR-001/FR-003, SC-003)', () => {
  it(
    'blank name, malformed slug, duplicate slug, and unknown timezone are rejected with clear messages and no record',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.fiona, async () => {
        await expectRpcFailure('P0001', 'A restaurant name is required.', CREATE, [
          '   ',
          'valid-slug',
          null,
          null,
          null,
          'UTC',
        ])
        await expectRpcFailure('P0001', 'lowercase letters, digits, and single hyphens', CREATE, [
          'Valid Name',
          'Not A Slug',
          null,
          null,
          null,
          'UTC',
        ])
        await expectRpcFailure('P0001', 'already in use', CREATE, [
          'Another Olive',
          'blue-olive',
          null,
          null,
          null,
          'UTC',
        ])
        await expectRpcFailure('P0001', 'Unknown timezone', CREATE, [
          'Unknown Zone',
          'unknown-zone',
          null,
          null,
          null,
          'Mars/Olympus',
        ])

        // Nothing was created and the rejected calls wrote no audit record.
        await client.query('set local role postgres')
        const restaurants = await client.query(
          `select slug from public.restaurants
           where slug in ('valid-slug', 'blue-olive', 'unknown-zone') order by slug`,
        )
        expect(restaurants.rows).toEqual([{ slug: 'blue-olive' }])
        const audit = await client.query(
          `select count(*)::int as n from public.audit_log
           where actor_profile_id = $1 and action = 'restaurant.created'`,
          [profileIds.fiona],
        )
        expect(audit.rows[0].n).toBe(0)
      })
    },
  )

  it(
    'empty optional fields are stored as NULL (trimmed), and the timezone defaults to UTC',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.fiona, async () => {
        const { rows } = await client.query(CREATE, [
          'Blank Extras',
          'blank-extras',
          '   ',
          '',
          '  ',
          'UTC',
        ])
        expect(rows[0]).toMatchObject({
          brand_description: null,
          contact_email: null,
          contact_phone: null,
          timezone: 'UTC',
        })
      })
    },
  )

  it(
    'settings: an unknown or empty timezone is rejected with the stored value unchanged',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('P0001', 'Unknown timezone', UPDATE_SETTINGS, [
          restaurantIds.blueOlive,
          'Mars/Olympus',
        ])
        await expectRpcFailure('P0001', 'A timezone is required.', UPDATE_SETTINGS, [
          restaurantIds.blueOlive,
          '   ',
        ])

        await client.query('set local role postgres')
        const stored = await client.query(`select timezone from public.restaurants where id = $1`, [
          restaurantIds.blueOlive,
        ])
        expect(stored.rows).toEqual([{ timezone: blueOliveSettings.timezone }])
      })
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Owner-only authorization matrix (FR-005/FR-006, SC-002)
// ─────────────────────────────────────────────────────────────────────────────

describe('owner-only authorization matrix for profile and settings (FR-005/FR-006, SC-002)', () => {
  const nonOwners: ReadonlyArray<{
    label: string
    authUserId: string
    profileId: string
  }> = [
    { label: 'branch manager (Bob)', authUserId: authUserIds.bob, profileId: profileIds.bob },
    { label: 'cashier (Carla)', authUserId: authUserIds.carla, profileId: profileIds.carla },
    { label: 'kitchen (Dan)', authUserId: authUserIds.dan, profileId: profileIds.dan },
    {
      label: 'other restaurant owner (Eve, Cedar Grill)',
      authUserId: authUserIds.eve,
      profileId: profileIds.eve,
    },
    {
      label: 'super admin (platform admin)',
      authUserId: authUserIds.platformAdmin,
      profileId: profileIds.platformAdmin,
    },
  ]

  for (const identity of nonOwners) {
    it(
      `${identity.label} is denied 42501 on profile and settings with no state change and no audit record`,
      { timeout: 30_000 },
      async () => {
        await asUser(client, identity.authUserId, async () => {
          await expectRpcFailure('42501', 'do not have permission', UPDATE_PROFILE, [
            restaurantIds.blueOlive,
            'Hijacked',
            'hijacked',
            null,
            null,
            null,
          ])
          await expectRpcFailure('42501', 'do not have permission', UPDATE_SETTINGS, [
            restaurantIds.blueOlive,
            'Europe/Paris',
          ])

          // No state change (through the owner connection, inside the same
          // transaction: a partial write would be visible here) and no audit
          // record for a denied attempt.
          await client.query('set local role postgres')
          const restaurant = await client.query(
            `select name, slug, timezone from public.restaurants where id = $1`,
            [restaurantIds.blueOlive],
          )
          expect(restaurant.rows).toEqual([
            {
              name: blueOliveBaseline.name,
              slug: blueOliveBaseline.slug,
              timezone: blueOliveSettings.timezone,
            },
          ])
          const audit = await client.query(
            `select count(*)::int as n from public.audit_log where actor_profile_id = $1`,
            [identity.profileId],
          )
          expect(audit.rows[0].n).toBe(0)
        })
      },
    )
  }

  it(
    'anon is denied 42501 on both update operations (execute is authenticated-only)',
    { timeout: 30_000 },
    async () => {
      await asAnon(client, async () => {
        await expectRpcFailure('42501', 'permission denied', UPDATE_PROFILE, [
          restaurantIds.blueOlive,
          'Hijacked',
          'hijacked',
          null,
          null,
          null,
        ])
        await expectRpcFailure('42501', 'permission denied', UPDATE_SETTINGS, [
          restaurantIds.blueOlive,
          'Europe/Paris',
        ])
      })
    },
  )

  it(
    'a nonexistent restaurant id is denied 42501 for an owner (no ownership resolves)',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('42501', 'do not have permission', UPDATE_PROFILE, [
          '00000000-0000-4000-8000-00000000dead',
          'X',
          'x',
          null,
          null,
          null,
        ])
        await expectRpcFailure('42501', 'do not have permission', UPDATE_SETTINGS, [
          '00000000-0000-4000-8000-00000000dead',
          'UTC',
        ])
      })
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Public identifier change semantics (FR-004)
// ─────────────────────────────────────────────────────────────────────────────

describe('public identifier change semantics (FR-004)', () => {
  it(
    'an owner changes the identifier: accepted and persisted; the released identifier addresses nothing and is immediately reusable',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const { rows } = await client.query(UPDATE_PROFILE, [
          restaurantIds.blueOlive,
          blueOliveBaseline.name,
          'blue-olive-annex',
          blueOliveSettings.brand_description,
          blueOliveSettings.contact_email,
          blueOliveSettings.contact_phone,
        ])
        expect(rows[0]).toMatchObject({
          id: restaurantIds.blueOlive,
          name: blueOliveBaseline.name,
          slug: 'blue-olive-annex',
        })

        await client.query('set local role postgres')
        // The stored row carries the new identifier; the old identifier is
        // retained or encoded nowhere — no alias, no redirect, no history.
        const byOld = await client.query(
          `select id from public.restaurants where slug = 'blue-olive'`,
        )
        expect(byOld.rows).toEqual([])
        const byNew = await client.query(
          `select id from public.restaurants where slug = 'blue-olive-annex'`,
        )
        expect(byNew.rows).toEqual([{ id: restaurantIds.blueOlive }])

        // The released identifier is immediately reusable — the RPC accepts it
        // for a brand-new restaurant (no retention anywhere).
        await client.query('set local role authenticated')
        const second = await client.query(CREATE, [
          'Olive Again',
          'blue-olive',
          null,
          null,
          null,
          'UTC',
        ])
        const created = second.rows[0] as { id: string; slug: string }
        expect(created.slug).toBe('blue-olive')
        expect(created.id).not.toBe(restaurantIds.blueOlive)
      })
    },
  )

  it(
    'the current identifier is resubmittable and empty optionals clear to NULL',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const { rows } = await client.query(UPDATE_PROFILE, [
          restaurantIds.blueOlive,
          blueOliveBaseline.name,
          blueOliveBaseline.slug,
          '   ',
          '',
          '  ',
        ])
        expect(rows[0]).toMatchObject({
          slug: blueOliveBaseline.slug,
          brand_description: null,
          contact_email: null,
          contact_phone: null,
        })
      })
    },
  )

  it(
    'a blank name, a malformed identifier, and a taken identifier are rejected with the stored row unchanged',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('P0001', 'A restaurant name is required.', UPDATE_PROFILE, [
          restaurantIds.blueOlive,
          '   ',
          blueOliveBaseline.slug,
          null,
          null,
          null,
        ])
        await expectRpcFailure(
          'P0001',
          'lowercase letters, digits, and single hyphens',
          UPDATE_PROFILE,
          [restaurantIds.blueOlive, blueOliveBaseline.name, 'BAD Slug', null, null, null],
        )
        await expectRpcFailure('P0001', 'already in use', UPDATE_PROFILE, [
          restaurantIds.blueOlive,
          blueOliveBaseline.name,
          'cedar-grill',
          null,
          null,
          null,
        ])

        await client.query('set local role postgres')
        const stored = await client.query(
          `select name, slug, brand_description, contact_email, contact_phone, timezone
           from public.restaurants where id = $1`,
          [restaurantIds.blueOlive],
        )
        expect(stored.rows).toEqual([
          {
            name: blueOliveBaseline.name,
            slug: blueOliveBaseline.slug,
            brand_description: blueOliveSettings.brand_description,
            contact_email: blueOliveSettings.contact_email,
            contact_phone: blueOliveSettings.contact_phone,
            timezone: blueOliveSettings.timezone,
          },
        ])
      })
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Restaurant audit records (FR-020, SC-006)
// ─────────────────────────────────────────────────────────────────────────────

describe('restaurant audit records (FR-020, SC-006) — asserted through the owner connection', () => {
  it(
    'create_restaurant writes restaurant.created with actor, action, resource, and tenant scope',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.fiona, async () => {
        const { rows } = await client.query(CREATE, [
          'Audit Bistro',
          'audit-bistro',
          null,
          null,
          null,
          'UTC',
        ])
        const created = rows[0] as { id: string }

        await client.query('set local role postgres')
        const audit = await client.query(
          `select actor_profile_id, action, resource_type, resource_id, reason,
                  restaurant_id, branch_id
           from public.audit_log
           where action = 'restaurant.created' and restaurant_id = $1`,
          [created.id],
        )
        expect(audit.rows).toEqual([
          {
            actor_profile_id: profileIds.fiona,
            action: 'restaurant.created',
            resource_type: 'restaurant',
            resource_id: created.id,
            reason: null,
            restaurant_id: created.id,
            branch_id: null,
          },
        ])
      })
    },
  )

  it(
    'update_restaurant_profile writes restaurant.profile_updated exactly once per accepted call',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await client.query(UPDATE_PROFILE, [
          restaurantIds.blueOlive,
          blueOliveBaseline.name,
          'blue-olive-annex',
          null,
          null,
          null,
        ])

        await client.query('set local role postgres')
        const audit = await client.query(
          `select actor_profile_id, action, resource_type, resource_id, reason,
                  restaurant_id, branch_id
           from public.audit_log where action = 'restaurant.profile_updated'`,
        )
        expect(audit.rows).toEqual([
          {
            actor_profile_id: profileIds.alice,
            action: 'restaurant.profile_updated',
            resource_type: 'restaurant',
            resource_id: restaurantIds.blueOlive,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: null,
          },
        ])
      })
    },
  )

  it(
    'update_restaurant_settings writes restaurant.settings_updated and persists the timezone',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const { rows } = await client.query(UPDATE_SETTINGS, [
          restaurantIds.blueOlive,
          'Europe/Madrid',
        ])
        expect(rows[0]).toMatchObject({ id: restaurantIds.blueOlive, timezone: 'Europe/Madrid' })

        await client.query('set local role postgres')
        const audit = await client.query(
          `select actor_profile_id, action, resource_type, resource_id, reason,
                  restaurant_id, branch_id
           from public.audit_log where action = 'restaurant.settings_updated'`,
        )
        expect(audit.rows).toEqual([
          {
            actor_profile_id: profileIds.alice,
            action: 'restaurant.settings_updated',
            resource_type: 'restaurant',
            resource_id: restaurantIds.blueOlive,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: null,
          },
        ])
      })
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Branch section (spec 004 US2: FR-007, FR-008, FR-009, FR-020, FR-025;
// research.md §2/§3/§7; contracts/database-functions.md "Branch operations")
// ─────────────────────────────────────────────────────────────────────────────

const CREATE_BRANCH = 'select * from public.create_branch($1, $2)'
const RENAME_BRANCH = 'select * from public.rename_branch($1, $2)'
const REPLACE_HOURS = 'select * from public.replace_branch_working_hours($1, $2)'
const INSERT_HOURS = `insert into public.branch_working_hours
    (restaurant_id, branch_id, weekday, open_time, close_time)
  values ($1, $2, $3::public.weekday, $4::time, $5::time)`

/** No branch resolves behind this id: the owner check finds no ownership to grant. */
const UNKNOWN_BRANCH_ID = '00000000-0000-4000-8000-00000000dead'

/** A valid payload — a denied call must fail on AUTHORIZATION, before this is even parsed. */
const VALID_SCHEDULE = JSON.stringify([
  { weekday: 'monday', open_time: '09:00', close_time: '17:00' },
])

const WEEKDAY_ORDER: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const blueOliveHours = seedBranchWorkingHours.filter(
  (row) => row.restaurant_id === restaurantIds.blueOlive,
)
const downtownHours = blueOliveHours.filter((row) => row.branch_id === branchIds.downtown)
const marinaHours = blueOliveHours.filter((row) => row.branch_id === branchIds.marina)
const airportHours = seedBranchWorkingHours.filter((row) => row.branch_id === branchIds.airport)

/** The seeded Blue Olive branches as a policy-scoped read returns them (`order by id`). */
const seededBlueOliveBranches = seedBranches
  .filter((branch) => branch.restaurant_id === restaurantIds.blueOlive)
  .map(({ id, name }) => ({ id, name }))

/** Fixture rows in the order the schedule reads return them: weekday order, then open time. */
function byWeekdayThenOpen<T extends { weekday: Weekday; open_time: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const day = WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday)
    return day !== 0 ? day : a.open_time.localeCompare(b.open_time)
  })
}

/** The fixture rows projected as a `branch_working_hours` read returns them, ordered by branch. */
function projection(rows: readonly SeedBranchWorkingHours[]) {
  return [...rows]
    .sort((a, b) => {
      const branch = a.branch_id.localeCompare(b.branch_id)
      if (branch !== 0) {
        return branch
      }
      const day = WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday)
      return day !== 0 ? day : a.open_time.localeCompare(b.open_time)
    })
    .map(({ branch_id, weekday, open_time, close_time }) => ({
      branch_id,
      weekday,
      open_time,
      close_time,
    }))
}

describe('branch operation authorization matrix (FR-006/FR-007/FR-008/FR-009, SC-002)', () => {
  const nonOwners: ReadonlyArray<{
    label: string
    authUserId: string
    profileId: string
    /**
     * True for every identity but Eve: Cedar Grill is the other tenant, and
     * its Airport branch is denied to Blue Olive's staff. Eve OWNS Cedar
     * Grill, so that target is legitimate for her — asserted as the allowed
     * control below.
     */
    includeOtherTenant: boolean
  }> = [
    {
      label: 'branch manager (Bob, Downtown)',
      authUserId: authUserIds.bob,
      profileId: profileIds.bob,
      includeOtherTenant: true,
    },
    {
      label: 'cashier (Carla, Downtown)',
      authUserId: authUserIds.carla,
      profileId: profileIds.carla,
      includeOtherTenant: true,
    },
    {
      label: 'kitchen (Dan, Marina)',
      authUserId: authUserIds.dan,
      profileId: profileIds.dan,
      includeOtherTenant: true,
    },
    {
      label: 'other restaurant owner (Eve, Cedar Grill)',
      authUserId: authUserIds.eve,
      profileId: profileIds.eve,
      includeOtherTenant: false,
    },
    {
      label: 'super admin (platform admin)',
      authUserId: authUserIds.platformAdmin,
      profileId: profileIds.platformAdmin,
      includeOtherTenant: true,
    },
  ]

  for (const identity of nonOwners) {
    it(
      `${identity.label} is denied 42501 on every branch operation with no state change and no branch audit record`,
      { timeout: 30_000 },
      async () => {
        // Both Blue Olive branches — the identity's own assigned branch is not
        // special: every branch operation is owner-only ("other branch" is any
        // branch at all). Airport joins the list for everyone but its owner.
        const targets = [
          branchIds.downtown,
          branchIds.marina,
          ...(identity.includeOtherTenant ? [branchIds.airport] : []),
        ]

        await asUser(client, identity.authUserId, async () => {
          await expectRpcFailure('42501', 'do not have permission', CREATE_BRANCH, [
            restaurantIds.blueOlive,
            'Hijacked',
          ])
          for (const branchId of targets) {
            await expectRpcFailure('42501', 'do not have permission', RENAME_BRANCH, [
              branchId,
              'Hijacked',
            ])
            await expectRpcFailure('42501', 'do not have permission', REPLACE_HOURS, [
              branchId,
              VALID_SCHEDULE,
            ])
          }
          await expectRpcFailure('42501', 'do not have permission', RENAME_BRANCH, [
            UNKNOWN_BRANCH_ID,
            'Hijacked',
          ])
          await expectRpcFailure('42501', 'do not have permission', REPLACE_HOURS, [
            UNKNOWN_BRANCH_ID,
            VALID_SCHEDULE,
          ])

          // No state change, read through the owner connection inside the same
          // transaction: a partial write would be visible here. The seeded
          // schedule — split day, post-midnight interval, boundary pair — is
          // byte-for-byte the fixture.
          await client.query('set local role postgres')
          const branches = await client.query(
            `select id, name from public.branches where restaurant_id = $1 order by id`,
            [restaurantIds.blueOlive],
          )
          expect(branches.rows).toEqual(seededBlueOliveBranches)
          const hours = await client.query(
            `select branch_id, weekday, open_time, close_time
             from public.branch_working_hours where restaurant_id = $1
             order by branch_id, weekday, open_time`,
            [restaurantIds.blueOlive],
          )
          expect(hours.rows).toEqual(projection(blueOliveHours))
          const cedar = await client.query(
            `select b.name, count(w.id)::int as n
             from public.branches b
             left join public.branch_working_hours w on w.branch_id = b.id
             where b.restaurant_id = $1
             group by b.id, b.name order by b.id`,
            [restaurantIds.cedarGrill],
          )
          expect(cedar.rows).toEqual([{ name: 'Airport', n: airportHours.length }])

          // A denied attempt writes no audit record — the whole branch
          // vocabulary, not just the action the identity was closest to.
          const audit = await client.query(
            `select count(*)::int as n from public.audit_log
             where actor_profile_id = $1 and action like 'branch.%'`,
            [identity.profileId],
          )
          expect(audit.rows[0].n).toBe(0)
        })
      },
    )
  }

  it(
    'anon is denied 42501 on every branch operation (execute is authenticated-only)',
    { timeout: 30_000 },
    async () => {
      await asAnon(client, async () => {
        await expectRpcFailure('42501', 'permission denied', CREATE_BRANCH, [
          restaurantIds.blueOlive,
          'Anon Branch',
        ])
        await expectRpcFailure('42501', 'permission denied', RENAME_BRANCH, [
          branchIds.downtown,
          'Anon Branch',
        ])
        await expectRpcFailure('42501', 'permission denied', REPLACE_HOURS, [
          branchIds.downtown,
          VALID_SCHEDULE,
        ])
      })
    },
  )

  it(
    'the owner of the other restaurant (Eve) may manage her own branch — the denial is ownership-scoped, not blanket (control)',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.eve, async () => {
        const { rows } = await client.query(RENAME_BRANCH, [branchIds.airport, 'Airport Annex'])
        expect(rows[0]).toMatchObject({
          id: branchIds.airport,
          restaurant_id: restaurantIds.cedarGrill,
          name: 'Airport Annex',
        })
      })
    },
  )
})

describe('branch name rules (FR-007, SC-003)', () => {
  it(
    'a blank name is rejected on create and rename, with nothing created or renamed',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('P0001', 'A branch name is required.', CREATE_BRANCH, [
          restaurantIds.blueOlive,
          '   ',
        ])
        await expectRpcFailure('P0001', 'A branch name is required.', CREATE_BRANCH, [
          restaurantIds.blueOlive,
          '',
        ])
        await expectRpcFailure('P0001', 'A branch name is required.', RENAME_BRANCH, [
          branchIds.downtown,
          '   ',
        ])

        await client.query('set local role postgres')
        const branches = await client.query(
          `select id, name from public.branches where restaurant_id = $1 order by id`,
          [restaurantIds.blueOlive],
        )
        expect(branches.rows).toEqual(seededBlueOliveBranches)
        const audit = await client.query(
          `select count(*)::int as n from public.audit_log
           where actor_profile_id = $1 and action like 'branch.%'`,
          [profileIds.alice],
        )
        expect(audit.rows[0].n).toBe(0)
      })
    },
  )

  it(
    'duplicate branch display names remain allowed — a second "Downtown" is created',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const { rows } = await client.query(CREATE_BRANCH, [restaurantIds.blueOlive, 'Downtown'])
        const created = rows[0] as { id: string; restaurant_id: string; name: string }
        expect(created).toMatchObject({
          restaurant_id: restaurantIds.blueOlive,
          name: 'Downtown',
        })
        expect(created.id).not.toBe(branchIds.downtown)

        await client.query('set local role postgres')
        const stored = await client.query(
          `select id from public.branches where restaurant_id = $1 and name = 'Downtown'`,
          [restaurantIds.blueOlive],
        )
        // The seeded Downtown and the duplicate coexist — no uniqueness rule exists.
        expect(new Set(stored.rows.map((row) => row.id))).toEqual(
          new Set([branchIds.downtown, created.id]),
        )
      })
    },
  )
})

describe('working-hours replacement semantics (FR-008/FR-009, SC-003)', () => {
  it(
    'the split day persists, 18:00–02:00 stores under its start day with end_minute >= 1440, a boundary-touching pair is accepted, and rows under different weekdays are not rejected',
    { timeout: 30_000 },
    async () => {
      const schedule = [
        // The split day: lunch + dinner under one weekday.
        { weekday: 'monday', open_time: '11:00', close_time: '15:00' },
        // Post-midnight: closes the following day, stored under Monday it starts on.
        { weekday: 'monday', open_time: '18:00', close_time: '02:00' },
        // Real-time overlap with Monday 18:00–02:00, but a DIFFERENT weekday in
        // the recorded schedule — deliberately not rejected (research.md §3).
        { weekday: 'tuesday', open_time: '01:00', close_time: '03:00' },
        // The boundary-touching pair: half-open ranges share 14:00 legally.
        { weekday: 'saturday', open_time: '10:00', close_time: '14:00' },
        { weekday: 'saturday', open_time: '14:00', close_time: '18:00' },
      ]
      const expected = [
        {
          weekday: 'monday',
          open_time: '11:00:00',
          close_time: '15:00:00',
          start_minute: 660,
          end_minute: 900,
        },
        {
          weekday: 'monday',
          open_time: '18:00:00',
          close_time: '02:00:00',
          start_minute: 1080,
          end_minute: 1560,
        },
        {
          weekday: 'tuesday',
          open_time: '01:00:00',
          close_time: '03:00:00',
          start_minute: 60,
          end_minute: 180,
        },
        {
          weekday: 'saturday',
          open_time: '10:00:00',
          close_time: '14:00:00',
          start_minute: 600,
          end_minute: 840,
        },
        {
          weekday: 'saturday',
          open_time: '14:00:00',
          close_time: '18:00:00',
          start_minute: 840,
          end_minute: 1080,
        },
      ]

      await asUser(client, authUserIds.alice, async () => {
        const returned = await client.query(
          `select weekday, open_time, close_time, start_minute, end_minute
           from public.replace_branch_working_hours($1, $2)`,
          [branchIds.downtown, JSON.stringify(schedule)],
        )
        // The return is the stored schedule (weekday, open_time order) — five
        // rows: the post-midnight interval is ONE row, never split at midnight.
        expect(returned.rows).toEqual(expected)
        const overnight = returned.rows.find((row) => row.open_time === '18:00:00') as {
          weekday: string
          close_time: string
          start_minute: number
          end_minute: number
        }
        expect(overnight).toMatchObject({
          weekday: 'monday',
          close_time: '02:00:00',
          start_minute: 1080,
        })
        expect(overnight.end_minute).toBeGreaterThanOrEqual(1440)

        // The stored rows read identically through the owner connection.
        await client.query('set local role postgres')
        const stored = await client.query(
          `select weekday, open_time, close_time, start_minute, end_minute
           from public.branch_working_hours where branch_id = $1
           order by weekday, open_time`,
          [branchIds.downtown],
        )
        expect(stored.rows).toEqual(expected)

        // The replacement is branch-scoped: Marina's seeded schedule — split
        // pair included — is untouched.
        const marina = await client.query(
          `select count(*)::int as n from public.branch_working_hours where branch_id = $1`,
          [branchIds.marina],
        )
        expect(marina.rows[0].n).toBe(marinaHours.length)
      })
    },
  )

  it(
    'zero-length, same-day-overlapping, and malformed replacements are rejected with the stored schedule unchanged (all-or-nothing)',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // The seeded Downtown schedule is the stored state the rejections must
        // not disturb — the all-or-nothing guarantee under an EXISTING schedule.
        const seeded = byWeekdayThenOpen(downtownHours).map(
          ({ weekday, open_time, close_time }) => ({ weekday, open_time, close_time }),
        )

        await expectRpcFailure(
          'P0001',
          'An interval cannot start and end at the same time.',
          REPLACE_HOURS,
          [
            branchIds.downtown,
            JSON.stringify([{ weekday: 'monday', open_time: '10:00', close_time: '10:00' }]),
          ],
        )
        await expectRpcFailure('P0001', 'Two intervals on the same day overlap.', REPLACE_HOURS, [
          branchIds.downtown,
          JSON.stringify([
            { weekday: 'monday', open_time: '10:00', close_time: '14:00' },
            { weekday: 'monday', open_time: '13:00', close_time: '18:00' },
          ]),
        ])

        await client.query('set local role postgres')
        const afterRejections = await client.query(
          `select weekday, open_time, close_time from public.branch_working_hours
           where branch_id = $1 order by weekday, open_time`,
          [branchIds.downtown],
        )
        expect(afterRejections.rows).toEqual(seeded)

        // A legitimate replacement, then a malformed payload: the NEW stored
        // state survives in full.
        await client.query('set local role authenticated')
        const accepted = await client.query(
          `select weekday, open_time, close_time from public.replace_branch_working_hours($1, $2)`,
          [
            branchIds.downtown,
            JSON.stringify([{ weekday: 'monday', open_time: '09:00', close_time: '17:00' }]),
          ],
        )
        expect(accepted.rows).toEqual([
          { weekday: 'monday', open_time: '09:00:00', close_time: '17:00:00' },
        ])
        await expectRpcFailure(
          'P0001',
          'Working hours must be a list of weekday intervals with HH:MM times.',
          REPLACE_HOURS,
          [
            branchIds.downtown,
            JSON.stringify([
              { weekday: 'monday', open_time: '09:00', close_time: '17:00' },
              { weekday: 'funday', open_time: '09:00', close_time: '17:00' },
            ]),
          ],
        )

        await client.query('set local role postgres')
        const afterMalformed = await client.query(
          `select weekday, open_time, close_time from public.branch_working_hours
           where branch_id = $1`,
          [branchIds.downtown],
        )
        expect(afterMalformed.rows).toEqual([
          { weekday: 'monday', open_time: '09:00:00', close_time: '17:00:00' },
        ])
      })
    },
  )

  it(
    'an empty array clears the branch schedule, leaving the other branches untouched',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const returned = await client.query(REPLACE_HOURS, [branchIds.downtown, JSON.stringify([])])
        expect(returned.rows).toEqual([])

        await client.query('set local role postgres')
        const cleared = await client.query(
          `select count(*)::int as n from public.branch_working_hours where branch_id = $1`,
          [branchIds.downtown],
        )
        expect(cleared.rows[0].n).toBe(0)
        const remaining = await client.query(
          `select branch_id, count(*)::int as n from public.branch_working_hours
           where restaurant_id = $1 group by branch_id order by branch_id`,
          [restaurantIds.blueOlive],
        )
        expect(remaining.rows).toEqual([{ branch_id: branchIds.marina, n: marinaHours.length }])
      })
    },
  )

  it(
    'no client write grant exists and the declarative constraints backstop any other writer (FR-025)',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // The authenticated role holds SELECT only — the RPC is the only write path.
        await expectStatementToFail(client, '42501', INSERT_HOURS, [
          restaurantIds.blueOlive,
          branchIds.marina,
          'wednesday',
          '13:00',
          '14:00',
        ])

        // Any other writer (the migration/seed-level owner connection here):
        // the exclusion constraint rejects the overlap with Marina's seeded
        // Wednesday 12:00–18:00, the check constraint rejects a zero-length
        // row, and a boundary-touching row is accepted — half-open ranges,
        // exactly the RPC's semantics.
        await client.query('set local role postgres')
        await expectStatementToFail(client, '23P01', INSERT_HOURS, [
          restaurantIds.blueOlive,
          branchIds.marina,
          'wednesday',
          '13:00',
          '14:00',
        ])
        await expectStatementToFail(client, '23514', INSERT_HOURS, [
          restaurantIds.blueOlive,
          branchIds.marina,
          'wednesday',
          '10:00',
          '10:00',
        ])
        await client.query(INSERT_HOURS, [
          restaurantIds.blueOlive,
          branchIds.marina,
          'wednesday',
          '23:00',
          '23:30',
        ])
        const { rows } = await client.query(
          `select count(*)::int as n from public.branch_working_hours where branch_id = $1`,
          [branchIds.marina],
        )
        expect(rows[0].n).toBe(marinaHours.length + 1)
      })
    },
  )
})

describe('branch audit records (FR-020, SC-006) — asserted through the owner connection', () => {
  it(
    'branch.created, branch.renamed, and branch.working_hours_updated carry actor, action, resource, tenant, and branch scope',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const created = (
          await client.query(CREATE_BRANCH, [restaurantIds.blueOlive, 'Audit Branch'])
        ).rows[0] as { id: string }
        const renamed = (await client.query(RENAME_BRANCH, [branchIds.downtown, 'Downtown Quay']))
          .rows[0] as { id: string; name: string }
        expect(renamed).toMatchObject({ id: branchIds.downtown, name: 'Downtown Quay' })
        await client.query(REPLACE_HOURS, [
          branchIds.marina,
          JSON.stringify([{ weekday: 'monday', open_time: '09:00', close_time: '17:00' }]),
        ])

        await client.query('set local role postgres')
        const audit = await client.query(
          `select actor_profile_id, action, resource_type, resource_id, reason,
                  restaurant_id, branch_id
           from public.audit_log
           where action in ('branch.created', 'branch.renamed', 'branch.working_hours_updated')
             and restaurant_id = $1
           order by id`,
          [restaurantIds.blueOlive],
        )
        expect(audit.rows).toEqual([
          {
            actor_profile_id: profileIds.alice,
            action: 'branch.created',
            resource_type: 'branch',
            resource_id: created.id,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: created.id,
          },
          {
            actor_profile_id: profileIds.alice,
            action: 'branch.renamed',
            resource_type: 'branch',
            resource_id: branchIds.downtown,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.downtown,
          },
          {
            actor_profile_id: profileIds.alice,
            action: 'branch.working_hours_updated',
            resource_type: 'branch',
            resource_id: branchIds.marina,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.marina,
          },
        ])
      })
    },
  )
})

describe('branch read surface scope (FR-025, SC-002/SC-003)', () => {
  const scopeCases: ReadonlyArray<{
    label: string
    authUserId: string
    hours: ReadonlyArray<{ branch_id: string; n: number }>
    branches: number
  }> = [
    {
      label: 'the owner (Alice) reads every branch of the restaurant she owns',
      authUserId: authUserIds.alice,
      hours: [
        { branch_id: branchIds.downtown, n: downtownHours.length },
        { branch_id: branchIds.marina, n: marinaHours.length },
      ],
      branches: 2,
    },
    {
      label: 'a branch manager (Bob, Downtown) reads only his assigned branch',
      authUserId: authUserIds.bob,
      hours: [{ branch_id: branchIds.downtown, n: downtownHours.length }],
      branches: 1,
    },
    {
      label: 'a kitchen member (Dan, Marina) reads only his assigned branch',
      authUserId: authUserIds.dan,
      hours: [{ branch_id: branchIds.marina, n: marinaHours.length }],
      branches: 1,
    },
    {
      label:
        'the other-restaurant owner and Downtown cashier (Eve) reads exactly her owned and assigned branches — never Marina',
      authUserId: authUserIds.eve,
      hours: [
        { branch_id: branchIds.downtown, n: downtownHours.length },
        { branch_id: branchIds.airport, n: airportHours.length },
      ],
      branches: 2,
    },
    {
      label: 'the super admin reads nothing — the capability grants no tenant access (FR-021)',
      authUserId: authUserIds.platformAdmin,
      hours: [],
      branches: 0,
    },
  ]

  for (const scopeCase of scopeCases) {
    it(scopeCase.label, { timeout: 30_000 }, async () => {
      await asUser(client, scopeCase.authUserId, async () => {
        const hours = await client.query(
          `select branch_id, count(*)::int as n from public.branch_working_hours
           group by branch_id order by branch_id`,
        )
        expect(hours.rows).toEqual(scopeCase.hours)
        const branches = await client.query(`select count(*)::int as n from public.branches`)
        expect(branches.rows[0].n).toBe(scopeCase.branches)
      })
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Table section (spec 004 US3: FR-010, FR-011, FR-012, FR-020;
// research.md §11; contracts/database-functions.md "Table operations")
// ─────────────────────────────────────────────────────────────────────────────

const CREATE_TABLE = 'select * from public.create_dining_table($1, $2)'
const RENAME_TABLE = 'select * from public.rename_dining_table($1, $2)'
const SET_TABLE_ACTIVE = 'select * from public.set_dining_table_active($1, $2)'

/** No table resolves behind this id: the ownership check grants nothing. */
const UNKNOWN_TABLE_ID = '00000000-0000-4000-8000-00000000dead'

/** The seeded activation state, keyed for lookup (fixtures are the source of truth). */
const activationById: ReadonlyMap<string, boolean> = new Map(
  seedDiningTableActivation.map((row) => [row.id, row.is_active] as const),
)

/**
 * A table's seeded activation state. The throw is the point: a table added to
 * `seedDiningTables` without an activation entry fails loudly here rather than
 * silently comparing against `undefined`.
 */
function seededActivationOf(id: string): boolean {
  const active = activationById.get(id)
  if (active === undefined) {
    throw new Error(`missing activation fixture for dining table ${id}`)
  }
  return active
}

/** The seeded tables of a branch as a policy-scoped read returns them (`order by label`). */
function seededTablesOf(branchId: string) {
  return seedDiningTables
    .filter((table) => table.branch_id === branchId)
    .map(({ id, label }) => ({ id, label, is_active: seededActivationOf(id) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

const downtownSeededTables = seededTablesOf(branchIds.downtown)
const marinaSeededTables = seededTablesOf(branchIds.marina)

/** Every seeded table row, ordered as the owner connection returns them. */
const allSeededTables = seedDiningTables
  .map(({ id, restaurant_id, branch_id, label }) => ({
    id,
    restaurant_id,
    branch_id,
    label,
    is_active: seededActivationOf(id),
  }))
  .sort((a, b) => a.id.localeCompare(b.id))

describe('table operation authorization matrix (FR-006/FR-010/FR-011/FR-012, SC-002)', () => {
  const nonOwners: ReadonlyArray<{
    label: string
    authUserId: string
    profileId: string
    /** False only for Eve: Airport is Cedar Grill's, and she owns that restaurant. */
    includeOtherTenant: boolean
  }> = [
    {
      label: 'branch manager (Bob, Downtown)',
      authUserId: authUserIds.bob,
      profileId: profileIds.bob,
      includeOtherTenant: true,
    },
    {
      label: 'cashier (Carla, Downtown)',
      authUserId: authUserIds.carla,
      profileId: profileIds.carla,
      includeOtherTenant: true,
    },
    {
      label: 'kitchen (Dan, Marina)',
      authUserId: authUserIds.dan,
      profileId: profileIds.dan,
      includeOtherTenant: true,
    },
    {
      label: 'other restaurant owner (Eve, Cedar Grill)',
      authUserId: authUserIds.eve,
      profileId: profileIds.eve,
      includeOtherTenant: false,
    },
    {
      label: 'super admin (platform admin)',
      authUserId: authUserIds.platformAdmin,
      profileId: profileIds.platformAdmin,
      includeOtherTenant: true,
    },
  ]

  for (const identity of nonOwners) {
    it(
      `${identity.label} is denied 42501 on every table operation with no state change and no table audit record`,
      { timeout: 30_000 },
      async () => {
        // Every branch of the tenant is targeted — a branch-scoped identity's
        // own branch is not special, and Airport joins for everyone but its
        // owner. The call must fail on AUTHORIZATION before the label is read.
        const branches = [
          branchIds.downtown,
          branchIds.marina,
          ...(identity.includeOtherTenant ? [branchIds.airport] : []),
        ]

        await asUser(client, identity.authUserId, async () => {
          for (const branchId of branches) {
            await expectRpcFailure('42501', 'do not have permission', CREATE_TABLE, [
              branchId,
              'Hijacked',
            ])
          }
          for (const tableId of [
            diningTableIds.downtownT1,
            diningTableIds.marinaT1,
            ...(identity.includeOtherTenant ? [diningTableIds.airportT1] : []),
          ]) {
            await expectRpcFailure('42501', 'do not have permission', RENAME_TABLE, [
              tableId,
              'Hijacked',
            ])
            await expectRpcFailure('42501', 'do not have permission', SET_TABLE_ACTIVE, [
              tableId,
              false,
            ])
          }
          await expectRpcFailure('42501', 'do not have permission', CREATE_TABLE, [
            UNKNOWN_BRANCH_ID,
            'Hijacked',
          ])
          await expectRpcFailure('42501', 'do not have permission', RENAME_TABLE, [
            UNKNOWN_TABLE_ID,
            'Hijacked',
          ])
          await expectRpcFailure('42501', 'do not have permission', SET_TABLE_ACTIVE, [
            UNKNOWN_TABLE_ID,
            false,
          ])

          // No state change — including the seeded inactive table, which a
          // denied activation attempt must not flip — and no audit record.
          await client.query('set local role postgres')
          const tables = await client.query(
            `select id, restaurant_id, branch_id, label, is_active
             from public.dining_tables order by id`,
          )
          expect(tables.rows).toEqual(allSeededTables)
          const audit = await client.query(
            `select count(*)::int as n from public.audit_log
             where actor_profile_id = $1 and action like 'table.%'`,
            [identity.profileId],
          )
          expect(audit.rows[0].n).toBe(0)
        })
      },
    )
  }

  it(
    'anon is denied 42501 on every table operation (execute is authenticated-only)',
    { timeout: 30_000 },
    async () => {
      await asAnon(client, async () => {
        await expectRpcFailure('42501', 'permission denied', CREATE_TABLE, [
          branchIds.downtown,
          'Anon Table',
        ])
        await expectRpcFailure('42501', 'permission denied', RENAME_TABLE, [
          diningTableIds.downtownT1,
          'Anon Table',
        ])
        await expectRpcFailure('42501', 'permission denied', SET_TABLE_ACTIVE, [
          diningTableIds.downtownT1,
          false,
        ])
      })
    },
  )

  it(
    'the owner of the other restaurant (Eve) may manage her own branch table — the denial is ownership-scoped (control)',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.eve, async () => {
        const { rows } = await client.query(SET_TABLE_ACTIVE, [diningTableIds.airportT1, false])
        expect(rows[0]).toMatchObject({
          id: diningTableIds.airportT1,
          restaurant_id: restaurantIds.cedarGrill,
          branch_id: branchIds.airport,
          is_active: false,
        })
      })
    },
  )
})

describe('table label and state rules (FR-010/FR-011/FR-012, SC-003)', () => {
  it(
    'a blank label is rejected on create and rename, with nothing created or renamed',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('P0001', 'A table label is required.', CREATE_TABLE, [
          branchIds.downtown,
          '   ',
        ])
        await expectRpcFailure('P0001', 'A table label is required.', CREATE_TABLE, [
          branchIds.downtown,
          '',
        ])
        await expectRpcFailure('P0001', 'A table label is required.', RENAME_TABLE, [
          diningTableIds.downtownT1,
          '   ',
        ])

        await client.query('set local role postgres')
        const tables = await client.query(
          `select id, label, is_active from public.dining_tables where branch_id = $1 order by label`,
          [branchIds.downtown],
        )
        expect(tables.rows).toEqual(downtownSeededTables)
        const audit = await client.query(
          `select count(*)::int as n from public.audit_log
           where actor_profile_id = $1 and action like 'table.%'`,
          [profileIds.alice],
        )
        expect(audit.rows[0].n).toBe(0)
      })
    },
  )

  it(
    'labels are unique within a branch (duplicate rejected) and the same label is allowed in another branch',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // Downtown already holds T1 — a second one in the SAME branch is
        // rejected by the per-branch uniqueness rule.
        await expectRpcFailure('P0001', 'already in use in this branch', CREATE_TABLE, [
          branchIds.downtown,
          'T1',
        ])

        // Downtown's T2 does not exist in Marina — the same label in ANOTHER
        // branch is legal (the uniqueness rule is per branch, not per
        // restaurant).
        const { rows } = await client.query(CREATE_TABLE, [branchIds.marina, 'T2'])
        const created = rows[0] as { id: string; branch_id: string; label: string }
        expect(created).toMatchObject({ branch_id: branchIds.marina, label: 'T2' })

        await client.query('set local role postgres')
        const stored = await client.query(
          `select id from public.dining_tables where branch_id = $1 and label = 'T2'`,
          [branchIds.marina],
        )
        expect(stored.rows).toEqual([{ id: created.id }])
        // Downtown's own T2 is untouched by the same label existing elsewhere.
        const downtownT2 = await client.query(
          `select id from public.dining_tables where branch_id = $1 and label = 'T2'`,
          [branchIds.downtown],
        )
        expect(downtownT2.rows).toEqual([{ id: diningTableIds.downtownT2 }])
      })
    },
  )

  it(
    'a created table is active by default, renaming works while inactive, and no delete path exists',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const created = (await client.query(CREATE_TABLE, [branchIds.marina, 'Patio'])).rows[0] as {
          id: string
          label: string
          is_active: boolean
        }
        expect(created).toMatchObject({ label: 'Patio', is_active: true })

        // The seeded inactive table renames without changing its state
        // (FR-011: rename/renumber applies regardless of activation).
        const renamed = (await client.query(RENAME_TABLE, [diningTableIds.marinaT1, 'M1']))
          .rows[0] as { id: string; label: string; is_active: boolean }
        expect(renamed).toMatchObject({
          id: diningTableIds.marinaT1,
          label: 'M1',
          is_active: false,
        })

        await client.query('set local role postgres')
        const stored = await client.query(
          `select id, label, is_active from public.dining_tables where branch_id = $1 order by label`,
          [branchIds.marina],
        )
        // Both rows survive: the inactive seeded table still exists (state
        // preserved) and the new one arrived active — nothing is ever deleted.
        expect(stored.rows).toEqual([
          { id: renamed.id, label: 'M1', is_active: false },
          { id: created.id, label: 'Patio', is_active: true },
        ])
      })
    },
  )

  it(
    'repeated activation transitions are no-ops: consistent state, and only an actual change writes an audit record',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // Deactivating an already-inactive table changes nothing (FR-011).
        const unchanged = (await client.query(SET_TABLE_ACTIVE, [diningTableIds.marinaT1, false]))
          .rows[0] as { id: string; is_active: boolean }
        expect(unchanged).toMatchObject({ id: diningTableIds.marinaT1, is_active: false })

        await client.query('set local role postgres')
        const noOpAudit = await client.query(
          `select count(*)::int as n from public.audit_log
           where actor_profile_id = $1 and action in ('table.activated', 'table.deactivated')`,
          [profileIds.alice],
        )
        expect(noOpAudit.rows[0].n).toBe(0)

        // The actual transition does write exactly one record.
        await client.query('set local role authenticated')
        const activated = (await client.query(SET_TABLE_ACTIVE, [diningTableIds.marinaT1, true]))
          .rows[0] as { id: string; is_active: boolean }
        expect(activated).toMatchObject({ id: diningTableIds.marinaT1, is_active: true })

        await client.query('set local role postgres')
        const audit = await client.query(
          `select actor_profile_id, action, resource_type, resource_id, reason,
                  restaurant_id, branch_id
           from public.audit_log
           where action in ('table.activated', 'table.deactivated')`,
        )
        expect(audit.rows).toEqual([
          {
            actor_profile_id: profileIds.alice,
            action: 'table.activated',
            resource_type: 'dining_table',
            resource_id: diningTableIds.marinaT1,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.marina,
          },
        ])
      })
    },
  )
})

describe('table audit records (FR-020, SC-006) — asserted through the owner connection', () => {
  it(
    'table.created, table.renamed, table.activated, and table.deactivated carry actor, tenant, and branch scope',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const created = (await client.query(CREATE_TABLE, [branchIds.downtown, 'Audit Table']))
          .rows[0] as { id: string }
        await client.query(RENAME_TABLE, [created.id, 'Audit Table 2'])
        await client.query(SET_TABLE_ACTIVE, [created.id, false])
        await client.query(SET_TABLE_ACTIVE, [created.id, true])

        await client.query('set local role postgres')
        const audit = await client.query(
          `select actor_profile_id, action, resource_type, resource_id, reason,
                  restaurant_id, branch_id
           from public.audit_log
           where resource_id = $1 and action like 'table.%'
           order by id`,
          [created.id],
        )
        expect(audit.rows).toEqual([
          {
            actor_profile_id: profileIds.alice,
            action: 'table.created',
            resource_type: 'dining_table',
            resource_id: created.id,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.downtown,
          },
          {
            actor_profile_id: profileIds.alice,
            action: 'table.renamed',
            resource_type: 'dining_table',
            resource_id: created.id,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.downtown,
          },
          {
            actor_profile_id: profileIds.alice,
            action: 'table.deactivated',
            resource_type: 'dining_table',
            resource_id: created.id,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.downtown,
          },
          {
            actor_profile_id: profileIds.alice,
            action: 'table.activated',
            resource_type: 'dining_table',
            resource_id: created.id,
            reason: null,
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.downtown,
          },
        ])
      })
    },
  )
})

describe('table read surface scope (FR-012/FR-025, SC-002/SC-007)', () => {
  const scopeCases: ReadonlyArray<{
    label: string
    authUserId: string
    tables: ReadonlyArray<{ id: string; label: string; is_active: boolean }>
  }> = [
    {
      label:
        'the owner (Alice) reads every table of her restaurant, seeded inactive state included',
      authUserId: authUserIds.alice,
      tables: [...downtownSeededTables, ...marinaSeededTables].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    },
    {
      label: 'a branch manager (Bob, Downtown) reads exactly his branch tables',
      authUserId: authUserIds.bob,
      tables: downtownSeededTables,
    },
    {
      label: 'a kitchen member (Dan, Marina) reads the seeded inactive Marina table as inactive',
      authUserId: authUserIds.dan,
      tables: marinaSeededTables,
    },
    {
      label: 'the super admin reads no table — the capability grants no tenant access (FR-021)',
      authUserId: authUserIds.platformAdmin,
      tables: [],
    },
  ]

  for (const scopeCase of scopeCases) {
    it(scopeCase.label, { timeout: 30_000 }, async () => {
      await asUser(client, scopeCase.authUserId, async () => {
        const tables = await client.query(
          `select id, label, is_active from public.dining_tables order by id`,
        )
        expect(tables.rows).toEqual(scopeCase.tables)
      })
    })
  }

  it(
    'a branch-scoped member of another branch reads nothing — the out-of-scope branch yields no rows',
    { timeout: 30_000 },
    async () => {
      await asUser(client, authUserIds.bob, async () => {
        const marina = await client.query(
          `select id from public.dining_tables where branch_id = $1`,
          [branchIds.marina],
        )
        expect(marina.rows).toEqual([])
      })
    },
  )
})
