import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fuentes del brand kit, autoalojadas: en una emergencia la red es mala y un
// CDN de tipografías es un punto de fallo que retrasa el primer texto legible.
import './styles/fuentes.css'

import './styles/tokens.css'
import './styles/base.css'
import './styles/ui.css'
import './styles/shell.css'

import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
