import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDbClient, expectStatementToFail } from './helpers/db'
import {
  authUserIds,
  branchIds,
  diningTableIds,
  menuCategoryIds,
  menuItemIds,
  restaurantIds,
} from './helpers/fixtures'

/**
 * Security: role bypass (spec 015 T004; FR-002; §25 area 2). The RBAC
 * matrix proven adversarially: every upward escalation across
 * cashier → kitchen → branch manager → owner is attempted on
 * representative operations of each level and refused with the contract
 * refusal (generic 42501 from the RPC, or grant-level 42501).
 *
 * Seeded identities: carla = cashier (Downtown), dan = kitchen (Marina),
 * bob = branch manager (Downtown), alice = owner (Blue Olive),
 * eve = owner (Cedar Grill).
 */
describe('security: role boundaries hold against privilege escalation (FR-002)', () => {
  const db = createDbClient()

  beforeAll(async () => {
    await db.connect()
  })

  afterAll(async () => {
    await db.end()
  })

  it('a cashier cannot perform kitchen, manager, or owner operations', async () => {
    await asUser(db, authUserIds.carla, async () => {
      // Kitchen-level: lifecycle transitions beyond her cashier reach.
      await expectStatementToFail(db, '42501', 'select start_preparation($1::uuid)', [
        '00000000-0000-4000-8000-000000009001',
      ])
      await expectStatementToFail(db, '42501', 'select mark_round_ready($1::uuid)', [
        '00000000-0000-4000-8000-000000009001',
      ])
      // Manager/owner-level: menu writes, staff management, restaurant
      // settings, reports.
      await expectStatementToFail(db, '42501', "select update_menu_category($1::uuid, 'X', null)", [
        menuCategoryIds.blueOliveMains,
      ])
      await expectStatementToFail(
        db,
        '42501',
        'select update_menu_item($1::uuid, $2, null, null)',
        [menuItemIds.lambKebab, 'X'],
      )
      await expectStatementToFail(
        db,
        '42501',
        "select add_staff_member($1::uuid, 'x@restopilot.dev', 'X', 'cashier', null)",
        [restaurantIds.blueOlive],
      )
      await expectStatementToFail(
        db,
        '42501',
        "select update_restaurant_settings($1::uuid, 'UTC')",
        [restaurantIds.blueOlive],
      )
      await expectStatementToFail(
        db,
        '42501',
        "select get_branch_sales_report($1::uuid, $2::uuid, 'day', current_date)",
        [restaurantIds.blueOlive, branchIds.downtown],
      )
      await expectStatementToFail(
        db,
        '42501',
        'select get_branch_void_report($1::uuid, $2::uuid, 10)',
        [restaurantIds.blueOlive, branchIds.downtown],
      )
      // Owner-level platform read: NULL for a non-owner (the banner's
      // owners-only contract — silence, not refusal).
      const mine = await db.query('select get_my_subscription() as m')
      expect(mine.rows[0].m).toBeNull()
    })
  })

  it('kitchen staff cannot perform cashier or manager operations', async () => {
    await asUser(db, authUserIds.dan, async () => {
      // Cashier-level lifecycle moves beyond kitchen: kitchen role is
      // refused outright (42501, 'You do not have permission to update
      // this round.') — the role guard fires before any state/existence
      // probe, so even unknown round ids leak nothing.
      await expectStatementToFail(db, '42501', 'select accept_round($1::uuid)', [
        '00000000-0000-4000-8000-000000009001',
      ])
      await expectStatementToFail(db, '42501', 'select lock_round($1::uuid)', [
        '00000000-0000-4000-8000-000000009001',
      ])
      // void_round's unknown ids share the generic P0001 with
      // unactionable rounds (the 009 indistinguishable posture), so the
      // role boundary is probed with the reason-validation order instead:
      // the empty reason refuses before anything else.
      await expectStatementToFail(db, 'P0001', 'select void_round($1::uuid, $2)', [
        '00000000-0000-4000-8000-000000009001',
        '',
      ])
      // Manager-level: branch/table management.
      await expectStatementToFail(db, '42501', "select rename_branch($1::uuid, 'X')", [
        branchIds.marina,
      ])
      await expectStatementToFail(db, '42501', 'select set_dining_table_active($1::uuid, false)', [
        diningTableIds.marinaT1,
      ])
      // Owner-level.
      await expectStatementToFail(
        db,
        '42501',
        "select update_restaurant_settings($1::uuid, 'UTC')",
        [restaurantIds.blueOlive],
      )
    })
  })

  it('a branch manager cannot reach the sibling branch or owner-only operations', async () => {
    await asUser(db, authUserIds.bob, async () => {
      // Sibling branch (Marina — bob manages Downtown only).
      await expectStatementToFail(
        db,
        '42501',
        "select get_branch_sales_report($1::uuid, $2::uuid, 'day', current_date)",
        [restaurantIds.blueOlive, branchIds.marina],
      )
      await expectStatementToFail(db, '42501', "select rename_branch($1::uuid, 'X')", [
        branchIds.marina,
      ])
      await expectStatementToFail(db, '42501', 'select set_dining_table_active($1::uuid, false)', [
        diningTableIds.marinaT1,
      ])
      // Owner-only: menu architecture, staff management, restaurant settings.
      await expectStatementToFail(db, '42501', "select update_menu_category($1::uuid, 'X', null)", [
        menuCategoryIds.blueOliveMains,
      ])
      await expectStatementToFail(
        db,
        '42501',
        'select update_menu_item($1::uuid, $2, null, null)',
        [menuItemIds.lambKebab, 'X'],
      )
      await expectStatementToFail(
        db,
        '42501',
        "select add_staff_member($1::uuid, 'x@restopilot.dev', 'X', 'cashier', null)",
        [restaurantIds.blueOlive],
      )
      await expectStatementToFail(
        db,
        '42501',
        "select update_restaurant_settings($1::uuid, 'UTC')",
        [restaurantIds.blueOlive],
      )
      // Platform-level: the tenant subscription read returns NULL for a
      // non-owner (the banner's contract — owners only, others silent),
      // and the console/writes are refused outright.
      const mine = await db.query('select get_my_subscription() as m')
      expect(mine.rows[0].m).toBeNull()
      await expectStatementToFail(db, '42501', 'select get_platform_overview()')
      await expectStatementToFail(
        db,
        '42501',
        'select set_subscription_dates($1::uuid, current_date, current_date + 30)',
        [restaurantIds.blueOlive],
      )
      await expectStatementToFail(
        db,
        '42501',
        "select set_restaurant_platform_disabled($1::uuid, true, 'attack')",
        [restaurantIds.cedarGrill],
      )
    })
  })

  it('the cashier boundary inside her own branch stays exactly cashier-wide (positive control)', async () => {
    // Positive control: carla's OWN authority works on her branch — the
    // suite proves the boundaries are role-scoped, not identity-scoped.
    await asUser(db, authUserIds.carla, async () => {
      const r = await db.query('select get_branch_open_sessions($1) as s', [branchIds.downtown])
      expect(Array.isArray(r.rows[0].s.sessions)).toBe(true)
      expect(r.rows[0].s.sessions.length).toBeGreaterThan(0)
    })
  })
})
