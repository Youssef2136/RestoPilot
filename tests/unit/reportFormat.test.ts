import { describe, expect, it } from 'vitest'
import {
  barShare,
  CLAMP_PAGE_SIZE,
  comparisonPeriodSentence,
  isClampReached,
} from '../../src/features/reports/reportFormat'

/** Spec 033: presentation helpers — shapes, never arithmetic on money. */

describe('isClampReached', () => {
  it('fires exactly at the full page', () => {
    expect(isClampReached(200)).toBe(true)
    expect(isClampReached(200, 200)).toBe(true)
  })

  it('stays silent below the page size and at zero', () => {
    expect(isClampReached(199)).toBe(false)
    expect(isClampReached(0)).toBe(false)
  })

  it('CLAMP_PAGE_SIZE is the client page size', () => {
    expect(CLAMP_PAGE_SIZE).toBe(200)
  })
})

describe('barShare', () => {
  it('maps the max row to 1 and halves to 0.5', () => {
    expect(barShare(4, 4)).toBe(1)
    expect(barShare(2, 4)).toBe(0.5)
  })

  it('is zero-safe: no bar for empty/all-zero lists or invalid input', () => {
    expect(barShare(0, 0)).toBe(0)
    expect(barShare(3, 0)).toBe(0)
    expect(barShare(3, -1)).toBe(0)
    expect(barShare(Number.NaN, 4)).toBe(0)
    expect(barShare(0, 4)).toBe(0)
  })

  it('clamps above the max to the full width', () => {
    expect(barShare(9, 4)).toBe(1)
  })
})

describe('comparisonPeriodSentence', () => {
  it('states the day/week/month guarantee with the server bounds', () => {
    expect(
      comparisonPeriodSentence('day', '2026-09-19T00:00:00+00:00', '2026-09-20T00:00:00+00:00'),
    ).toBe('Same day for every branch: 2026-09-19 → 2026-09-20')
    expect(
      comparisonPeriodSentence('week', '2026-09-15T00:00:00+00:00', '2026-09-22T00:00:00+00:00'),
    ).toBe('Same week for every branch: 2026-09-15 → 2026-09-22')
    expect(
      comparisonPeriodSentence('month', '2026-09-01T00:00:00+00:00', '2026-10-01T00:00:00+00:00'),
    ).toBe('Same month for every branch: 2026-09-01 → 2026-10-01')
  })
})
