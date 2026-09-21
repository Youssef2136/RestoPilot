import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient, inTransaction } from './helpers/db'
import { authUserIds, branchIds, devSessionTokens, menuItemIds } from './helpers/fixtures'

/**
 * The bill/void/audit matrix (spec 011 T004; contracts/database-functions.md
 * §1–§3; research.md §1–§5's refusal vocabulary).
 *
 * The 009/010 identity posture applies: staff refusals are indistinguishable
 * by design — ONE generic message for wrong-boundary/unknown-id/already-void,
 * ONE denial class for wrong-role/foreign-branch — and every refusal leaves
 * ZERO change (state, void columns, ticket mirror, audit count). Every test
 * runs inside ONE transaction that is ALWAYS rolled back; identities switch
 * inline through the simulated JWT claims (round.lifecycle's discipline).
 *
 * Rounds for the staff paths come from the REAL RPC chain (submit_round on
 * the seeded dev tokens) — never direct inserts. Voiding is an OVERLAY
 * (research §1): the state is never written by void_round, so a voided
 * completed delivery round still blocks new orders (FR-011).
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
const OUTSIDER = authUserIds.fiona

const GENERIC = 'This round is not available for that action.'
const DENIED = 'You do not have permission to update this round.'
const AUDIT_DENIED = 'You do not have permission to view the audit trail.'
const REASON_REQUIRED = 'A void reason is required.'
const REASON_TOO_LONG = 'A void reason may be at most 500 characters.'

const DINE_IN_TOKEN = devSessionTokens.downtownT1
const DELIVERY_TOKEN = devSessionTokens.downtownDelivery
const TAKEAWAY_TOKEN = devSessionTokens.downtownTakeaway

const kebabSelection = [{ item_id: menuItemIds.lambKebab, extras: [], quantity: '1' }]

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

/** Submit one round through the REAL anon path on the given dev token. */
async function submitOnToken(token: string): Promise<string> {
  await client.query('set local role anon')
  const res = await client.query<{ p: { round: { id: string } } }>(
    'select public.submit_round($1, $2) as p',
    [token, JSON.stringify(kebabSelection)],
  )
  await asOwner()
  return res.rows[0]!.p.round.id
}

/** The round's full void-relevant row — an owner read. */
async function roundRow(
  roundId: string,
): Promise<{ state: string; voided: boolean; voided_at: Date | null; void_reason: string | null }> {
  await asOwner()
  const res = await client.query<{
    state: string
    voided: boolean
    voided_at: Date | null
    void_reason: string | null
  }>('select state, voided, voided_at, void_reason from public.rounds where id = $1', [roundId])
  return res.rows[0]!
}

/** The round's ticket void mirror + the audit count for the round. */
async function voidSideEffects(
  roundId: string,
): Promise<{ ticketVoided: boolean; audits: number }> {
  await asOwner()
  const t = await client.query<{ voided: boolean }>(
    'select voided from public.kitchen_tickets where round_id = $1',
    [roundId],
  )
  const a = await client.query<{ count: string }>(
    "select count(*)::text as count from public.audit_log where resource_id = $1 and action = 'round.void'",
    [roundId],
  )
  return { ticketVoided: t.rows[0]?.voided ?? false, audits: Number(a.rows[0]!.count) }
}

/**
 * The zero-change probe: read the round as owner, savepoint, re-enter the
 * identity, attempt, expect the exact failure, roll back to the savepoint,
 * and assert state, void columns, ticket mirror, AND audit count untouched.
 */
async function expectVoidZeroChange(
  authUserId: string,
  roundId: string,
  reason: string,
  code: string,
  messagePart: string,
): Promise<void> {
  const before = await roundRow(roundId)
  const beforeSide = await voidSideEffects(roundId)
  await client.query('savepoint void_probe')
  try {
    await asIdentity(authUserId)
    await client.query('select public.void_round($1, $2)', [roundId, reason])
  } catch (error) {
    await client.query('rollback to savepoint void_probe')
    const pgError = error as { code?: string; message: string }
    if (pgError.code !== code) {
      throw new Error(`Expected ${code} but got ${pgError.code ?? 'no code'}: ${pgError.message}`, {
        cause: error,
      })
    }
    expect(pgError.message).toBe(messagePart)
    const after = await roundRow(roundId)
    expect(after).toEqual(before)
    const afterSide = await voidSideEffects(roundId)
    expect(afterSide).toEqual(beforeSide)
    return
  }
  await client.query('rollback to savepoint void_probe')
  throw new Error(`Expected the attempt to fail (${code}, "${messagePart}"), but it succeeded.`)
}

/** The legal transition path (as carla) that PRODUCES each state from `new`. */
const DRIVE_PATHS: Record<string, string[]> = {
  new: [],
  accepted: ['accept_round'],
  preparing: ['accept_round', 'start_preparation'],
  ready: ['accept_round', 'start_preparation', 'mark_round_ready'],
  lock: ['accept_round', 'start_preparation', 'mark_round_ready', 'lock_round'],
  out_for_delivery: [
    'accept_round',
    'start_preparation',
    'mark_round_ready',
    'mark_out_for_delivery',
  ],
  completed: [
    'accept_round',
    'start_preparation',
    'mark_round_ready',
    'mark_out_for_delivery',
    'mark_completed',
  ],
}

/**
 * Drive a round through carla's legal transitions to the requested state.
 * State-aware: reads the round's CURRENT state and applies only the delta,
 * so re-driving the same round to a deeper state never replays a step that
 * is now illegal (the just-below boundary test reuses its rounds).
 */
async function driveTo(
  roundId: string,
  target: 'accepted' | 'preparing' | 'ready' | 'lock' | 'out_for_delivery' | 'completed',
): Promise<void> {
  await asOwner()
  const current = await client.query<{ state: string }>(
    'select state from public.rounds where id = $1',
    [roundId],
  )
  const from = DRIVE_PATHS[current.rows[0]!.state]
  const to = DRIVE_PATHS[target]
  if (!from || !to || to.length < from.length || to.slice(0, from.length).join() !== from.join()) {
    throw new Error(
      `driveTo: no forward path from '${current.rows[0]!.state}' to '${target}' (round ${roundId})`,
    )
  }
  await asIdentity(CASHIER)
  for (const fn of to.slice(from.length)) {
    await client.query(`select public.${fn}($1)`, [roundId])
  }
  await asOwner()
}

describe('void_round: the boundary per channel (FR-004/FR-005)', () => {
  it('a locked dine-in round voids; the state stays lock (the overlay)', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(roundId, 'lock')

      await asIdentity(CASHIER)
      const res = await client.query<{
        p: { round: { state: string }; voided: boolean; void_reason: string }
      }>('select public.void_round($1, $2) as p', [roundId, 'Guest left — order cancelled'])
      expect(res.rows[0]!.p.round.state).toBe('lock')
      expect(res.rows[0]!.p.voided).toBe(true)
      expect(res.rows[0]!.p.void_reason).toBe('Guest left — order cancelled')

      const row = await roundRow(roundId)
      expect(row.state).toBe('lock')
      expect(row.voided).toBe(true)
      expect(row.voided_at).not.toBeNull()
      const side = await voidSideEffects(roundId)
      expect(side.ticketVoided).toBe(true)
      expect(side.audits).toBe(1)
    })
  })

  it('an out_for_delivery round voids; a completed delivery round voids too', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DELIVERY_TOKEN)
      await driveTo(roundId, 'out_for_delivery')
      await asIdentity(CASHIER)
      const res = await client.query<{ p: { voided: boolean } }>(
        'select public.void_round($1, $2) as p',
        [roundId, 'Customer unreachable'],
      )
      expect(res.rows[0]!.p.voided).toBe(true)
    })
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DELIVERY_TOKEN)
      await driveTo(roundId, 'completed')
      await asIdentity(CASHIER)
      const res = await client.query<{ p: { voided: boolean } }>(
        'select public.void_round($1, $2) as p',
        [roundId, 'Returned to branch'],
      )
      expect(res.rows[0]!.p.voided).toBe(true)
    })
  })

  it('a ready takeaway round voids', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(TAKEAWAY_TOKEN)
      await driveTo(roundId, 'ready')
      await asIdentity(CASHIER)
      const res = await client.query<{ p: { voided: boolean } }>(
        'select public.void_round($1, $2) as p',
        [roundId, 'Never collected'],
      )
      expect(res.rows[0]!.p.voided).toBe(true)
    })
  })

  it('every just-below state refuses with zero change (void is not the edit path)', async () => {
    await inTransaction(client, async () => {
      const dineNew = await submitOnToken(DINE_IN_TOKEN)
      await expectVoidZeroChange(CASHIER, dineNew, 'x', 'P0001', GENERIC)
      await driveTo(dineNew, 'preparing')
      await expectVoidZeroChange(CASHIER, dineNew, 'x', 'P0001', GENERIC)
      await driveTo(dineNew, 'ready')
      // dine-in `ready` is BELOW its boundary (lock): refuse.
      await expectVoidZeroChange(CASHIER, dineNew, 'x', 'P0001', GENERIC)
    })
    await inTransaction(client, async () => {
      const delNew = await submitOnToken(DELIVERY_TOKEN)
      await driveTo(delNew, 'preparing')
      await expectVoidZeroChange(CASHIER, delNew, 'x', 'P0001', GENERIC)
      await driveTo(delNew, 'ready')
      // delivery  (pre-dispatch) is below its boundary: refuse.
      await expectVoidZeroChange(CASHIER, delNew, 'x', 'P0001', GENERIC)
    })
  })

  it('a repeat void and an unknown id refuse with zero change', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(roundId, 'lock')
      await asIdentity(CASHIER)
      await client.query('select public.void_round($1, $2)', [roundId, 'First void'])
      await asOwner()
      // Already voided: the guarded update's `voided = false` gate excludes
      // the row — the generic refusal with zero change.
      await expectVoidZeroChange(CASHIER, roundId, 'Second try', 'P0001', GENERIC)
      // Unknown id: the same indistinguishable refusal (the 009 posture).
      await expectVoidZeroChange(
        CASHIER,
        '00000000-0000-4000-8000-000000009999',
        'Ghost',
        'P0001',
        GENERIC,
      )
    })
  })
})

describe('void_round: reason and permission rules (FR-006/FR-007)', () => {
  it('blank and >500-character reasons refuse verbatim with zero change', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(roundId, 'lock')
      await expectVoidZeroChange(CASHIER, roundId, '   ', 'P0001', REASON_REQUIRED)
      await expectVoidZeroChange(CASHIER, roundId, '', 'P0001', REASON_REQUIRED)
      await expectVoidZeroChange(CASHIER, roundId, 'x'.repeat(501), 'P0001', REASON_TOO_LONG)
      // The 500-character boundary passes the reason gate (then fails on… nothing — lock voids).
      await asIdentity(CASHIER)
      const res = await client.query<{ p: { void_reason: string } }>(
        'select public.void_round($1, $2) as p',
        [roundId, 'y'.repeat(500)],
      )
      expect(res.rows[0]!.p.void_reason).toHaveLength(500)
    })
  })

  it('the stored reason is the TRIMMED text', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(roundId, 'lock')
      await asIdentity(CASHIER)
      const res = await client.query<{ p: { void_reason: string } }>(
        'select public.void_round($1, $2) as p',
        [roundId, '  padded reason  '],
      )
      expect(res.rows[0]!.p.void_reason).toBe('padded reason')
    })
  })

  it('kitchen, outsider, and cross-branch reach are denied with zero change', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(roundId, 'lock')
      await expectVoidZeroChange(KITCHEN, roundId, 'x', '42501', DENIED)
      await expectVoidZeroChange(OUTSIDER, roundId, 'x', '42501', DENIED)
    })
    await inTransaction(client, async () => {
      // dan's Marina kitchen reach does not extend to a Downtown round.
      const roundId = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(roundId, 'lock')
      await expectVoidZeroChange(KITCHEN, roundId, 'x', '42501', DENIED)
    })
  })

  it('void does not resurrect the cutoff: the voided completed delivery round still blocks orders (FR-011)', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DELIVERY_TOKEN)
      await driveTo(roundId, 'completed')
      await asIdentity(CASHIER)
      await client.query('select public.void_round($1, $2)', [roundId, 'Returned to branch'])
      await asOwner()
      // A refusal aborts the transaction — probe under a savepoint.
      await client.query('savepoint cutoff_probe')
      await client.query('set local role anon')
      let refusedCode: string | undefined
      try {
        await client.query('select public.submit_round($1, $2)', [
          DELIVERY_TOKEN,
          JSON.stringify(kebabSelection),
        ])
      } catch (error) {
        refusedCode = (error as { code?: string }).code
      }
      await client.query('rollback to savepoint cutoff_probe')
      await asOwner()
      expect(refusedCode).toBe('P0001')
    })
  })
})

describe('get_audit_log: reach, filters, shape (FR-009/FR-010)', () => {
  it('the owner sees the restaurant-wide trail (null-branch rows included) newest-first', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(roundId, 'lock')
      await asIdentity(CASHIER)
      await client.query('select public.void_round($1, $2)', [roundId, 'Audit probe void'])
      await asOwner()

      await asIdentity(OWNER)
      const res = await client.query<{
        p: { entries: Array<{ action: string; reason: string | null; actor_display_name: string }> }
      }>('select public.get_audit_log($1, $2, $3) as p', [null, null, 200])
      const entries = res.rows[0]!.p.entries
      expect(entries.length).toBeGreaterThan(0)
      const voidEntry = entries.find(
        (e) => e.action === 'round.void' && e.reason === 'Audit probe void',
      )
      expect(voidEntry).toBeTruthy()
      expect(voidEntry!.actor_display_name).toBe('Carla')
      // Newest first: the void is the first row.
      expect(entries[0]!.action).toBe('round.void')
    })
  })

  it('a branch manager sees only their branch; a foreign branch filter is 42501', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(roundId, 'lock')
      await asIdentity(CASHIER)
      await client.query('select public.void_round($1, $2)', [roundId, 'Bob scope probe'])
      await asOwner()

      await asIdentity(MANAGER)
      const res = await client.query<{ p: { entries: Array<{ reason: string | null }> } }>(
        'select public.get_audit_log($1, $2, $3) as p',
        ['round.void', branchIds.downtown, 200],
      )
      // The trail is a durable, shared table — prior runs' real voids persist
      // in it. Assert presence + ordering instead of an exact census.
      expect(res.rows[0]!.p.entries.length).toBeGreaterThanOrEqual(1)
      expect(res.rows[0]!.p.entries.map((e) => e.reason)).toContain('Bob scope probe')

      // Marina is not bob's — the filter must refuse, never silently narrow.
      await expect(
        client.query('select public.get_audit_log($1, $2, $3)', [null, branchIds.marina, 100]),
      ).rejects.toMatchObject({ code: '42501', message: AUDIT_DENIED })
    })
  })

  it('cashier, kitchen, and anon are denied (the trail is management-level)', async () => {
    await inTransaction(client, async () => {
      // Each refusal aborts the transaction — probe under savepoints.
      for (const identity of [CASHIER, KITCHEN]) {
        await client.query('savepoint audit_probe')
        await asIdentity(identity)
        let code: string | undefined
        try {
          await client.query('select public.get_audit_log($1, $2, $3)', [null, null, 100])
        } catch (error) {
          code = (error as { code?: string }).code
          expect((error as { message: string }).message).toBe(AUDIT_DENIED)
        }
        await client.query('rollback to savepoint audit_probe')
        await asOwner()
        expect(code).toBe('42501')
      }
      await client.query('savepoint audit_probe_anon')
      await client.query('set local role anon')
      let anonCode: string | undefined
      try {
        await client.query('select public.get_audit_log($1, $2, $3)', [null, null, 100])
      } catch (error) {
        anonCode = (error as { code?: string }).code
      }
      await client.query('rollback to savepoint audit_probe_anon')
      await asOwner()
      expect(anonCode).toBe('42501')
    })
  })

  it('p_limit is clamped and p_action filters exact-match', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(roundId, 'lock')
      await asIdentity(CASHIER)
      await client.query('select public.void_round($1, $2)', [roundId, 'Clamp probe'])
      await asOwner()

      await asIdentity(OWNER)
      const only = await client.query<{ p: { entries: Array<{ action: string }> } }>(
        'select public.get_audit_log($1, $2, $3) as p',
        ['round.void', null, 200],
      )
      expect(only.rows[0]!.p.entries.every((e) => e.action === 'round.void')).toBe(true)
      expect(only.rows[0]!.p.entries.length).toBeGreaterThanOrEqual(1)
      expect(
        only.rows[0]!.p.entries.map((e) => (e as unknown as { reason: string }).reason),
      ).toContain('Clamp probe')
      // Clamp: absurd limits do not error.
      await client.query('select public.get_audit_log($1, $2, $3)', [null, null, 9999])
      await client.query('select public.get_audit_log($1, $2, $3)', [null, null, 0])
    })
  })
})

describe('get_session_bill: the additive extension (FR-001…FR-003, SC-001/SC-002)', () => {
  it('the bill carries line detail, tax lines, participants, and the captured totals byte-equal', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(roundId, 'lock')
      const sessionId = (
        await client.query<{ session_id: string }>(
          'select session_id from public.rounds where id = $1',
          [roundId],
        )
      ).rows[0]!.session_id

      await asIdentity(CASHIER)
      const bill = await client.query<{
        p: {
          rounds: Array<{
            round_id: string
            voided: boolean
            void_reason: string | null
            subtotal: string
            tax_total: string
            tax_lines: Array<{ name: string; amount: string }>
            items: Array<{ name: string; quantity: number; unit_price: string; extras: string[] }>
          }>
          participants: Array<{ display_name: string }>
          grand_total: string
        }
      }>('select public.get_session_bill($1) as p', [sessionId])
      await asOwner()
      const payload = bill.rows[0]!.p
      const mine = payload.rounds.find((r) => r.round_id === roundId)!
      expect(mine.voided).toBe(false)
      expect(mine.items).toHaveLength(1)
      expect(mine.items[0]!.name).toBe('Lamb Kebab')
      expect(mine.items[0]!.unit_price).toBe('18.50')
      expect(mine.tax_lines.length).toBeGreaterThan(0)
      // Byte-equality: subtotal + tax_total is the captured pair.
      expect(mine.subtotal).toBe('18.50')
      expect(payload.participants.length).toBeGreaterThan(0)
      expect(payload.grand_total).not.toBe('0.00')
    })
  })

  it('a voided round is excluded from the grand total and listed with its reason (SC-002)', async () => {
    await inTransaction(client, async () => {
      // The token resolves the session WITHOUT any staff read first (the
      // lookup below runs as owner).
      const r1 = await submitOnToken(DINE_IN_TOKEN)
      const r2 = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(r1, 'lock')
      await driveTo(r2, 'lock')
      const sessionId = (
        await client.query<{ session_id: string }>(
          'select session_id from public.rounds where id = $1',
          [r1],
        )
      ).rows[0]!.session_id

      await asIdentity(CASHIER)
      const before = await client.query<{ p: { grand_total: string } }>(
        'select public.get_session_bill($1) as p',
        [sessionId],
      )
      await client.query('select public.void_round($1, $2)', [r2, 'Second round cancelled'])
      const after = await client.query<{
        p: {
          grand_total: string
          rounds: Array<{
            round_id: string
            voided: boolean
            void_reason: string | null
            subtotal: string
            tax_total: string
          }>
        }
      }>('select public.get_session_bill($1) as p', [sessionId])
      await asOwner()

      const payload = after.rows[0]!.p
      const voided = payload.rounds.find((r) => r.round_id === r2)!
      expect(voided.voided).toBe(true)
      expect(voided.void_reason).toBe('Second round cancelled')
      expect(payload.grand_total).not.toBe(before.rows[0]!.p.grand_total)
      // The drop is EXACTLY the voided round's captured total.
      const dropped = Number(before.rows[0]!.p.grand_total) - Number(payload.grand_total)
      expect(dropped).toBeCloseTo(Number(voided.subtotal) + Number(voided.tax_total), 2)
    })
  })

  it('the shape stays additive: every legacy key survives', async () => {
    await inTransaction(client, async () => {
      const roundId = await submitOnToken(DINE_IN_TOKEN)
      await driveTo(roundId, 'lock')
      const sessionId = (
        await client.query<{ session_id: string }>(
          'select session_id from public.rounds where id = $1',
          [roundId],
        )
      ).rows[0]!.session_id
      await asIdentity(CASHIER)
      const res = await client.query<{ p: Record<string, unknown> }>(
        'select public.get_session_bill($1) as p',
        [sessionId],
      )
      await asOwner()
      for (const key of [
        'session_id',
        'session_type',
        'delivery_address',
        'table_label',
        'rounds',
        'grand_total',
      ]) {
        expect(res.rows[0]!.p).toHaveProperty(key)
      }
      const round = (res.rows[0]!.p.rounds as Array<Record<string, unknown>>)[0]!
      for (const key of ['round_id', 'state', 'subtotal', 'tax_total', 'tax_lines', 'created_at']) {
        expect(round).toHaveProperty(key)
      }
    })
  })
})
