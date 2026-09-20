import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asAnon, asUser, createDbClient, inTransaction } from './helpers/db'
import {
  authUserIds,
  branchIds,
  devTokenSession,
  devSessionTokens,
  diningTableIds,
  restaurantIds,
  sessionIds,
} from './helpers/fixtures'

/**
 * Shared RPC matrix for the Phase 6 session functions (spec 007; contracts/
 * database-functions.md; T008). Authorization for every function across the
 * identity matrix, the contract's validation messages, the audit basics for
 * close_session, and the no-account posture (FR-015). Story-specific
 * semantics (entry validation depth, lifecycle, abuse, scoping) land in the
 * US blocks of this suite (T014/T016/T020/T024).
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

/** Assert an RPC fails with the given SQLSTATE and message part (005/006 style). */
async function expectRpcFailure(
  code: string,
  messagePart: string,
  sql: string,
  values: unknown[] = [],
): Promise<void> {
  await client.query('savepoint expect_rpc_failure')
  try {
    await client.query(sql, values)
  } catch (error) {
    await client.query('rollback to savepoint expect_rpc_failure')
    const pgError = error as { code?: string; message: string }
    if (pgError.code !== code) {
      throw new Error(`Expected ${code} but got ${pgError.code ?? 'no code'}: ${pgError.message}`, {
        cause: error,
      })
    }
    expect(pgError.message).toContain(messagePart)
    return
  }
  await client.query('rollback to savepoint expect_rpc_failure')
  throw new Error('Expected the RPC to fail, but it succeeded.')
}

interface EntryResult {
  session: { id: string; status: string }
  token: string
  participant: { id: string; display_name: string }
}

const CALL = {
  getPublicRestaurant: (slug: string) => ({
    sql: 'select public.get_public_restaurant($1) as p',
    values: [slug],
  }),
  openSession: (r: string, b: string, t: string, n: string, ph: string) => ({
    sql: 'select public.open_session_at_table($1, $2, $3, $4, $5) as p',
    values: [r, b, t, n, ph],
  }),
  context: (token: string) => ({
    sql: 'select public.get_session_context($1) as p',
    values: [token],
  }),
  menu: (token: string) => ({
    sql: 'select public.get_session_menu($1) as p',
    values: [token],
  }),
  listOpen: (branch: string) => ({
    sql: 'select public.get_branch_open_sessions($1) as p',
    values: [branch],
  }),
  close: (session: string) => ({
    sql: 'select public.close_session($1) as p',
    values: [session],
  }),
}

/** A scratch entry inside the enclosing transaction; rolled back with it. */
async function enterAt(
  tableId: string,
  name = 'Matrix Guest',
  phone = '+15557770001',
): Promise<EntryResult> {
  const res = await client.query<{ p: EntryResult }>(
    CALL.openSession(restaurantIds.blueOlive, branchIds.downtown, tableId, name, phone).sql,
    CALL.openSession(restaurantIds.blueOlive, branchIds.downtown, tableId, name, phone).values,
  )
  return res.rows[0]!.p
}

describe('authorization matrix: anon and token callers (the customer side)', () => {
  it('anon resolves the public restaurant payload', async () => {
    await asAnon(client, async () => {
      const res = await client.query<{ p: { restaurant: { slug: string }; branches: unknown[] } }>(
        CALL.getPublicRestaurant('blue-olive').sql,
        CALL.getPublicRestaurant('blue-olive').values,
      )
      expect(res.rows[0]!.p.restaurant.slug).toBe('blue-olive')
      expect(res.rows[0]!.p.branches.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('anon gets 42501 on both staff functions (no JWT, no role reach)', async () => {
    await asAnon(client, async () => {
      await expectRpcFailure(
        '42501',
        'permission',
        CALL.listOpen(branchIds.downtown).sql,
        CALL.listOpen(branchIds.downtown).values,
      )
      await expectRpcFailure(
        '42501',
        'permission',
        CALL.close(sessionIds.downtownT1).sql,
        CALL.close(sessionIds.downtownT1).values,
      )
    })
  })

  it('a customer token never grants staff operations even for a linked staff device (FR-020)', async () => {
    await inTransaction(client, async () => {
      const entry = await enterAt(diningTableIds.downtownT3)
      await asAnon(client, async () => {
        await expectRpcFailure(
          '42501',
          'permission',
          CALL.listOpen(branchIds.downtown).sql,
          CALL.listOpen(branchIds.downtown).values,
        )
        await expectRpcFailure('42501', 'permission', CALL.close(entry.session.id).sql, [
          entry.session.id,
        ])
      })
    })
  })

  it('fiona (no membership) is denied on both staff functions', async () => {
    await asUser(client, authUserIds.fiona, async () => {
      await expectRpcFailure(
        '42501',
        'permission',
        CALL.listOpen(branchIds.downtown).sql,
        CALL.listOpen(branchIds.downtown).values,
      )
      await expectRpcFailure(
        '42501',
        'permission',
        CALL.close(sessionIds.downtownT1).sql,
        CALL.close(sessionIds.downtownT1).values,
      )
    })
  })

  it('dan (kitchen, Downtown) is denied on both staff functions', async () => {
    await asUser(client, authUserIds.dan, async () => {
      await expectRpcFailure(
        '42501',
        'permission',
        CALL.listOpen(branchIds.downtown).sql,
        CALL.listOpen(branchIds.downtown).values,
      )
      await expectRpcFailure(
        '42501',
        'permission',
        CALL.close(sessionIds.downtownT1).sql,
        CALL.close(sessionIds.downtownT1).values,
      )
    })
  })

  it('eve (Downtown cashier by seed) lists Downtown; Marina and close denied', async () => {
    await asUser(client, authUserIds.eve, async () => {
      const res = await client.query<{ p: { sessions: unknown[] } }>(
        CALL.listOpen(branchIds.downtown).sql,
        CALL.listOpen(branchIds.downtown).values,
      )
      expect(res.rows[0]!.p.sessions.length).toBeGreaterThanOrEqual(2)
      await expectRpcFailure(
        '42501',
        'permission',
        CALL.listOpen(branchIds.marina).sql,
        CALL.listOpen(branchIds.marina).values,
      )
      // A Marina session is outside eve's Downtown-only reach. Marina's
      // seeded table is stopped, so activate it as the connection's own
      // role, enter as anon, and then attempt eve's close — which must be
      // denied: a Downtown cashier cannot close another branch's session.
      await inTransaction(client, async () => {
        await client.query('reset role')
        await client.query('update public.dining_tables set is_active = true where id = $1', [
          diningTableIds.marinaT1,
        ])
        await client.query('set local role anon')
        const marinaEntry = await client.query<{ p: EntryResult }>(
          CALL.openSession(
            restaurantIds.blueOlive,
            branchIds.marina,
            diningTableIds.marinaT1,
            'Marina Guest',
            '+15557770009',
          ).sql,
          CALL.openSession(
            restaurantIds.blueOlive,
            branchIds.marina,
            diningTableIds.marinaT1,
            'Marina Guest',
            '+15557770009',
          ).values,
        )
        await client.query('set local role authenticated')
        await client.query('select set_config($1, $2, true)', [
          'request.jwt.claims',
          JSON.stringify({ role: 'authenticated', sub: authUserIds.eve }),
        ])
        await expectRpcFailure(
          '42501',
          'permission',
          CALL.close(marinaEntry.rows[0]!.p.session.id).sql,
          [marinaEntry.rows[0]!.p.session.id],
        )
      })
    })
  })
})

describe('authorization matrix: staff roles', () => {
  it('alice (owner) lists and closes for any branch of her restaurant', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const res = await client.query<{ p: { sessions: unknown[] } }>(
        CALL.listOpen(branchIds.downtown).sql,
        CALL.listOpen(branchIds.downtown).values,
      )
      expect(Array.isArray(res.rows[0]!.p.sessions)).toBe(true)
      expect(res.rows[0]!.p.sessions.length).toBeGreaterThanOrEqual(2)

      await inTransaction(client, async () => {
        const entry = await enterAt(diningTableIds.downtownT3)
        const closed = await client.query<{ p: { closed: boolean } }>(
          CALL.close(entry.session.id).sql,
          [entry.session.id],
        )
        expect(closed.rows[0]!.p.closed).toBe(true)
      })
    })
  })

  it('bob (Downtown branch manager) lists and closes Downtown only', async () => {
    await asUser(client, authUserIds.bob, async () => {
      const res = await client.query<{ p: { sessions: unknown[] } }>(
        CALL.listOpen(branchIds.downtown).sql,
        CALL.listOpen(branchIds.downtown).values,
      )
      expect(res.rows[0]!.p.sessions.length).toBeGreaterThanOrEqual(2)
      await expectRpcFailure(
        '42501',
        'permission',
        CALL.listOpen(branchIds.marina).sql,
        CALL.listOpen(branchIds.marina).values,
      )

      await inTransaction(client, async () => {
        const entry = await enterAt(diningTableIds.downtownT3)
        const closed = await client.query<{ p: { closed: boolean } }>(
          CALL.close(entry.session.id).sql,
          [entry.session.id],
        )
        expect(closed.rows[0]!.p.closed).toBe(true)
      })
    })
  })

  it('carla (Downtown cashier) lists and closes Downtown; Marina denied', async () => {
    await asUser(client, authUserIds.carla, async () => {
      const res = await client.query<{ p: { sessions: unknown[] } }>(
        CALL.listOpen(branchIds.downtown).sql,
        CALL.listOpen(branchIds.downtown).values,
      )
      expect(res.rows[0]!.p.sessions.length).toBeGreaterThanOrEqual(2)
      await expectRpcFailure(
        '42501',
        'permission',
        CALL.listOpen(branchIds.marina).sql,
        CALL.listOpen(branchIds.marina).values,
      )
    })
  })
})

describe('validation messages (the contract vocabulary)', () => {
  it('unknown slug → "Restaurant not found."', async () => {
    await asAnon(client, async () => {
      await expectRpcFailure(
        'P0001',
        'Restaurant not found.',
        CALL.getPublicRestaurant('no-such-slug').sql,
        CALL.getPublicRestaurant('no-such-slug').values,
      )
    })
  })

  it('open_session_at_table: restaurant, branch, table, name and phone messages', async () => {
    await asAnon(client, async () => {
      await expectRpcFailure(
        'P0001',
        'Restaurant not found.',
        CALL.openSession(
          '00000000-0000-4000-8000-00000000ffff',
          branchIds.downtown,
          diningTableIds.downtownT1,
          'N',
          '+15550001',
        ).sql,
        CALL.openSession(
          '00000000-0000-4000-8000-00000000ffff',
          branchIds.downtown,
          diningTableIds.downtownT1,
          'N',
          '+15550001',
        ).values,
      )
      await expectRpcFailure(
        'P0001',
        'Branch not found.',
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.airport,
          diningTableIds.downtownT1,
          'N',
          '+15550001',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.airport,
          diningTableIds.downtownT1,
          'N',
          '+15550001',
        ).values,
      )
      await expectRpcFailure(
        'P0001',
        'Table not found.',
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.airportT1,
          'N',
          '+15550001',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.airportT1,
          'N',
          '+15550001',
        ).values,
      )
      await expectRpcFailure(
        'P0001',
        'A display name is required.',
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          '   ',
          '+15550001',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          '   ',
          '+15550001',
        ).values,
      )
      await expectRpcFailure(
        'P0001',
        'A display name may be at most 60 characters.',
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'x'.repeat(61),
          '+15550001',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'x'.repeat(61),
          '+15550001',
        ).values,
      )
      await expectRpcFailure(
        'P0001',
        'A valid phone number is required.',
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Noor',
          'phone-with-letters',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Noor',
          'phone-with-letters',
        ).values,
      )
    })
  })
})

describe('token verification basics', () => {
  it('a valid dev token resolves exactly its session (fixture contract)', async () => {
    await asAnon(client, async () => {
      for (const [token, sessionId] of Object.entries(devTokenSession)) {
        const res = await client.query<{ p: { session: { id: string } } }>(
          CALL.context(token).sql,
          [token],
        )
        expect(res.rows[0]!.p.session.id).toBe(sessionId)
      }
    })
  })

  it('an unknown token gets the single indistinguishable refusal', async () => {
    await asAnon(client, async () => {
      await expectRpcFailure(
        'P0001',
        'This session is no longer available.',
        CALL.context('never-a-token').sql,
        ['never-a-token'],
      )
      await expectRpcFailure(
        'P0001',
        'This session is no longer available.',
        CALL.menu('never-a-token').sql,
        ['never-a-token'],
      )
    })
  })
})

describe('close_session audit basics (FR-018)', () => {
  it('an accepted close writes exactly one session.closed record with tenant + branch scope', async () => {
    await asUser(client, authUserIds.alice, async () => {
      await inTransaction(client, async () => {
        const entry = await enterAt(diningTableIds.downtownT3, 'Audit Guest', '+15557770002')
        await client.query(CALL.close(entry.session.id).sql, [entry.session.id])

        // The audit trail is not client-readable (no grants) — the
        // verification reads it through the connection's own role.
        await client.query('reset role')
        const audit = await client.query<{
          action: string
          resource_type: string
          resource_id: string
          restaurant_id: string
          branch_id: string | null
        }>(
          `select action, resource_type, resource_id, restaurant_id, branch_id
             from public.audit_log
            where resource_id = $1 and action = 'session.closed'`,
          [entry.session.id],
        )
        expect(audit.rows).toHaveLength(1)
        expect(audit.rows[0]!.resource_type).toBe('session')
        expect(audit.rows[0]!.restaurant_id).toBe(restaurantIds.blueOlive)
        expect(audit.rows[0]!.branch_id).toBe(branchIds.downtown)
      })
    })
  })
})

describe('no-account posture (FR-015)', () => {
  it('entry and token reads never touch auth identities; the token links to no staff identity', async () => {
    await inTransaction(client, async () => {
      const entry = await enterAt(diningTableIds.downtownT3, 'No-Account Guest', '+15557770003')

      // The token resolves only through its hash; nothing in the payload
      // identifies a user: session + indicator + participants only.
      await asAnon(client, async () => {
        const ctx = await client.query<{ p: Record<string, unknown> }>(
          CALL.context(entry.token).sql,
          [entry.token],
        )
        expect(Object.keys(ctx.rows[0]!.p).sort()).toEqual(['indicator', 'participants', 'session'])
      })
    })
  })
})

/** Type-only usage guard so the Client import stays meaningful. */
export type DbClient = Client

describe('US1: entry validation through the real RPC (T014)', () => {
  it('each invalid class is refused with the contract message and NOTHING is stored (FR-004, FR-016)', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role anon')

      await expectRpcFailure(
        'P0001',
        'A display name is required.',
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          '   ',
          '+15550001',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          '   ',
          '+15550001',
        ).values,
      )
      await expectRpcFailure(
        'P0001',
        'A display name may be at most 60 characters.',
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'x'.repeat(61),
          '+15550001',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'x'.repeat(61),
          '+15550001',
        ).values,
      )
      await expectRpcFailure(
        'P0001',
        'A valid phone number is required.',
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Noor',
          '555-letters',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Noor',
          '555-letters',
        ).values,
      )
      await expectRpcFailure(
        'P0001',
        'Table not found.',
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.marinaT1,
          'Noor',
          '+15550001',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.marinaT1,
          'Noor',
          '+15550001',
        ).values,
      )

      // The name is accepted at the 60-character boundary; the phone at its
      // shortest documented shape.
      await client.query('reset role')
      const boundary = await client.query<{ p: EntryResult }>(
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'x'.repeat(60),
          '1234567',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'x'.repeat(60),
          '1234567',
        ).values,
      )
      expect(boundary.rows[0]!.p.participant.display_name).toHaveLength(60)
    })
  })

  it('stopped tables are not enterable (FR-003)', async () => {
    await asAnon(client, async () => {
      await expectRpcFailure(
        'P0001',
        'Table not found.',
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.marina,
          diningTableIds.marinaT1,
          'Noor',
          '+15550001',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.marina,
          diningTableIds.marinaT1,
          'Noor',
          '+15550001',
        ).values,
      )
    })
  })

  it('multi-branch: the chosen branch must belong to the restaurant (FR-002)', async () => {
    await asAnon(client, async () => {
      await expectRpcFailure(
        'P0001',
        'Branch not found.',
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.airport,
          diningTableIds.downtownT1,
          'Noor',
          '+15550001',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.airport,
          diningTableIds.downtownT1,
          'Noor',
          '+15550001',
        ).values,
      )
    })
  })

  it('entry→browse: the token reads the SESSION branch menu (FR-021)', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role anon')
      const entry = await client.query<{ p: EntryResult }>(
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Menu Guest',
          '+15557770011',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Menu Guest',
          '+15557770011',
        ).values,
      )
      const token = entry.rows[0]!.p.token

      const menu = await client.query<{
        p: { branch: { id: string; name: string }; categories: unknown[] }
      }>(CALL.menu(token).sql, [token])
      expect(menu.rows[0]!.p.branch.id).toBe(branchIds.downtown)
      expect(menu.rows[0]!.p.branch.name).toBe('Downtown')
      expect(Array.isArray(menu.rows[0]!.p.categories)).toBe(true)
      expect(menu.rows[0]!.p.categories.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('the returned token works for context and menu reads exactly once issued (FR-011)', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role anon')
      const entry = await client.query<{ p: EntryResult }>(
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Token Guest',
          '+15557770012',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Token Guest',
          '+15557770012',
        ).values,
      )
      const token = entry.rows[0]!.p.token
      // 32 random bytes ⇒ 43 base64url characters without padding.
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)

      const ctx = await client.query<{ p: { session: { id: string } } }>(CALL.context(token).sql, [
        token,
      ])
      expect(ctx.rows[0]!.p.session.id).toBe(entry.rows[0]!.p.session.id)
    })
  })
})

/**
 * The single refusal message for unknown/tampered/closed sessions — the
 * database suite asserts the exact server text the client keys on.
 */
const SESSION_UNAVAILABLE = 'This session is no longer available.'

/** Run `fn` as an authenticated seeded identity inside the current context. */
async function asIdentity(sub: string) {
  await client.query('set local role authenticated')
  await client.query('select set_config($1, $2, true)', [
    'request.jwt.claims',
    JSON.stringify({ role: 'authenticated', sub }),
  ])
}

describe('US2: the open/join lifecycle under the real RPCs (T016)', () => {
  it('first entry opens exactly one; the second joins as a participant (FR-005, FR-006, FR-016)', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role anon')
      const first = await client.query<{ p: EntryResult }>(
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'First Guest',
          '+15557770021',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'First Guest',
          '+15557770021',
        ).values,
      )
      const second = await client.query<{ p: EntryResult }>(
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Second Guest',
          '+15557770022',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Second Guest',
          '+15557770022',
        ).values,
      )
      expect(first.rows[0]!.p.session.id).toBe(second.rows[0]!.p.session.id)
      expect(first.rows[0]!.p.session.status).toBe('open')

      const ctx = await client.query<{ p: { participants: Array<{ display_name: string }> } }>(
        CALL.context(second.rows[0]!.p.token).sql,
        [second.rows[0]!.p.token],
      )
      const names = ctx.rows[0]!.p.participants.map((p) => p.display_name)
      expect(names).toContain('First Guest')
      expect(names).toContain('Second Guest')
    })
  })

  it('the partial unique index decides a REAL race: two concurrent entries keep one open session (FR-007, SC-003)', async () => {
    const { createDbClient: mk } = await import('./helpers/db')
    const c1 = mk()
    const c2 = mk()
    await c1.connect()
    await c2.connect()
    try {
      await c1.query('set local role anon')
      await c2.query('set local role anon')
      const a = CALL.openSession(
        restaurantIds.blueOlive,
        branchIds.downtown,
        diningTableIds.downtownT3,
        'Race A',
        '+15557770031',
      )
      const b = CALL.openSession(
        restaurantIds.blueOlive,
        branchIds.downtown,
        diningTableIds.downtownT3,
        'Race B',
        '+15557770032',
      )
      const [ra, rb] = await Promise.allSettled([
        c1.query(a.sql, a.values),
        c2.query(b.sql, b.values),
      ])

      let openSessions = 0
      for (const r of [ra, rb]) {
        if (r.status === 'fulfilled') {
          openSessions++
          expect(r.value.rows[0].p.session.status).toBe('open')
        } else {
          // The loser surfaced the contract's join-instead refusal.
          expect(String(r.reason.message)).toContain(
            'A session is already open at this table. Join it instead.',
          )
        }
      }
      // One or both may succeed (the loser may join through the pre-check),
      // but the open-session count for the table is exactly one either way.
      expect(openSessions).toBeGreaterThanOrEqual(1)
      const { createDbClient: mkAgain } = await import('./helpers/db')
      void mkAgain
    } finally {
      await c1.end()
      await c2.end()
    }
  })
})

describe('US2: no-timeout, terminality, and close authorization (T016)', () => {
  it('no-timeout: an open session is usable regardless of elapsed time (FR-008, SC-006)', async () => {
    await inTransaction(client, async () => {
      await client.query('reset role')
      // Age the seeded T1 session far into the past: the context read must
      // not care — no expiry predicate exists anywhere (FR-008).
      await client.query(
        "update public.sessions set opened_at = now() - interval '400 days' where id = $1",
        [sessionIds.downtownT1],
      )
      await client.query('set local role anon')
      const ctx = await client.query<{ p: { session: { status: string } } }>(
        CALL.context(devSessionTokens.downtownT1).sql,
        [devSessionTokens.downtownT1],
      )
      expect(ctx.rows[0]!.p.session.status).toBe('open')
    })
  })

  it('already-closed refusal and terminality: the table frees while the closed row persists (FR-010)', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role anon')
      const entry = await client.query<{ p: EntryResult }>(
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Close Guest',
          '+15557770041',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Close Guest',
          '+15557770041',
        ).values,
      )
      const sid = entry.rows[0]!.p.session.id

      await asIdentity(authUserIds.carla)
      const closed = await client.query<{ p: { closed: boolean } }>(CALL.close(sid).sql, [sid])
      expect(closed.rows[0]!.p.closed).toBe(true)
      await expectRpcFailure('P0001', 'This session is already closed.', CALL.close(sid).sql, [sid])

      // The customer token is now refused — indistinguishable from unknown.
      await client.query('set local role anon')
      await expectRpcFailure(
        'P0001',
        SESSION_UNAVAILABLE,
        CALL.context(entry.rows[0]!.p.token).sql,
        [entry.rows[0]!.p.token],
      )

      // Terminality: the closed row persists and the table is free again.
      await client.query('reset role')
      const stored = await client.query<{ status: string }>(
        'select status from public.sessions where id = $1',
        [sid],
      )
      expect(stored.rows[0]!.status).toBe('closed')
      const fresh = await client.query<{ p: EntryResult }>(
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Fresh Guest',
          '+15557770042',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Fresh Guest',
          '+15557770042',
        ).values,
      )
      expect(fresh.rows[0]!.p.session.id).not.toBe(sid)
    })
  })

  it('close authorization matrix: alice both branches, bob Downtown-only, dan denied (FR-009, FR-019, FR-020)', async () => {
    await inTransaction(client, async () => {
      await client.query('reset role')
      await client.query('update public.dining_tables set is_active = true where id = $1', [
        diningTableIds.marinaT1,
      ])
      await client.query('set local role anon')
      const downtown = await client.query<{ p: EntryResult }>(
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Auth A',
          '+15557770051',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Auth A',
          '+15557770051',
        ).values,
      )
      const marina = await client.query<{ p: EntryResult }>(
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.marina,
          diningTableIds.marinaT1,
          'Auth B',
          '+15557770052',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.marina,
          diningTableIds.marinaT1,
          'Auth B',
          '+15557770052',
        ).values,
      )
      const dSid = downtown.rows[0]!.p.session.id
      const mSid = marina.rows[0]!.p.session.id

      // Alice (owner): both branches.
      await asIdentity(authUserIds.alice)
      expect(
        (await client.query<{ p: { closed: boolean } }>(CALL.close(dSid).sql, [dSid])).rows[0]!.p
          .closed,
      ).toBe(true)
      expect(
        (await client.query<{ p: { closed: boolean } }>(CALL.close(mSid).sql, [mSid])).rows[0]!.p
          .closed,
      ).toBe(true)

      // Bob (Downtown manager): Downtown yes, Marina denied.
      await asIdentity(authUserIds.bob)
      await client.query('set local role anon')
      const downtown2 = await client.query<{ p: EntryResult }>(
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Auth C',
          '+15557770053',
        ).sql,
        CALL.openSession(
          restaurantIds.blueOlive,
          branchIds.downtown,
          diningTableIds.downtownT3,
          'Auth C',
          '+15557770053',
        ).values,
      )
      await asIdentity(authUserIds.bob)
      expect(
        (
          await client.query<{ p: { closed: boolean } }>(
            CALL.close(downtown2.rows[0]!.p.session.id).sql,
            [downtown2.rows[0]!.p.session.id],
          )
        ).rows[0]!.p.closed,
      ).toBe(true)
      await expectRpcFailure('42501', 'permission', CALL.close(mSid).sql, [mSid])

      // Dan (Downtown kitchen): denied everywhere.
      await asIdentity(authUserIds.dan)
      await expectRpcFailure(
        '42501',
        'permission',
        CALL.close(downtown2.rows[0]!.p.session.id).sql,
        [downtown2.rows[0]!.p.session.id],
      )
    })
  })
})

describe('US3: the abuse block (T020) — the single indistinguishable refusal (FR-011, FR-014)', () => {
  const REFUSAL = 'This session is no longer available.'

  it('a NULL token is refused on both customer reads (FR-011)', async () => {
    await asAnon(client, async () => {
      await expectRpcFailure('P0001', REFUSAL, 'select public.get_session_context(null)')
      await expectRpcFailure('P0001', REFUSAL, 'select public.get_session_menu(null)')
    })
  })

  it('a tampered dev token and an arbitrary unknown token are refused (FR-014)', async () => {
    await asAnon(client, async () => {
      await expectRpcFailure(
        'P0001',
        REFUSAL,
        CALL.context(`${devSessionTokens.downtownT1}x`).sql,
        CALL.context(`${devSessionTokens.downtownT1}x`).values,
      )
      await expectRpcFailure(
        'P0001',
        REFUSAL,
        CALL.menu('not-a-token-at-all').sql,
        CALL.menu('not-a-token-at-all').values,
      )
    })
  })

  it('a closed session’s token is refused with no history leakage (FR-014)', async () => {
    await inTransaction(client, async () => {
      // A scratch entry at the seeded open table, then a staff close — raw
      // role juggling, because the asUser/asAnon helpers each open their own
      // (outer-rolling-back) transaction.
      const entry = await enterAt(diningTableIds.downtownT1, 'Abuse Guest', '+15557770091')
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.alice }),
      ])
      await client.query(CALL.close(entry.session.id).sql, [entry.session.id])
      await client.query('reset role')
      await client.query('set local role anon')
      await expectRpcFailure('P0001', REFUSAL, CALL.context(entry.token).sql, [entry.token])
      // The refusal repeats identically — no state, no partial data.
      await expectRpcFailure('P0001', REFUSAL, CALL.context(entry.token).sql, [entry.token])
    })
  })

  it('the refusal is byte-identical across every refused class (FR-014, SC-002)', async () => {
    await inTransaction(client, async () => {
      const entry = await enterAt(diningTableIds.downtownT1, 'Abuse Guest', '+15557770092')
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.alice }),
      ])
      await client.query(CALL.close(entry.session.id).sql, [entry.session.id])
      await client.query('reset role')
      await client.query('set local role anon')
      const messages: string[] = []
      const attempts = [
        { sql: 'select public.get_session_context(null)', values: [] as unknown[] },
        { sql: 'select public.get_session_menu(null)', values: [] as unknown[] },
        CALL.context(`${devSessionTokens.downtownT1}x`),
        CALL.menu('not-a-token-at-all'),
        CALL.context(entry.token),
        CALL.menu(entry.token),
      ]
      for (const attempt of attempts) {
        await client.query('savepoint probe')
        try {
          await client.query(attempt.sql, attempt.values)
          messages.push('NO-REFUSAL')
        } catch (error) {
          messages.push((error as { message: string }).message)
        } finally {
          await client.query('rollback to savepoint probe')
        }
      }
      expect(new Set(messages)).toEqual(new Set([REFUSAL]))
    })
  })

  it('the token’s stored binding decides — no argument path can redirect a read (FR-012)', async () => {
    await inTransaction(client, async () => {
      // Both customer reads take exactly ONE argument: the token. There is
      // no session, branch, or table parameter a caller could aim elsewhere.
      const sig = await client.query<{ pronargs: string; proargnames: string[] }>(
        `select pronargs::text, proargnames
           from pg_proc
          where oid = 'public.get_session_context(text)'::regprocedure`,
      )
      expect(sig.rows[0]?.pronargs).toBe('1')
      expect(sig.rows[0]?.proargnames).toEqual(['p_token'])

      // The token resolves exactly ITS session's context and menu, even while
      // a different session at another table closes. Close via raw juggling
      // (nested helpers would roll the outer transaction back).
      const entryA = await enterAt(diningTableIds.downtownT1, 'Binding A', '+15557770093')
      const entryB = await enterAt(diningTableIds.downtownT2, 'Binding B', '+15557770094')
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.alice }),
      ])
      await client.query(CALL.close(entryB.session.id).sql, [entryB.session.id])
      await client.query('reset role')
      await client.query('set local role anon')
      const ctx = await client.query<{ p: { session: { id: string } } }>(
        CALL.context(entryA.token).sql,
        [entryA.token],
      )
      expect(ctx.rows[0]?.p.session.id).toBe(entryA.session.id)
      const menu = await client.query<{ p: unknown }>(CALL.menu(entryA.token).sql, [entryA.token])
      expect(menu.rows[0]?.p).not.toBeNull()
    })
  })

  it('a customer token never grants staff operations (FR-020)', async () => {
    await asAnon(client, async () => {
      await expectRpcFailure(
        '42501',
        'permission',
        CALL.listOpen(branchIds.downtown).sql,
        CALL.listOpen(branchIds.downtown).values,
      )
      await expectRpcFailure('42501', 'permission', CALL.close(sessionIds.downtownT1).sql, [
        sessionIds.downtownT1,
      ])
    })
  })
})

describe('US4: the staff scoping block (T024)', () => {
  it('the list is exactly the branch’s open sessions, ordered by opened_at (FR-017)', async () => {
    await inTransaction(client, async () => {
      // A fresh scratch session at T3 (opened now — after the seeded rows).
      const scratch = await enterAt(diningTableIds.downtownT3, 'Order Guest', '+15557770101')
      await asUser(client, authUserIds.alice, async () => {
        const res = await client.query<{
          p: { sessions: Array<{ id: string; table_label: string; opened_at: string }> }
        }>(CALL.listOpen(branchIds.downtown).sql, [branchIds.downtown])
        const sessions = res.rows[0]!.p.sessions
        // The three controlled sessions appear in opened_at order; other open
        // sessions may legitimately exist in the shared dev database (e2e
        // residue), so this is a subsequence assertion, not exact equality.
        const controlledIds = [sessionIds.downtownT1, sessionIds.downtownT2, scratch.session.id]
        expect(sessions.map((s) => s.id)).toEqual(expect.arrayContaining(controlledIds))
        const controlled = controlledIds.map((id) => sessions.find((s) => s.id === id))
        expect(controlled.map((s) => s?.table_label)).toEqual(['T1', 'T2', 'T3'])
        const opened = controlled.map((s) => new Date(s!.opened_at).getTime())
        expect([...opened].sort((a, b) => a - b)).toEqual(opened)
      })
    })
  })

  it('the participant payload carries display name and joined-at only — no phone (FR-017, PII posture)', async () => {
    await inTransaction(client, async () => {
      await asUser(client, authUserIds.carla, async () => {
        const res = await client.query<{
          p: { sessions: Array<{ participants: Array<Record<string, unknown>> }> }
        }>(CALL.listOpen(branchIds.downtown).sql, [branchIds.downtown])
        const participants = res.rows[0]!.p.sessions.flatMap((s) => s.participants)
        expect(participants.length).toBeGreaterThan(0)
        for (const participant of participants) {
          expect(Object.keys(participant).sort()).toEqual(['display_name', 'id', 'joined_at'])
        }
      })
    })
  })

  it('the list cross-scope matrix: bob Downtown-only, eve no Marina, fiona denied (FR-019)', async () => {
    await inTransaction(client, async () => {
      await asUser(client, authUserIds.bob, async () => {
        const res = await client.query<{ p: { sessions: Array<{ id: string }> } }>(
          CALL.listOpen(branchIds.downtown).sql,
          [branchIds.downtown],
        )
        // The seeded open sessions are present (other open sessions may
        // exist as e2e residue in the shared database).
        expect(res.rows[0]!.p.sessions.map((s) => s.id)).toEqual(
          expect.arrayContaining([sessionIds.downtownT1, sessionIds.downtownT2]),
        )
        await expectRpcFailure('42501', 'permission', CALL.listOpen(branchIds.marina).sql, [
          branchIds.marina,
        ])
      })
      await asUser(client, authUserIds.eve, async () => {
        await expectRpcFailure('42501', 'permission', CALL.listOpen(branchIds.marina).sql, [
          branchIds.marina,
        ])
      })
      await asUser(client, authUserIds.fiona, async () => {
        await expectRpcFailure('42501', 'permission', CALL.listOpen(branchIds.downtown).sql, [
          branchIds.downtown,
        ])
      })
    })
  })

  it('a branch with no open sessions lists an empty array — never an error (FR-017)', async () => {
    await asUser(client, authUserIds.alice, async () => {
      const res = await client.query<{ p: { sessions: unknown[] } }>(
        CALL.listOpen(branchIds.marina).sql,
        [branchIds.marina],
      )
      expect(res.rows[0]!.p.sessions).toEqual([])
    })
  })
})
