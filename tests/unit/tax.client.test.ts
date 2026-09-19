import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tax client unit suite — US1 block (spec 006 FR-005…FR-010, FR-024;
 * contracts/tax-client.md §1, §4; research.md §1).
 *
 * Two seams, both mocked: `getSupabaseClient` for the RPC round trips (each
 * wrapper's call is captured verbatim — RPC name, contract parameter names,
 * and the exact rate REPRESENTATION on the wire) and the rate helpers, which
 * are asserted directly because they are the only place rates are touched
 * outside SQL.
 *
 * Later stories append their blocks to this file: the branch configuration
 * and preview payloads (US2/T023, US3/T029), and the calculation payload
 * parser (US3).
 */

const harness = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: harness.rpc }),
}))

import {
  taxClient,
  TAX_DENIED_MESSAGE,
  TAX_RETRY_MESSAGE,
  mapTaxError,
} from '../../src/features/tax/taxClient'
import { canonicalizeRate, formatRate, isValidRateInput } from '../../src/features/tax/taxMoney'

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

describe('rate rules: exact handling (FR-007, research.md §1)', () => {
  it('accepts the documented shape, including the boundaries', () => {
    for (const valid of [
      '0',
      '0.0001',
      '8.25',
      '8.251',
      '99.9999',
      '100',
      '100.0',
      '100.0000',
      ' 8.25 ',
    ]) {
      expect(isValidRateInput(valid), valid).toBe(true)
    }
    for (const invalid of [
      '',
      '  ',
      '100.0001',
      '100.5',
      '108',
      '-1',
      '8.25123',
      '1,50',
      '12.',
      '.5',
      'abc',
      '1e3',
      '1000',
    ]) {
      expect(isValidRateInput(invalid), invalid).toBe(false)
    }
  })

  it('canonicalises to exactly four decimals without arithmetic', () => {
    expect(canonicalizeRate('8.25')).toBe('8.2500')
    expect(canonicalizeRate(' 8.25 ')).toBe('8.2500')
    expect(canonicalizeRate('8.251')).toBe('8.2510')
    expect(canonicalizeRate('0')).toBe('0.0000')
    expect(canonicalizeRate('100')).toBe('100.0000')
    expect(canonicalizeRate('0.0001')).toBe('0.0001')
    // Rejected, never rounded — the client must not silently repair input.
    expect(canonicalizeRate('8.25123')).toBeNull()
    expect(canonicalizeRate('108')).toBeNull()
    expect(canonicalizeRate('-1')).toBeNull()
    expect(canonicalizeRate('')).toBeNull()
    expect(canonicalizeRate('abc')).toBeNull()
  })

  it('formats for display by trimming trailing zeros for people', () => {
    expect(formatRate('8.2500')).toBe('8.25%')
    expect(formatRate('12.5000')).toBe('12.5%')
    expect(formatRate('0.0000')).toBe('0%')
    // A non-numeric value is passed through rather than becoming NaN.
    expect(formatRate('not-a-rate')).toBe('not-a-rate')
  })

  it('keeps a rate that would drift as a binary float exact', () => {
    // 8.251 has no exact binary representation; the string never becomes a
    // number on the way to the RPC.
    expect(canonicalizeRate('8.251')).toBe('8.2510')
    expect(canonicalizeRate('0.0001')).toBe('0.0001')
    expect(canonicalizeRate('99.9999')).toBe('99.9999')
  })
})

describe('result shaping (contract §1)', () => {
  it('success ⇒ { ok: true, data } with the RPC row passed through unchanged', async () => {
    const result = await taxClient.updateRule({
      ruleId: 'rule-1',
      name: 'VAT',
      rate: '8.2500',
      scope: 'total',
      sortOrder: 1,
    })
    expect(result).toEqual({ ok: true, data: SUCCESS.data })
  })

  it('a void RPC succeeds without a payload (delete_unused_tax_rule)', async () => {
    harness.rpc.mockResolvedValue({ data: undefined, error: null })
    const result = await taxClient.deleteUnusedRule('rule-1')
    expect(result).toEqual({ ok: true, data: undefined })
  })

  it('a row-returning call with no payload is a protocol anomaly ⇒ retry', async () => {
    harness.rpc.mockResolvedValue({ data: null, error: null })
    const result = await taxClient.createRule({
      restaurantId: 'r-1',
      name: 'VAT',
      rate: '8.2500',
      scope: 'total',
    })
    expect(result).toEqual({ ok: false, kind: 'retry', message: TAX_RETRY_MESSAGE })
  })

  it('a thrown request becomes the retry message, never a raw error', async () => {
    harness.rpc.mockRejectedValue(new Error('network down'))
    const result = await taxClient.setRuleActive('rule-1', false)
    expect(result).toEqual({ ok: false, kind: 'retry', message: TAX_RETRY_MESSAGE })
  })
})

describe('error mapping (contract §1)', () => {
  it('42501 ⇒ the generic denial', () => {
    expect(mapTaxError({ code: '42501', message: 'raw' })).toEqual({
      kind: 'denied',
      message: TAX_DENIED_MESSAGE,
    })
  })

  it('P0001 ⇒ the server message verbatim', () => {
    const serverMessage = 'A tax rule with this name already exists.'
    expect(mapTaxError({ code: 'P0001', message: serverMessage })).toEqual({
      kind: 'validation',
      message: serverMessage,
    })
  })

  it('anything else ⇒ the retry message', () => {
    expect(mapTaxError({ code: '23505', message: 'duplicate key' })).toEqual({
      kind: 'retry',
      message: TAX_RETRY_MESSAGE,
    })
  })

  it('maps denials and validations through a wrapper call', async () => {
    harness.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })
    const denied = await taxClient.setRuleActive('rule-1', false)
    expect(denied).toEqual({ ok: false, kind: 'denied', message: TAX_DENIED_MESSAGE })

    harness.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'This tax rule has been applied in recorded results and cannot be deleted.',
      },
    })
    const rejected = await taxClient.deleteUnusedRule('rule-1')
    expect(rejected).toEqual({
      ok: false,
      kind: 'validation',
      message: 'This tax rule has been applied in recorded results and cannot be deleted.',
    })
  })
})

describe('US1 call shapes (contract §1: exact parameter names, rates as strings)', () => {
  it('create_tax_rule passes the contract parameter names', async () => {
    await taxClient.createRule({
      restaurantId: 'r-1',
      name: 'VAT',
      rate: '8.2500',
      scope: 'total',
    })
    expect(recordedCall()).toEqual([
      'create_tax_rule',
      {
        p_restaurant_id: 'r-1',
        p_name: 'VAT',
        p_rate: '8.2500',
        p_scope: 'total',
        p_branch_id: undefined,
        p_sort_order: undefined,
        p_item_ids: undefined,
        p_category_ids: undefined,
        p_compound_source_ids: undefined,
      },
    ])
  })

  it('create_tax_rule sends the rate as a canonical STRING, not a float', async () => {
    await taxClient.createRule({
      restaurantId: 'r-1',
      name: 'VAT',
      rate: '8.2500',
      scope: 'total',
      itemIds: ['item-1'],
      compoundSourceIds: ['source-1'],
    })
    const [name, params] = recordedCall()
    expect(name).toBe('create_tax_rule')
    expect(params.p_rate).toBe('8.2500')
    expect(typeof params.p_rate).toBe('string')
    expect(params.p_item_ids).toEqual(['item-1'])
    expect(params.p_compound_source_ids).toEqual(['source-1'])
  })

  it('a branch-only creation carries the branch id', async () => {
    await taxClient.createRule({
      restaurantId: 'r-1',
      name: 'Downtown surcharge',
      rate: '2.0000',
      scope: 'total',
      branchId: 'branch-1',
    })
    const [, params] = recordedCall()
    expect(params.p_branch_id).toBe('branch-1')
  })

  it('update_tax_rule carries the full shape including the explicit order', async () => {
    await taxClient.updateRule({
      ruleId: 'rule-1',
      name: 'VAT',
      rate: '9.5',
      scope: 'total',
      sortOrder: 3,
    })
    const [name, params] = recordedCall()
    expect(name).toBe('update_tax_rule')
    expect(params.p_rate).toBe('9.5')
    expect(params.p_sort_order).toBe(3)
  })

  it('reorder_tax_rules submits the complete list it is given', async () => {
    harness.rpc.mockResolvedValue({ data: undefined, error: null })
    await taxClient.reorderRules('r-1', ['rule-2', 'rule-1'])
    expect(recordedCall()).toEqual([
      'reorder_tax_rules',
      { p_restaurant_id: 'r-1', p_rule_ids: ['rule-2', 'rule-1'], p_branch_id: undefined },
    ])
  })

  it('retire and delete use their contract names', async () => {
    await taxClient.setRuleActive('rule-1', false)
    expect(recordedCall()).toEqual(['retire_tax_rule', { p_rule_id: 'rule-1', p_active: false }])
    harness.rpc.mockClear()
    harness.rpc.mockResolvedValue({ data: undefined, error: null })
    await taxClient.deleteUnusedRule('rule-1')
    expect(recordedCall()).toEqual(['delete_unused_tax_rule', { p_rule_id: 'rule-1' }])
  })

  it('set_branch_tax_override passes the contract names and an explicit null to clear', async () => {
    await taxClient.setBranchTaxOverride({ branchId: 'branch-1', ruleId: 'rule-1', rate: '8.7500' })
    expect(recordedCall()).toEqual([
      'set_branch_tax_override',
      { p_branch_id: 'branch-1', p_rule_id: 'rule-1', p_rate: '8.7500' },
    ])
    harness.rpc.mockClear()
    harness.rpc.mockResolvedValue({ data: { changed: true, rate: null }, error: null })
    await taxClient.setBranchTaxOverride({ branchId: 'branch-1', ruleId: 'rule-1', rate: null })
    const [, params] = recordedCall()
    expect('p_rate' in params).toBe(true)
    expect(params.p_rate).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// US2 block — the branch tax configuration parser (T022; FR-020)
// ─────────────────────────────────────────────────────────────────────────────

import { TaxPayloadError, parseCalculation, parseTaxConfig } from '../../src/features/tax/taxClient'

/** A complete, well-formed configuration payload (the contract's shape). */
type MutableConfigRule = Record<string, unknown>
type MutableConfig = {
  branch: Record<string, unknown>
  restaurant_id: string
  rules: MutableConfigRule[]
}

const VALID_CONFIG: MutableConfig = {
  branch: { id: 'branch-1', name: 'Marina' },
  restaurant_id: 'restaurant-1',
  rules: [
    {
      rule_id: 'rule-1',
      name: 'VAT',
      rate: '8.7500',
      scope: 'total',
      sort_order: 1,
      origin: 'override',
      item_ids: [],
      category_ids: [],
      compound_sources: [],
    },
    {
      rule_id: 'rule-2',
      name: 'Downtown surcharge',
      rate: '2.0000',
      scope: 'total',
      sort_order: 2,
      origin: 'branch-only',
      item_ids: [],
      category_ids: [],
      compound_sources: [],
    },
  ],
}

describe('branch tax configuration parsing (FR-020)', () => {
  it('accepts the documented shape and keeps rates as exact strings', () => {
    const config = parseTaxConfig(VALID_CONFIG)
    expect(config.branch.name).toBe('Marina')
    expect(config.restaurant_id).toBe('restaurant-1')
    expect(config.rules).toHaveLength(2)
    expect(config.rules[0]?.rate).toBe('8.7500')
    expect(typeof config.rules[0]?.rate).toBe('string')
    expect(config.rules[0]?.origin).toBe('override')
    expect(config.rules[1]?.origin).toBe('branch-only')
  })

  it('preserves the payload order without re-sorting', () => {
    const config = parseTaxConfig(VALID_CONFIG)
    expect(config.rules.map((rule) => rule.rule_id)).toEqual(['rule-1', 'rule-2'])
  })

  it('keeps the override-applied and restaurant-default distinction', () => {
    const defaulted = structuredClone(VALID_CONFIG)
    ;(defaulted.rules[0] as Record<string, unknown>).origin = 'restaurant'
    ;(defaulted.rules[0] as Record<string, unknown>).rate = '8.2500'
    const config = parseTaxConfig(defaulted)
    expect(config.rules[0]?.origin).toBe('restaurant')
    expect(config.rules[0]?.rate).toBe('8.2500')
  })

  it('rejects payloads the surfaces could not render honestly', () => {
    expect(() => parseTaxConfig(null)).toThrow(TaxPayloadError)
    expect(() => parseTaxConfig({ rules: [] })).toThrow(TaxPayloadError)

    const missingName = structuredClone(VALID_CONFIG)
    delete missingName.rules[0]?.name
    expect(() => parseTaxConfig(missingName)).toThrow(TaxPayloadError)

    const numericRate = structuredClone(VALID_CONFIG)
    ;(numericRate.rules[0] as Record<string, unknown>).rate = 8.75
    expect(() => parseTaxConfig(numericRate)).toThrow(TaxPayloadError)

    const unknownOrigin = structuredClone(VALID_CONFIG)
    ;(unknownOrigin.rules[0] as Record<string, unknown>).origin = 'imported'
    expect(() => parseTaxConfig(unknownOrigin)).toThrow(TaxPayloadError)

    const badScope = structuredClone(VALID_CONFIG)
    ;(badScope.rules[0] as Record<string, unknown>).scope = 'global'
    expect(() => parseTaxConfig(badScope)).toThrow(TaxPayloadError)

    const nonStringId = structuredClone(VALID_CONFIG)
    ;(nonStringId.rules[0] as Record<string, unknown>).item_ids = [42]
    expect(() => parseTaxConfig(nonStringId)).toThrow(TaxPayloadError)

    const missingSort = structuredClone(VALID_CONFIG)
    delete missingSort.rules[0]?.sort_order
    expect(() => parseTaxConfig(missingSort)).toThrow(TaxPayloadError)
  })

  it('a malformed projection through the wrapper resolves as a retry, never a partial config', async () => {
    harness.rpc.mockResolvedValue({ data: { branch: { id: 'b' } }, error: null })
    const result = await taxClient.getBranchTaxConfig('branch-1')
    expect(result).toEqual({ ok: false, kind: 'retry', message: TAX_RETRY_MESSAGE })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// US3 block — the calculation payload parser (T028; FR-011–FR-014)
// ────────────────────────────────────────────────────────────────────────────

const VALID_CALCULATION = {
  branch_id: 'branch-1',
  restaurant_id: 'restaurant-1',
  lines: [
    {
      rule_id: 'rule-vat',
      name: 'VAT',
      rate: '8.2500',
      scope: 'total',
      sort_order: 1,
      amount: '2.06',
    },
    {
      rule_id: 'rule-city',
      name: 'City tax',
      rate: '1.0000',
      scope: 'total',
      sort_order: 2,
      amount: '0.27',
    },
  ],
  subtotal: '25.00',
  total: '27.33',
}

describe('calculation payload parsing (FR-011–FR-014)', () => {
  it('accepts the documented shape, keeps amounts as exact strings, preserves the order', () => {
    const calculation = parseCalculation(VALID_CALCULATION)
    expect(calculation.lines).toHaveLength(2)
    expect(calculation.lines.map((line) => line.rule_id)).toEqual(['rule-vat', 'rule-city'])
    expect(calculation.lines[0]?.amount).toBe('2.06')
    expect(typeof calculation.lines[0]?.amount).toBe('string')
    expect(calculation.subtotal).toBe('25.00')
    expect(calculation.total).toBe('27.33')
  })

  it('a malformed payload is rejected loudly, never half-rendered', () => {
    expect(() => parseCalculation(null)).toThrow(TaxPayloadError)
    expect(() => parseCalculation({ lines: [] })).toThrow(TaxPayloadError)

    // An amount that is not an exact two-decimal string would smuggle a float.
    const floatAmount = structuredClone(VALID_CALCULATION)
    ;(floatAmount.lines[0] as Record<string, unknown>).amount = 2.06
    expect(() => parseCalculation(floatAmount)).toThrow(TaxPayloadError)

    // Lines out of engine order fail the non-decreasing sort_order check.
    const outOfOrder = structuredClone(VALID_CALCULATION)
    ;(outOfOrder.lines[0] as Record<string, unknown>).sort_order = 5
    expect(() => parseCalculation(outOfOrder)).toThrow(TaxPayloadError)

    const missingSubtotal = structuredClone(VALID_CALCULATION) as Record<string, unknown>
    delete missingSubtotal.subtotal
    expect(() => parseCalculation(missingSubtotal)).toThrow(TaxPayloadError)

    const unknownScope = structuredClone(VALID_CALCULATION)
    ;(unknownScope.lines[0] as Record<string, unknown>).scope = 'global'
    expect(() => parseCalculation(unknownScope)).toThrow(TaxPayloadError)
  })

  it('a malformed calculation through the wrapper resolves as a retry, never a partial result', async () => {
    harness.rpc.mockResolvedValue({ data: { lines: 'many' }, error: null })
    const result = await taxClient.calculateBranchTaxes('branch-1', [
      { item_id: 'item-1', extras: [], quantity: 1 },
    ])
    expect(result).toEqual({ ok: false, kind: 'retry', message: TAX_RETRY_MESSAGE })
  })
  it('calculate_branch_taxes passes the contract names and the selections as a JSON array value', async () => {
    harness.rpc.mockResolvedValue({ data: VALID_CALCULATION, error: null })
    const selections = [{ item_id: 'item-1', extras: [{ extra_id: 'extra-1' }], quantity: 2 }]
    await taxClient.calculateBranchTaxes('branch-1', selections)
    const [name, params] = recordedCall()
    expect(name).toBe('calculate_branch_taxes')
    expect(params.p_branch_id).toBe('branch-1')
    // The array itself travels (PostgREST serializes it); a string would
    // arrive as a jsonb scalar and be rejected as malformed.
    expect(params.p_selections).toBe(selections)
  })
})
