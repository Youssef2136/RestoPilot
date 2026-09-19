import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDbClient, expectStatementToFail } from './helpers/db'
import {
  authUserIds,
  branchIds,
  menuExtraIds,
  menuItemIds,
  restaurantIds,
  taxRuleIds,
} from './helpers/fixtures'
import { taxClient } from '../../src/features/tax/taxClient'

/**
 * Tax RPC suite (spec 006; contracts/database-functions.md).
 *
 * Blocks: the authorization matrix across the nine functions; the validation
 * messages; the actual-change-only contract and audit basics; the effective
 * configuration resolution; the US2 override lifecycle; the US1 semantics
 * (uniqueness, coverage, the delete carve-out); calculation authorization +
 * selection validation; the US3 calculation matrix; the US4 snapshot block.
 *
 * Identities are simulated exactly as the data API presents them (the
 * `authenticated` role + `request.jwt.claims`, helpers/db.ts) and every call
 * runs in a transaction that is ALWAYS rolled back. Audit rows have no client
 * grants by design, so audit assertions switch to the owner role inside the
 * same transaction (`set local role postgres`).
 *
 * Preconditions: migrated + seeded cloud dev DB (research.md §1).
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

/** A stable authorization-denial marker inside a P0001/42501 message. */
const DENIED = 'permission'

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
    const pgError = error as { code?: string; message?: string }
    expect(pgError.code, `${label}: wrong SQLSTATE`).toBe(code)
    expect(pgError.message ?? '', `${label}: wrong message`).toContain(messagePart)
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
      where ${where}
      order by id`,
    values,
  )
  await client.query('set local role authenticated')
  return rows
}

/** Count tax audit rows (owner role) — for relative "wrote nothing" checks. */
async function countTaxAuditRows(): Promise<number> {
  await client.query('set local role postgres')
  const res = await client.query<{ n: string }>(
    `select count(*)::text as n from public.audit_log where action like 'tax.%'`,
  )
  await client.query('set local role authenticated')
  return Number(res.rows[0]!.n)
}

/** A minimal valid reorder list for Blue Olive's restaurant-level rules. */
function restaurantLevelRuleIds(): string[] {
  return [taxRuleIds.vat, taxRuleIds.cityTax, taxRuleIds.alcoholDuty, taxRuleIds.importedSweetsTax]
}

/** Calculate downtown taxes as the CURRENT identity. */
async function calculateDowntown(selections: unknown): Promise<CalcResult> {
  const res = await client.query<{ result: CalcResult }>(
    `select public.calculate_branch_taxes($1, $2::jsonb) as result`,
    [branchIds.downtown, JSON.stringify(selections)],
  )
  return res.rows[0]!.result
}

const sel = (item_id: string, extras: string[] = [], quantity = 1) => ({
  item_id,
  extras: extras.map((extra_id) => ({ extra_id })),
  quantity,
})

// ────────────────────────────────────────────────────────────────────────────
// Authorization — the rule write surface (FR-003, FR-021; Constitution IV)
// ────────────────────────────────────────────────────────────────────────────

const CALL = {
  createRule: `select * from public.create_tax_rule($1, $2, $3, $4)`,
  updateRule: `select * from public.update_tax_rule($1, $2, $3, $4, $5)`,
  reorderRules: `select * from public.reorder_tax_rules($1, $2)`,
  retireRule: `select * from public.retire_tax_rule($1, $2)`,
  deleteRule: `select * from public.delete_unused_tax_rule($1)`,
}

const nonRestaurantManagers: Array<[string, string]> = [
  ['bob the branch manager', authUserIds.bob],
  ['carla the cashier', authUserIds.carla],
  ['dan the kitchen member', authUserIds.dan],
  ['eve, another restaurant’s owner', authUserIds.eve],
  ['the platform admin', authUserIds.platformAdmin],
  ['an unlinked auth identity', '00000000-0000-4000-8000-000000009999'],
]

describe('tax RPC authorization: the rule write surface (FR-003, FR-021; Constitution IV)', () => {
  it.each(nonRestaurantManagers.map(([label, user]) => [label, user]))(
    'refuses %s every restaurant-level write (42501)',
    { timeout: 30_000 },
    async (_label, authUserId) => {
      await asUser(client, authUserId, async () => {
        await expectRpcFailure('42501', DENIED, CALL.createRule, [
          restaurantIds.blueOlive,
          'Nope',
          '1.0000',
          'total',
        ])
        await expectRpcFailure('42501', DENIED, CALL.updateRule, [
          taxRuleIds.vat,
          'Hijacked',
          '9.0000',
          'total',
          1,
        ])
        await expectRpcFailure('42501', DENIED, CALL.reorderRules, [
          restaurantIds.blueOlive,
          restaurantLevelRuleIds(),
        ])
        await expectRpcFailure('42501', DENIED, CALL.retireRule, [taxRuleIds.vat, false])
        await expectRpcFailure('42501', DENIED, CALL.deleteRule, [taxRuleIds.importedSweetsTax])
      })
    },
  )

  it('grants the owner every restaurant-level write', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const created = await client.query<{ id: string }>(CALL.createRule, [
        restaurantIds.blueOlive,
        'Disposable probe',
        '0.0000',
        'total',
      ])
      expect(created.rows).toHaveLength(1)

      await client.query(CALL.retireRule, [created.rows[0]!.id, false])
      await client.query(CALL.deleteRule, [created.rows[0]!.id])

      const reordered = await client.query(CALL.reorderRules, [
        restaurantIds.blueOlive,
        restaurantLevelRuleIds(),
      ])
      expect(reordered.rows).toHaveLength(1) // void success via select *

      await client.query(CALL.updateRule, [taxRuleIds.vat, 'VAT', '8.2500', 'total', 1])
    })
  })

  it('refuses the branch manager restaurant-level writes but grants their own branch-only rule writes (clarification 2)', async () => {
    await asUser(client, authUserIds.bob, async () => {
      await expectRpcFailure('42501', DENIED, CALL.createRule, [
        restaurantIds.blueOlive,
        'Manager reach',
        '1.0000',
        'total',
      ])

      const branchRule = await client.query<{ id: string }>(
        `select * from public.create_tax_rule($1, $2, $3, $4, $5, $6)`,
        [restaurantIds.blueOlive, 'Bob terrace fee', '1.0000', 'total', branchIds.downtown, 9],
      )
      expect(branchRule.rows).toHaveLength(1)

      // His own branch's branch-only rule: editable by him.
      const updated = await client.query<{ sort_order: number }>(
        `select * from public.update_tax_rule($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          branchRule.rows[0]!.id,
          'Bob terrace fee',
          '1.5000',
          'total',
          9,
          null,
          null,
          null,
        ] as unknown[],
      )
      expect(updated.rows[0]?.sort_order).toBe(9)
    })
  })

  it('refuses the branch manager writes to ANOTHER branch’s branch-only rule (clarification 2 boundary)', async () => {
    // Alice creates a MARINA branch-only rule; bob manages Downtown, not
    // Marina, so every write on that rule is refused to him.
    const branchRule = await asUser(client, authUserIds.alice, async () =>
      client.query<{ id: string }>(`select * from public.create_tax_rule($1, $2, $3, $4, $5, $6)`, [
        restaurantIds.blueOlive,
        'Marina terrace fee',
        '1.0000',
        'total',
        branchIds.marina,
        9,
      ]),
    )
    await asUser(client, authUserIds.bob, async () => {
      await expectRpcFailure('42501', DENIED, `select * from public.retire_tax_rule($1, $2)`, [
        branchRule.rows[0]!.id,
        false,
      ])
      await expectRpcFailure('42501', DENIED, CALL.deleteRule, [branchRule.rows[0]!.id])
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Authorization — overrides, config, and calculation scope
// ────────────────────────────────────────────────────────────────────────────

describe('tax RPC authorization: overrides, config, and calculation scope (FR-009, FR-020, FR-021)', () => {
  it('grants the owner and the owning branch’s manager — and refuses everyone else — the branch override', async () => {
    const OVERRIDE = `select public.set_branch_tax_override($1, $2, $3) as result`

    await asUser(client, authUserIds.alice, async () => {
      await client.query(OVERRIDE, [branchIds.downtown, taxRuleIds.vat, '8.5000'])
      await client.query(OVERRIDE, [branchIds.downtown, taxRuleIds.vat, null])
    })

    await asUser(client, authUserIds.bob, async () => {
      await client.query(OVERRIDE, [branchIds.downtown, taxRuleIds.vat, '8.5000'])
      await client.query(OVERRIDE, [branchIds.downtown, taxRuleIds.vat, null])
    })

    for (const [label, user] of [
      ['carla', authUserIds.carla],
      ['dan', authUserIds.dan],
      ['eve', authUserIds.eve],
    ] as Array<[string, string]>) {
      await asUser(client, user, async () => {
        await expectRpcFailure(
          '42501',
          DENIED,
          OVERRIDE,
          [branchIds.downtown, taxRuleIds.vat, '8.5000'],
          `override as ${label}`,
        )
      })
    }
  })

  it('reads the branch tax config as staff of the branch’s restaurant — and refuses outsiders (FR-020)', async () => {
    const CONFIG = `select public.get_branch_tax_config($1) as result`
    // Owner, Downtown manager, Downtown cashier, and eve (Cedar Grill owner
    // AND Downtown cashier) are all staff of this branch — allowed.
    for (const user of [authUserIds.alice, authUserIds.bob, authUserIds.carla, authUserIds.eve]) {
      await asUser(client, user, async () => {
        const res = await client.query<{ result: { rules: unknown[] } }>(CONFIG, [
          branchIds.downtown,
        ])
        expect(res.rows[0]!.result.rules.length).toBeGreaterThanOrEqual(4)
      })
    }
    // Dan is staff at MARINA only; fiona and the admin hold no Blue Olive
    // membership — all refused on Downtown.
    for (const user of [authUserIds.dan, authUserIds.fiona, authUserIds.platformAdmin]) {
      await asUser(client, user, async () => {
        await expectRpcFailure('42501', DENIED, CONFIG, [branchIds.downtown])
      })
    }
  })

  it('calculates as staff of the branch’s restaurant — and refuses outsiders (FR-011, FR-021)', async () => {
    const CALC = `select public.calculate_branch_taxes($1, $2::jsonb) as result`
    const basket = JSON.stringify([sel(menuItemIds.hummus)])
    for (const user of [authUserIds.alice, authUserIds.bob, authUserIds.carla, authUserIds.eve]) {
      await asUser(client, user, async () => {
        const res = await client.query<{ result: CalcResult }>(CALC, [branchIds.downtown, basket])
        expect(res.rows[0]!.result.subtotal).toBe('6.50')
      })
    }
    for (const user of [authUserIds.dan, authUserIds.fiona, authUserIds.platformAdmin]) {
      await asUser(client, user, async () => {
        await expectRpcFailure('42501', DENIED, CALC, [branchIds.downtown, basket])
      })
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Validation — rates, names, scopes, and targets (FR-005, FR-007, FR-008)
// ────────────────────────────────────────────────────────────────────────────

describe('tax RPC validation: rates, names, scopes, and targets (FR-005, FR-007, FR-008)', () => {
  it('rejects rates with more than four decimals — never rounds (research.md §1)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure(
        'P0001',
        'between 0 and 100 with at most four decimal places',
        CALL.createRule,
        [restaurantIds.blueOlive, 'Too precise', '8.25123', 'total'],
      )
    })
  })

  it('rejects an over-range rate and a non-numeric rate (FR-007)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure('P0001', 'between 0 and 100', CALL.createRule, [
        restaurantIds.blueOlive,
        'Over range',
        '150',
        'total',
      ])
      await expectRpcFailure('P0001', 'between 0 and 100', CALL.createRule, [
        restaurantIds.blueOlive,
        'Not a number',
        'abc',
        'total',
      ])
    })
  })

  it('rejects blank/over-long names and out-of-vocabulary scopes with the contract messages (FR-005, FR-008)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure('P0001', 'name is required', CALL.createRule, [
        restaurantIds.blueOlive,
        '   ',
        '1.0000',
        'total',
      ])
      await expectRpcFailure('P0001', 'at most 80 characters', CALL.createRule, [
        restaurantIds.blueOlive,
        'x'.repeat(81),
        '1.0000',
        'total',
      ])
      await expectRpcFailure(
        'P0001',
        'scope must be total, items, or categories',
        CALL.createRule,
        [restaurantIds.blueOlive, 'Wrong scope', '1.0000', 'global'],
      )
    })
  })

  it('rejects a duplicate rule name case-insensitively with the contract message (FR-005)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure('P0001', 'already exists', CALL.createRule, [
        restaurantIds.blueOlive,
        'vat',
        '1.0000',
        'total',
      ])
    })
  })

  it('enforces the scope/target shape (FR-006, FR-008)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure('P0001', 'requires at least one item', CALL.createRule, [
        restaurantIds.blueOlive,
        'Wrong items',
        '1.0000',
        'items',
      ])
      await expectRpcFailure('P0001', 'requires at least one category', CALL.createRule, [
        restaurantIds.blueOlive,
        'Wrong categories',
        '1.0000',
        'categories',
      ])
    })
  })

  it('enforces the compound shape: no self-reference, active sources only (FR-012)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      // A rule cannot cite itself: re-point City tax at itself via update.
      await expectRpcFailure(
        'P0001',
        'cannot compound on itself',
        `select * from public.update_tax_rule($1, $2, $3, $4, $5, $6, $7, $8)`,
        [taxRuleIds.cityTax, 'City tax', '1.5000', 'total', 2, null, null, [taxRuleIds.cityTax]],
      )
      // A retired rule is not a valid source.
      const retired = await client.query<{ id: string }>(CALL.createRule, [
        restaurantIds.blueOlive,
        'Doomed source',
        '1.0000',
        'total',
      ])
      await client.query(CALL.retireRule, [retired.rows[0]!.id, false])
      await expectRpcFailure(
        'P0001',
        'active restaurant-level rule of this restaurant',
        `select * from public.update_tax_rule($1, $2, $3, $4, $5, $6, $7, $8)`,
        [taxRuleIds.cityTax, 'City tax', '1.5000', 'total', 2, null, null, [retired.rows[0]!.id]],
      )
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Actual-change-only + audit (FR-021, FR-024; Constitution IV)
// ────────────────────────────────────────────────────────────────────────────

describe('tax RPC actual-change-only + audit (FR-021, FR-024; Constitution IV)', () => {
  it('writes nothing when values already match — no audit row (update, retire, override)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const before = await countTaxAuditRows()
      // Identical update.
      await client.query(`select * from public.update_tax_rule($1, $2, $3, $4, $5, $6, $7, $8)`, [
        taxRuleIds.vat,
        'VAT',
        '8.2500',
        'total',
        1,
        null,
        null,
        null,
      ])
      // Redundant retire.
      await client.query(CALL.retireRule, [taxRuleIds.vat, true]) // already active
      // Override already at the default (absent) → clearing again is a no-op.
      await asUser(client, authUserIds.bob, async () => {
        await client.query(`select public.set_branch_tax_override($1, $2, $3) as result`, [
          branchIds.downtown,
          taxRuleIds.vat,
          null,
        ])
      })
      expect(await countTaxAuditRows()).toBe(before)
    })
  })

  it('records one audit row per accepted change with the change summary in reason (FR-024)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const created = await client.query<{ id: string }>(CALL.createRule, [
        restaurantIds.blueOlive,
        'Audit probe',
        '3.0000',
        'total',
      ])
      const rows = await auditRows(`action = 'tax.rule_created' and resource_id = $1`, [
        created.rows[0]!.id,
      ])
      expect(rows).toHaveLength(1)
      expect(rows[0]?.reason).toContain('name=Audit probe')
      expect(rows[0]?.reason).toContain('rate=3.0000')
      expect(rows[0]?.actor_profile_id).toBe('00000000-0000-4000-8000-000000001001')

      // A real change appends the updated record.
      await client.query(`select * from public.update_tax_rule($1, $2, $3, $4, $5, $6, $7, $8)`, [
        created.rows[0]!.id,
        'Audit probe',
        '4.0000',
        'total',
        1,
        null,
        null,
        null,
      ])
      const updates = await auditRows(`action = 'tax.rule_updated' and resource_id = $1`, [
        created.rows[0]!.id,
      ])
      expect(updates).toHaveLength(1)
      expect(updates[0]?.reason).toContain('rate')

      // Retirement and deletion each record.
      await client.query(CALL.retireRule, [created.rows[0]!.id, false])
      await client.query(CALL.deleteRule, [created.rows[0]!.id])
      const retired = await auditRows(`action = 'tax.rule_retired' and resource_id = $1`, [
        created.rows[0]!.id,
      ])
      expect(retired).toHaveLength(1)
      const deleted = await auditRows(`action = 'tax.rule_deleted' and resource_id = $1`, [
        created.rows[0]!.id,
      ])
      expect(deleted).toHaveLength(1)
    })
  })

  it('clearing an absent override is a no-op; clearing a present one returns to the default (FR-009)', async () => {
    await asUser(client, authUserIds.bob, async () => {
      const absent = await client.query<{ result: { changed: boolean } }>(
        `select public.set_branch_tax_override($1, $2, $3) as result`,
        [branchIds.downtown, taxRuleIds.vat, null],
      )
      expect(absent.rows[0]!.result.changed).toBe(false)

      const set = await client.query<{ result: { changed: boolean; rate: string | null } }>(
        `select public.set_branch_tax_override($1, $2, $3) as result`,
        [branchIds.downtown, taxRuleIds.vat, '9.0000'],
      )
      expect(set.rows[0]!.result.changed).toBe(true)
      expect(set.rows[0]!.result.rate).toBe('9.0000')

      const cleared = await client.query<{ result: { changed: boolean } }>(
        `select public.set_branch_tax_override($1, $2, $3) as result`,
        [branchIds.downtown, taxRuleIds.vat, null],
      )
      expect(cleared.rows[0]!.result.changed).toBe(true)
    })
  })

  it('reordering must cover the context exactly once (FR-008)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure('P0001', 'exactly once', CALL.reorderRules, [
        restaurantIds.blueOlive,
        [taxRuleIds.vat, taxRuleIds.vat, taxRuleIds.cityTax, taxRuleIds.alcoholDuty],
      ])
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Reads — effective configuration resolution (FR-020; quickstart §5)
// ────────────────────────────────────────────────────────────────────────────

describe('tax RPC reads: effective configuration resolution (FR-020; quickstart §5)', () => {
  it('resolves Downtown: restaurant defaults + the branch-only surcharge, ordered', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const res = await client.query<{
        result: {
          branch: { id: string; name: string }
          restaurant_id: string
          rules: Array<Record<string, unknown>>
        }
      }>(`select public.get_branch_tax_config($1) as result`, [branchIds.downtown])
      const config = res.rows[0]!.result
      expect(config.branch.id).toBe(branchIds.downtown)
      expect(config.restaurant_id).toBe(restaurantIds.blueOlive)
      expect(config.rules.map((r) => r.name)).toEqual([
        'VAT',
        'City tax',
        'Alcohol duty',
        'Imported sweets tax',
        'Downtown surcharge',
      ])
      const surcharge = config.rules[4]!
      expect(surcharge.origin).toBe('branch-only')
      expect(surcharge.rate).toBe('2.0000')
      const vat = config.rules[0]!
      expect(vat.origin).toBe('restaurant')
      expect(vat.rate).toBe('8.2500')
    })
  })

  it('resolves Marina: the VAT override replaces the restaurant rate (FR-009, FR-020)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const res = await client.query<{
        result: { rules: Array<{ rule_id: string; rate: string; origin: string }> }
      }>(`select public.get_branch_tax_config($1) as result`, [branchIds.marina])
      const vat = res.rows[0]!.result.rules.find((r) => r.rule_id === taxRuleIds.vat)!
      expect(vat.rate).toBe('8.7500')
      expect(vat.origin).toBe('override')
      // No Downtown surcharge at Marina.
      expect(
        res.rows[0]!.result.rules.find((r) => r.rule_id === taxRuleIds.downtownSurcharge),
      ).toBeUndefined()
    })
  })

  it('resolves Airport (Cedar Grill) with no Blue Olive leakage', async () => {
    await asUser(client, authUserIds.eve, async () => {
      const res = await client.query<{ result: { rules: Array<{ name: string }> } }>(
        `select public.get_branch_tax_config($1) as result`,
        [branchIds.airport],
      )
      expect(res.rows[0]!.result.rules.map((r) => r.name)).toEqual(['IGIC'])
    })
  })

  it('keeps retired rules out of the effective configuration (FR-010)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const scratch = await client.query<{ id: string }>(CALL.createRule, [
        restaurantIds.blueOlive,
        'Retiring probe',
        '1.0000',
        'total',
      ])
      await client.query(CALL.retireRule, [scratch.rows[0]!.id, false])
      const res = await client.query<{ result: { rules: Array<{ rule_id: string }> } }>(
        `select public.get_branch_tax_config($1) as result`,
        [branchIds.downtown],
      )
      expect(
        res.rows[0]!.result.rules.find((r) => r.rule_id === scratch.rows[0]!.id),
      ).toBeUndefined()
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// US2 semantics — the override lifecycle (FR-003, FR-009, FR-020)
// ────────────────────────────────────────────────────────────────────────────

const CALL_OVERRIDE = `select public.set_branch_tax_override($1, $2, $3) as result`

describe('tax RPC US2 semantics: the override lifecycle (FR-003, FR-009, FR-020)', () => {
  it('a replacement rate on a branch-only rule is refused (FR-009)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure('P0001', 'restaurant-level rule', CALL_OVERRIDE, [
        branchIds.downtown,
        taxRuleIds.downtownSurcharge,
        '3.0000',
      ])
    })
  })

  it('a replacement rate on a retired rule is refused (FR-009, FR-010)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const scratch = await client.query<{ id: string }>(CALL.createRule, [
        restaurantIds.blueOlive,
        'Retiring override probe',
        '1.0000',
        'total',
      ])
      await client.query(CALL.retireRule, [scratch.rows[0]!.id, false])
      await expectRpcFailure('P0001', 'cannot be overridden', CALL_OVERRIDE, [
        branchIds.downtown,
        scratch.rows[0]!.id,
        '2.0000',
      ])
    })
  })

  it('an unknown rule id is refused with the not-found message (FR-009)', async () => {
    await asUser(client, authUserIds.bob, async () => {
      await expectRpcFailure('P0001', 'not found', CALL_OVERRIDE, [
        branchIds.downtown,
        '00000000-0000-4000-8000-00000000beef',
        '2.0000',
      ])
    })
  })

  it('a rate change on the override replaces it and cross-branches never interfere (FR-009)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      // Set a Downtown override; Marina keeps its own (seeded) state.
      await client.query(CALL_OVERRIDE, [branchIds.downtown, taxRuleIds.vat, '9.0000'])
      const downtown = await client.query<{
        result: { rules: Array<{ rule_id: string; rate: string; origin: string }> }
      }>(`select public.get_branch_tax_config($1) as result`, [branchIds.downtown])
      const vatDowntown = downtown.rows[0]!.result.rules.find((r) => r.rule_id === taxRuleIds.vat)!
      expect(vatDowntown.rate).toBe('9.0000')
      expect(vatDowntown.origin).toBe('override')

      const marina = await client.query<{
        result: { rules: Array<{ rule_id: string; rate: string; origin: string }> }
      }>(`select public.get_branch_tax_config($1) as result`, [branchIds.marina])
      const vatMarina = marina.rows[0]!.result.rules.find((r) => r.rule_id === taxRuleIds.vat)!
      expect(vatMarina.rate).toBe('8.7500')
      expect(vatMarina.origin).toBe('override')

      // Clearing restores the restaurant default.
      await client.query(CALL_OVERRIDE, [branchIds.downtown, taxRuleIds.vat, null])
      const cleared = await client.query<{
        result: { rules: Array<{ rule_id: string; rate: string; origin: string }> }
      }>(`select public.get_branch_tax_config($1) as result`, [branchIds.downtown])
      const vatCleared = cleared.rows[0]!.result.rules.find((r) => r.rule_id === taxRuleIds.vat)!
      expect(vatCleared.rate).toBe('8.2500')
      expect(vatCleared.origin).toBe('restaurant')
    })
  })

  it('override writes carry the branch scope in their audit record (FR-021, FR-024)', async () => {
    await asUser(client, authUserIds.bob, async () => {
      await client.query(CALL_OVERRIDE, [branchIds.downtown, taxRuleIds.importedSweetsTax, '7'])
      const rows = await auditRows(
        `action = 'tax.branch_override_set' and branch_id = $1 and resource_id = $2`,
        [branchIds.downtown, taxRuleIds.importedSweetsTax],
      )
      expect(rows.length).toBeGreaterThanOrEqual(1)
      // The integration suite writes to the same live audit_log; match THIS
      // override's row (the import rule is integration-suite-untouched).
      const row = rows[rows.length - 1]
      expect(row?.branch_id).toBe(branchIds.downtown)
      expect(row?.reason).toContain('rate=7.0000')
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// US1 semantics — uniqueness, coverage, and the delete carve-out
// ────────────────────────────────────────────────────────────────────────────

describe('tax RPC US1 semantics: uniqueness, coverage, and the delete carve-out (FR-005, FR-008, FR-010)', () => {
  it('rejects a compound source from another restaurant (FR-012)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure(
        'P0001',
        'active restaurant-level rule of this restaurant',
        `select * from public.create_tax_rule($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          restaurantIds.blueOlive,
          'Cross tenant',
          '1.0000',
          'items',
          null,
          null,
          [menuItemIds.hummus],
          null,
          [taxRuleIds.cedarTax],
        ],
      )
    })
  })

  it('rejects an inactive compound source (FR-012)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const doomed = await client.query<{ id: string }>(CALL.createRule, [
        restaurantIds.blueOlive,
        'Doomed source',
        '1.0000',
        'total',
      ])
      await client.query(CALL.retireRule, [doomed.rows[0]!.id, false])
      await expectRpcFailure(
        'P0001',
        'active restaurant-level rule of this restaurant',
        `select * from public.update_tax_rule($1, $2, $3, $4, $5, $6, $7, $8)`,
        [taxRuleIds.cityTax, 'City tax', '1.5000', 'total', 2, null, null, [doomed.rows[0]!.id]],
      )
    })
  })

  it('refuses delete_unused_tax_rule on a referenced rule with the contract message (FR-010)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      // VAT is referenced by the Marina override and by City tax's compound.
      await expectRpcFailure('P0001', 'cannot be deleted', CALL.deleteRule, [taxRuleIds.vat])
      // Alcohol duty has a category junction row — refused for that reason.
      await expectRpcFailure('P0001', 'cannot be deleted', CALL.deleteRule, [
        taxRuleIds.alcoholDuty,
      ])
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Calculation authorization + selection validation (FR-011, FR-014)
// ────────────────────────────────────────────────────────────────────────────

describe('tax RPC reads: calculation authorization + selection validation (FR-011, FR-014)', () => {
  it('rejects a selection naming another restaurant’s item (fail closed)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const selections = JSON.stringify([
        { item_id: '00000000-0000-4000-8000-000000006111', extras: [], quantity: 1 },
      ])
      await expectRpcFailure(
        'P0001',
        'malformed',
        `select public.calculate_branch_taxes($1, $2::jsonb) as result`,
        [branchIds.downtown, selections],
        'cross-restaurant selection',
      )
    })
  })

  it('rejects a non-array selection payload (FR-014)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure(
        'P0001',
        'malformed',
        `select public.calculate_branch_taxes($1, $2::jsonb) as result`,
        [branchIds.downtown, JSON.stringify({ item_id: menuItemIds.hummus })],
        'non-array selections',
      )
    })
  })

  it('records snapshots once-only and refuses re-recording (FR-016, FR-017)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const payload = JSON.stringify({ total: '10.00', lines: [] })
      const first = await client.query<{ result: { recorded: boolean; snapshot_id: string } }>(
        `select public.record_tax_snapshot($1, $2, $3, $4::jsonb) as result`,
        [restaurantIds.blueOlive, branchIds.downtown, 'fp:demo:1', payload],
      )
      expect(first.rows[0]?.result.recorded).toBe(true)

      const second = await client.query<{ result: { recorded: boolean; snapshot_id: string } }>(
        `select public.record_tax_snapshot($1, $2, $3, $4::jsonb) as result`,
        [restaurantIds.blueOlive, branchIds.downtown, 'fp:demo:1', payload],
      )
      expect(second.rows[0]?.result.recorded).toBe(false)
      expect(second.rows[0]?.result.snapshot_id).toBe(first.rows[0]?.result.snapshot_id)
    })
  })

  it('refuses snapshot recording to a non-owner (FR-021)', async () => {
    await asUser(client, authUserIds.bob, async () => {
      await expectRpcFailure(
        '42501',
        DENIED,
        `select * from public.record_tax_snapshot($1, $2, $3, $4::jsonb)`,
        [restaurantIds.blueOlive, branchIds.downtown, 'fp:demo:2', '{}'],
        'snapshot as branch manager',
      )
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// US3 — the calculation matrix (FR-001, FR-011–FR-015, FR-022)
// ────────────────────────────────────────────────────────────────────────────

describe('tax calculation matrix: the engine (FR-001, FR-011–FR-015, FR-022)', () => {
  it('an empty basket yields zero lines and subtotal = total (FR-012)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const result = await calculateDowntown([])
      expect(result.lines).toEqual([])
      expect(result.subtotal).toBe('0.00')
      expect(result.total).toBe('0.00')
    })
  })

  it('a retired rule stops applying to new calculations (FR-010, FR-012)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const basket = [sel(menuItemIds.hummus)]
      const scratch = await client.query<{ id: string }>(
        `select * from public.create_tax_rule($1, $2, $3, $4, $5, $6)`,
        [restaurantIds.blueOlive, 'Doomed levy', '50.0000', 'total', null, 9],
      )
      const withRule = await calculateDowntown(basket)
      expect(withRule.lines.some((line) => line.name === 'Doomed levy')).toBe(true)
      await client.query(CALL.retireRule, [scratch.rows[0]!.id, false])
      const withoutRule = await calculateDowntown(basket)
      expect(withoutRule.lines.some((line) => line.name === 'Doomed levy')).toBe(false)
    })
  })

  it('computes the full matrix: scopes, compounding, ordering (FR-011, FR-013)', async () => {
    // Basket: Hummus 6.50; 2× Lamb Kebab 18.50 + rice 3.00 each (base
    // (18.50+3.00)×2 = 43.00); 3× Baklava 6.00 (base 18.00); 2× Lemonade 4.50
    // (base 9.00). Subtotal = 6.50 + 43.00 + 18.00 + 9.00 = 76.50.
    const basket = [
      sel(menuItemIds.hummus),
      sel(menuItemIds.lambKebab, [menuExtraIds.lambExtraRice], 2),
      sel(menuItemIds.baklava, [], 3),
      sel(menuItemIds.mintLemonade, [], 2),
    ]
    const result = await asUser(client, authUserIds.alice, () => calculateDowntown(basket))
    expect(result.subtotal).toBe('76.50')
    // VAT over 76.50 = 6.31125 → 6.31; City tax over (76.50 + 6.31) = 1.24;
    // Alcohol duty over the Drinks base 9.00 = 0.90; Imported sweets over
    // the baklava base 18.00 = 0.90; surcharge over 76.50 = 1.53.
    expect(result.lines.map((line) => [line.name, line.amount])).toEqual([
      ['VAT', '6.31'],
      ['City tax', '1.24'],
      ['Alcohol duty', '0.90'],
      ['Imported sweets tax', '0.90'],
      ['Downtown surcharge', '1.53'],
    ])
    expect(result.total).toBe('87.38')
    expect(result.lines.map((line) => line.sort_order)).toEqual([1, 2, 3, 4, 5])
  })

  it('rounds half-up at the line boundary through a transaction-local rule (FR-022)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      // 3× fondant (7.50) + chocolate sauce (2.00) each = 28.50 base.
      const basket = [
        sel(menuItemIds.chocolateFondant, [menuExtraIds.fondantExtraChocolateSauce], 3),
      ]
      const scratch = await client.query<{ id: string }>(
        `select * from public.create_tax_rule($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          restaurantIds.blueOlive,
          'Half probe',
          '10.0000',
          'items',
          null,
          9,
          [menuItemIds.chocolateFondant],
          null,
        ],
      )
      const result = await calculateDowntown(basket)
      // Scratch over 28.50 = 2.85 exact; VAT 8.25% over 28.50 = 2.35125 → 2.35.
      expect(result.subtotal).toBe('28.50')
      const amounts = new Map(result.lines.map((line) => [line.name, line.amount]))
      expect(amounts.get('Half probe')).toBe('2.85')
      expect(amounts.get('VAT')).toBe('2.35')
      void scratch
    })
  })

  it('includes selected extras in the item base and honors quantity (FR-013)', async () => {
    // 2× Lamb + garlic sauce (0.00) + chili (0.50): base each 19.00 → 38.00.
    const basket = [
      sel(
        menuItemIds.lambKebab,
        [menuExtraIds.lambExtraGarlicSauce, menuExtraIds.lambExtraChili],
        2,
      ),
    ]
    const result = await asUser(client, authUserIds.alice, () => calculateDowntown(basket))
    expect(result.subtotal).toBe('38.00')
    // VAT over 38.00 = 3.135 → 3.14 (half-up on the trailing 5).
    expect(result.lines.find((line) => line.rule_id === taxRuleIds.vat)?.amount).toBe('3.14')
  })

  it('applies the branch override and includes the branch-only rule (FR-011, FR-019)', async () => {
    const basket = [sel(menuItemIds.hummus)]
    const marina = await asUser(client, authUserIds.alice, async () => {
      const res = await client.query<{ result: CalcResult }>(
        `select public.calculate_branch_taxes($1, $2::jsonb) as result`,
        [branchIds.marina, JSON.stringify(basket)],
      )
      return res.rows[0]!.result
    })
    expect(marina.subtotal).toBe('6.50')
    // VAT 8.75% over 6.50 = 0.57; City tax over (6.50+0.57) = 0.11; no
    // Downtown surcharge at Marina.
    expect(marina.lines.map((line) => [line.name, line.amount])).toEqual([
      ['VAT', '0.57'],
      ['City tax', '0.11'],
    ])
    expect(marina.total).toBe('7.18')
  })

  it('compounding follows the override: the overridden amount feeds the compound base', async () => {
    // City tax compounds on VAT; at Marina VAT is 8.75%, so City's base is
    // the OVERRIDDEN amount — 0.11 over 7.07, not 0.10 over 7.04.
    const basket = [sel(menuItemIds.hummus)]
    const marina = await asUser(client, authUserIds.alice, async () => {
      const res = await client.query<{ result: CalcResult }>(
        `select public.calculate_branch_taxes($1, $2::jsonb) as result`,
        [branchIds.marina, JSON.stringify(basket)],
      )
      return res.rows[0]!.result
    })
    expect(marina.lines.find((line) => line.name === 'City tax')?.amount).toBe('0.11')
  })

  it('is deterministic: an identical repeat is byte-identical and writes nothing (FR-022)', async () => {
    const basket = [
      sel(menuItemIds.hummus),
      sel(menuItemIds.baklava, [], 2),
      sel(menuItemIds.mintLemonade),
    ]
    const first = await asUser(client, authUserIds.alice, () => calculateDowntown(basket))
    const second = await asUser(client, authUserIds.alice, () => calculateDowntown(basket))
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    // Calculations never write: the tax audit-row count is unchanged by the
    // repeat (relative check — the live audit_log is shared with integration).
    const before = await countTaxAuditRows()
    await asUser(client, authUserIds.alice, () => calculateDowntown(basket))
    expect(await countTaxAuditRows()).toBe(before)
  })

  it('rejects malformed selections with the contract message (FR-014)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectRpcFailure(
        'P0001',
        'malformed',
        `select public.calculate_branch_taxes($1, $2::jsonb) as result`,
        [branchIds.downtown, JSON.stringify([sel(menuItemIds.hummus), { nope: true }])],
        'malformed selection entry',
      )
      await expectRpcFailure(
        'P0001',
        'malformed',
        `select public.calculate_branch_taxes($1, $2::jsonb) as result`,
        [branchIds.downtown, JSON.stringify([{ item_id: 'not-a-uuid', extras: [] }])],
        'non-uuid item id',
      )
    })
  })

  it('an ordering change moves City tax before VAT and changes its base exactly (FR-011)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await client.query(`select * from public.update_tax_rule($1, $2, $3, $4, $5, $6, $7, $8)`, [
        taxRuleIds.cityTax,
        'City tax',
        '1.5000',
        'total',
        0,
        null,
        null,
        null,
      ])
      const result = await calculateDowntown([sel(menuItemIds.hummus)])
      // City tax first: 1.5% over 6.50 = 0.10; VAT second: 0.54; the
      // surcharge still applies at its own position.
      expect(result.lines.map((line) => [line.name, line.amount])).toEqual([
        ['City tax', '0.10'],
        ['VAT', '0.54'],
        ['Downtown surcharge', '0.13'],
      ])
    })
  })

  it('a scratch compound pair proves the base includes the earlier amount exactly (FR-013)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const basket = [
        sel(menuItemIds.chocolateFondant, [
          menuExtraIds.fondantVanillaIceCream,
          menuExtraIds.fondantExtraChocolateSauce,
        ]),
      ]
      // Scratch: Sweets fee 10% (total, o=9) compounded by Service levy 10%
      // (o=10). Levy base = 13.00 + 1.30 = 14.30 → 1.43 (not 1.30).
      const fee = await client.query<{ id: string }>(
        `select * from public.create_tax_rule($1, $2, $3, $4, $5, $6)`,
        [restaurantIds.blueOlive, 'Sweets fee', '10.0000', 'total', null, 9],
      )
      const levy = await client.query<{ id: string }>(
        `select * from public.create_tax_rule($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          restaurantIds.blueOlive,
          'Service levy',
          '10.0000',
          'total',
          null,
          10,
          null,
          null,
          [fee.rows[0]!.id],
        ],
      )
      const result = await calculateDowntown(basket)
      const amounts = new Map(result.lines.map((line) => [line.name, line.amount]))
      expect(amounts.get('Sweets fee')).toBe('1.30')
      expect(amounts.get('Service levy')).toBe('1.43')
      void levy
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// US4 — the snapshot mechanism (FR-016, FR-017, FR-021)
// ────────────────────────────────────────────────────────────────────────────

describe('tax snapshots: recorded payload, immutability, and read scope (FR-016, FR-017)', () => {
  it('a recorded payload reads back exactly as produced (FR-016)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const calculation = await calculateDowntown([sel(menuItemIds.hummus)])
      const payload = JSON.stringify({
        lines: calculation.lines,
        subtotal: calculation.subtotal,
        total: calculation.total,
      })
      const recorded = await client.query<{ result: { recorded: boolean; snapshot_id: string } }>(
        `select public.record_tax_snapshot($1, $2, $3, $4::jsonb) as result`,
        [restaurantIds.blueOlive, branchIds.downtown, 'fp:us4:roundtrip', payload],
      )
      expect(recorded.rows[0]?.result.recorded).toBe(true)

      await client.query('set local role postgres')
      const stored = await client.query<{ payload: unknown }>(
        `select payload from public.tax_snapshots where id = $1`,
        [recorded.rows[0]!.result.snapshot_id],
      )
      await client.query('set local role authenticated')
      expect(stored.rows[0]?.payload).toEqual(JSON.parse(payload))
    })
  })

  it('a recorded snapshot has no update path — the attempt is denied (FR-017)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await expectStatementToFail(
        client,
        '42501',
        `update public.tax_snapshots set payload = '{"total":"0.00"}'::jsonb
          where restaurant_id = $1 and fingerprint = 'fp:us4:roundtrip'`,
        [restaurantIds.blueOlive],
      )
    })
  })

  it('a non-restaurant member is denied recording, and reads only through staff policies (FR-021)', async () => {
    await asUser(client, authUserIds.eve, async () => {
      await expectRpcFailure(
        '42501',
        DENIED,
        `select * from public.record_tax_snapshot($1, $2, $3, $4::jsonb)`,
        [restaurantIds.blueOlive, branchIds.downtown, 'fp:us4:eve', '{}'],
        'snapshot record as eve',
      )
    })
    // Eve records nothing anywhere — Blue Olive snapshots are invisible to
    // her through the staff-select policy even though her Cedar Grill
    // membership grants the SELECT itself (zero rows, not an error).
    const eveRows = await asUser(client, authUserIds.eve, async () => {
      const res = await client.query<{ n: string }>(
        `select count(*)::text as n from public.tax_snapshots where restaurant_id = $1`,
        [restaurantIds.blueOlive],
      )
      return res.rows[0]!.n
    })
    expect(eveRows).toBe('0')
  })

  it('no surface of this feature records snapshots (clarification 3, executable guard)', () => {
    // The client module is the only import path for tax RPCs; it must expose
    // no snapshot method, so no surface can call the function by accident.
    const surfaceMethodNames = Object.keys(taxClient)
    expect(surfaceMethodNames).not.toContain('recordSnapshot')
    expect(surfaceMethodNames).not.toContain('recordTaxSnapshot')
  })
})
