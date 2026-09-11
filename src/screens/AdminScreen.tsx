import { AlertTriangle, ArrowLeft, KeyRound, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import PinInput from '../components/PinInput'
import Sheet from '../components/Sheet'
import { api, type Usuario } from '../lib/api'
import { conAviso, useApp } from '../store/app'

type FilaUsuario = Usuario & { es_admin_app: number; creado_en: string; bloqueado_hasta: string | null }

/** Panel del admin de la app: para cuando alguien olvide su PIN. */
export default function AdminScreen() {
  const irAHome = useApp((s) => s.irAHome)
  const avisar = useApp((s) => s.avisar)

  const [usuarios, setUsuarios] = useState<FilaUsuario[] | null>(null)
  const [elegido, setElegido] = useState<FilaUsuario | null>(null)
  const [pin, setPin] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const cargar = async () => {
    const r = await conAviso(() => api.usuarios())
    if (r) setUsuarios(r.usuarios as FilaUsuario[])
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetear = async () => {
    if (!elegido || pin.length !== 6 || ocupado) return
    setOcupado(true)
    const r = await conAviso(() => api.resetearPin(elegido.id, pin))
    setOcupado(false)
    if (r) {
      avisar(`PIN de ${elegido.nombre} cambiado`)
      setElegido(null)
      setPin('')
      void cargar()
    }
  }

  const bloqueado = (u: FilaUsuario) => !!u.bloqueado_hasta && u.bloqueado_hasta > new Date().toISOString()

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
          Usuarios
        </h1>
      </header>

      <section className="panel">
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Como no se pide correo, nadie puede recuperar su PIN solo. Cuando alguien lo olvide, se lo
          cambias aquí y le dices el nuevo. Al hacerlo se cierran sus sesiones abiertas.
        </p>

        {usuarios === null ? (
          <div className="animate-pulse">
            <div className="mb-3 h-9 rounded-lg bg-ink/8" />
            <div className="mb-3 h-9 rounded-lg bg-ink/8" />
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {usuarios.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-2.5 last:border-b-0"
              >
                <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink/8">
                  {u.foto ? (
                    <img src={u.foto} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display font-bold text-ink-soft">
                      {u.nombre.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <b className="truncate text-[15px] text-ink">{u.nombre}</b>
                    {u.es_admin_app === 1 && (
                      <Shield size={12} strokeWidth={3} className="shrink-0 text-[#7a5d20]" />
                    )}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    {u.usuario}
                    {bloqueado(u) && <b className="text-loss"> · bloqueado</b>}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setElegido(u)
                    setPin('')
                  }}
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-ink/8 px-2.5 py-2 text-xs font-bold text-ink-soft active:scale-95"
                >
                  <KeyRound size={13} strokeWidth={2.5} />
                  PIN
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet
        abierta={!!elegido}
        onCerrar={() => setElegido(null)}
        titulo={`Nuevo PIN de ${elegido?.nombre ?? ''}`}
      >
        <div className="balance balance-off">
          <AlertTriangle size={16} strokeWidth={2.4} />
          <span>Se cerrarán las sesiones abiertas de esta persona. Dile el PIN nuevo.</span>
        </div>

        <div className="my-4">
          <PinInput value={pin} onChange={setPin} label="Nuevo PIN" />
        </div>

        <button
          type="button"
          className="btn btn-gold mb-2"
          disabled={pin.length !== 6 || ocupado}
          onClick={() => void resetear()}
        >
          Cambiar PIN
        </button>
      </Sheet>
    </div>
  )
}
