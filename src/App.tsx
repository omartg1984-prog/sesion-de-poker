import { useEffect, useState } from 'react'
import AppHeader from './components/AppHeader'
import BackupPanel from './components/BackupPanel'
import BottomNav from './components/BottomNav'
import ColorsPanel from './components/ColorsPanel'
import Sheet from './components/Sheet'
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

  const [ajustesAbiertos, setAjustesAbiertos] = useState(false)
  const [efimero, setEfimero] = useState(false)
  useEffect(() => setEfimero(isEphemeralContext()), [])

  const Screen = SCREENS[activeTab] ?? SCREENS[TABS[mode][0].id]

  return (
    <div className="mx-auto max-w-[640px] px-3.5">
      <AppHeader onAbrirAjustes={() => setAjustesAbiertos(true)} />

      {efimero && (
        <div className="balance balance-off">
          Abriste esto desde una vista temporal, por eso no se guarda al salir. Instálala en tu
          pantalla de inicio o ábrela en Chrome para que guarde sola.
        </div>
      )}

      {/* El padding de abajo deja libre la barra de navegación fija. */}
      <main
        key={activeTab}
        className="animate-[entrar_.18s_ease-out] pb-[calc(env(safe-area-inset-bottom)+78px)]"
      >
        <Screen />
      </main>

      <BottomNav />

      <Sheet abierta={ajustesAbiertos} onCerrar={() => setAjustesAbiertos(false)} titulo="Ajustes">
        <p className="panel-title mt-1">
          <span>Valor de las fichas</span>
        </p>
        <ColorsPanel />

        <p className="panel-title mt-6">
          <span>Guardar / Cargar datos</span>
        </p>
        <BackupPanel />
      </Sheet>

      <Toast />
    </div>
  )
}
