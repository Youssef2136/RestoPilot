import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  Alert,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  MoneyText,
  ProgressBar,
  Skeleton,
  Spinner,
  StateChip,
  StatusPill,
} from '../../../src/components/ui'

/**
 * Feedback/overlay/data contracts (spec 022 FR-09/T012): roles, live regions,
 * verbatim messages, and the money/state vocabulary rendered once.
 */

describe('Feedback contracts (spec 022 T012)', () => {
  it('Alert: danger/warning are assertive (alert); info/success polite (status)', () => {
    expect(renderToStaticMarkup(<Alert severity="danger">x</Alert>)).toContain('role="alert"')
    expect(renderToStaticMarkup(<Alert severity="warning">x</Alert>)).toContain('role="alert"')
    expect(renderToStaticMarkup(<Alert severity="info">x</Alert>)).toContain('role="status"')
    expect(renderToStaticMarkup(<Alert severity="success">x</Alert>)).toContain('role="status"')
  })

  it('Alert renders the verbatim message and a labeled dismiss button', () => {
    const html = renderToStaticMarkup(
      <Alert severity="danger" onDismiss={() => {}} dismissLabel="Dismiss warning">
        The session already has a round out for delivery.
      </Alert>,
    )
    expect(html).toContain('aria-label="Dismiss warning"')
    expect(html).toContain('The session already has a round out for delivery.')
  })

  it('Spinner announces loading via role="status", visually hidden text', () => {
    const html = renderToStaticMarkup(<Spinner label="Loading sessions" />)
    expect(html).toContain('role="status"')
    expect(html).toContain('Loading sessions')
    expect(html).toContain('aria-hidden="true"')
  })

  it('Skeleton is aria-hidden (the loading container announces, not every bone)', () => {
    expect(renderToStaticMarkup(<Skeleton />)).toContain('aria-hidden="true"')
  })

  it('EmptyState carries a real title + guidance (never bare "nothing here")', () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No open sessions" icon="sessions">
        Open sessions appear here as guests start ordering.
      </EmptyState>,
    )
    expect(html).toContain('No open sessions')
    expect(html).toContain('Open sessions appear here')
  })

  it('ErrorState announces via role="alert" and keeps the message verbatim', () => {
    const message = 'get_branch_rounds failed: the branch is out of reach.'
    const html = renderToStaticMarkup(<ErrorState message={message} onRetry={() => {}} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain(message)
    expect(html).toContain('Try again')
  })

  it('ProgressBar exposes valuenow/min/max and a label', () => {
    const html = renderToStaticMarkup(<ProgressBar value={40} max={80} label="Upload" />)
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="40"')
    expect(html).toContain('aria-valuemax="80"')
    expect(html).toContain('aria-label="Upload"')
  })

  it('StatusPill/StateChip render the status vocabulary with text (not color alone)', () => {
    const pill = renderToStaticMarkup(<StatusPill tone="positive">Ready</StatusPill>)
    expect(pill).toContain('>Ready<')
    const chip = renderToStaticMarkup(<StateChip status="out_for_delivery" />)
    expect(chip).toContain('Out for delivery')
    expect(chip).toMatch(/class="[^"]*brand/)
  })
})

describe('Icon contract (spec 022 T012)', () => {
  it('decorative by default (aria-hidden), informative with label', () => {
    expect(renderToStaticMarkup(<Icon name="check" />)).toContain('aria-hidden="true"')
    const labeled = renderToStaticMarkup(<Icon name="check" label="Completed" />)
    expect(labeled).toContain('role="img"')
    expect(labeled).toContain('aria-label="Completed"')
  })
})

describe('Overlay contract (spec 022 T012)', () => {
  it('Dialog renders a named native dialog (hidden until showModal runs)', () => {
    const open = renderToStaticMarkup(
      <Dialog open onClose={() => {}} title="Close session">
        body
      </Dialog>,
    )
    expect(open).toContain('<dialog')
    expect(open).toMatch(/aria-labelledby="/)
    expect(open).toContain('Close session')
    // Static markup cannot run the showModal effect; in the browser the
    // element without the `open` attribute is display:none (invisible to
    // users and to axe). The E2E suite proves the open/close cycle live.
    expect(open).not.toMatch(/<dialog[^>]*\sopen/)
  })
})

describe('Money contract (spec 022 FR-10/T012)', () => {
  it('MoneyText routes through the existing formatter (wrap, never re-implement)', () => {
    const html = renderToStaticMarkup(<MoneyText value="1234.5" />)
    expect(html).toContain('1,234.50')
    expect(html).toMatch(/tabular|money/) // the alignment hook class
  })

  it('MoneyText honors a feature formatter (adjustments read as Free/+x)', () => {
    const html = renderToStaticMarkup(
      <MoneyText value={0} format={(v) => (Number(v) === 0 ? 'Free' : `+${v}`)} />,
    )
    expect(html).toContain('Free')
  })
})
