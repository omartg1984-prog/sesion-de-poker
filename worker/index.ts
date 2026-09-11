/**
 * API de la app. Todo lo que no empiece con /api/ lo sirven los archivos estáticos.
 *
 * Convenciones:
 *  - Las respuestas de error llevan `{ error: "mensaje en español" }` y el mensaje se
 *    muestra tal cual al usuario, así que se escriben pensando en él.
 *  - La sesión viaja en una cookie HttpOnly: el JavaScript de la página no puede
 *    leerla, así que un script inyectado no puede robarla.
 */
import { rutas } from './rutas'
import type { Env } from './tipos'

export default {
  async fetch(peticion: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(peticion.url)

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(peticion)
    }

    try {
      const respuesta = await rutas(peticion, env, ctx, url)
      return respuesta ?? json({ error: 'Ruta no encontrada' }, 404)
    } catch (err) {
      // Nunca se filtra el detalle del error al cliente; queda en los logs.
      console.error('Error en', url.pathname, err)
      return json({ error: 'Algo falló del lado del servidor' }, 500)
    }
  },
} satisfies ExportedHandler<Env>

export function json(datos: unknown, estado = 200, cabeceras: HeadersInit = {}): Response {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cabeceras },
  })
}
