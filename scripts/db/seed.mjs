#!/usr/bin/env node
/**
 * Applies supabase/seed.sql to the cloud development database (spec FR-008).
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
const client = new pg.Client({ connectionString: dbUrl })

try {
  await client.connect()
  await client.query(sql)
  const { rows } = await client.query('select key, value from public.app_meta order by key')
  console.log('[db:seed] supabase/seed.sql applied successfully.')
  for (const row of rows) {
    console.log(`[db:seed]   app_meta: ${row.key} = ${row.value}`)
  }
} catch (error) {
  console.error(`[db:seed] seed failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
