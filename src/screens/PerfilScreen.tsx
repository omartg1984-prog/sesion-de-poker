import { ArrowLeft, Camera, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { api } from '../lib/api'
import { conAviso, useApp } from '../store/app'

/** Lado máximo de la foto de perfil. Más que esto no aporta nada en un avatar. */
const LADO = 256

/**
 * Redimensiona y recorta al centro en el navegador. Así la foto viaja pequeña y el
 * servidor nunca recibe los 5 MB que saca la cámara del teléfono.
 */
function encogerFoto(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onerror = () => rechazar(new Error('No se pudo leer la imagen'))
    lector.onload = () => {
      const img = new Image()
      img.onerror = () => rechazar(new Error('El archivo no es una imagen'))
      img.onload = () => {
        const lienzo = document.createElement('canvas')
        lienzo.width = LADO
        lienzo.height = LADO
        const ctx = lienzo.getContext('2d')!
        const lado = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, LADO, LADO)
        resolver(lienzo.toDataURL('image/jpeg', 0.85))
      }
      img.src = String(lector.result)
    }
    lector.readAsDataURL(archivo)
  })
}

export default function PerfilScreen() {
  const usuario = useApp((s) => s.usuario)!
  const ponerUsuario = useApp((s) => s.ponerUsuario)
  const irAHome = useApp((s) => s.irAHome)
  const avisar = useApp((s) => s.avisar)

  const [nombre, setNombre] = useState(usuario.nombre)
  const [foto, setFoto] = useState<string | null>(usuario.foto)
  const [ocupado, setOcupado] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)

  const cambiado = nombre.trim() !== usuario.nombre || foto !== usuario.foto

  const guardar = async () => {
    if (!nombre.trim() || ocupado) return
    setOcupado(true)
    const r = await conAviso(() => api.guardarPerfil({ nombre: nombre.trim(), foto }))
    setOcupado(false)
    if (r) {
      ponerUsuario(r.usuario)
      avisar('Perfil guardado')
      irAHome()
    }
  }

  return (
    <div className="mx-auto max-w-[640px] px-3.5 pb-10">
      <header className="sticky top-0 z-30 -mx-3.5 mb-4 flex items-center gap-3 border-b border-white/8 bg-[#1b241a]/85 px-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={irAHome}
          aria-label="Volver"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/8 text-mint active:scale-90"
        >
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>
        <h1 className="m-0 font-display text-[17px] font-bold tracking-[.5px] text-gold-soft uppercase">
          Mi perfil
        </h1>
      </header>

      <section className="panel">
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => archivo.current?.click()}
            className="relative h-28 w-28 cursor-pointer overflow-hidden rounded-full border-none bg-ink/8 p-0"
            aria-label="Cambiar foto"
          >
            {foto ? (
              <img src={foto} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-4xl font-bold text-ink-soft">
                {(nombre || usuario.usuario).charAt(0).toUpperCase()}
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1.5 text-[11px] font-bold text-white">
              <Camera size={12} strokeWidth={2.6} />
              Cambiar
            </span>
          </button>

          <input
            ref={archivo}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                setFoto(await encogerFoto(f))
              } catch {
                avisar('No se pudo usar esa imagen')
              }
            }}
          />

          {foto && (
            <button
              type="button"
              onClick={() => setFoto(null)}
              className="mt-2.5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent text-xs font-semibold text-loss"
            >
              <Trash2 size={13} strokeWidth={2.5} />
              Quitar foto
            </button>
          )}
        </div>

        <label className="mt-5 block">
          <span className="field-label">Tu nombre</span>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-gold"
          />
        </label>

        <p className="mt-3 mb-0 text-[13px] text-ink-soft">
          Tu usuario es <b className="text-ink">{usuario.usuario}</b> y no se puede cambiar.
        </p>
      </section>

      <button
        type="button"
        className="btn btn-gold"
        disabled={!cambiado || !nombre.trim() || ocupado}
        onClick={() => void guardar()}
      >
        Guardar cambios
      </button>
    </div>
  )
}
