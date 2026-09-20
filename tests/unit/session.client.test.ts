import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Minimal in-memory `localStorage` (the node environment has none). The
 * client uses only `getItem`/`setItem`/`removeItem`, so the shim mirrors
 * exactly that surface — no DOM environment needed in the unit suite.
 */
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => void store.clear(),
})

/**
 * Session client unit suite (spec 007 T013; contracts/session-client.md §1–§2;
 * FR-004, FR-011, FR-013, FR-014).
 *
 * One seam, mocked: `getSupabaseClient` for the RPC round trips — each
 * wrapper's call is captured verbatim (RPC name, contract parameter names).
 * The token storage rules are asserted directly against `localStorage`:
 * written only on entry success, read for customer reads, cleared on a
 * refused recovery, never touched by staff calls. Payload parsing is
 * asserted through malformed-payload rejections (SessionPayloadError ⇒
 * retry) and typed success shapes.
 */

const harness = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: harness.rpc }),
}))

import {
  SESSION_DENIED_MESSAGE,
  SESSION_RETRY_MESSAGE,
  SESSION_TOKEN_KEY,
  SESSION_UNAVAILABLE_MESSAGE,
  clearSessionToken,
  closeSession,
  enterSession,
  getBranchOpenSessions,
  getPublicRestaurant,
  getContext,
  getMenu,
  mapSessionError,
  parseEntry,
  parsePublicRestaurant,
  parseSessionContext,
  readSessionToken,
  storeSessionToken,
} from '../../src/features/session/sessionClient'

const OK = (data: unknown) => ({ data, error: null })

beforeEach(() => {
  harness.rpc.mockReset()
  localStorage.clear()
})

function recordedCall(): [string, Record<string, unknown>] {
  const calls = harness.rpc.mock.calls
  expect(calls).toHaveLength(1)
  return calls[0] as [string, Record<string, unknown>]
}

const PUBLIC_PAYLOAD = {
  restaurant: { id: 'r1', name: 'Blue Olive', slug: 'blue-olive', brand_description: null },
  branches: [
    {
      id: 'b1',
      name: 'Downtown',
      tables: [
        { id: 't1', label: 'T1' },
        { id: 't2', label: 'T2' },
      ],
    },
  ],
}

const ENTRY_PAYLOAD = {
  session: {
    id: 's1',
    restaurant_id: 'r1',
    branch_id: 'b1',
    table_id: 't1',
    type: 'dine-in',
    status: 'open',
    opened_at: '2026-09-19T12:00:00Z',
  },
  token: 'tok_abc',
  participant: { id: 'p1', display_name: 'Sara', joined_at: '2026-09-19T12:00:01Z' },
}

describe('error mapping (contract §1)', () => {
  it('maps 42501 to the generic denial, P0001 verbatim, anything else to retry', () => {
    expect(mapSessionError({ code: '42501', message: 'You do not have permission' })).toEqual({
      kind: 'denied',
      message: SESSION_DENIED_MESSAGE,
    })
    expect(mapSessionError({ code: 'P0001', message: 'A display name is required.' })).toEqual({
      kind: 'validation',
      message: 'A display name is required.',
    })
    expect(mapSessionError({ code: 'XX999', message: 'weird' })).toEqual({
      kind: 'retry',
      message: SESSION_RETRY_MESSAGE,
    })
  })
})

describe('payload parsing', () => {
  it('parsePublicRestaurant types the payload and rejects malformed shapes', () => {
    expect(parsePublicRestaurant(PUBLIC_PAYLOAD).branches[0]!.tables).toHaveLength(2)
    expect(() => parsePublicRestaurant({ restaurant: { id: 'r1' }, branches: [] })).toThrow()
    expect(() => parsePublicRestaurant({ restaurant: {}, branches: [] })).toThrow()
  })

  it('parseEntry requires session, token and participant', () => {
    expect(parseEntry(ENTRY_PAYLOAD).token).toBe('tok_abc')
    expect(() => parseEntry({ session: {}, token: 't', participant: {} })).toThrow()
  })

  it('parseSessionContext requires the indicator trio', () => {
    const ctx = {
      session: ENTRY_PAYLOAD.session,
      indicator: {
        restaurant_name: 'Blue Olive',
        branch_name: 'Downtown',
        table_label: 'T1',
      },
      participants: [ENTRY_PAYLOAD.participant],
    }
    expect(parseSessionContext(ctx).indicator.table_label).toBe('T1')
    expect(() => parseSessionContext({ ...ctx, indicator: {} })).toThrow()
  })
})

describe('getPublicRestaurant', () => {
  it('calls the RPC by name and returns the parsed payload', async () => {
    harness.rpc.mockResolvedValueOnce(OK(PUBLIC_PAYLOAD))
    const result = await getPublicRestaurant('blue-olive')
    expect(result.ok).toBe(true)
    const [name, args] = recordedCall()
    expect(name).toBe('get_public_restaurant')
    expect(args).toEqual({ p_slug: 'blue-olive' })
  })

  it('surfaces the server validation message verbatim', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Restaurant not found.' },
    })
    const result = await getPublicRestaurant('nope')
    expect(result).toEqual({ ok: false, kind: 'validation', message: 'Restaurant not found.' })
  })

  it('a malformed payload becomes the retry kind', async () => {
    harness.rpc.mockResolvedValueOnce(OK({ unexpected: true }))
    const result = await getPublicRestaurant('blue-olive')
    expect(result).toEqual({ ok: false, kind: 'retry', message: SESSION_RETRY_MESSAGE })
  })
})

describe('enterSession and the token storage rules (contract §2)', () => {
  it('stores the token only on success and never touches storage on failure', async () => {
    harness.rpc.mockResolvedValueOnce(OK(ENTRY_PAYLOAD))
    const result = await enterSession({
      restaurantId: 'r1',
      branchId: 'b1',
      tableId: 't1',
      displayName: 'Sara',
      phone: '+15550101',
    })
    expect(result.ok).toBe(true)
    const [name, args] = recordedCall()
    expect(name).toBe('open_session_at_table')
    expect(args).toEqual({
      p_restaurant_id: 'r1',
      p_branch_id: 'b1',
      p_table_id: 't1',
      p_display_name: 'Sara',
      p_phone: '+15550101',
    })
    expect(readSessionToken()).toBe('tok_abc')
    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBe('tok_abc')
  })

  it('a failed entry writes nothing to storage', async () => {
    harness.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Table not found.' },
    })
    const result = await enterSession({
      restaurantId: 'r1',
      branchId: 'b1',
      tableId: 'bad',
      displayName: 'Sara',
      phone: '+15550101',
    })
    expect(result.ok).toBe(false)
    expect(readSessionToken()).toBeNull()
  })
})

describe('customer reads: token use and the refused-recovery clear (FR-013/FR-014)', () => {
  it('with no stored token, customer reads refuse locally without an RPC', async () => {
    const ctx = await getContext()
    const menu = await getMenu()
    expect(ctx).toEqual({ ok: false, kind: 'validation', message: SESSION_UNAVAILABLE_MESSAGE })
    expect(menu).toEqual({ ok: false, kind: 'validation', message: SESSION_UNAVAILABLE_MESSAGE })
    expect(harness.rpc).not.toHaveBeenCalled()
  })

  it('a valid token is sent as the p_token argument and the payload is parsed', async () => {
    storeSessionToken('tok_abc')
    harness.rpc.mockResolvedValueOnce(
      OK({
        session: ENTRY_PAYLOAD.session,
        indicator: {
          restaurant_name: 'Blue Olive',
          branch_name: 'Downtown',
          table_label: 'T1',
        },
        participants: [ENTRY_PAYLOAD.participant],
      }),
    )
    const result = await getContext()
    expect(result.ok).toBe(true)
    const [name, args] = recordedCall()
    expect(name).toBe('get_session_context')
    expect(args).toEqual({ p_token: 'tok_abc' })
  })

  it('the single unavailable refusal clears the stored token', async () => {
    storeSessionToken('tok_stale')
    harness.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: SESSION_UNAVAILABLE_MESSAGE },
    })
    const ctx = await getContext()
    expect(ctx.ok).toBe(false)
    expect(readSessionToken()).toBeNull()
  })

  it('other validation refusals do NOT clear the token', async () => {
    storeSessionToken('tok_abc')
    harness.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Something else.' },
    })
    await getMenu()
    expect(readSessionToken()).toBe('tok_abc')
  })

  it('a refused menu recovery clears the token and the next read refuses locally (FR-013/FR-014)', async () => {
    storeSessionToken('tok_stale')
    harness.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: SESSION_UNAVAILABLE_MESSAGE },
    })
    const refused = await getMenu()
    expect(refused.ok).toBe(false)
    expect(readSessionToken()).toBeNull()

    // The cleared device: the next read refuses locally — no RPC, no retry
    // loop — exactly the state the entry route expects.
    harness.rpc.mockClear()
    const after = await getContext()
    expect(after).toEqual({ ok: false, kind: 'validation', message: SESSION_UNAVAILABLE_MESSAGE })
    expect(harness.rpc).not.toHaveBeenCalled()
  })
})

describe('staff wrappers never touch the token', () => {
  it('getBranchOpenSessions and closeSession perform their RPCs without storage writes', async () => {
    harness.rpc.mockResolvedValueOnce(OK({ sessions: [] }))
    const list = await getBranchOpenSessions('b1')
    expect(list.ok).toBe(true)
    expect(recordedCall()).toEqual(['get_branch_open_sessions', { p_branch_id: 'b1' }])

    harness.rpc.mockReset()
    harness.rpc.mockResolvedValueOnce(OK({ closed: true, closed_at: '2026-09-19T13:00:00Z' }))
    const close = await closeSession('s1')
    expect(close.ok).toBe(true)
    expect(recordedCall()).toEqual(['close_session', { p_session_id: 's1' }])
    expect(readSessionToken()).toBeNull()
  })
})

describe('token helpers', () => {
  it('store, read and clear round-trip through the documented key', () => {
    expect(readSessionToken()).toBeNull()
    storeSessionToken('abc')
    expect(readSessionToken()).toBe('abc')
    clearSessionToken()
    expect(readSessionToken()).toBeNull()
    expect(localStorage.getItem(SESSION_TOKEN_KEY)).toBeNull()
  })
})
