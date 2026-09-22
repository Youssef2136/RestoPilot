import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The platform client unit suite (spec 014 T010; contracts/
 * database-functions.md §1–§3). One seam, mocked: `getSupabaseClient` — no
 * network, no DOM (the house node-environment method).
 *
 * The client must: pass parameters through verbatim, map RPC refusals to
 * PlatformPayloadError with the server's code (42501/P0001), and fail closed
 * on malformed payloads. The lifecycle STATE is the server's derivation —
 * the suite locks the payload passthrough, not a re-implementation.
 */

const harness = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: harness.rpc,
  }),
}))

const {
  PlatformPayloadError,
  getPlatformOverview,
  getMySubscription,
  setRestaurantPlatformDisabled,
  setSubscriptionDates,
} = await import('../../src/features/platform/platformClient')

afterEach(() => {
  harness.rpc.mockReset()
})

const GOOD_ROW = {
  restaurant_id: 'r-1',
  name: 'Blue Olive',
  slug: 'blue-olive',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  state: 'active',
  platform_disabled: false,
  platform_disabled_reason: null,
  branch_count: 2,
  staff_count: 5,
  session_count: 9,
  round_count: 21,
}

describe('getPlatformOverview', () => {
  it('T010-A returns the parsed rows on the happy path', async () => {
    harness.rpc.mockResolvedValueOnce({ data: [GOOD_ROW], error: null })
    const rows = await getPlatformOverview()
    expect(harness.rpc).toHaveBeenCalledWith('get_platform_overview')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.state).toBe('active')
    expect(rows[0]!.round_count).toBe(21)
  })

  it('T010-B maps a 42501 refusal through PlatformPayloadError', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'You do not have permission to view the platform console.' },
    })
    await expect(getPlatformOverview()).rejects.toMatchObject({
      code: '42501',
      name: 'PlatformPayloadError',
    })
  })

  it('T010-C fails closed on a malformed payload (missing keys)', async () => {
    harness.rpc.mockResolvedValueOnce({ data: [{ name: 'no id here' }], error: null })
    await expect(getPlatformOverview()).rejects.toMatchObject({ code: 'malformed' })
    harness.rpc.mockResolvedValueOnce({ data: null, error: null })
    await expect(getPlatformOverview()).rejects.toBeInstanceOf(PlatformPayloadError)
  })
})

describe('getMySubscription', () => {
  it('T010-D returns null for a null payload (no banner data)', async () => {
    harness.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await getMySubscription()).toBeNull()
  })

  it('T010-E returns the parsed payload with its server-derived state', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: { ...GOOD_ROW, state: 'nearing_expiration' },
      error: null,
    })
    const sub = await getMySubscription()
    expect(sub!.state).toBe('nearing_expiration')
    expect(sub!.platform_disabled).toBe(false)
  })
})

describe('the write RPCs', () => {
  it('T010-F setSubscriptionDates passes parameters verbatim', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: {
        restaurant_id: 'r-1',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        state: 'active',
      },
      error: null,
    })
    const result = await setSubscriptionDates({
      restaurantId: 'r-1',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    })
    expect(harness.rpc).toHaveBeenCalledWith('set_subscription_dates', {
      p_restaurant_id: 'r-1',
      p_start_date: '2026-01-01',
      p_end_date: '2026-12-31',
    })
    expect(result.state).toBe('active')
  })

  it('T010-G setRestaurantPlatformDisabled passes the reason through', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: { restaurant_id: 'r-1', platform_disabled: true, changed: true },
      error: null,
    })
    const result = await setRestaurantPlatformDisabled({
      restaurantId: 'r-1',
      disabled: true,
      reason: 'payment dispute',
    })
    expect(harness.rpc).toHaveBeenCalledWith('set_restaurant_platform_disabled', {
      p_restaurant_id: 'r-1',
      p_disabled: true,
      p_reason: 'payment dispute',
    })
    expect(result.changed).toBe(true)
  })

  it('T010-H maps a validation refusal (P0001) on the disable action', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'A reason is required to disable a restaurant.' },
    })
    await expect(
      setRestaurantPlatformDisabled({ restaurantId: 'r-1', disabled: true, reason: '' }),
    ).rejects.toMatchObject({ code: 'P0001' })
  })
})
