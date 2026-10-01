import { describe, expect, it } from 'vitest'
import {
  formatTicketAge,
  ticketAgeBand,
  ticketAgeMinutes,
} from '../../src/features/staffOps/ticketAge'

/**
 * The kitchen display's age helpers (specs/030 T004; FR-03, D2): honest
 * granularity, three named bands, null-safety — the board never fabricates
 * precision or an age.
 */

describe('ticketAgeMinutes', () => {
  it('floors whole minutes', () => {
    const now = Date.parse('2026-10-01T12:00:00Z')
    expect(ticketAgeMinutes('2026-10-01T11:57:30Z', now)).toBe(2)
    expect(ticketAgeMinutes('2026-10-01T12:00:00Z', now)).toBe(0)
    expect(ticketAgeMinutes('2026-10-01T11:00:00Z', now)).toBe(60)
  })

  it('clamps future timestamps to zero (a clock skew never invents negative age)', () => {
    const now = Date.parse('2026-10-01T12:00:00Z')
    expect(ticketAgeMinutes('2026-10-01T12:01:00Z', now)).toBe(0)
  })

  it('returns zero for an unusable timestamp (the display renders the — fallback)', () => {
    expect(ticketAgeMinutes('not-a-date', Date.now())).toBe(0)
  })
})

describe('formatTicketAge', () => {
  it('renders minutes under the hour (never seconds)', () => {
    expect(formatTicketAge(0)).toBe('0 min')
    expect(formatTicketAge(3)).toBe('3 min')
    expect(formatTicketAge(59)).toBe('59 min')
  })

  it('renders hours and zero-padded minutes after the hour', () => {
    expect(formatTicketAge(60)).toBe('1 h 00 min')
    expect(formatTicketAge(65)).toBe('1 h 05 min')
    expect(formatTicketAge(125)).toBe('2 h 05 min')
  })

  it('falls back to — for unusable input (never a fabricated age)', () => {
    expect(formatTicketAge(-1)).toBe('—')
    expect(formatTicketAge(Number.NaN)).toBe('—')
  })
})

describe('ticketAgeBand', () => {
  it('maps the three bands at the documented boundaries', () => {
    expect(ticketAgeBand(0)).toBe('fresh')
    expect(ticketAgeBand(4)).toBe('fresh')
    expect(ticketAgeBand(5)).toBe('working')
    expect(ticketAgeBand(14)).toBe('working')
    expect(ticketAgeBand(15)).toBe('late')
    expect(ticketAgeBand(120)).toBe('late')
  })
})
