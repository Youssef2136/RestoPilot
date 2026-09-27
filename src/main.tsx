import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
// Styles pipeline (spec 021 FR-01; tokenized spec 022 FR-03): reset →
// tokens → base → page defaults. The order is fixed and asserted by
// tests/unit/stylesPipeline.test.ts.
import './styles/reset.css'
import './styles/tokens.css'
import './styles/base.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
