#!/usr/bin/env node
/**
 * Rebuilds the cloud development database from zero (spec FR-007; spec 002
 * FR-014 — the complete data layer incl. the private schema).
 *
 * Usage: npm run db:reset [-- --yes] [-- --purge-auth]
 *
 * Sequence: confirm → drop public + private + migration history → recreate
 * public with Supabase default grants → `supabase db push` (reapplies all
 * migrations) → `npm run db:seed`.
 *
 * `--purge-auth`: also delete the six seeded `@restopilot.dev` users from
 * auth.users AFTER the schema drop and BEFORE migrate+seed — the scripted
 * credential-restore runbook (spec 003 FR-021; research.md §4). Auth data
 * survives ordinary resets (only public/private are dropped), so a manually
 * changed fixture password is otherwise never restored; with the flag, the
 * seed re-provisions the identities with the documented dev passwords.
 *
 * DESTRUCTIVE and intended for the development project only. Reads only
 * SUPABASE_DB_URL, so it can only target the project you configured.
 */
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import pg from 'pg'

function fail(message) {
  console.error(`[db:reset] ${message}`)
  process.exit(1)
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    fail(`"${command} ${args.join(' ')}" failed with exit code ${result.status}.`)
  }
}

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  fail(
    'Missing required environment variable: SUPABASE_DB_URL. ' +
      'Copy .env.example to .env and fill it in — see docs/development.md (Setup).',
  )
}

const purgeAuth = process.argv.includes('--purge-auth')

console.warn(
  '[db:reset] WARNING: this DROPS ALL DATA in the database behind SUPABASE_DB_URL ' +
    'and rebuilds it from migrations + seed. Development project only.',
)

if (!process.argv.includes('--yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question('[db:reset] Type RESET to confirm: ')
  rl.close()
  if (answer.trim() !== 'RESET') {
    fail('Aborted — database left untouched.')
  }
}

const RESET_SQL = `
drop schema if exists public cascade;
drop schema if exists private cascade;
drop schema if exists supabase_migrations cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres;
`

// TLS required (sslmode=require semantics: encrypted, unverified — Supabase
// poolers present a certificate chain Node does not trust by default).
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  await client.query(RESET_SQL)
  console.log('[db:reset] schemas dropped; public recreated with default grants.')

  if (purgeAuth) {
    // Credential-restore runbook: the schema drop above released the
    // profiles→auth.users foreign keys, so the seeded identities can now be
    // deleted; the seed re-provisions them with the documented dev passwords.
    const { rowCount } = await client.query(
      "delete from auth.users where email like '%@restopilot.dev'",
    )
    console.log(
      `[db:reset] --purge-auth: deleted ${rowCount} seeded auth users ` +
        '(fixture credentials will be restored by the seed).',
    )
  }
} catch (error) {
  fail(`reset failed: ${error.message}`)
} finally {
  await client.end().catch(() => {})
}

console.log('[db:reset] applying all migrations (supabase db push)...')
run('npm', ['run', 'db:migrate'])

console.log('[db:reset] applying seed...')
run('npm', ['run', 'db:seed'])

console.log('[db:reset] done — database rebuilt from repository artifacts.')
console.log('[db:reset] remember to refresh types: npm run types:gen')
