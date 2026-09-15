import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { AppRouter } from './router'

const queryClient = new QueryClient()

/**
 * Application composition (research.md §7): server-state provider, router,
 * and the shell layout. Feature modules mount inside the router's routes.
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
