import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, expectStatementToFail, inTransaction } from './helpers/db'
import {
  branchIds,
  profileIds,
  restaurantIds,
  seedBranches,
  seedDiningTables,
  seedMemberships,
  seedProfiles,
  seedRestaurants,
} from './helpers/fixtures'

/**
 * Schema-level tests for the Phase 1 tenancy model (spec 002 US1,
 * FR-001..FR-007; data-model.md).
 *
 * Preconditions: the cloud development database is migrated and seeded.
 * Every mutation runs inside a transaction that is rolled back.
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

describe('tenancy tables: declared columns, types, nullability (data-model.md)', () => {
  const columnShapes: Record<string, Array<[string, string, string]>> = {
    restaurants: [
      ['id', 'uuid', 'NO'],
      ['name', 'text', 'NO'],
      ['slug', 'text', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
      ['updated_at', 'timestamp with time zone', 'NO'],
      // Phase 3 columns (spec 004 FR-002/FR-003; data-model.md).
      ['brand_description', 'text', 'YES'],
      ['contact_email', 'text', 'YES'],
      ['contact_phone', 'text', 'YES'],
      ['timezone', 'text', 'NO'],
    ],
    branches: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['name', 'text', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
      ['updated_at', 'timestamp with time zone', 'NO'],
    ],
    profiles: [
      ['id', 'uuid', 'NO'],
      ['display_name', 'text', 'NO'],
      ['auth_user_id', 'uuid', 'YES'],
      ['is_super_admin', 'boolean', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
      ['updated_at', 'timestamp with time zone', 'NO'],
    ],
    staff_memberships: [
      ['id', 'uuid', 'NO'],
      ['profile_id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['role', 'USER-DEFINED', 'NO'],
      ['branch_id', 'uuid', 'YES'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ],
    dining_tables: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['branch_id', 'uuid', 'NO'],
      ['label', 'text', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
      ['updated_at', 'timestamp with time zone', 'NO'],
      // Phase 3 activation state (spec 004 FR-011/FR-012; data-model.md).
      ['is_active', 'boolean', 'NO'],
    ],
  }

  for (const [table, expected] of Object.entries(columnShapes)) {
    it(`${table} has the declared columns`, async () => {
      const { rows } = await client.query(
        `select column_name, data_type, is_nullable
         from information_schema.columns
         where table_schema = 'public' and table_name = $1
         order by ordinal_position`,
        [table],
      )
      expect(rows.map((r) => [r.column_name, r.data_type, r.is_nullable])).toEqual(expected)
    })
  }

  it('staff_memberships.role is the staff_role enum', async () => {
    const { rows } = await client.query(
      `select data_type, udt_name from information_schema.columns
       where table_schema = 'public' and table_name = 'staff_memberships' and column_name = 'role'`,
    )
    expect(rows[0].udt_name).toBe('staff_role')
  })

  it('staff_role has exactly the four declared roles in order', async () => {
    const { rows } = await client.query(
      `select e.enumlabel
       from pg_enum e join pg_type t on e.enumtypid = t.oid
       where t.typname = 'staff_role'
       order by e.enumsortorder`,
    )
    expect(rows.map((r) => r.enumlabel)).toEqual(['owner', 'branch_manager', 'cashier', 'kitchen'])
  })

  it('RLS is enabled on every tenancy table (FR-008)', async () => {
    const { rows } = await client.query(
      `select relname, relrowsecurity
       from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r'
       order by relname`,
    )
    const rlsByName = Object.fromEntries(rows.map((r) => [r.relname, r.relrowsecurity]))
    for (const table of [
      'restaurants',
      'branches',
      'profiles',
      'staff_memberships',
      'dining_tables',
      'app_meta',
    ]) {
      expect(rlsByName[table]).toBe(true)
    }
  })
})

describe('constraints reject invalid data (FR-006/FR-007, spec Edge Cases)', () => {
  it('rejects a membership whose branch belongs to another restaurant', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23503',
        `insert into public.staff_memberships (profile_id, restaurant_id, role, branch_id)
         values ($1, $2, 'cashier', $3)`,
        [profileIds.carla, restaurantIds.blueOlive, branchIds.airport],
      )
    })
  })

  it('rejects a dining table whose branch belongs to another restaurant', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23503',
        `insert into public.dining_tables (restaurant_id, branch_id, label)
         values ($1, $2, 'T9')`,
        [restaurantIds.blueOlive, branchIds.airport],
      )
    })
  })

  it('rejects an owner membership bound to a branch (role/branch check)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.staff_memberships (profile_id, restaurant_id, role, branch_id)
         values ($1, $2, 'owner', $3)`,
        [profileIds.alice, restaurantIds.blueOlive, branchIds.downtown],
      )
    })
  })

  it('rejects a branch-scoped role without a branch (role/branch check)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.staff_memberships (profile_id, restaurant_id, role, branch_id)
         values ($1, $2, 'cashier', null)`,
        [profileIds.dan, restaurantIds.blueOlive],
      )
    })
  })

  it('rejects an exact-duplicate membership (unique nulls not distinct)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23505',
        `insert into public.staff_memberships (profile_id, restaurant_id, role, branch_id)
         values ($1, $2, 'owner', null)`,
        [profileIds.alice, restaurantIds.blueOlive],
      )
    })
  })

  it('rejects a duplicate restaurant slug and a malformed slug', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23505',
        `insert into public.restaurants (name, slug) values ('Impostor', 'blue-olive')`,
      )
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.restaurants (name, slug) values ('Bad Slug', 'Blue Olive')`,
      )
    })
  })

  it('rejects a duplicate label within a branch but allows the same label in another branch', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23505',
        `insert into public.dining_tables (restaurant_id, branch_id, label)
         values ($1, $2, 'T1')`,
        [restaurantIds.blueOlive, branchIds.downtown],
      )
      // Same label on a different branch of the same restaurant is allowed.
      await client.query(
        `insert into public.dining_tables (restaurant_id, branch_id, label)
         values ($1, $2, 'T9')`,
        [restaurantIds.blueOlive, branchIds.marina],
      )
      // And on a branch of another restaurant.
      await client.query(
        `insert into public.dining_tables (restaurant_id, branch_id, label)
         values ($1, $2, 'T9')`,
        [restaurantIds.cedarGrill, branchIds.airport],
      )
    })
  })

  it('rejects a blank dining-table label', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.dining_tables (restaurant_id, branch_id, label)
         values ($1, $2, '   ')`,
        [restaurantIds.blueOlive, branchIds.downtown],
      )
    })
  })
})

describe('deterministic ownership paths (FR-006, US1 scenario 5)', () => {
  it('every branch-scoped record resolves to a branch of its own restaurant', async () => {
    const { rows } = await client.query(`
      select
        (select count(*)::int from public.dining_tables) as tables_total,
        (select count(*)::int from public.dining_tables dt
          join public.branches b on b.id = dt.branch_id and b.restaurant_id = dt.restaurant_id)
          as tables_resolved,
        (select count(*)::int from public.staff_memberships where branch_id is not null)
          as branch_memberships_total,
        (select count(*)::int from public.staff_memberships m
          join public.branches b on b.id = m.branch_id and b.restaurant_id = m.restaurant_id)
          as branch_memberships_resolved
    `)
    const counts = rows[0]
    expect(counts.tables_resolved).toBe(counts.tables_total)
    expect(counts.tables_total).toBeGreaterThan(0)
    expect(counts.branch_memberships_resolved).toBe(counts.branch_memberships_total)
    expect(counts.branch_memberships_total).toBeGreaterThan(0)
  })

  it('every tenant-owned record resolves to an existing restaurant', async () => {
    const { rows } = await client.query(`
      select
        (select count(*)::int from public.branches b
          where not exists (select 1 from public.restaurants r where r.id = b.restaurant_id))
        + (select count(*)::int from public.staff_memberships m
          where not exists (select 1 from public.restaurants r where r.id = m.restaurant_id))
        + (select count(*)::int from public.dining_tables dt
          where not exists (select 1 from public.restaurants r where r.id = dt.restaurant_id))
        as orphans
    `)
    expect(rows[0].orphans).toBe(0)
  })
})

describe('seed matches the fixture contract (FR-015, SC-005)', () => {
  it('restaurants, branches, and dining tables match fixtures.ts', async () => {
    const restaurants = await client.query(
      'select id, name, slug from public.restaurants order by id',
    )
    expect(restaurants.rows).toEqual(seedRestaurants)

    const branches = await client.query(
      'select id, restaurant_id, name from public.branches order by id',
    )
    expect(branches.rows).toEqual(seedBranches)

    const diningTables = await client.query(
      'select id, restaurant_id, branch_id, label from public.dining_tables order by id',
    )
    expect(diningTables.rows).toEqual(seedDiningTables)
  })

  it('profiles and their synthetic auth identities match fixtures.ts', async () => {
    const { rows } = await client.query(
      'select id, display_name, auth_user_id, is_super_admin from public.profiles order by id',
    )
    expect(rows).toEqual(seedProfiles)
  })

  it('memberships match fixtures.ts, including the cross-restaurant member', async () => {
    const { rows } = await client.query(
      'select id, profile_id, restaurant_id, role, branch_id from public.staff_memberships order by id',
    )
    expect(rows).toEqual(seedMemberships)
    // Eve is the multi-restaurant member (Clarifications 2026-09-15).
    const eveRows = rows.filter((r) => r.profile_id === profileIds.eve)
    expect(eveRows.map((r) => r.restaurant_id).sort()).toEqual([
      restaurantIds.blueOlive,
      restaurantIds.cedarGrill,
    ])
  })
})
