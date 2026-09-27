import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RouteErrorView } from './RouteErrorView'
import { RenderFallbackError } from './renderFallbackError'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

/**
 * Top-level error boundary (spec 021 FR-03 / US1): catches render errors
 * anywhere below it and renders the recoverable error view — never a white
 * screen, never the internal message. Wrap points: the whole router
 * (src/app/App.tsx). Route-level boundaries later reuse this component as a
 * composition unit; the nested case renders the minimal static fallback so
 * fallback-in-fallback cannot recurse (spec edge case).
 *
 * The caught error is logged once via console.error — that log IS the error
 * report (no internal message is rendered); the E2E console helper accounts
 * for it as the boundary's own expected entry.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The report IS the console record: the view never renders this.
    console.error('Unhandled render error caught by ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return <RouteErrorView minimal={this.state.error instanceof RenderFallbackError} />
    }
    return this.props.children
  }
}
