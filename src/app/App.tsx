import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { AuthProvider } from '../features/auth/AuthProvider'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ToastProvider } from '../components/ui'
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
 *
 * Phase 03 (spec 023 FR-05): the toast host mounts once here — every shell
 * and surface announces async outcomes through `useToast` (polite live
 * region; inline verbatim errors stay the refusal path).
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <ToastProvider>
              <AppRouter />
            </ToastProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
