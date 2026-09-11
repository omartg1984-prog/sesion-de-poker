import { ClipboardCopy, Download, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { copyText } from '../lib/backup'
import {
  compartirImagen,
  construirLienzo,
  descargarImagen,
  type DatosImagen,
} from '../lib/shareImage'
import { useApp } from '../store/app'

interface Props {
  datos: DatosImagen
  /** Texto plano alternativo, por si prefieren pegarlo en el chat. */
  texto: () => string
  alt: string
}

/** Vista previa de la imagen + compartir / descargar / copiar texto. */
export default function ShareBlock({ datos, texto, alt }: Props) {
  const avisar = useApp((s) => s.avisar)
  const [src, setSrc] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // La vista previa se redibuja sola cuando cambian los datos. Se compara el contenido,
  // no la identidad del objeto, que el padre rehace en cada render.
  const huella = JSON.stringify(datos)
  useEffect(() => {
    let cancelado = false
    construirLienzo(datos)
      .then((cv) => {
        if (!cancelado) setSrc(cv.toDataURL('image/png'))
      })
      .catch(() => {
        if (!cancelado) setSrc(null)
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huella])

  const correr = async (fn: () => Promise<string>) => {
    if (ocupado) return
    setOcupado(true)
    try {
      avisar(await fn())
    } catch {
      avisar('No se pudo generar la imagen')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      {src && (
        <img
          src={src}
          alt={alt}
          className="my-3 w-full rounded-xl shadow-[0_8px_20px_rgba(0,0,0,.25)]"
        />
      )}

      <div className="mb-2.5 flex gap-2.5">
        <button
          type="button"
          className="btn btn-share"
          disabled={ocupado}
          onClick={() =>
            correr(async () =>
              (await compartirImagen(datos)) === 'compartida' ? 'Compartido' : 'Imagen descargada',
            )
          }
        >
          <Share2 size={17} strokeWidth={2.4} />
          Compartir
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={ocupado}
          onClick={() =>
            correr(async () => {
              await descargarImagen(datos)
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
        onClick={async () => avisar((await copyText(texto())) ? 'Copiado' : 'No se pudo copiar')}
      >
        <ClipboardCopy size={17} strokeWidth={2.4} />
        Copiar texto
      </button>

      <p className="mt-2 mb-0 text-center text-xs text-ink-soft">
        También puedes mantener presionada la imagen para compartirla o guardarla.
      </p>
    </>
  )
}
