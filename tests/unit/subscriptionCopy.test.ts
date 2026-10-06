/*
 * Phase 12 — the subscription copy map's unit suite (specs/032 FR-05, T003;
 * checklists/realtime-fidelity.md F5). The map is the owner-facing truth
 * for the two Master-Plan-mandated statements: expiry does NOT stop
 * ordering, and renewal is the PLATFORM's action. The silent states must
 * stay silent (no banner, no panel).
 */

import { describe, expect, it } from 'vitest'
import { stateLabel, subscriptionCopy } from '../../src/features/platform/subscriptionCopy'

describe('the subscription copy map (FR-05)', () => {
  it('keeps active and never_activated silent — no noise', () => {
    expect(subscriptionCopy('active').silent).toBe(true)
    expect(subscriptionCopy('never_activated').silent).toBe(true)
  })

  it('renders nearing_expiration and expired non-silently', () => {
    expect(subscriptionCopy('nearing_expiration').silent).toBe(false)
    expect(subscriptionCopy('expired').silent).toBe(false)
  })

  it('carries the expiry truth for every non-silent state', () => {
    for (const state of ['nearing_expiration', 'expired'] as const) {
      expect(subscriptionCopy(state).detail).toContain(
        'Ordering is not affected by expiry — customers keep ordering.',
      )
    }
  })

  it('states the truthful actor: the platform owner acts, not the restaurant', () => {
    for (const state of ['nearing_expiration', 'expired'] as const) {
      expect(subscriptionCopy(state).detail).toContain(
        'Renewal is arranged with the platform: the platform owner acts here, not your restaurant.',
      )
    }
  })

  it('labels every state with the vocabulary', () => {
    expect(subscriptionCopy('never_activated').label).toBe('Not activated yet')
    expect(subscriptionCopy('active').label).toBe('Active')
    expect(subscriptionCopy('nearing_expiration').label).toBe('Nearing expiration')
    expect(subscriptionCopy('expired').label).toBe('Expired')
  })
})

describe('stateLabel — the console’s shared vocabulary (spec 034 D1)', () => {
  it('routes every state through the ONE owner-facing map', () => {
    for (const state of ['never_activated', 'active', 'nearing_expiration', 'expired'] as const) {
      expect(stateLabel(state)).toBe(subscriptionCopy(state).label)
    }
  })

  it('keeps the migrated console label: never_activated reads “Not activated yet”', () => {
    // D1 migrated the console's local 'Never activated' to this map's
    // label — the paired platform.surfaces pins moved in the same commit
    // (docs/frontend-presentation-contracts.md §Phase 034 record).
    expect(stateLabel('never_activated')).toBe('Not activated yet')
  })
})
