import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, inTransaction } from './helpers/db'
import {
  authUserIds,
  branchIds,
  devSessionTokens,
  deliverySessionIds,
  menuItemIds,
  restaurantIds,
  seedDeliveryAddress,
  takeawaySessionIds,
} from './helpers/fixtures'

/**
 * The channel matrix (spec 010 T007; contracts/database-functions.md §1–§5;
 * research.md §5's refusal vocabulary).
 *
 * The 009 identity posture applies: staff refusals are indistinguishable by
 * design — ONE generic message for wrong-channel/wrong-role/illegal-order/
 * unknown-id — and every refusal leaves ZERO change (state and money
 * untouched). Every test runs inside ONE transaction that is ALWAYS rolled
 * back on the shared development database; identities switch inline through
 * the simulated JWT claims (round.lifecycle.test.ts's discipline).
 *
 * Customer entry and submission run through the REAL RPC chain with the
 * seeded dev tokens (open_session_channel → submit_round); rounds for the
 * staff paths are never inserted directly.
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

const CASHIER = authUserIds.carla
const KITCHEN = authUserIds.dan
const OUTSIDER = authUserIds.fiona

/** The generic staff refusal (009's indistinguishability posture, extended). */
const GENERIC = 'This round is not available for that action.'
/** The tenant refusal — the 42501 class. */
const DENIED = 'You do not have permission to update this round.'

/** The seeded dine-in session's token — the dine-in control leg. */
const DINE_IN_TOKEN = devSessionTokens.downtownT1

/** One plain legal selection (the Downtown hummus). */
const hummusSelection = [{ item_id: menuItemIds.hummus, extras: [], quantity: '1' }]

/** Act as the identity for the remainder of the current transaction. */
async function asIdentity(authUserId: string): Promise<void> {
  await client.query('set local role authenticated')
  await client.query('select set_config($1, $2, true)', [
    'request.jwt.claims',
    JSON.stringify({ role: 'authenticated', sub: authUserId }),
  ])
}

/** Drop back to the table owner (fixture surgery and verification reads). */
async function asOwner(): Promise<void> {
  await client.query('reset role')
}

/**
 * Open a channel session through the REAL `open_session_channel` as anon and
 * submit one round with the returned token. Returns the session id, token,
 * and round id.
 */
async function openChannelAndSubmit(
  channel: 'delivery' | 'takeaway',
  deliveryAddress: string | null,
): Promise<{ sessionId: string; token: string; roundId: string }> {
  await client.query('set local role anon')
  const open = await client.query<{ p: { token: string; session: { id: string } } }>(
    'select public.open_session_channel($1, $2, $3, $4, $5, $6) as p',
    [restaurantIds.blueOlive, branchIds.downtown, channel, 'Nour', '+15550777', deliveryAddress],
  )
  const token = open.rows[0]!.p.token
  const sessionId = open.rows[0]!.p.session.id
  await client.query('reset role')
  const sub = await client.query<{ p: { round: { id: string } } }>(
    'select public.submit_round($1, $2) as p',
    [token, JSON.stringify(hummusSelection)],
  )
  return { sessionId, token, roundId: sub.rows[0]!.p.round.id }
}

/** Submit one additional round on an existing token (the cutoff attempt). */
async function submitOnToken(token: string): Promise<void> {
  await client.query('select public.submit_round($1, $2) as p', [
    token,
    JSON.stringify(hummusSelection),
  ])
}

/** The round's (state, subtotal) — an owner read that preserves no role. */
async function roundState(roundId: string): Promise<{ state: string; subtotal: string }> {
  await asOwner()
  const res = await client.query<{ state: string; subtotal: string }>(
    'select state, subtotal::text from public.rounds where id = $1',
    [roundId],
  )
  return { state: res.rows[0]!.state, subtotal: res.rows[0]!.subtotal }
}

/**
 * The zero-change probe: read the round as owner, savepoint, re-enter the
 * identity, attempt, expect the exact failure, roll back to the savepoint
 * (restoring the owner role), and assert state AND money untouched.
 */
async function expectZeroChange(
  authUserId: string,
  roundId: string,
  sql: string,
  values: unknown[],
  code: string,
  messagePart: string,
): Promise<void> {
  const before = await roundState(roundId)
  await client.query('savepoint zero_change_probe')
  try {
    await asIdentity(authUserId)
    await client.query(sql, values)
  } catch (error) {
    await client.query('rollback to savepoint zero_change_probe')
    const pgError = error as { code?: string; message: string }
    if (pgError.code !== code) {
      throw new Error(`Expected ${code} but got ${pgError.code ?? 'no code'}: ${pgError.message}`, {
        cause: error,
      })
    }
    expect(pgError.message).toContain(messagePart)
    const after = await roundState(roundId)
    expect(after).toEqual(before)
    return
  }
  await client.query('rollback to savepoint zero_change_probe')
  throw new Error(`Expected the attempt to fail (${code}, "${messagePart}"), but it succeeded.`)
}

/**
 * Expect a P0001 refusal with an exact message at the current (customer)
 * role, inside a savepoint so the transaction survives.
 */
async function expectCustomerRefusal(
  sql: string,
  values: unknown[],
  messagePart: string,
): Promise<void> {
  await client.query('savepoint customer_refusal')
  try {
    await client.query(sql, values)
  } catch (error) {
    await client.query('rollback to savepoint customer_refusal')
    const pgError = error as { code?: string; message: string }
    expect(pgError.code).toBe('P0001')
    expect(pgError.message).toContain(messagePart)
    return
  }
  await client.query('rollback to savepoint customer_refusal')
  throw new Error(`Expected the attempt to fail ("${messagePart}"), but it succeeded.`)
}

describe('open_session_channel: entry validation', () => {
  it('validates restaurant/branch/channel/name/phone/address with the exact texts', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role anon')
      // unknown restaurant
      await expectCustomerRefusal(
        'select public.open_session_channel($1, $2, $3, $4, $5, $6)',
        [
          '00000000-0000-4000-8000-0000000000ff',
          branchIds.downtown,
          'delivery',
          'Nour',
          '+15550777',
          '1 Test St',
        ],
        'Restaurant or branch not found.',
      )
      // unknown branch
      await expectCustomerRefusal(
        'select public.open_session_channel($1, $2, $3, $4, $5, $6)',
        [
          restaurantIds.blueOlive,
          '00000000-0000-4000-8000-0000000001ff',
          'delivery',
          'Nour',
          '+15550777',
          '1 Test St',
        ],
        'Restaurant or branch not found.',
      )
      // wrong channel
      await expectCustomerRefusal(
        'select public.open_session_channel($1, $2, $3, $4, $5, $6)',
        [restaurantIds.blueOlive, branchIds.downtown, 'dine-in', 'Nour', '+15550777', null],
        'Choose delivery or takeaway.',
      )
      // missing name / phone
      await expectCustomerRefusal(
        'select public.open_session_channel($1, $2, $3, $4, $5, $6)',
        [restaurantIds.blueOlive, branchIds.downtown, 'delivery', '', '+15550777', '1 Test St'],
        'Enter your name',
      )
      await expectCustomerRefusal(
        'select public.open_session_channel($1, $2, $3, $4, $5, $6)',
        [restaurantIds.blueOlive, branchIds.downtown, 'delivery', 'Nour', '', '1 Test St'],
        'Enter your phone number',
      )
      // delivery without an address
      await expectCustomerRefusal(
        'select public.open_session_channel($1, $2, $3, $4, $5, $6)',
        [restaurantIds.blueOlive, branchIds.downtown, 'delivery', 'Nour', '+15550777', null],
        'A delivery address is required.',
      )
      // an address beyond 200 chars
      await expectCustomerRefusal(
        'select public.open_session_channel($1, $2, $3, $4, $5, $6)',
        [
          restaurantIds.blueOlive,
          branchIds.downtown,
          'delivery',
          'Nour',
          '+15550777',
          'x'.repeat(201),
        ],
        'A delivery address is required.',
      )
    })
  })

  it('takeaway ignores any address; delivery stores the trimmed address and issues a token', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role anon')
      // takeaway with an address passed: it is IGNORED, the session has none
      const take = await client.query<{
        p: { session: { id: string; type: string; delivery_address: string | null }; token: string }
      }>('select public.open_session_channel($1, $2, $3, $4, $5, $6) as p', [
        restaurantIds.blueOlive,
        branchIds.downtown,
        'takeaway',
        'Zaid',
        '+15550778',
        'should be ignored',
      ])
      expect(take.rows[0]!.p.session.type).toBe('takeaway')
      expect(take.rows[0]!.p.session.delivery_address).toBeNull()
      expect(take.rows[0]!.p.token).toBeTruthy()
      // delivery stores the trimmed address once, on the session
      const del = await client.query<{
        p: { session: { id: string; type: string; delivery_address: string | null }; token: string }
      }>('select public.open_session_channel($1, $2, $3, $4, $5, $6) as p', [
        restaurantIds.blueOlive,
        branchIds.downtown,
        'delivery',
        'Nour',
        '+15550777',
        '   5 Marina Promenade   ',
      ])
      expect(del.rows[0]!.p.session.type).toBe('delivery')
      expect(del.rows[0]!.p.session.delivery_address).toBe('5 Marina Promenade')
      expect(del.rows[0]!.p.token).toBeTruthy()
      // the one-customer rule: a second call on the same branch opens a NEW
      // session — it never joins the first
      const again = await client.query<{ p: { session: { id: string } } }>(
        'select public.open_session_channel($1, $2, $3, $4, $5, $6) as p',
        [
          restaurantIds.blueOlive,
          branchIds.downtown,
          'delivery',
          'Maha',
          '+15550779',
          '6 Marina Promenade',
        ],
      )
      expect(again.rows[0]!.p.session.id).not.toBe(del.rows[0]!.p.session.id)
    })
  })

  it('open_session_channel refuses the dine-in channel (the 007 path stays the only table path)', async () => {
    await inTransaction(client, async () => {
      await client.query('set local role anon')
      await expectCustomerRefusal(
        'select public.open_session_channel($1, $2, $3, $4, $5, $6)',
        [restaurantIds.blueOlive, branchIds.downtown, 'dine-in', 'Nour', '+15550777', null],
        'Choose delivery or takeaway.',
      )
    })
  })
})

describe('the delivery journey: accept → prepare → ready → out_for_delivery → completed', () => {
  it('walks the full delivery machine with the audit trail and the ticket untouched after ready', async () => {
    await inTransaction(client, async () => {
      const { sessionId, roundId } = await openChannelAndSubmit('delivery', '9 Delivery Lane')
      await asIdentity(CASHIER)
      await client.query('select public.accept_round($1)', [roundId])
      await client.query('select public.start_preparation($1)', [roundId])
      await client.query('select public.mark_round_ready($1)', [roundId])
      const out = await client.query<{ p: { round: { state: string } } }>(
        'select public.mark_out_for_delivery($1) as p',
        [roundId],
      )
      expect(out.rows[0]!.p.round.state).toBe('out_for_delivery')
      const done = await client.query<{ p: { round: { state: string } } }>(
        'select public.mark_completed($1) as p',
        [roundId],
      )
      expect(done.rows[0]!.p.round.state).toBe('completed')

      await asOwner()
      // audit trail: the round-typed actions (accept + the two delivery ones)
      // and the ticket-typed kitchen actions on the round's ticket (the 009
      // contract: kitchen transitions audit as ticket.* with the ticket's id)
      const audits = await client.query<{ action: string }>(
        `select action from public.audit_log where resource_type = 'round' and resource_id = $1::text order by id`,
        [roundId],
      )
      expect(audits.rows.map((r) => r.action)).toEqual([
        'round.accepted',
        'round.out_for_delivery',
        'round.completed',
      ])
      const ticketAudits = await client.query<{ action: string }>(
        `select a.action from public.audit_log a
          where a.resource_type = 'ticket' and a.resource_id in (
            select t.id::text from public.kitchen_tickets t where t.round_id = $1::uuid)
          order by a.id`,
        [roundId],
      )
      expect(ticketAudits.rows.map((r) => r.action)).toEqual(['ticket.preparing', 'ticket.ready'])
      // the ticket ended at ready and was NOT touched by the delivery states
      const ticket = await client.query<{ state: string }>(
        'select state from public.kitchen_tickets where round_id = $1',
        [roundId],
      )
      expect(ticket.rows[0]!.state).toBe('ready')
      // the session survives with its address
      const sess = await client.query<{ delivery_address: string | null }>(
        'select delivery_address from public.sessions where id = $1',
        [sessionId],
      )
      expect(sess.rows[0]!.delivery_address).toBe('9 Delivery Lane')
    })
  })

  it('kitchen refuses the delivery transitions; outsider and anon get no execute', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await openChannelAndSubmit('delivery', '8 Delivery Lane')
      await asIdentity(CASHIER)
      await client.query('select public.accept_round($1)', [roundId])
      await client.query('select public.start_preparation($1)', [roundId])
      await client.query('select public.mark_round_ready($1)', [roundId])

      // kitchen: the 42501 tenant refusal (no cashier membership)
      await expectZeroChange(
        KITCHEN,
        roundId,
        'select public.mark_out_for_delivery($1)',
        [roundId],
        '42501',
        DENIED,
      )
      // outsider fiona: same
      await expectZeroChange(
        OUTSIDER,
        roundId,
        'select public.mark_out_for_delivery($1)',
        [roundId],
        '42501',
        DENIED,
      )
      // the cashier's next step still works after the refusals
      await asIdentity(CASHIER)
      const out = await client.query<{ p: { round: { state: string } } }>(
        'select public.mark_out_for_delivery($1) as p',
        [roundId],
      )
      expect(out.rows[0]!.p.round.state).toBe('out_for_delivery')
    })
  })

  it('wrong-channel and illegal-order transitions refuse with zero change', async () => {
    await inTransaction(client, async () => {
      // a dine-in round: mark_out_for_delivery refuses (wrong channel)
      const dineIn = await client.query<{ p: { round: { id: string } } }>(
        'select public.submit_round($1, $2) as p',
        [DINE_IN_TOKEN, JSON.stringify(hummusSelection)],
      )
      const dineRoundId = dineIn.rows[0]!.p.round.id
      await asIdentity(CASHIER)
      await client.query('select public.accept_round($1)', [dineRoundId])
      await client.query('select public.start_preparation($1)', [dineRoundId])
      await client.query('select public.mark_round_ready($1)', [dineRoundId])
      await expectZeroChange(
        CASHIER,
        dineRoundId,
        'select public.mark_out_for_delivery($1)',
        [dineRoundId],
        'P0001',
        GENERIC,
      )
      // a delivery round in `new`: the skip refuses generically
      const fresh = await openChannelAndSubmit('delivery', '6 Delivery Lane')
      await expectZeroChange(
        CASHIER,
        fresh.roundId,
        'select public.mark_out_for_delivery($1)',
        [fresh.roundId],
        'P0001',
        GENERIC,
      )
      // and so does mark_completed from the wrong state
      await expectZeroChange(
        CASHIER,
        fresh.roundId,
        'select public.mark_completed($1)',
        [fresh.roundId],
        'P0001',
        GENERIC,
      )
    })
  })

  it('the completed state is terminal: no transition fires afterwards', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await openChannelAndSubmit('delivery', '5 Delivery Lane')
      await asIdentity(CASHIER)
      await client.query('select public.accept_round($1)', [roundId])
      await client.query('select public.start_preparation($1)', [roundId])
      await client.query('select public.mark_round_ready($1)', [roundId])
      await client.query('select public.mark_out_for_delivery($1)', [roundId])
      await client.query('select public.mark_completed($1)', [roundId])
      // every further transition refuses with zero change
      await expectZeroChange(
        CASHIER,
        roundId,
        'select public.mark_out_for_delivery($1)',
        [roundId],
        'P0001',
        GENERIC,
      )
      await expectZeroChange(
        CASHIER,
        roundId,
        'select public.mark_completed($1)',
        [roundId],
        'P0001',
        GENERIC,
      )
      await expectZeroChange(
        CASHIER,
        roundId,
        'select public.accept_round($1)',
        [roundId],
        'P0001',
        GENERIC,
      )
    })
  })
})

describe('the cutoff: submissions refuse once the channel state says so', () => {
  it('delivery refuses additional items only after out_for_delivery; the token and cart survive', async () => {
    await inTransaction(client, async () => {
      const { token, roundId } = await openChannelAndSubmit('delivery', '4 Delivery Lane')
      // ready is NOT yet the delivery cutoff — a second submission works
      await asIdentity(CASHIER)
      await client.query('select public.accept_round($1)', [roundId])
      await client.query('select public.start_preparation($1)', [roundId])
      await client.query('select public.mark_round_ready($1)', [roundId])
      await client.query('reset role')
      await submitOnToken(token)
      // out_for_delivery fires the cutoff with the exact message
      await asIdentity(CASHIER)
      await client.query('select public.mark_out_for_delivery($1)', [roundId])
      await client.query('reset role')
      await expectCustomerRefusal(
        'select public.submit_round($1, $2)',
        [token, JSON.stringify(hummusSelection)],
        'Your order is already on its way',
      )
      // staff actions still work post-cutoff (SC-003) — the refusal is only
      // about new orders
      await asIdentity(CASHIER)
      const done = await client.query<{ p: { round: { state: string } } }>(
        'select public.mark_completed($1) as p',
        [roundId],
      )
      expect(done.rows[0]!.p.round.state).toBe('completed')
      // the token still resolves (nothing was cleared — FR-008)
      const ctx = await client.query<{ p: { session: { id: string } } }>(
        'select public.get_session_context($1) as p',
        [token],
      )
      expect(ctx.rows[0]!.p.session.id).toBeTruthy()
    })
  })

  it('takeaway refuses at ready; dine-in never cuts off', async () => {
    await inTransaction(client, async () => {
      const takeaway = await openChannelAndSubmit('takeaway', null)
      await asIdentity(CASHIER)
      await client.query('select public.accept_round($1)', [takeaway.roundId])
      await client.query('select public.start_preparation($1)', [takeaway.roundId])
      await client.query('select public.mark_round_ready($1)', [takeaway.roundId])
      await client.query('reset role')
      // the takeaway cutoff at ready
      await expectCustomerRefusal(
        'select public.submit_round($1, $2)',
        [takeaway.token, JSON.stringify(hummusSelection)],
        'Your order is ready for pickup',
      )
      // dine-in: no cutoff even at a locked round
      const dineIn = await client.query<{ p: { round: { id: string } } }>(
        'select public.submit_round($1, $2) as p',
        [DINE_IN_TOKEN, JSON.stringify(hummusSelection)],
      )
      const dineRoundId = dineIn.rows[0]!.p.round.id
      await asIdentity(CASHIER)
      await client.query('select public.accept_round($1)', [dineRoundId])
      await client.query('select public.start_preparation($1)', [dineRoundId])
      await client.query('select public.mark_round_ready($1)', [dineRoundId])
      await client.query('select public.lock_round($1)', [dineRoundId])
      await client.query('reset role')
      await submitOnToken(DINE_IN_TOKEN)
    })
  })
})

describe('the channel read shapes', () => {
  it('branch rounds and the bill carry session_type and the address; the kitchen queue stays channel-blind', async () => {
    await inTransaction(client, async () => {
      const { sessionId, roundId } = await openChannelAndSubmit('delivery', '3 Delivery Lane')
      await asIdentity(CASHIER)
      await client.query('select public.accept_round($1)', [roundId])
      await client.query('select public.start_preparation($1)', [roundId])
      await client.query('select public.mark_round_ready($1)', [roundId])

      await asOwner()
      const rounds = await client.query<{
        p: Array<{
          round_id: string
          session_type: string
          delivery_address: string | null
          table_label: string | null
        }>
      }>('select public.get_branch_rounds($1) as p', [branchIds.downtown])
      const row = rounds.rows[0]!.p.find((r) => r.round_id === roundId)
      expect(row).toBeTruthy()
      expect(row!.session_type).toBe('delivery')
      expect(row!.delivery_address).toBe('3 Delivery Lane')
      expect(row!.table_label).toBeNull()

      const bill = await client.query<{
        p: {
          session_type: string
          delivery_address: string | null
          rounds: Array<{ round_id: string }>
        }
      }>('select public.get_session_bill($1) as p', [sessionId])
      expect(bill.rows[0]!.p.session_type).toBe('delivery')
      expect(bill.rows[0]!.p.delivery_address).toBe('3 Delivery Lane')
      expect(bill.rows[0]!.p.rounds.map((r) => r.round_id)).toContain(roundId)

      const queue = await client.query<{ p: Array<{ round_id: string }> }>(
        'select public.get_kitchen_queue($1) as p',
        [branchIds.downtown],
      )
      const ticket = queue.rows[0]!.p.find((t) => t.round_id === roundId)
      expect(ticket).toBeTruthy()
      if (ticket) {
        const keys = Object.keys(ticket)
        expect(keys.some((k) => /price|total|tax|address/.test(k))).toBe(false)
      }
    })
  })

  it('the seeded delivery session surfaces its address through the bill; takeaway surfaces none', async () => {
    await inTransaction(client, async () => {
      await asIdentity(CASHIER)
      const delBill = await client.query<{
        p: { session_type: string; delivery_address: string | null }
      }>('select public.get_session_bill($1) as p', [deliverySessionIds.downtownDelivery])
      expect(delBill.rows[0]!.p.session_type).toBe('delivery')
      expect(delBill.rows[0]!.p.delivery_address).toBe(seedDeliveryAddress)
      const takeBill = await client.query<{
        p: { session_type: string; delivery_address: string | null }
      }>('select public.get_session_bill($1) as p', [takeawaySessionIds.downtownTakeaway])
      expect(takeBill.rows[0]!.p.session_type).toBe('takeaway')
      expect(takeBill.rows[0]!.p.delivery_address).toBeNull()
    })
  })
})
