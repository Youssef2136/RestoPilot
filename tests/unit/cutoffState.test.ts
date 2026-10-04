import { describe, expect, it } from 'vitest'
import {
  cutoffCrossed,
  milestoneFor,
  timelineMilestones,
} from '../../src/features/order/cutoffState'

/**
 * The customer cutoff + timeline derivations (specs/031 T001; D1/D4, F3/F4/
 * F9): the presentation mirror of the server's `submit_round` cutoff rule
 * (specs/010 §3) and the channel status story (FR-07). Node env, house
 * method — pure functions, no DOM.
 */

describe('cutoffCrossed', () => {
  it('delivery: closes only on out_for_delivery/completed', () => {
    expect(cutoffCrossed('delivery', [{ state: 'new' }])).toBe(false)
    expect(cutoffCrossed('delivery', [{ state: 'accepted' }])).toBe(false)
    expect(cutoffCrossed('delivery', [{ state: 'preparing' }])).toBe(false)
    expect(cutoffCrossed('delivery', [{ state: 'ready' }])).toBe(false)
    expect(cutoffCrossed('delivery', [{ state: 'out_for_delivery' }])).toBe(true)
    expect(cutoffCrossed('delivery', [{ state: 'completed' }])).toBe(true)
  })

  it('takeaway: closes on ready/lock (the handover states)', () => {
    expect(cutoffCrossed('takeaway', [{ state: 'preparing' }])).toBe(false)
    expect(cutoffCrossed('takeaway', [{ state: 'ready' }])).toBe(true)
    expect(cutoffCrossed('takeaway', [{ state: 'lock' }])).toBe(true)
  })

  it('dine-in never closes', () => {
    expect(cutoffCrossed('dine-in', [{ state: 'out_for_delivery' }])).toBe(false)
    expect(cutoffCrossed('dine-in', [{ state: 'lock' }])).toBe(false)
    expect(cutoffCrossed('dine-in', [{ state: 'completed' }])).toBe(false)
  })

  it('a voided round counts — the server reads every round, void included (F4 parity)', () => {
    expect(cutoffCrossed('delivery', [{ state: 'out_for_delivery', voided: true }])).toBe(true)
    expect(cutoffCrossed('takeaway', [{ state: 'ready', voided: true }])).toBe(true)
  })

  it('any single closing round closes the whole session (the server rule)', () => {
    expect(
      cutoffCrossed('delivery', [
        { state: 'lock' },
        { state: 'preparing' },
        { state: 'out_for_delivery' },
      ]),
    ).toBe(true)
    expect(
      cutoffCrossed('takeaway', [{ state: 'new' }, { state: 'accepted' }, { state: 'ready' }]),
    ).toBe(true)
  })

  it('an empty history is open', () => {
    expect(cutoffCrossed('delivery', [])).toBe(false)
    expect(cutoffCrossed('takeaway', [])).toBe(false)
  })
})

describe('timelineMilestones', () => {
  it('delivery tells the dispatched/delivered story (FR-07)', () => {
    expect(timelineMilestones('delivery')?.map((m) => m.label)).toEqual([
      'Sent to kitchen',
      'In the kitchen',
      'On its way',
      'Delivered',
    ])
  })

  it('takeaway tells the pickup story with the ready milestone (D4)', () => {
    expect(timelineMilestones('takeaway')?.map((m) => m.label)).toEqual([
      'Sent to kitchen',
      'In the kitchen',
      'Ready for pickup',
      'Picked up',
    ])
  })

  it('dine-in has no timeline (the frozen chip vocabulary stands)', () => {
    expect(timelineMilestones('dine-in')).toBeNull()
  })
})

describe('milestoneFor', () => {
  it('maps every lifecycle state onto its channel milestone', () => {
    expect(milestoneFor('delivery', 'new')?.key).toBe('placed')
    expect(milestoneFor('delivery', 'preparing')?.key).toBe('kitchen')
    expect(milestoneFor('delivery', 'out_for_delivery')?.key).toBe('way')
    expect(milestoneFor('delivery', 'completed')?.key).toBe('done')
    expect(milestoneFor('takeaway', 'ready')?.key).toBe('pickup')
    expect(milestoneFor('takeaway', 'lock')?.key).toBe('done')
  })

  it('unknown, voided, and dine-in states fall back to null (F9)', () => {
    expect(milestoneFor('delivery', 'some_future_state')).toBeNull()
    expect(milestoneFor('takeaway', 'out_for_delivery')).toBeNull()
    expect(milestoneFor('delivery', 'out_for_delivery', true)).toBeNull()
    expect(milestoneFor('dine-in', 'ready')).toBeNull()
  })
})
