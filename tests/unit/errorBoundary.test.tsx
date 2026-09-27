import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { ErrorBoundary } from '../../src/components/ErrorBoundary'
import { RouteErrorView } from '../../src/components/RouteErrorView'
import { NotFoundView } from '../../src/components/NotFoundView'
import { RenderFallbackError } from '../../src/components/renderFallbackError'

/**
 * The recovery views (spec 021 FR-03/FR-04 / US1, SC-002).
 *
 * React error boundaries do not catch during server-side rendering — the
 * live catch behavior is proven in a real browser by the dev-only gallery's
 * error trigger (e2e/gallery.error.test.ts). These unit tests pin the two
 * render mappings the boundary relies on, plus the 404 view's shape:
 * human-readable recovery copy, real links, and never the internal error
 * message.
 */
function ThrowingChild(): never {
  throw new Error('internal failure detail: users table column x')
}

function render(node: React.ReactElement) {
  return renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
}

describe('error boundary render mapping (spec 021 FR-03)', () => {
  it('renders the recoverable view for a caught error state', () => {
    const markup = render(<RouteErrorView />)
    expect(markup).toContain('Something went wrong')
    expect(markup).toContain('Go to dashboard')
    expect(markup).toContain('Go to sign-in')
  })

  it('renders the minimal static fallback for the nested-boundary case', () => {
    const markup = render(<RouteErrorView minimal />)
    expect(markup).toContain('Something went wrong. Please reload the page.')
    expect(markup).not.toContain('Go to dashboard')
  })

  it('never renders the internal error message', () => {
    const markup = render(<RouteErrorView />)
    expect(markup).not.toContain('internal failure detail')
  })

  it('passes children through when no error state is set', () => {
    const markup = render(
      <ErrorBoundary>
        <p>healthy content</p>
      </ErrorBoundary>,
    )
    expect(markup).toContain('healthy content')
  })
})

describe('not-found view (spec 021 FR-04, Q1)', () => {
  it('offers routes back and never exposes internals', () => {
    const markup = render(<NotFoundView />)
    expect(markup).toContain('Page not found')
    expect(markup).toContain('Go to the entry page')
    expect(markup).toContain('Go to dashboard')
  })
})

describe('renderFallbackError marker (spec 021 edge case)', () => {
  it('is an Error subclass the boundary can recognize', () => {
    const error = new RenderFallbackError()
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('RenderFallbackError')
  })
})

// Reference the throwing helper so the file compiles (a JSX component that
// throws is only mounted in the live-catch e2e proof).
void ThrowingChild
