import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'

/**
 * Database-level example test (spec FR-013, research.md §12).
 *
 * Preconditions: the cloud development database is migrated and seeded
 * (`npm run db:migrate` && `npm run db:seed`) and reachable through
 * SUPABASE_DB_URL. Read-only — makes no changes to the database.
 */

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  throw new Error(
    'Missing SUPABASE_DB_URL — copy .env.example to .env, then run ' +
      '`npm run db:migrate` and `npm run db:seed` first. ' +
      'See docs/development.md (Setup) for where to find the value.',
  )
}

// TLS required — never fall back to plaintext (Supabase connection guidance).
const client = new pg.Client({ connectionString: dbUrl, ssl: true })

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

describe('baseline table public.app_meta (data-model.md)', () => {
  it('exists with the declared columns and types', async () => {
    const { rows } = await client.query(
      `select column_name, data_type
       from information_schema.columns
       where table_schema = 'public' and table_name = 'app_meta'
       order by ordinal_position`,
    )
    expect(rows).toEqual([
      { column_name: 'key', data_type: 'text' },
      { column_name: 'value', data_type: 'text' },
      { column_name: 'updated_at', data_type: 'timestamp with time zone' },
    ])
  })

  it("uses 'key' as its primary key", async () => {
    const { rows } = await client.query(
      `select kcu.column_name
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on tc.constraint_name = kcu.constraint_name
        and tc.constraint_schema = kcu.constraint_schema
       where tc.table_schema = 'public'
         and tc.table_name = 'app_meta'
         and tc.constraint_type = 'PRIMARY KEY'`,
    )
    expect(rows.map((row) => row.column_name)).toEqual(['key'])
  })

  it('contains the baseline seed row', async () => {
    const { rows } = await client.query('select value from public.app_meta where key = $1', [
      'foundation',
    ])
    expect(rows).toEqual([{ value: 'seeded' }])
  })

  it('has row level security enabled (deny-by-default, spec FR-017)', async () => {
    const { rows } = await client.query('select relrowsecurity from pg_class where relname = $1', [
      'app_meta',
    ])
    expect(rows).toEqual([{ relrowsecurity: true }])
  })

  it('grants no table privileges to client roles (hardening, spec FR-017)', async () => {
    const { rows } = await client.query(
      `select grantee, privilege_type
       from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'app_meta'
         and grantee in ('anon', 'authenticated')`,
    )
    expect(rows).toEqual([])
  })
})
