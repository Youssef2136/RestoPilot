import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, expectStatementToFail, inTransaction } from './helpers/db'
import {
  branchIds,
  branchUnavailableItemIds,
  menuCategoryIds,
  menuExtraIds,
  menuItemIds,
  restaurantIds,
  seedBranchUnavailableItems,
  seedMenuCategories,
  seedMenuItemExtras,
  seedMenuItems,
} from './helpers/fixtures'

/**
 * Schema-level tests for the Phase 4 menu model (spec 005 FR-001,
 * FR-005–FR-013, FR-018, FR-021–FR-023, FR-026; data-model.md;
 * research.md §2, §7–§11).
 *
 * These assert what the DATABASE declares — column shapes, the constraints by
 * name that the RPCs translate into messages, the policies that decide
 * visibility, the storage bucket's limits, and the seeded fixture contract.
 * Behavior lives in `menu.rpc.test.ts`.
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

describe('menu tables: declared columns, types, nullability (data-model.md)', () => {
  const columnShapes: Record<string, Array<[string, string, string]>> = {
    menu_categories: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['name', 'text', 'NO'],
      ['description', 'text', 'YES'],
      ['sort_order', 'integer', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
      ['updated_at', 'timestamp with time zone', 'NO'],
    ],
    menu_items: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['category_id', 'uuid', 'NO'],
      ['name', 'text', 'NO'],
      ['description', 'text', 'YES'],
      ['price', 'numeric', 'NO'],
      ['is_available', 'boolean', 'NO'],
      ['image_path', 'text', 'YES'],
      ['sort_order', 'integer', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
      ['updated_at', 'timestamp with time zone', 'NO'],
    ],
    menu_item_extras: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['item_id', 'uuid', 'NO'],
      ['name', 'text', 'NO'],
      ['price_adjustment', 'numeric', 'NO'],
      ['sort_order', 'integer', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
      ['updated_at', 'timestamp with time zone', 'NO'],
    ],
    branch_unavailable_items: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['branch_id', 'uuid', 'NO'],
      ['item_id', 'uuid', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ],
  }

  it.each(Object.entries(columnShapes))(
    '%s matches its declared shape',
    async (table, expected) => {
      const { rows } = await client.query<{
        column_name: string
        data_type: string
        is_nullable: string
      }>(
        `select column_name, data_type, is_nullable
         from information_schema.columns
        where table_schema = 'public' and table_name = $1
        order by ordinal_position`,
        [table],
      )
      expect(rows.map((r) => [r.column_name, r.data_type, r.is_nullable])).toEqual(expected)
    },
  )

  it('stores money as exact decimals with two places (FR-010, research.md §9)', async () => {
    const { rows } = await client.query<{
      table_name: string
      column_name: string
      numeric_precision: number
      numeric_scale: number
    }>(
      `select table_name, column_name, numeric_precision, numeric_scale
         from information_schema.columns
        where table_schema = 'public'
          and table_name in ('menu_items', 'menu_item_extras')
          and data_type = 'numeric'
        order by table_name, column_name`,
    )
    expect(rows).toEqual([
      {
        table_name: 'menu_item_extras',
        column_name: 'price_adjustment',
        numeric_precision: 12,
        numeric_scale: 2,
      },
      { table_name: 'menu_items', column_name: 'price', numeric_precision: 12, numeric_scale: 2 },
    ])
  })
})

describe('menu constraints: the declarative guarantees the RPCs rely on', () => {
  it('rejects a case-insensitive duplicate category name within a restaurant (FR-005)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23505',
        `insert into public.menu_categories (restaurant_id, name, sort_order)
         values ($1, '  STARTERS  ', 99)`,
        [restaurantIds.blueOlive],
      )
    })
  })

  it('allows the same category name in another restaurant (tenant scoping)', async () => {
    await inTransaction(client, async () => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.menu_categories (restaurant_id, name, sort_order)
         values ($1, 'Starters', 9) returning id`,
        [restaurantIds.cedarGrill],
      )
      expect(rows).toHaveLength(1)
    })
  })

  it('rejects blank, over-long, and negative-sort-order values (FR-005, FR-008)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.menu_categories (restaurant_id, name) values ($1, '   ')`,
        [restaurantIds.blueOlive],
      )
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.menu_categories (restaurant_id, name) values ($1, $2)`,
        [restaurantIds.blueOlive, 'x'.repeat(81)],
      )
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.menu_categories (restaurant_id, name, sort_order) values ($1, 'Fine', -1)`,
        [restaurantIds.blueOlive],
      )
    })
  })

  it('rejects a negative or over-long item and a cross-restaurant category (FR-007, FR-010)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.menu_items (restaurant_id, category_id, name, price)
         values ($1, $2, 'Discount', -1)`,
        [restaurantIds.blueOlive, menuCategoryIds.blueOliveStarters],
      )
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.menu_items (restaurant_id, category_id, name, price)
         values ($1, $2, $3, 1.00)`,
        [restaurantIds.blueOlive, menuCategoryIds.blueOliveStarters, 'x'.repeat(121)],
      )
      // The composite FK makes a cross-tenant category reference impossible.
      await expectStatementToFail(
        client,
        '23503',
        `insert into public.menu_items (restaurant_id, category_id, name, price)
         values ($1, $2, 'Borrowed', 1.00)`,
        [restaurantIds.blueOlive, menuCategoryIds.cedarGrillGrill],
      )
    })
  })

  it('rejects an image path outside the item’s own tenant and item prefix (FR-021)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `update public.menu_items set image_path = $2 where id = $1`,
        [
          menuItemIds.hummus,
          `restaurant/${restaurantIds.cedarGrill}/item/${menuItemIds.hummus}/photo.jpg`,
        ],
      )
      await expectStatementToFail(
        client,
        '23514',
        `update public.menu_items set image_path = $2 where id = $1`,
        [
          menuItemIds.hummus,
          `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.baklava}/photo.jpg`,
        ],
      )
    })
  })

  it('declares the partial unique index on image_path (FR-021, structural backstop)', async () => {
    // Two items can never share an object: the path embeds the item id, and
    // menu_items_image_path_check forces every path to belong to its own row —
    // so a collision is unreachable through valid data. The partial unique
    // index is the backstop if that check is ever relaxed; this asserts it
    // exists and is partial rather than trying to construct an impossible row.
    const { rows } = await client.query<{ indexdef: string }>(
      `select indexdef from pg_indexes
        where schemaname = 'public' and indexname = 'menu_items_image_path_key'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.indexdef).toContain('UNIQUE')
    expect(rows[0]?.indexdef).toMatch(/WHERE \(image_path IS NOT NULL\)/)
  })

  it('rejects a path that belongs to a different item of the same restaurant', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `update public.menu_items set image_path = $2 where id = $1`,
        [
          menuItemIds.hummus,
          `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.lambKebab}/x.png`,
        ],
      )
    })
  })

  it('allows many items with no image (the index is partial)', async () => {
    const { rows } = await client.query<{ count: string }>(
      `select count(*) from public.menu_items where image_path is null`,
    )
    expect(Number(rows[0]?.count)).toBeGreaterThan(1)
  })

  it('rejects a negative extra adjustment and a duplicate branch override (FR-013, FR-019)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.menu_item_extras (restaurant_id, item_id, name, price_adjustment)
         values ($1, $2, 'Negative', -0.01)`,
        [restaurantIds.blueOlive, menuItemIds.baklava],
      )
      await expectStatementToFail(
        client,
        '23505',
        `insert into public.branch_unavailable_items (restaurant_id, branch_id, item_id)
         values ($1, $2, $3)`,
        [restaurantIds.blueOlive, branchIds.marina, menuItemIds.grilledSeaBass],
      )
    })
  })

  it('rejects an override that mixes tenants or items (composite FKs, FR-013, FR-026)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23503',
        `insert into public.branch_unavailable_items (restaurant_id, branch_id, item_id)
         values ($1, $2, $3)`,
        [restaurantIds.blueOlive, branchIds.downtown, menuItemIds.cedarMixedGrill],
      )
      await expectStatementToFail(
        client,
        '23503',
        `insert into public.branch_unavailable_items (restaurant_id, branch_id, item_id)
         values ($1, $2, $3)`,
        [restaurantIds.blueOlive, branchIds.airport, menuItemIds.hummus],
      )
    })
  })
})

describe('menu policies: visibility rules and the write posture (FR-004, FR-013, FR-026)', () => {
  it('declares exactly the four documented select policies', async () => {
    const { rows } = await client.query<{
      tablename: string
      policyname: string
      cmd: string
      roles: string
    }>(
      `select tablename, policyname, cmd, array_to_string(roles, ',') as roles
         from pg_policies
        where schemaname = 'public'
          and tablename in ('menu_categories', 'menu_items', 'menu_item_extras', 'branch_unavailable_items')
        order by tablename, policyname`,
    )
    expect(rows).toEqual([
      {
        tablename: 'branch_unavailable_items',
        policyname: 'branch_unavailable_items_staff_select',
        cmd: 'SELECT',
        roles: 'authenticated',
      },
      {
        tablename: 'menu_categories',
        policyname: 'menu_categories_staff_select',
        cmd: 'SELECT',
        roles: 'authenticated',
      },
      {
        tablename: 'menu_item_extras',
        policyname: 'menu_item_extras_staff_select',
        cmd: 'SELECT',
        roles: 'authenticated',
      },
      {
        tablename: 'menu_items',
        policyname: 'menu_items_staff_select',
        cmd: 'SELECT',
        roles: 'authenticated',
      },
    ])
  })

  it('grants select only — no client write grant exists on any menu table (Constitution IV)', async () => {
    const { rows } = await client.query<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type
         from information_schema.role_table_grants
        where table_schema = 'public'
          and table_name in ('menu_categories', 'menu_items', 'menu_item_extras', 'branch_unavailable_items')
          and grantee = 'authenticated'
        order by table_name, privilege_type`,
    )
    expect(rows.every((r) => r.privilege_type === 'SELECT')).toBe(true)
    expect(rows).toHaveLength(4)
  })

  it('enables row level security on every menu table', async () => {
    const { rows } = await client.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity
         from pg_class
        where relnamespace = 'public'::regnamespace
          and relname in ('menu_categories', 'menu_items', 'menu_item_extras', 'branch_unavailable_items')
        order by relname`,
    )
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.relrowsecurity)).toBe(true)
  })
})

describe('menu images: the bucket and its storage policies (FR-021–FR-023, research.md §4/§11)', () => {
  it('declares the private bucket with its documented limits', async () => {
    const { rows } = await client.query<{
      id: string
      public: boolean
      file_size_limit: string
      allowed_mime_types: string[]
    }>(
      `select id, public, file_size_limit, allowed_mime_types
         from storage.buckets
        where id = 'menu-images'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.public).toBe(false)
    expect(Number(rows[0]?.file_size_limit)).toBe(5242880)
    expect(rows[0]?.allowed_mime_types).toEqual(['image/jpeg', 'image/png', 'image/webp'])
  })

  it('declares the three storage policies and no update policy (research.md §11)', async () => {
    const { rows } = await client.query<{ policyname: string; cmd: string }>(
      `select policyname, cmd
         from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname like 'menu_images%'
        order by policyname`,
    )
    expect(rows).toEqual([
      { policyname: 'menu_images_owner_delete', cmd: 'DELETE' },
      { policyname: 'menu_images_owner_insert', cmd: 'INSERT' },
      { policyname: 'menu_images_staff_select', cmd: 'SELECT' },
    ])
  })
})

describe('seed matches the fixture contract (FR-028, SC-007)', () => {
  it('menu categories, items, extras, and overrides match fixtures.ts', async () => {
    const categories = await client.query(
      `select id, restaurant_id, name, description, sort_order
         from public.menu_categories order by id`,
    )
    expect(categories.rows).toEqual(
      [...seedMenuCategories].sort((a, b) => a.id.localeCompare(b.id)),
    )

    const items = await client.query(
      `select id, restaurant_id, category_id, name, description, price::text, is_available, sort_order
         from public.menu_items order by id`,
    )
    expect(items.rows).toEqual([...seedMenuItems].sort((a, b) => a.id.localeCompare(b.id)))

    const extras = await client.query(
      `select id, restaurant_id, item_id, name, price_adjustment::text, sort_order
         from public.menu_item_extras order by id`,
    )
    expect(extras.rows).toEqual([...seedMenuItemExtras].sort((a, b) => a.id.localeCompare(b.id)))

    const overrides = await client.query(
      `select id, restaurant_id, branch_id, item_id
         from public.branch_unavailable_items order by id`,
    )
    expect(overrides.rows).toEqual(
      [...seedBranchUnavailableItems].sort((a, b) => a.id.localeCompare(b.id)),
    )
  })

  it('seeds the hard-stop item stopped restaurant-wide with a Marina override row (spec Edge Cases)', async () => {
    const { rows } = await client.query<{ is_available: boolean }>(
      `select is_available from public.menu_items where id = $1`,
      [menuItemIds.grilledSeaBass],
    )
    expect(rows[0]?.is_available).toBe(false)

    const override = await client.query(
      `select 1 from public.branch_unavailable_items where id = $1`,
      [branchUnavailableItemIds.marinaGrilledSeaBass],
    )
    expect(override.rows).toHaveLength(1)
  })

  it('seeds no item image (the seed cannot upload objects — research.md §16)', async () => {
    const { rows } = await client.query<{ count: string }>(
      `select count(*) from public.menu_items where image_path is not null`,
    )
    expect(Number(rows[0]?.count)).toBe(0)
  })

  it('keeps extra ids referencing their own item and restaurant', async () => {
    const { rows } = await client.query<{ id: string; item_id: string; restaurant_id: string }>(
      `select e.id, e.item_id, e.restaurant_id
         from public.menu_item_extras e
         join public.menu_items i on i.id = e.item_id
        where e.restaurant_id <> i.restaurant_id or e.item_id <> i.id`,
    )
    expect(rows).toHaveLength(0)
    const itemIds = Object.values(menuItemIds) as readonly string[]
    expect(seedMenuItemExtras.every((e) => itemIds.includes(e.item_id))).toBe(true)
    expect(menuExtraIds.lambExtraRice).toBeDefined()
  })
})
