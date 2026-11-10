import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

/*
 * El aviso de que hay versión nueva.
 *
 * La app vive en el teléfono de todos como si fuera una app instalada: se abre y se
 * cierra, pero casi nunca se recarga. El teléfono se queda con la versión que bajó el
 * primer día y ahí se puede quedar semanas, así que lo que se sube a Cloudflare está
 * arriba pero no llega: uno pide un cambio, se hace, se sube —y en su pantalla no pasa
 * nada. Eso pasó con el plan de fichas y no hay forma de que el que lo sufre lo
 * adivine.
 *
 * Esto lo revisa solo: cada vez que la app vuelve al frente se pregunta si el archivo
 * que está corriendo sigue siendo el último, y si no, lo dice con un botón para
 * ponerse al día. No recarga por su cuenta: a media partida, recargar sin avisar es
 * quitarle la pantalla de las manos a alguien que está apuntando una recompra.
 */

/** El archivo de la app que está corriendo ahora mismo. */
function elQueCorre(): string | null {
  const modulos = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')]
  const suyo = modulos.map((s) => s.src).find((src) => src.includes('/assets/'))
  return suyo ? new URL(suyo, location.href).pathname : null
}

/** El archivo de la app que hay publicado, según el servidor. */
async function elQueHay(): Promise<string | null> {
  const r = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })
  if (!r.ok) return null
  const html = await r.text()
  return html.match(/src="([^"]*\/assets\/[^"]+\.js)"/)?.[1] ?? null
}

export default function VersionNueva() {
  const [hay, setHay] = useState(false)

  useEffect(() => {
    /* En desarrollo el index no trae /assets: ahí no hay nada que revisar. */
    const mio = elQueCorre()
    if (!mio) return

    let vivo = true
    const revisar = async () => {
      if (!vivo || document.visibilityState !== 'visible') return
      try {
        const ahora = await elQueHay()
        /* Sin internet o con el servidor de malas no se dice nada: ya se volverá a
           preguntar la próxima vez que la app vuelva al frente. */
        if (vivo && ahora && !mio.endsWith(ahora) && !ahora.endsWith(mio)) setHay(true)
      } catch {
        /* nada */
      }
    }

    document.addEventListener('visibilitychange', revisar)
    window.addEventListener('focus', revisar)
    /* Y de vez en cuando, para la noche que la app se queda abierta en la mesa. */
    const cada = setInterval(revisar, 15 * 60 * 1000)
    void revisar()

    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', revisar)
      window.removeEventListener('focus', revisar)
      clearInterval(cada)
    }
  }, [])

  if (!hay) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex items-center gap-3 bg-marca px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white shadow-[0_-6px_20px_rgba(0,0,0,.35)]">
      <span className="min-w-0 flex-1 text-[13px] leading-snug font-semibold">
        Hay una versión nueva de la app
      </span>
      <button
        type="button"
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border-none bg-white px-3 py-2 text-[13px] font-bold text-marca-tinta active:scale-95"
        onClick={() => location.reload()}
      >
        <RefreshCw size={14} strokeWidth={2.8} />
        Actualizar
      </button>
    </div>
  )
}
