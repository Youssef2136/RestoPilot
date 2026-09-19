#!/usr/bin/env node
/**
 * T037 — executes the three quickstart.md walkthroughs against the real
 * development project through the real data APIs (the feature 003/004/005
 * method) and prints a step-by-step PASS/FAIL transcript. Run:
 * node --env-file-if-exists=.env scripts/run-walkthroughs.mjs
 *
 * The walkthroughs mutate the fixture (scratch rules, VAT rate, reorders);
 * the script cleans up after itself and the quickstart's restore step
 * (`npm run db:reset -- --yes && npm run db:seed`) restores the
 * deterministic state regardless.
 */
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY')

const RESTAURANT = {
  blueOlive: '00000000-0000-4000-8000-000000000001',
}
const BRANCH = {
  downtown: '00000000-0000-4000-8000-000000000101',
  marina: '00000000-0000-4000-8000-000000000102',
}
const ITEM = { lambKebab: '00000000-0000-4000-8000-000000006014' }
const EXTRA = { lambExtraRice: '00000000-0000-4000-8000-000000006032' }
const RULE = {
  vat: '00000000-0000-4000-8000-000000007001',
  cityTax: '00000000-0000-4000-8000-000000007002',
  alcoholDuty: '00000000-0000-4000-8000-000000007003',
  importedSweetsTax: '00000000-0000-4000-8000-000000007004',
  downtownSurcharge: '00000000-0000-4000-8000-000000007005',
}
const SEEDED_ORDER = [
  RULE.vat,
  RULE.cityTax,
  RULE.alcoholDuty,
  RULE.importedSweetsTax,
  RULE.downtownSurcharge,
]

const creds = {
  alice: ['alice@restopilot.dev', 'dev-alice-2026'],
  bob: ['bob@restopilot.dev', 'dev-bob-2026'],
  carla: ['carla@restopilot.dev', 'dev-carla-2026'],
  eve: ['eve@restopilot.dev', 'dev-eve-2026'],
  fiona: ['fiona@restopilot.dev', 'dev-fiona-2026'],
}

let seq = 0
function clientFor() {
  seq += 1
  return createClient(url, key, { auth: { storageKey: `wk-${seq}` } })
}

async function signIn([email, password]) {
  const c = clientFor()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
  return c
}

const results = []
function check(step, ok, detail) {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`)
}
function expect(cond, msg) {
  if (!cond) throw new Error(`expectation failed: ${msg}`)
}
async function rpcAs(c, fn, args) {
  const { data, error } = await c.rpc(fn, args)
  return { data, error }
}
function expectOk(res, what) {
  expect(!res.error, `${what}: ${res.error?.message ?? ''}`)
  return res.data
}

// ── Walkthrough A — the owner builds the tax configuration (SC-001) ─────────
async function walkthroughA() {
  console.log('\n── Walkthrough A — the owner builds the tax configuration ──')
  const alice = await signIn(creds.alice)

  // Steps 1–2: seeded rules render in (sort_order, name) order; compound pair shown.
  const cfgDowntown = expectOk(
    await rpcAs(alice, 'get_branch_tax_config', { p_branch_id: BRANCH.downtown }),
    'A2 config read',
  )
  const names = cfgDowntown.rules.map((r) => r.name)
  check(
    'A1-2 seeded config order + compound pair',
    names[0] === 'VAT' && names[1] === 'City tax',
    names.join(' → '),
  )
  const cityRule = cfgDowntown.rules.find((r) => r.name === 'City tax')
  check(
    'A2 City tax compounds on VAT',
    Array.isArray(cityRule?.compound_sources) && cityRule.compound_sources[0] === RULE.vat,
    `compound_sources=${JSON.stringify(cityRule?.compound_sources)}`,
  )

  // Step 3: create Regional levy, reorder to position 1, verify it applies immediately.
  const levy = expectOk(
    await rpcAs(alice, 'create_tax_rule', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_name: 'Regional levy',
      p_rate: '0.5',
      p_scope: 'total',
      p_branch_id: null,
      p_sort_order: 6,
    }),
    'A3 create levy',
  )
  const levyId = levy.id
  expect(!!levyId, 'levy id')
  // The reorder list must contain EVERY active restaurant-level rule exactly
  // once — build it from the live set so scratch rules keep their positions.
  const activeA = await alice
    .from('tax_rules')
    .select('id, sort_order')
    .eq('restaurant_id', RESTAURANT.blueOlive)
    .is('branch_id', null)
    .eq('is_active', true)
  const levyFirst = [levyId, ...(activeA.data ?? []).map((r) => r.id).filter((id) => id !== levyId)]
  expectOk(
    await rpcAs(alice, 'reorder_tax_rules', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_rule_ids: levyFirst,
    }),
    'A3 reorder',
  )
  const afterReorder = expectOk(
    await rpcAs(alice, 'get_branch_tax_config', { p_branch_id: BRANCH.downtown }),
    'A3 config after reorder',
  )
  check(
    'A3 new order applied immediately',
    afterReorder.rules[0]?.name === 'Regional levy',
    afterReorder.rules.map((r) => r.name).join(' → '),
  )
  // Restore the seeded order right away so B and C start from the fixture.
  // The restaurant-level context holds the four seeded restaurant rules plus
  // the levy; Downtown surcharge is branch-scoped and not part of it.
  expectOk(
    await rpcAs(alice, 'reorder_tax_rules', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_rule_ids: [RULE.vat, RULE.cityTax, RULE.alcoholDuty, RULE.importedSweetsTax, levyId],
    }),
    'A3 restore order',
  )

  // Step 4: edit VAT's rate to 8.5 → effective at Downtown reflects it.
  // update_tax_rule is a full-form update: name, rate, and scope are required;
  // VAT is a total-scope rule, so no targets.
  expectOk(
    await rpcAs(alice, 'update_tax_rule', {
      p_rule_id: RULE.vat,
      p_name: 'VAT',
      p_rate: '8.5',
      p_scope: 'total',
      p_sort_order: 1,
      p_item_ids: null,
      p_category_ids: null,
      p_compound_source_ids: null,
    }),
    'A4 edit VAT rate',
  )
  const afterEdit = expectOk(
    await rpcAs(alice, 'get_branch_tax_config', { p_branch_id: BRANCH.downtown }),
    'A4 config after edit',
  )
  const vatAfter = afterEdit.rules.find((r) => r.name === 'VAT')
  check('A4 Downtown effective rate 8.5000', vatAfter?.rate === '8.5000', vatAfter?.rate)

  // Step 5: invalid inputs — each rejected, nothing stored.
  const invalids = [
    ['blank name', { p_name: '   ' }],
    ['duplicate name (vat)', { p_name: 'vat' }],
    ['rate 108', { p_rate: '108' }],
    ['rate 8.25123', { p_rate: '8.25123' }],
    ['category scope, no targets', { p_name: 'Broken cat rule', p_scope: 'categories' }],
  ]
  for (const [label, patch] of invalids) {
    const res = await rpcAs(alice, 'create_tax_rule', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_name: 'Scratch',
      p_rate: '1',
      p_scope: 'total',
      p_branch_id: null,
      p_sort_order: 9,
      ...patch,
    })
    check(
      `A5 rejects ${label}`,
      !!res.error,
      res.error ? `${res.error.code}: ${res.error.message}` : 'UNEXPECTEDLY ACCEPTED',
    )
  }

  // Step 6: retire the levy — leaves the effective config, stays in the owner list.
  expectOk(
    await rpcAs(alice, 'retire_tax_rule', { p_rule_id: levyId, p_active: false }),
    'A6 retire',
  )
  const afterRetire = expectOk(
    await rpcAs(alice, 'get_branch_tax_config', { p_branch_id: BRANCH.downtown }),
    'A6 config after retire',
  )
  check(
    'A6 retired rule leaves effective config',
    !afterRetire.rules.some((r) => r.name === 'Regional levy'),
  )
  const ownerRow = await alice.from('tax_rules').select('id, name, is_active').eq('id', levyId)
  check(
    'A6 retired rule remains visible with state',
    ownerRow.data?.length === 1 && ownerRow.data[0].is_active === false,
  )

  // Step 7: delete-check — the unused levy deletable; VAT not (referenced).
  const del = await rpcAs(alice, 'delete_unused_tax_rule', { p_rule_id: levyId })
  check('A7 unused levy deletable', !del.error, del.error?.message ?? 'deleted')
  const delVat = await rpcAs(alice, 'delete_unused_tax_rule', { p_rule_id: RULE.vat })
  check(
    'A7 VAT delete refused with reason',
    !!delVat.error,
    delVat.error ? `${delVat.error.code}: ${delVat.error.message}` : 'UNEXPECTEDLY DELETED',
  )

  return { alice, levyId }
}

// ── Walkthrough B — the branch journey: overrides and the preview ───────────
async function walkthroughB() {
  console.log('\n── Walkthrough B — the branch journey: overrides and the preview ──')
  const alice = await signIn(creds.alice)
  const bob = await signIn(creds.bob)
  const carla = await signIn(creds.carla)

  // Step 1: Marina effective config — VAT from the override, no Downtown surcharge.
  const marina = expectOk(
    await rpcAs(alice, 'get_branch_tax_config', { p_branch_id: BRANCH.marina }),
    'B1 Marina config',
  )
  const vatMarina = marina.rules.find((r) => r.name === 'VAT')
  check(
    'B1 Marina VAT origin=override 8.7500, no surcharge',
    vatMarina?.rate === '8.7500' &&
      vatMarina?.origin === 'override' &&
      !marina.rules.some((r) => r.name === 'Downtown surcharge'),
    `VAT ${vatMarina?.rate} origin=${vatMarina?.origin}`,
  )

  // Step 2: bob sets his own branch; denied at Marina; denied restaurant-level edits.
  const setOwn = await rpcAs(bob, 'set_branch_tax_override', {
    p_branch_id: BRANCH.downtown,
    p_rule_id: RULE.vat,
    p_rate: '9.0000',
  })
  check('B2 bob sets Downtown replacement 9.0000', !setOwn.error, setOwn.error?.message)
  const atMarina = await rpcAs(bob, 'set_branch_tax_override', {
    p_branch_id: BRANCH.marina,
    p_rule_id: RULE.vat,
    p_rate: '9.0000',
  })
  check(
    'B2 bob denied at Marina (42501)',
    atMarina.error?.code === '42501',
    atMarina.error?.message,
  )
  const editRestaurant = await rpcAs(bob, 'update_tax_rule', {
    p_rule_id: RULE.vat,
    p_name: 'VAT',
    p_rate: '99',
    p_scope: 'total',
    p_sort_order: 1,
    p_item_ids: null,
    p_category_ids: null,
    p_compound_source_ids: null,
  })
  check(
    'B2 bob denied editing restaurant-level VAT',
    !!editRestaurant.error,
    editRestaurant.error?.message,
  )

  // Step 3: carla reads the config; every write path denies her.
  const carlaCfg = expectOk(
    await rpcAs(carla, 'get_branch_tax_config', { p_branch_id: BRANCH.downtown }),
    'B3 carla config read',
  )
  check(
    'B3 carla reads Downtown config',
    carlaCfg.rules.length > 0,
    `${carlaCfg.rules.length} rules`,
  )
  const carlaWrite = await rpcAs(carla, 'set_branch_tax_override', {
    p_branch_id: BRANCH.downtown,
    p_rule_id: RULE.vat,
    p_rate: '5',
  })
  check(
    'B3 carla denied any override write',
    carlaWrite.error?.code === '42501',
    carlaWrite.error?.message,
  )

  // Step 4: the preview — lamb kebab 18.50 + rice 3.00, qty 2 → subtotal 43.00.
  const basket = [{ item_id: ITEM.lambKebab, extras: [EXTRA.lambExtraRice], quantity: 2 }]
  const preview = expectOk(
    await rpcAs(bob, 'calculate_branch_taxes', {
      p_branch_id: BRANCH.downtown,
      p_selections: basket,
    }),
    'B4 calculation',
  )
  const vatLine = preview.lines.find((l) => l.name === 'VAT')
  const cityLine = preview.lines.find((l) => l.name === 'City tax')
  const surchargeLine = preview.lines.find((l) => l.name === 'Downtown surcharge')
  const levyLine = preview.lines.find((l) => l.name === 'Regional levy')
  // VAT 43.00×9%=3.87; City (43.00+3.87)×1.5%=7.0305→0.70 half-up;
  // surcharge 43.00×2%=0.86; total 48.43. (The Regional levy from Walkthrough
  // A was retired and deleted in A6/A7, so it contributes no line here.)
  check(
    'B4 VAT 3.87 → City 0.70 (compound), surcharge 0.86, total 48.43, no levy',
    vatLine?.amount === '3.87' &&
      cityLine?.amount === '0.70' &&
      surchargeLine?.amount === '0.86' &&
      levyLine === undefined &&
      preview.subtotal === '43.00' &&
      preview.total === '48.43',
    `subtotal=${preview.subtotal} ${preview.lines.map((l) => `${l.name}=${l.amount}`).join(', ')} total=${preview.total}`,
  )
  // Byte-identical repeat.
  const repeat = expectOk(
    await rpcAs(bob, 'calculate_branch_taxes', {
      p_branch_id: BRANCH.downtown,
      p_selections: basket,
    }),
    'B4 repeat',
  )
  check(
    'B4 identical repeat is byte-identical (FR-011)',
    JSON.stringify(preview) === JSON.stringify(repeat),
  )

  // Step 5: clear bob's override → effective back to Walkthrough A's 8.5000.
  const clear = await rpcAs(bob, 'set_branch_tax_override', {
    p_branch_id: BRANCH.downtown,
    p_rule_id: RULE.vat,
    p_rate: null,
  })
  check('B5 bob clears his override', !clear.error, clear.error?.message)
  const afterClear = expectOk(
    await rpcAs(bob, 'get_branch_tax_config', { p_branch_id: BRANCH.downtown }),
    'B5 config after clear',
  )
  const vatAfter = afterClear.rules.find((r) => r.name === 'VAT')
  check('B5 effective back to 8.5000', vatAfter?.rate === '8.5000', vatAfter?.rate)
  const preview2 = expectOk(
    await rpcAs(bob, 'calculate_branch_taxes', {
      p_branch_id: BRANCH.downtown,
      p_selections: basket,
    }),
    'B5 recalc',
  )
  const vatLine2 = preview2.lines.find((l) => l.name === 'VAT')
  // 43.00 × 8.5% = 3.655 → 3.66 half-up.
  check('B5 VAT line 3.66 at 8.5%', vatLine2?.amount === '3.66', vatLine2?.amount)
}

// ── Walkthrough C — isolation, matrix spot-checks, snapshots, audit ─────────
async function walkthroughC() {
  console.log('\n── Walkthrough C — isolation, the matrix, snapshots, audit ──')
  const alice = await signIn(creds.alice)
  const bob = await signIn(creds.bob)
  const eve = await signIn(creds.eve)
  const fiona = await signIn(creds.fiona)

  // Step 1: cross-tenant isolation. fiona (Marina kitchen, no Blue Olive
  // membership) is the denial identity; eve holds a Downtown staff membership
  // by seed, so she legitimately reads Downtown (the multi-membership case).
  const fionaCfg = await rpcAs(fiona, 'get_branch_tax_config', { p_branch_id: BRANCH.downtown })
  check(
    'C1 fiona denied Blue Olive config (42501)',
    fionaCfg.error?.code === '42501',
    fionaCfg.error?.message,
  )
  const fionaCalc = await rpcAs(fiona, 'calculate_branch_taxes', {
    p_branch_id: BRANCH.downtown,
    p_selections: [],
  })
  check(
    'C1 fiona denied Blue Olive calculation',
    fionaCalc.error?.code === '42501',
    fionaCalc.error?.message,
  )
  const eveCfg = await rpcAs(eve, 'get_branch_tax_config', { p_branch_id: BRANCH.downtown })
  check(
    'C1 eve (Downtown staff by seed) reads Downtown — the multi-membership posture',
    !eveCfg.error,
    eveCfg.error?.message ?? 'allowed',
  )
  const eveWrite = await rpcAs(eve, 'set_branch_tax_override', {
    p_branch_id: BRANCH.downtown,
    p_rule_id: RULE.vat,
    p_rate: '1',
  })
  check(
    'C1 eve denied any Downtown write (cashier)',
    eveWrite.error?.code === '42501',
    eveWrite.error?.message,
  )

  // Step 2: matrix spot-check — reorder City before VAT; amounts follow the order.
  // The reorder list must contain EVERY active rule of the restaurant exactly
  // once, so it is built from the live rule set (extras, e.g. scratch rules,
  // keep their relative positions at the end).
  const basket = [{ item_id: ITEM.lambKebab, extras: [], quantity: 1 }]
  const before = expectOk(
    await rpcAs(bob, 'calculate_branch_taxes', {
      p_branch_id: BRANCH.downtown,
      p_selections: basket,
    }),
    'C2 calc before reorder',
  )
  const activeRules = await alice
    .from('tax_rules')
    .select('id, sort_order')
    .eq('restaurant_id', RESTAURANT.blueOlive)
    .is('branch_id', null)
  // v_expected counts RETIRED rules too — no is_active filter here.
  const ruleIds = (activeRules.data ?? []).map((r) => r.id)
  const cityFirst = [
    RULE.cityTax,
    RULE.vat,
    ...ruleIds.filter((id) => id !== RULE.cityTax && id !== RULE.vat),
  ]
  const reorder = await rpcAs(alice, 'reorder_tax_rules', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_rule_ids: cityFirst,
  })
  check('C2 reorder accepted', !reorder.error, reorder.error?.message)
  const after = expectOk(
    await rpcAs(bob, 'calculate_branch_taxes', {
      p_branch_id: BRANCH.downtown,
      p_selections: basket,
    }),
    'C2 calc after reorder',
  )
  const vatB = before.lines.find((l) => l.name === 'VAT')
  const cityB = before.lines.find((l) => l.name === 'City tax')
  const cityA = after.lines.find((l) => l.name === 'City tax')
  const vatA = after.lines.find((l) => l.name === 'VAT') // Before (VAT first, VAT at A4's 8.5%): VAT 18.50×8.5%=1.5725→1.57; City
  // compounds on VAT: (18.50+1.57)×1.5%=0.301→0.30. After (City first): City's
  // base loses VAT → 0.28; VAT has no compound sources, so it stays 1.57.
  check(
    'C2 ordering changes amounts exactly as dictated, then restored',
    vatB?.amount === '1.57' &&
      cityB?.amount === '0.30' &&
      cityA?.amount === '0.28' &&
      vatA?.amount === '1.57',
    `before VAT=${vatB?.amount} City=${cityB?.amount}; after City=${cityA?.amount} VAT=${vatA?.amount}`,
  )
  expectOk(
    await rpcAs(alice, 'reorder_tax_rules', {
      p_restaurant_id: RESTAURANT.blueOlive,
      p_rule_ids: [
        RULE.vat,
        RULE.cityTax,
        ...ruleIds.filter((id) => id !== RULE.vat && id !== RULE.cityTax),
      ],
    }),
    'C2 restore order',
  )

  // Step 3: snapshot mechanics through the real RPC (owner-only, once-only).
  // jsonb params travel as objects (a string would arrive as a JSON string
  // value, which the function rejects).
  const payload = { total: before.total, lines: before.lines }
  const snap = await rpcAs(alice, 'record_tax_snapshot', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_fingerprint: 'quickstart:wk-c',
    p_payload: payload,
  })
  check(
    'C3 owner records a snapshot',
    !snap.error && snap.data?.recorded === true,
    snap.error?.message ?? `id=${snap.data?.snapshot_id}`,
  )
  const snap2 = await rpcAs(alice, 'record_tax_snapshot', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_fingerprint: 'quickstart:wk-c',
    p_payload: payload,
  })
  check(
    'C3 identical re-record is a no-op (once-only, same id)',
    !snap2.error &&
      snap2.data?.recorded === false &&
      snap2.data?.snapshot_id === snap.data?.snapshot_id,
    JSON.stringify(snap2.data ?? snap2.error?.message),
  )
  const eveSnap = await rpcAs(eve, 'record_tax_snapshot', {
    p_restaurant_id: RESTAURANT.blueOlive,
    p_branch_id: BRANCH.downtown,
    p_fingerprint: 'quickstart:wk-eve',
    p_payload: payload,
  })
  check(
    'C3 eve cannot record Blue Olive snapshots',
    eveSnap.error?.code === '42501',
    eveSnap.error?.message,
  )

  // Step 4: audit — every accepted walkthrough change exists as one record.
  const pgClient = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  })
  await pgClient.connect()
  const audit = await pgClient.query(
    `select action, count(*)::int as n from public.audit_log
     where action like 'tax.%' group by action order by action`,
  )
  await pgClient.end()
  const seen = Object.fromEntries(audit.rows.map((r) => [r.action, r.n]))
  const needed = [
    'tax.rule_created',
    'tax.rules_reordered',
    'tax.rule_updated',
    'tax.rule_retired',
    'tax.branch_override_set',
    'tax.branch_override_cleared',
  ]
  const missing = needed.filter((a) => !seen[a])
  check(
    'C4 every walkthrough change audited (actor/action/resource/change/scope)',
    missing.length === 0,
    missing.length === 0
      ? Object.entries(seen)
          .map(([a, n]) => `${a}×${n}`)
          .join(', ')
      : `missing: ${missing.join(', ')}`,
  )
}

// ── Pre-clean: remove scratch artifacts from any earlier aborted run ────────
async function preClean() {
  const alice = await signIn(creds.alice)
  const leftovers = await alice.from('tax_rules').select('id, name').eq('name', 'Regional levy')
  for (const row of leftovers.data ?? []) {
    await alice.rpc('retire_tax_rule', { p_rule_id: row.id, p_active: false })
    await alice.rpc('delete_unused_tax_rule', { p_rule_id: row.id })
  }
  // Clear any leftover Downtown VAT override through the RPC (table writes are
  // denied to clients by design); clearing a missing override is a no-op.
  await alice.rpc('set_branch_tax_override', {
    p_branch_id: BRANCH.downtown,
    p_rule_id: RULE.vat,
    p_rate: null,
  })
}

// ── Cleanup: remove walkthrough artifacts, restore the deterministic state ──
async function cleanup() {
  console.log('\n── Cleanup ──')
  const alice = await signIn(creds.alice)
  const leftovers = await alice.from('tax_rules').select('id, name').eq('name', 'Regional levy')
  for (const row of leftovers.data ?? []) {
    await alice.rpc('retire_tax_rule', { p_rule_id: row.id, p_active: false })
    await alice.rpc('delete_unused_tax_rule', { p_rule_id: row.id })
  }
  console.log(
    'REMARK restore: run `npm run db:reset -- --yes && npm run db:seed` to restore the exact deterministic fixture (VAT rate 8.2500, order, audit rows).',
  )
}

async function main() {
  try {
    await preClean()
  } catch (e) {
    console.log(`pre-clean remark: ${e.message}`)
  }
  for (const [name, fn] of [
    ['Walkthrough A', walkthroughA],
    ['Walkthrough B', walkthroughB],
    ['Walkthrough C', walkthroughC],
  ]) {
    try {
      await fn()
    } catch (e) {
      check(`${name} (aborted)`, false, e.message)
    }
  }
  try {
    await cleanup()
  } catch (e) {
    console.log(`cleanup remark: ${e.message}`)
  }
  const failed = results.filter((r) => !r.ok)
  console.log(
    `\n=== ${results.length - failed.length}/${results.length} walkthrough checks passed ===`,
  )
  process.exit(failed.length > 0 ? 1 : 0)
}

await main()
