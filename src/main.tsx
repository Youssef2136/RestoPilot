import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
// Styles pipeline (spec FR-01): reset → base → page defaults. The order is
// fixed and asserted by tests/unit/stylesPipeline.test.ts; the Phase 02
// token layer imports between base and index.css when it lands.
import './styles/reset.css'
import './styles/base.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
