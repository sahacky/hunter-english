import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './i18n'
import './styles/theme.css'

// Implements: plan://M9#9.1 — регистрация SW из virtual:pwa-register (autoUpdate).
// reload при активации обновления встроен в режим autoUpdate (activated/isUpdate
// → window.location.reload): открытая вкладка не словит 404 старого ленивого
// чанка после cleanupOutdatedCaches.
registerSW()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
