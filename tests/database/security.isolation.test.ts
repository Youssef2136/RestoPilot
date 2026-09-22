import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asUser, createDbClient, expectStatementToFail } from './helpers/db'
import {
  authUserIds,
  branchIds,
  devSessionTokens,
  diningTableIds,
  menuCategoryIds,
  menuItemIds,
  restaurantIds,
} from './helpers/fixtures'

/**
 * Security: tenant isolation (spec 015 T003; FR-001; §25 area 1). Every
 * probe drives a REAL role — alice (Blue Olive owner), eve (Cedar Grill
 * owner), anon — through the house wrappers (each call runs its own
 * rolled-back transaction), and asserts the attempt is REFUSED with the
 * generic 42501 / documented P0001 text. Both directions: Blue Olive →
 * Cedar Grill AND Cedar Grill → Blue Olive.
 */
describe('security: tenant isolation holds under direct attack (FR-001)', () => {
  const db = createDbClient()

  beforeAll(async () => {
    await db.connect()
  })

  afterAll(async () => {
    await db.end()
  })

  it('an owner cannot reach the other restaurant through staff RPCs', async () => {
    // alice (Blue Olive owner) against Cedar Grill surfaces.
    await asUser(db, authUserIds.alice, async () => {
      // Menu management (Cedar Grill's category + item).
      await expectStatementToFail(
        db,
        '42501',
        "select update_menu_category($1::uuid, 'Hacked', null)",
        [menuCategoryIds.cedarGrillGrill],
      )
      await expectStatementToFail(
        db,
        '42501',
        'select update_menu_item($1::uuid, $2, null, null)',
        [menuItemIds.cedarMixedGrill, 'Hacked'],
      )
      // Branch + table management (Cedar Grill's Airport branch).
      await expectStatementToFail(db, '42501', "select rename_branch($1::uuid, 'Hacked')", [
        branchIds.airport,
      ])
      await expectStatementToFail(db, '42501', 'select create_dining_table($1::uuid, $2)', [
        branchIds.airport,
        'H4CK',
      ])
      await expectStatementToFail(db, '42501', 'select set_dining_table_active($1::uuid, false)', [
        diningTableIds.airportT1,
      ])
      // Staff management (eve's Cedar Grill membership).
      await expectStatementToFail(
        db,
        '42501',
        "select add_staff_member($1::uuid, 'hacker@restopilot.dev', 'Hacker', 'cashier', null)",
        [restaurantIds.cedarGrill],
      )
      // Reports (Cedar Grill figures).
      await expectStatementToFail(
        db,
        '42501',
        "select get_branch_sales_report($1::uuid, $2::uuid, 'day', current_date)",
        [restaurantIds.cedarGrill, branchIds.airport],
      )
      await expectStatementToFail(
        db,
        '42501',
        'select get_branch_void_report($1::uuid, $2::uuid, 10)',
        [restaurantIds.cedarGrill, branchIds.airport],
      )
      // Restaurant settings.
      await expectStatementToFail(
        db,
        '42501',
        "select update_restaurant_settings($1::uuid, 'UTC')",
        [restaurantIds.cedarGrill],
      )
    })

    // The reverse direction: eve (Cedar Grill owner) against Blue Olive.
    await asUser(db, authUserIds.eve, async () => {
      await expectStatementToFail(db, '42501', "select rename_branch($1::uuid, 'Hacked')", [
        branchIds.downtown,
      ])
      await expectStatementToFail(
        db,
        '42501',
        "select update_menu_category($1::uuid, 'Hacked', null)",
        [menuCategoryIds.blueOliveMains],
      )
      await expectStatementToFail(
        db,
        '42501',
        'select update_menu_item($1::uuid, $2, null, null)',
        [menuItemIds.lambKebab, 'Hacked'],
      )
      // close_session takes a SESSION id — eve must first reach the Blue
      // Olive session's id to attack it; close_session itself verifies
      // staff scope on the session's branch before acting.
      await expectStatementToFail(db, '42501', 'select close_session($1::uuid)', [
        '00000000-0000-4000-8000-000000007001',
      ])
      await expectStatementToFail(
        db,
        '42501',
        "select get_branch_sales_report($1::uuid, $2::uuid, 'day', current_date)",
        [restaurantIds.blueOlive, branchIds.downtown],
      )
    })
  })

  it('a customer token can only ever see its own session', async () => {
    // Token-scoped reads return exactly the token's own session — never
    // another table's or restaurant's data (shape assertion, not refusal).
    await asAnon(db, async () => {
      const ctx = await db.query('select get_session_context($1) as c', [
        devSessionTokens.downtownT1,
      ])
      const session = ctx.rows[0].c.session
      expect(session.table_id).toBe(diningTableIds.downtownT1)
      expect(session.branch_id).toBe(branchIds.downtown)
      expect(session.restaurant_id).toBe(restaurantIds.blueOlive)
    })
  })

  it('privileged table writes are refused for staff of the other tenant', async () => {
    await asUser(db, authUserIds.alice, async () => {
      // Direct table writes against Cedar Grill rows: RLS denies.
      await expectStatementToFail(
        db,
        '42501',
        'update public.branches set name = $1 where id = $2',
        ['Hacked', branchIds.airport],
      )
      await expectStatementToFail(
        db,
        '42501',
        'update public.menu_items set is_available = false where id = $1',
        [menuItemIds.cedarMixedGrill],
      )
      await expectStatementToFail(db, '42501', 'delete from public.branches where id = $1', [
        branchIds.airport,
      ])
      // Even reads of the other tenant's rows return nothing (RLS SELECT).
      const r = await db.query('select count(*)::int as n from public.branches where id = $1', [
        branchIds.airport,
      ])
      expect(r.rows[0].n).toBe(0)
    })
  })
})

/**
 * Security: audit integrity (spec 015 T003b; FR-006; §25 area 7). The trail
 * is append-only through EVERY door: grants, RLS, and the RPC surface.
 */
describe('security: the audit trail is append-only (FR-006)', () => {
  const db = createDbClient()

  beforeAll(async () => {
    await db.connect()
  })

  afterAll(async () => {
    await db.end()
  })

  it('anon and authenticated cannot write audit rows directly (grants + RLS)', async () => {
    await asAnon(db, async () => {
      await expectStatementToFail(
        db,
        '42501',
        `insert into public.audit_log (actor_profile_id, action, resource_type, resource_id, restaurant_id)
         values (null, 'forged.action', 'restaurant', 'x', $1)`,
        [restaurantIds.blueOlive],
      )
      await expectStatementToFail(db, '42501', 'update public.audit_log set action = $1', [
        'forged.action',
      ])
      await expectStatementToFail(db, '42501', 'delete from public.audit_log', [])
    })

    await asUser(db, authUserIds.alice, async () => {
      await expectStatementToFail(
        db,
        '42501',
        `insert into public.audit_log (actor_profile_id, action, resource_type, resource_id, restaurant_id)
         values (null, 'forged.action', 'restaurant', 'x', $1)`,
        [restaurantIds.blueOlive],
      )
      await expectStatementToFail(db, '42501', 'update public.audit_log set action = $1', [
        'forged.action',
      ])
      await expectStatementToFail(db, '42501', 'delete from public.audit_log', [])
    })
  })

  it('the customer journey writes no audit rows; the token path stays read-validated', async () => {
    // The audit count is read through the PRIVILEGED connection (anon has
    // no grant — that denial is asserted in the block above).
    const before = await db.query('select count(*)::int as n from public.audit_log')
    await asAnon(db, async () => {
      await db.query('select get_session_context($1)', [devSessionTokens.downtownT1])
      await db.query('select get_session_menu($1)', [devSessionTokens.downtownT1])
      // An invalid cart (quantity 0) is refused by validation — and the
      // attempt writes nothing anywhere (the failure is server-side only).
      await expectStatementToFail(db, 'P0001', 'select submit_round($1, $2::jsonb)', [
        devSessionTokens.downtownT1,
        JSON.stringify([{ item_id: menuItemIds.lambKebab, quantity: '0', extras: [] }]),
      ])
    })
    const after = await db.query('select count(*)::int as n from public.audit_log')
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })
})
