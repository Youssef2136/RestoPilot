/*
 * Phase 12 — the announcement policy's unit suite (specs/032 FR-07, T001;
 * checklists/realtime-fidelity.md F3/F4). The policy is the ONE place the
 * product's passive-announcement decisions live: these tests pin the map
 * (class → surface/politeness/copy), the toast exclusion (D2), the dedupe
 * guard (one event ⇒ one announcement), and the copy PARITY with the
 * strings the E2E suites pin — moving a string here without byte-identity
 * would break a frozen pin, so the parity is asserted here explicitly.
 */

import { describe, expect, it } from 'vitest'
import {
  announce,
  BOARD_RECONNECTING_COPY,
  CUE_ARRIVED_COPY,
  RECOVERED_COPY,
  resetAnnouncements,
  RETRY_NOW_COPY,
  SHELL_OFFLINE_COPY,
  SHELL_RECONNECTING_COPY,
  STALE_RETRY_COPY,
  shouldAnnounce,
} from '../../src/features/realtime/announcementPolicy'

describe('the announcement policy map (FR-07)', () => {
  it('sends round arrivals to the cue live region with the pinned line', () => {
    const d = announce('round-arrival')
    expect(d.surface).toBe('cue-live-region')
    expect(d.politeness).toBe('polite')
    expect(d.copy).toBe(CUE_ARRIVED_COPY)
    expect(d.copy).toBe('A new order arrived.')
  })

  it('sends connection loss and recovery to the connection banner, politely', () => {
    const loss = announce('connection-loss')
    expect(loss.surface).toBe('connection-banner')
    expect(loss.politeness).toBe('polite')
    expect(loss.copy).toBe(SHELL_RECONNECTING_COPY)

    const recovered = announce('connection-recovered')
    expect(recovered.surface).toBe('connection-banner')
    expect(recovered.copy).toBe(RECOVERED_COPY)
    expect(recovered.copy).toBe('Back online — live updates restored.')
  })

  it('keeps refetches silent — the refetched read IS the announcement', () => {
    const d = announce('refetch')
    expect(d.surface).toBe('silent')
    expect(d.politeness).toBe('none')
    expect(d.copy).toBe('')
  })

  it('never routes a passive event to the toast host (D2)', () => {
    for (const cls of [
      'round-arrival',
      'connection-loss',
      'connection-recovered',
      'refetch',
      'subscription-state',
    ] as const) {
      expect(announce(cls).surface).not.toBe('toast')
    }
  })
})

describe('the copy parity with the suites' + ' pinned strings (F3)', () => {
  it('carries every pinned string byte-identically', () => {
    expect(CUE_ARRIVED_COPY).toBe('A new order arrived.')
    expect(BOARD_RECONNECTING_COPY).toBe(
      'The live connection dropped — reconnecting. Showing the last known board.',
    )
    expect(SHELL_RECONNECTING_COPY).toBe('Reconnecting to live updates…')
    expect(SHELL_OFFLINE_COPY).toBe("You're offline — changes can't reach the server right now.")
    expect(RECOVERED_COPY).toBe('Back online — live updates restored.')
    expect(STALE_RETRY_COPY).toBe('The last refresh failed — showing the last known board.')
    expect(RETRY_NOW_COPY).toBe('Retry now')
  })
})

describe('the dedupe guard (F4: one event, one announcement)', () => {
  it('suppresses a same-key repeat inside the window and allows it after', () => {
    resetAnnouncements()
    const t0 = 1_000_000
    expect(shouldAnnounce('cue:round-1', t0)).toBe(true)
    expect(shouldAnnounce('cue:round-1', t0 + 500)).toBe(false)
    expect(shouldAnnounce('cue:round-1', t0 + 1_000)).toBe(true)
  })

  it('keys independently — a different key announces immediately', () => {
    resetAnnouncements()
    const t0 = 2_000_000
    expect(shouldAnnounce('cue:round-1', t0)).toBe(true)
    expect(shouldAnnounce('cue:round-2', t0)).toBe(true)
  })

  it('announce() collapses a duplicate key to silence, not a second surface', () => {
    resetAnnouncements()
    const t0 = 3_000_000
    const first = announce('connection-recovered', 'shell-recovery', t0)
    expect(first.copy).toBe(RECOVERED_COPY)
    const duplicate = announce('connection-recovered', 'shell-recovery', t0 + 200)
    expect(duplicate.surface).toBe('silent')
    expect(duplicate.politeness).toBe('none')
    expect(duplicate.copy).toBe('')
  })

  it('announce() without a dedupe key never collapses (stateless callers)', () => {
    resetAnnouncements()
    expect(announce('round-arrival').copy).toBe(CUE_ARRIVED_COPY)
    expect(announce('round-arrival').copy).toBe(CUE_ARRIVED_COPY)
  })
})
