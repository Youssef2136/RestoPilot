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
 * SUPABASE_DB_URL, so it can only target the project you configured — and
 * the project-ref guard below (spec 018 T008; FR-005; plan D5) refuses a
 * non-development ref unless explicitly overridden: §28's "production data
 * must never be used casually as development/test data".
 */
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import pg from 'pg'

function fail(message) {
  console.error(`[db:reset] ${message}`)
  process.exit(1)
}

/**
 * The dev/production reset guard (exported for its unit tests in
 * tests/unit/production.guard.test.ts).
 *
 * The target ref is parsed from SUPABASE_DB_URL: direct hosts carry it in
 * the subdomain (`db.<ref>.supabase.co`); pooler hosts carry it in the
 * username (`postgres.<ref>@<region>.pooler.supabase.com`). The declared
 * development ref is the existing SUPABASE_PROJECT_REF in .env — no new
 * drift surface (analyze refinement).
 *
 * Decision:
 *  - unknown project shape (not a Supabase host) → refuse (operator must
 *    be explicit about what they are about to drop).
 *  - ref matches the declared dev ref → proceed.
 *  - ref mismatches, or no dev ref is declared → refuse with the runbook
 *    pointer, unless `override` (--i-know-this-is-destructive) is passed,
 *    which proceeds with a loud warning.
 */
const SUPABASE_REF = '[a-z0-9]{20}'
const DB_HOST = new RegExp(`^db\\.(${SUPABASE_REF})\\.supabase\\.(?:co|com)$`, 'i')
const POOLER_USER = new RegExp(`^postgres\\.(${SUPABASE_REF})$`, 'i')

export function resolveResetGuard({ dbUrl, devRef, override = false }) {
  const url = new URL(dbUrl)
  const host = url.hostname
  const direct = host.match(DB_HOST)
  const pooled = decodeURIComponent(url.username).match(POOLER_USER)
  const targetRef = direct ? direct[1] : pooled ? pooled[1] : null

  if (targetRef === null) {
    return {
      decision: 'refuse',
      reason:
        `SUPABASE_DB_URL (host "${host}") does not identify a Supabase project ref. ` +
        'db:reset refuses to drop schemas on a database it cannot identify — see docs/production-runbook.md (§ Environments).',
    }
  }
  if (devRef && targetRef === devRef.trim()) {
    return { decision: 'proceed', targetRef }
  }
  if (override) {
    return {
      decision: 'proceed',
      targetRef,
      warning:
        `OVERRIDE: resetting project ${targetRef} which is NOT the declared development project` +
        (devRef ? ` (${devRef.trim()})` : ' (no SUPABASE_PROJECT_REF declared)') +
        '. ALL DATA in it will be dropped and reseeded.',
    }
  }
  return {
    decision: 'refuse',
    reason:
      `target project ${targetRef} is not the declared development project` +
      (devRef ? ` (${devRef.trim()})` : ' (no SUPABASE_PROJECT_REF in .env)') +
      '. db:reset only runs against the development project — see docs/production-runbook.md (§ Environments). ' +
      'If you are certain, re-run with --i-know-this-is-destructive.',
  }
}

/** Extract the guard arguments from the environment (unit-tested via resolveResetGuard). */
function parseGuardEnv(env = process.env) {
  return { dbUrl: env.SUPABASE_DB_URL, devRef: env.SUPABASE_PROJECT_REF || null }
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    fail(`"${command} ${args.join(' ')}" failed with exit code ${result.status}.`)
  }
}

// Execute only when run directly — importing this module (the guard suite
// imports resolveResetGuard) must have no side effects.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main()
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    fail(
      'Missing required environment variable: SUPABASE_DB_URL. ' +
        'Copy .env.example to .env and fill it in — see docs/development.md (Setup).',
    )
  }

  // Project-ref guard (spec 018): the target must be the declared development
  // project — or the operator must be loudly, explicitly certain.
  const guardEnv = parseGuardEnv()
  const guard = resolveResetGuard({
    dbUrl: guardEnv.dbUrl,
    devRef: guardEnv.devRef,
    override: process.argv.includes('--i-know-this-is-destructive'),
  })
  if (guard.decision === 'refuse') {
    fail(guard.reason)
  }
  if (guard.warning) {
    console.warn(`[db:reset] ${guard.warning}`)
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
}
