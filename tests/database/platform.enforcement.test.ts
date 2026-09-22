import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, inTransaction } from './helpers/db'
import {
  authUserIds,
  branchIds,
  devSessionTokens,
  diningTableIds,
  menuItemIds,
  restaurantIds,
} from './helpers/fixtures'

/**
 * The disablement enforcement suite (spec 014 T005; contracts §3;
 * checklist §Disablement/§The Important rule).
 *
 * The platform kill-switch blocks exactly the customer doors — the entry
 * RPCs (table + channel) and submit_round — with the verbatim message, while
 * tenant data stays intact. Expiry blocks NOTHING: a subscription past its
 * end date still takes orders (the Important rule proven over the REAL
 * ordering path).
 */
let client: Awaited<ReturnType<typeof createDbClient>>

beforeAll(async () => {
  client = await createDbClient()
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

const RID = restaurantIds.blueOlive as string
const DOWNTOWN = branchIds.downtown as string
const T1 = diningTableIds.downtownT1
const TOKEN_T1 = devSessionTokens.downtownT1
const SUPER_ADMIN = authUserIds.platformAdmin
const MESSAGE = 'This restaurant is not available.'
const KEBAB = [{ item_id: menuItemIds.lambKebab, extras: [], quantity: '1' }]

function daysFromToday(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function asSuperAdmin(): Promise<void> {
  await client.query('set local role authenticated')
  await client.query('select set_config($1, $2, true)', [
    'request.jwt.claims',
    JSON.stringify({ role: 'authenticated', sub: SUPER_ADMIN }),
  ])
}

async function asAnon(): Promise<void> {
  await client.query('set local role anon')
}

describe('disablement enforcement: the two doors (FR-006)', () => {
  it('T005-A a disabled restaurant refuses entry (table and channel), verbatim', async () => {
    await inTransaction(client, async () => {
      await asSuperAdmin()
      await client.query('select set_restaurant_platform_disabled($1, $2, $3)', [
        RID,
        true,
        'Enforcement suite',
      ])
      await asAnon()
      // Each refusal probe runs inside its own savepoint: an aborted
      // statement would otherwise poison the surrounding transaction.
      await client.query('savepoint probe_table')
      await expect(
        client.query('select public.open_session_at_table($1, $2, $3, $4, $5)', [
          RID,
          DOWNTOWN,
          T1,
          'Blocked Customer',
          '+15550777',
        ]),
      ).rejects.toThrowError(MESSAGE)
      await client.query('rollback to savepoint probe_table')
      await expect(
        client.query('select public.open_session_channel($1, $2, $3, $4, $5, $6)', [
          RID,
          DOWNTOWN,
          'delivery',
          'Blocked Customer',
          '+15550777',
          '1 Blocked Rd',
        ]),
      ).rejects.toThrowError(MESSAGE)
      await client.query('rollback to savepoint probe_table')
    })
  })

  it('T005-B a disabled restaurant refuses ordering on an EXISTING session, verbatim', async () => {
    await inTransaction(client, async () => {
      // The seeded T1 token's session exists before the disable.
      await asSuperAdmin()
      await client.query('select set_restaurant_platform_disabled($1, $2, $3)', [
        RID,
        true,
        'Enforcement suite',
      ])
      await asAnon()
      await expect(
        client.query('select public.submit_round($1, $2)', [TOKEN_T1, JSON.stringify(KEBAB)]),
      ).rejects.toThrowError(MESSAGE)
    })
  })

  it('T005-C re-enable restores ordering; tenant data survives disablement', async () => {
    await inTransaction(client, async () => {
      await asSuperAdmin()
      await client.query('select set_restaurant_platform_disabled($1, $2, $3)', [
        RID,
        true,
        'Enforcement suite',
      ])
      await client.query('select set_restaurant_platform_disabled($1, $2, $3)', [RID, false, ''])
      await asAnon()
      // Ordering works again on the seeded session.
      const r = await client.query<{ p: unknown }>('select public.submit_round($1, $2) as p', [
        TOKEN_T1,
        JSON.stringify(KEBAB),
      ])
      expect(r.rows[0]!.p).toBeDefined()
      // Tenant data intact: the fixture's rows are untouched.
      await client.query('reset role')
      const rounds = await client.query<{ n: string }>(
        'select count(*)::text as n from public.rounds where restaurant_id = $1',
        [RID],
      )
      expect(Number(rounds.rows[0]!.n)).toBeGreaterThanOrEqual(1)
    })
  })

  it('T005-D an EXPIRED subscription never blocks ordering (the Important rule, FR-010)', async () => {
    await inTransaction(client, async () => {
      await asSuperAdmin()
      // Drive the subscription past its end — a plain row update, nothing fires.
      await client.query('select set_subscription_dates($1, $2, $3)', [
        RID,
        daysFromToday(-30),
        daysFromToday(-1),
      ])
      await asAnon()
      // Ordering SUCCEEDS on the expired subscription.
      const r = await client.query<{ p: unknown }>('select public.submit_round($1, $2) as p', [
        TOKEN_T1,
        JSON.stringify(KEBAB),
      ])
      expect(r.rows[0]!.p).toBeDefined()
      // And entry still works (expired ≠ disabled).
      const entry = await client.query<{ p: unknown }>(
        'select public.open_session_channel($1, $2, $3, $4, $5, $6) as p',
        [RID, DOWNTOWN, 'takeaway', 'Expired But Open', '+15550778', null],
      )
      expect(entry.rows[0]!.p).toBeDefined()
    })
  })
})
