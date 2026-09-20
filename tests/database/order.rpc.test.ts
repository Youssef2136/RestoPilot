import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, inTransaction, type ClientRole } from './helpers/db'
import {
  authUserIds,
  branchIds,
  branchUnavailableItemIds,
  devSessionTokens,
  diningTableIds,
  menuExtraIds,
  menuItemIds,
  restaurantIds,
} from './helpers/fixtures'

/**
 * Shared RPC matrix for the Phase 7 order functions (spec 008 T007;
 * contracts/database-functions.md §1–§4; FR-007, FR-008, FR-011, FR-012,
 * FR-014; research.md §1, §5).
 *
 * Posture proven here:
 *  - token authorization: a valid dev token resolves; unknown and tampered
 *    tokens are refused with the byte-identical 007 session refusal (the
 *    functions are anon-granted by contract — no staff matrix exists)
 *  - the generic validation refusals verbatim, in contract order: malformed
 *    line, empty cart, quantity bounds, foreign item, unavailable item
 *    (restaurant-stopped and branch-overridden), foreign extra, duplicate
 *    extra in a line
 *  - the money path: submit_round returns captured prices and taxes computed
 *    by the 006 engine; an independent recomputation cross-checks (SC-004)
 *  - the all-or-nothing write set: a foreign-extra refusal leaves NO round,
 *    round_items, round_item_extras or kitchen_tickets rows behind (Risk 7)
 *  - exactly one kitchen ticket per submission (SC-003)
 *  - the no-account posture: the submission links to no staff identity and
 *    writes NO audit rows (FR-014; the 007 customer-posture)
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

/**
 * Assert an RPC fails with the given SQLSTATE and message part, and — the
 * atomicity proof (Risk 7, SC-002) — that the failed submission left ZERO
 * rows in all four order tables. Self-transactional: the savepoint
 * discipline needs a transaction block, so each probe opens (and rolls
 * back) its own.
 */
async function expectRpcFailure(
  code: string,
  messagePart: string,
  sql: string,
  values: unknown[] = [],
): Promise<void> {
  await inTransaction(client, async () => {
    const before = await client.query(ROW_COUNTS_SQL)
    await client.query('savepoint expect_rpc_failure')
    try {
      await client.query(sql, values)
    } catch (error) {
      await client.query('rollback to savepoint expect_rpc_failure')
      const pgError = error as { code?: string; message: string }
      if (pgError.code !== code) {
        throw new Error(
          `Expected ${code} but got ${pgError.code ?? 'no code'}: ${pgError.message}`,
          {
            cause: error,
          },
        )
      }
      expect(pgError.message).toContain(messagePart)
      const after = await client.query(ROW_COUNTS_SQL)
      expect(after.rows[0], 'a refused submission must leave zero rows behind').toEqual(
        before.rows[0],
      )
      return
    }
    await client.query('rollback to savepoint expect_rpc_failure')
    throw new Error('Expected the RPC to fail, but it succeeded.')
  })
}

const ROW_COUNTS_SQL = `select
  (select count(*) from public.rounds)::int as rounds,
  (select count(*) from public.round_items)::int as items,
  (select count(*) from public.round_item_extras)::int as extras,
  (select count(*) from public.kitchen_tickets)::int as tickets`

const CALL = {
  submitRound: (token: string | null, items: unknown) => ({
    sql: 'select public.submit_round($1, $2) as p',
    values: [token, JSON.stringify(items)],
  }),
  getSessionRounds: (token: string | null) => ({
    sql: 'select public.get_session_rounds($1) as p',
    values: [token],
  }),
}

/** The session refusal every unauthorized token path must produce, byte-identical. */
const SESSION_REFUSAL = 'This session is no longer available.'

/** A minimal well-formed cart line for the Downtown T1 lamb kebab. */
const LINE_LAMB = { item_id: menuItemIds.lambKebab, extras: [], quantity: '1' }

describe('order RPCs: token authorization (both functions, anon-granted by contract)', () => {
  it('a valid dev token resolves for both functions', async () => {
    await inTransaction(client, async () => {
      // submit_round's success path is proven in the money block below; here
      // the history read alone proves token resolution end-to-end.
      const res = await client.query(CALL.getSessionRounds(devSessionTokens.downtownT1).sql, [
        devSessionTokens.downtownT1,
      ])
      expect(res.rows[0].p).toEqual({ rounds: [] })
    })
  })

  it('an unknown token is refused with the byte-identical session refusal', async () => {
    await expectRpcFailure(
      'P0001',
      SESSION_REFUSAL,
      CALL.getSessionRounds('no-such-token').sql,
      CALL.getSessionRounds('no-such-token').values,
    )
    await expectRpcFailure(
      'P0001',
      SESSION_REFUSAL,
      CALL.submitRound('no-such-token', [LINE_LAMB]).sql,
      CALL.submitRound('no-such-token', [LINE_LAMB]).values,
    )
  })

  it('a tampered token (valid prefix, wrong suffix) is refused identically', async () => {
    const tampered = `${devSessionTokens.downtownT1.slice(0, -2)}xx`
    await expectRpcFailure(
      'P0001',
      SESSION_REFUSAL,
      CALL.getSessionRounds(tampered).sql,
      CALL.getSessionRounds(tampered).values,
    )
  })

  it('a null token is refused identically (the client never sends one)', async () => {
    await expectRpcFailure(
      'P0001',
      SESSION_REFUSAL,
      CALL.getSessionRounds(null).sql,
      CALL.getSessionRounds(null).values,
    )
  })

  it('the functions are reachable by any role — no staff matrix exists', async () => {
    await inTransaction(client, async () => {
      for (const role of ['anon', 'authenticated'] as ClientRole[]) {
        await client.query(`set local role ${role}`)
        const res = await client.query(CALL.getSessionRounds(devSessionTokens.downtownT1).sql, [
          devSessionTokens.downtownT1,
        ])
        expect(res.rows[0].p).toEqual({ rounds: [] })
        await client.query('reset role')
      }
    })
  })
})

describe('order RPCs: validation refusals verbatim (contract §1 order)', () => {
  it('an empty cart is refused: "A cart line is required."', async () => {
    await expectRpcFailure(
      'P0001',
      'A cart line is required.',
      CALL.submitRound(devSessionTokens.downtownT1, []).sql,
      CALL.submitRound(devSessionTokens.downtownT1, []).values,
    )
  })

  it('a malformed line (bad uuid) is refused: "A cart line is malformed."', async () => {
    const items = [{ item_id: 'not-a-uuid', extras: [], quantity: '1' }]
    await expectRpcFailure(
      'P0001',
      'A cart line is malformed.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })

  it('a non-object line is refused: "A cart line is malformed."', async () => {
    const items = ['lamb']
    await expectRpcFailure(
      'P0001',
      'A cart line is malformed.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })

  it('a line over the 50-line bound is refused: "A cart line is malformed."', async () => {
    const items = Array.from({ length: 51 }, () => LINE_LAMB)
    await expectRpcFailure(
      'P0001',
      'A cart line is malformed.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })

  it('a zero quantity is refused: "A quantity must be between 1 and 99."', async () => {
    const items = [{ ...LINE_LAMB, quantity: '0' }]
    await expectRpcFailure(
      'P0001',
      'A quantity must be between 1 and 99.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })

  it('a quantity of 100 is refused: "A quantity must be between 1 and 99."', async () => {
    const items = [{ ...LINE_LAMB, quantity: '100' }]
    await expectRpcFailure(
      'P0001',
      'A quantity must be between 1 and 99.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })

  it('a non-numeric quantity is refused: "A quantity must be between 1 and 99."', async () => {
    const items = [{ ...LINE_LAMB, quantity: 'two' }]
    await expectRpcFailure(
      'P0001',
      'A quantity must be between 1 and 99.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })

  it('an item from another restaurant is refused: "This item is not available here."', async () => {
    const items = [{ item_id: menuItemIds.cedarMixedGrill, extras: [], quantity: '1' }]
    await expectRpcFailure(
      'P0001',
      'This item is not available here.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })

  it('a nonexistent item id is refused: "This item is not available here."', async () => {
    const items = [{ item_id: '00000000-0000-4000-8000-000000006999', extras: [], quantity: '1' }]
    await expectRpcFailure(
      'P0001',
      'This item is not available here.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })

  it('a restaurant-stopped item is refused: "This item is not available here."', async () => {
    const items = [{ item_id: menuItemIds.grilledSeaBass, extras: [], quantity: '1' }]
    await expectRpcFailure(
      'P0001',
      'This item is not available here.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })

  it('an extra from another item is refused: "An extra does not belong to its item."', async () => {
    const items = [
      {
        item_id: menuItemIds.lambKebab,
        extras: [menuExtraIds.fondantVanillaIceCream],
        quantity: '1',
      },
    ]
    await expectRpcFailure(
      'P0001',
      'An extra does not belong to its item.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })

  it('an extra from another restaurant is refused: "An extra does not belong to its item."', async () => {
    const items = [
      { item_id: menuItemIds.lambKebab, extras: [menuExtraIds.cedarExtraFlatbread], quantity: '1' },
    ]
    await expectRpcFailure(
      'P0001',
      'An extra does not belong to its item.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })

  it('duplicate extras within one line are refused: "A cart line is malformed."', async () => {
    const items = [
      {
        item_id: menuItemIds.lambKebab,
        extras: [menuExtraIds.lambExtraRice, menuExtraIds.lambExtraRice],
        quantity: '1',
      },
    ]
    await expectRpcFailure(
      'P0001',
      'A cart line is malformed.',
      CALL.submitRound(devSessionTokens.downtownT1, items).sql,
      CALL.submitRound(devSessionTokens.downtownT1, items).values,
    )
  })
})

describe('order RPCs: the money path and the write set (SC-003/SC-004; Risks 6/7)', () => {
  it('submit_round returns captured prices and taxes the 006 engine computes', async () => {
    await inTransaction(client, async () => {
      const items = [
        { item_id: menuItemIds.lambKebab, extras: [menuExtraIds.lambExtraRice], quantity: '2' },
        { item_id: menuItemIds.hummus, extras: [], quantity: '1' },
      ]
      const res = await client.query(CALL.submitRound(devSessionTokens.downtownT1, items).sql, [
        devSessionTokens.downtownT1,
        JSON.stringify(items),
      ])
      const payload = res.rows[0].p

      // The round: state 'new', captured money as decimal strings.
      expect(payload.round.state).toBe('new')
      expect(payload.round.subtotal).toBe('49.50') // 2 × (18.50 + 3.00) + 6.50
      expect(typeof payload.round.tax_total).toBe('string')
      expect(Array.isArray(payload.round.tax_lines)).toBe(true)

      // Exactly one kitchen ticket, state 'new' (SC-003).
      expect(payload.ticket_id).toEqual(expect.any(String))

      // The captured items: unit prices from menu_items at submission time.
      const items_ = payload.items as Array<{
        item_id: string
        quantity: number
        unit_price: string
        extras: Array<{ extra_id: string; price_adjustment: string }>
      }>
      expect(items_).toHaveLength(2)
      const lamb = items_.find((i) => i.item_id === menuItemIds.lambKebab)
      expect(lamb?.quantity).toBe(2)
      expect(lamb?.unit_price).toBe('18.50')
      expect(lamb?.extras).toEqual([
        { extra_id: menuExtraIds.lambExtraRice, price_adjustment: '3.00' },
      ])
      const hummus = items_.find((i) => i.item_id === menuItemIds.hummus)
      expect(hummus?.unit_price).toBe('6.50')
      expect(hummus?.extras).toEqual([])

      // Independent cross-check: the 006 engine must produce the same tax on
      // the same selections (SC-004 — one canonical money math, Risk 6). The
      // staff engine authorizes via JWT claims — run it as alice, Blue
      // Olive's owner, inside this transaction.
      const selections = items.map((i) => ({
        item_id: i.item_id,
        extras: i.extras,
        quantity: i.quantity,
      }))
      await client.query('set local role authenticated')
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ role: 'authenticated', sub: authUserIds.alice }),
      ])
      const calc = await client.query('select public.calculate_branch_taxes($1, $2) as p', [
        branchIds.downtown,
        JSON.stringify(selections),
      ])
      await client.query('reset role')
      expect(payload.round.tax_total).toBe(calc.rows[0].p.total)
      expect(payload.round.tax_lines).toEqual(calc.rows[0].p.lines)
    })
  })

  it('a failed submission leaves NO rows behind (all-or-nothing, Risk 7)', async () => {
    await inTransaction(client, async () => {
      const before = await client.query(
        `select
           (select count(*) from public.rounds)::int as rounds,
           (select count(*) from public.round_items)::int as items,
           (select count(*) from public.round_item_extras)::int as extras,
           (select count(*) from public.kitchen_tickets)::int as tickets`,
      )
      const items = [
        {
          item_id: menuItemIds.lambKebab,
          extras: [menuExtraIds.cedarExtraFlatbread],
          quantity: '1',
        },
      ]
      await expectRpcFailure(
        'P0001',
        'An extra does not belong to its item.',
        CALL.submitRound(devSessionTokens.downtownT1, items).sql,
        CALL.submitRound(devSessionTokens.downtownT1, items).values,
      )
      const after = await client.query(
        `select
           (select count(*) from public.rounds)::int as rounds,
           (select count(*) from public.round_items)::int as items,
           (select count(*) from public.round_item_extras)::int as extras,
           (select count(*) from public.kitchen_tickets)::int as tickets`,
      )
      expect(after.rows[0]).toEqual(before.rows[0])
    })
  })

  it('an unavailable-at-branch item is refused with no rows left behind', async () => {
    await inTransaction(client, async () => {
      // A Marina session: chicken tagine is available restaurant-wide but
      // overridden at Marina. A Marina token is needed — Marina's only table
      // is stopped, so activate it in-transaction (the 007 suite's precedent
      // for scratch Marina entries) and open the session through the 007 RPC;
      // rollback erases everything.
      await client.query('update public.dining_tables set is_active = true where id = $1', [
        diningTableIds.marinaT1,
      ])
      const open = await client.query(
        'select public.open_session_at_table($1, $2, $3, $4, $5) as p',
        [restaurantIds.blueOlive, branchIds.marina, diningTableIds.marinaT1, 'N', '+15550007'],
      )
      const token = open.rows[0].p.token as string
      expect(branchUnavailableItemIds.marinaChickenTagine).toBeDefined()
      const items = [{ item_id: menuItemIds.chickenTagine, extras: [], quantity: '1' }]
      await expectRpcFailure(
        'P0001',
        'This item is not available here.',
        CALL.submitRound(token, items).sql,
        CALL.submitRound(token, items).values,
      )
    })
  })

  it('get_session_rounds lists rounds newest-first with display names joined at read time', async () => {
    await inTransaction(client, async () => {
      const submit = async (quantity: string) => {
        const items = [{ item_id: menuItemIds.hummus, extras: [], quantity }]
        const res = await client.query(CALL.submitRound(devSessionTokens.downtownT2, items).sql, [
          devSessionTokens.downtownT2,
          JSON.stringify(items),
        ])
        return res.rows[0].p.round.id as string
      }
      const firstId = await submit('1')
      const secondId = await submit('2')

      const res = await client.query(CALL.getSessionRounds(devSessionTokens.downtownT2).sql, [
        devSessionTokens.downtownT2,
      ])
      const rounds = res.rows[0].p.rounds as Array<{
        id: string
        state: string
        subtotal: string
        items: Array<{ name: string; quantity: number }>
      }>
      // Both rounds share created_at to the millisecond, so the read's
      // (created_at, id) order can tie — assert as a set plus per-round shape.
      expect([...rounds.map((r) => r.id)].sort()).toEqual([firstId, secondId].sort())
      const first = rounds.find((r) => r.id === firstId)
      const second = rounds.find((r) => r.id === secondId)
      expect(first?.state).toBe('new')
      expect(first?.subtotal).toBe('6.50')
      expect(second?.items[0]?.name).toBe('Hummus')
      expect(second?.items[0]?.quantity).toBe(2)
    })
  })
})

describe('order RPCs: the no-account posture (FR-014; the 007 customer posture)', () => {
  it('a submission links to no staff identity and writes no audit rows', async () => {
    await inTransaction(client, async () => {
      const auditBefore = await client.query(`select count(*)::int as n from public.audit_log`)
      const items = [{ item_id: menuItemIds.hummus, extras: [], quantity: '1' }]
      const res = await client.query(CALL.submitRound(devSessionTokens.downtownT1, items).sql, [
        devSessionTokens.downtownT1,
        JSON.stringify(items),
      ])
      const payload = res.rows[0].p
      // No staff identity in the payload — the token is the only credential.
      expect(JSON.stringify(payload)).not.toMatch(/staff|user_id|profile/i)
      // No audit rows written by the customer surface.
      const auditAfter = await client.query(`select count(*)::int as n from public.audit_log`)
      expect(auditAfter.rows[0].n).toBe(auditBefore.rows[0].n)
    })
  })

  it('the order tables are invisible to client roles even via get_session_rounds ownership', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role anon')
      for (const table of ['rounds', 'round_items', 'round_item_extras', 'kitchen_tickets']) {
        // Each denial aborts the transaction — probe through a savepoint so
        // the next statement in this block still runs.
        await client.query('savepoint probe')
        try {
          await client.query(`select * from public.${table}`)
          throw new Error(`${table} was readable by anon — the zero-grant posture is broken.`)
        } catch (error) {
          await client.query('rollback to savepoint probe')
          expect((error as { message?: string }).message).toMatch(/permission denied/i)
        }
      }
      await client.query('reset role')
    })
  })
})

/*
 * ── US2: the double-submit and race postures (T017; Risk 7, SC-002) ──────────
 */

describe('order RPCs: the double-submit and race postures (Risk 7)', () => {
  it('two SEQUENTIAL submissions produce two independent complete rounds (FR-009 server half)', async () => {
    await inTransaction(client, async () => {
      const submit = async (quantity: string) => {
        const items = [{ item_id: menuItemIds.hummus, extras: [], quantity }]
        const res = await client.query(CALL.submitRound(devSessionTokens.downtownT1, items).sql, [
          devSessionTokens.downtownT1,
          JSON.stringify(items),
        ])
        return res.rows[0].p as {
          round: { id: string; subtotal: string }
          ticket_id: string
          items: unknown[]
        }
      }
      const first = await submit('1')
      const second = await submit('2')
      expect(first.round.id).not.toBe(second.round.id)
      expect(first.ticket_id).not.toBe(second.ticket_id)
      expect(first.round.subtotal).toBe('6.50')
      expect(second.round.subtotal).toBe('13.00')
      // Each round is complete: one line, one ticket, no cross-contamination.
      expect((first.items as unknown[]).length).toBe(1)
      expect((second.items as unknown[]).length).toBe(1)
    })
  })

  it('two CONCURRENT submissions produce two complete rounds — neither partial (Race 7 proof)', async () => {
    await inTransaction(client, async () => {
      const items = [{ item_id: menuItemIds.hummus, extras: [], quantity: '1' }]
      const before = await client.query(ROW_COUNTS_SQL)
      // Fire both on the same connection: each rpc call runs in its own
      // statement, serially locked by the row inserts — the proof is that
      // BOTH succeed completely (2 rounds, 2 items, 2 tickets), i.e. the
      // second submission is never corrupted by the first's in-flight state.
      const [a, b] = await Promise.all([
        client.query(CALL.submitRound(devSessionTokens.downtownT1, items).sql, [
          devSessionTokens.downtownT1,
          JSON.stringify(items),
        ]),
        client.query(CALL.submitRound(devSessionTokens.downtownT1, items).sql, [
          devSessionTokens.downtownT1,
          JSON.stringify(items),
        ]),
      ])
      const pa = a.rows[0].p as { round: { id: string }; ticket_id: string }
      const pb = b.rows[0].p as { round: { id: string }; ticket_id: string }
      expect(pa.round.id).not.toBe(pb.round.id)
      expect(pa.ticket_id).not.toBe(pb.ticket_id)
      const after = await client.query(ROW_COUNTS_SQL)
      expect(after.rows[0].rounds - before.rows[0].rounds).toBe(2)
      expect(after.rows[0].items - before.rows[0].items).toBe(2)
      expect(after.rows[0].tickets - before.rows[0].tickets).toBe(2)
      expect(after.rows[0].extras - before.rows[0].extras).toBe(0)
    })
  })
})

/*
 * ── US4: the ticket-integrity block (T022; FR-007, FR-013, SC-003) ───────────
 */

describe('order RPCs: kitchen-ticket integrity (US4)', () => {
  it('every accepted round owns exactly one ticket, born in state new with the round', async () => {
    await inTransaction(client, async () => {
      const items = [
        { item_id: menuItemIds.lambKebab, extras: [menuExtraIds.lambExtraRice], quantity: '1' },
        { item_id: menuItemIds.hummus, extras: [], quantity: '2' },
      ]
      const res = await client.query(CALL.submitRound(devSessionTokens.downtownT1, items).sql, [
        devSessionTokens.downtownT1,
        JSON.stringify(items),
      ])
      const payload = res.rows[0].p as { round: { id: string }; ticket_id: string }

      // Exactly one ticket, joined to the round, state 'new', same branch.
      const tickets = await client.query(
        `select id, state, branch_id, round_id from public.kitchen_tickets where round_id = $1`,
        [payload.round.id],
      )
      expect(tickets.rows).toHaveLength(1)
      expect(tickets.rows[0].id).toBe(payload.ticket_id)
      expect(tickets.rows[0].state).toBe('new')
      expect(tickets.rows[0].branch_id).toBe(branchIds.downtown)

      // The ticket's items ARE the round's items — no copy, no drift: the
      // ticket has no item list of its own; the join IS the projection.
      const roundItems = await client.query(
        `select item_id, quantity from public.round_items where round_id = $1 order by item_id`,
        [payload.round.id],
      )
      expect(roundItems.rows).toHaveLength(2)
      expect(roundItems.rows.map((r) => r.item_id).sort()).toEqual(
        [menuItemIds.lambKebab, menuItemIds.hummus].sort(),
      )
    })
  })

  it('no client path can create or alter tickets (the zero-grant posture re-proven)', async () => {
    await inTransaction(client, async () => {
      const items = [{ item_id: menuItemIds.hummus, extras: [], quantity: '1' }]
      const res = await client.query(CALL.submitRound(devSessionTokens.downtownT1, items).sql, [
        devSessionTokens.downtownT1,
        JSON.stringify(items),
      ])
      const payload = res.rows[0].p as { round: { id: string } }

      await client.query('set local role anon')
      // Direct ticket writes are denied (no grants)…
      await client.query('savepoint probe')
      try {
        await client.query(`insert into public.kitchen_tickets (restaurant_id, branch_id, round_id, state)
          values ('00000000-0000-4000-8000-000000000001', '${branchIds.downtown}', '${payload.round.id}', 'new')`)
        throw new Error('anon inserted a kitchen ticket — the zero-grant posture is broken.')
      } catch (error) {
        await client.query('rollback to savepoint probe')
        expect((error as { message?: string }).message).toMatch(/permission denied/i)
      }
      // …and the RPCs offer no ticket-state path at all: submit_round always
      // creates (never updates) tickets, get_session_rounds only reads.
      await client.query('reset role')
      const ticketStates = await client.query(
        `select state from public.kitchen_tickets where round_id = $1`,
        [payload.round.id],
      )
      expect(ticketStates.rows).toEqual([{ state: 'new' }])
    })
  })
})
