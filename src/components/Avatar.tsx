import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { encogerFoto } from '../lib/foto'

/*
 * La foto redonda de una liga o de una persona, con su inicial de respaldo.
 *
 * Sale de juntar tres copias casi iguales que ya había —el podio, la lista de miembros
 * y la barra de la liga— y añadir la de editar, que es la misma más un botón.
 */

interface Props {
  foto: string | null
  /** De aquí sale la inicial cuando no hay foto. */
  nombre: string
  size?: number
  /** Sobre fondo oscuro la inicial va en claro; sobre las tarjetas crema, al revés. */
  oscuro?: boolean
  className?: string
}

export default function Avatar({ foto, nombre, size = 36, oscuro = false, className = '' }: Props) {
  const inicial = nombre.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${
        oscuro ? 'bg-white/10 ring-1 ring-marca/40' : 'bg-ink/10'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {foto ? (
        <img src={foto} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className={`font-display font-bold ${oscuro ? 'text-white' : 'text-ink-soft'}`}
          style={{ fontSize: Math.round(size * 0.44) }}
        >
          {inicial}
        </span>
      )}
    </span>
  )
}

/** El avatar, pero se puede tocar para cambiar la foto. Devuelve el data URL ya encogido. */
export function AvatarEditable({
  foto,
  nombre,
  size = 76,
  etiqueta,
  onCambiar,
  onError,
}: {
  foto: string | null
  nombre: string
  size?: number
  etiqueta: string
  onCambiar: (foto: string | null) => void
  onError?: (mensaje: string) => void
}) {
  const archivo = useRef<HTMLInputElement>(null)
  const [ocupado, setOcupado] = useState(false)
  const chico = size < 56

  const elegir = async (f: File | undefined) => {
    if (!f) return
    setOcupado(true)
    try {
      onCambiar(await encogerFoto(f))
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'No se pudo usar esa imagen')
    } finally {
      setOcupado(false)
      // Se limpia para que elegir el mismo archivo otra vez vuelva a disparar el cambio.
      if (archivo.current) archivo.current.value = ''
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={ocupado}
        aria-label={etiqueta}
        onClick={() => archivo.current?.click()}
        className="relative shrink-0 cursor-pointer rounded-full border-none bg-transparent p-0 active:scale-95 disabled:opacity-60"
        style={{ width: size, height: size }}
      >
        <Avatar foto={foto} nombre={nombre} size={size} oscuro={chico} />
        {chico ? (
          /* En la barra no cabe la palabra: basta la cámara en una esquina. */
          <span className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-marca-tinta ring-2 ring-marca">
            <Camera size={9} strokeWidth={3} />
          </span>
        ) : (
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-full bg-black/55 py-1 text-[10px] font-bold text-white">
            <Camera size={11} strokeWidth={2.6} />
            {foto ? 'Cambiar' : 'Foto'}
          </span>
        )}
      </button>
      <input
        ref={archivo}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void elegir(e.target.files?.[0])}
      />
    </>
  )
}
