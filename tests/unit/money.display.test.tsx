import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MoneyText } from '../../src/components/money/MoneyText'
import { TotalsPanel } from '../../src/components/money/TotalsPanel'
import { roundStateLabel, ROUND_STATE_LABEL } from '../../src/features/order/roundStateLabels'

/**
 * Money-fidelity unit pins (spec 025 T001; checklist/money-fidelity.md):
 * MoneyText is the single money renderer; TotalsPanel's captured rows come
 * from the server payload verbatim (never recomputed); the advisory cart row
 * is always labeled before tax. The customer state vocabulary is exact.
 */
describe('MoneyText', () => {
  it('renders a captured amount strong and formatted to two decimals', () => {
    const html = renderToStaticMarkup(<MoneyText value="21.5" />)
    expect(html).toContain('21.50')
    expect(html).not.toContain('advisory')
  })

  it('renders an advisory amount with the advisory styling class', () => {
    const html = renderToStaticMarkup(<MoneyText value={13} kind="advisory" />)
    expect(html).toContain('13.00')
    expect(html).toContain('advisory')
  })

  it('carries an aria-label when one is provided (chart-free a11y naming)', () => {
    const html = renderToStaticMarkup(<MoneyText value="4.50" aria-label="4 dollars 50" />)
    expect(html).toContain('aria-label="4 dollars 50"')
  })
})

describe('TotalsPanel — captured money (server payload verbatim)', () => {
  it('renders subtotal, each server tax line by name, and the total', () => {
    const html = renderToStaticMarkup(
      <TotalsPanel
        totals={{
          subtotal: '21.50',
          taxLines: [
            { name: 'VAT 8.75%', amount: '1.88' },
            { name: 'Service charge', amount: '2.00' },
          ],
          total: '25.38',
        }}
      />,
    )
    expect(html).toContain('Subtotal')
    expect(html).toContain('21.50')
    expect(html).toContain('VAT 8.75%')
    expect(html).toContain('1.88')
    expect(html).toContain('Service charge')
    expect(html).toContain('Total')
    expect(html).toContain('25.38')
  })

  it('uses the generic tax name when the server line has none', () => {
    const html = renderToStaticMarkup(
      <TotalsPanel totals={{ subtotal: '6.50', taxLines: [{ amount: '0.57' }], total: '7.07' }} />,
    )
    expect(html).toContain('Tax')
    expect(html).toContain('0.57')
  })
})

describe('TotalsPanel — advisory money (the cart estimate)', () => {
  it('labels the advisory row as before tax — never authoritative money', () => {
    const html = renderToStaticMarkup(<TotalsPanel advisoryTotal="34.50" />)
    expect(html).toContain('Total (before tax):')
    expect(html).toContain('34.50')
    expect(html).toContain('advisory')
    expect(html).not.toContain('Subtotal')
  })
})

describe('the customer round-state vocabulary (frozen)', () => {
  it('maps every machine state to the exact customer label', () => {
    expect(ROUND_STATE_LABEL).toEqual({
      new: 'Sent to kitchen',
      accepted: 'Accepted',
      preparing: 'Being prepared',
      ready: 'Ready',
      lock: 'Served',
    })
    expect(roundStateLabel('new')).toBe('Sent to kitchen')
    expect(roundStateLabel('lock')).toBe('Served')
    expect(roundStateLabel('unknown_state')).toBe('unknown_state')
  })
})
