import { Capacitor } from '@capacitor/core'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { ajustarBarraDeEstado } from './lib/nativo'
import './index.css'

// En la web el service worker deja la app instalable y la arranca al instante.
//
// Dentro del APK no se registra a propósito: el APK abre este mismo sitio, así que un
// service worker guardaría una copia en el teléfono y podría seguir sirviendo la
// versión vieja. Sin él, cada vez que se abre la app pide lo último a Cloudflare, que
// es justamente lo que hace que las actualizaciones lleguen sin reinstalar nada.
if (!Capacitor.isNativePlatform()) {
  registerSW({ immediate: true })
}

void ajustarBarraDeEstado()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
