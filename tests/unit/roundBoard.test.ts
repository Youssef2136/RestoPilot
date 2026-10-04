import { describe, expect, it } from 'vitest'
import {
  groupRoundsByState,
  matchesChannel,
  pickRefusal,
  ROUND_GROUP_ORDER,
  roundGroupKey,
} from '../../src/features/staffOps/roundGroups'

/**
 * The rounds board's pure helpers (specs/029 T004; FR-01 grouping, FR-09
 * refusal routing). The staffops.client payload-discipline suite stays
 * untouched — these tests cover the NEW derivations only.
 */

describe('roundGroupKey', () => {
  it('maps every lifecycle state to its display group', () => {
    expect(roundGroupKey('new')).toBe('new')
    expect(roundGroupKey('accepted')).toBe('in-progress')
    expect(roundGroupKey('preparing')).toBe('in-progress')
    expect(roundGroupKey('ready')).toBe('ready')
    expect(roundGroupKey('out_for_delivery')).toBe('out-for-delivery')
    expect(roundGroupKey('completed')).toBe('delivered')
    expect(roundGroupKey('lock')).toBe('served')
  })

  it('sends unknown states to a group of their own (never dropped)', () => {
    expect(roundGroupKey('some_future_state')).toBe('some_future_state')
  })
})

describe('groupRoundsByState', () => {
  it('returns all six display groups in render order, empty ones included', () => {
    const groups = groupRoundsByState([])
    expect(groups.map((g) => g.key)).toEqual(ROUND_GROUP_ORDER.map((g) => g.key))
    expect(groups.every((g) => g.rounds.length === 0)).toBe(true)
    expect(groups.map((g) => g.label)).toEqual([
      'New orders',
      'In progress',
      'Ready',
      'Out for delivery',
      'Delivered',
      'Served',
    ])
  })

  it('buckets rounds into their groups', () => {
    const rounds = [
      { id: 'r1', state: 'new' },
      { id: 'r2', state: 'preparing' },
      { id: 'r3', state: 'accepted' },
      { id: 'r4', state: 'lock' },
    ]
    const groups = groupRoundsByState(rounds)
    const byKey = new Map(groups.map((g) => [g.key, g.rounds]))
    expect(byKey.get('new')).toEqual([{ id: 'r1', state: 'new' }])
    expect(byKey.get('in-progress')?.map((r) => r.id)).toEqual(['r2', 'r3'])
    expect(byKey.get('served')?.map((r) => r.id)).toEqual(['r4'])
    expect(byKey.get('ready')).toEqual([])
  })

  it('keeps a voided round in its state group (the void is an overlay)', () => {
    const groups = groupRoundsByState([{ id: 'r1', state: 'lock', voided: true }])
    const served = groups.find((g) => g.key === 'served')
    expect(served?.rounds).toHaveLength(1)
    expect(groups.every((g) => g.key !== 'voided')).toBe(true)
  })

  it('appends a group for an unknown state instead of dropping the round', () => {
    const groups = groupRoundsByState([{ id: 'r1', state: 'mystery' }])
    expect(groups.find((g) => g.key === 'mystery')?.rounds).toEqual([
      { id: 'r1', state: 'mystery' },
    ])
  })
})

describe('pickRefusal', () => {
  const attempts = [
    { isError: false, variables: 'round-1', error: null },
    {
      isError: true,
      variables: { roundId: 'round-2', reason: 'x' },
      error: new Error('already void'),
    },
    { isError: true, variables: 'round-3', error: new Error('not in a legal state') },
  ]

  it('matches transition mutations whose variables ARE the round id', () => {
    expect(pickRefusal('round-3', attempts)).toBe('not in a legal state')
  })

  it('matches modify/void mutations whose variables carry roundId', () => {
    expect(pickRefusal('round-2', attempts)).toBe('already void')
  })

  it('returns null for a round with no failed attempt', () => {
    expect(pickRefusal('round-1', attempts)).toBeNull()
    expect(pickRefusal('round-9', attempts)).toBeNull()
  })

  it('falls back to the generic refusal for a non-Error failure', () => {
    expect(
      pickRefusal('round-2', [{ isError: true, variables: { roundId: 'round-2' }, error: 'boom' }]),
    ).toBe('The action was refused.')
  })

  it('prefers the FIRST errored attempt when several name the round', () => {
    expect(
      pickRefusal('round-1', [
        { isError: true, variables: 'round-1', error: new Error('first') },
        { isError: true, variables: 'round-1', error: new Error('second') },
      ]),
    ).toBe('first')
  })
})

describe('matchesChannel (specs/031 FR-05, D2)', () => {
  const round = (sessionType: string) => ({ session_type: sessionType })

  it('keeps every round under the default (the frozen board)', () => {
    expect(matchesChannel(round('dine-in'), 'all')).toBe(true)
    expect(matchesChannel(round('delivery'), 'all')).toBe(true)
    expect(matchesChannel(round('takeaway'), 'all')).toBe(true)
  })

  it('narrows to the named channel only', () => {
    expect(matchesChannel(round('delivery'), 'delivery')).toBe(true)
    expect(matchesChannel(round('dine-in'), 'delivery')).toBe(false)
    expect(matchesChannel(round('takeaway'), 'takeaway')).toBe(true)
    expect(matchesChannel(round('delivery'), 'dine-in')).toBe(false)
  })

  it('never silently widens on an unknown channel value', () => {
    expect(matchesChannel(round('delivery'), 'mystery' as never)).toBe(false)
  })
})
