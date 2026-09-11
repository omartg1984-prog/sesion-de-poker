import { ClipboardCopy, Download, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { copyText } from '../lib/backup'
import { buildCanvas, downloadImage, shareImage } from '../lib/shareImage'
import { currentSession, useSession } from '../store/session'

interface Props {
  /** Texto plano alternativo, por si prefieren pegarlo en el chat. */
  plainText: () => string
  alt: string
}

/** Vista previa de la imagen + compartir / descargar / copiar texto. */
export default function ShareBlock({ plainText, alt }: Props) {
  const session = useSession(useShallow(currentSession))
  const showToast = useSession((s) => s.showToast)
  const [src, setSrc] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // La vista previa se redibuja sola cuando cambian los datos de la sesión.
  useEffect(() => {
    let cancelled = false
    buildCanvas(session)
      .then((cv) => {
        if (!cancelled) setSrc(cv.toDataURL('image/png'))
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const run = async (fn: () => Promise<string>) => {
    if (busy) return
    setBusy(true)
    try {
      showToast(await fn())
    } catch {
      showToast('No se pudo generar la imagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {src && (
        <img src={src} alt={alt} className="my-3 w-full rounded-xl shadow-[0_8px_20px_rgba(0,0,0,.25)]" />
      )}

      <div className="mb-2.5 flex gap-2.5">
        <button
          type="button"
          className="btn btn-share"
          disabled={busy}
          onClick={() =>
            run(async () =>
              (await shareImage(session)) === 'shared' ? 'Compartido' : 'Imagen descargada',
            )
          }
        >
          <Share2 size={17} strokeWidth={2.4} />
          Compartir
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await downloadImage(session)
              return 'Imagen descargada'
            })
          }
        >
          <Download size={17} strokeWidth={2.4} />
          Descargar
        </button>
      </div>

      <button
        type="button"
        className="btn btn-ghost"
        onClick={async () => showToast((await copyText(plainText())) ? 'Copiado' : 'No se pudo copiar')}
      >
        <ClipboardCopy size={17} strokeWidth={2.4} />
        Copiar texto
      </button>

      <p className="mt-2 text-center text-xs text-ink-soft">
        Consejo: también puedes mantener presionada la imagen para compartirla o guardarla.
      </p>
    </>
  )
}
