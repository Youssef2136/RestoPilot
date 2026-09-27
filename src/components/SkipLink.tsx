/**
 * The skip link (spec 021 US6): first in tab order, visually hidden until
 * focused, jumping keyboard users past the header to the shell's main
 * landmark (<main id="main">). Styling lives in src/styles/base.css.
 */
export function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Skip to main content
    </a>
  )
}
