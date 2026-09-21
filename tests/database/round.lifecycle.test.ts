import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, createDbClient, inTransaction } from './helpers/db'
import {
  authUserIds,
  branchIds,
  diningTableIds,
  menuItemIds,
  restaurantIds,
} from './helpers/fixtures'

/**
 * The round state machine matrix (spec 009 T006; contracts/
 * database-functions.md §1–§5; research.md §1–§2).
 *
 * The 007 identity posture applies to state: skip, backward, repeat,
 * terminal, and unknown-id refusals are indistinguishable — ONE generic
 * message, and every refusal leaves ZERO state change (rows and money
 * untouched). Every test runs inside ONE transaction that is ALWAYS rolled
 * back on the shared cloud development database; identities switch inline
 * through the simulated JWT claims (session.rpc.test.ts's `asIdentity`).
 *
 * A round is created per test through the real 007→008 chain
 * (open_session_at_table → submit_round) — no direct-table inserts. The
 * kitchen paths run at MARINA (the only kitchen membership's branch); its
 * table is the deliberate inactive fixture, activated in-transaction first
 * (the 007 precedent).
 *
 * SC-002's two-connection race is NOT provable on the pooled session-mode
 * cloud database (every connection serializes on the same transaction
 * manager) — the guarded-update design (research §1) plus the sequential
 * proof and the zero-change refusals stand in for it, exactly as the 008
 * suite documented for its concurrency class.
 */

const client = createDbClient()

beforeAll(async () => {
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

const OWNER = authUserIds.alice
const MANAGER = authUserIds.bob
const CASHIER = authUserIds.carla
const KITCHEN = authUserIds.dan
const FOREIGN_OWNER = authUserIds.eve
const OUTSIDER = authUserIds.fiona

/** The generic state refusal (the 007 indistinguishability posture on state). */
const GENERIC = 'This round is not available for that action.'
/** The tenant refusal, per action. */
const DENIED = 'You do not have permission to update this round.'

/** One plain legal selection. */
const hummusSelection = [{ item_id: menuItemIds.hummus, extras: [], quantity: '1' }]

/** Act as the identity for the remainder of the current transaction. */
async function asIdentity(authUserId: string): Promise<void> {
  await client.query('set local role authenticated')
  await client.query('select set_config($1, $2, true)', [
    'request.jwt.claims',
    JSON.stringify({ role: 'authenticated', sub: authUserId }),
  ])
}

/** Drop back to the table owner (for fixture surgery and verification reads). */
async function asOwner(): Promise<void> {
  await client.query('reset role')
}

/**
 * Open a scratch session at `tableId` and submit one round through the
 * production chain, as `authUserId`. Activates the table first when needed
 * (Marina's T1 is the inactive fixture).
 */
async function submitScratchRound(
  authUserId: string = CASHIER,
  tableId: string = diningTableIds.downtownT3,
): Promise<{ roundId: string; sessionId: string; branchId: string }> {
  const branchId = tableId === diningTableIds.marinaT1 ? branchIds.marina : branchIds.downtown
  await asOwner()
  await client.query('update public.dining_tables set is_active = true where id = $1', [tableId])
  await asIdentity(authUserId)
  const open = await client.query<{ p: { token: string; session: { id: string } } }>(
    'select public.open_session_at_table($1, $2, $3, $4, $5) as p',
    [restaurantIds.blueOlive, branchId, tableId, 'N', '+15550999'],
  )
  const token = open.rows[0]!.p.token
  const sub = await client.query<{ p: { round: { id: string; session_id: string } } }>(
    'select public.submit_round($1, $2) as p',
    [token, JSON.stringify(hummusSelection)],
  )
  return {
    roundId: sub.rows[0]!.p.round.id,
    sessionId: sub.rows[0]!.p.round.session_id,
    branchId,
  }
}

/** The round's (state, money) — an owner read that preserves no role state. */
async function roundState(roundId: string): Promise<{ state: string; subtotal: string }> {
  await asOwner()
  const res = await client.query<{ state: string; subtotal: string }>(
    'select state, subtotal::text from public.rounds where id = $1',
    [roundId],
  )
  return { state: res.rows[0]!.state, subtotal: res.rows[0]!.subtotal }
}

/** The ticket's state for the round (owner read). */
async function ticketState(roundId: string): Promise<string> {
  await asOwner()
  const res = await client.query<{ state: string }>(
    'select state from public.kitchen_tickets where round_id = $1',
    [roundId],
  )
  return res.rows[0]!.state
}

/**
 * The round's audit actions in write order (owner read) — including the
 * ticket transitions (contract: `ticket.*` rows carry the TICKET's id, so
 * the reader resolves the round's ticket).
 */
async function auditActions(roundId: string): Promise<string[]> {
  await asOwner()
  const res = await client.query<{ action: string }>(
    `select a.action
     from public.audit_log a
     where a.resource_id = $1::text
        or (a.resource_type = 'ticket' and a.resource_id in (
          select t.id::text from public.kitchen_tickets t where t.round_id = $2::uuid
        ))
     order by a.id`,
    [roundId, roundId],
  )
  return res.rows.map((r) => r.action)
}

/**
 * The zero-change probe: read the round as owner, savepoint, RE-ENTER the
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

describe('round lifecycle: the identity and tenant gates', () => {
  it('accept_round refuses the outsider with zero change; the dual-role eve reaches Downtown as cashier', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound()
      await expectZeroChange(
        OUTSIDER,
        roundId,
        'select public.accept_round($1)',
        [roundId],
        '42501',
        DENIED,
      )
      // Eve holds a Downtown CASHIER membership alongside her Cedar Grill
      // ownership (the deliberate dual-role fixture) — her accept succeeds.
      await asIdentity(FOREIGN_OWNER)
      const res = await client.query<{ p: { round: { state: string } } }>(
        'select public.accept_round($1) as p',
        [roundId],
      )
      expect(res.rows[0]!.p.round.state).toBe('accepted')
    })
  })

  it('anon holds no execute on the staff mutations at all', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound()
      await asOwner()
      await asAnon(client, async () => {
        await expect(
          client.query('select public.accept_round($1)', [roundId]),
        ).rejects.toThrowError(/permission denied/i)
      })
    })
  })

  it('a kitchen membership cannot accept, and Marina kitchen cannot reach a Downtown round', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound()
      // Dan's only membership is kitchen@Marina: doubly denied on a Downtown round.
      await expectZeroChange(
        KITCHEN,
        roundId,
        'select public.accept_round($1)',
        [roundId],
        '42501',
        DENIED,
      )
    })
  })
})

describe('round lifecycle: the happy path and its ticket/audit sync', () => {
  it('cashier accepts: round new→accepted, ticket new→accepted, one audited action', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound()
      await asIdentity(CASHIER)
      const res = await client.query<{ p: { round: { state: string }; ticket_state: string } }>(
        'select public.accept_round($1) as p',
        [roundId],
      )
      expect(res.rows[0]!.p.round.state).toBe('accepted')
      expect(res.rows[0]!.p.ticket_state).toBe('accepted')
      expect(await ticketState(roundId)).toBe('accepted')
      expect(await auditActions(roundId)).toEqual(['round.accepted'])
    })
  })

  it('the owner accepts too (alice reaches the branch through the restaurant arm)', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound()
      await asIdentity(OWNER)
      const res = await client.query<{ p: { round: { state: string } } }>(
        'select public.accept_round($1) as p',
        [roundId],
      )
      expect(res.rows[0]!.p.round.state).toBe('accepted')
    })
  })

  it('kitchen starts preparation at its own branch: accepted→preparing on round and ticket, audited', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound(CASHIER, diningTableIds.marinaT1)
      // Marina has no cashier: the OWNER arm accepts and later locks.
      await asIdentity(OWNER)
      await client.query('select public.accept_round($1)', [roundId])
      await asIdentity(KITCHEN)
      const res = await client.query<{ p: { round: { state: string }; ticket_state: string } }>(
        'select public.start_preparation($1) as p',
        [roundId],
      )
      expect(res.rows[0]!.p.round.state).toBe('preparing')
      expect(res.rows[0]!.p.ticket_state).toBe('preparing')
      expect(await ticketState(roundId)).toBe('preparing')
      expect(await auditActions(roundId)).toEqual(['round.accepted', 'ticket.preparing'])
    })
  })

  it('kitchen marks ready at its own branch: preparing→ready on round and ticket, audited', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound(CASHIER, diningTableIds.marinaT1)
      await asIdentity(OWNER)
      await client.query('select public.accept_round($1)', [roundId])
      await asIdentity(KITCHEN)
      await client.query('select public.start_preparation($1)', [roundId])
      const res = await client.query<{ p: { round: { state: string }; ticket_state: string } }>(
        'select public.mark_round_ready($1) as p',
        [roundId],
      )
      expect(res.rows[0]!.p.round.state).toBe('ready')
      expect(res.rows[0]!.p.ticket_state).toBe('ready')
      expect(await auditActions(roundId)).toEqual([
        'round.accepted',
        'ticket.preparing',
        'ticket.ready',
      ])
    })
  })

  it('lock_round at the owner-arm branch: ready→lock, the terminal state, audited', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound(CASHIER, diningTableIds.marinaT1)
      await asIdentity(OWNER)
      await client.query('select public.accept_round($1)', [roundId])
      await asIdentity(KITCHEN)
      await client.query('select public.start_preparation($1)', [roundId])
      await client.query('select public.mark_round_ready($1)', [roundId])
      await asIdentity(OWNER)
      const res = await client.query<{ p: { round: { state: string } } }>(
        'select public.lock_round($1) as p',
        [roundId],
      )
      expect(res.rows[0]!.p.round.state).toBe('lock')
      expect(await auditActions(roundId)).toEqual([
        'round.accepted',
        'ticket.preparing',
        'ticket.ready',
        'round.locked',
      ])
    })
  })

  it('the manager drives the full chain alone (SC-001 end to end)', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound()
      await asIdentity(MANAGER)
      const chain: Array<[string, string]> = [
        ['accept_round', 'accepted'],
        ['start_preparation', 'preparing'],
        ['mark_round_ready', 'ready'],
        ['lock_round', 'lock'],
      ]
      for (const [fn, expected] of chain) {
        const res = await client.query<{ p: { round: { state: string } } }>(
          `select public.${fn}($1) as p`,
          [roundId],
        )
        expect(res.rows[0]!.p.round.state).toBe(expected)
      }
    })
  })
})

describe('round lifecycle: every illegal transition refuses with zero change', () => {
  it('accept_round on a non-new round: the repeat refusal', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound()
      await asIdentity(CASHIER)
      await client.query('select public.accept_round($1)', [roundId])
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

  it('preparation and ready refuse before accept; lock refuses early states', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound(CASHIER, diningTableIds.marinaT1)
      // Dan (kitchen@Marina) passes the role gate — the state guard refuses.
      await expectZeroChange(
        KITCHEN,
        roundId,
        'select public.start_preparation($1)',
        [roundId],
        'P0001',
        GENERIC,
      )
      await expectZeroChange(
        KITCHEN,
        roundId,
        'select public.mark_round_ready($1)',
        [roundId],
        'P0001',
        GENERIC,
      )
      // Alice (owner arm) passes lock's role gate — the state guard refuses.
      await expectZeroChange(
        OWNER,
        roundId,
        'select public.lock_round($1)',
        [roundId],
        'P0001',
        GENERIC,
      )
    })
  })

  it('lock is terminal: no transition fires afterwards; the ticket never reaches lock', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound(CASHIER, diningTableIds.marinaT1)
      await asIdentity(OWNER)
      await client.query('select public.accept_round($1)', [roundId])
      await asIdentity(KITCHEN)
      await client.query('select public.start_preparation($1)', [roundId])
      await client.query('select public.mark_round_ready($1)', [roundId])
      await asIdentity(OWNER)
      await client.query('select public.lock_round($1)', [roundId])
      for (const fn of ['accept_round', 'start_preparation', 'mark_round_ready', 'lock_round']) {
        await expectZeroChange(
          OWNER,
          roundId,
          `select public.${fn}($1)`,
          [roundId],
          'P0001',
          GENERIC,
        )
      }
      expect(await ticketState(roundId)).toBe('ready')
    })
  })

  it('an unknown round id refuses exactly like an out-of-tenant one (42501, indistinguishable)', async () => {
    await inTransaction(client, async () => {
      await asIdentity(CASHIER)
      const ghost = '00000000-0000-4000-8000-000000009999'
      for (const fn of ['accept_round', 'start_preparation', 'mark_round_ready', 'lock_round']) {
        // Savepoint-scoped: a refusal aborts the transaction until rolled back.
        await client.query('savepoint ghost_probe')
        await expect(client.query(`select public.${fn}($1)`, [ghost])).rejects.toThrowError(DENIED)
        await client.query('rollback to savepoint ghost_probe')
      }
    })
  })

  it('the sequential double-accept race: exactly one winner, the loser sees zero change (SC-002 posture)', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound()
      await asIdentity(CASHIER)
      const first = await client.query<{ p: { round: { state: string } } }>(
        'select public.accept_round($1) as p',
        [roundId],
      )
      expect(first.rows[0]!.p.round.state).toBe('accepted')
      await expectZeroChange(
        MANAGER,
        roundId,
        'select public.accept_round($1)',
        [roundId],
        'P0001',
        GENERIC,
      )
    })
  })
})

describe('round reads: the staff surface scoping', () => {
  it('the branch reads silently filter the outsider ([] — indistinguishable); the bill refuses; the cashier reaches its branch data', async () => {
    await inTransaction(client, async () => {
      const { roundId, sessionId } = await submitScratchRound()

      await asIdentity(OUTSIDER)
      const foreign = await client.query<{ p: unknown[] }>(
        'select public.get_branch_rounds($1) as p',
        [branchIds.downtown],
      )
      expect(foreign.rows[0]!.p).toEqual([])
      await client.query('savepoint bill_probe')
      await expect(
        client.query('select public.get_session_bill($1)', [sessionId]),
      ).rejects.toThrowError(/^You do not have permission to view this bill\.$/)
      await client.query('rollback to savepoint bill_probe')

      await asIdentity(CASHIER)
      const rounds = await client.query<{
        p: Array<{ round_id: string; state: string; table_label: string }>
      }>('select public.get_branch_rounds($1) as p', [branchIds.downtown])
      const mine = rounds.rows[0]!.p.filter((r) => r.round_id === roundId)
      expect(mine.length).toBeGreaterThan(0)
      expect(mine[0]!.table_label).toBe('T3')

      const bill = await client.query<{
        p: {
          rounds: Array<{ round_id: string; subtotal: string; tax_total: string }>
          grand_total: string
        }
      }>('select public.get_session_bill($1) as p', [sessionId])
      expect(bill.rows[0]!.p.rounds.map((r) => r.round_id)).toContain(roundId)
      // SC-005's exactness: the grand total is the EXACT sum of the captured
      // per-round money over NON-voided rounds (spec 011 FR-003 — the void
      // reduces the bill) — no re-derivation, no rounding drift.
      const sum = bill.rows[0]!.p.rounds.filter((r) => !(r as { voided?: boolean }).voided).reduce(
        (acc, r) => acc + parseFloat(r.subtotal) + parseFloat(r.tax_total),
        0,
      )
      expect(bill.rows[0]!.p.grand_total).toBe(sum.toFixed(2))
    })
  })

  it('a kitchen membership at Marina cannot read Downtown data (cross-branch reads)', async () => {
    await inTransaction(client, async () => {
      const { sessionId } = await submitScratchRound()
      await asIdentity(KITCHEN)
      await client.query('savepoint bill_probe')
      await expect(
        client.query('select public.get_session_bill($1)', [sessionId]),
      ).rejects.toThrowError(/^You do not have permission to view this bill\.$/)
      await client.query('rollback to savepoint bill_probe')
      const foreign = await client.query<{ p: unknown[] }>(
        'select public.get_branch_rounds($1) as p',
        [branchIds.downtown],
      )
      expect(foreign.rows[0]!.p).toEqual([])
    })
  })

  it('get_kitchen_queue carries zero money keys anywhere in its payload (FR-010)', async () => {
    await inTransaction(client, async () => {
      const { roundId } = await submitScratchRound()
      await asIdentity(CASHIER)
      await client.query('select public.accept_round($1)', [roundId])
      const queue = await client.query<{ p: Array<Record<string, unknown>> }>(
        'select public.get_kitchen_queue($1) as p',
        [branchIds.downtown],
      )
      const tickets = queue.rows[0]!.p
      expect(tickets.length).toBeGreaterThan(0)
      for (const t of tickets) {
        for (const key of Object.keys(t)) {
          expect(key).not.toMatch(/price|subtotal|tax|total/i)
        }
        for (const item of (t['items'] as Array<Record<string, unknown>>) ?? []) {
          for (const key of Object.keys(item)) {
            expect(key).not.toMatch(/price|subtotal|tax|total/i)
          }
        }
      }
    })
  })
})
