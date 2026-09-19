import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.types'
import {
  branchIds,
  menuItemIds,
  restaurantIds,
  seedCredentials,
  taxRuleIds,
} from '../database/helpers/fixtures'

/**
 * Integration suite — the real-API tax journey (spec 006 US3, T030;
 * FR-002, FR-011, FR-012, FR-019; research.md §9).
 *
 * Everything here goes through the REAL cloud project: real sign-ins, real
 * PostgREST RPC round trips (the same path the application uses). This tier
 * proves what the SQL-level suite cannot: the functions behave correctly
 * through the data API's request/response layer — argument typing (rates as
 * JSON strings, selections as JSON text), result shaping, and the auth-context
 * propagation PostgREST performs for the definer helpers.
 *
 * The journey: alice (Blue Olive owner) creates a scratch compound pair and
 * bob (Downtown manager) sets his own branch's replacement rate through the
 * real RPCs; the preview computes exact known amounts through the real
 * function; an identical repeat is byte-identical; eve (Cedar Grill owner —
 * another restaurant) is DENIED both the calculation and the configuration.
 * Teardown removes every scratch rule and override.
 *
 * Preconditions: migrated + seeded cloud development database (see
 * docs/development.md). The seeded fixture supplies the menu and the seeded
 * rules (VAT 8.25% total → City tax 1.5% compounding on it).
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Copy .env.example to .env and fill it in — see docs/development.md (Setup).',
    )
  }
  return value
}

function createAuthClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv('VITE_SUPABASE_URL'),
    requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
  )
}

/**
 * Alice (Blue Olive owner), Bob (Downtown branch manager), Fiona (Cedar
 * Grill's Marina kitchen — NO Blue Olive membership, the out-of-scope
 * denial identity). Eve is Downtown staff by seed, so she is legitimately
 * INSIDE the calculation read's scope and must not be used for denials.
 */
let alice: SupabaseClient<Database>
let bob: SupabaseClient<Database>
let fiona: SupabaseClient<Database>

interface CalcLine {
  rule_id: string
  name: string
  rate: string
  scope: string
  sort_order: number
  amount: string
}

interface CalcResult {
  lines: CalcLine[]
  subtotal: string
  total: string
}

beforeAll(async () => {
  async function signInAs(name: keyof typeof seedCredentials): Promise<SupabaseClient<Database>> {
    const client = createAuthClient()
    const credential = seedCredentials[name]
    const { error } = await client.auth.signInWithPassword({
      email: credential.email,
      password: credential.password,
    })
    if (error) {
      throw new Error(`Sign-in failed for ${name}: ${error.message}`)
    }
    return client
  }
  alice = await signInAs('alice')
  bob = await signInAs('bob')
  fiona = await signInAs('fiona')

  // Rerun safety: a previous crashed run may have left the scratch rules or
  // the override behind. The levy (referenced) is deleted first.
  const leftovers = await alice
    .from('tax_rules')
    .select('id, name')
    .in('name', ['Integration fee', 'Integration levy'])
    .eq('restaurant_id', restaurantIds.blueOlive)
  if (leftovers.error) {
    throw new Error(`Leftover lookup failed: ${leftovers.error.message}`)
  }
  const ordered = [...(leftovers.data ?? [])].sort((a, b) =>
    a.name === 'Integration levy' ? -1 : b.name === 'Integration levy' ? 1 : 0,
  )
  for (const rule of ordered) {
    const deleted = await alice.rpc('delete_unused_tax_rule', { p_rule_id: rule.id })
    if (deleted.error) {
      throw new Error(`Leftover delete failed for ${rule.name}: ${deleted.error.message}`)
    }
  }
  const cleared = await bob.rpc('set_branch_tax_override', {
    p_branch_id: branchIds.downtown,
    p_rule_id: taxRuleIds.vat,
    p_rate: null,
  } as never)
  if (cleared.error) {
    throw new Error(`Leftover override clear failed: ${cleared.error.message}`)
  }
}, 60_000)

afterAll(async () => {
  for (const client of [alice, bob, fiona]) {
    await client.auth.signOut()
  }
})

describe('tax engine through the real API (spec 006 US3, T030)', () => {
  const scratchRuleIds: string[] = []

  it(
    'sets up: alice creates a compound pair through the real RPCs; bob sets his branch override',
    { timeout: 30_000 },
    async () => {
      // Alice: scratch fee (total, position 9) compounded by a levy (position 10).
      // The generated arg types under-report SQL nullability — the nulls
      // travel through the same documented cast the client module uses.
      const fee = await alice.rpc('create_tax_rule', {
        p_restaurant_id: restaurantIds.blueOlive,
        p_name: 'Integration fee',
        p_rate: '1.0000',
        p_scope: 'total',
        p_branch_id: null,
        p_sort_order: 9,
      } as never)
      expect(fee.error).toBeNull()
      expect(fee.data).not.toBeNull()
      scratchRuleIds.push(fee.data!.id)

      const levy = await alice.rpc('create_tax_rule', {
        p_restaurant_id: restaurantIds.blueOlive,
        p_name: 'Integration levy',
        p_rate: '1.0000',
        p_scope: 'total',
        p_branch_id: null,
        p_sort_order: 10,
        p_compound_source_ids: [fee.data!.id],
      } as never)
      expect(levy.error).toBeNull()
      scratchRuleIds.push(levy.data!.id)

      // Bob: his own branch's replacement rate on the seeded VAT rule.
      const override = await bob.rpc('set_branch_tax_override', {
        p_branch_id: branchIds.downtown,
        p_rule_id: taxRuleIds.vat,
        p_rate: '8.5000',
      } as never)
      expect(override.error).toBeNull()
      const overrideData = override.data as unknown as { changed: boolean; rate: string | null }
      expect(overrideData.changed).toBe(true)
      expect(overrideData.rate).toBe('8.5000')
    },
  )

  it('the preview computes exact known amounts through the real function (FR-011, FR-012)', async () => {
    // Basket: 1× Hummus 6.50 at Downtown. Effective rates: VAT overridden to
    // 8.50% → 0.5525 → 0.55; City tax compounds: 1.5% over (6.50 + 0.55) =
    // 0.10575 → 0.11; the scratch pair: 1% over 6.50 = 0.065 → 0.07 (half-up),
    // levy 1% over (6.50 + 0.07) = 0.0657 → 0.07. No surcharge (Marina-only
    // branch rules do not apply here; the surcharge is Downtown's — it DOES
    // apply: 2% over 6.50 = 0.13).
    const selections = [
      { item_id: menuItemIds.hummus, extras: [], quantity: 1 },
    ] as unknown as string
    const calc = await bob.rpc('calculate_branch_taxes', {
      p_branch_id: branchIds.downtown,
      p_selections: selections,
    })
    expect(calc.error).toBeNull()
    const result = calc.data as unknown as CalcResult

    expect(result.subtotal).toBe('6.50')
    const amounts = new Map(result.lines.map((line) => [line.name, line.amount]))
    expect(amounts.get('VAT')).toBe('0.55') // the branch override is live
    expect(amounts.get('City tax')).toBe('0.11') // compounds on the overridden amount
    expect(amounts.get('Integration fee')).toBe('0.07')
    expect(amounts.get('Integration levy')).toBe('0.07')
    expect(amounts.get('Downtown surcharge')).toBe('0.13')
    // Total = exact subtotal + exact line sum.
    const lineSum = result.lines.reduce((sum, line) => sum + Number(line.amount), 0)
    expect(result.total).toBe((6.5 + lineSum).toFixed(2))
  })

  it('an identical repeat is byte-identical (FR-011 determinism)', async () => {
    const selections = [
      { item_id: menuItemIds.hummus, extras: [], quantity: 1 },
    ] as unknown as string
    const first = await bob.rpc('calculate_branch_taxes', {
      p_branch_id: branchIds.downtown,
      p_selections: selections,
    })
    const second = await bob.rpc('calculate_branch_taxes', {
      p_branch_id: branchIds.downtown,
      p_selections: selections,
    })
    expect(first.error).toBeNull()
    expect(second.error).toBeNull()
    expect(JSON.stringify(second.data)).toBe(JSON.stringify(first.data))
  })

  it('fiona is denied Blue Olive’s calculation and configuration through the real API (FR-019)', async () => {
    const calc = await fiona.rpc('calculate_branch_taxes', {
      p_branch_id: branchIds.downtown,
      p_selections: [{ item_id: menuItemIds.hummus, extras: [], quantity: 1 }] as unknown as string,
    })
    expect(calc.error).not.toBeNull()
    expect(calc.error!.code).toBe('42501')

    const config = await fiona.rpc('get_branch_tax_config', { p_branch_id: branchIds.downtown })
    expect(config.error).not.toBeNull()
    expect(config.error!.code).toBe('42501')
  })

  it('teardown: bob clears the override and alice deletes the scratch rules', async () => {
    const cleared = await bob.rpc('set_branch_tax_override', {
      p_branch_id: branchIds.downtown,
      p_rule_id: taxRuleIds.vat,
      p_rate: null,
    } as never)
    expect(cleared.error).toBeNull()

    // The levy compounds on the fee: delete order matters for the reference
    // check (the fee is referenced until the levy is gone).
    for (const ruleId of [...scratchRuleIds].reverse()) {
      const deleted = await alice.rpc('delete_unused_tax_rule', { p_rule_id: ruleId })
      expect(deleted.error).toBeNull()
    }

    // The branch is back to its seeded state: VAT resolves to 8.25%.
    const config = await alice.rpc('get_branch_tax_config', { p_branch_id: branchIds.downtown })
    expect(config.error).toBeNull()
    const rules = (config.data as unknown as { rules: Array<{ rule_id: string; rate: string }> })
      .rules
    const vat = rules.find((rule) => rule.rule_id === taxRuleIds.vat)
    expect(vat?.rate).toBe('8.2500')
  })
})
