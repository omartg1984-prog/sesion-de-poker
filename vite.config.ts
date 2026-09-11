import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * `npm run build:archivo` (modo `archivo`) arma un solo .html con todo adentro, para mandarlo por
 * WhatsApp y abrirlo sin servidor. En ese modo no hay PWA (un archivo suelto no se
 * instala ni necesita service worker).
 */
export default defineConfig(({ mode }) => {
  const soloArchivo = mode === "archivo";

  return {
    build: soloArchivo ? { outDir: "dist-archivo" } : {},
    // lucide-react son miles de módulos sueltos; si Vite no los pre-empaqueta acaban
    // importando una instancia de React distinta a la del app y los hooks revientan.
    optimizeDeps: { include: ["lucide-react"] },
    resolve: { dedupe: ["react", "react-dom"] },
    plugins: [
      react(),
      tailwindcss(),
      soloArchivo && viteSingleFile(),
      VitePWA({
        disable: soloArchivo,
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          // Las fuentes de Google se cachean para que la app siga viéndose igual sin internet.
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: "Sesión de Póker",
          short_name: "Póker",
          description:
            "Lleva la cuenta de tus partidas de póker en casa: entradas, reparto de fichas y resultados.",
          lang: "es",
          start_url: ".",
          scope: ".",
          display: "standalone",
          orientation: "portrait",
          background_color: "#083f26",
          theme_color: "#0d5c37",
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
