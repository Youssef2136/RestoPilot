import pg from 'pg'
import type { Client } from 'pg'

/**
 * Shared database test helpers (spec 002 FR-011; research.md §1–§2).
 *
 * Identity simulation: Supabase maps every request to a Postgres role
 * (`anon`/`authenticated`) and identifies the user through the
 * `request.jwt.claims` setting — exactly what the data API does for real
 * requests. Tests reproduce that inside transactions that are ALWAYS rolled
 * back, so the shared cloud development database keeps no test residue.
 */

export type ClientRole = 'anon' | 'authenticated'

export interface JwtClaims {
  sub?: string
  role?: string
  [key: string]: unknown
}

export function createDbClient(): Client {
  const connectionString = process.env.SUPABASE_DB_URL
  if (!connectionString) {
    throw new Error(
      'Missing SUPABASE_DB_URL — copy .env.example to .env, then run ' +
        '`npm run db:migrate` and `npm run db:seed` first. ' +
        'See docs/development.md (Setup) for where to find the value.',
    )
  }
  // TLS required (sslmode=require semantics: encrypted, unverified — the
  // Supabase session pooler presents a chain Node does not trust by default).
  return new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
}

/** Run `fn` inside a transaction that is always rolled back. */
export async function inTransaction<T>(client: Client, fn: () => Promise<T>): Promise<T> {
  await client.query('begin')
  try {
    return await fn()
  } finally {
    await client.query('rollback')
  }
}

/**
 * Run `fn` as a Supabase client role with simulated JWT claims, inside a
 * rolled-back transaction. Grants and RLS policies apply to the session for
 * the duration of `fn`.
 */
export async function runAs<T>(
  client: Client,
  role: ClientRole,
  claims: JwtClaims,
  fn: () => Promise<T>,
): Promise<T> {
  return inTransaction(client, async () => {
    await client.query(`set local role ${role}`)
    await client.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({ role, ...claims }),
    ])
    return fn()
  })
}

/** Run `fn` as an authenticated staff identity (`sub` = the profile's auth user id). */
export function asUser<T>(client: Client, authUserId: string, fn: () => Promise<T>): Promise<T> {
  return runAs(client, 'authenticated', { sub: authUserId }, fn)
}

/** Run `fn` as the unauthenticated `anon` role. */
export function asAnon<T>(client: Client, fn: () => Promise<T>): Promise<T> {
  return runAs(client, 'anon', {}, fn)
}

/**
 * Assert that a statement fails with the given PostgreSQL error code
 * (e.g. '42501' permission denied, '23505' unique violation).
 *
 * The attempt runs inside a savepoint and is rolled back to it, so a failed
 * statement does not abort the surrounding transaction and multiple
 * assertions can share one `runAs` block.
 */
export async function expectStatementToFail(
  client: Client,
  code: string,
  sql: string,
  values?: unknown[],
): Promise<void> {
  await client.query('savepoint expect_failure')
  try {
    await client.query(sql, values)
  } catch (error) {
    await client.query('rollback to savepoint expect_failure')
    const actual = (error as { code?: string }).code
    if (actual !== code) {
      throw new Error(
        `Expected statement to fail with ${code} but got ${actual ?? 'no code'}: ` +
          `${(error as Error).message}`,
        { cause: error },
      )
    }
    return
  }
  await client.query('rollback to savepoint expect_failure')
  throw new Error(`Expected statement to fail with ${code} but it succeeded: ${sql}`)
}
