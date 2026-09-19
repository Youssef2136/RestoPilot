import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, expectStatementToFail, inTransaction } from './helpers/db'
import {
  branchIds,
  menuCategoryIds,
  menuItemIds,
  restaurantIds,
  seedBranchTaxOverrides,
  seedTaxRuleCategories,
  seedTaxRuleCompounds,
  seedTaxRuleItems,
  seedTaxRules,
  taxRuleIds,
} from './helpers/fixtures'

/**
 * Schema-level tests for the Phase 5 tax model (spec 006 FR-004–FR-010,
 * FR-016, FR-017, FR-019; data-model.md; research.md §1, §5–§7).
 *
 * These assert what the DATABASE declares — column shapes, the constraints by
 * name that the RPCs translate into messages, the select-only grant posture,
 * the FK-free snapshot design, and the seeded fixture contract. Behavior
 * (authorization, ordering, compounding, override resolution) lives in
 * `tax.rpc.test.ts` (T009).
 *
 * Preconditions: the cloud development database is migrated and seeded.
 * Every mutation runs inside a transaction that is rolled back.
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

describe('tax tables: declared columns, types, nullability (data-model.md)', () => {
  const columnShapes: Record<string, Array<[string, string, string]>> = {
    tax_rules: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['branch_id', 'uuid', 'YES'],
      ['name', 'text', 'NO'],
      ['rate', 'numeric', 'NO'],
      ['scope', 'text', 'NO'],
      ['sort_order', 'integer', 'NO'],
      ['is_active', 'boolean', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ],
    tax_rule_items: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['rule_id', 'uuid', 'NO'],
      ['item_id', 'uuid', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ],
    tax_rule_categories: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['rule_id', 'uuid', 'NO'],
      ['category_id', 'uuid', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ],
    tax_rule_compounds: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['rule_id', 'uuid', 'NO'],
      ['source_rule_id', 'uuid', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ],
    branch_tax_overrides: [
      ['branch_id', 'uuid', 'NO'],
      ['rule_id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['rate', 'numeric', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ],
    tax_snapshots: [
      ['id', 'uuid', 'NO'],
      ['restaurant_id', 'uuid', 'NO'],
      ['branch_id', 'uuid', 'NO'],
      ['fingerprint', 'text', 'NO'],
      ['recorded_at', 'timestamp with time zone', 'YES'],
      ['payload', 'jsonb', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ],
  }

  it.each(Object.entries(columnShapes))(
    '%s matches its declared shape',
    async (table, expected) => {
      const { rows } = await client.query<{
        column_name: string
        data_type: string
        is_nullable: string
      }>(
        `select column_name, data_type, is_nullable
         from information_schema.columns
        where table_schema = 'public' and table_name = $1
        order by ordinal_position`,
        [table],
      )
      expect(rows.map((r) => [r.column_name, r.data_type, r.is_nullable])).toEqual(expected)
    },
  )

  it('stores rates as exact decimals with four places over the full 0–100 range (FR-007, research.md §1)', async () => {
    const { rows } = await client.query<{
      table_name: string
      column_name: string
      numeric_precision: number
      numeric_scale: number
    }>(
      `select table_name, column_name, numeric_precision, numeric_scale
         from information_schema.columns
        where table_schema = 'public'
          and table_name in ('tax_rules', 'branch_tax_overrides')
          and column_name = 'rate'
        order by table_name`,
    )
    // numeric(7,4): the seed's 10% fixture proved numeric(5,4) cannot carry a
    // two-digit rate; the widening migration is the fix (research.md §1 note).
    expect(rows).toEqual([
      {
        table_name: 'branch_tax_overrides',
        column_name: 'rate',
        numeric_precision: 7,
        numeric_scale: 4,
      },
      { table_name: 'tax_rules', column_name: 'rate', numeric_precision: 7, numeric_scale: 4 },
    ])
  })
})

describe('tax constraints: the declarative guarantees the RPCs rely on', () => {
  it('rejects a rate outside 0–100 and accepts the boundaries plus two-digit rates (FR-007)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.tax_rules (restaurant_id, name, rate, scope)
         values ($1, 'Under', -0.0001, 'total')`,
        [restaurantIds.blueOlive],
      )
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.tax_rules (restaurant_id, name, rate, scope)
         values ($1, 'Over', 100.0001, 'total')`,
        [restaurantIds.blueOlive],
      )
      // Boundaries and the two-digit rates the original numeric(5,4) could
      // not hold (research.md §1 implementation correction).
      const { rows } = await client.query<{ rate: string }>(
        `insert into public.tax_rules (restaurant_id, name, rate, scope)
         values ($1, 'Boundary 100', 100, 'total'),
                ($1, 'Two digits', 10, 'total')
         returning rate::text`,
        [restaurantIds.blueOlive],
      )
      expect(rows.map((r) => r.rate).sort()).toEqual(['10.0000', '100.0000'])
    })
  })

  it('rejects blank and over-long rule names (FR-005)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.tax_rules (restaurant_id, name, rate, scope) values ($1, '   ', 1, 'total')`,
        [restaurantIds.blueOlive],
      )
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.tax_rules (restaurant_id, name, rate, scope) values ($1, $2, 1, 'total')`,
        [restaurantIds.blueOlive, 'x'.repeat(81)],
      )
    })
  })

  it('rejects a case-insensitive duplicate name within a restaurant across both kinds of rule (FR-005)', async () => {
    await inTransaction(client, async () => {
      // Lowercase form of the seeded restaurant-level 'VAT'…
      await expectStatementToFail(
        client,
        '23505',
        `insert into public.tax_rules (restaurant_id, name, rate, scope)
         values ($1, ' vat ', 1, 'total')`,
        [restaurantIds.blueOlive],
      )
      // …and of the seeded BRANCH-ONLY 'Downtown surcharge' — one namespace.
      await expectStatementToFail(
        client,
        '23505',
        `insert into public.tax_rules (restaurant_id, branch_id, name, rate, scope)
         values ($1, $2, 'DOWNTOWN SURCHARGE', 1, 'total')`,
        [restaurantIds.blueOlive, branchIds.downtown],
      )
      // The same name is fine in another restaurant.
      const { rows } = await client.query<{ id: string }>(
        `insert into public.tax_rules (restaurant_id, name, rate, scope)
         values ($1, 'VAT', 7, 'total') returning id`,
        [restaurantIds.cedarGrill],
      )
      expect(rows).toHaveLength(1)
    })
  })

  it('rejects an out-of-vocabulary scope and a negative sort order (FR-008, data-model.md)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.tax_rules (restaurant_id, name, rate, scope) values ($1, 'Global', 1, 'global')`,
        [restaurantIds.blueOlive],
      )
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.tax_rules (restaurant_id, name, rate, scope, sort_order)
         values ($1, 'Negative', 1, 'total', -1)`,
        [restaurantIds.blueOlive],
      )
    })
  })

  it('rejects cross-restaurant targets, sources, and override branches (composite FKs, FR-006)', async () => {
    await inTransaction(client, async () => {
      // An item target belonging to another restaurant…
      await expectStatementToFail(
        client,
        '23503',
        `insert into public.tax_rule_items (restaurant_id, rule_id, item_id)
         values ($1, $2, $3)`,
        [restaurantIds.blueOlive, taxRuleIds.vat, menuItemIds.cedarMixedGrill],
      )
      // …a category target of another restaurant…
      await expectStatementToFail(
        client,
        '23503',
        `insert into public.tax_rule_categories (restaurant_id, rule_id, category_id)
         values ($1, $2, $3)`,
        [restaurantIds.blueOlive, taxRuleIds.vat, menuCategoryIds.cedarGrillGrill],
      )
      // …a compound source of another restaurant…
      await expectStatementToFail(
        client,
        '23503',
        `insert into public.tax_rule_compounds (restaurant_id, rule_id, source_rule_id)
         values ($1, $2, $3)`,
        [restaurantIds.blueOlive, taxRuleIds.cityTax, taxRuleIds.cedarTax],
      )
      // …and an override whose branch belongs to another restaurant.
      await expectStatementToFail(
        client,
        '23503',
        `insert into public.branch_tax_overrides (branch_id, rule_id, restaurant_id, rate)
         values ($1, $2, $3, 5)`,
        [branchIds.airport, taxRuleIds.vat, restaurantIds.blueOlive],
      )
    })
  })

  it('rejects a self-referencing compound and a duplicate (rule, source) pair (FR-012, data-model.md)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23514',
        `insert into public.tax_rule_compounds (restaurant_id, rule_id, source_rule_id)
         values ($1, $2, $2)`,
        [restaurantIds.blueOlive, taxRuleIds.cityTax],
      )
      await expectStatementToFail(
        client,
        '23505',
        `insert into public.tax_rule_compounds (restaurant_id, rule_id, source_rule_id)
         values ($1, $2, $3)`,
        [restaurantIds.blueOlive, taxRuleIds.cityTax, taxRuleIds.vat],
      )
    })
  })

  it('rejects a duplicate override pair — the PK is (branch_id, rule_id) (FR-009)', async () => {
    await inTransaction(client, async () => {
      await expectStatementToFail(
        client,
        '23505',
        `insert into public.branch_tax_overrides (branch_id, rule_id, restaurant_id, rate)
         values ($1, $2, $3, 9)`,
        [branchIds.marina, taxRuleIds.vat, restaurantIds.blueOlive],
      )
    })
  })

  it('declares the case-insensitive name-uniqueness expression index (FR-005)', async () => {
    const { rows } = await client.query<{ indexdef: string }>(
      `select indexdef from pg_indexes
        where schemaname = 'public' and indexname = 'tax_rules_restaurant_name_key'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.indexdef).toContain('UNIQUE')
    expect(rows[0]?.indexdef).toContain('lower(btrim(name))')
  })

  it('keeps snapshots FK-free and once-only recorded (FR-016, FR-017, research.md §7)', async () => {
    const fks = await client.query<{ count: string }>(
      `select count(*) from pg_constraint
        where conrelid = 'public.tax_snapshots'::regclass and contype = 'f'`,
    )
    expect(Number(fks.rows[0]?.count)).toBe(0)

    const { rows } = await client.query<{ indexdef: string }>(
      `select indexdef from pg_indexes
        where schemaname = 'public' and indexname = 'tax_snapshots_fingerprint_once_key'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.indexdef).toContain('UNIQUE')
    expect(rows[0]?.indexdef).toMatch(/WHERE \(recorded_at IS NOT NULL\)/)
  })
})

describe('tax policies: visibility rules and the write posture (FR-004, FR-019, FR-021)', () => {
  it('declares exactly the six documented select policies', async () => {
    const { rows } = await client.query<{
      tablename: string
      policyname: string
      cmd: string
      roles: string
    }>(
      `select tablename, policyname, cmd, array_to_string(roles, ',') as roles
         from pg_policies
        where schemaname = 'public'
          and tablename in ('tax_rules', 'tax_rule_items', 'tax_rule_categories',
                            'tax_rule_compounds', 'branch_tax_overrides', 'tax_snapshots')
        order by tablename, policyname`,
    )
    expect(rows).toEqual([
      {
        tablename: 'branch_tax_overrides',
        policyname: 'branch_tax_overrides_staff_select',
        cmd: 'SELECT',
        roles: 'authenticated',
      },
      {
        tablename: 'tax_rule_categories',
        policyname: 'tax_rule_categories_staff_select',
        cmd: 'SELECT',
        roles: 'authenticated',
      },
      {
        tablename: 'tax_rule_compounds',
        policyname: 'tax_rule_compounds_staff_select',
        cmd: 'SELECT',
        roles: 'authenticated',
      },
      {
        tablename: 'tax_rule_items',
        policyname: 'tax_rule_items_staff_select',
        cmd: 'SELECT',
        roles: 'authenticated',
      },
      {
        tablename: 'tax_rules',
        policyname: 'tax_rules_staff_select',
        cmd: 'SELECT',
        roles: 'authenticated',
      },
      {
        tablename: 'tax_snapshots',
        policyname: 'tax_snapshots_staff_select',
        cmd: 'SELECT',
        roles: 'authenticated',
      },
    ])
  })

  it('grants select only — no client write grant exists on any tax table (Constitution IV)', async () => {
    const { rows } = await client.query<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type
         from information_schema.role_table_grants
        where table_schema = 'public'
          and table_name in ('tax_rules', 'tax_rule_items', 'tax_rule_categories',
                             'tax_rule_compounds', 'branch_tax_overrides', 'tax_snapshots')
          and grantee = 'authenticated'
        order by table_name, privilege_type`,
    )
    expect(rows.every((r) => r.privilege_type === 'SELECT')).toBe(true)
    expect(rows).toHaveLength(6)
  })

  it('enables row level security on every tax table', async () => {
    const { rows } = await client.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity
         from pg_class
        where relnamespace = 'public'::regnamespace
          and relname in ('tax_rules', 'tax_rule_items', 'tax_rule_categories',
                          'tax_rule_compounds', 'branch_tax_overrides', 'tax_snapshots')
        order by relname`,
    )
    expect(rows).toHaveLength(6)
    expect(rows.every((r) => r.relrowsecurity)).toBe(true)
  })
})

describe('seed matches the fixture contract (FR-023, SC-007)', () => {
  it('rules, targets, compounds, and overrides match fixtures.ts', async () => {
    const rules = await client.query(
      `select id, restaurant_id, branch_id, name, rate::text, scope, sort_order, is_active
         from public.tax_rules order by id`,
    )
    expect(rules.rows).toEqual([...seedTaxRules].sort((a, b) => a.id.localeCompare(b.id)))

    const ruleItems = await client.query(
      `select id, restaurant_id, rule_id, item_id from public.tax_rule_items order by id`,
    )
    expect(ruleItems.rows).toEqual([...seedTaxRuleItems].sort((a, b) => a.id.localeCompare(b.id)))

    const ruleCategories = await client.query(
      `select id, restaurant_id, rule_id, category_id from public.tax_rule_categories order by id`,
    )
    expect(ruleCategories.rows).toEqual(
      [...seedTaxRuleCategories].sort((a, b) => a.id.localeCompare(b.id)),
    )

    const compounds = await client.query(
      `select id, restaurant_id, rule_id, source_rule_id from public.tax_rule_compounds order by id`,
    )
    expect(compounds.rows).toEqual(
      [...seedTaxRuleCompounds].sort((a, b) => a.id.localeCompare(b.id)),
    )

    const overrides = await client.query(
      `select branch_id, rule_id, restaurant_id, rate::text
         from public.branch_tax_overrides order by branch_id`,
    )
    expect(overrides.rows).toEqual(
      [...seedBranchTaxOverrides].sort((a, b) => a.branch_id.localeCompare(b.branch_id)),
    )
  })

  it('seeds a ten-percent rule — the two-digit rate the widened precision must hold (research.md §1)', async () => {
    const { rows } = await client.query<{ rate: string }>(
      `select rate::text from public.tax_rules where id = $1`,
      [taxRuleIds.alcoholDuty],
    )
    expect(rows[0]?.rate).toBe('10.0000')
  })

  it('seeds no snapshot rows (no surface records in this phase — clarification 3)', async () => {
    const { rows } = await client.query<{ count: string }>(
      `select count(*) from public.tax_snapshots`,
    )
    expect(Number(rows[0]?.count)).toBe(0)
  })
})
