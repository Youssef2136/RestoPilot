import { useState } from 'react'
import { Link } from 'react-router'

/**
 * The dev-only design gallery (spec 021 FR-09; Clarification Q3):
 * `/dev/gallery` — renders the styles and structure available so far so the
 * Phase 02 system has a proven home. Registered in the router behind
 * `import.meta.env.DEV`, so production builds exclude the route entirely
 * (tree-shaken: the import is not reachable outside DEV).
 *
 * This page is infrastructure, not a surface: no product copy, no tenant
 * data — static local fixtures only.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBlock: '2rem' }}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

/**
 * The live error-boundary proof (spec 021 US1 acceptance): arming this
 * control throws during the next render, and the top-level ErrorBoundary
 * catches it — the recovery view replaces the page, the internal message is
 * never rendered. Available only in DEV (the gallery route itself is
 * DEV-gated).
 */
function ErrorTrigger() {
  const [armed, setArmed] = useState(false)
  if (armed) {
    throw new Error('Intentional dev-gallery render error (ErrorBoundary proof)')
  }
  return (
    <button type="button" onClick={() => setArmed(true)}>
      Trigger a render error (dev proof)
    </button>
  )
}

export function DevGalleryPage() {
  return (
    <main id="main" className="dev-gallery">
      <h1>Dev gallery</h1>
      <p>
        Development-only preview of the styles and structure available so far. This route does not
        exist in production builds (spec 021 FR-09).
      </p>

      <Section title="Skip link">
        <p>
          The skip link is the shell's first tabbable element (Tab from the top of any page).
          Styling: <code>src/styles/base.css</code> (visually hidden until focus, targets{' '}
          <code>#main</code>).
        </p>
      </Section>

      <Section title="Focus policy">
        <p>
          <code>:focus-visible</code> renders a 2px outline everywhere — never suppressed. Tab
          through the links below to observe:
        </p>
        <p>
          <Link to="/">Entry page link</Link> · <Link to="/signin">Sign-in link</Link>
        </p>
      </Section>

      <Section title="Typography defaults">
        <h1>Heading 1 (page-level)</h1>
        <h2>Heading 2 (section-level)</h2>
        <p>Body paragraph at the default line height, using the inherited font stack.</p>
      </Section>

      <Section title="Recovery views (inert demos)">
        <p>
          The error and not-found views render through <code>ErrorBoundary</code> and the{' '}
          <code>*</code> route; their composition lives in{' '}
          <code>src/components/RouteErrorView.tsx</code> and{' '}
          <code>src/components/NotFoundView.tsx</code>. The gallery shows the underlying structure
          without invoking the real boundary — except for the live proof:
        </p>
        <ErrorTrigger />
      </Section>

      <Section title="Reserved (Phase 02)">
        <p>
          Tokens, primitives, and states arrive with the design system; the token layer imports
          between <code>base.css</code> and <code>index.css</code> (documented order).
        </p>
      </Section>
    </main>
  )
}
