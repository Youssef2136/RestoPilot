import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDbClient, expectStatementToFail, inTransaction } from './helpers/db'
import {
  authUserIds,
  branchIds,
  menuCategoryIds,
  menuExtraIds,
  menuItemIds,
  profileIds,
  restaurantIds,
} from './helpers/fixtures'

/**
 * Menu RPC suite — the shared matrix (spec 005 FR-002, FR-003, FR-004,
 * FR-005–FR-025, FR-026, FR-027; contracts/database-functions.md).
 *
 * This file carries the AUTHORIZATION matrix across all fifteen functions,
 * the generic validation messages, the audit basics, and the read
 * projection's scope and shape. The story-owned semantics are appended by the
 * later suites, exactly as the task list splits them:
 *   T017 — structure, ordering, lifecycle   (US1)
 *   T026 — availability semantics + reasons (US2)
 *   T031 — price recording                  (US3)
 *   T035 — extras, including the bound      (US4)
 *   T041 — image reference grammar          (US5)
 *
 * Identities are simulated exactly as the data API presents them (the
 * `authenticated` role + `request.jwt.claims`, helpers/db.ts) and every call
 * runs in a transaction that is ALWAYS rolled back. Audit rows have no client
 * grants by design, so audit assertions switch back to the owner role inside
 * the same transaction (`set local role postgres`).
 *
 * Preconditions: migrated + seeded cloud dev DB.
 */

const client = createDbClient()

/**
 * Audit high-water mark: the audit_log is shared across suites and the real
 * app (committed rows from e2e image runs appear in broad `action like`
 * queries). Every assertion counts only rows written at or after the mark.
 */
let auditFloor = '1970-01-01'

beforeAll(async () => {
  await client.connect()
  await client.query('set local role postgres')
  const mark = await client.query<{ max: string | null }>(
    'select max(created_at)::text as max from public.audit_log',
  )
  await client.query('reset role')
  auditFloor = mark.rows[0]!.max ?? auditFloor
})

afterAll(async () => {
  await client.end()
})

/** An authenticated identity with no linked profile (the unlinked case). */
const UNLINKED_AUTH_USER = '00000000-0000-4000-8000-000000009999'

const CALL = {
  createCategory: 'select * from public.create_menu_category($1, $2, $3)',
  updateCategory: 'select * from public.update_menu_category($1, $2, $3)',
  deleteCategory: 'select * from public.delete_menu_category($1)',
  reorderCategories: 'select * from public.reorder_menu_categories($1, $2)',
  createItem: 'select * from public.create_menu_item($1, $2, $3, $4)',
  updateItem: 'select * from public.update_menu_item($1, $2, $3, $4)',
  moveItem: 'select * from public.move_menu_item($1, $2)',
  reorderItems: 'select * from public.reorder_menu_items($1, $2)',
  setItemAvailability: 'select * from public.set_menu_item_availability($1, $2)',
  setBranchAvailability: 'select * from public.set_branch_item_availability($1, $2, $3)',
  setItemImage: 'select * from public.set_menu_item_image($1, $2)',
  addExtra: 'select * from public.add_menu_item_extra($1, $2, $3)',
  updateExtra: 'select * from public.update_menu_item_extra($1, $2, $3)',
  removeExtra: 'select * from public.remove_menu_item_extra($1)',
  branchMenu: 'select * from public.get_branch_menu($1)',
} as const

/**
 * Assert the RPC fails with the given SQLSTATE and a message containing
 * `messagePart`, rolling back to a savepoint so the enclosing identity block
 * continues at the pre-attempt state. `label` names the call in failures.
 */
async function expectRpcFailure(
  code: string,
  messagePart: string,
  sql: string,
  values: unknown[] = [],
  label = sql,
): Promise<void> {
  await client.query('savepoint expect_rpc_failure')
  try {
    await client.query(sql, values)
  } catch (error) {
    await client.query('rollback to savepoint expect_rpc_failure')
    const pgError = error as { code?: string; message: string }
    if (pgError.code !== code) {
      throw new Error(
        `${label}: expected ${code} but got ${pgError.code ?? 'no code'}: ${pgError.message}`,
        { cause: error },
      )
    }
    expect(pgError.message).toContain(messagePart)
    return
  }
  await client.query('rollback to savepoint expect_rpc_failure')
  throw new Error(`${label}: expected the call to fail with ${code} but it succeeded`)
}

/** Reads audit rows through the owner role inside the current transaction. */
async function auditRows(where = 'true', values: unknown[] = []) {
  await client.query('set local role postgres')
  const { rows } = await client.query(
    `select actor_profile_id, action, resource_type, resource_id, reason, restaurant_id, branch_id
       from public.audit_log
      where created_at > $${values.length + 1}::timestamptz and (${where})
      order by id`,
    [...values, auditFloor],
  )
  await client.query('set local role authenticated')
  return rows
}

const DENIED = 'You do not have permission'

describe('menu RPCs: the owner-only write surface (FR-003, FR-026; Constitution IV)', () => {
  /** Every owner-only call, aimed at Blue Olive targets. */
  const ownerOnlyCalls: Array<[string, string, unknown[]]> = [
    ['create_menu_category', CALL.createCategory, [restaurantIds.blueOlive, 'Denied', null]],
    [
      'update_menu_category',
      CALL.updateCategory,
      [menuCategoryIds.blueOliveStarters, 'Denied', null],
    ],
    ['delete_menu_category', CALL.deleteCategory, [menuCategoryIds.blueOliveDesserts]],
    [
      'reorder_menu_categories',
      CALL.reorderCategories,
      [restaurantIds.blueOlive, [menuCategoryIds.blueOliveStarters]],
    ],
    ['create_menu_item', CALL.createItem, [menuCategoryIds.blueOliveStarters, 'Denied', null, 1.0]],
    ['update_menu_item', CALL.updateItem, [menuItemIds.hummus, 'Denied', null, 1.0]],
    ['move_menu_item', CALL.moveItem, [menuItemIds.hummus, menuCategoryIds.blueOliveMains]],
    [
      'reorder_menu_items',
      CALL.reorderItems,
      [menuCategoryIds.blueOliveStarters, [menuItemIds.hummus]],
    ],
    ['set_menu_item_availability', CALL.setItemAvailability, [menuItemIds.hummus, false]],
    ['set_menu_item_image', CALL.setItemImage, [menuItemIds.hummus, null]],
    ['add_menu_item_extra', CALL.addExtra, [menuItemIds.hummus, 'Denied', 1.0]],
    [
      'update_menu_item_extra',
      CALL.updateExtra,
      ['00000000-0000-4000-8000-000000006031', 'Denied', 1.0],
    ],
    ['remove_menu_item_extra', CALL.removeExtra, ['00000000-0000-4000-8000-000000006031']],
  ]

  const nonOwners: Array<[string, string]> = [
    ['bob (branch manager, Downtown)', authUserIds.bob],
    ['carla (cashier, Downtown)', authUserIds.carla],
    ['dan (kitchen, Marina)', authUserIds.dan],
    ['eve (owner of another restaurant)', authUserIds.eve],
    ['platform admin', authUserIds.platformAdmin],
    ['fiona (no memberships)', authUserIds.fiona],
    ['an unlinked identity', UNLINKED_AUTH_USER],
  ]

  for (const [label, authUserId] of nonOwners) {
    it(`denies ${label} every content action with 42501`, { timeout: 60_000 }, async () => {
      await asUser(client, authUserId, async () => {
        for (const [name, sql, values] of ownerOnlyCalls) {
          await expectRpcFailure('42501', DENIED, sql, values, `${label} → ${name}`)
        }
        // Nothing was written and nothing was audited by any of the attempts.
        const rows = await auditRows('action like $1', ['menu.%'])
        expect(rows).toHaveLength(0)
      })
    })
  }

  it(
    'admits the owner of the restaurant on every content action',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const category = await client.query<{ id: string }>(`${CALL.createCategory} `, [
          restaurantIds.blueOlive,
          'Owner Created',
          'temporary',
        ])
        expect(category.rows[0]?.id).toBeTruthy()

        const item = await client.query<{ id: string }>(CALL.createItem, [
          category.rows[0]?.id,
          'Owner Item',
          null,
          3.25,
        ])
        expect(item.rows[0]?.id).toBeTruthy()

        const renamed = await client.query<{ name: string }>(CALL.updateCategory, [
          category.rows[0]?.id,
          'Owner Renamed',
          null,
        ])
        expect(renamed.rows[0]?.name).toBe('Owner Renamed')

        const repriced = await client.query<{ price: string }>(CALL.updateItem, [
          item.rows[0]?.id,
          'Owner Item',
          null,
          4.5,
        ])
        expect(repriced.rows[0]?.price).toBe('4.50')

        await client.query(CALL.setItemAvailability, [item.rows[0]?.id, false])
        await client.query(CALL.removeExtra, ['00000000-0000-4000-8000-000000006031'])
        // Items are never deleted, so the category must be emptied by moving.
        await client.query(CALL.moveItem, [item.rows[0]?.id, menuCategoryIds.blueOliveStarters])
        await client.query(CALL.deleteCategory, [category.rows[0]?.id])

        const rows = await auditRows('action like $1', ['menu.%'])
        expect(rows.map((r) => r.action)).toEqual([
          'menu.category_created',
          'menu.item_created',
          'menu.category_updated',
          'menu.item_price_changed',
          'menu.item_availability_changed',
          'menu.item_extra_removed',
          'menu.item_moved',
          'menu.category_deleted',
        ])
      })
    },
  )

  it(
    'denies anon on every function (execute is authenticated-only)',
    { timeout: 30_000 },
    async () => {
      await client.query('begin')
      try {
        await client.query('set local role anon')
        await expectRpcFailure('42501', 'permission denied', CALL.branchMenu, [branchIds.downtown])
        await expectRpcFailure('42501', 'permission denied', CALL.createCategory, [
          restaurantIds.blueOlive,
          'Anon',
          null,
        ])
      } finally {
        await client.query('rollback')
      }
    },
  )
})

describe('menu RPCs: branch availability authorization (FR-003, FR-013)', () => {
  it(
    'admits the branch manager for their own branch and denies every other branch',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.bob, async () => {
        const allowed = await client.query<{ set_branch_item_availability: boolean }>(
          CALL.setBranchAvailability,
          [branchIds.downtown, menuItemIds.hummus, false],
        )
        expect(allowed.rows[0]?.set_branch_item_availability).toBe(true)

        await expectRpcFailure('42501', DENIED, CALL.setBranchAvailability, [
          branchIds.marina,
          menuItemIds.hummus,
          false,
        ])
        await expectRpcFailure('42501', DENIED, CALL.setBranchAvailability, [
          branchIds.airport,
          menuItemIds.cedarMixedGrill,
          false,
        ])
        // The audit record carries the branch manager as actor and the scope.
        const rows = await auditRows('action = $1', ['menu.branch_availability_changed'])
        expect(rows).toEqual([
          {
            actor_profile_id: profileIds.bob,
            action: 'menu.branch_availability_changed',
            resource_type: 'menu_item',
            resource_id: menuItemIds.hummus,
            reason: 'branch availability: available -> unavailable',
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.downtown,
          },
        ])
      })
    },
  )

  it(
    'denies cashiers, kitchen staff, other restaurants, and admins',
    { timeout: 60_000 },
    async () => {
      const denied: Array<[string, string]> = [
        ['carla', authUserIds.carla],
        ['dan', authUserIds.dan],
        ['eve', authUserIds.eve],
        ['platform admin', authUserIds.platformAdmin],
        ['unlinked', UNLINKED_AUTH_USER],
      ]
      for (const [, authUserId] of denied) {
        await asUser(client, authUserId, async () => {
          await expectRpcFailure('42501', DENIED, CALL.setBranchAvailability, [
            branchIds.downtown,
            menuItemIds.hummus,
            false,
          ])
        })
      }
    },
  )

  it('denies an item that belongs to another restaurant (42501, not a validation error)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure('42501', DENIED, CALL.setBranchAvailability, [
        branchIds.downtown,
        menuItemIds.cedarMixedGrill,
        false,
      ])
    })
  })
})

describe('menu RPCs: validation messages (FR-005, FR-008, FR-010, FR-019, FR-021)', () => {
  it(
    'rejects category name and description violations with clear messages',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('P0001', 'A category name is required.', CALL.createCategory, [
          restaurantIds.blueOlive,
          '   ',
          null,
        ])
        await expectRpcFailure('P0001', 'at most 80 characters', CALL.createCategory, [
          restaurantIds.blueOlive,
          'x'.repeat(81),
          null,
        ])
        await expectRpcFailure('P0001', 'at most 500 characters', CALL.createCategory, [
          restaurantIds.blueOlive,
          'Fine',
          'y'.repeat(501),
        ])
        await expectRpcFailure('P0001', 'already exists', CALL.createCategory, [
          restaurantIds.blueOlive,
          '  starters ',
          null,
        ])
        await expectRpcFailure('P0001', 'already exists', CALL.updateCategory, [
          menuCategoryIds.blueOliveDrinks,
          'STARTERS',
          null,
        ])
      })
    },
  )

  it('rejects item name, description, and price violations', { timeout: 60_000 }, async () => {
    await asUser(client, authUserIds.alice, async () => {
      const values = [menuCategoryIds.blueOliveStarters, 'New Item', null] as const
      await expectRpcFailure('P0001', 'An item name is required.', CALL.createItem, [
        values[0],
        '   ',
        null,
        1,
      ])
      await expectRpcFailure('P0001', 'at most 120 characters', CALL.createItem, [
        values[0],
        'x'.repeat(121),
        null,
        1,
      ])
      await expectRpcFailure('P0001', 'at most 1000 characters', CALL.createItem, [
        values[0],
        'Fine',
        'y'.repeat(1001),
        1,
      ])
      await expectRpcFailure('P0001', 'A price is required.', CALL.createItem, [...values, null])
      await expectRpcFailure('P0001', 'may not be negative', CALL.createItem, [...values, -0.01])
      await expectRpcFailure('P0001', 'at most two decimal places', CALL.createItem, [
        ...values,
        12.345,
      ])
      await expectRpcFailure('P0001', 'too large', CALL.createItem, [...values, 1000000000])
      await expectRpcFailure('P0001', 'at most two decimal places', CALL.updateItem, [
        menuItemIds.hummus,
        'Hummus',
        null,
        6.505,
      ])
    })
  })

  it('leaves the stored price untouched when a price is rejected (FR-010)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure('P0001', 'at most two decimal places', CALL.updateItem, [
        menuItemIds.hummus,
        'Hummus',
        null,
        9.999,
      ])
      const stored = await client.query<{ price: string; updated_at: Date; name: string }>(
        'select price::text, updated_at, name from public.menu_items where id = $1',
        [menuItemIds.hummus],
      )
      expect(stored.rows[0]?.price).toBe('6.50')
      expect(stored.rows[0]?.name).toBe('Hummus')
      const rows = await auditRows('action like $1', ['menu.%'])
      expect(rows).toHaveLength(0)
    })
  })

  it(
    'rejects deleting a non-empty category and moving into a foreign category',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('P0001', 'still contains items', CALL.deleteCategory, [
          menuCategoryIds.blueOliveStarters,
        ])
        await expectRpcFailure('P0001', 'already in that category', CALL.moveItem, [
          menuItemIds.hummus,
          menuCategoryIds.blueOliveStarters,
        ])
        await expectRpcFailure('42501', DENIED, CALL.moveItem, [
          menuItemIds.hummus,
          menuCategoryIds.cedarGrillGrill,
        ])
      })
    },
  )

  it('rejects reorder lists that do not cover the scope exactly', { timeout: 60_000 }, async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure('P0001', 'must list every category', CALL.reorderCategories, [
        restaurantIds.blueOlive,
        [menuCategoryIds.blueOliveStarters],
      ])
      await expectRpcFailure('P0001', 'contains a duplicate category', CALL.reorderCategories, [
        restaurantIds.blueOlive,
        [
          menuCategoryIds.blueOliveStarters,
          menuCategoryIds.blueOliveStarters,
          menuCategoryIds.blueOliveMains,
          menuCategoryIds.blueOliveDesserts,
        ],
      ])
      await expectRpcFailure('P0001', 'must list every item', CALL.reorderItems, [
        menuCategoryIds.blueOliveStarters,
        [menuItemIds.hummus],
      ])
      const rows = await auditRows('action like $1', ['menu.%'])
      expect(rows).toHaveLength(0)
    })
  })

  it(
    'rejects extra violations and image paths that do not belong to the item',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('P0001', 'An extra name is required.', CALL.addExtra, [
          menuItemIds.hummus,
          '  ',
          0,
        ])
        await expectRpcFailure('P0001', 'may not be negative', CALL.addExtra, [
          menuItemIds.hummus,
          'Negative',
          -1,
        ])
        await expectRpcFailure('P0001', 'at most two decimal places', CALL.addExtra, [
          menuItemIds.hummus,
          'Precise',
          1.005,
        ])

        const foreign = `restaurant/${restaurantIds.cedarGrill}/item/${menuItemIds.hummus}/photo.jpg`
        await expectRpcFailure('P0001', 'does not belong to this item', CALL.setItemImage, [
          menuItemIds.hummus,
          foreign,
        ])
        const wrongItem = `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.baklava}/photo.jpg`
        await expectRpcFailure('P0001', 'does not belong to this item', CALL.setItemImage, [
          menuItemIds.hummus,
          wrongItem,
        ])
        const wrongExtension = `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}/photo.gif`
        await expectRpcFailure('P0001', 'does not belong to this item', CALL.setItemImage, [
          menuItemIds.hummus,
          wrongExtension,
        ])
        const rows = await auditRows('action like $1', ['menu.%'])
        expect(rows).toHaveLength(0)
      })
    },
  )
})

describe('menu RPCs: audit basics (FR-016, FR-024)', () => {
  it('writes exactly one scoped record per accepted change', { timeout: 60_000 }, async () => {
    await asUser(client, authUserIds.alice, async () => {
      // The description is passed unchanged, so the change string carries the
      // name only.
      await client.query(CALL.updateItem, [
        menuItemIds.hummus,
        'Hummus Plate',
        'Chickpea purée with tahini, olive oil, and warm pita.',
        6.5,
      ])
      const rows = await auditRows('action like $1', ['menu.%'])
      expect(rows).toEqual([
        {
          actor_profile_id: profileIds.alice,
          action: 'menu.item_updated',
          resource_type: 'menu_item',
          resource_id: menuItemIds.hummus,
          reason: 'name: "Hummus" -> "Hummus Plate"',
          restaurant_id: restaurantIds.blueOlive,
          branch_id: null,
        },
      ])
    })
  })

  it('writes nothing for a no-op save (FR-016)', { timeout: 60_000 }, async () => {
    await asUser(client, authUserIds.alice, async () => {
      const before = await client.query<{ updated_at: Date }>(
        'select updated_at from public.menu_items where id = $1',
        [menuItemIds.hummus],
      )
      // Every field matches the stored row, including the description.
      const stored = [
        menuItemIds.hummus,
        'Hummus',
        'Chickpea purée with tahini, olive oil, and warm pita.',
        6.5,
      ] as const
      await client.query(CALL.updateItem, [...stored])
      await client.query(CALL.updateItem, [...stored])
      const after = await client.query<{ updated_at: Date }>(
        'select updated_at from public.menu_items where id = $1',
        [menuItemIds.hummus],
      )
      expect(after.rows[0]?.updated_at).toEqual(before.rows[0]?.updated_at)

      const noop = await client.query<{ is_available: boolean }>(CALL.setItemAvailability, [
        menuItemIds.hummus,
        true,
      ])
      // The composite return expands into the item's own columns.
      expect(noop.rows[0]?.is_available).toBe(true)

      const rows = await auditRows('action like $1', ['menu.%'])
      expect(rows).toHaveLength(0)
    })
  })

  it(
    'keeps the tenant scope on every record and branch scope only where applicable',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await client.query(CALL.setItemAvailability, [menuItemIds.grilledSeaBass, true])
        // Downtown belongs to Blue Olive — Alice's own restaurant. An owner has
        // no branch availability rights at another restaurant's branch.
        await client.query(CALL.setBranchAvailability, [
          branchIds.downtown,
          menuItemIds.grilledSeaBass,
          false,
        ])
        const rows = await auditRows('action like $1', ['menu.%'])
        expect(rows).toEqual([
          {
            actor_profile_id: profileIds.alice,
            action: 'menu.item_availability_changed',
            resource_type: 'menu_item',
            resource_id: menuItemIds.grilledSeaBass,
            reason: 'restaurant availability: unavailable -> available',
            restaurant_id: restaurantIds.blueOlive,
            branch_id: null,
          },
          {
            actor_profile_id: profileIds.alice,
            action: 'menu.branch_availability_changed',
            resource_type: 'menu_item',
            resource_id: menuItemIds.grilledSeaBass,
            reason: 'branch availability: available -> unavailable',
            restaurant_id: restaurantIds.blueOlive,
            branch_id: branchIds.downtown,
          },
        ])
      })
    },
  )
})

describe('get_branch_menu: scope and shape (FR-014, FR-015)', () => {
  it(
    'admits owners for any branch of their restaurant and denies other restaurants',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        for (const branchId of [branchIds.downtown, branchIds.marina]) {
          const { rows } = await client.query<{ get_branch_menu: { branch: { id: string } } }>(
            CALL.branchMenu,
            [branchId],
          )
          expect(rows[0]?.get_branch_menu.branch.id).toBe(branchId)
        }
        await expectRpcFailure('42501', 'view this branch', CALL.branchMenu, [branchIds.airport])
      })
      await asUser(client, authUserIds.eve, async () => {
        const { rows } = await client.query(CALL.branchMenu, [branchIds.airport])
        expect(rows).toHaveLength(1)
        // Eve is an owner at Cedar Grill AND a cashier at Downtown (the
        // cross-restaurant member fixture), so her denial must be aimed at a
        // branch she has no scope on at all.
        await expectRpcFailure('42501', 'view this branch', CALL.branchMenu, [branchIds.marina])
      })
    },
  )

  it('admits branch-scoped members for their own branch only', { timeout: 60_000 }, async () => {
    await asUser(client, authUserIds.bob, async () => {
      const { rows } = await client.query(CALL.branchMenu, [branchIds.downtown])
      expect(rows).toHaveLength(1)
      await expectRpcFailure('42501', 'view this branch', CALL.branchMenu, [branchIds.marina])
    })
    await asUser(client, authUserIds.carla, async () => {
      const { rows } = await client.query(CALL.branchMenu, [branchIds.downtown])
      expect(rows).toHaveLength(1)
    })
    await asUser(client, authUserIds.dan, async () => {
      const { rows } = await client.query(CALL.branchMenu, [branchIds.marina])
      expect(rows).toHaveLength(1)
      await expectRpcFailure('42501', 'view this branch', CALL.branchMenu, [branchIds.downtown])
    })
  })

  it('denies identities with no scope at all', { timeout: 60_000 }, async () => {
    for (const authUserId of [authUserIds.platformAdmin, authUserIds.fiona, UNLINKED_AUTH_USER]) {
      await asUser(client, authUserId, async () => {
        await expectRpcFailure('42501', 'view this branch', CALL.branchMenu, [branchIds.downtown])
      })
    }
  })

  it(
    'returns the ordered projection with two-decimal price strings',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const { rows } = await client.query<{
          get_branch_menu: {
            restaurant: { slug: string }
            categories: Array<{
              name: string
              items: Array<{
                name: string
                price: string
                extras: Array<{ name: string; price_adjustment: string }>
              }>
            }>
          }
        }>(CALL.branchMenu, [branchIds.downtown])
        const menu = rows[0]?.get_branch_menu
        expect(menu?.restaurant.slug).toBe('blue-olive')
        expect(menu?.categories.map((c) => c.name)).toEqual([
          'Starters',
          'Mains',
          'Desserts',
          'Drinks',
        ])
        const starters = menu?.categories[0]
        expect(starters?.items.map((i) => i.name)).toEqual([
          'Hummus',
          'Grilled Halloumi',
          'Soup of the Day',
        ])
        expect(starters?.items[0]?.price).toBe('6.50')
        const mains = menu?.categories[1]
        const kebab = mains?.items.find((i) => i.name === 'Lamb Kebab')
        expect(kebab?.extras.map((e) => [e.name, e.price_adjustment])).toEqual([
          ['Extra garlic sauce', '0.00'],
          ['Extra rice', '3.00'],
          ['Extra chili', '0.50'],
        ])
        const fondant = menu?.categories[2]?.items.find((i) => i.name === 'Chocolate Fondant')
        expect(fondant?.extras.map((e) => e.name)).toEqual([
          'Vanilla ice cream',
          'Extra chocolate sauce',
        ])
        expect(menu?.categories[1]?.items.find((i) => i.name === 'Hummus')).toBeUndefined()
      })
    },
  )

  it('never leaks another restaurant’s menu into the payload', { timeout: 60_000 }, async () => {
    await asUser(client, authUserIds.eve, async () => {
      const { rows } = await client.query<{
        get_branch_menu: { categories: Array<{ name: string }> }
      }>(CALL.branchMenu, [branchIds.airport])
      expect(rows[0]?.get_branch_menu.categories.map((c) => c.name)).toEqual(['Grill'])
    })
  })
})

describe('US1: menu structure, identity, and ordering (FR-005…FR-009)', () => {
  it('treats category names case-insensitively and trims them', { timeout: 60_000 }, async () => {
    await asUser(client, authUserIds.alice, async () => {
      const created = await client.query<{ id: string; name: string }>(CALL.createCategory, [
        restaurantIds.blueOlive,
        '  Chef Specials  ',
        null,
      ])
      expect(created.rows[0]?.name).toBe('Chef Specials')

      // The uniqueness rule ignores case and surrounding whitespace.
      await expectRpcFailure('P0001', 'already exists', CALL.createCategory, [
        restaurantIds.blueOlive,
        'CHEF SPECIALS',
        null,
      ])
      await expectRpcFailure('P0001', 'already exists', CALL.updateCategory, [
        menuCategoryIds.blueOliveDrinks,
        '  chef specials ',
        null,
      ])
    })
  })

  it(
    'allows the same item name in two different categories (names are not identifiers)',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const first = await client.query<{ id: string }>(CALL.createItem, [
          menuCategoryIds.blueOliveStarters,
          'House Bread',
          null,
          3.0,
        ])
        const second = await client.query<{ id: string }>(CALL.createItem, [
          menuCategoryIds.blueOliveDesserts,
          'House Bread',
          null,
          3.0,
        ])
        expect(first.rows[0]?.id).not.toBe(second.rows[0]?.id)
      })
    },
  )

  it(
    'keeps an item’s identity — extras, availability, overrides, image — across edit and move',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // Chicken Tagine carries the Marina override; Lamb Kebab carries extras.
        const imagePath = `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.lambKebab}/plate.webp`
        await client.query(CALL.setItemImage, [menuItemIds.lambKebab, imagePath])
        await client.query(CALL.setItemAvailability, [menuItemIds.lambKebab, false])

        const moved = await client.query<{ id: string; category_id: string; image_path: string }>(
          CALL.moveItem,
          [menuItemIds.lambKebab, menuCategoryIds.blueOliveDesserts],
        )
        expect(moved.rows[0]?.category_id).toBe(menuCategoryIds.blueOliveDesserts)
        expect(moved.rows[0]?.image_path).toBe(imagePath)

        const extras = await client.query<{ count: string }>(
          'select count(*) from public.menu_item_extras where item_id = $1',
          [menuItemIds.lambKebab],
        )
        expect(Number(extras.rows[0]?.count)).toBe(3)

        const overrides = await client.query<{ count: string }>(
          'select count(*) from public.branch_unavailable_items where item_id = $1',
          [menuItemIds.chickenTagine],
        )
        expect(Number(overrides.rows[0]?.count)).toBe(1)

        // The edit keeps the identity too.
        const edited = await client.query<{ id: string; price: string; is_available: boolean }>(
          CALL.updateItem,
          [menuItemIds.lambKebab, 'Lamb Kebab Deluxe', null, 19.5],
        )
        expect(edited.rows[0]?.id).toBe(menuItemIds.lambKebab)
        expect(edited.rows[0]?.price).toBe('19.50')
        expect(edited.rows[0]?.is_available).toBe(false)

        // Move it back: the round trip changes nothing but the category.
        await client.query(CALL.moveItem, [menuItemIds.lambKebab, menuCategoryIds.blueOliveMains])
        const back = await client.query<{ category_id: string; image_path: string }>(
          'select category_id, image_path from public.menu_items where id = $1',
          [menuItemIds.lambKebab],
        )
        expect(back.rows[0]).toEqual({
          category_id: menuCategoryIds.blueOliveMains,
          image_path: imagePath,
        })
      })
    },
  )

  it('deletes a category only once it is empty', { timeout: 60_000 }, async () => {
    await asUser(client, authUserIds.alice, async () => {
      const category = await client.query<{ id: string }>(CALL.createCategory, [
        restaurantIds.blueOlive,
        'Seasonal',
        null,
      ])
      const categoryId = category.rows[0]?.id as string
      const item = await client.query<{ id: string }>(CALL.createItem, [
        categoryId,
        'Seasonal Plate',
        null,
        11.0,
      ])

      await expectRpcFailure('P0001', 'still contains items', CALL.deleteCategory, [categoryId])

      // Items are never deleted: the category is emptied by moving them out.
      await client.query(CALL.moveItem, [item.rows[0]?.id, menuCategoryIds.blueOliveDesserts])
      await client.query(CALL.deleteCategory, [categoryId])

      const remaining = await client.query('select 1 from public.menu_categories where id = $1', [
        categoryId,
      ])
      expect(remaining.rows).toHaveLength(0)
      // The moved item survived the deletion.
      const survivor = await client.query<{ category_id: string }>(
        'select category_id from public.menu_items where id = $1',
        [item.rows[0]?.id],
      )
      expect(survivor.rows[0]?.category_id).toBe(menuCategoryIds.blueOliveDesserts)
    })
  })

  it(
    'stores the submitted order exactly and reports it through the projection',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const submitted = [
          menuCategoryIds.blueOliveDrinks,
          menuCategoryIds.blueOliveStarters,
          menuCategoryIds.blueOliveMains,
          menuCategoryIds.blueOliveDesserts,
        ]
        await client.query(CALL.reorderCategories, [restaurantIds.blueOlive, submitted])

        const stored = await client.query<{ id: string; sort_order: number }>(
          `select id, sort_order from public.menu_categories
          where restaurant_id = $1 order by sort_order`,
          [restaurantIds.blueOlive],
        )
        expect(stored.rows.map((r) => [r.id, r.sort_order])).toEqual([
          [submitted[0], 1],
          [submitted[1], 2],
          [submitted[2], 3],
          [submitted[3], 4],
        ])

        const { rows } = await client.query<{
          get_branch_menu: { categories: Array<{ id: string }> }
        }>(CALL.branchMenu, [branchIds.downtown])
        expect(rows[0]?.get_branch_menu.categories.map((c) => c.id)).toEqual(submitted)

        const itemOrder = [
          menuItemIds.turkishCoffee,
          menuItemIds.stillWater,
          menuItemIds.mintLemonade,
        ]
        await client.query(CALL.reorderItems, [menuCategoryIds.blueOliveDrinks, itemOrder])
        const items = await client.query<{ id: string }>(
          `select id from public.menu_items where category_id = $1 order by sort_order, created_at, id`,
          [menuCategoryIds.blueOliveDrinks],
        )
        expect(items.rows.map((r) => r.id)).toEqual(itemOrder)

        const audit = await auditRows('action in ($1, $2)', [
          'menu.categories_reordered',
          'menu.items_reordered',
        ])
        expect(audit.map((r) => [r.action, r.resource_id])).toEqual([
          ['menu.categories_reordered', restaurantIds.blueOlive],
          ['menu.items_reordered', menuCategoryIds.blueOliveDrinks],
        ])
      })
    },
  )

  it(
    'writes nothing when a reorder submits the order already stored',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const stored = await client.query<{ id: string }>(
          `select id from public.menu_categories
          where restaurant_id = $1 order by sort_order, created_at, id`,
          [restaurantIds.blueOlive],
        )
        const ids = stored.rows.map((r) => r.id)
        await client.query(CALL.reorderCategories, [restaurantIds.blueOlive, ids])
        const audit = await auditRows('action = $1', ['menu.categories_reordered'])
        expect(audit).toHaveLength(0)
      })
    },
  )
})

describe('US2: availability semantics — the hard stop and the branch override (FR-012…FR-015)', () => {
  interface ProjectionItem {
    id: string
    name: string
    price: string
    is_offered: boolean
    unavailable_reason: 'restaurant' | 'branch' | null
  }

  /** The projected item as the database computed it for that branch. */
  async function projectionItem(branchId: string, itemId: string): Promise<ProjectionItem> {
    const { rows } = await client.query<{
      get_branch_menu: { categories: Array<{ items: ProjectionItem[] }> }
    }>(CALL.branchMenu, [branchId])
    for (const category of rows[0]?.get_branch_menu.categories ?? []) {
      for (const item of category.items) {
        if (item.id === itemId) {
          return item
        }
      }
    }
    throw new Error(`item ${itemId} absent from the projection of ${branchId}`)
  }

  it(
    'stops an item at every branch — an existing override cannot reverse it (FR-012, spec Edge Cases)',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // Chicken Tagine is available restaurant-wide with a Marina override.
        expect(
          (await projectionItem(branchIds.downtown, menuItemIds.chickenTagine)).is_offered,
        ).toBe(true)
        expect((await projectionItem(branchIds.marina, menuItemIds.chickenTagine)).is_offered).toBe(
          false,
        )

        await client.query(CALL.setItemAvailability, [menuItemIds.chickenTagine, false])

        // The hard stop wins at BOTH branches, and the reason is the restaurant.
        const marina = await projectionItem(branchIds.marina, menuItemIds.chickenTagine)
        expect(marina).toMatchObject({ is_offered: false, unavailable_reason: 'restaurant' })
        const downtown = await projectionItem(branchIds.downtown, menuItemIds.chickenTagine)
        expect(downtown).toMatchObject({ is_offered: false, unavailable_reason: 'restaurant' })

        // Marina's override row survives the stop (it simply has no effect).
        const override = await client.query(
          'select 1 from public.branch_unavailable_items where id = $1',
          ['00000000-0000-4000-8000-000000006042'],
        )
        expect(override.rows).toHaveLength(1)

        // Lifting the stop restores the override's effect: hidden at Marina only.
        await client.query(CALL.setItemAvailability, [menuItemIds.chickenTagine, true])
        expect(
          (await projectionItem(branchIds.marina, menuItemIds.chickenTagine)).unavailable_reason,
        ).toBe('branch')
        expect(
          (await projectionItem(branchIds.downtown, menuItemIds.chickenTagine)).is_offered,
        ).toBe(true)
      })
    },
  )

  it(
    'sets, repeats, and clears a branch override with exactly one record per change (FR-013, FR-024)',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.bob, async () => {
        const set = await client.query<{ set_branch_item_availability: boolean }>(
          CALL.setBranchAvailability,
          [branchIds.downtown, menuItemIds.hummus, false],
        )
        expect(set.rows[0]?.set_branch_item_availability).toBe(true)

        // The override hides the item at Downtown…
        expect(
          (await projectionItem(branchIds.downtown, menuItemIds.hummus)).unavailable_reason,
        ).toBe('branch')
        // …and exists nowhere else. Asserted through the owner connection: a
        // Downtown manager cannot read another branch's override rows, which
        // is itself the cross-branch isolation working.
        await client.query('set local role postgres')
        const elsewhere = await client.query(
          `select branch_id from public.branch_unavailable_items where item_id = $1`,
          [menuItemIds.hummus],
        )
        await client.query('set local role authenticated')
        expect(elsewhere.rows).toEqual([{ branch_id: branchIds.downtown }])

        // A repeat is an idempotent no-op — and writes nothing.
        const repeat = await client.query<{ set_branch_item_availability: boolean }>(
          CALL.setBranchAvailability,
          [branchIds.downtown, menuItemIds.hummus, false],
        )
        expect(repeat.rows[0]?.set_branch_item_availability).toBe(false)

        // Clearing returns the branch to the restaurant-wide state.
        const cleared = await client.query<{ set_branch_item_availability: boolean }>(
          CALL.setBranchAvailability,
          [branchIds.downtown, menuItemIds.hummus, true],
        )
        expect(cleared.rows[0]?.set_branch_item_availability).toBe(true)
        const clearedAgain = await client.query<{ set_branch_item_availability: boolean }>(
          CALL.setBranchAvailability,
          [branchIds.downtown, menuItemIds.hummus, true],
        )
        expect(clearedAgain.rows[0]?.set_branch_item_availability).toBe(false)
        expect((await projectionItem(branchIds.downtown, menuItemIds.hummus)).is_offered).toBe(true)

        const audit = await auditRows('action = $1', ['menu.branch_availability_changed'])
        expect(audit).toHaveLength(2)
        expect(audit.map((r) => r.reason)).toEqual([
          'branch availability: available -> unavailable',
          'branch availability: unavailable -> available',
        ])
        expect(audit.every((r) => r.branch_id === branchIds.downtown)).toBe(true)
      })
    },
  )

  it(
    'accepts an override on a stopped item but keeps it ineffective (spec Edge Cases)',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await client.query(CALL.setItemAvailability, [menuItemIds.grilledSeaBass, false])
      })
      await asUser(client, authUserIds.bob, async () => {
        // The item is already stopped restaurant-wide; the branch manager may
        // still record an override, and it changes nothing observable.
        const changed = await client.query<{ set_branch_item_availability: boolean }>(
          CALL.setBranchAvailability,
          [branchIds.downtown, menuItemIds.grilledSeaBass, false],
        )
        expect(changed.rows[0]?.set_branch_item_availability).toBe(true)
        const item = await projectionItem(branchIds.downtown, menuItemIds.grilledSeaBass)
        expect(item).toMatchObject({ is_offered: false, unavailable_reason: 'restaurant' })

        // Clearing it works normally (the row is removed).
        const cleared = await client.query<{ set_branch_item_availability: boolean }>(
          CALL.setBranchAvailability,
          [branchIds.downtown, menuItemIds.grilledSeaBass, true],
        )
        expect(cleared.rows[0]?.set_branch_item_availability).toBe(true)
      })
    },
  )

  it(
    'reports the offered subset with two-decimal prices for each branch (FR-014, SC-004)',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const { rows } = await client.query<{
          get_branch_menu: {
            categories: Array<{
              items: Array<{
                name: string
                price: string
                is_offered: boolean
                unavailable_reason: string | null
              }>
            }>
          }
        }>(CALL.branchMenu, [branchIds.marina])
        const items = (rows[0]?.get_branch_menu.categories ?? []).flatMap((c) => c.items)
        const offered = items.filter((i) => i.is_offered).map((i) => i.name)
        expect(offered).not.toContain('Grilled Sea Bass') // stopped restaurant-wide
        expect(offered).not.toContain('Chicken Tagine') // overridden at Marina
        expect(offered).toContain('Lamb Kebab')
        expect(items.every((i) => /^\d+\.\d{2}$/.test(i.price))).toBe(true)

        const downtownItems = (
          await client.query<{
            get_branch_menu: {
              categories: Array<{ items: Array<{ name: string; is_offered: boolean }> }>
            }
          }>(CALL.branchMenu, [branchIds.downtown])
        ).rows[0]?.get_branch_menu.categories.flatMap((c) => c.items)
        const downtownOffered = (downtownItems ?? []).filter((i) => i.is_offered).map((i) => i.name)
        expect(downtownOffered).toContain('Chicken Tagine') // no override here
        expect(downtownOffered).not.toContain('Grilled Sea Bass')
      })
    },
  )
})

describe('US3: price changes are recorded, unchanged saves are silent (FR-016, FR-017, SC-006)', () => {
  it(
    'records a price change as its own action with the before and after values',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // Grilled Sea Bass is seeded stopped at 24.00; only the price changes.
        const updated = await client.query<{ id: string; price: string; is_available: boolean }>(
          CALL.updateItem,
          [
            menuItemIds.grilledSeaBass,
            'Grilled Sea Bass',
            'Whole sea bass with olive oil, lemon, and seasonal greens.',
            24.5,
          ],
        )
        expect(updated.rows[0]?.price).toBe('24.50')
        expect(updated.rows[0]?.is_available).toBe(false)

        const audit = await auditRows('action like $1', ['menu.%'])
        expect(audit).toEqual([
          {
            actor_profile_id: profileIds.alice,
            action: 'menu.item_price_changed',
            resource_type: 'menu_item',
            resource_id: menuItemIds.grilledSeaBass,
            reason: 'price: 24.00 -> 24.50',
            restaurant_id: restaurantIds.blueOlive,
            branch_id: null,
          },
        ])
      })
    },
  )

  it(
    'records one record carrying every changed field, in field order',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await client.query(CALL.updateItem, [menuItemIds.hummus, 'Hummus Plate', null, 7.25])
        const audit = await auditRows('action like $1', ['menu.%'])
        expect(audit).toHaveLength(1)
        expect(audit[0]?.action).toBe('menu.item_price_changed')
        expect(audit[0]?.reason).toBe(
          'name: "Hummus" -> "Hummus Plate"; description: "Chickpea purée with tahini, olive oil, and warm pita." -> none; price: 6.50 -> 7.25',
        )
      })
    },
  )

  it(
    'stores an exact amount without drift and audits nothing when it is resaved',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const saved = await client.query<{ price: string }>(CALL.updateItem, [
          menuItemIds.hummus,
          'Hummus',
          'Chickpea purée with tahini, olive oil, and warm pita.',
          0.07,
        ])
        expect(saved.rows[0]?.price).toBe('0.07')

        const before = await client.query<{ updated_at: Date }>(
          'select updated_at from public.menu_items where id = $1',
          [menuItemIds.hummus],
        )
        const resaved = await client.query<{ price: string }>(CALL.updateItem, [
          menuItemIds.hummus,
          'Hummus',
          'Chickpea purée with tahini, olive oil, and warm pita.',
          0.07,
        ])
        expect(resaved.rows[0]?.price).toBe('0.07')
        const after = await client.query<{ updated_at: Date }>(
          'select updated_at from public.menu_items where id = $1',
          [menuItemIds.hummus],
        )
        expect(after.rows[0]?.updated_at).toEqual(before.rows[0]?.updated_at)

        // Exactly one record: the real change. The resave wrote nothing.
        const audit = await auditRows('action like $1', ['menu.%'])
        expect(audit.map((r) => [r.action, r.reason])).toEqual([
          ['menu.item_price_changed', 'price: 6.50 -> 0.07'],
        ])
      })
    },
  )

  it(
    'rejects three decimals rather than rounding them into the stored price (FR-010)',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await expectRpcFailure('P0001', 'at most two decimal places', CALL.updateItem, [
          menuItemIds.hummus,
          'Hummus',
          null,
          6.999,
        ])
        const stored = await client.query<{ price: string }>(
          'select price::text from public.menu_items where id = $1',
          [menuItemIds.hummus],
        )
        expect(stored.rows[0]?.price).toBe('6.50')
        const audit = await auditRows('action like $1', ['menu.%'])
        expect(audit).toHaveLength(0)
      })
    },
  )

  it(
    'keeps the price out of reach for every non-owner role (FR-003, SC-002)',
    { timeout: 60_000 },
    async () => {
      for (const authUserId of [
        authUserIds.bob,
        authUserIds.carla,
        authUserIds.dan,
        authUserIds.eve,
      ]) {
        await asUser(client, authUserId, async () => {
          await expectRpcFailure('42501', DENIED, CALL.updateItem, [
            menuItemIds.hummus,
            'Hummus',
            null,
            99.99,
          ])
        })
      }
      const stored = await client.query<{ price: string }>(
        'select price::text from public.menu_items where id = $1',
        [menuItemIds.hummus],
      )
      expect(stored.rows[0]?.price).toBe('6.50')
    },
  )
})

// ────────────────────────────────────────────────────────────────────────────
// US4: item-scoped extras — isolation, the 20 bound, audit, authorization
// (T035; FR-018, FR-019, FR-020, FR-024, FR-027)
// ────────────────────────────────────────────────────────────────────────────

describe('US4: item-scoped extras (FR-018…FR-020, FR-024, FR-027)', () => {
  it(
    'rejects a cross-item and cross-restaurant reference — the composite FK at the boundary',
    { timeout: 60_000 },
    async () => {
      await inTransaction(client, async () => {
        await client.query('set local role postgres')
        // Direct INSERT as the table owner: no policy or RPC can bless a row
        // whose (restaurant_id, item_id) pair is not a real item of that
        // restaurant. A foreign item's id fails the composite FK; a foreign
        // restaurant's id fails the (restaurant_id, item_id) match.
        await expectStatementToFail(
          client,
          '23503',
          `insert into public.menu_item_extras (restaurant_id, item_id, name, price_adjustment)
           values ($1, $2, 'Cross', 1.00)`,
          [restaurantIds.blueOlive, menuItemIds.cedarMixedGrill],
        )
        await expectStatementToFail(
          client,
          '23503',
          `insert into public.menu_item_extras (restaurant_id, item_id, name, price_adjustment)
           values ($1, $2, 'Cross', 1.00)`,
          [restaurantIds.cedarGrill, menuItemIds.hummus],
        )
      })
    },
  )

  it(
    'serializes concurrent adds through the item row lock (the bound cannot be raced)',
    { timeout: 120_000 },
    async () => {
      // Writer A holds the item's row lock (the exact lock the RPC takes) with
      // 20 UNCOMMITTED extras; writer B's add must WAIT — even though A's
      // extras are invisible to it — and re-check the bound only after A
      // commits. Without the lock, B would see zero extras and add past it.
      const second = createDbClient()
      await second.connect()
      let releaseA!: () => void
      let lockHeldA!: () => void
      const gate = new Promise<void>((resolve) => {
        releaseA = resolve
      })
      const lockHeld = new Promise<void>((resolve) => {
        lockHeldA = resolve
      })
      try {
        const writerA = (async () => {
          await client.query('begin')
          try {
            await client.query('select set_config($1, $2, true)', [
              'request.jwt.claims',
              JSON.stringify({ role: 'authenticated', sub: authUserIds.alice }),
            ])
            // Hold the lock the RPC takes.
            await client.query('select id from public.menu_items where id = $1 for update', [
              menuItemIds.hummus,
            ])
            lockHeldA()
            await client.query('set local role postgres')
            for (let i = 0; i < 20; i++) {
              await client.query(
                `insert into public.menu_item_extras
                   (restaurant_id, item_id, name, price_adjustment, sort_order)
                 values ($1, $2, $3, 1.00, $4)`,
                [restaurantIds.blueOlive, menuItemIds.hummus, `Lock filler ${i}`, i + 100],
              )
            }
            await gate
            await client.query('commit')
          } catch (error) {
            await client.query('rollback')
            throw error
          }
        })()

        // Start B only once A provably holds the lock.
        await lockHeld

        const writerB = asUser(second, authUserIds.alice, async () => {
          // The attempt blocks on A's lock; after A commits, the bound check
          // sees A's 20 extras and rejects the 21st.
          await second.query('savepoint writer_b_attempt')
          try {
            await second.query(CALL.addExtra, [menuItemIds.hummus, 'Second writer', 1.0])
          } catch (error) {
            await second.query('rollback to savepoint writer_b_attempt')
            const pgError = error as { code?: string; message: string }
            expect(pgError.code, pgError.message).toBe('P0001')
            expect(pgError.message).toContain('maximum of 20 extras')
            return
          }
          await second.query('rollback to savepoint writer_b_attempt')
          throw new Error('the 21st add was accepted while A held 20')
        })

        // B must still be blocked 2s in: it neither succeeded (it would have
        // if the check ran before the lock) nor failed fast.
        const settledEarly = await Promise.race([
          writerB.then(
            () => true,
            () => true,
          ),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2_000)),
        ])
        expect(settledEarly).toBe(false)

        releaseA()
        await writerA
        await writerB // now resolves with the bound rejection

        // Cleanup: A committed the fillers before releasing the lock.
        await client.query(
          "delete from public.menu_item_extras where item_id = $1 and name like 'Lock filler %'",
          [menuItemIds.hummus],
        )
        const count = await client.query<{ count: string }>(
          'select count(*)::text from public.menu_item_extras where item_id = $1',
          [menuItemIds.hummus],
        )
        expect(count.rows[0]?.count).toBe('0')
      } finally {
        releaseA()
        await second.end()
      }
    },
  )

  it(
    'accepts the 20th and rejects only the 21st (the boundary is inclusive)',
    { timeout: 120_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        for (let i = 0; i < 20; i++) {
          await client.query(CALL.addExtra, [menuItemIds.hummus, `Boundary ${i}`, 0.5])
        }
        const count = await client.query<{ count: string }>(
          'select count(*)::text from public.menu_item_extras where item_id = $1',
          [menuItemIds.hummus],
        )
        expect(count.rows[0]?.count).toBe('20')
        await expectRpcFailure('P0001', 'maximum of 20 extras', CALL.addExtra, [
          menuItemIds.hummus,
          'Boundary breaker',
          1.0,
        ])
        // And still 20 after the rejected attempt.
        const after = await client.query<{ count: string }>(
          'select count(*)::text from public.menu_item_extras where item_id = $1',
          [menuItemIds.hummus],
        )
        expect(after.rows[0]?.count).toBe('20')
      })
    },
  )

  it(
    'records the audit actions and leaves the other extras untouched on retire',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // Add.
        const added = await client.query<{ id: string; name: string; price_adjustment: string }>(
          CALL.addExtra,
          [menuItemIds.hummus, 'Pine nuts', 2.0],
        )
        const extraId = added.rows[0]?.id as string
        expect(added.rows[0]?.price_adjustment).toBe('2.00')

        // Update — unchanged save writes nothing; changed save audits once.
        const unchanged = await client.query(CALL.updateExtra, [extraId, 'Pine nuts', 2.0])
        expect(unchanged.rows[0]?.price_adjustment).toBe('2.00')
        const changed = await client.query(CALL.updateExtra, [extraId, 'Toasted pine nuts', 2.5])
        expect(changed.rows[0]?.name).toBe('Toasted pine nuts')

        const afterUpdate = await auditRows('action like $1 and resource_id = $2', [
          'menu.item_extra%',
          extraId,
        ])
        expect(afterUpdate.map((r) => [r.action, r.reason])).toEqual([
          ['menu.item_extra_added', null],
          [
            'menu.item_extra_updated',
            'name: "Pine nuts" -> "Toasted pine nuts"; price_adjustment: 2.00 -> 2.50',
          ],
        ])

        // Retire: the row goes; the item's OTHER extras stay.
        const siblingsBefore = await client.query<{ count: string }>(
          'select count(*)::text from public.menu_item_extras where item_id = $1',
          [menuItemIds.hummus],
        )
        const beforeCount = Number(siblingsBefore.rows[0]?.count ?? '0')
        await client.query(CALL.removeExtra, [extraId])
        const siblingsAfter = await client.query<{ count: string }>(
          'select count(*)::text from public.menu_item_extras where item_id = $1',
          [menuItemIds.hummus],
        )
        expect(Number(siblingsAfter.rows[0]?.count ?? '0')).toBe(beforeCount - 1)
        const gone = await client.query('select 1 from public.menu_item_extras where id = $1', [
          extraId,
        ])
        expect(gone.rows).toHaveLength(0)

        const afterRemove = await auditRows('action like $1 and resource_id = $2', [
          'menu.item_extra%',
          extraId,
        ])
        expect(afterRemove.map((r) => r.action)).toEqual([
          'menu.item_extra_added',
          'menu.item_extra_updated',
          'menu.item_extra_removed',
        ])
      })
    },
  )

  it(
    'denies a non-owner on every extras RPC and leaves the extras untouched',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        const before = await client.query<{ count: string }>(
          'select count(*)::text from public.menu_item_extras where item_id = $1',
          [menuItemIds.hummus],
        )
        const baseline = Number(before.rows[0]?.count ?? '0')

        for (const authUserId of [
          authUserIds.bob,
          authUserIds.carla,
          authUserIds.dan,
          authUserIds.eve,
        ]) {
          await asUser(client, authUserId, async () => {
            await expectRpcFailure('42501', DENIED, CALL.addExtra, [
              menuItemIds.hummus,
              'Denied extra',
              1.0,
            ])
            await expectRpcFailure('42501', DENIED, CALL.updateExtra, [
              menuExtraIds.lambExtraGarlicSauce,
              'Denied',
              2.0,
            ])
            await expectRpcFailure('42501', DENIED, CALL.removeExtra, [
              menuExtraIds.lambExtraGarlicSauce,
            ])
          })
        }

        const after = await client.query<{ count: string }>(
          'select count(*)::text from public.menu_item_extras where item_id = $1',
          [menuItemIds.hummus],
        )
        expect(Number(after.rows[0]?.count ?? '0')).toBe(baseline)
        // Lamb Kebab's seeded extras are likewise untouched.
        const lamb = await client.query<{ name: string }>(
          'select name from public.menu_item_extras where id = $1',
          [menuExtraIds.lambExtraGarlicSauce],
        )
        expect(lamb.rows[0]?.name).toBe('Extra garlic sauce')
      })
    },
  )
})

// ────────────────────────────────────────────────────────────────────────────
// US5: the image reference grammar, the previous-path protocol, audit, and
// the storage policies (T041; FR-021…FR-023, FR-024; contracts/menu-images.md)
// ────────────────────────────────────────────────────────────────────────────

const HUMMUS_IMAGE = `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}/550e8400-e29b-41d4-a716-446655440000.jpg`

describe('US5: the image reference (FR-021…FR-024, FR-027)', () => {
  it(
    "accepts the item's own grammar, returns the PREVIOUS path, and audits the change string",
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // First set: previous is null (nothing superseded → nothing to delete).
        const first = await client.query<{ set_menu_item_image: string | null }>(
          CALL.setItemImage,
          [menuItemIds.hummus, HUMMUS_IMAGE],
        )
        expect(first.rows[0]?.set_menu_item_image).toBeNull()

        // A second set supersedes: the RPC returns the OLD path so the client
        // can delete the old object through the Storage API.
        const second = await client.query<{ set_menu_item_image: string | null }>(
          CALL.setItemImage,
          [
            menuItemIds.hummus,
            `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}/b7c9d1e0-1111-4222-8333-444455556666.png`,
          ],
        )
        expect(second.rows[0]?.set_menu_item_image).toBe(HUMMUS_IMAGE)

        // Clearing is a real change too: it returns the previous path and
        // audits with the change string of data-model.md.
        const REPLACEMENT = `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}/b7c9d1e0-1111-4222-8333-444455556666.png`
        const cleared = await client.query<{ set_menu_item_image: string | null }>(
          CALL.setItemImage,
          [menuItemIds.hummus, null],
        )
        expect(cleared.rows[0]?.set_menu_item_image).toBe(REPLACEMENT)

        const audit = await auditRows('action = $1', ['menu.item_image_changed'])
        expect(audit.map((r) => r.reason)).toEqual([
          `image: none -> ${HUMMUS_IMAGE}`,
          `image: ${HUMMUS_IMAGE} -> ${REPLACEMENT}`,
          `image: ${REPLACEMENT} -> none`,
        ])
      })
    },
  )

  it(
    "rejects every path outside the item's own grammar with the boundary message",
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        // A foreign item's path (same restaurant).
        await expectRpcFailure('P0001', 'does not belong to this item', CALL.setItemImage, [
          menuItemIds.hummus,
          `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.lambKebab}/photo.jpg`,
        ])
        // A foreign restaurant's prefix.
        await expectRpcFailure('P0001', 'does not belong to this item', CALL.setItemImage, [
          menuItemIds.hummus,
          `restaurant/${restaurantIds.cedarGrill}/item/${menuItemIds.hummus}/photo.jpg`,
        ])
        // A disallowed extension.
        await expectRpcFailure('P0001', 'does not belong to this item', CALL.setItemImage, [
          menuItemIds.hummus,
          `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}/photo.gif`,
        ])
        // An over-long name (the grammar allows at most 120 characters).
        await expectRpcFailure('P0001', 'does not belong to this item', CALL.setItemImage, [
          menuItemIds.hummus,
          `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}/${'x'.repeat(121)}.png`,
        ])
        // A name with a separator (path traversal inside the item's prefix).
        await expectRpcFailure('P0001', 'does not belong to this item', CALL.setItemImage, [
          menuItemIds.hummus,
          `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}/../item/${menuItemIds.lambKebab}/photo.jpg`,
        ])

        // Nothing stuck: the item still has no image and no audit was written.
        const stored = await client.query<{ image_path: string | null }>(
          'select image_path from public.menu_items where id = $1',
          [menuItemIds.hummus],
        )
        expect(stored.rows[0]?.image_path).toBeNull()
        const audit = await auditRows('action = $1', ['menu.item_image_changed'])
        expect(audit).toHaveLength(0)
      })
    },
  )

  it(
    'keeps two items from sharing one object (the grammar + the partial unique index)',
    { timeout: 60_000 },
    async () => {
      await asUser(client, authUserIds.alice, async () => {
        await client.query(CALL.setItemImage, [menuItemIds.hummus, HUMMUS_IMAGE])

        // Through the RPC, another item can never reference the same object:
        // the path does not belong to its prefix.
        await expectRpcFailure('P0001', 'does not belong to this item', CALL.setItemImage, [
          menuItemIds.lambKebab,
          HUMMUS_IMAGE,
        ])

        // The declarative backstops: the per-row check makes any cross-item
        // path impossible, and the partial unique index would catch a
        // collision even if the check were ever relaxed.
        await client.query('set local role postgres')
        await expectStatementToFail(
          client,
          '23514',
          'update public.menu_items set image_path = $2 where id = $1',
          [menuItemIds.lambKebab, HUMMUS_IMAGE],
        )
        const { rows } = await client.query<{ indexdef: string }>(
          `select indexdef from pg_indexes
            where schemaname = 'public' and indexname = 'menu_items_image_path_key'`,
        )
        expect(rows[0]?.indexdef).toContain('UNIQUE')
        await client.query('set local role authenticated')
      })
    },
  )

  it(
    'denies a non-owner the image reference and leaves the item unchanged',
    { timeout: 60_000 },
    async () => {
      // One identity block per caller: each block is its own rolled-back
      // transaction (nested blocks would end the outer one).
      for (const authUserId of [
        authUserIds.bob,
        authUserIds.carla,
        authUserIds.dan,
        authUserIds.eve,
      ]) {
        await asUser(client, authUserId, async () => {
          await expectRpcFailure('42501', DENIED, CALL.setItemImage, [
            menuItemIds.hummus,
            `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}/replacement.png`,
          ])
          await expectRpcFailure('42501', DENIED, CALL.setItemImage, [menuItemIds.hummus, null])
        })
      }

      // The attempts wrote nothing.
      const untouched = await client.query<{ image_path: string | null }>(
        'select image_path from public.menu_items where id = $1',
        [menuItemIds.hummus],
      )
      expect(untouched.rows[0]?.image_path).toBeNull()

      // The owner still can set and clear within their own block.
      await asUser(client, authUserIds.alice, async () => {
        const set = await client.query<{ set_menu_item_image: string | null }>(CALL.setItemImage, [
          menuItemIds.hummus,
          HUMMUS_IMAGE,
        ])
        expect(set.rows[0]?.set_menu_item_image).toBeNull()
        const stored = await client.query<{ image_path: string | null }>(
          'select image_path from public.menu_items where id = $1',
          [menuItemIds.hummus],
        )
        expect(stored.rows[0]?.image_path).toBe(HUMMUS_IMAGE)
        await client.query(CALL.setItemImage, [menuItemIds.hummus, null])
      })
    },
  )

  it(
    'storage policies under a simulated identity: nothing is enumerable, out-of-scope inserts refused',
    { timeout: 60_000 },
    async () => {
      // No seeded item references an object, so NO identity may see any row of
      // the bucket: nothing is enumerable (contracts/menu-images.md §3.2).
      await asUser(client, authUserIds.alice, async () => {
        const { rows } = await client.query(
          "select name from storage.objects where bucket_id = 'menu-images'",
        )
        expect(rows).toHaveLength(0)
      })
      await asUser(client, authUserIds.eve, async () => {
        const { rows } = await client.query(
          "select name from storage.objects where bucket_id = 'menu-images'",
        )
        expect(rows).toHaveLength(0)
      })

      // Inserts are scoped to the caller's OWN restaurant prefix — even the
      // owner of the other restaurant is refused under Blue Olive's prefix.
      const attempt = 'insert into storage.objects (bucket_id, name) values ($1, $2)'
      await asUser(client, authUserIds.eve, async () => {
        await expectStatementToFail(client, '42501', attempt, [
          'menu-images',
          `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}/eve.png`,
        ])
      })
      await asUser(client, authUserIds.carla, async () => {
        await expectStatementToFail(client, '42501', attempt, [
          'menu-images',
          `restaurant/${restaurantIds.blueOlive}/item/${menuItemIds.hummus}/carla.png`,
        ])
      })
    },
  )
})
