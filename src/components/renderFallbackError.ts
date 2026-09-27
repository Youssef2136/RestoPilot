/**
 * The minimal static fallback's marker error (spec 021 edge case): a nested
 * ErrorBoundary that catches a RenderFallbackError renders the minimal
 * fallback instead of the full recovery view, so fallback-in-fallback cannot
 * recurse. Reserved for route-level boundaries (Phase 03) — no view throws it
 * yet.
 */
export class RenderFallbackError extends Error {
  constructor() {
    super('render-fallback-error')
    this.name = 'RenderFallbackError'
  }
}
