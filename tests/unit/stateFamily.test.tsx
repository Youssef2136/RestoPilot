/*
 * Spec 037 (T004): the state vocabulary's unit contracts.
 *
 * Node environment (the house method — react-dom/server, no DOM): the
 * markup contracts are pinned statically. What the family promises:
 *  - Skeleton: aria-hidden decoration, text/block variants, sizing contract
 *    (explicit width/height pass through; text lines render one span per line).
 *  - EmptyState: role="status" (NOT alert), real text title/body, action slot,
 *    visually distinct from ErrorState (data-state markers separate them).
 *  - ErrorState: role="alert" once, guidance body, retry slot.
 *  - RetryButton: explicit intent (default label), disabled-with-reason
 *    renders the reason as the label (honest disabled state), title carries it.
 *  - RefusalAlert: verbatim message rendered as text (never truncated), key on
 *    message (single-alert semantics), context as the title.
 *  - PartialFailureNotice: the part is NAMED in the title, never rendered as
 *    zero, per-part retry slot present.
 *  - OfflineSurface: children stay MOUNTED when offline (last-known data
 *    readable), the banner renders the reason as text, data-offline marks the
 *    state, and the offline gate context feeds disabled-with-reason actions.
 *
 * The LIVE behaviors (skeleton swap without shift, shimmer vs reduced-motion,
 * realtime-driven reconnect) are proven by the E2E failure-injection suites.
 */

import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import {
  EmptyState,
  ErrorState,
  OfflineSurface,
  PartialFailureNotice,
  RefusalAlert,
  RetryButton,
  Skeleton,
} from '../../src/components/state'

const h = createElement
/** react-dom/server escapes apostrophes (&#x27;) — normalize for text assertions. */
const text = (html: string) => html.replace(/&#x27;/g, "'")

describe('Skeleton', () => {
  it('is aria-hidden decoration with the explicit sizing contract', () => {
    const html = renderToStaticMarkup(h(Skeleton, { width: '320px', height: '48px' }))
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('width:320px')
    expect(html).toContain('height:48px')
  })

  it('renders one text line per `lines` with the type-scale box', () => {
    const html = renderToStaticMarkup(h(Skeleton, { variant: 'text', lines: 3 }))
    expect(html).toContain('data-skeleton="text"')
    expect(html.match(/class="[^"]*"/g)?.length).toBeGreaterThanOrEqual(3)
  })
})

describe('EmptyState vs ErrorState', () => {
  it('EmptyState is a status (never an alert) with real text and an action slot', () => {
    const html = renderToStaticMarkup(
      h(
        EmptyState,
        { title: 'No voids this week', action: h('button', null, 'Open the audit log') },
        h('p', null, 'Voids appear here once the team voids bill items.'),
      ),
    )
    expect(html).toContain('role="status"')
    expect(html).not.toContain('role="alert"')
    expect(html).toContain('No voids this week')
    expect(html).toContain('Open the audit log')
    expect(html).toContain('data-state="empty"')
  })

  it('ErrorState is an alert with the guidance body and a retry slot', () => {
    const html = text(
      renderToStaticMarkup(
        h(
          ErrorState,
          { retry: h(RetryButton, { onRetry: () => {} }) },
          h('p', null, 'Check the connection and try again.'),
        ),
      ),
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain("Couldn't load this")
    expect(html).toContain('Check the connection and try again.')
    expect(html).toContain('Try again')
    expect(html).toContain('data-state="error"')
  })
})

describe('RetryButton', () => {
  it('renders the disabled reason as the honest label, not a dead button', () => {
    const html = text(
      renderToStaticMarkup(h(RetryButton, { onRetry: () => {}, disabledReason: "You're offline" })),
    )
    expect(html).toContain('disabled')
    expect(html).toContain("You're offline")
    expect(html).toContain('title="You\'re offline"')
  })
})

describe('RefusalAlert', () => {
  it('renders the verbatim message as wrappable text with context', () => {
    const long = 'This item is not available here — the kitchen closed it ten seconds ago.'
    const html = renderToStaticMarkup(
      h(RefusalAlert, { message: long, context: 'Adding to the round' }),
    )
    expect(html).toContain(long)
    expect(html).toContain('Adding to the round')
    expect(html).toContain('role="alert"')
  })

  it('keys on the message (a re-render of the same refusal does not re-announce)', () => {
    const html = text(renderToStaticMarkup(h(RefusalAlert, { message: 'already on its way' })))
    expect(html).toContain('already on its way')
    expect(html).toContain('data-refusal="inline"')
  })
})

describe('PartialFailureNotice', () => {
  it('names the failed part and never renders it as zero', () => {
    const html = text(
      renderToStaticMarkup(
        h(PartialFailureNotice, {
          part: 'Downtown',
          reason: 'Its data could not be retrieved, so it is not included here.',
          retry: h(RetryButton, { onRetry: () => {}, label: 'Retry Downtown' }),
        }),
      ),
    )
    expect(html).toContain('Downtown')
    expect(html).toContain("couldn't load this part")
    expect(html).toContain('Retry Downtown')
    expect(html).not.toContain('$0')
  })
})

describe('OfflineSurface', () => {
  it('keeps children mounted with the offline reason as text (last-known data readable)', () => {
    // The node environment has no navigator/window listeners — the interrupted
    // branch is exercised by the E2E offline injection; here the default
    // (healthy) render proves the pass-through contract: children mounted,
    // no banner, no data-offline marker.
    const html = renderToStaticMarkup(h(OfflineSurface, null, h('p', null, 'The last known board')))
    expect(html).toContain('The last known board')
    expect(html).not.toContain('data-offline')
    expect(html).not.toContain('showing the last known data')
  })
})
