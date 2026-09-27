import { expect, type Page } from '@playwright/test'

/**
 * The console-cleanliness assertion helper (spec 021 FR-08 / US4; Master Plan
 * gate F-G14): no unexpected console errors, unhandled rejections, or failed
 * requests on route changes. Expected events are NOT silently ignored — they
 * are listed here with a justification and kept minimal.
 */

export type ConsoleEvent = {
  kind: 'console' | 'pageerror' | 'requestfailed'
  text: string
  location: string
}

/**
 * Expected-event patterns (explicit list, F-G14 semantics). Each entry is a
 * predicate over the event text with a written justification. Empty by
 * default: business refusals render as role="alert" text (not console
 * errors), and the boundary's own log is the entry below.
 */ const EXPECTED_PATTERNS: { pattern: RegExp; justification: string }[] = [
  {
    // The ErrorBoundary's one log when an error is intentionally triggered
    // (gallery.error trigger); the boundary view itself is the recovery UX.
    pattern: /Unhandled render error caught by ErrorBoundary/,
    justification:
      'spec 021 FR-03: the boundary logs the caught error once (the report); no internal message is rendered',
  },
  {
    // The public entry read for the demo slug the fixture data does not
    // contain (routes.test.ts asserts the refusal view's heading). The RPC
    // refuses with HTTP 400 and the page renders its refusal state — the
    // F-G14 expected business refusal: identified, never silently ignored.
    pattern: /rest\/v1\/rpc\/get_public_restaurant/,
    justification:
      'spec 021 FR-08: expected business refusal — the demo-slug entry probe targets a non-seeded restaurant; the entry page renders the refusal state',
  },
]

/**
 * Vite dev-server ambient noise (never present in production builds):
 * HMR websocket chatter and dev-messenger messages are infrastructure, not
 * application errors.
 */
const VITE_DEV_NOISE = /\[vite\]|hmr|hmrUpdate|websocket connection/i

export class ConsoleCollector {
  private events: ConsoleEvent[] = []
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** Attach listeners; call before navigating. */
  attach() {
    this.page.on('console', (message) => {
      if (message.type() !== 'error') return
      this.events.push({
        kind: 'console',
        text: message.text(),
        location: message.location().url,
      })
    })
    this.page.on('pageerror', (error) => {
      this.events.push({ kind: 'pageerror', text: error.message, location: this.page.url() })
    })
    this.page.on('requestfailed', (request) => {
      this.events.push({
        kind: 'requestfailed',
        text: `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`,
        location: this.page.url(),
      })
    })
  }

  /**
   * Assert cleanliness so far: every recorded event must be an explicitly
   * expected pattern (F-G14) or Vite dev noise (never shipped to production).
   */
  assertClean(context: string) {
    const unexpected = this.events.filter((event) => {
      // Patterns match against the message text AND its location: browser
      // resource errors carry a generic text ("Failed to load resource…")
      // while the failing URL is the event's location.
      const haystack = `${event.text} ${event.location}`
      if (VITE_DEV_NOISE.test(haystack)) return false
      return !EXPECTED_PATTERNS.some((e) => e.pattern.test(haystack))
    })
    const detail = unexpected.map((e) => `[${e.kind}] ${e.text} (${e.location})`).join('\n  ')
    expect(
      unexpected,
      `Unexpected console errors / page errors / failed requests during ${context}:\n  ${detail}`,
    ).toEqual([])
    this.events = []
  }
}
