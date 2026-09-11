import {
  ArrowLeft,
  Banknote,
  CalendarPlus,
  ChevronRight,
  ClipboardCopy,
  Coins,
  Shield,
  Trophy,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import EditorFichas from '../components/EditorFichas'
import Sheet from '../components/Sheet'
import { copyText } from '../lib/backup'
import { api, type Liga, type Miembro, type PartidaResumen, type TablaPosiciones as Tabla, type TipoPartida } from '../lib/api'
import TablaPosiciones from './liga/TablaPosiciones'
import { conAviso, useApp } from '../store/app'
import type { ChipColor } from '../store/types'

const hoy = () => new Date().toISOString().slice(0, 10)

function fechaLarga(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export default function LigaScreen() {
  const ligaId = useApp((s) => s.ligaId)!
  const yo = useApp((s) => s.usuario)!
  const irAHome = useApp((s) => s.irAHome)
  const irAPartida = useApp((s) => s.irAPartida)
  const avisar = useApp((s) => s.avisar)

  const [liga, setLiga] = useState<Liga | null>(null)
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [soyAdmin, setSoyAdmin] = useState(false)
  const [partidas, setPartidas] = useState<PartidaResumen[]>([])
  const [tabla, setTabla] = useState<Tabla | null>(null)
  const [pestana, setPestana] = useState<'partidas' | 'posiciones'>('partidas')

  const [creando, setCreando] = useState(false)
  const [fichas, setFichas] = useState(false)
  const [gente, setGente] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const [fecha, setFecha] = useState(hoy())
  const [nombrePartida, setNombrePartida] = useState('')
  const [tipo, setTipo] = useState<TipoPartida>('cash')
  const [colores, setColores] = useState<ChipColor[]>([])

  const cargar = async () => {
    const [l, p, t] = await Promise.all([
      conAviso(() => api.liga(ligaId)),
      conAviso(() => api.partidas(ligaId)),
      conAviso(() => api.posiciones(ligaId)),
    ])
    if (l) {
      setLiga(l.liga)
      setMiembros(l.miembros)
      setSoyAdmin(l.soyAdmin)
      setColores(l.liga.colores)
    }
    if (p) setPartidas(p.partidas)
    if (t) setTabla(t)
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligaId])

  const crearPartida = async () => {
    if (ocupado) return
    setOcupado(true)
    const r = await conAviso(() =>
      api.crearPartida(ligaId, { fecha, nombre: nombrePartida.trim() || undefined, tipo }),
    )
    setOcupado(false)
    if (r) {
      setCreando(false)
      setNombrePartida('')
      irAPartida(r.partida.id, ligaId)
    }
  }

  const guardarFichas = async () => {
    if (ocupado) return
    setOcupado(true)
    const r = await conAviso(() => api.guardarLiga(ligaId, { colores }))
    setOcupado(false)
    if (r) {
      setFichas(false)
      avisar('Fichas actualizadas')
      void cargar()
    }
  }

  const alternarAdmin = async (m: Miembro) => {
    const r = await conAviso(() => api.cambiarAdminLiga(ligaId, m.id, m.es_admin !== 1))
    if (r) void cargar()
  }

  if (!liga) {
    return <p className="mt-20 text-center text-sm text-mint-soft">Cargando…</p>
  }

  return (
    <div className="mx-auto max-w-[640px] px-3.5 pb-10">
      <header className="sticky top-0 z-30 -mx-3.5 mb-4 flex items-center gap-3 border-b border-white/8 bg-[#1b241a]/85 px-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={irAHome}
          aria-label="Volver a tus ligas"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/8 text-mint active:scale-90"
        >
          <ArrowLeft size={18} strokeWidth={2.4} />
        </button>
        <h1 className="m-0 min-w-0 flex-1 truncate font-display text-[17px] font-bold tracking-[.5px] text-gold-soft uppercase">
          {liga.nombre}
        </h1>
        {soyAdmin && <Shield size={15} className="shrink-0 text-gold" />}
      </header>

      {/* código para invitar */}
      <button
        type="button"
        onClick={async () =>
          avisar((await copyText(liga.codigo)) ? 'Código copiado' : 'No se pudo copiar')
        }
        className="mb-3.5 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-gold/25 bg-gradient-to-br from-[#2c3a26] to-[#1b241a] px-4 py-3 text-left active:scale-[.99]"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold tracking-[1px] text-mint-soft uppercase">
            Código para invitar
          </div>
          <div className="font-display text-2xl font-bold tracking-[4px] text-gold-soft">
            {liga.codigo}
          </div>
        </div>
        <ClipboardCopy size={18} className="shrink-0 text-gold" />
      </button>

      <div className="mb-3.5 flex gap-1 rounded-xl bg-black/30 p-1">
        {(
          [
            ['partidas', 'Partidas'],
            ['posiciones', 'Posiciones'],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            aria-current={pestana === id ? 'page' : undefined}
            onClick={() => setPestana(id)}
            className={`flex-1 cursor-pointer rounded-[9px] border-none py-2 text-[13px] font-bold transition-colors ${
              pestana === id ? 'bg-gold text-[#2e1a11]' : 'bg-transparent text-mint-soft'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === 'posiciones' && <TablaPosiciones tabla={tabla} />}

      {/* partidas */}
      {pestana === 'partidas' && (
      <section className="panel">
        <p className="panel-title">
          <span>Partidas</span>
        </p>

        {partidas.length === 0 ? (
          <p className="m-0 mb-3 text-[13px] text-ink-soft">
            Todavía no hay partidas. {soyAdmin ? 'Crea la primera.' : 'Un admin tiene que crearlas.'}
          </p>
        ) : (
          <ul className="m-0 mb-3 list-none p-0">
            {partidas.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => irAPartida(p.id, ligaId)}
                  className="flex w-full cursor-pointer items-center gap-2.5 border-none border-b border-dashed border-paper-line bg-transparent px-0.5 py-3 text-left last:border-b-0"
                >
                  {p.tipo === 'torneo' ? (
                    <Trophy size={17} className="shrink-0 text-[#7a5d20]" strokeWidth={2.3} />
                  ) : (
                    <Banknote size={17} className="shrink-0 text-[#7a5d20]" strokeWidth={2.3} />
                  )}
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px] text-ink">
                      {p.nombre || fechaLarga(p.fecha)}
                    </b>
                    <span className="block text-xs text-ink-soft">
                      {p.nombre ? `${fechaLarga(p.fecha)} · ` : ''}
                      {p.jugadores} {p.jugadores === 1 ? 'jugador' : 'jugadores'}
                      {p.estado === 'cerrada' && ' · cerrada'}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink-soft/45" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {soyAdmin && (
          <button
            type="button"
            className="btn-dashed flex items-center justify-center gap-1.5"
            onClick={() => setCreando(true)}
          >
            <CalendarPlus size={16} strokeWidth={2.5} />
            Nueva partida
          </button>
        )}
      </section>
      )}

      {/* accesos a jugadores y fichas */}
      <div className="flex gap-2.5">
        <button type="button" className="btn btn-ghost" onClick={() => setGente(true)}>
          <Users size={17} strokeWidth={2.4} />
          {miembros.length} {miembros.length === 1 ? 'jugador' : 'jugadores'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setFichas(true)}>
          <Coins size={17} strokeWidth={2.4} />
          Fichas
        </button>
      </div>

      {/* ---- nueva partida ---- */}
      <Sheet abierta={creando} onCerrar={() => setCreando(false)} titulo="Nueva partida">
        <span className="field-label">Tipo</span>
        <div className="mt-1 mb-4 flex gap-1 rounded-xl bg-ink/8 p-1">
          {(
            [
              ['cash', 'Cash', Banknote],
              ['torneo', 'Torneo', Trophy],
            ] as const
          ).map(([t, texto, Icono]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] border-none py-2.5 text-sm font-bold transition-colors ${
                tipo === t ? 'bg-gold text-[#2e1a11] shadow-sm' : 'bg-transparent text-ink-soft'
              }`}
            >
              <Icono size={15} strokeWidth={2.4} />
              {texto}
            </button>
          ))}
        </div>

        <label className="mb-4 block">
          <span className="field-label">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-gold"
          />
        </label>

        <label className="mb-4 block">
          <span className="field-label">Nombre (opcional)</span>
          <input
            type="text"
            value={nombrePartida}
            onChange={(e) => setNombrePartida(e.target.value)}
            placeholder="ej. Cumpleaños de Beto"
            className="mt-1 w-full rounded-xl border border-paper-line bg-white px-3 py-3 text-base font-semibold text-ink outline-none focus:border-gold"
          />
        </label>

        <button type="button" className="btn btn-gold mb-2" disabled={ocupado} onClick={() => void crearPartida()}>
          Crear partida
        </button>
      </Sheet>

      {/* ---- jugadores de la liga ---- */}
      <Sheet abierta={gente} onCerrar={() => setGente(false)} titulo="Jugadores de la liga">
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Se unen con el código de la liga.{' '}
          {soyAdmin && 'Toca el escudo para dar o quitar permisos de admin.'}
        </p>
        <ul className="m-0 list-none p-0">
          {miembros.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2.5 border-b border-dashed border-paper-line py-2.5 last:border-b-0"
            >
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink/8">
                {m.foto ? (
                  <img src={m.foto} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display font-bold text-ink-soft">
                    {m.nombre.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] text-ink">
                  {m.nombre}
                  {m.id === yo.id && <span className="font-normal text-ink-soft"> (tú)</span>}
                </b>
                <span className="block truncate text-xs text-ink-soft">{m.usuario}</span>
              </span>
              <button
                type="button"
                disabled={!soyAdmin}
                onClick={() => void alternarAdmin(m)}
                aria-label={m.es_admin === 1 ? `Quitar admin a ${m.nombre}` : `Hacer admin a ${m.nombre}`}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-none transition-colors ${
                  m.es_admin === 1 ? 'bg-gold/22 text-[#7a5d20]' : 'bg-ink/8 text-ink-soft/45'
                } ${soyAdmin ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
              >
                <Shield size={15} strokeWidth={2.6} />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {/* ---- fichas de la casa ---- */}
      <Sheet abierta={fichas} onCerrar={() => setFichas(false)} titulo="Fichas de la casa">
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          Con esto la app calcula cuántas fichas darle a cada quien según el dinero con el que entra.
          {!soyAdmin && ' Solo un admin de la liga puede cambiarlo.'}
        </p>
        <EditorFichas colores={colores} onChange={setColores} soloLectura={!soyAdmin} />
        {soyAdmin && (
          <button
            type="button"
            className="btn btn-gold mt-4 mb-2"
            disabled={ocupado}
            onClick={() => void guardarFichas()}
          >
            Guardar fichas
          </button>
        )}
      </Sheet>
    </div>
  )
}
