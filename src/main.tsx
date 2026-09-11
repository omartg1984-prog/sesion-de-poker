import { Capacitor } from '@capacitor/core'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// En la web, el service worker deja la app lista para funcionar sin internet y se
// actualiza sola al recargar.
//
// Dentro del APK no: ahí los archivos ya viven en el teléfono, así que no aporta nada
// y encima puede servir la versión vieja después de actualizar la app.
if (!Capacitor.isNativePlatform()) {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
