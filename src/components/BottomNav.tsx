import {
  Calculator,
  Coins,
  RotateCw,
  Settings2,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { TABS, useSession } from '../store/session'
import type { Tab } from '../store/types'

const ICONOS: Record<Tab, LucideIcon> = {
  entrada: Wallet,
  reparto: Coins,
  recompra: RotateCw,
  final: Calculator,
  resultado: Trophy,
  t_config: Settings2,
  t_jugadores: Users,
  t_resultado: Trophy,
}

/**
 * Navegación principal abajo, donde llega el pulgar: la app se usa con una mano
 * mientras se juega. Se queda fija sobre el contenido y respeta la barra de
 * gestos del teléfono.
 */
export default function BottomNav() {
  const mode = useSession((s) => s.mode)
  const activeTab = useSession((s) => s.activeTab)
  const setTab = useSession((s) => s.setTab)

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/8 bg-[#141c13]/92 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-[640px] items-stretch pb-[env(safe-area-inset-bottom)]">
        {TABS[mode].map((t) => {
          const Icono = ICONOS[t.id]
          const activa = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              aria-current={activa ? 'page' : undefined}
              onClick={() => setTab(t.id)}
              className={`relative flex flex-1 cursor-pointer flex-col items-center gap-1 border-none bg-transparent px-1 pt-2.5 pb-2 transition-colors ${
                activa ? 'text-gold-soft' : 'text-mint-soft/55'
              }`}
            >
              {/* la marca de la pestaña activa: una línea dorada arriba del icono */}
              <span
                className={`absolute top-0 h-0.5 w-9 rounded-full bg-gold-soft transition-opacity ${
                  activa ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <Icono size={21} strokeWidth={activa ? 2.4 : 2} />
              <span className={`text-[10.5px] leading-none ${activa ? 'font-bold' : 'font-semibold'}`}>
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
