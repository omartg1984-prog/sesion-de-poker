import Esqueleto from '../components/Esqueleto'
import { AlertTriangle, ArrowLeft, Coins, Lock, Trash2, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import NumInput from '../components/NumInput'
import Sheet from '../components/Sheet'
import { api, leerJson, type ConfigTorneo, type DetallePartida, type Miembro, type Participacion } from '../lib/api'
import { useRecargarAlVolver } from '../lib/recargar'
import { conAviso, useApp } from '../store/app'
import Numeros from './partida/Numeros'
import PartidaCash, { PESTANAS_CASH, type PestanaCash } from './partida/PartidaCash'
import PartidaTorneo, {
  PESTANAS_TORNEO,
  TORNEO_POR_DEFECTO,
  type PestanaTorneo,
} from './partida/PartidaTorneo'

type Pestana = PestanaCash | PestanaTorneo | 'numeros'

/**
 * Junta los cambios seguidos y manda uno solo por campo: teclear un monto no dispara
 * una petición por tecla. La clave agrupa por participación + campo, así dos ediciones
 * distintas del mismo jugador no se pisan.
 */
function useGuardadoDiferido(ms = 600) {
  const pendientes = useRef(new Map<string, () => Promise<unknown>>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (clave: string, fn: () => Promise<unknown>) => {
    pendientes.current.set(clave, fn)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const tareas = [...pendientes.current.values()]
      pendientes.current.clear()
      for (const t of tareas) void conAviso(t)
    }, ms)
  }
}

export default function PartidaScreen() {
  const partidaId = useApp((s) => s.partidaId)!
  const ligaId = useApp((s) => s.ligaId)
  const irALiga = useApp((s) => s.irALiga)
  const irAHome = useApp((s) => s.irAHome)
  const avisar = useApp((s) => s.avisar)

  const [datos, setDatos] = useState<DetallePartida | null>(null)
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [pestana, setPestana] = useState<Pestana>('jugadores')
  const [cargando, setCargando] = useState(true)
  const [eligiendo, setEligiendo] = useState(false)
  const [seleccion, setSeleccion] = useState<Record<string, number>>({})
  const [ocupado, setOcupado] = useState(false)
  const [torneo, setTorneo] = useState<ConfigTorneo>(TORNEO_POR_DEFECTO)
  const [borrando, setBorrando] = useState(false)

  const diferido = useGuardadoDiferido()

  const cargar = async () => {
    const d = await conAviso(() => api.partida(partidaId))
    if (d) {
      setDatos(d)
      setTorneo(leerJson<ConfigTorneo>(d.partida.torneo, TORNEO_POR_DEFECTO))
      if (d.partida.tipo === 'torneo') setPestana((p) => (p === 'final' ? 'torneo' : p))
      const l = await conAviso(() => api.liga(d.partida.liga_id))
      if (l) setMiembros(l.miembros)
    }
    setCargando(false)
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaId])

  // Otro admin pudo haber tocado la partida desde su teléfono mientras no mirabas.
  useRecargarAlVolver(() => void cargar())

  const colores = useMemo(() => datos?.liga.colores ?? [], [datos])
  const esTorneo = datos?.partida.tipo === 'torneo'
  const cerrada = datos?.partida.estado === 'cerrada'
  const puedeEditar = !!datos?.soyAdmin && !cerrada
  const pestanas = [
    ...(esTorneo ? PESTANAS_TORNEO : PESTANAS_CASH),
    { id: 'numeros' as const, label: 'Números' },
  ]

  /** Cambia una participación en pantalla al instante y la manda al servidor con retraso. */
  const tocar = (id: string, enPantalla: Partial<Participacion>, aGuardar: Record<string, unknown>) => {
    setDatos((d) =>
      d
        ? { ...d, participaciones: d.participaciones.map((p) => (p.id === id ? { ...p, ...enPantalla } : p)) }
        : d,
    )
    diferido(id + ':' + Object.keys(aGuardar).join(), () =>
      api.guardarParticipacion(id, aGuardar as Parameters<typeof api.guardarParticipacion>[1]),
    )
  }

  const cambiarTorneo = (t: ConfigTorneo) => {
    setTorneo(t)
    diferido('torneo', () => api.guardarPartida(partidaId, { torneo: t }))
  }

  if (cargando)
    return (
      <div className="mx-auto max-w-[640px] px-3.5 pt-[max(3rem,env(safe-area-inset-top))]">
        <Esqueleto filas={3} />
      </div>
    )
  if (!datos) return null

  const volver = () => (ligaId ? irALiga(ligaId) : irAHome())

  const abrirSelector = () => {
    const actual: Record<string, number> = {}
    for (const p of datos.participaciones) actual[p.usuario_id] = p.entrada
    setSeleccion(actual)
    setEligiendo(true)
  }

  const guardarJugadores = async () => {
    if (ocupado) return
    setOcupado(true)
    const jugadores = Object.entries(seleccion).map(([usuarioId, entrada]) => ({
      usuarioId,
      // En torneo todos pagan lo mismo: el costo de entrada manda.
      entrada: esTorneo ? torneo.buyIn : entrada,
    }))
    const r = await conAviso(() => api.cargarJugadores(partidaId, jugadores))
    setOcupado(false)
    if (r) {
      setEligiendo(false)
      void cargar()
    }
  }

  const cerrarPartida = async () => {
    if (!window.confirm('¿Cerrar la partida? Ya no se podrá editar.')) return
    const r = await conAviso(() => api.guardarPartida(partidaId, { estado: 'cerrada' }))
    if (r) {
      avisar('Partida cerrada')
      void cargar()
    }
  }

  const borrarPartida = async () => {
    const r = await conAviso(() => api.borrarPartida(partidaId))
    if (r) {
      avisar('Partida borrada')
      volver()
    }
  }

  const comunes = { datos, colores, puedeEditar, tocar, recargar: cargar }
  // La configuración del torneo se tiene que poder abrir ANTES de cargar a nadie:
  // ahí se define el costo de entrada con el que entran todos.
  const sinJugadores = datos.participaciones.length === 0 && pestana !== 'torneo' && pestana !== 'numeros'

  return (
    <div className="mx-auto max-w-[640px] px-3.5 pb-10">
      <header className="sticky top-0 z-30 -mx-3.5 mb-3 border-b border-white/8 bg-[#1b241a]/85 px-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={volver}
            aria-label="Volver a la liga"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-white/8 text-mint active:scale-90"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 truncate font-display text-[17px] leading-tight font-bold tracking-[.5px] text-gold-soft uppercase">
              {datos.partida.nombre || datos.partida.fecha}
            </h1>
            <span className="text-[11px] text-mint-soft">
              {esTorneo ? 'Torneo' : 'Cash'} · {datos.liga.nombre}
            </span>
          </div>
          {cerrada && <Lock size={15} className="shrink-0 text-mint-soft" />}
        </div>

        <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto rounded-xl bg-black/30 p-1">
          {pestanas.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={pestana === t.id ? 'page' : undefined}
              onClick={() => setPestana(t.id)}
              className={`flex-1 cursor-pointer rounded-[9px] border-none px-3 py-2 text-[12.5px] font-bold whitespace-nowrap transition-colors ${
                pestana === t.id ? 'bg-gold text-[#2e1a11]' : 'bg-transparent text-mint-soft'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {sinJugadores ? (
        <section className="panel text-center">
          <Users size={30} className="mx-auto mb-2 text-ink-soft/45" strokeWidth={1.8} />
          <p className="m-0 mb-1 font-display text-lg font-semibold text-ink">Nadie cargado aún</p>
          <p className="mx-auto mb-3 max-w-[300px] text-[13px] leading-snug text-ink-soft">
            {datos.soyAdmin
              ? esTorneo
                ? 'Pon el costo de entrada en la pestaña Torneo y luego elige quiénes llegaron.'
                : 'Elige quiénes llegaron y con cuánto entra cada uno.'
              : 'Un admin de la liga tiene que cargar a los jugadores.'}
          </p>
          {puedeEditar && (
            <button type="button" className="btn btn-gold" onClick={abrirSelector}>
              <UserPlus size={18} strokeWidth={2.5} />
              Cargar jugadores
            </button>
          )}
        </section>
      ) : pestana === 'numeros' ? (
        <Numeros {...comunes} torneo={torneo} />
      ) : esTorneo ? (
        <PartidaTorneo
          {...comunes}
          pestana={pestana as PestanaTorneo}
          torneo={torneo}
          cambiarTorneo={cambiarTorneo}
        />
      ) : (
        <PartidaCash {...comunes} pestana={pestana as PestanaCash} />
      )}

      {!sinJugadores && puedeEditar && pestana === 'jugadores' && (
        <button type="button" className="btn btn-ghost" onClick={abrirSelector}>
          <UserPlus size={17} strokeWidth={2.4} />
          Cambiar quiénes juegan
        </button>
      )}

      {!sinJugadores && puedeEditar && pestana === 'resultado' && (
        <button type="button" className="btn btn-ghost mt-2" onClick={() => void cerrarPartida()}>
          <Lock size={17} strokeWidth={2.4} />
          Cerrar partida
        </button>
      )}

      {datos.soyAdmin && (
        <button
          type="button"
          className="btn mt-6 bg-loss/10 text-loss hover:bg-loss/16"
          onClick={() => setBorrando(true)}
        >
          <Trash2 size={17} strokeWidth={2.4} />
          Borrar esta partida
        </button>
      )}

      <Sheet abierta={borrando} onCerrar={() => setBorrando(false)} titulo="Borrar la partida">
        <div className="balance balance-off">
          <AlertTriangle size={16} strokeWidth={2.4} />
          <span>
            Se borra para todos, con lo capturado de los {datos.participaciones.length} jugadores.
            No se puede deshacer.
          </span>
        </div>
        <p className="mt-0 mb-4 text-[13px] leading-snug text-ink-soft">
          También sale de la tabla de posiciones de la liga.
        </p>
        <button
          type="button"
          className="btn mb-2 bg-loss text-white hover:bg-loss/90"
          onClick={() => void borrarPartida()}
        >
          <Trash2 size={17} strokeWidth={2.4} />
          Sí, borrarla
        </button>
        <button type="button" className="btn btn-ghost mb-2" onClick={() => setBorrando(false)}>
          Mejor no
        </button>
      </Sheet>

      {/* ---- elegir quiénes jugaron ---- */}
      <Sheet abierta={eligiendo} onCerrar={() => setEligiendo(false)} titulo="¿Quiénes jugaron?">
        <p className="mt-0 mb-3 text-[13px] leading-snug text-ink-soft">
          {esTorneo
            ? `Marca a los que llegaron. Todos entran con ${money0(torneo.buyIn)}, el costo de entrada del torneo.`
            : 'Marca a los que llegaron y pon con cuánto entra cada uno.'}
        </p>
        <ul className="m-0 mb-4 list-none p-0">
          {miembros.map((m) => {
            const puesto = m.id in seleccion
            return (
              <li key={m.id} className="border-b border-dashed border-paper-line py-2.5 last:border-b-0">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={puesto}
                    aria-label={`${m.nombre} jugó`}
                    className="h-5 w-5 shrink-0"
                    onChange={(e) =>
                      setSeleccion((s) => {
                        const n = { ...s }
                        if (e.target.checked) n[m.id] = esTorneo ? torneo.buyIn : 0
                        else delete n[m.id]
                        return n
                      })
                    }
                  />
                  <b className="min-w-0 flex-1 truncate text-[15px] text-ink">{m.nombre}</b>
                  {puesto && !esTorneo && (
                    <div className="flex w-[120px] shrink-0 items-center rounded-lg border border-paper-line bg-white px-2">
                      <span className="font-bold text-ink-soft">$</span>
                      <NumInput
                        value={seleccion[m.id]}
                        mode="decimal"
                        aria-label={`Dinero de ${m.nombre}`}
                        className="w-full border-none bg-transparent px-1 py-2 text-[15px] font-semibold outline-none"
                        onChange={(v) => setSeleccion((s) => ({ ...s, [m.id]: v }))}
                      />
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <button type="button" className="btn btn-gold mb-2" disabled={ocupado} onClick={() => void guardarJugadores()}>
          <Coins size={17} strokeWidth={2.4} />
          Guardar y repartir fichas
        </button>
      </Sheet>
    </div>
  )
}

/** Formato corto de dinero para textos cortos dentro de la interfaz. */
function money0(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-MX')
}
