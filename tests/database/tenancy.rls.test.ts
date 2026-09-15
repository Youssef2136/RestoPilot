import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asUser, createDbClient, expectStatementToFail } from './helpers/db'
import {
  authUserIds,
  branchIds,
  diningTableIds,
  membershipIds,
  restaurantIds,
} from './helpers/fixtures'

/**
 * Tenant-isolation matrix (spec 002 US2, FR-008..FR-011; master plan §12
 * required security tests).
 *
 * These tests ARE direct database access: they run as the same Postgres roles
 * with the same JWT claims the data API uses for real requests, so anything
 * they prove holds for every access path (research.md §1).
 *
 * Preconditions: migrated + seeded cloud dev DB. All statements run inside
 * rolled-back transactions.
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

const TENANT_TABLES = [
  'restaurants',
  'branches',
  'profiles',
  'staff_memberships',
  'dining_tables',
] as const

/** Tables staff may read (grant + policy); profiles has no client grants. */
const READABLE_TABLES = TENANT_TABLES.filter((t) => t !== 'profiles')

const UNKNOWN_AUTH_USER = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

async function visibleIds(table: string, where = ''): Promise<string[]> {
  const { rows } = await client.query(`select id from public.${table} ${where} order by id`)
  return rows.map((r) => r.id as string)
}

describe('unauthenticated access is denied everywhere (FR-008, US2 scenario 4)', () => {
  it('anon cannot select any tenancy table (42501, grant-level denial)', async () => {
    await asAnon(client, async () => {
      for (const table of TENANT_TABLES) {
        await expectStatementToFail(client, '42501', `select * from public.${table}`)
      }
    })
  })
})

describe('unknown authenticated identity sees nothing (deny-by-default)', () => {
  it('all readable tables return zero rows; profiles stays grant-denied', async () => {
    await asUser(client, UNKNOWN_AUTH_USER, async () => {
      for (const table of READABLE_TABLES) {
        expect(await visibleIds(table)).toEqual([])
      }
      await expectStatementToFail(client, '42501', 'select * from public.profiles')
    })
  }, 20000)
})

describe('restaurant scope (FR-011a cross-restaurant + positive owner path)', () => {
  it('Alice (owner, Blue Olive) sees only her restaurant and all of its branches', async () => {
    await asUser(client, authUserIds.alice, async () => {
      expect(await visibleIds('restaurants')).toEqual([restaurantIds.blueOlive])
      expect(await visibleIds('branches')).toEqual([branchIds.downtown, branchIds.marina])
      expect(await visibleIds('staff_memberships')).toEqual([
        membershipIds.aliceOwnerBlueOlive,
        membershipIds.bobManagerDowntown,
        membershipIds.carlaCashierDowntown,
        membershipIds.danKitchenMarina,
        membershipIds.eveCashierDowntown,
      ])
      expect(await visibleIds('dining_tables')).toEqual([
        diningTableIds.downtownT1,
        diningTableIds.downtownT2,
        diningTableIds.downtownT3,
        diningTableIds.marinaT1,
      ])
      // Crafted direct query for the other tenant returns nothing.
      expect(await visibleIds('restaurants', `where id = '${restaurantIds.cedarGrill}'`)).toEqual(
        [],
      )
    })
  })
})

describe('branch scope (FR-011b cross-branch + positive branch-staff path)', () => {
  it('Bob (branch manager, Downtown) sees only Downtown within Blue Olive', async () => {
    await asUser(client, authUserIds.bob, async () => {
      expect(await visibleIds('restaurants')).toEqual([restaurantIds.blueOlive])
      expect(await visibleIds('branches')).toEqual([branchIds.downtown])
      // Memberships are restaurant-scoped: visible to all staff of the restaurant.
      expect(await visibleIds('staff_memberships')).toHaveLength(5)
      expect(await visibleIds('dining_tables')).toEqual([
        diningTableIds.downtownT1,
        diningTableIds.downtownT2,
        diningTableIds.downtownT3,
      ])
      // The other branch of the same restaurant is invisible, even by direct query.
      expect(await visibleIds('branches', `where id = '${branchIds.marina}'`)).toEqual([])
      expect(await visibleIds('dining_tables', `where branch_id = '${branchIds.marina}'`)).toEqual(
        [],
      )
    })
  })

  it('Carla (cashier, Downtown) has the same branch-limited shape as Bob', async () => {
    await asUser(client, authUserIds.carla, async () => {
      expect(await visibleIds('branches')).toEqual([branchIds.downtown])
      expect(await visibleIds('dining_tables')).toHaveLength(3)
    })
  })

  it('Dan (kitchen, Marina) sees only Marina within Blue Olive', async () => {
    await asUser(client, authUserIds.dan, async () => {
      expect(await visibleIds('branches')).toEqual([branchIds.marina])
      expect(await visibleIds('dining_tables')).toEqual([diningTableIds.marinaT1])
    })
  })
})

describe('multi-restaurant member (Clarifications 2026-09-15, US2 scenario 8)', () => {
  it('Eve (owner of Cedar Grill + cashier at Downtown) sees exactly the union of her scopes', async () => {
    await asUser(client, authUserIds.eve, async () => {
      expect(await visibleIds('restaurants')).toEqual([
        restaurantIds.blueOlive,
        restaurantIds.cedarGrill,
      ])
      // Downtown through her Blue Olive membership, Airport through ownership —
      // never Marina (her Blue Olive membership is branch-scoped to Downtown).
      expect(await visibleIds('branches')).toEqual([branchIds.downtown, branchIds.airport])
      expect(await visibleIds('staff_memberships')).toHaveLength(6)
      expect(await visibleIds('dining_tables')).toEqual([
        diningTableIds.downtownT1,
        diningTableIds.downtownT2,
        diningTableIds.downtownT3,
        diningTableIds.airportT1,
      ])
      expect(await visibleIds('branches', `where id = '${branchIds.marina}'`)).toEqual([])
      expect(await visibleIds('dining_tables', `where branch_id = '${branchIds.marina}'`)).toEqual(
        [],
      )
    })
  })
})

describe('modeled-only super-admin grants nothing (FR-004, US2 scenario 9)', () => {
  it('Platform Admin (is_super_admin, no memberships) sees zero rows everywhere', async () => {
    await asUser(client, authUserIds.platformAdmin, async () => {
      for (const table of READABLE_TABLES) {
        expect(await visibleIds(table)).toEqual([])
      }
      await expectStatementToFail(client, '42501', 'select * from public.profiles')
    })
  })
})

describe('client-role writes are denied by grants on every table (FR-008)', () => {
  it('authenticated staff cannot insert, update, or delete anything', async () => {
    const writeStatements = [
      `insert into public.restaurants (name, slug) values ('Evil', 'evil-restaurant')`,
      `update public.restaurants set name = 'Evil'`,
      `delete from public.restaurants`,
      `insert into public.branches (restaurant_id, name) values ('${restaurantIds.blueOlive}', 'Evil')`,
      `update public.branches set name = 'Evil'`,
      `delete from public.branches`,
      `insert into public.profiles (display_name) values ('Evil')`,
      `update public.profiles set display_name = 'Evil'`,
      `delete from public.profiles`,
      `insert into public.staff_memberships (profile_id, restaurant_id, role) values ('${authUserIds.alice}', '${restaurantIds.blueOlive}', 'owner')`,
      `update public.staff_memberships set role = 'owner'`,
      `delete from public.staff_memberships`,
      `insert into public.dining_tables (restaurant_id, branch_id, label) values ('${restaurantIds.blueOlive}', '${branchIds.downtown}', 'Evil')`,
      `update public.dining_tables set label = 'Evil'`,
      `delete from public.dining_tables`,
    ]
    await asUser(client, authUserIds.alice, async () => {
      for (const sql of writeStatements) {
        await expectStatementToFail(client, '42501', sql)
      }
    })
  }, 60000)
})
