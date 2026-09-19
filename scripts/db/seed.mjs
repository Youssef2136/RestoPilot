#!/usr/bin/env node
/**
 * Applies supabase/seed.sql to the cloud development database (feature 001
 * FR-008; feature 002 FR-015) and prints a summary of the seeded fixture.
 *
 * Usage: npm run db:seed
 * Requires SUPABASE_DB_URL in the environment (see .env.example).
 * The seed is idempotent — safe to re-run at any time.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const seedPath = path.resolve(scriptDir, '../../supabase/seed.sql')

function fail(message) {
  console.error(`[db:seed] ${message}`)
  process.exit(1)
}

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  fail(
    'Missing required environment variable: SUPABASE_DB_URL. ' +
      'Copy .env.example to .env and fill it in — see docs/development.md (Setup).',
  )
}

const sql = await readFile(seedPath, 'utf8')
// TLS required (sslmode=require semantics: encrypted, unverified — Supabase
// poolers present a certificate chain Node does not trust by default).
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  await client.query(sql)
  const { rows } = await client.query('select key, value from public.app_meta order by key')
  const tenancy = await client.query(
    `select
         (select count(*)::int from public.restaurants) as restaurants,
         (select count(*)::int from public.branches) as branches,
         (select count(*)::int from public.profiles) as profiles,
         (select count(*)::int from public.staff_memberships) as staff_memberships,
         (select count(*)::int from public.dining_tables) as dining_tables,
         (select count(*)::int from public.branch_working_hours) as branch_working_hours,
         (select count(*)::int from public.menu_categories) as menu_categories,
         (select count(*)::int from public.menu_items) as menu_items,
         (select count(*)::int from public.menu_item_extras) as menu_item_extras,
         (select count(*)::int from public.branch_unavailable_items) as branch_unavailable_items,
         (select count(*)::int from public.tax_rules) as tax_rules,
         (select count(*)::int from public.branch_tax_overrides) as branch_tax_overrides`,
  )
  // Seeded auth identities (spec 003 FR-021) — count + emails of the
  // @restopilot.dev users provisioned in auth.users by the seed.
  const identities = await client.query(
    `select email
         from auth.users
        where email like '%@restopilot.dev'
        order by email`,
  )
  console.log('[db:seed] supabase/seed.sql applied successfully.')
  for (const row of rows) {
    console.log(`[db:seed]   app_meta: ${row.key} = ${row.value}`)
  }
  const counts = tenancy.rows[0]
  console.log(
    `[db:seed]   tenancy fixture: ${counts.restaurants} restaurants, ` +
      `${counts.branches} branches, ${counts.profiles} profiles, ` +
      `${counts.staff_memberships} staff memberships, ` +
      `${counts.dining_tables} dining tables, ` +
      `${counts.branch_working_hours} working-hours intervals, ` +
      `${counts.menu_categories} menu categories, ${counts.menu_items} menu items, ` +
      `${counts.menu_item_extras} item extras, ` +
      `${counts.branch_unavailable_items} branch availability overrides, ` +
      `${counts.tax_rules} tax rules, ` +
      `${counts.branch_tax_overrides} branch tax overrides`,
  )
  const emails = identities.rows.map((row) => row.email)
  console.log(
    `[db:seed]   auth identities: ${emails.length} seeded sign-in users ` +
      `(${emails.join(', ')})`,
  )
} catch (error) {
  console.error(`[db:seed] seed failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
