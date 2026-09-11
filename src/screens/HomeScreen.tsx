import Esqueleto from '../components/Esqueleto'
import { ChevronRight, KeyRound, LogOut, Plus, Shield, Ticket, UserCog } from 'lucide-react'
import Avatar, { AvatarEditable } from '../components/Avatar'
import Logo from '../components/Logo'
import { useEffect, useState } from 'react'
import EditorFichas from '../components/EditorFichas'
import Sheet from '../components/Sheet'
import { api, type LigaResumen } from '../lib/api'
import { DEFAULT_COLORS } from '../store/defaults'
import { conAviso, useApp } from '../store/app'
import type { ChipColor } from '../store/types'

export default function HomeScreen() {
  const usuario = useApp((s) => s.usuario)!
  const irALiga = useApp((s) => s.irALiga)
  const irAPerfil = useApp((s) => s.irAPerfil)
  const irAAdmin = useApp((s) => s.irAAdmin)
  const salir = useApp((s) => s.salir)
  const avisar = useApp((s) => s.avisar)

  const [ligas, setLigas] = useState<LigaResumen[] | null>(null)
  const [creando, setCreando] = useState(false)
  const [uniendo, setUniendo] = useState(false)
  const [menu, setMenu] = useState(false)

  const [nombreLiga, setNombreLiga] = useState('')
  const [fotoLiga, setFotoLiga] = useState<string | null>(null)
  const [colores, setColores] = useState<ChipColor[]>(() => DEFAULT_COLORS.map((c) => ({ ...c })))
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const cargar = async () => {
    const r = await conAviso(() => api.ligas())
    if (r) setLigas(r.ligas)
  }

  useEffect(() => {
    void cargar()
    // solo al montar: las ligas se recargan al volver de una liga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const crear = async () => {
    if (!nombreLiga.trim() || ocupado) return
    setOcupado(true)
    const r = await conAviso(() => api.crearLiga(nombreLiga.trim(), colores, fotoLiga))
    setOcupado(false)
    if (r) {
      setCreando(false)
      setNombreLiga('')
      setFotoLiga(null)
      setColores(DEFAULT_COLORS.map((c) => ({ ...c })))
      avisar(`Liga creada. Código: ${r.liga.codigo}`)
      irALiga(r.liga.id)
    }
  }

  const unirme = async () => {
    if (codigo.trim().length < 4 || ocupado) return
    setOcupado(true)
    const r = await conAviso(() => api.unirme(codigo.trim()))
    setOcupado(false)
    if (r) {
      setUniendo(false)
      setCodigo('')
      avisar(r.yaEstaba ? 'Ya estabas en esa liga' : `Entraste a ${r.liga.nombre}`)
      irALiga(r.liga.id)
    }
  }

  return (
    <div className="mx-auto max-w-[640px] px-3.5 pb-10">
      <header className="sticky top-0 z-30 -mx-3.5 mb-4 flex items-center gap-3 border-b border-white/8 bg-marca/92 px-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        <Logo size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[17px] leading-tight font-bold tracking-[.5px] text-white uppercase">
            Tus ligas
          </div>
          <div className="truncate text-xs text-white">{usuario.nombre}</div>
        </div>
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-label="Tu cuenta"
          className="h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-full border-none bg-white/10 p-0 transition-transform active:scale-90"
        >
          {usuario.foto ? (
            <img src={usuario.foto} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-base font-bold text-white">
              {usuario.nombre.charAt(0).toUpperCase()}
            </span>
          )}
        </button>
      </header>

      {ligas === null ? (
        <Esqueleto filas={2} />
      ) : ligas.length === 0 ? (
        <section className="panel text-center">
          <Ticket size={30} className="mx-auto mb-2 text-ink-soft/45" strokeWidth={1.8} />
          <p className="m-0 mb-1 font-display text-lg font-semibold text-ink">Todavía sin ligas</p>
          <p className="mx-auto mb-0 max-w-[300px] text-[13px] leading-snug text-ink-soft">
            Crea una para tu grupo de póker, o entra a la de un amigo con el código que te pase.
          </p>
        </section>
      ) : (
        ligas.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => irALiga(l.id)}
            className="panel flex w-full cursor-pointer items-center gap-3 border-none text-left transition-transform active:scale-[.99]"
          >
            <Avatar foto={l.foto} nombre={l.nombre} size={46} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-display text-xl font-semibold text-ink">{l.nombre}</span>
                {l.es_admin === 1 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-marca/20 px-2 py-0.5 text-[10px] font-bold text-marca-tinta uppercase">
                    <Shield size={10} strokeWidth={3} />
                    Admin
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[13px] text-ink-soft">
                {l.miembros} {l.miembros === 1 ? 'jugador' : 'jugadores'} ·{' '}
                {l.partidas} {l.partidas === 1 ? 'partida' : 'partidas'}
              </div>
            </div>
            <ChevronRight size={20} className="shrink-0 text-ink-soft/50" />
          </button>
        ))
      )}

      <div className="mt-2 flex gap-2.5">
        <button type="button" className="btn btn-marca" onClick={() => setCreando(true)}>
          <Plus size={18} strokeWidth={2.6} />
          Crear liga
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setUniendo(true)}>
          <Ticket size={17} strokeWidth={2.4} />
          Con código
        </button>
      </div>

      {/* ---- crear liga ---- */}
      <Sheet abierta={creando} onCerrar={() => setCreando(false)} titulo="Nueva liga">
        <div className="mb-4 flex items-center gap-3">
          <AvatarEditable
            foto={fotoLiga}
            nombre={nombreLiga || '?'}
            size={76}
            etiqueta="Foto de la liga"
            onCambiar={setFotoLiga}
            onError={avisar}
          />
          <label className="min-w-0 flex-1">
            <span className="field-label">Nombre de la liga</span>
            <input
              type="text"
              value={nombreLiga}
              onChange={(e) => setNombreLiga(e.target.value)}
              placeholder="ej. Los Viernes"
              className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-marca"
            />
          </label>
        </div>

        <p className="panel-title mt-5">
          <span>Fichas de la casa</span>
        </p>
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Con esto la app calcula sola cuántas fichas darle a cada quien según el dinero con el que
          entra. Puedes cambiarlo después.
        </p>
        <EditorFichas colores={colores} onChange={setColores} />

        <button
          type="button"
          className="btn btn-marca mt-5 mb-2"
          disabled={!nombreLiga.trim() || ocupado}
          onClick={() => void crear()}
        >
          Crear liga
        </button>
      </Sheet>

      {/* ---- unirse con código ---- */}
      <Sheet abierta={uniendo} onCerrar={() => setUniendo(false)} titulo="Entrar a una liga">
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Pídele el código a quien administra la liga. Son 6 caracteres.
        </p>
        <input
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s/g, ''))}
          placeholder="ABC123"
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect="off"
          aria-label="Código de la liga"
          className="w-full rounded-xl border border-paper-line bg-white px-3 py-3.5 text-center font-display text-2xl font-bold tracking-[6px] text-ink uppercase outline-none focus:border-marca"
        />
        <button
          type="button"
          className="btn btn-marca mt-4 mb-2"
          disabled={codigo.trim().length < 4 || ocupado}
          onClick={() => void unirme()}
        >
          Entrar
        </button>
      </Sheet>

      {/* ---- menú de cuenta ---- */}
      <Sheet abierta={menu} onCerrar={() => setMenu(false)} titulo={usuario.nombre}>
        <button
          type="button"
          className="btn btn-ghost mb-2.5"
          onClick={() => {
            setMenu(false)
            irAPerfil()
          }}
        >
          <UserCog size={17} strokeWidth={2.4} />
          Mi perfil
        </button>

        {usuario.esAdminApp && (
          <button
            type="button"
            className="btn btn-ghost mb-2.5"
            onClick={() => {
              setMenu(false)
              irAAdmin()
            }}
          >
            <KeyRound size={17} strokeWidth={2.4} />
            Administrar usuarios
          </button>
        )}

        <button
          type="button"
          className="btn bg-loss/10 text-loss hover:bg-loss/16"
          onClick={() => void salir()}
        >
          <LogOut size={17} strokeWidth={2.4} />
          Cerrar sesión
        </button>
      </Sheet>
    </div>
  )
}
