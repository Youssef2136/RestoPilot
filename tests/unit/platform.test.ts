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
  onboardRestaurant,
  setRestaurantPlatformDisabled,
  setSubscriptionDates,
} = await import('../../src/features/platform/platformClient')

afterEach(() => {
  harness.rpc.mockReset()
})

describe('onboardRestaurant (spec 019 T010)', () => {
  const GOOD_PAYLOAD = {
    restaurant_id: 'r-new',
    name: 'Harbor Cafe',
    slug: 'harbor-cafe',
    owner: {
      profile_id: 'p-new',
      email: 'owner@harbor.test',
      temporary_password: 'a'.repeat(24),
      outcome: 'provisioned',
    },
  }

  it('T010-K passes parameters through verbatim and returns the payload', async () => {
    harness.rpc.mockResolvedValueOnce({ data: GOOD_PAYLOAD, error: null })
    const result = await onboardRestaurant({
      name: 'Harbor Cafe',
      slug: 'harbor-cafe',
      ownerEmail: 'owner@harbor.test',
      ownerDisplayName: 'Harbor Owner',
      brandDescription: null,
      contactEmail: 'hello@harbor.test',
      contactPhone: null,
      timezone: null,
    })
    expect(harness.rpc).toHaveBeenCalledWith('onboard_restaurant', {
      p_name: 'Harbor Cafe',
      p_slug: 'harbor-cafe',
      p_owner_email: 'owner@harbor.test',
      p_owner_display_name: 'Harbor Owner',
      p_brand_description: undefined,
      p_contact_email: 'hello@harbor.test',
      p_contact_phone: undefined,
      p_timezone: undefined,
    })
    expect(result).toEqual({
      ok: true,
      data: {
        restaurantId: 'r-new',
        name: 'Harbor Cafe',
        slug: 'harbor-cafe',
        owner: {
          profileId: 'p-new',
          email: 'owner@harbor.test',
          temporaryPassword: 'a'.repeat(24),
          outcome: 'provisioned',
        },
      },
    })
  })

  it('T010-L passes a linked owner through with a null credential', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: {
        ...GOOD_PAYLOAD,
        owner: { ...GOOD_PAYLOAD.owner, temporary_password: null, outcome: 'linked' },
      },
      error: null,
    })
    const result = await onboardRestaurant({
      name: 'Harbor Cafe',
      slug: 'harbor-cafe',
      ownerEmail: 'owner@harbor.test',
      ownerDisplayName: 'Harbor Owner',
    })
    expect(result).toMatchObject({
      ok: true,
      data: { owner: { temporaryPassword: null, outcome: 'linked' } },
    })
  })

  it('T010-M maps a P0001 refusal to the server message verbatim', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'P0001',
        message: 'This public identifier is already in use by another restaurant.',
      },
    })
    const result = await onboardRestaurant({
      name: 'X',
      slug: 'blue-olive',
      ownerEmail: 'o@restopilot.dev',
      ownerDisplayName: 'O',
    })
    expect(result).toEqual({
      ok: false,
      message: 'This public identifier is already in use by another restaurant.',
    })
  })

  it('T010-N maps the 42501 console denial to the denial notice', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: '42501',
        message: 'You do not have permission to view the platform console.',
      },
    })
    const result = await onboardRestaurant({
      name: 'X',
      slug: 'x',
      ownerEmail: 'o@restopilot.dev',
      ownerDisplayName: 'O',
    })
    expect(result).toStrictEqual({
      ok: false,
      message: 'You do not have permission to view the platform console.',
    })
  })

  it('T010-O fails closed on a malformed payload (owner keys missing)', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: { restaurant_id: 'r', name: 'n', slug: 's' },
      error: null,
    })
    const result = await onboardRestaurant({
      name: 'X',
      slug: 'x',
      ownerEmail: 'o@restopilot.dev',
      ownerDisplayName: 'O',
    })
    expect(result).toMatchObject({
      ok: false,
      message: 'The request could not be completed. Please try again.',
    })
  })

  it('T010-P maps unexpected codes to the retry message', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })
    const result = await onboardRestaurant({
      name: 'X',
      slug: 'x',
      ownerEmail: 'o@restopilot.dev',
      ownerDisplayName: 'O',
    })
    expect(result).toMatchObject({
      ok: false,
      message: 'The request could not be completed. Please try again.',
    })
  })
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
