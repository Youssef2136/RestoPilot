import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asUser, createDbClient, expectStatementToFail } from './helpers/db'
import {
  authUserIds,
  branchIds,
  devSessionTokens,
  menuItemIds,
  restaurantIds,
  sessionIds,
} from './helpers/fixtures'

/**
 * Security: session abuse (spec 015 T006; FR-004; §25 area 4). The token
 * is the customer's only authority — its failure modes must be exactly
 * closed: guessed/fabricated tokens, closed-session reuse, cross-session
 * and cross-table access, replay after forbidden states.
 */
describe('security: session and token abuse fails closed (FR-004)', () => {
  const db = createDbClient()

  beforeAll(async () => {
    await db.connect()
  })

  afterAll(async () => {
    await db.end()
  })

  it('guessed and fabricated tokens are refused indistinguishably', async () => {
    await asAnon(db, async () => {
      const guesses = [
        'dev-token-downtown-t1-2025', // plausible year guess
        'dev-token-downtown-t3-2026', // plausible table guess (no T3 session token)
        'dev-token-marina-t1-2026', // plausible branch guess
        '', // empty
        'x', // short
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // long garbage
        "'; drop table public.session_tokens; --", // injection-shaped
      ]
      for (const g of guesses) {
        await expectStatementToFail(db, 'P0001', 'select get_session_context($1)', [g])
      }
      // Every refusal is the SAME verbatim text (no oracle for which part
      // failed). Each probe runs in its OWN rolled-back block — inside one
      // transaction a refusal aborts everything after it.
      for (const g of guesses.slice(0, 3)) {
        await asAnon(db, async () => {
          try {
            await db.query('select get_session_context($1)', [g])
            expect.unreachable('should have refused')
          } catch (e) {
            expect((e as Error).message).toContain('This session is no longer available.')
          }
        })
      }
    })
  })

  it('a token cannot reach another session, table, or restaurant', async () => {
    await asAnon(db, async () => {
      // get_session_context resolves ONLY the token's own session — cross-
      // table/cross-restaurant access is impossible by construction, and
      // the suite pins the shape: the returned ids are the seeded ones.
      const ctx = await db.query('select get_session_context($1) as c', [
        devSessionTokens.downtownT2,
      ])
      const session = ctx.rows[0].c.session
      expect(session.id).toBe(sessionIds.downtownT2)
      expect(session.branch_id).toBe(branchIds.downtown)
      expect(session.restaurant_id).toBe(restaurantIds.blueOlive)
      // The delivery token cannot masquerade as the T1 dine-in session.
      const ctx2 = await db.query('select get_session_context($1) as c', [
        devSessionTokens.downtownDelivery,
      ])
      expect(ctx2.rows[0].c.session.id).not.toBe(sessionIds.downtownT1)
      expect(ctx2.rows[0].c.session.type).toBe('delivery')
    })
  })

  it('token replay against a closed session fails closed', async () => {
    // Arrange a fresh open session as a customer, close it as staff (a real
    // staff identity), then prove every token-path call refuses.
    await asAnon(db, async () => {
      const opened = await db.query('select open_session_at_table($1, $2, $3, $4, $5) as o', [
        restaurantIds.blueOlive,
        branchIds.downtown,
        '00000000-0000-4000-8000-000000003001',
        'Sec Probe',
        '+15551234000',
      ])
      const token = opened.rows[0].o.token
      const sessionId = opened.rows[0].o.session.id

      // Sanity: the fresh token works once.
      const ctx = await db.query('select get_session_context($1) as c', [token])
      expect(ctx.rows[0].c.session.id).toBe(sessionId)

      // Close it as a real cashier.
      await asUser(db, authUserIds.carla, async () => {
        await db.query('select close_session($1)', [sessionId])
      })

      // Replay: all three token surfaces refuse with the same text.
      const replays: Array<[string, string[]]> = [
        ['select get_session_context($1)', [token]],
        ['select get_session_menu($1)', [token]],
        [
          'select submit_round($1, $2::jsonb)',
          [token, JSON.stringify([{ item_id: menuItemIds.lambKebab, quantity: '1', extras: [] }])],
        ],
      ]
      for (const [sql, params] of replays) {
        try {
          await db.query(sql, params)
          expect.unreachable('should have refused')
        } catch (e) {
          expect((e as Error).message).toContain('This session is no longer available.')
        }
      }
    })
  })
})
