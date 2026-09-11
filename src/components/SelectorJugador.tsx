import { Check, ChevronDown, UserX } from 'lucide-react'
import { useState } from 'react'
import Sheet from './Sheet'

export interface OpcionJugador {
  id: string
  nombre: string
  foto: string | null
}

interface Props {
  opciones: OpcionJugador[]
  valor: string | null
  onChange: (id: string | null) => void
  titulo: string
  deshabilitado?: boolean
}

/**
 * Elegir a una persona. Sustituye al `<select>` nativo, que lo dibuja el sistema y
 * en el celular abre una rueda diminuta de puros nombres; aquí se ven las fotos y
 * los blancos de toque son grandes.
 */
export default function SelectorJugador({
  opciones,
  valor,
  onChange,
  titulo,
  deshabilitado = false,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const elegido = opciones.find((o) => o.id === valor) ?? null

  const Avatar = ({ o, size = 28 }: { o: OpcionJugador; size?: number }) => (
    <span
      className="shrink-0 overflow-hidden rounded-full bg-ink/10"
      style={{ width: size, height: size }}
    >
      {o.foto ? (
        <img src={o.foto} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display font-bold text-ink-soft">
          {o.nombre.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )

  return (
    <>
      <button
        type="button"
        disabled={deshabilitado}
        onClick={() => setAbierto(true)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-paper-line bg-white px-3 py-2.5 text-left transition-colors active:scale-[.99] disabled:opacity-60"
      >
        {elegido ? (
          <>
            <Avatar o={elegido} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
              {elegido.nombre}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink-soft/70">
            Sin asignar
          </span>
        )}
        <ChevronDown size={17} strokeWidth={2.4} className="shrink-0 text-ink-soft/50" />
      </button>

      <Sheet abierta={abierto} onCerrar={() => setAbierto(false)} titulo={titulo}>
        <ul className="m-0 list-none p-0">
          {opciones.map((o) => {
            const activo = o.id === valor
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.id)
                    setAbierto(false)
                  }}
                  className={`flex w-full cursor-pointer items-center gap-3 border-none border-b border-dashed border-paper-line px-1 py-3 text-left ${
                    activo ? 'bg-marca/12' : 'bg-transparent'
                  }`}
                >
                  <Avatar o={o} size={36} />
                  <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
                    {o.nombre}
                  </span>
                  {activo && <Check size={18} strokeWidth={3} className="shrink-0 text-marca-tinta" />}
                </button>
              </li>
            )
          })}

          <li>
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setAbierto(false)
              }}
              className="flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-1 py-3 text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/8 text-ink-soft/60">
                <UserX size={17} strokeWidth={2.4} />
              </span>
              <span className="flex-1 text-base font-semibold text-ink-soft">Dejar sin asignar</span>
            </button>
          </li>
        </ul>
      </Sheet>
    </>
  )
}
