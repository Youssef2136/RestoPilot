import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The staffOps client suite (spec 009 T018; contracts/staff-ops-client.md
 * §3; FR-010, FR-011 client half). No network: the Supabase client is
 * stubbed at the module boundary, so the wrappers' payload discipline is
 * what's under test —
 *
 *  1. an rpc-level error → StaffOpsPayloadError carrying the code,
 *  2. a boolean-error-shaped payload → StaffOpsPayloadError,
 *  3. a clean payload → returned typed.
 *
 * The money-free guarantee (FR-010) is enforced in the parser: a kitchen
 * queue payload carrying ANY money key is rejected, not rendered.
 */

const rpcMock = vi.fn()

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}))

const { getKitchenQueue, getBranchRounds, getSessionBill, acceptRound, StaffOpsPayloadError } =
  await import('../../src/features/staffOps/staffOpsClient')

beforeEach(() => {
  rpcMock.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

const CLEAN_TICKET = [
  {
    ticket_id: '00000000-0000-4000-8000-00000000000a',
    round_id: '00000000-0000-4000-8000-00000000000b',
    state: 'preparing',
    table_label: 'T1',
    created_at: '2026-09-20T10:00:00Z',
    items: [{ name: 'Hummus', quantity: 2, extras: ['Rice'] }],
  },
]

describe('staffOps client: the payload discipline', () => {
  it('maps an rpc-level error to StaffOpsPayloadError with the code', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'You do not have permission to update this round.' },
    })
    await expect(acceptRound('round-1')).rejects.toMatchObject({
      name: 'StaffOpsPayloadError',
      code: '42501',
      message: 'You do not have permission to update this round.',
    })
  })

  it('a null payload from a row-returning RPC is a malformed response (fail closed)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await expect(acceptRound('round-1')).rejects.toBeInstanceOf(StaffOpsPayloadError)
    await expect(getSessionBill('s1')).rejects.toBeInstanceOf(StaffOpsPayloadError)
  })

  it('returns a clean transition payload typed (the happy path)', async () => {
    rpcMock.mockResolvedValue({
      data: {
        round: { id: 'r1', state: 'accepted', items: [], subtotal: '6.50', tax_total: '7.28' },
        ticket_state: 'accepted',
      },
      error: null,
    })
    const result = await acceptRound('round-1')
    expect(result.round.state).toBe('accepted')
    expect(result.ticket_state).toBe('accepted')
  })

  it('a queue payload carrying ANY money key is rejected (FR-010, client half)', async () => {
    for (const poison of ['unit_price', 'subtotal', 'tax_total', 'price', 'grand_total']) {
      rpcMock.mockResolvedValue({
        data: [
          {
            ...CLEAN_TICKET[0]!,
            items: [{ ...CLEAN_TICKET[0]!.items[0], [poison]: '1.00' } as never],
          },
        ],
        error: null,
      })
      await expect(getKitchenQueue('branch-1')).rejects.toThrowError(/money/i)
    }
    // A money key on the ticket itself is equally rejected.
    rpcMock.mockResolvedValue({
      data: [{ ...CLEAN_TICKET[0]!, subtotal: '6.50' }],
      error: null,
    })
    await expect(getKitchenQueue('branch-1')).rejects.toThrowError(/money/i)
  })

  it('a clean money-free queue parses typed; a non-array is fail-closed empty', async () => {
    rpcMock.mockResolvedValue({ data: CLEAN_TICKET, error: null })
    const queue = await getKitchenQueue('branch-1')
    expect(queue).toHaveLength(1)
    expect(queue[0]!.items[0]).toEqual({ name: 'Hummus', quantity: 2, extras: ['Rice'] })

    rpcMock.mockResolvedValue({ data: { unexpected: 'shape' }, error: null })
    expect(await getKitchenQueue('branch-1')).toEqual([])
    expect(await getBranchRounds('branch-1')).toEqual([])
  })

  it('the bill parser returns the payload verbatim (the server owns the arithmetic)', async () => {
    const bill = {
      session_id: 's1',
      table_label: 'T3',
      rounds: [
        {
          round_id: 'r1',
          state: 'lock',
          subtotal: '6.50',
          tax_total: '7.28',
          tax_lines: [],
          created_at: 'x',
        },
      ],
      grand_total: '13.78',
    }
    rpcMock.mockResolvedValue({ data: bill, error: null })
    expect(await getSessionBill('s1')).toEqual(bill)
  })
})
