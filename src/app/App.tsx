import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { AuthProvider } from '../features/auth/AuthProvider'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { AppRouter } from './router'
import { queryClient } from './queryClient'

/**
 * Application composition (research.md §7): server-state provider, session
 * provider, router, and the shell layout. Feature modules mount inside the
 * router's routes.
 *
 * Phase 01 (spec 021 FR-03): the top-level error boundary wraps the router so
 * an unhandled render error anywhere below renders the recoverable error view
 * instead of a white screen. The boundary is presentation-only recovery UI —
 * guards, authorization, and data behavior are unchanged.
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <AppRouter />
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
