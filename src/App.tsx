import { useEffect, useState } from 'react'
import BackupPanel from './components/BackupPanel'
import ColorsPanel from './components/ColorsPanel'
import Toast from './components/Toast'
import { isEphemeralContext } from './lib/backup'
import EntradaScreen from './screens/EntradaScreen'
import FinalScreen from './screens/FinalScreen'
import RecompraScreen from './screens/RecompraScreen'
import RepartoScreen from './screens/RepartoScreen'
import ResultadoScreen from './screens/ResultadoScreen'
import TorneoConfigScreen from './screens/TorneoConfigScreen'
import TorneoJugadoresScreen from './screens/TorneoJugadoresScreen'
import TorneoResultadoScreen from './screens/TorneoResultadoScreen'
import { TABS, useSession } from './store/session'
import type { Tab } from './store/types'

const SCREENS: Record<Tab, () => React.ReactElement> = {
  entrada: EntradaScreen,
  reparto: RepartoScreen,
  recompra: RecompraScreen,
  final: FinalScreen,
  resultado: ResultadoScreen,
  t_config: TorneoConfigScreen,
  t_jugadores: TorneoJugadoresScreen,
  t_resultado: TorneoResultadoScreen,
}

export default function App() {
  const mode = useSession((s) => s.mode)
  const activeTab = useSession((s) => s.activeTab)
  const sessionName = useSession((s) => s.sessionName)
  const setMode = useSession((s) => s.setMode)
  const setTab = useSession((s) => s.setTab)
  const setSessionName = useSession((s) => s.setSessionName)

  const [ephemeral, setEphemeral] = useState(false)
  useEffect(() => setEphemeral(isEphemeralContext()), [])

  const Screen = SCREENS[activeTab] ?? SCREENS[TABS[mode][0].id]

  return (
    <div className="mx-auto max-w-[640px] px-3.5 pt-4 pb-[70px]">
      <header className="px-0 pt-2 pb-3.5 text-center">
        <div className="text-sm tracking-[6px] text-gold">♠ ♥ ♣ ♦</div>
        <h1 className="my-1 font-display text-[clamp(28px,7.5vw,44px)] leading-none font-bold tracking-[1px] text-gold-soft uppercase [text-shadow:0_2px_0_rgba(0,0,0,.35)]">
          Sesión de Póker
        </h1>
        <input
          type="text"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="Nombre o fecha de la partida"
          aria-label="Nombre o fecha de la partida"
          className="w-[70%] max-w-[280px] border-none border-b border-dashed border-white/35 bg-transparent px-1 py-0.5 text-center text-sm text-[#dfeee4] outline-none placeholder:text-[#dfeee4]/60 focus:border-b-gold"
          style={{ borderBottomStyle: 'dashed', borderBottomWidth: 1 }}
        />
      </header>

      <div
        role="tablist"
        aria-label="Modo de juego"
        className="mx-auto mb-3.5 flex max-w-[280px] gap-1.5 rounded-xl bg-felt-deep/55 p-1.5"
      >
        {(
          [
            ['cash', '💵 Cash'],
            ['torneo', '🏆 Torneo'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`flex-1 cursor-pointer rounded-[9px] border-none py-2.5 text-sm font-bold transition-colors ${
              mode === m
                ? 'bg-gold text-[#3a2f0e] shadow-[0_3px_8px_rgba(0,0,0,.25)]'
                : 'bg-transparent text-mint'
            }`}
            onClick={() => setMode(m)}
          >
            {label}
          </button>
        ))}
      </div>

      {ephemeral && (
        <div className="balance balance-off mx-auto">
          ⚠ Abriste esto desde una vista temporal, por eso no se guarda al salir. Instala la app en
          tu pantalla de inicio o ábrela en Chrome para que guarde sola.
        </div>
      )}

      <ColorsPanel />

      <div
        role="tablist"
        aria-label="Secciones"
        className="no-scrollbar sticky top-0 z-20 mb-4 flex gap-1.5 overflow-x-auto rounded-[14px] bg-felt-deep/90 p-1.5 shadow-[0_6px_18px_rgba(0,0,0,.3)] backdrop-blur-[6px]"
      >
        {TABS[mode].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={`flex-[1_0_auto] cursor-pointer rounded-[10px] border-none px-3 py-2.5 text-[12.5px] font-bold tracking-[.2px] whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'bg-gold text-[#3a2f0e] shadow-[0_3px_8px_rgba(0,0,0,.25)]'
                : 'bg-transparent text-mint-soft'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main>
        <Screen />
      </main>

      <BackupPanel />

      <p className="mt-4 text-center text-xs text-mint opacity-85">
        Todo se guarda en este dispositivo. Instálala desde el menú del navegador para usarla sin
        internet.
      </p>

      <Toast />
    </div>
  )
}
