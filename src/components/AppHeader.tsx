import { Banknote, Settings, Trophy } from 'lucide-react'
import { useSession } from '../store/session'
import type { Mode } from '../store/types'

const MODOS: { id: Mode; label: string; Icono: typeof Banknote }[] = [
  { id: 'cash', label: 'Cash', Icono: Banknote },
  { id: 'torneo', label: 'Torneo', Icono: Trophy },
]

interface Props {
  onAbrirAjustes: () => void
}

/**
 * Encabezado compacto y fijo. Antes ocupaba casi media pantalla antes de mostrar
 * un solo dato; ahora el título, el nombre de la partida y el modo caben en lo
 * que medía el puro título.
 */
export default function AppHeader({ onAbrirAjustes }: Props) {
  const mode = useSession((s) => s.mode)
  const sessionName = useSession((s) => s.sessionName)
  const setMode = useSession((s) => s.setMode)
  const setSessionName = useSession((s) => s.setSessionName)

  return (
    <header className="sticky top-0 z-30 -mx-3.5 mb-3 border-b border-white/8 bg-[#1b241a]/85 px-3.5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2.5 backdrop-blur-xl">
      <div className="mx-auto max-w-[640px]">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-lg leading-none text-gold" aria-hidden="true">
            ♠
          </span>
          <h1 className="flex-1 font-display text-[19px] leading-none font-bold tracking-[1.2px] text-gold-soft uppercase">
            Sesión de Póker
          </h1>
          <button
            type="button"
            onClick={onAbrirAjustes}
            aria-label="Ajustes: valor de las fichas y respaldo"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/8 text-mint transition-transform active:scale-90"
          >
            <Settings size={18} strokeWidth={2.2} />
          </button>
        </div>

        <input
          type="text"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="Nombre o fecha de la partida"
          aria-label="Nombre o fecha de la partida"
          className="mt-1.5 w-full border-none bg-transparent p-0 text-[13px] text-mint outline-none placeholder:text-mint-soft/50"
        />

        <div
          role="tablist"
          aria-label="Modo de juego"
          className="mt-2 flex gap-1 rounded-xl bg-black/30 p-1"
        >
          {MODOS.map(({ id, label, Icono }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] border-none py-2 text-[13px] font-bold transition-colors ${
                mode === id
                  ? 'bg-gold text-[#2e1a11] shadow-[0_2px_6px_rgba(0,0,0,.3)]'
                  : 'bg-transparent text-mint-soft'
              }`}
            >
              <Icono size={15} strokeWidth={2.4} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
