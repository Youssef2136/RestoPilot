import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Menu client unit suite — US1 block (spec 005 FR-005…FR-010, FR-016, FR-027;
 * contracts/menu-client.md §1, §4; research.md §9).
 *
 * Two seams, both mocked: `getSupabaseClient` for the RPC round trips (each
 * wrapper's call is captured verbatim — RPC name, contract parameter names,
 * and the exact price REPRESENTATION on the wire) and the money helpers, which
 * are asserted directly because they are the only place amounts are touched
 * outside SQL.
 *
 * Later stories append their blocks to this file: the branch-menu payload
 * parser (US2/T025), price canonicalisation boundaries (US3/T030), extras
 * (US4/T034), and image path building (US5/T040).
 */

const harness = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: harness.rpc }),
}))

import {
  menuClient,
  MENU_DENIED_MESSAGE,
  MENU_RETRY_MESSAGE,
  mapMenuError,
} from '../../src/features/menu/menuClient'
import {
  canonicalizePrice,
  formatAdjustment,
  formatPrice,
  isValidPriceInput,
} from '../../src/features/menu/money'

const SUCCESS = { data: { marker: 'stored-row' }, error: null }

beforeEach(() => {
  harness.rpc.mockReset()
  harness.rpc.mockResolvedValue(SUCCESS)
})

function recordedCall(): [string, Record<string, unknown>] {
  const calls = harness.rpc.mock.calls
  expect(calls).toHaveLength(1)
  return calls[0] as [string, Record<string, unknown>]
}

/** Locale-agnostic digits of a formatted amount (separators vary by locale). */
function digitsOf(value: string): string {
  return value.replace(/[^\d]/g, '')
}

describe('money: exact price handling (FR-010, research.md §9)', () => {
  it('accepts the documented shape only', () => {
    for (const valid of ['0', '6.5', '6.50', '999999999.99', ' 12.50 ']) {
      expect(isValidPriceInput(valid), valid).toBe(true)
    }
    for (const invalid of [
      '',
      '  ',
      '12.345',
      '-1',
      '1,50',
      '1000000000',
      '12.',
      '.5',
      'abc',
      '1e3',
    ]) {
      expect(isValidPriceInput(invalid), invalid).toBe(false)
    }
  })

  it('canonicalises to two decimals without arithmetic', () => {
    expect(canonicalizePrice('12.5')).toBe('12.50')
    expect(canonicalizePrice(' 12.50 ')).toBe('12.50')
    expect(canonicalizePrice('0')).toBe('0.00')
    expect(canonicalizePrice('999999999.99')).toBe('999999999.99')
    // Rejected, never rounded — the client must not silently repair input.
    expect(canonicalizePrice('12.345')).toBeNull()
    expect(canonicalizePrice('-1')).toBeNull()
    expect(canonicalizePrice('1000000000')).toBeNull()
  })

  it('formats for display with exactly two decimals', () => {
    expect(digitsOf(formatPrice('6.5'))).toBe('650')
    expect(digitsOf(formatPrice(6.5))).toBe('650')
    expect(digitsOf(formatPrice('1234.5'))).toBe('123450')
    // A non-numeric value is passed through rather than becoming NaN.
    expect(formatPrice('not-a-price')).toBe('not-a-price')
  })

  it('renders a zero adjustment as a free extra', () => {
    expect(formatAdjustment('0.00')).toBe('Free')
    expect(formatAdjustment(0)).toBe('Free')
    expect(digitsOf(formatAdjustment('3.00'))).toBe('300')
    expect(formatAdjustment('3.00')).toContain('+')
  })
})

describe('result shaping (contract §1)', () => {
  it('success ⇒ { ok: true, data } with the RPC row passed through unchanged', async () => {
    const result = await menuClient.updateItem({
      itemId: 'item-1',
      name: 'Hummus',
      price: '6.50',
    })
    expect(result).toEqual({ ok: true, data: SUCCESS.data })
  })

  it('a void RPC succeeds without a payload (delete_menu_category)', async () => {
    harness.rpc.mockResolvedValue({ data: undefined, error: null })
    const result = await menuClient.deleteCategory('category-1')
    expect(result).toEqual({ ok: true, data: undefined })
  })

  it('a row-returning call with no payload is a protocol anomaly ⇒ retry', async () => {
    harness.rpc.mockResolvedValue({ data: null, error: null })
    const result = await menuClient.createCategory({ restaurantId: 'r-1', name: 'Starters' })
    expect(result).toEqual({ ok: false, kind: 'retry', message: MENU_RETRY_MESSAGE })
  })

  it('a thrown request becomes the retry message, never a raw error', async () => {
    harness.rpc.mockRejectedValue(new Error('network down'))
    const result = await menuClient.createItem({
      categoryId: 'c-1',
      name: 'Hummus',
      price: '6.50',
    })
    expect(result).toEqual({ ok: false, kind: 'retry', message: MENU_RETRY_MESSAGE })
  })
})

describe('error mapping (contract §1)', () => {
  it('42501 ⇒ the generic denial', () => {
    expect(mapMenuError({ code: '42501', message: 'raw' })).toEqual({
      kind: 'denied',
      message: MENU_DENIED_MESSAGE,
    })
  })

  it('P0001 ⇒ the server message verbatim', () => {
    const serverMessage = 'A category with this name already exists.'
    expect(mapMenuError({ code: 'P0001', message: serverMessage })).toEqual({
      kind: 'validation',
      message: serverMessage,
    })
  })

  it('anything else ⇒ the retry message', () => {
    expect(mapMenuError({ code: '23505', message: 'duplicate key' })).toEqual({
      kind: 'retry',
      message: MENU_RETRY_MESSAGE,
    })
  })

  it('maps denials and validations through a wrapper call', async () => {
    harness.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })
    const denied = await menuClient.updateCategory({
      categoryId: 'c-1',
      name: 'Mains',
    })
    expect(denied).toEqual({ ok: false, kind: 'denied', message: MENU_DENIED_MESSAGE })

    harness.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'This category still contains items; move them first.' },
    })
    const rejected = await menuClient.deleteCategory('c-1')
    expect(rejected).toEqual({
      ok: false,
      kind: 'validation',
      message: 'This category still contains items; move them first.',
    })
  })
})

describe('US1 call shapes (contract §1: exact parameter names, prices as strings)', () => {
  it('create_menu_category passes the contract parameter names', async () => {
    await menuClient.createCategory({ restaurantId: 'r-1', name: 'Starters', description: 'Small' })
    expect(recordedCall()).toEqual([
      'create_menu_category',
      { p_restaurant_id: 'r-1', p_name: 'Starters', p_description: 'Small' },
    ])
  })

  it('create_menu_item sends the price as a canonical STRING, not a float', async () => {
    await menuClient.createItem({ categoryId: 'c-1', name: 'Hummus', price: '6.50' })
    const [name, params] = recordedCall()
    expect(name).toBe('create_menu_item')
    expect(params.p_price).toBe('6.50')
    expect(typeof params.p_price).toBe('string')
  })

  it('update_menu_item sends the price as a canonical string too', async () => {
    await menuClient.updateItem({ itemId: 'i-1', name: 'Hummus', price: '9.99' })
    const [name, params] = recordedCall()
    expect(name).toBe('update_menu_item')
    expect(params.p_price).toBe('9.99')
    expect('p_description' in params).toBe(true)
  })

  it('reorder wrappers submit the complete list they are given', async () => {
    harness.rpc.mockResolvedValue({ data: undefined, error: null })
    await menuClient.reorderCategories('r-1', ['c-2', 'c-1'])
    expect(recordedCall()).toEqual([
      'reorder_menu_categories',
      { p_restaurant_id: 'r-1', p_category_ids: ['c-2', 'c-1'] },
    ])
    harness.rpc.mockClear()
    harness.rpc.mockResolvedValue({ data: undefined, error: null })
    await menuClient.reorderItems('c-1', ['i-2', 'i-1'])
    expect(recordedCall()).toEqual([
      'reorder_menu_items',
      { p_category_id: 'c-1', p_item_ids: ['i-2', 'i-1'] },
    ])
  })

  it('move_menu_item and delete_menu_category use their contract names', async () => {
    await menuClient.moveItem('i-1', 'c-2')
    expect(recordedCall()).toEqual(['move_menu_item', { p_item_id: 'i-1', p_category_id: 'c-2' }])
    harness.rpc.mockClear()
    harness.rpc.mockResolvedValue({ data: undefined, error: null })
    await menuClient.deleteCategory('c-1')
    expect(recordedCall()).toEqual(['delete_menu_category', { p_category_id: 'c-1' }])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// US2 block — the branch menu projection parser (T025; FR-014/FR-015)
// ─────────────────────────────────────────────────────────────────────────────

import { MenuPayloadError, parseBranchMenu } from '../../src/features/menu/menuClient'

/**
 * A complete, well-formed projection payload (the contract's shape). Typed
 * loosely on purpose: the suite mutates it to build malformed variants, and
 * the parser — not the compiler — is what must reject them.
 */
type MutableMenuItem = Record<string, unknown>
type MutablePayload = {
  branch: Record<string, unknown>
  restaurant: Record<string, unknown>
  categories: Array<Record<string, unknown> & { items: MutableMenuItem[] }>
}

const VALID_PAYLOAD: MutablePayload = {
  branch: { id: 'branch-1', name: 'Marina' },
  restaurant: { id: 'restaurant-1', name: 'Blue Olive', slug: 'blue-olive' },
  categories: [
    {
      id: 'category-1',
      name: 'Mains',
      description: 'Grilled and slow-cooked plates.',
      sort_order: 1,
      items: [
        {
          id: 'item-1',
          name: 'Grilled Sea Bass',
          description: null,
          price: '24.00',
          sort_order: 1,
          image_path: null,
          is_offered: false,
          unavailable_reason: 'restaurant',
          extras: [{ id: 'extra-1', name: 'Extra rice', price_adjustment: '3.00', sort_order: 1 }],
        },
      ],
    },
  ],
}

describe('branch menu payload parsing (FR-014/FR-015)', () => {
  it('accepts the documented shape and keeps prices as exact strings', () => {
    const menu = parseBranchMenu(VALID_PAYLOAD)
    expect(menu.branch.name).toBe('Marina')
    expect(menu.restaurant.slug).toBe('blue-olive')
    const item = menu.categories[0]?.items[0]
    expect(item?.price).toBe('24.00')
    expect(typeof item?.price).toBe('string')
    expect(item?.is_offered).toBe(false)
    expect(item?.unavailable_reason).toBe('restaurant')
    expect(item?.extras[0]?.price_adjustment).toBe('3.00')
  })

  it('accepts a null reason and a branch reason', () => {
    const offered = structuredClone(VALID_PAYLOAD)
    offered.categories[0].items[0].is_offered = true
    offered.categories[0].items[0].unavailable_reason = null
    expect(parseBranchMenu(offered).categories[0]?.items[0]?.unavailable_reason).toBe(null)

    const branchHidden = structuredClone(VALID_PAYLOAD)
    branchHidden.categories[0].items[0].unavailable_reason = 'branch'
    expect(parseBranchMenu(branchHidden).categories[0]?.items[0]?.unavailable_reason).toBe('branch')
  })

  it('rejects payloads the surfaces could not render honestly', () => {
    expect(() => parseBranchMenu(null)).toThrow(MenuPayloadError)
    expect(() => parseBranchMenu({ branch: {}, restaurant: {}, categories: null })).toThrow(
      MenuPayloadError,
    )
    const missingItemName = structuredClone(VALID_PAYLOAD) as Record<string, unknown>
    const categories = missingItemName.categories as Array<{
      items: Array<Record<string, unknown>>
    }>
    delete categories[0]?.items[0]?.name
    expect(() => parseBranchMenu(missingItemName)).toThrow(MenuPayloadError)

    const numericPrice = structuredClone(VALID_PAYLOAD)
    ;(numericPrice.categories[0].items[0] as Record<string, unknown>).price = 24
    expect(() => parseBranchMenu(numericPrice)).toThrow(MenuPayloadError)

    const badReason = structuredClone(VALID_PAYLOAD)
    ;(badReason.categories[0].items[0] as Record<string, unknown>).unavailable_reason = 'sold-out'
    expect(() => parseBranchMenu(badReason)).toThrow(MenuPayloadError)

    const badOffered = structuredClone(VALID_PAYLOAD)
    ;(badOffered.categories[0].items[0] as Record<string, unknown>).is_offered = 'yes'
    expect(() => parseBranchMenu(badOffered)).toThrow(MenuPayloadError)
  })

  it('a malformed projection through the wrapper resolves as a retry, never a partial menu', async () => {
    harness.rpc.mockResolvedValue({ data: { branch: { id: 'b' }, restaurant: null }, error: null })
    const result = await menuClient.getBranchMenu('branch-1')
    expect(result).toEqual({ ok: false, kind: 'retry', message: MENU_RETRY_MESSAGE })
  })

  it('availability wrappers use their contract parameter names', async () => {
    await menuClient.setItemAvailability('item-1', false)
    expect(recordedCall()).toEqual([
      'set_menu_item_availability',
      { p_item_id: 'item-1', p_is_available: false },
    ])
    harness.rpc.mockClear()
    harness.rpc.mockResolvedValue({ data: true, error: null })
    const changed = await menuClient.setBranchItemAvailability('branch-1', 'item-1', false)
    expect(recordedCall()).toEqual([
      'set_branch_item_availability',
      { p_branch_id: 'branch-1', p_item_id: 'item-1', p_is_available_at_branch: false },
    ])
    expect(changed).toEqual({ ok: true, data: true })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// US3 block — the price boundary matrix at the call site (T030; FR-010, FR-016)
// ─────────────────────────────────────────────────────────────────────────────

describe('price boundaries sent to the RPC (FR-010)', () => {
  it('sends exactly the canonical two-decimal string for every accepted boundary', async () => {
    const cases: Array<[string, string]> = [
      ['0', '0.00'],
      ['6.5', '6.50'],
      ['0.07', '0.07'],
      ['999999999.99', '999999999.99'],
      [' 12.50 ', '12.50'],
    ]
    for (const [input, expected] of cases) {
      harness.rpc.mockClear()
      harness.rpc.mockResolvedValue(SUCCESS)
      const canonical = canonicalizePrice(input)
      expect(canonical, input).toBe(expected)
      await menuClient.updateItem({ itemId: 'item-1', name: 'Item', price: canonical as string })
      const [, params] = recordedCall()
      expect(params.p_price, input).toBe(expected)
      // A canonical amount is plain decimal text — never exponent or padded form.
      expect(String(params.p_price)).toMatch(/^\d+\.\d{2}$/)
    }
  })

  it('refuses to build a request from a rejected price (no silent repair)', () => {
    for (const rejected of ['12.345', '-1', '1000000000', '', 'abc']) {
      expect(canonicalizePrice(rejected), rejected).toBeNull()
    }
  })

  it('keeps a price that would drift as a binary float exact', () => {
    // 0.07 has no exact binary representation; the string never becomes a number.
    expect(canonicalizePrice('0.07')).toBe('0.07')
    expect(canonicalizePrice('1.10')).toBe('1.10')
    expect(canonicalizePrice('9.99')).toBe('9.99')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// US4 block — item-scoped extras (T034; FR-018, FR-019)
// ─────────────────────────────────────────────────────────────────────────────

describe('extras: adjustment validation and canonicalisation (FR-018)', () => {
  it('accepts zero as the free extra and canonicalises it to 0.00', () => {
    expect(isValidPriceInput('0')).toBe(true)
    expect(canonicalizePrice('0')).toBe('0.00')
    expect(canonicalizePrice('0.0')).toBe('0.00')
    expect(formatAdjustment('0.00')).toBe('Free')
  })

  it('rejects negative adjustments outright (never repaired, never rounded)', () => {
    for (const rejected of ['-1', '-0.50', '-0.01']) {
      expect(isValidPriceInput(rejected), rejected).toBe(false)
      expect(canonicalizePrice(rejected), rejected).toBeNull()
    }
  })

  it('rejects three-decimal adjustments outright', () => {
    for (const rejected of ['1.005', '0.125', '2.999']) {
      expect(isValidPriceInput(rejected), rejected).toBe(false)
      expect(canonicalizePrice(rejected), rejected).toBeNull()
    }
  })

  it('extras wrappers use their contract parameter names with money as strings', async () => {
    // The caller canonicalises first (the components do); the wrapper sends
    // the canonical string verbatim — never a float.
    harness.rpc.mockClear()
    await menuClient.addMenuItemExtra({
      itemId: 'item-1',
      name: 'Extra rice',
      priceAdjustment: canonicalizePrice('1.5') as string,
    })
    expect(recordedCall()).toEqual([
      'add_menu_item_extra',
      { p_item_id: 'item-1', p_name: 'Extra rice', p_price_adjustment: '1.50' },
    ])
    expect(typeof recordedCall()[1].p_price_adjustment).toBe('string')

    harness.rpc.mockClear()
    await menuClient.updateMenuItemExtra({
      extraId: 'extra-1',
      name: 'Extra rice',
      priceAdjustment: canonicalizePrice('0') as string,
    })
    expect(recordedCall()).toEqual([
      'update_menu_item_extra',
      { p_extra_id: 'extra-1', p_name: 'Extra rice', p_price_adjustment: '0.00' },
    ])

    harness.rpc.mockClear()
    harness.rpc.mockResolvedValue({ data: undefined, error: null })
    const removed = await menuClient.removeMenuItemExtra('extra-1')
    expect(recordedCall()).toEqual(['remove_menu_item_extra', { p_extra_id: 'extra-1' }])
    expect(removed).toEqual({ ok: true, data: undefined })
  })

  it('surfaces the 20-extras bound message verbatim — the client never pre-empts it', async () => {
    harness.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'This item already has the maximum of 20 extras.' },
    })
    const result = await menuClient.addMenuItemExtra({
      itemId: 'item-1',
      name: 'One too many',
      priceAdjustment: '2.00',
    })
    expect(result).toEqual({
      ok: false,
      kind: 'validation',
      message: 'This item already has the maximum of 20 extras.',
    })
  })

  it('maps a denial on the extras RPCs to the generic denial message', async () => {
    harness.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })
    const result = await menuClient.removeMenuItemExtra('extra-1')
    expect(result).toEqual({ ok: false, kind: 'denied', message: MENU_DENIED_MESSAGE })
  })
})

describe('extras: ordering within an item as the projection exposes it (FR-019)', () => {
  /** VALID_PAYLOAD with a second item and multi-extra lists in server order. */
  function payloadWithExtras(): MutablePayload {
    const payload = structuredClone(VALID_PAYLOAD)
    payload.categories[0].items[0].extras = [
      { id: 'extra-b', name: 'Chili oil', price_adjustment: '1.00', sort_order: 2 },
      { id: 'extra-a', name: 'Extra rice', price_adjustment: '0.00', sort_order: 1 },
    ]
    return payload
  }

  it('preserves the payload order without re-sorting by id or name', () => {
    const menu = parseBranchMenu(payloadWithExtras())
    const extras = menu.categories[0].items[0].extras
    expect(extras.map((extra) => extra.id)).toEqual(['extra-b', 'extra-a'])
  })

  it("keeps each item's extras on that item only", () => {
    const payload = payloadWithExtras()
    payload.categories[0].items.push({
      id: 'item-2',
      name: 'Fattoush',
      description: null,
      price: '9.00',
      sort_order: 2,
      image_path: null,
      is_offered: true,
      unavailable_reason: null,
      extras: [{ id: 'extra-c', name: 'Feta', price_adjustment: '2.00', sort_order: 1 }],
    })
    const menu = parseBranchMenu(payload)
    expect(menu.categories[0].items[0].extras.map((extra) => extra.id)).toEqual([
      'extra-b',
      'extra-a',
    ])
    expect(menu.categories[0].items[1].extras.map((extra) => extra.id)).toEqual(['extra-c'])
  })

  it("keeps an extra's adjustment an exact string and its fields typed", () => {
    const menu = parseBranchMenu(payloadWithExtras())
    const extra = menu.categories[0].items[0].extras[0]
    expect(extra.price_adjustment).toBe('1.00')
    expect(typeof extra.price_adjustment).toBe('string')
    expect(extra.sort_order).toBe(2)
  })

  it('rejects a malformed extra with MenuPayloadError (retry, never partial)', () => {
    const numericAdjustment = payloadWithExtras()
    ;(
      numericAdjustment.categories[0].items[0].extras as Array<Record<string, unknown>>
    )[0].price_adjustment = 1
    expect(() => parseBranchMenu(numericAdjustment)).toThrow(MenuPayloadError)

    const missingName = payloadWithExtras()
    const secondExtra = (
      missingName.categories[0].items[0].extras as Array<Record<string, unknown>>
    )[1]
    delete secondExtra.name
    expect(() => parseBranchMenu(missingName)).toThrow(MenuPayloadError)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// US5 block — the image path builder, pre-checks, and orchestration ordering
// (T040; FR-021, contracts/menu-images.md §2, §4)
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildMenuImagePath,
  getSignedImageUrl,
  isMenuImagePathForItem,
  precheckMenuImage,
  removeMenuImage,
  resetSignedUrlCacheForTests,
  uploadMenuImage,
  type MenuImageStorage,
} from '../../src/features/menu/menuImages'

const RESTAURANT = '00000000-0000-4000-8000-000000000001'
const ITEM = '00000000-0000-4000-8000-000000006011'
const FIVE_MIB = 5 * 1024 * 1024

describe('image path grammar (contracts/menu-images.md §2)', () => {
  it('builds exactly the documented grammar for representative ids and extensions', () => {
    expect(
      buildMenuImagePath({
        restaurantId: RESTAURANT,
        itemId: ITEM,
        mimeType: 'image/jpeg',
        name: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).toBe(`restaurant/${RESTAURANT}/item/${ITEM}/550e8400-e29b-41d4-a716-446655440000.jpg`)
    expect(
      buildMenuImagePath({
        restaurantId: RESTAURANT,
        itemId: ITEM,
        mimeType: 'image/png',
        name: 'a',
      }),
    ).toBe(`restaurant/${RESTAURANT}/item/${ITEM}/a.png`)
    expect(
      buildMenuImagePath({
        restaurantId: RESTAURANT,
        itemId: ITEM,
        mimeType: 'image/webp',
        name: 'A.b_c-9',
      }),
    ).toBe(`restaurant/${RESTAURANT}/item/${ITEM}/A.b_c-9.webp`)
  })

  it('defaults <name> to a fresh UUID and keeps the extension from the MIME type', () => {
    const path = buildMenuImagePath({
      restaurantId: RESTAURANT,
      itemId: ITEM,
      mimeType: 'image/png',
    })
    const name = path.split('/').at(-1) as string
    expect(name).toMatch(/^[0-9a-f-]{36}\.png$/)
  })

  it("never builds a path outside the item's own prefix", () => {
    const path = buildMenuImagePath({
      restaurantId: RESTAURANT,
      itemId: ITEM,
      mimeType: 'image/jpeg',
      name: 'x',
    })
    expect(isMenuImagePathForItem(path, RESTAURANT, ITEM)).toBe(true)
    // A sibling item's prefix, a foreign restaurant's prefix, a parent
    // folder, and a traversal attempt all fail the predicate.
    expect(isMenuImagePathForItem(path, RESTAURANT, 'other-item')).toBe(false)
    expect(isMenuImagePathForItem(path, '00000000-0000-4000-8000-000000000002', ITEM)).toBe(false)
    expect(isMenuImagePathForItem(path, RESTAURANT, '../item')).toBe(false)
    expect(
      isMenuImagePathForItem(`restaurant/${RESTAURANT}/item/${ITEM}/../x.jpg`, RESTAURANT, ITEM),
    ).toBe(false)
  })

  it('enforces the name segment grammar (length and character set)', () => {
    expect(() =>
      buildMenuImagePath({
        restaurantId: RESTAURANT,
        itemId: ITEM,
        mimeType: 'image/png',
        name: 'x'.repeat(121),
      }),
    ).toThrow()
    expect(() =>
      buildMenuImagePath({
        restaurantId: RESTAURANT,
        itemId: ITEM,
        mimeType: 'image/png',
        name: 'a/b',
      }),
    ).toThrow()
    expect(() =>
      buildMenuImagePath({
        restaurantId: RESTAURANT,
        itemId: ITEM,
        mimeType: 'image/png',
        name: '',
      }),
    ).toThrow()
  })
})

describe('image pre-checks (contracts/menu-images.md §1, §4)', () => {
  it('accepts the boundary: exactly 5 MiB is fine', () => {
    expect(precheckMenuImage({ type: 'image/png', size: FIVE_MIB })).toBeNull()
  })

  it('rejects 5 MiB + 1 byte by size, naming the bound', () => {
    const failure = precheckMenuImage({ type: 'image/png', size: FIVE_MIB + 1 })
    expect(failure?.kind).toBe('size')
    expect(failure?.message).toContain('5 MB')
  })

  it('rejects a disallowed type before any size check', () => {
    const failure = precheckMenuImage({ type: 'application/pdf', size: 1 })
    expect(failure?.kind).toBe('type')
    const oversizePdf = precheckMenuImage({ type: 'application/pdf', size: FIVE_MIB + 1 })
    expect(oversizePdf?.kind).toBe('type')
  })

  it('accepts every MIME type in the allowed set', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(precheckMenuImage({ type, size: 1 })).toBeNull()
    }
  })
})

describe('image orchestration ordering (contracts/menu-images.md §4)', () => {
  /** A stubbed Storage + RPC seam recording every call in order. */
  function makeStorage() {
    const calls: string[] = []
    const state: {
      setImagePathResult: { ok: boolean; message?: string; previousPath: string | null }
    } = {
      setImagePathResult: { ok: true, previousPath: 'restaurant/r/item/i/old.jpg' },
    }
    const storage: MenuImageStorage = {
      storage: {
        from: (bucket: string) => ({
          upload: async () => {
            calls.push(`upload:${bucket}`)
            return { data: {}, error: null }
          },
          remove: async (paths: string[]) => {
            calls.push(`remove:${paths.join(',')}`)
            return { error: null }
          },
          createSignedUrl: async () => ({ data: { signedUrl: 'https://signed' }, error: null }),
        }),
      },
      setImagePath: async () => {
        calls.push('rpc:set_menu_item_image')
        return state.setImagePathResult
      },
    }
    return { storage, calls, state }
  }

  it('upload failure ⇒ no RPC call (the item is untouched)', async () => {
    const harness = makeStorage()
    harness.storage.storage.from = () => ({
      upload: async () => ({ data: null, error: { message: 'EntityTooLarge' } }),
      remove: async () => ({ error: null }),
      createSignedUrl: async () => ({ data: null, error: null }),
    })
    const outcome = await uploadMenuImage(harness.storage, {
      restaurantId: RESTAURANT,
      itemId: ITEM,
      file: { type: 'image/png', size: 10 },
      body: new Blob(['x']),
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok && outcome.failure.stage !== 'upload') {
      throw new Error('expected the upload stage to fail')
    }
    expect(harness.calls).toEqual([]) // no RPC, no delete
  })

  it('a rejected pre-check never reaches Storage at all', async () => {
    const harness = makeStorage()
    const outcome = await uploadMenuImage(harness.storage, {
      restaurantId: RESTAURANT,
      itemId: ITEM,
      file: { type: 'application/pdf', size: 10 },
      body: new Blob(['x']),
    })
    expect(outcome.ok).toBe(false)
    expect(harness.calls).toEqual([])
  })

  it('RPC failure ⇒ no local reference kept and no delete attempted', async () => {
    const harness = makeStorage()
    harness.state.setImagePathResult = { ok: false, message: 'denied', previousPath: null }
    const outcome = await uploadMenuImage(harness.storage, {
      restaurantId: RESTAURANT,
      itemId: ITEM,
      file: { type: 'image/jpeg', size: 10 },
      body: new Blob(['x']),
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok && outcome.failure.stage !== 'record') {
      throw new Error('expected the record stage to fail')
    }
    expect(harness.calls).toEqual(['upload:menu-images', 'rpc:set_menu_item_image'])
  })

  it('success ⇒ upload, record, then delete the returned previous object, in order', async () => {
    const harness = makeStorage()
    const outcome = await uploadMenuImage(harness.storage, {
      restaurantId: RESTAURANT,
      itemId: ITEM,
      file: { type: 'image/webp', size: 10 },
      body: new Blob(['x']),
    })
    expect(outcome).toEqual({ ok: true, path: expect.stringContaining('/item/') })
    expect(harness.calls).toEqual([
      'upload:menu-images',
      'rpc:set_menu_item_image',
      `remove:restaurant/r/item/i/old.jpg`,
    ])
  })

  it('first set (no previous path) ⇒ nothing to delete', async () => {
    const harness = makeStorage()
    harness.state.setImagePathResult = { ok: true, previousPath: null }
    const outcome = await uploadMenuImage(harness.storage, {
      restaurantId: RESTAURANT,
      itemId: ITEM,
      file: { type: 'image/png', size: 10 },
      body: new Blob(['x']),
    })
    expect(outcome.ok).toBe(true)
    expect(harness.calls).toEqual(['upload:menu-images', 'rpc:set_menu_item_image'])
  })

  it('remove ⇒ clear first, then delete the returned previous object', async () => {
    const harness = makeStorage()
    const outcome = await removeMenuImage(harness.storage, ITEM)
    expect(outcome.ok).toBe(true)
    expect(harness.calls).toEqual(['rpc:set_menu_item_image', 'remove:restaurant/r/item/i/old.jpg'])
  })

  it('remove on a no-op clear (previous null) ⇒ no delete', async () => {
    const harness = makeStorage()
    harness.state.setImagePathResult = { ok: true, previousPath: null }
    await removeMenuImage(harness.storage, ITEM)
    expect(harness.calls).toEqual(['rpc:set_menu_item_image'])
  })
})

describe('signed-URL helper (contracts/menu-images.md §4)', () => {
  it('caches per path within the session and re-signs after the cache is reset', async () => {
    resetSignedUrlCacheForTests()
    let signCount = 0
    const storage = {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        remove: async () => ({ error: null }),
        createSignedUrl: async () => {
          signCount += 1
          return { data: { signedUrl: `https://signed/${signCount}` }, error: null }
        },
      }),
    }
    const first = await getSignedImageUrl(storage, `restaurant/${RESTAURANT}/item/${ITEM}/a.jpg`)
    const second = await getSignedImageUrl(storage, `restaurant/${RESTAURANT}/item/${ITEM}/a.jpg`)
    expect(first).toBe('https://signed/1')
    expect(second).toBe(first)
    expect(signCount).toBe(1)

    resetSignedUrlCacheForTests()
    await getSignedImageUrl(storage, `restaurant/${RESTAURANT}/item/${ITEM}/a.jpg`)
    expect(signCount).toBe(2)
  })

  it('a stale path (signing denied) resolves to null, never a URL', async () => {
    resetSignedUrlCacheForTests()
    const storage = {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        remove: async () => ({ error: null }),
        createSignedUrl: async () => ({ data: null, error: { message: 'denied' } }),
      }),
    }
    const url = await getSignedImageUrl(storage, `restaurant/${RESTAURANT}/item/${ITEM}/gone.jpg`)
    expect(url).toBeNull()
  })
})
