import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDbClient, inTransaction, runAs } from './helpers/db'
import {
  authUserIds,
  branchIds,
  diningTableIds,
  membershipIds,
  profileIds,
  restaurantIds,
} from './helpers/fixtures'

/**
 * Role-aware access-boundary matrix (spec 003 US2; FR-006/FR-007/FR-009/
 * FR-011/FR-012; SC-003 — FR-020(b)).
 *
 * Direct database access with the real seeded identity ids (equal to the
 * deterministic auth UUIDs — the simulation helpers of helpers/db.ts are
 * unchanged from Phase 1): every statement runs as the `authenticated`
 * Postgres role with `request.jwt.claims` set, inside transactions that are
 * ALWAYS rolled back, so the shared cloud development database keeps no test
 * residue.
 *
 * Preconditions: migrated + seeded cloud dev DB.
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

async function visibleIds(table: string, where = ''): Promise<string[]> {
  const { rows } = await client.query(`select id from public.${table} ${where} order by id`)
  return rows.map((r) => r.id as string)
}

/** Blue Olive's full staff list (memberships + linked profiles), sorted. */
const BLUE_OLIVE_MEMBERSHIPS = [
  membershipIds.aliceOwnerBlueOlive,
  membershipIds.bobManagerDowntown,
  membershipIds.carlaCashierDowntown,
  membershipIds.danKitchenMarina,
  membershipIds.eveCashierDowntown,
]

const BLUE_OLIVE_PROFILES = [
  profileIds.alice,
  profileIds.bob,
  profileIds.carla,
  profileIds.dan,
  profileIds.eve,
]

describe('staff-list visibility follows the role matrix (FR-007)', () => {
  it(
    'Alice (owner, Blue Olive) reads the full Blue Olive staff list',
    { timeout: 20_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        expect(await visibleIds('staff_memberships')).toEqual(BLUE_OLIVE_MEMBERSHIPS)
        expect(await visibleIds('profiles')).toEqual(BLUE_OLIVE_PROFILES)
      })
    },
  )

  it(
    'Bob (branch manager, Downtown) reads the full Blue Olive staff list',
    { timeout: 20_000 },
    async () => {
      await asUser(client, authUserIds.bob, async () => {
        expect(await visibleIds('staff_memberships')).toEqual(BLUE_OLIVE_MEMBERSHIPS)
        expect(await visibleIds('profiles')).toEqual(BLUE_OLIVE_PROFILES)
      })
    },
  )

  it(
    'Carla (cashier) is denied the staff list — only her own row and profile',
    { timeout: 20_000 },
    async () => {
      await asUser(client, authUserIds.carla, async () => {
        expect(await visibleIds('staff_memberships')).toEqual([membershipIds.carlaCashierDowntown])
        expect(await visibleIds('profiles')).toEqual([profileIds.carla])
        // Crafted direct queries for other member rows return nothing —
        // denied by policy, not by UI.
        expect(
          await visibleIds('staff_memberships', `where id = '${membershipIds.bobManagerDowntown}'`),
        ).toEqual([])
        expect(await visibleIds('profiles', `where id = '${profileIds.bob}'`)).toEqual([])
      })
    },
  )

  it(
    'Dan (kitchen) is denied the staff list — only his own row and profile',
    { timeout: 20_000 },
    async () => {
      await asUser(client, authUserIds.dan, async () => {
        expect(await visibleIds('staff_memberships')).toEqual([membershipIds.danKitchenMarina])
        expect(await visibleIds('profiles')).toEqual([profileIds.dan])
      })
    },
  )

  it(
    'Eve reads the Cedar Grill staff list (owner) but not the Blue Olive one (cashier)',
    { timeout: 20_000 },
    async () => {
      await asUser(client, authUserIds.eve, async () => {
        // Own rows (both memberships) + Cedar Grill rows — Cedar Grill
        // only membership is her own, so exactly her two rows.
        expect(await visibleIds('staff_memberships')).toEqual([
          membershipIds.eveOwnerCedarGrill,
          membershipIds.eveCashierDowntown,
        ])
        // A crafted direct query for Blue Olive's staff list returns only her
        // own Blue Olive row — never the other members rows.
        expect(
          await visibleIds(
            'staff_memberships',
            `where restaurant_id = '${restaurantIds.blueOlive}'`,
          ),
        ).toEqual([membershipIds.eveCashierDowntown])
        // No other member's profile is reachable.
        expect(await visibleIds('profiles')).toEqual([profileIds.eve])
      })
    },
  )
})

describe('profiles read rules: own profile plus managed members only (FR-007/FR-011)', () => {
  it(
    'a manager reads managed member profiles, never anyone else',
    { timeout: 20_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // Managed members of Blue Olive — not the platform admin (no
        // membership there, and is_super_admin grants nothing).
        expect(await visibleIds('profiles')).toEqual(BLUE_OLIVE_PROFILES)
        expect(await visibleIds('profiles', `where id = '${profileIds.platformAdmin}'`)).toEqual([])
      })
    },
  )

  it('every staff member reads their own profile', { timeout: 20_000 }, async () => {
    const ownProfileCases: ReadonlyArray<{
      identity: keyof typeof authUserIds
      profile: string
    }> = [
      { identity: 'alice', profile: profileIds.alice },
      { identity: 'bob', profile: profileIds.bob },
      { identity: 'carla', profile: profileIds.carla },
      { identity: 'dan', profile: profileIds.dan },
      { identity: 'eve', profile: profileIds.eve },
    ]
    for (const { identity, profile } of ownProfileCases) {
      await asUser(client, authUserIds[identity], async () => {
        expect(await visibleIds('profiles', `where id = '${profile}'`)).toEqual([profile])
      })
    }
  })
})

describe('membership removal ends access on the next statement (FR-006)', () => {
  // Hand-rolled inside ONE rolled-back transaction: the removal must happen
  // between two reads of the same session, so runAs's per-block transactions
  // cannot be used. Role switching back to the table owner (the migration
  // role the connection carries) performs the delete; the identity under test
  // is re-assumed for the post-removal reads.
  it(
    'Eve loses Blue Olive the moment her cashier membership is deleted; Cedar Grill stays',
    { timeout: 30_000 },
    async () => {
      await inTransaction(client, async () => {
        const actAsEve = async () => {
          await client.query('set local role authenticated')
          await client.query('select set_config($1, $2, true)', [
            'request.jwt.claims',
            JSON.stringify({ role: 'authenticated', sub: authUserIds.eve }),
          ])
        }

        // Baseline: the union of both scopes.
        await actAsEve()
        expect(await visibleIds('restaurants')).toEqual([
          restaurantIds.blueOlive,
          restaurantIds.cedarGrill,
        ])
        expect(await visibleIds('dining_tables')).toEqual([
          diningTableIds.downtownT1,
          diningTableIds.downtownT2,
          diningTableIds.downtownT3,
          diningTableIds.airportT1,
        ])

        // Remove the Blue Olive membership as the data owner.
        await client.query('set local role postgres')
        const { rowCount } = await client.query(
          'delete from public.staff_memberships where id = $1',
          [membershipIds.eveCashierDowntown],
        )
        expect(rowCount).toBe(1)

        // Next statement, same transaction: policies read live rows — no
        // cache, no lag. Blue Olive is gone; Cedar Grill remains.
        await actAsEve()
        expect(await visibleIds('restaurants')).toEqual([restaurantIds.cedarGrill])
        expect(await visibleIds('branches')).toEqual([branchIds.airport])
        expect(await visibleIds('dining_tables')).toEqual([diningTableIds.airportT1])
        expect(await visibleIds('staff_memberships')).toEqual([membershipIds.eveOwnerCedarGrill])
      })
    },
  )
})

describe('forged credential claims grant nothing (FR-009, SC-003)', () => {
  it(
    'an injected app_role "owner" and resto_scope claims leave the cashier exactly where she was',
    { timeout: 20_000 },
    async () => {
      // No policy reads claims beyond auth.uid() — extra claim keys are inert
      // data. The simulation injects them exactly like a forged token would.
      await runAs(
        client,
        'authenticated',
        {
          sub: authUserIds.carla,
          app_role: 'owner',
          resto_scope: [restaurantIds.blueOlive, restaurantIds.cedarGrill],
        },
        async () => {
          // Still the cashier's shape: own row and profile only — the staff
          // list stays denied despite the forged "owner" claim.
          expect(await visibleIds('staff_memberships')).toEqual([
            membershipIds.carlaCashierDowntown,
          ])
          expect(await visibleIds('profiles')).toEqual([profileIds.carla])
          // No scope widening either: Marina (other branch) and Cedar Grill
          // (other restaurant) remain invisible.
          expect(await visibleIds('branches')).toEqual([branchIds.downtown])
          expect(await visibleIds('restaurants')).toEqual([restaurantIds.blueOlive])
        },
      )
    },
  )

  it(
    'forged claims on the super-admin identity still grant no restaurant data',
    { timeout: 20_000 },
    async () => {
      await runAs(
        client,
        'authenticated',
        {
          sub: authUserIds.platformAdmin,
          app_role: 'owner',
          resto_scope: [restaurantIds.blueOlive, restaurantIds.cedarGrill],
        },
        async () => {
          expect(await visibleIds('restaurants')).toEqual([])
          expect(await visibleIds('staff_memberships')).toEqual([])
          expect(await visibleIds('profiles')).toEqual([profileIds.platformAdmin])
        },
      )
    },
  )
})

describe('super admin reads zero restaurant tenant data (FR-012)', () => {
  it(
    'is_super_admin with no memberships grants no tenant rows — only the own-profile arm',
    { timeout: 20_000 },
    async () => {
      await asUser(client, authUserIds.platformAdmin, async () => {
        expect(await visibleIds('restaurants')).toEqual([])
        expect(await visibleIds('branches')).toEqual([])
        expect(await visibleIds('dining_tables')).toEqual([])
        expect(await visibleIds('staff_memberships')).toEqual([])
        expect(await visibleIds('profiles')).toEqual([profileIds.platformAdmin])
      })
    },
  )
})

describe('baseline: own restaurant record and own membership rows (FR-007/FR-011)', () => {
  it(
    'every staff member still reads the own restaurant record and the own membership rows',
    { timeout: 30_000 },
    async () => {
      const baselineCases: ReadonlyArray<{
        identity: keyof typeof authUserIds
        restaurants: string[]
        memberships: string[]
      }> = [
        {
          identity: 'alice',
          restaurants: [restaurantIds.blueOlive],
          memberships: [membershipIds.aliceOwnerBlueOlive],
        },
        {
          identity: 'bob',
          restaurants: [restaurantIds.blueOlive],
          memberships: [membershipIds.bobManagerDowntown],
        },
        {
          identity: 'carla',
          restaurants: [restaurantIds.blueOlive],
          memberships: [membershipIds.carlaCashierDowntown],
        },
        {
          identity: 'dan',
          restaurants: [restaurantIds.blueOlive],
          memberships: [membershipIds.danKitchenMarina],
        },
        {
          identity: 'eve',
          restaurants: [restaurantIds.blueOlive, restaurantIds.cedarGrill],
          memberships: [membershipIds.eveOwnerCedarGrill, membershipIds.eveCashierDowntown],
        },
      ]
      for (const { identity, restaurants, memberships } of baselineCases) {
        await asUser(client, authUserIds[identity], async () => {
          expect(await visibleIds('restaurants')).toEqual(restaurants)
          // Own membership rows are always reachable (self-knowledge).
          for (const membership of memberships) {
            expect(await visibleIds('staff_memberships', `where id = '${membership}'`)).toEqual([
              membership,
            ])
          }
        })
      }
    },
  )
})
