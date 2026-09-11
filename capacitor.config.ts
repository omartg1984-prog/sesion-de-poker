import type { CapacitorConfig } from '@capacitor/cli';

/*
 * El APK no lleva la app adentro: abre el sitio ya publicado en Cloudflare.
 *
 * La app pide todo con rutas relativas (`fetch('/api/...')`) y la sesión viaja en una
 * cookie del mismo sitio. Si los archivos vivieran dentro del APK, el WebView correría
 * en el origen `https://localhost` y `/api/entrar` daría contra los propios archivos
 * empaquetados, donde no hay servidor: no se podría ni entrar. Apuntando aquí, el
 * origen es el de siempre y todo funciona igual que en el navegador.
 *
 * De pasada, cada cambio que se sube a Cloudflare le llega a todos sin reinstalar.
 */
const config: CapacitorConfig = {
  appId: 'com.omartg.sesiondepoker',
  appName: 'Sesión de Póker',
  webDir: 'dist',
  server: {
    url: 'https://sesion-de-poker.omartg-1984.workers.dev',
    cleartext: false,
  },
};

export default config;
