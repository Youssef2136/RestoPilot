import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Management client unit suite (spec 004 FR-022; contracts/management-client.md
 * §1/§5): the single client module's result shaping and its three-way error
 * mapping.
 *
 * The mocked seam is `getSupabaseClient` only: each wrapper's one RPC round
 * trip is captured verbatim (RPC name + contract parameter names), and
 * responses are replayed so every outcome class is asserted without a network.
 * The mapping contract: SQLSTATE `42501` ⇒ the module's generic denial
 * message, `P0001` ⇒ the server's message VERBATIM, anything else (and a
 * thrown/rejected request) ⇒ the generic retry message. A raw database error
 * never reaches the caller — the module exposes no other failure shape.
 */

const harness = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: harness.rpc }),
}))

import {
  managementClient,
  MANAGEMENT_DENIED_MESSAGE,
  MANAGEMENT_RETRY_MESSAGE,
} from '../../src/features/management/managementClient'

/** The default recorded RPC response (the stored row these RPCs return). */
const SUCCESS = { data: { marker: 'stored-row' }, error: null }

beforeEach(() => {
  harness.rpc.mockReset()
  harness.rpc.mockResolvedValue(SUCCESS)
})

/** The single recorded RPC call: [name, parameters]. */
function recordedCall(): [string, Record<string, unknown>] {
  const calls = harness.rpc.mock.calls
  expect(calls).toHaveLength(1)
  return calls[0] as [string, Record<string, unknown>]
}

describe('result shaping (contract §1)', () => {
  it('success ⇒ { ok: true, data } with the RPC row passed through unchanged', async () => {
    const result = await managementClient.updateRestaurantSettings({
      restaurantId: 'restaurant-1',
      timezone: 'Europe/Lisbon',
    })
    expect(result).toEqual({ ok: true, data: SUCCESS.data })
  })

  it('a set-returning response passes through unchanged (replaceBranchWorkingHours)', async () => {
    const rows = [
      { weekday: 'monday', open_time: '11:00:00', close_time: '15:00:00' },
      { weekday: 'monday', open_time: '18:00:00', close_time: '02:00:00' },
    ]
    harness.rpc.mockResolvedValue({ data: rows, error: null })
    const result = await managementClient.replaceBranchWorkingHours({
      branchId: 'branch-1',
      intervals: [],
    })
    expect(result).toEqual({ ok: true, data: rows })
  })

  it('a successful response without a payload is a protocol anomaly ⇒ the retry message', async () => {
    harness.rpc.mockResolvedValue({ data: null, error: null })
    const result = await managementClient.createRestaurant({ name: 'N', slug: 'n' })
    expect(result).toEqual({ ok: false, message: MANAGEMENT_RETRY_MESSAGE })
  })
})

describe('error mapping (contract §1/§5)', () => {
  it('42501 ⇒ the module’s generic denial — never the database text', async () => {
    harness.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied for function create_restaurant' },
    })
    const result = await managementClient.createRestaurant({ name: 'N', slug: 'n' })
    expect(result).toEqual({ ok: false, message: MANAGEMENT_DENIED_MESSAGE })
    expect(JSON.stringify(result)).not.toContain('permission denied')
  })

  it('P0001 ⇒ the server’s message verbatim', async () => {
    const serverMessage = 'This public identifier is already in use by another restaurant.'
    harness.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: serverMessage },
    })
    const result = await managementClient.updateRestaurantProfile({
      restaurantId: 'restaurant-1',
      name: 'Blue Olive',
      slug: 'blue-olive',
    })
    expect(result).toEqual({ ok: false, message: serverMessage })
  })

  it('any other SQLSTATE ⇒ the generic retry message — a raw constraint error never surfaces', async () => {
    harness.rpc.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "restaurants_slug_key"',
      },
    })
    const result = await managementClient.createRestaurant({ name: 'N', slug: 'blue-olive' })
    expect(result).toEqual({ ok: false, message: MANAGEMENT_RETRY_MESSAGE })
    expect(JSON.stringify(result)).not.toContain('constraint')
  })

  it('a rejected request (client-side failure) ⇒ the generic retry message', async () => {
    harness.rpc.mockRejectedValue(new Error('fetch failed'))
    const result = await managementClient.createRestaurant({ name: 'N', slug: 'n' })
    expect(result).toEqual({ ok: false, message: MANAGEMENT_RETRY_MESSAGE })
  })
})

describe('payload shaping: one RPC per operation with the contract parameter names', () => {
  it('createRestaurant ⇒ create_restaurant with every provided field', async () => {
    await managementClient.createRestaurant({
      name: 'Blue Olive',
      slug: 'blue-olive',
      brandDescription: 'Wood-fired Mediterranean plates.',
      contactEmail: 'hello@blue-olive.example',
      contactPhone: '+351 21 555 0100',
      timezone: 'Europe/Lisbon',
    })
    expect(recordedCall()).toEqual([
      'create_restaurant',
      {
        p_name: 'Blue Olive',
        p_slug: 'blue-olive',
        p_brand_description: 'Wood-fired Mediterranean plates.',
        p_contact_email: 'hello@blue-olive.example',
        p_contact_phone: '+351 21 555 0100',
        p_timezone: 'Europe/Lisbon',
      },
    ])
  })

  it('createRestaurant leaves unspecified optional fields undefined (no fabricated values)', async () => {
    await managementClient.createRestaurant({ name: 'N', slug: 'n' })
    expect(recordedCall()).toEqual([
      'create_restaurant',
      {
        p_name: 'N',
        p_slug: 'n',
        p_brand_description: undefined,
        p_contact_email: undefined,
        p_contact_phone: undefined,
        p_timezone: undefined,
      },
    ])
  })

  it('updateRestaurantProfile ⇒ update_restaurant_profile', async () => {
    await managementClient.updateRestaurantProfile({
      restaurantId: 'restaurant-1',
      name: 'Blue Olive',
      slug: 'blue-olive',
      brandDescription: 'Brand',
      contactEmail: 'hello@blue-olive.example',
      contactPhone: '+351 21 555 0100',
    })
    expect(recordedCall()).toEqual([
      'update_restaurant_profile',
      {
        p_restaurant_id: 'restaurant-1',
        p_name: 'Blue Olive',
        p_slug: 'blue-olive',
        p_brand_description: 'Brand',
        p_contact_email: 'hello@blue-olive.example',
        p_contact_phone: '+351 21 555 0100',
      },
    ])
  })

  it('updateRestaurantSettings ⇒ update_restaurant_settings', async () => {
    await managementClient.updateRestaurantSettings({
      restaurantId: 'restaurant-1',
      timezone: 'Europe/Madrid',
    })
    expect(recordedCall()).toEqual([
      'update_restaurant_settings',
      { p_restaurant_id: 'restaurant-1', p_timezone: 'Europe/Madrid' },
    ])
  })

  it('createBranch ⇒ create_branch', async () => {
    await managementClient.createBranch({ restaurantId: 'restaurant-1', name: 'Downtown' })
    expect(recordedCall()).toEqual([
      'create_branch',
      { p_restaurant_id: 'restaurant-1', p_name: 'Downtown' },
    ])
  })

  it('renameBranch ⇒ rename_branch', async () => {
    await managementClient.renameBranch({ branchId: 'branch-1', name: 'Marina' })
    expect(recordedCall()).toEqual(['rename_branch', { p_branch_id: 'branch-1', p_name: 'Marina' }])
  })

  it('replaceBranchWorkingHours ⇒ replace_branch_working_hours with the intervals array', async () => {
    const intervals = [
      { weekday: 'monday' as const, open_time: '11:00', close_time: '15:00' },
      { weekday: 'monday' as const, open_time: '18:00', close_time: '02:00' },
    ]
    await managementClient.replaceBranchWorkingHours({ branchId: 'branch-1', intervals })
    expect(recordedCall()).toEqual([
      'replace_branch_working_hours',
      { p_branch_id: 'branch-1', p_intervals: intervals },
    ])
  })

  it('createDiningTable ⇒ create_dining_table', async () => {
    await managementClient.createDiningTable({ branchId: 'branch-1', label: 'T1' })
    expect(recordedCall()).toEqual([
      'create_dining_table',
      { p_branch_id: 'branch-1', p_label: 'T1' },
    ])
  })

  it('renameDiningTable ⇒ rename_dining_table', async () => {
    await managementClient.renameDiningTable({ diningTableId: 'table-1', label: 'T2' })
    expect(recordedCall()).toEqual([
      'rename_dining_table',
      { p_dining_table_id: 'table-1', p_label: 'T2' },
    ])
  })

  it('setDiningTableActive ⇒ set_dining_table_active', async () => {
    await managementClient.setDiningTableActive({ diningTableId: 'table-1', active: false })
    expect(recordedCall()).toEqual([
      'set_dining_table_active',
      { p_dining_table_id: 'table-1', p_active: false },
    ])
  })

  it('addStaffMember ⇒ add_staff_member with the branch for a branch-scoped role', async () => {
    await managementClient.addStaffMember({
      restaurantId: 'restaurant-1',
      email: 'worker@restopilot.dev',
      displayName: 'Worker',
      role: 'cashier',
      branchId: 'branch-1',
    })
    expect(recordedCall()).toEqual([
      'add_staff_member',
      {
        p_restaurant_id: 'restaurant-1',
        p_email: 'worker@restopilot.dev',
        p_display_name: 'Worker',
        p_role: 'cashier',
        p_branch_id: 'branch-1',
      },
    ])
  })

  it('addStaffMember leaves the branch undefined for an owner (no fabricated value)', async () => {
    await managementClient.addStaffMember({
      restaurantId: 'restaurant-1',
      email: 'owner@restopilot.dev',
      displayName: 'Second Owner',
      role: 'owner',
    })
    expect(recordedCall()).toEqual([
      'add_staff_member',
      {
        p_restaurant_id: 'restaurant-1',
        p_email: 'owner@restopilot.dev',
        p_display_name: 'Second Owner',
        p_role: 'owner',
        p_branch_id: undefined,
      },
    ])
  })

  it('updateStaffMembership ⇒ update_staff_membership', async () => {
    await managementClient.updateStaffMembership({
      membershipId: 'membership-1',
      role: 'kitchen',
      branchId: 'branch-2',
    })
    expect(recordedCall()).toEqual([
      'update_staff_membership',
      { p_membership_id: 'membership-1', p_role: 'kitchen', p_branch_id: 'branch-2' },
    ])
  })

  it('removeStaffMembership ⇒ remove_staff_membership', async () => {
    await managementClient.removeStaffMembership({ membershipId: 'membership-1' })
    expect(recordedCall()).toEqual(['remove_staff_membership', { p_membership_id: 'membership-1' }])
  })
})

describe('staff credential handling (contract §1/§4.3; FR-013)', () => {
  it('the add_staff_member payload passes through verbatim — the credential is returned once, untouched', async () => {
    const payload = {
      membership: {
        id: 'membership-1',
        profile_id: 'profile-1',
        restaurant_id: 'restaurant-1',
        role: 'cashier',
        branch_id: 'branch-1',
      },
      profile_id: 'profile-1',
      person_created: true,
      temporary_password: '4d476ad241508f8f62e99ddd',
    }
    harness.rpc.mockResolvedValue({ data: payload, error: null })
    const result = await managementClient.addStaffMember({
      restaurantId: 'restaurant-1',
      email: 'worker@restopilot.dev',
      displayName: 'Worker',
      role: 'cashier',
      branchId: 'branch-1',
    })
    expect(result).toEqual({ ok: true, data: payload })
  })

  it('an existing person is linked with temporary_password null (no credential issued)', async () => {
    const payload = {
      membership: {
        id: 'membership-2',
        profile_id: 'profile-2',
        restaurant_id: 'restaurant-1',
        role: 'owner',
        branch_id: null,
      },
      profile_id: 'profile-2',
      person_created: false,
      temporary_password: null,
    }
    harness.rpc.mockResolvedValue({ data: payload, error: null })
    const result = await managementClient.addStaffMember({
      restaurantId: 'restaurant-1',
      email: 'existing@restopilot.dev',
      displayName: 'Existing',
      role: 'owner',
    })
    expect(result).toEqual({ ok: true, data: payload })
  })

  it('the void removal succeeds on a payload-less response (no false anomaly)', async () => {
    // `remove_staff_membership` returns void: PostgREST answers without a row,
    // and success must be the absence of an error.
    harness.rpc.mockResolvedValue({ data: null, error: null })
    const result = await managementClient.removeStaffMembership({ membershipId: 'membership-1' })
    expect(result).toEqual({ ok: true, data: undefined })
  })

  it('a rejected removal (last owner) surfaces the server message — no raw error', async () => {
    harness.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'A restaurant always keeps at least one owner.' },
    })
    const result = await managementClient.removeStaffMembership({ membershipId: 'membership-1' })
    expect(result).toEqual({ ok: false, message: 'A restaurant always keeps at least one owner.' })
  })
})
