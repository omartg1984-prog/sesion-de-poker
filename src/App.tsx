import { Loader2 } from 'lucide-react'
import Logo from './components/Logo'
import { useEffect } from 'react'
import Invitacion from './components/Invitacion'
import Toast from './components/Toast'
import AdminScreen from './screens/AdminScreen'
import EntrarScreen from './screens/EntrarScreen'
import HomeScreen from './screens/HomeScreen'
import LigaScreen from './screens/LigaScreen'
import PartidaScreen from './screens/PartidaScreen'
import PerfilScreen from './screens/PerfilScreen'
import { useApp } from './store/app'

export default function App() {
  const comprobando = useApp((s) => s.comprobando)
  const usuario = useApp((s) => s.usuario)
  const vista = useApp((s) => s.vista)
  const comprobarSesion = useApp((s) => s.comprobarSesion)

  useEffect(() => {
    void comprobarSesion()
  }, [comprobarSesion])

  if (comprobando) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3">
        <Logo size={56} conFondo />
        <Loader2 size={22} className="animate-spin text-marca-alta" />
      </div>
    )
  }

  return (
    <>
      {!usuario || vista === 'entrar' ? (
        <EntrarScreen />
      ) : vista === 'liga' ? (
        <LigaScreen />
      ) : vista === 'partida' ? (
        <PartidaScreen />
      ) : vista === 'perfil' ? (
        <PerfilScreen />
      ) : vista === 'admin' ? (
        <AdminScreen />
      ) : (
        <HomeScreen />
      )}
      {/* La invitación vive fuera de las pantallas: puede llegar esté donde esté. */}
      <Invitacion />
      <Toast />
    </>
  )
}
