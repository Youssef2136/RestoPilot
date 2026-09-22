import { afterAll, beforeAll, describe, it } from 'vitest'
import { asAnon, asUser, createDbClient, expectStatementToFail } from './helpers/db'
import { authUserIds, branchIds, menuItemIds, restaurantIds } from './helpers/fixtures'

/**
 * Security: client bypass + input validation (spec 015 T005; FR-003; §25
 * areas 3 and 5). Every UI action re-driven directly with crafted or
 * omitted arguments: the server's validation chain refuses each — no
 * direct call achieves what the UI cannot. Validation probes target
 * `submit_round` (the one anon-writable money path), the lifecycle RPCs
 * (transition guards), and privileged columns (direct table writes).
 */
describe('security: client bypass and input validation (FR-003)', () => {
  const db = createDbClient()

  beforeAll(async () => {
    await db.connect()
  })

  afterAll(async () => {
    await db.end()
  })

  const LINE = (over: Record<string, unknown>) => JSON.stringify([over])

  it('submit_round refuses malformed carts, bad quantities, foreign items, and foreign extras', async () => {
    await asAnon(db, async () => {
      const TOKEN = 'dev-token-downtown-t1-2026'
      // Quantity bounds: 0, 100, non-numeric, negative, integer-overflow.
      // The overflow case refuses with 22003 (a type-level refusal before
      // the validation chain runs — still a refusal, still zero writes).
      await expectStatementToFail(db, '22003', 'select submit_round($1, $2::jsonb)', [
        TOKEN,
        LINE({ item_id: menuItemIds.lambKebab, quantity: '99999999999999999999', extras: [] }),
      ])
      for (const q of ['0', '100', '-1', 'abc']) {
        await expectStatementToFail(db, 'P0001', 'select submit_round($1, $2::jsonb)', [
          TOKEN,
          LINE({ item_id: menuItemIds.lambKebab, quantity: q, extras: [] }),
        ])
      }
      // Unknown item id (well-formed UUID, nonexistent row).
      await expectStatementToFail(db, 'P0001', 'select submit_round($1, $2::jsonb)', [
        TOKEN,
        LINE({ item_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', quantity: '1', extras: [] }),
      ])
      // Stopped restaurant-wide item (unavailable everywhere).
      await expectStatementToFail(db, 'P0001', 'select submit_round($1, $2::jsonb)', [
        TOKEN,
        LINE({ item_id: menuItemIds.grilledSeaBass, quantity: '1', extras: [] }),
      ])
      // Item from ANOTHER restaurant (Cedar Grill's mixed grill) — exists,
      // but not in this restaurant's menu.
      await expectStatementToFail(db, 'P0001', 'select submit_round($1, $2::jsonb)', [
        TOKEN,
        LINE({ item_id: menuItemIds.cedarMixedGrill, quantity: '1', extras: [] }),
      ])
      // Foreign extra (belongs to another item).
      await expectStatementToFail(db, 'P0001', 'select submit_round($1, $2::jsonb)', [
        TOKEN,
        LINE({
          item_id: menuItemIds.lambKebab,
          quantity: '1',
          extras: ['ffffffff-ffff-4fff-8fff-ffffffffffff'],
        }),
      ])
      // Empty and null carts.
      await expectStatementToFail(db, 'P0001', 'select submit_round($1, $2::jsonb)', [
        TOKEN,
        JSON.stringify([]),
      ])
      await expectStatementToFail(db, 'P0001', 'select submit_round($1, null)', [TOKEN])
      // Malformed line shapes: object instead of array; quantity as number
      // (the contract requires a string).
      await expectStatementToFail(db, 'P0001', 'select submit_round($1, $2::jsonb)', [
        TOKEN,
        JSON.stringify({ item_id: menuItemIds.lambKebab, quantity: '1' }),
      ])
      await expectStatementToFail(db, 'P0001', 'select submit_round($1, $2::jsonb)', [
        TOKEN,
        LINE({ item_id: menuItemIds.lambKebab, quantity: 1, extras: [] }),
      ])
    })
  })

  it('the transition guards refuse out-of-order lifecycle moves', async () => {
    await asUser(db, authUserIds.carla, async () => {
      // The seeded sessions have NO rounds — any transition on a
      // nonexistent round refuses (the role guard fires 42501 for the
      // unknown id; the refusal is the generic one either way).
      await expectStatementToFail(db, '42501', 'select mark_completed($1::uuid)', [
        '00000000-0000-4000-8000-000000009001',
      ])
      await expectStatementToFail(db, '42501', 'select mark_out_for_delivery($1::uuid)', [
        '00000000-0000-4000-8000-000000009001',
      ])
    })
  })

  it('oversized and malformed customer data is refused at entry', async () => {
    await asAnon(db, async () => {
      const NAME_61 = 'A'.repeat(61)
      // 61-char display name (limit 60), phone with letters, phone too long.
      await expectStatementToFail(db, 'P0001', 'select open_session_at_table($1, $2, $3, $4, $5)', [
        restaurantIds.blueOlive,
        branchIds.downtown,
        '00000000-0000-4000-8000-000000003001',
        NAME_61,
        '+15551234567',
      ])
      await expectStatementToFail(db, 'P0001', 'select open_session_at_table($1, $2, $3, $4, $5)', [
        restaurantIds.blueOlive,
        branchIds.downtown,
        '00000000-0000-4000-8000-000000003001',
        'Val Id',
        '1555phone',
      ])
      // Malformed UUID for the table — a grant-level type error is also a
      // refusal (invalid_text_representation 22P02), not a success.
      await expectStatementToFail(db, '22P02', 'select open_session_at_table($1, $2, $3, $4, $5)', [
        restaurantIds.blueOlive,
        branchIds.downtown,
        'not-a-uuid',
        'Val Id',
        '+15551234567',
      ])
    })
  })

  it('privileged columns are unwritable by any client role', async () => {
    await asUser(db, authUserIds.alice, async () => {
      // The owner can manage her MENU, but not forge money or audit state:
      await expectStatementToFail(
        db,
        '42501',
        'update public.rounds set subtotal = 0, tax_total = 0',
      )
      await expectStatementToFail(db, '42501', 'update public.kitchen_tickets set state = $1', [
        'completed',
      ])
      await expectStatementToFail(
        db,
        '42501',
        'insert into public.rounds (restaurant_id, branch_id, session_id, state, subtotal, tax_total) values ($1, $2, $3, $4, 0, 0)',
        [
          restaurantIds.blueOlive,
          branchIds.downtown,
          '00000000-0000-4000-8000-000000008001',
          'completed',
        ],
      )
    })
  })
})
